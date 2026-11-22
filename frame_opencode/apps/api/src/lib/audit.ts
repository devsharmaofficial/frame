import { db } from "../db.js";
import { auditEvents } from "@frame/db";
import { sha256 } from "./hash.js";
import { eq, desc } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type DbExecutor = NodePgDatabase<typeof import("@frame/db")> | Omit<typeof db, "query">;

function jsonSafe(value: unknown): unknown {
  if (value === undefined) return null;
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? Number(v) : v)),
  );
}

export interface AuditEvent {
  organizationId: string;
  actorType: string;
  actorId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  entityBefore?: unknown;
  entityAfter?: unknown;
  requestId?: string;
  policyVersionId?: string;
  decision?: string;
}

export async function appendAudit(
  event: AuditEvent,
  executor: DbExecutor = db,
): Promise<void> {
  const [last] = await executor
    .select({ entryHash: auditEvents.entryHash })
    .from(auditEvents)
    .where(eq(auditEvents.organizationId, event.organizationId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(1);

  const previousHash = last?.entryHash ?? "0000000000000000000000000000000000000000000000000000000000000000";

  const canonical = JSON.stringify({
    organizationId: event.organizationId,
    actorType: event.actorType,
    actorId: event.actorId,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    entityBefore: jsonSafe(event.entityBefore),
    entityAfter: jsonSafe(event.entityAfter),
    policyVersionId: event.policyVersionId,
    decision: event.decision,
    timestamp: new Date().toISOString(),
  });

  const entryHash = sha256(previousHash + canonical);

  await executor.insert(auditEvents).values({
    organizationId: event.organizationId,
    actorType: event.actorType,
    actorId: event.actorId ?? null,
    action: event.action,
    resourceType: event.resourceType ?? null,
    resourceId: event.resourceId ?? null,
    entityBefore: jsonSafe(event.entityBefore) as never,
    entityAfter: jsonSafe(event.entityAfter) as never,
    requestId: event.requestId ?? null,
    policyVersionId: event.policyVersionId ?? null,
    decision: event.decision ?? null,
    previousHash,
    entryHash,
  });
}
