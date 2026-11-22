import { db } from "../../db.js";
import {
  paymentIntents,
  paymentDecisions,
  approvalTasks,
  payments,
  paymentAttempts,
  ledgerEntries,
  idempotencyKeys,
  policies,
  policyVersions,
  auditEvents,
} from "@frame/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { sha256 } from "../../lib/hash.js";
import { AppError } from "../../lib/errors.js";
import { evaluate, type PolicyConfig } from "../policies/evaluator.js";
import { assessRisk, type RiskAssessment } from "../risk/signals.js";
import { appendAudit } from "../../lib/audit.js";
import { emitNotification } from "../../lib/notify.js";

function randomHexLocal(len: number): string {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createPaymentIntent(
  orgId: string,
  agentId: string,
  input: {
    amountPaise: number;
    currency?: string;
    merchant: string;
    merchantReference?: string;
    purpose?: string;
    taskReference?: string;
    category?: string;
  },
  idempotencyKey: string,
  requestId?: string,
) {
  const existingResults = await db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.organizationId, orgId),
        eq(idempotencyKeys.scope, "payment_intent"),
        eq(idempotencyKeys.key, idempotencyKey),
      ),
    )
    .limit(1);

  const existing = existingResults[0];
  if (existing && existing.responseBody) {
    return { cached: true, response: existing.responseBody as Record<string, unknown> };
  }

  const activePolicyResults = await db
    .select()
    .from(policies)
    .where(and(eq(policies.organizationId, orgId), eq(policies.agentId, agentId), eq(policies.status, "active")))
    .orderBy(desc(policies.updatedAt))
    .limit(1);

  const activePolicy = activePolicyResults[0];

  let policyVersionConfig: PolicyConfig = {};
  let policyVersionId: string | null = null;

  if (activePolicy && activePolicy.currentVersionId) {
    const pvResults = await db
      .select()
      .from(policyVersions)
      .where(eq(policyVersions.id, activePolicy.currentVersionId))
      .limit(1);
    const pv = pvResults[0];
    if (pv) {
      policyVersionConfig = pv.config as PolicyConfig;
      policyVersionId = pv.id;
    }
  }

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const hourResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(paymentIntents)
    .where(
      and(
        eq(paymentIntents.agentId, agentId),
        eq(paymentIntents.status, "SUCCEEDED"),
        sql`${paymentIntents.createdAt} >= ${oneHourAgo}`,
      ),
    );

  const dayResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(paymentIntents)
    .where(
      and(
        eq(paymentIntents.agentId, agentId),
        eq(paymentIntents.status, "SUCCEEDED"),
        sql`${paymentIntents.createdAt} >= ${startOfDay}`,
      ),
    );

  const daySpendResult = await db
    .select({ total: sql<number>`coalesce(sum(${paymentIntents.amountPaise}), 0)::int` })
    .from(paymentIntents)
    .where(
      and(
        eq(paymentIntents.agentId, agentId),
        sql`${paymentIntents.status} IN ('SUCCEEDED', 'AUTHORIZED', 'EXECUTING')`,
        sql`${paymentIntents.createdAt} >= ${startOfDay}`,
      ),
    );

  const monthSpendResult = await db
    .select({ total: sql<number>`coalesce(sum(${paymentIntents.amountPaise}), 0)::int` })
    .from(paymentIntents)
    .where(
      and(
        eq(paymentIntents.agentId, agentId),
        sql`${paymentIntents.status} IN ('SUCCEEDED', 'AUTHORIZED', 'EXECUTING')`,
        sql`${paymentIntents.createdAt} >= ${startOfMonth}`,
      ),
    );

  const paymentsLastHour = hourResult[0]?.count ?? 0;
  const paymentsLastDay = dayResult[0]?.count ?? 0;
  const daySpendPaise = daySpendResult[0]?.total ?? 0;
  const monthSpendPaise = monthSpendResult[0]?.total ?? 0;

  // --- Advisory risk signals (never override the policy decision) ---
  // Agent history over prior SUCCEEDED + AUTHORIZED + EXECUTING intents.
  const historyRows = await db
    .select({ merchant: paymentIntents.merchant, amountPaise: paymentIntents.amountPaise })
    .from(paymentIntents)
    .where(
      and(
        eq(paymentIntents.agentId, agentId),
        sql`${paymentIntents.status} IN ('SUCCEEDED', 'AUTHORIZED', 'EXECUTING')`,
      ),
    );
  const historyCount = historyRows.length;
  const historyTotal = historyRows.reduce((sum, r) => sum + Number(r.amountPaise), 0);
  const historyAvg = historyCount > 0 ? Math.floor(historyTotal / historyCount) : 0;
  const priorMerchants = [...new Set(historyRows.map((r) => r.merchant))];
  const isFirstSeenMerchant = !priorMerchants.includes(input.merchant);

  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const failuresResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(paymentIntents)
    .where(
      and(
        eq(paymentIntents.agentId, agentId),
        sql`${paymentIntents.status} IN ('DENIED', 'FAILED')`,
        sql`${paymentIntents.createdAt} >= ${twentyFourHoursAgo}`,
      ),
    );

  const risk: RiskAssessment = assessRisk({
    amountPaise: input.amountPaise,
    merchant: input.merchant,
    category: input.category,
    hourOfDay: now.getUTCHours(),
    daySpendPaise,
    monthSpendPaise,
    paymentsLastHour,
    paymentsLastDay,
    agentHistory: {
      count: historyCount,
      totalPaise: historyTotal,
      avgPaise: historyAvg,
      merchants: priorMerchants,
      failuresLast24h: failuresResult[0]?.count ?? 0,
    },
    isFirstSeenMerchant,
    approvalThresholdPaise:
      (policyVersionConfig as { approvalThresholdPaise?: number }).approvalThresholdPaise ?? null,
    dailyLimitPaise:
      (policyVersionConfig as { dailyLimitPaise?: number }).dailyLimitPaise ?? null,
  });

  const evalResult = evaluate({
    agentActive: true,
    config: policyVersionConfig,
    amountPaise: input.amountPaise,
    merchant: input.merchant,
    category: input.category,
    frequency: {
      paymentsLastHour,
      paymentsLastDay,
    },
    daySpendPaise,
    monthSpendPaise,
    now,
  });

  const intentHash = sha256(
    [agentId, input.taskReference ?? "", input.merchant, input.amountPaise, input.purpose ?? "", policyVersionId ?? "", now.toISOString(), Math.random()].join("|"),
  );

  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  let status: string;
  if (evalResult.decision === "DENY") {
    status = "DENIED";
  } else if (evalResult.decision === "REQUIRE_APPROVAL") {
    status = "PENDING_APPROVAL";
  } else {
    status = "AUTHORIZED";
  }

  const response = await db.transaction(async (tx) => {
    const intentResults = await tx
      .insert(paymentIntents)
      .values({
        organizationId: orgId,
        agentId,
        policyVersionId: policyVersionId ?? null,
        amountPaise: BigInt(input.amountPaise),
        currency: input.currency ?? "INR",
        merchant: input.merchant,
        merchantReference: input.merchantReference ?? null,
        purpose: input.purpose ?? null,
        taskReference: input.taskReference ?? null,
        intentHash,
        status,
        decision: evalResult.decision,
        reasons: evalResult.reasons,
        idempotencyKey,
        expiresAt,
      })
      .returning();

    const intent = intentResults[0];
    if (!intent) throw new AppError(500, "DB_ERROR", "Failed to create payment intent");

    await tx.insert(paymentDecisions).values({
      organizationId: orgId,
      paymentIntentId: intent.id,
      decision: evalResult.decision,
      reasons: evalResult.reasons,
      policyVersionId: policyVersionId ?? null,
    });

    if (evalResult.decision === "REQUIRE_APPROVAL") {
      const approvalExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await tx.insert(approvalTasks).values({
        organizationId: orgId,
        paymentIntentId: intent.id,
        requiredRole: "admin",
        expiresAt: approvalExpiresAt,
        decision: "pending",
      });
    }

    // Schema is frozen: risk is NOT stored in payment_decisions.reasons
    // (string[] used by UI) nor in any new column/table. The full risk object
    // travels in the create response (+ idempotency cached response, since the
    // response body is what gets cached) and in the audit entityAfter below.
    // List/detail rows carry reasons[] only; create-response/audit carry risk.
    await appendAudit(
      {
        organizationId: orgId,
        actorType: "agent",
        actorId: agentId,
        action: "payment_intent.created",
        resourceType: "payment_intent",
        resourceId: intent.id,
        entityAfter: { ...intent, risk },
        requestId,
        policyVersionId: policyVersionId ?? undefined,
        decision: evalResult.decision,
      },
      tx,
    );

    const responseBody = {
      id: intent.id,
      status: intent.status,
      decision: evalResult.decision,
      reasons: evalResult.reasons,
      checks: evalResult.checks,
      risk,
      amountPaise: Number(intent.amountPaise),
      currency: intent.currency,
      merchant: intent.merchant,
      createdAt: intent.createdAt,
    };

    await tx.insert(idempotencyKeys).values({
      organizationId: orgId,
      scope: "payment_intent",
      key: idempotencyKey,
      responseCode: 201,
      responseBody,
    });

    return responseBody;
  });

  // Best-effort notifications after commit (never reached for cached replays,
  // which return early above).
  try {
      // Escalation nudge: HIGH risk + ALLOW stays ALLOW (risk never overrides
      // the policy firewall) — we only emit an advisory notification.
      if (evalResult.decision === "ALLOW" && risk.level === "HIGH") {
        await emitNotification(
          orgId,
          "high_risk_allowed",
          {
            intentId: response.id,
            merchant: input.merchant,
            amountPaise: input.amountPaise,
            score: risk.score,
          },
          {
            actorType: "agent",
            actorId: agentId,
            resourceType: "payment_intent",
            resourceId: response.id,
            requestId,
          },
        );
      }
      if (evalResult.decision === "DENY") {
        await emitNotification(
          orgId,
          "payment.denied",
          {
            paymentIntentId: response.id,
            merchant: input.merchant,
            amountPaise: input.amountPaise,
            currency: input.currency ?? "INR",
            reasons: evalResult.reasons,
          },
          {
            actorType: "agent",
            actorId: agentId,
            resourceType: "payment_intent",
            resourceId: response.id,
            requestId,
          },
        );
      } else if (evalResult.decision === "REQUIRE_APPROVAL") {
        await emitNotification(
          orgId,
          "approval.requested",
          {
            paymentIntentId: response.id,
            merchant: input.merchant,
            amountPaise: input.amountPaise,
            currency: input.currency ?? "INR",
            reasons: evalResult.reasons,
          },
          {
            actorType: "agent",
            actorId: agentId,
            resourceType: "payment_intent",
            resourceId: response.id,
            requestId,
          },
        );
      }
    } catch {
      // notify must never break intent creation
    }

  return { cached: false, response };
}

