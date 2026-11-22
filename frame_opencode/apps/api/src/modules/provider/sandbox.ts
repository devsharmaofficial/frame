import { db } from "../../db.js";
import {
  payments,
  paymentAttempts,
  paymentIntents,
  ledgerEntries,
  providerEvents,
  auditEvents,
} from "@frame/db";
import { eq, and, desc } from "drizzle-orm";
import { sha256 } from "../../lib/hash.js";
import { appendAudit } from "../../lib/audit.js";
import { emitNotification } from "../../lib/notify.js";

export function randomHex(len: number): string {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface PaymentProvider {
  createAuthorization(params: { amountPaise: number; currency: string; merchant: string }): Promise<{ providerPaymentId: string }>;
  executePayment(providerPaymentId: string): Promise<{ status: string }>;
  getPaymentStatus(providerPaymentId: string): Promise<{ status: string }>;
  cancelPayment(providerPaymentId: string): Promise<{ status: string }>;
  handleWebhook(payload: unknown, signature: string): Promise<{ eventType: string; paymentId: string }>;
}

/**
 * Pure lookup of the latest known sandbox provider state for a payment.
 *
 * Inspects provider_events first (authoritative webhook record), then falls
 * back to the latest payment_attempts row. Returns "UNKNOWN" when nothing
 * conclusive is known. No side effects — safe for reconciliation polling.
 */
export async function getSandboxPaymentStatus(
  providerPaymentId: string,
): Promise<"SUCCEEDED" | "FAILED" | "PENDING" | "UNKNOWN"> {
  const [payment] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.providerPaymentId, providerPaymentId))
    .limit(1);

  if (!payment) return "UNKNOWN";

  const [latestEvent] = await db
    .select({ eventType: providerEvents.eventType })
    .from(providerEvents)
    .where(eq(providerEvents.paymentId, payment.id))
    .orderBy(desc(providerEvents.receivedAt))
    .limit(1);

  if (latestEvent) {
    if (latestEvent.eventType === "payment.succeeded") return "SUCCEEDED";
    if (latestEvent.eventType === "payment.failed") return "FAILED";
  }

  const [latestAttempt] = await db
    .select({ providerStatus: paymentAttempts.providerStatus })
    .from(paymentAttempts)
    .where(eq(paymentAttempts.paymentId, payment.id))
    .orderBy(desc(paymentAttempts.createdAt))
    .limit(1);

  if (latestAttempt?.providerStatus === "SUCCEEDED") return "SUCCEEDED";
  if (latestAttempt?.providerStatus === "FAILED") return "FAILED";
  if (latestAttempt?.providerStatus === "PENDING") return "PENDING";

  return "UNKNOWN";
}

export async function simulateWebhook(
  orgId: string,
  eventType: string,
  providerPaymentId: string,
) {
  const dedupKey = `${eventType}:${providerPaymentId}`;
  const [existing] = await db
    .select()
    .from(providerEvents)
    .where(eq(providerEvents.dedupKey, dedupKey))
    .limit(1);

  if (existing) return { processed: false };

  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.providerPaymentId, providerPaymentId),
        eq(payments.provider, "sandbox"),
      ),
    )
    .limit(1);

  if (!payment) return { processed: false };

  // Idempotency: never transition a payment out of a terminal state.
  if (payment.status === "SUCCEEDED" || payment.status === "FAILED") {
    return { processed: false, status: payment.status };
  }

  await db.insert(providerEvents).values({
    organizationId: orgId,
    paymentId: payment.id,
    provider: "sandbox",
    eventType,
    rawPayload: { eventType, providerPaymentId },
    processed: true,
    dedupKey,
  });

  const newStatus = eventType === "payment.succeeded" ? "SUCCEEDED" : "FAILED";

  await db
    .update(payments)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(payments.id, payment.id));

  await db.insert(paymentAttempts).values({
    organizationId: orgId,
    paymentId: payment.id,
    attemptNumber: 2,
    providerStatus: newStatus,
  });

  await db
    .update(paymentIntents)
    .set({
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(paymentIntents.id, payment.paymentIntentId));

  // Ledger entry with hash chain
  const [lastLedger] = await db
    .select({ entryHash: ledgerEntries.entryHash })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.organizationId, orgId))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(1);

  const previousHash = lastLedger?.entryHash ?? "0000000000000000000000000000000000000000000000000000000000000000";
  const payload = {
    paymentId: payment.id,
    providerPaymentId,
    amountPaise: Number(payment.amountPaise),
    status: newStatus,
    timestamp: new Date().toISOString(),
  };
  const entryHash = sha256(previousHash + JSON.stringify(payload));

  await db.insert(ledgerEntries).values({
    organizationId: orgId,
    paymentIntentId: payment.paymentIntentId,
    paymentId: payment.id,
    entryType: newStatus === "SUCCEEDED" ? "payment_success" : "payment_failure",
    amountPaise: payment.amountPaise,
    currency: payment.currency,
    providerReference: providerPaymentId,
    previousHash,
    entryHash,
  });

  await appendAudit({
    organizationId: orgId,
    actorType: "system",
    action: `payment.${newStatus.toLowerCase()}`,
    resourceType: "payment",
    resourceId: payment.id,
    entityAfter: { status: newStatus },
    decision: newStatus === "SUCCEEDED" ? "ALLOW" : "DENY",
  });

  try {
    await emitNotification(
      orgId,
      newStatus === "SUCCEEDED" ? "payment.succeeded" : "payment.failed",
      {
        paymentId: payment.id,
        paymentIntentId: payment.paymentIntentId,
        providerPaymentId,
        status: newStatus,
        amountPaise: Number(payment.amountPaise),
        currency: payment.currency,
      },
      { resourceType: "payment", resourceId: payment.id },
    );
  } catch {
    // notify must never break webhook processing
  }

  return { processed: true, status: newStatus };
}
