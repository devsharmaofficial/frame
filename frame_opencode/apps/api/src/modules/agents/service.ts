import { db } from "../../db.js";
import { agents, agentCredentials } from "@frame/db";
import { eq, and } from "drizzle-orm";
import { sha256 } from "../../lib/hash.js";
import { AppError } from "../../lib/errors.js";
import { appendAudit } from "../../lib/audit.js";
import { emitNotification } from "../../lib/notify.js";

function randomBase62(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) {
    result += chars[bytes[i]! % chars.length];
  }
  return result;
}

function randomHex(len: number): string {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createAgent(
  orgId: string,
  input: { name: string; description?: string; owner?: string; environment?: string; purpose?: string },
  requestId?: string,
) {
  const [agent] = await db
    .insert(agents)
    .values({
      organizationId: orgId,
      name: input.name,
      description: input.description ?? null,
      owner: input.owner ?? null,
      environment: input.environment ?? "sandbox",
      purpose: input.purpose ?? null,
      status: "active",
    })
    .returning();

  if (!agent) throw new AppError(500, "DB_ERROR", "Failed to create agent");

  const prefix = randomBase62(8);
  const secret = randomHex(24);
  const keyHash = sha256(prefix + secret);

  const [credential] = await db
    .insert(agentCredentials)
    .values({
      organizationId: orgId,
      agentId: agent.id,
      keyPrefix: prefix,
      keyHash,
      status: "active",
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    })
    .returning();

  if (!credential) throw new AppError(500, "DB_ERROR", "Failed to create agent credential");

  await appendAudit({
    organizationId: orgId,
    actorType: "user",
    action: "agent.created",
    resourceType: "agent",
    resourceId: agent.id,
    entityAfter: agent,
    requestId,
  });

  return {
    agent,
    credential: {
      id: credential.id,
      prefix,
      key: `fr_${prefix}_${secret}`,
      secretShownOnce: true,
    },
  };
}

export async function listAgents(orgId: string) {
  return db.select().from(agents).where(eq(agents.organizationId, orgId));
}

export async function getAgent(orgId: string, agentId: string) {
  const results = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.organizationId, orgId)))
    .limit(1);

  const agent = results[0];
  if (!agent) throw new AppError(404, "AGENT_NOT_FOUND", "Agent not found");
  return agent;
}

export async function disableAgent(orgId: string, agentId: string, requestId?: string) {
  const agent = await getAgent(orgId, agentId);
  if (agent.status === "disabled") return agent;

  const results = await db
    .update(agents)
    .set({ status: "disabled", updatedAt: new Date() })
    .where(eq(agents.id, agentId))
    .returning();

  const updated = results[0];
  if (!updated) throw new AppError(500, "DB_ERROR", "Failed to disable agent");

  await appendAudit({
    organizationId: orgId,
    actorType: "user",
    action: "agent.disabled",
    resourceType: "agent",
    resourceId: agentId,
    entityBefore: agent,
    entityAfter: updated,
    requestId,
  });

  try {
    await emitNotification(
      orgId,
      "agent.disabled",
      { agentId, agentName: agent.name },
      { resourceType: "agent", resourceId: agentId, requestId },
    );
  } catch {
    // notify must never break agent management
  }

  return updated;
}

export async function enableAgent(orgId: string, agentId: string, requestId?: string) {
  const agent = await getAgent(orgId, agentId);
  if (agent.status === "active") return agent;

  const results = await db
    .update(agents)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(agents.id, agentId))
    .returning();

  const updated = results[0];
  if (!updated) throw new AppError(500, "DB_ERROR", "Failed to enable agent");

  await appendAudit({
    organizationId: orgId,
    actorType: "user",
    action: "agent.enabled",
    resourceType: "agent",
    resourceId: agentId,
    entityBefore: agent,
    entityAfter: updated,
    requestId,
  });

  return updated;
}

export async function rotateAgentKey(orgId: string, agentId: string, requestId?: string, expiresInDays = 90) {
  const agent = await getAgent(orgId, agentId);

  const oldCreds = await db
    .select()
    .from(agentCredentials)
    .where(and(eq(agentCredentials.agentId, agentId), eq(agentCredentials.status, "active")))
    .limit(1);

  const oldCred = oldCreds[0];
  if (oldCred) {
    await db
      .update(agentCredentials)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(eq(agentCredentials.id, oldCred.id));
  }

  const prefix = randomBase62(8);
  const secret = randomHex(24);
  const keyHash = sha256(prefix + secret);

  const results = await db
    .insert(agentCredentials)
    .values({
      organizationId: orgId,
      agentId,
      keyPrefix: prefix,
      keyHash,
      status: "active",
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    })
    .returning();

  const newCred = results[0];
  if (!newCred) throw new AppError(500, "DB_ERROR", "Failed to create new credential");

  await appendAudit({
    organizationId: orgId,
    actorType: "user",
    action: "agent.key_rotated",
    resourceType: "agent",
    resourceId: agentId,
    requestId,
  });

  return {
    credential: {
      id: newCred.id,
      prefix,
      key: `fr_${prefix}_${secret}`,
      secretShownOnce: true,
    },
  };
}
