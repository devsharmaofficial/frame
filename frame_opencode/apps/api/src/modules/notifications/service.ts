import { db } from "../../db.js";
import { auditEvents } from "@frame/db";
import { eq, and, desc, or, like } from "drizzle-orm";
import { appendAudit } from "../../lib/audit.js";

export type NotificationSeverity = "info" | "warning" | "critical";

export interface Notification {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  severity: NotificationSeverity;
  createdAt: Date | null;
  resourceType: string | null;
  resourceId: string | null;
  read: boolean;
}

type AuditRow = typeof auditEvents.$inferSelect;

const TITLES: Record<string, { title: string; severity: NotificationSeverity }> = {
  "payment.denied": { title: "Payment denied", severity: "warning" },
  "payment.succeeded": { title: "Payment succeeded", severity: "info" },
  "payment.failed": { title: "Payment failed", severity: "critical" },
  "approval.requested": { title: "Approval requested", severity: "info" },
  "approval.approved": { title: "Approval approved", severity: "info" },
  "approval.rejected": { title: "Approval rejected", severity: "warning" },
  "agent.disabled": { title: "Agent disabled", severity: "warning" },
  "agent.key_rotated": { title: "Agent key rotated", severity: "info" },
  "high_risk_allowed": { title: "High-risk payment allowed", severity: "warning" },
  "reconciliation.run": { title: "Reconciliation completed", severity: "info" },
  "reconciliation.exception": {
    title: "Reconciliation exception",
    severity: "critical",
  },
};

function unwrapType(action: string): string | null {
  if (action === "payment_intent.created") return null; // handled by decision
  if (action.startsWith("notification.")) {
    const rest = action.slice("notification.".length);
    if (rest === "test") return null; // handled via entityAfter.type
    return rest;
  }
  return action;
}

function entitySummary(entity: unknown): string | null {
  if (!entity || typeof entity !== "object") return null;
  const e = entity as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof e.merchant === "string") parts.push(`merchant "${e.merchant}"`);
  if (typeof e.amountPaise === "number" || typeof e.amountPaise === "string")
    parts.push(`${e.amountPaise} paise`);
  if (typeof e.reason === "string") parts.push(e.reason);
  if (typeof e.comment === "string") parts.push(`comment: ${e.comment}`);
  if (typeof e.status === "string" && parts.length === 0)
    parts.push(`status ${e.status}`);
  if (Array.isArray(e.reasons) && e.reasons.length > 0)
    parts.push((e.reasons as unknown[]).map(String).join(", "));
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function renderNotification(event: AuditRow): Notification | null {
  let type = unwrapType(event.action);

  if (event.action === "payment_intent.created") {
    const decision =
      event.decision ??
      (event.entityAfter as Record<string, unknown> | null)?.decision;
    if (decision !== "DENY") return null;
    type = "payment.denied";
  }

  if (event.action === "notification.test") {
    const after = event.entityAfter as Record<string, unknown> | null;
    type =
      typeof after?.type === "string"
        ? (after.type as string)
        : "payment.succeeded";
  }

  if (!type) return null;
  const meta = TITLES[type] ?? {
    title: type
      .split(/[._]/)
      .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
      .join(" "),
    severity: "info" as NotificationSeverity,
  };

  const detail =
    entitySummary(event.entityAfter) ??
    (event.action === "notification.test"
      ? entitySummary({
          merchant: "Demo Merchant",
          amountPaise: 19900,
        })
      : null);

  return {
    id: event.id,
    type,
    title: meta.title,
    detail,
    severity: meta.severity,
    createdAt: event.createdAt,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    read: false,
  };
}

export async function listNotifications(
  orgId: string,
  limit = 25,
): Promise<Notification[]> {
  const rows = await db
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.organizationId, orgId),
        or(
          like(auditEvents.action, "payment_intent.created"),
          like(auditEvents.action, "payment.%"),
          like(auditEvents.action, "approval.%"),
          like(auditEvents.action, "agent.disabled"),
          like(auditEvents.action, "agent.key_rotated"),
          like(auditEvents.action, "reconciliation.%"),
          like(auditEvents.action, "notification.%"),
        ),
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(100);

  const out: Notification[] = [];
  for (const row of rows) {
    const rendered = renderNotification(row);
    if (rendered) out.push(rendered);
    if (out.length >= limit) break;
  }
  return out;
}

export const TEST_NOTIFICATION_TYPES = [
  "approval.requested",
  "payment.succeeded",
  "payment.failed",
] as const;

export async function createTestNotification(
  orgId: string,
  type: string,
  opts: { actorType?: string; actorId?: string; requestId?: string } = {},
): Promise<Notification> {
  const demoPayload: Record<string, unknown> = {
    type,
    merchant: "Demo Merchant",
    amountPaise: 19900,
    currency: "INR",
  };

  await appendAudit({
    organizationId: orgId,
    actorType: opts.actorType ?? "system",
    actorId: opts.actorId,
    action: "notification.test",
    entityAfter: demoPayload,
    requestId: opts.requestId,
  });

  const [created] = await db
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.organizationId, orgId),
        eq(auditEvents.action, "notification.test"),
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(1);

  if (!created) {
    return {
      id: "unknown",
      type,
      title: TITLES[type]?.title ?? type,
      detail: 'merchant "Demo Merchant" · 19900 paise',
      severity: TITLES[type]?.severity ?? "info",
      createdAt: new Date(),
      resourceType: null,
      resourceId: null,
      read: false,
    };
  }

  return renderNotification(created) ?? {
    id: created.id,
    type,
    title: TITLES[type]?.title ?? type,
    detail: 'merchant "Demo Merchant" · 19900 paise',
    severity: TITLES[type]?.severity ?? "info",
    createdAt: created.createdAt,
    resourceType: created.resourceType,
    resourceId: created.resourceId,
    read: false,
  };
}