export async function listPaymentIntents(orgId: string, agentId?: string) {
  if (agentId) {
    return db
      .select()
      .from(paymentIntents)
      .where(and(eq(paymentIntents.organizationId, orgId), eq(paymentIntents.agentId, agentId)))
      .orderBy(desc(paymentIntents.createdAt));
  }
  return db
    .select()
    .from(paymentIntents)
    .where(eq(paymentIntents.organizationId, orgId))
    .orderBy(desc(paymentIntents.createdAt));
}

export async function getPaymentIntent(orgId: string, intentId: string) {
  const results = await db
    .select()
    .from(paymentIntents)
    .where(and(eq(paymentIntents.id, intentId), eq(paymentIntents.organizationId, orgId)))
    .limit(1);

  const intent = results[0];
  if (!intent) throw new AppError(404, "INTENT_NOT_FOUND", "Payment intent not found");
  return intent;
}

export async function getPaymentIntentAudit(orgId: string, intentId: string) {
  const intent = await getPaymentIntent(orgId, intentId);

  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.organizationId, orgId), eq(payments.paymentIntentId, intentId)))
    .limit(1);

  const [approval] = await db
    .select()
    .from(approvalTasks)
    .where(and(eq(approvalTasks.organizationId, orgId), eq(approvalTasks.paymentIntentId, intentId)))
    .limit(1);

  const timelineIds = [intentId];
  if (payment?.id) timelineIds.push(payment.id);
  if (approval?.id) timelineIds.push(approval.id);

  const timeline = timelineIds.length
    ? await db
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.organizationId, orgId), inArray(auditEvents.resourceId, timelineIds)))
        .orderBy(auditEvents.createdAt)
    : [];

  return {
    intent,
    timeline,
    payment: payment ?? null,
    approval: approval ?? null,
  };
}

