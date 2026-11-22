import { db } from "../../db.js";
import { auditEvents } from "@frame/db";
import { eq, and, desc } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { getPaymentIntent } from "../paymentIntents/service.js";
import type { RiskAssessment } from "./signals.js";

function isRiskAssessment(value: unknown): value is RiskAssessment {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.level === "string" &&
    ["LOW", "MEDIUM", "HIGH"].includes(v.level) &&
    typeof v.score === "number" &&
    Array.isArray(v.signals)
  );
}

/**
 * Recompute-or-fetch risk for an intent.
 *
 * No new tables: risk was attached to the `payment_intent.created` audit
 * event's entityAfter at creation time. Intents created before this feature
 * have no stored risk → 404 RISK_NOT_FOUND.
 */
export async function getRiskForIntent(
  orgId: string,
  intentId: string,
): Promise<{ intentId: string; risk: RiskAssessment }> {
  await getPaymentIntent(orgId, intentId);

  const [event] = await db
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.organizationId, orgId),
        eq(auditEvents.action, "payment_intent.created"),
        eq(auditEvents.resourceId, intentId),
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(1);

  const risk = (event?.entityAfter as Record<string, unknown> | null)?.risk;
  if (!isRiskAssessment(risk)) {
    throw new AppError(404, "RISK_NOT_FOUND", "No stored risk for this intent");
  }
  return { intentId, risk };
}
