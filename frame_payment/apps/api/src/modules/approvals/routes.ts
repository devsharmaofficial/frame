import type { FastifyInstance } from "fastify";
import type { Store } from "../../common/store.js";
import { ApiError } from "../../common/errors.js";
import { recordAudit } from "../../common/audit.js";

export function registerApprovalRoutes(app: FastifyInstance, store: Store) {
  app.get("/api/v1/approvals", async (request) => {
    const organizationId = (request as typeof request & { organizationId: string }).organizationId;
    return { data: [...store.approvals.values()].filter((approval) => approval.organizationId === organizationId) };
  });
  app.get("/api/v1/approvals/:id", async (request) => {
    const organizationId = (request as typeof request & { organizationId: string }).organizationId;
    const approval = store.approvals.get((request.params as { id: string }).id);
    if (!approval || approval.organizationId !== organizationId) throw new ApiError(404, "APPROVAL_NOT_FOUND", "Approval was not found.");
    return { data: approval };
  });
  app.post("/api/v1/approvals/:id/:decision", async (request) => {
    const organizationId = (request as typeof request & { organizationId: string }).organizationId;
    const { id, decision } = request.params as { id: string; decision: string };
    if (decision !== "approve" && decision !== "reject") throw new ApiError(400, "INVALID_APPROVAL_DECISION", "Decision must be approve or reject.");
    const approval = store.approvals.get(id);
    if (!approval || approval.organizationId !== organizationId) throw new ApiError(404, "APPROVAL_NOT_FOUND", "Approval was not found.");
    if (approval.status !== "PENDING") throw new ApiError(409, "APPROVAL_ALREADY_DECIDED", "Approval has already been decided.");
    const intent = store.intents.get(approval.paymentIntentId);
    if (!intent) throw new ApiError(404, "PAYMENT_INTENT_NOT_FOUND", "Payment intent was not found.");
    approval.status = decision === "approve" ? "APPROVED" : "REJECTED";
    intent.status = decision === "approve" ? "AUTHORIZED" : "DENIED";
    intent.decision = decision === "approve" ? "ALLOW" : "DENY";
    recordAudit(store, { organizationId, action: `APPROVAL_${approval.status}`, entityId: approval.id, requestId: request.id, metadata: { paymentIntentId: intent.id } });
    return { data: approval, payment_intent: intent };
  });
}