export async function executePaymentIntent(
  orgId: string,
  intentId: string,
  actorType: "agent" | "user",
  actorId: string,
  requestId?: string,
) {
  const intent = await getPaymentIntent(orgId, intentId);

  if (intent.status !== "AUTHORIZED") {
    throw new AppError(409, "INVALID_STATE", `Intent status is ${intent.status}, expected AUTHORIZED`);
  }
  if (new Date() > intent.expiresAt) {
    throw new AppError(410, "INTENT_EXPIRED", "Payment intent has expired");
  }

  const providerPaymentId = `sandbox_${randomHexLocal(8)}`;

  const paymentResults = await db
    .insert(payments)
    .values({
      organizationId: orgId,
      paymentIntentId: intentId,
      provider: "sandbox",
      providerPaymentId,
      amountPaise: intent.amountPaise,
      currency: intent.currency,
      status: "PENDING",
    })
    .returning();

  const payment = paymentResults[0];
  if (!payment) throw new AppError(500, "DB_ERROR", "Failed to create payment");

  await db.insert(paymentAttempts).values({
    organizationId: orgId,
    paymentId: payment.id,
    attemptNumber: 1,
    providerStatus: "PENDING",
  });

  await db
    .update(paymentIntents)
    .set({ status: "EXECUTING", updatedAt: new Date() })
    .where(eq(paymentIntents.id, intentId));

  await appendAudit({
    organizationId: orgId,
    actorType,
    actorId,
    action: "payment.executing",
    resourceType: "payment",
    resourceId: payment.id,
    entityAfter: payment,
    requestId,
  });

  // Async simulation: auto-succeed after short delay
  const capturedOrgId = orgId;
  const capturedProviderPaymentId = providerPaymentId;
  setTimeout(async () => {
    try {
      const { simulateWebhook } = await import("../provider/sandbox.js");
      await simulateWebhook(capturedOrgId, "payment.succeeded", capturedProviderPaymentId);
    } catch (_err) {
      // swallow in background
    }
  }, 2000);

  return {
    paymentId: payment.id,
    providerPaymentId,
    status: "PENDING",
  };
}
