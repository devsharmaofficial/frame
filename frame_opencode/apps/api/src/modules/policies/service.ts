import { db } from "../../db.js";
import { policies, policyVersions } from "@frame/db";
import { eq, and, desc } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { policyConfigSchema, type PolicyConfig } from "./evaluator.js";
import { appendAudit } from "../../lib/audit.js";

function validateConfig(raw: unknown): PolicyConfig {
  const result = policyConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", `Invalid policy config: ${result.error.issues.map((i) => i.message).join(", ")}`);
  }
  return result.data;
}

export async function createPolicy(
  orgId: string,
  input: { agentId: string; name: string; description?: string; config: unknown },
  requestId?: string,
) {
  const config = validateConfig(input.config);

  const existing = await db
    .select({ id: policies.id })
    .from(policies)
    .where(and(eq(policies.organizationId, orgId), eq(policies.agentId, input.agentId), eq(policies.status, "active")))
    .limit(1);

  if (existing[0]) {
    throw new AppError(409, "POLICY_EXISTS", "Agent already has an active policy. Edit it to create a new version instead.");
  }

  const policyResults = await db
    .insert(policies)
    .values({
      organizationId: orgId,
      agentId: input.agentId,
      name: input.name,
      description: input.description ?? null,
      currentVersionId: null,
      activeVersion: 1,
    })
    .returning();

  const policy = policyResults[0];
  if (!policy) throw new AppError(500, "DB_ERROR", "Failed to create policy");

  const versionResults = await db
    .insert(policyVersions)
    .values({
      organizationId: orgId,
      policyId: policy.id,
      version: 1,
      config,
      createdBy: null,
    })
    .returning();

  const version = versionResults[0];
  if (!version) throw new AppError(500, "DB_ERROR", "Failed to create policy version");

  await db
    .update(policies)
    .set({ currentVersionId: version.id })
    .where(eq(policies.id, policy.id));

  await appendAudit({
    organizationId: orgId,
    actorType: "user",
    action: "policy.created",
    resourceType: "policy",
    resourceId: policy.id,
    entityAfter: { ...policy, currentVersionId: version.id },
    requestId,
  });

  return { policy: { ...policy, currentVersionId: version.id }, version };
}

export async function listPolicies(orgId: string) {
  return db.select().from(policies).where(eq(policies.organizationId, orgId));
}

export async function getPolicy(orgId: string, policyId: string) {
  const results = await db
    .select()
    .from(policies)
    .where(and(eq(policies.id, policyId), eq(policies.organizationId, orgId)))
    .limit(1);

  const policy = results[0];
  if (!policy) throw new AppError(404, "POLICY_NOT_FOUND", "Policy not found");
  return policy;
}

export async function getPolicyVersions(orgId: string, policyId: string) {
  await getPolicy(orgId, policyId);
  return db
    .select()
    .from(policyVersions)
    .where(eq(policyVersions.policyId, policyId))
    .orderBy(policyVersions.version);
}

export async function updatePolicy(
  orgId: string,
  policyId: string,
  input: { name?: string; description?: string; config: unknown },
  requestId?: string,
) {
  const policy = await getPolicy(orgId, policyId);
  const config = validateConfig(input.config);

  const newVersionNum = policy.activeVersion + 1;

  const versionResults = await db
    .insert(policyVersions)
    .values({
      organizationId: orgId,
      policyId: policy.id,
      version: newVersionNum,
      config,
      createdBy: null,
    })
    .returning();

  const version = versionResults[0];
  if (!version) throw new AppError(500, "DB_ERROR", "Failed to create policy version");

  const updateData: Record<string, unknown> = {
    currentVersionId: version.id,
    activeVersion: newVersionNum,
    updatedAt: new Date(),
  };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;

  const updateResults = await db
    .update(policies)
    .set(updateData)
    .where(eq(policies.id, policy.id))
    .returning();

  const updated = updateResults[0];
  if (!updated) throw new AppError(500, "DB_ERROR", "Failed to update policy");

  await appendAudit({
    organizationId: orgId,
    actorType: "user",
    action: "policy.version_created",
    resourceType: "policy",
    resourceId: policy.id,
    entityBefore: { activeVersion: policy.activeVersion },
    entityAfter: { activeVersion: newVersionNum },
    requestId,
  });

  return { policy: updated, version };
}
