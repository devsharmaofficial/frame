import { db } from "../../db.js";
import { approvalTasks, paymentIntents, paymentDecisions, agents, policies, policyVersions } from "@frame/db";
import { eq, and, inArray } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { appendAudit } from "../../lib/audit.js";
import { emitNotification } from "../../lib/notify.js";

export async function listApprovals(orgId: string, status?: string) {
  const conditions = [eq(approvalTasks.organizationId, orgId)];
  if (status) {
    conditions.push(eq(approvalTasks.decision, status));
  }
  const tasks = await db.select().from(approvalTasks).where(and(...conditions));

  if (tasks.length === 0) return [];

  const intentIds = tasks.map((t) => t.paymentIntentId);
  const intents = intentIds.length
    ? await db.select().from(paymentIntents).where(inArray(paymentIntents.id, intentIds))
    : [];
  const intentById = new Map(intents.map((i) => [i.id, i]));

  const agentIds = [...new Set(intents.map((i) => i.agentId))];
  const agentRows = agentIds.length ? await db.select().from(agents).where(inArray(agents.id, agentIds)) : [];
  const agentById = new Map(agentRows.map((a) => [a.id, a]));

  const policyIds = [...new Set(intents.map((i) => i.policyVersionId).filter(Boolean))] as string[];
  const versionRows = policyIds.length
    ? await db.select().from(policyVersions).where(inArray(policyVersions.id, policyIds))
    : [];
  const versionById = new Map(versionRows.map((v) => [v.id, v]));
  const versionPolicyIds = [...new Set(versionRows.map((v) => v.policyId))];
  const policyRows = versionPolicyIds.length
    ? await db.select().from(policies).where(inArray(policies.id, versionPolicyIds))
    : [];
  const policyById = new Map(policyRows.map((p) => [p.id, p]));

  return tasks.map((task) => {
    const intent = intentById.get(task.paymentIntentId);
    const config = intent?.policyVersionId ? versionById.get(intent.policyVersionId)?.config : undefined;
    const policy = intent?.policyVersionId
      ? (() => {
          const v = versionById.get(intent.policyVersionId!);
          return v ? policyById.get(v.policyId) : undefined;
        })()
      : undefined;
    const reason =
      (intent?.reasons as string[])?.join(", ") ||
      (config && (config as { approvalThresholdPaise?: number }).approvalThresholdPaise
        ? "Amount exceeds the automatic approval threshold"
        : "Amount requires human approval");

    return {
      id: task.id,
      organizationId: task.organizationId,
      paymentIntentId: task.paymentIntentId,
      requiredRole: task.requiredRole,
      requestedAt: task.requestedAt,
      expiresAt: task.expiresAt,
      decision: task.decision,
      approvedBy: task.approvedBy,
      approvedAt: task.approvedAt,
      rejectedBy: task.rejectedBy,
      rejectedAt: task.rejectedAt,
      comment: task.comment,
      reason,
      paymentIntent: intent ?? null,
      agent: intent
        ? (() => {
            const a = agentById.get(intent.agentId);
            return a ? { id: a.id, name: a.name } : null;
          })()
        : null,
      policy: policy
        ? {
            id: policy.id,
            name: policy.name,
            version: versionById.get(intent!.policyVersionId!)?.version ?? policy.activeVersion,
          }
        : null,
    };
  });
}

function isRoleAuthorized(role: string, requiredRole: string): boolean {
  if (requiredRole === "admin") return role === "admin";
  if (requiredRole === "approver") return role === "admin" || role === "approver";
  return role === requiredRole;
}

