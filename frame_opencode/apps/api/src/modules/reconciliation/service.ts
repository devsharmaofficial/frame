import { db } from "../../db.js";
import {
  payments,
  paymentIntents,
  paymentAttempts,
  providerEvents,
  ledgerEntries,
  auditEvents,
} from "@frame/db";
import { eq, and, lt, desc, inArray } from "drizzle-orm";
import { appendAudit } from "../../lib/audit.js";
import {
  simulateWebhook,
  getSandboxPaymentStatus,
} from "../provider/sandbox.js";

const STALE_PENDING_MINUTES = 5;
const EXCEPTION_MINUTES = 30;

export type ExceptionIssue =
  | "STALE_PENDING"
  | "STATUS_MISMATCH"
  | "MISSING_LEDGER"
  | "NO_PROVIDER_EVENT";

export interface ReconciliationException {
  paymentId: string;
  intentId: string;
  status: string;
  amountPaise: number;
  currency: string;
  providerPaymentId: string | null;
  ageMinutes: number;
  issue: ExceptionIssue;
}

function ageMinutes(from: Date): number {
  return Math.floor((Date.now() - from.getTime()) / 60000);
}

function terminalAttemptStatus(status: string | null | undefined): boolean {
  return status === "SUCCEEDED" || status === "FAILED";
}

/**
 * Read-only derived view of payments that look wrong.
 *
 * A payment is listed when any of these hold:
 * - its latest audit event is `reconciliation.exception`
 * - it is PENDING older than 5 minutes (STALE_PENDING)
 * - its latest payment_attempt disagrees with payments.status (STATUS_MISMATCH)
 * - it is terminal without a ledger entry (MISSING_LEDGER)
 * - it is terminal without any provider event (NO_PROVIDER_EVENT)
 */
export async function listExceptions(
  orgId: string,
): Promise<ReconciliationException[]> {
  const orgPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.organizationId, orgId))
    .orderBy(desc(payments.createdAt));

  if (orgPayments.length === 0) return [];

  const paymentIds = orgPayments.map((p) => p.id);
  const intentIds = [...new Set(orgPayments.map((p) => p.paymentIntentId))];

  const intentRows = intentIds.length
    ? await db
        .select({ id: paymentIntents.id })
        .from(paymentIntents)
        .where(inArray(paymentIntents.id, intentIds))
    : [];
  const knownIntentIds = new Set(intentRows.map((r) => r.id));

  const attemptRows = await db
    .select()
    .from(paymentAttempts)
    .where(inArray(paymentAttempts.paymentId, paymentIds));
  const attemptsByPayment = new Map<string, typeof attemptRows>();
  for (const a of attemptRows) {
    const list = attemptsByPayment.get(a.paymentId) ?? [];
    list.push(a);
    attemptsByPayment.set(a.paymentId, list);
  }

  const ledgerRows = await db
    .select({ paymentId: ledgerEntries.paymentId })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.organizationId, orgId));
  const ledgerPaymentIds = new Set(
    ledgerRows.map((r) => r.paymentId).filter(Boolean) as string[],
  );

  const eventRows = await db
    .select({ paymentId: providerEvents.paymentId })
    .from(providerEvents)
    .where(eq(providerEvents.organizationId, orgId));
  const eventPaymentIds = new Set(
    eventRows.map((r) => r.paymentId).filter(Boolean) as string[],
  );

  const auditRows = await db
    .select({
      resourceId: auditEvents.resourceId,
      action: auditEvents.action,
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.organizationId, orgId),
        inArray(auditEvents.resourceId, paymentIds),
      ),
    )
    .orderBy(desc(auditEvents.createdAt));
  const latestAuditByPayment = new Map<string, string>();
  for (const row of auditRows) {
    if (row.resourceId && !latestAuditByPayment.has(row.resourceId)) {
      latestAuditByPayment.set(row.resourceId, row.action);
    }
  }

  const out: ReconciliationException[] = [];
  for (const p of orgPayments) {
    if (!knownIntentIds.has(p.paymentIntentId)) continue;
    const age = ageMinutes(p.createdAt ?? new Date());
    const attempts = attemptsByPayment.get(p.id) ?? [];
    const latestAttempt = attempts.sort(
      (a, b) => (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0),
    )[0];
    const latestProviderStatus = latestAttempt?.providerStatus ?? null;

    let issue: ExceptionIssue | null = null;

    if (
      terminalAttemptStatus(latestProviderStatus) &&
      latestProviderStatus !== p.status
    ) {
      issue = "STATUS_MISMATCH";
    } else if (
      (p.status === "SUCCEEDED" || p.status === "FAILED") &&
      !ledgerPaymentIds.has(p.id)
    ) {
      issue = "MISSING_LEDGER";
    } else if (
      (p.status === "SUCCEEDED" || p.status === "FAILED") &&
      !eventPaymentIds.has(p.id)
    ) {
      issue = "NO_PROVIDER_EVENT";
    } else if (p.status === "PENDING" && age >= STALE_PENDING_MINUTES) {
      issue = "STALE_PENDING";
    } else if (latestAuditByPayment.get(p.id) === "reconciliation.exception") {
      issue = "STALE_PENDING";
    }

    if (issue) {
      out.push({
        paymentId: p.id,
        intentId: p.paymentIntentId,
        status: p.status,
        amountPaise: Number(p.amountPaise),
        currency: p.currency,
        providerPaymentId: p.providerPaymentId,
        ageMinutes: age,
        issue,
      });
    }
  }

  return out;
}