export async function approveTask(
  orgId: string,
  taskId: string,
  userId: string,
  role: string,
  comment?: string,
  requestId?: string,
) {
  const [task] = await db
    .select()
    .from(approvalTasks)
    .where(and(eq(approvalTasks.id, taskId), eq(approvalTasks.organizationId, orgId)))
    .limit(1);

  if (!task) throw new AppError(404, "APPROVAL_NOT_FOUND", "Approval task not found");
  if (task.decision !== "pending") throw new AppError(409, "ALREADY_DECIDED", "Approval already decided");
  if (new Date() > task.expiresAt) throw new AppError(410, "APPROVAL_EXPIRED", "Approval task has expired");
  if (!isRoleAuthorized(role, task.requiredRole)) {
    throw new AppError(403, "FORBIDDEN", `Requires role ${task.requiredRole}`);
  }

  const [intent] = await db
    .select()
    .from(paymentIntents)
    .where(eq(paymentIntents.id, task.paymentIntentId))
    .limit(1);

  if (!intent) throw new AppError(404, "INTENT_NOT_FOUND", "Payment intent not found");
  if (intent.status !== "PENDING_APPROVAL") {
    throw new AppError(409, "INVALID_STATE", `Intent status is ${intent.status}`);
  }

  await db
    .update(approvalTasks)
    .set({
      decision: "approved",
      approvedBy: userId,
      approvedAt: new Date(),
      comment: comment ?? null,
    })
    .where(eq(approvalTasks.id, taskId));

  await db
    .update(paymentIntents)
    .set({ status: "AUTHORIZED", updatedAt: new Date() })
    .where(eq(paymentIntents.id, task.paymentIntentId));

  await db.insert(paymentDecisions).values({
    organizationId: orgId,
    paymentIntentId: task.paymentIntentId,
    decision: "ALLOW",
    reasons: [`Approved by user ${userId}`],
    policyVersionId: intent.policyVersionId,
  });

  await appendAudit({
    organizationId: orgId,
    actorType: "user",
    actorId: userId,
    action: "approval.approved",
    resourceType: "approval_task",
    resourceId: taskId,
    entityAfter: { decision: "approved", comment },
    requestId,
  });

  try {
    await emitNotification(
      orgId,
      "approval.approved",
      { taskId, paymentIntentId: task.paymentIntentId, comment: comment ?? null },
      {
        actorType: "user",
        actorId: userId,
        resourceType: "approval_task",
        resourceId: taskId,
        requestId,
      },
    );
  } catch {
    // notify must never break approvals
  }

  return { status: "approved", taskId };
}

export async function rejectTask(
  orgId: string,
  taskId: string,
  userId: string,
  role: string,
  comment?: string,
  requestId?: string,
) {
  const [task] = await db
    .select()
    .from(approvalTasks)
    .where(and(eq(approvalTasks.id, taskId), eq(approvalTasks.organizationId, orgId)))
    .limit(1);

  if (!task) throw new AppError(404, "APPROVAL_NOT_FOUND", "Approval task not found");
  if (task.decision !== "pending") throw new AppError(409, "ALREADY_DECIDED", "Approval already decided");
  if (new Date() > task.expiresAt) throw new AppError(410, "APPROVAL_EXPIRED", "Approval task has expired");
  if (!isRoleAuthorized(role, task.requiredRole)) {
    throw new AppError(403, "FORBIDDEN", `Requires role ${task.requiredRole}`);
  }

  await db
    .update(approvalTasks)
    .set({
      decision: "rejected",
      rejectedBy: userId,
      rejectedAt: new Date(),
      comment: comment ?? null,
    })
    .where(eq(approvalTasks.id, taskId));

  await db
    .update(paymentIntents)
    .set({ status: "REJECTED", updatedAt: new Date() })
    .where(eq(paymentIntents.id, task.paymentIntentId));

  await db.insert(paymentDecisions).values({
    organizationId: orgId,
    paymentIntentId: task.paymentIntentId,
    decision: "DENY",
    reasons: [`Rejected by user ${userId}${comment ? `: ${comment}` : ""}`],
    policyVersionId: null,
  });

  await appendAudit({
    organizationId: orgId,
    actorType: "user",
    actorId: userId,
    action: "approval.rejected",
    resourceType: "approval_task",
    resourceId: taskId,
    entityAfter: { decision: "rejected", comment },
    requestId,
  });

  try {
    await emitNotification(
      orgId,
      "approval.rejected",
      { taskId, paymentIntentId: task.paymentIntentId, comment: comment ?? null },
      {
        actorType: "user",
        actorId: userId,
        resourceType: "approval_task",
        resourceId: taskId,
        requestId,
      },
    );
  } catch {
    // notify must never break approvals
  }

  return { status: "rejected", taskId };
}