export interface ReconciliationRunResult {
  checked: number;
  fixed: number;
  exceptions: Array<{
    paymentId: string;
    providerPaymentId: string | null;
    issue: ExceptionIssue;
    reason: string;
    ageMinutes: number;
  }>;
}

/**
 * Reconcile stale PENDING payments against the sandbox provider.
 *
 * Idempotent: only non-terminal payments are transitioned (each provider
 * event is deduped by simulateWebhook), and a `reconciliation.exception`
 * audit is written at most once per payment (skipped when the latest audit
 * for that payment is already one).
 */
export async function runReconciliation(
  orgId: string,
  opts: { actorType?: string; actorId?: string; requestId?: string } = {},
): Promise<ReconciliationRunResult> {
  const cutoff = new Date(Date.now() - STALE_PENDING_MINUTES * 60 * 1000);
  const stale = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, orgId),
        eq(payments.status, "PENDING"),
        lt(payments.createdAt, cutoff),
      ),
    );

  let fixed = 0;
  const exceptions: ReconciliationRunResult["exceptions"] = [];

  for (const payment of stale) {
    // Re-check: only transition non-terminal states (idempotency).
    const [fresh] = await db
      .select({ status: payments.status })
      .from(payments)
      .where(eq(payments.id, payment.id))
      .limit(1);
    if (!fresh || fresh.status !== "PENDING") continue;
    if (!payment.providerPaymentId) continue;

    const providerStatus = await getSandboxPaymentStatus(
      payment.providerPaymentId,
    );
    const age = ageMinutes(payment.createdAt ?? new Date());

    if (providerStatus === "SUCCEEDED" || providerStatus === "FAILED") {
      const eventType =
        providerStatus === "SUCCEEDED"
          ? "payment.succeeded"
          : "payment.failed";
      const result = await simulateWebhook(
        orgId,
        eventType,
        payment.providerPaymentId,
      );
      if (result.processed) fixed += 1;
      continue;
    }

    // No conclusive provider outcome (UNKNOWN, or still PENDING provider-side)
    // on a payment older than 30 minutes → record a reconciliation exception.
    if (
      (providerStatus === "UNKNOWN" || providerStatus === "PENDING") &&
      age >= EXCEPTION_MINUTES
    ) {
      const [latestAudit] = await db
        .select({ action: auditEvents.action })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.organizationId, orgId),
            eq(auditEvents.resourceId, payment.id),
          ),
        )
        .orderBy(desc(auditEvents.createdAt))
        .limit(1);

      const reason = `provider state UNKNOWN for payment ${age} minutes old`;

      if (latestAudit?.action !== "reconciliation.exception") {
        await appendAudit({
          organizationId: orgId,
          actorType: opts.actorType ?? "system",
          actorId: opts.actorId,
          action: "reconciliation.exception",
          resourceType: "payment",
          resourceId: payment.id,
          entityAfter: {
            expected: "SUCCEEDED|FAILED",
            observed: providerStatus,
            reason,
          },
          requestId: opts.requestId,
        });
      }

      exceptions.push({
        paymentId: payment.id,
        providerPaymentId: payment.providerPaymentId,
        issue: "STALE_PENDING",
        reason,
        ageMinutes: age,
      });
    }
  }

  await appendAudit({
    organizationId: orgId,
    actorType: opts.actorType ?? "system",
    actorId: opts.actorId,
    action: "reconciliation.run",
    entityAfter: {
      checked: stale.length,
      fixed,
      exceptionCount: exceptions.length,
    },
    requestId: opts.requestId,
  });

  return { checked: stale.length, fixed, exceptions };
}
