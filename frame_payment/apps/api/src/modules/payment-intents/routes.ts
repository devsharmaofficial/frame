import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Store } from "../../common/store.js";
import { ApiError } from "../../common/errors.js";
import { recordAudit } from "../../common/audit.js";

const schema = z.object({ agentId: z.string(), amountMinor: z.number().int().positive(), currency: z.string().length(3).default("INR"), merchant: z.string().min(1), purpose: z.string().min(1), expiresAt: z.string().datetime() });
export function registerPaymentIntentRoutes(app: FastifyInstance, store: Store) {
  app.get("/api/v1/payment-intents", async (request) => {
    const organizationId = (request as typeof request & { organizationId: string }).organizationId;
    return { data: [...store.intents.values()].filter((intent) => intent.organizationId === organizationId) };
  });
  app.post("/api/v1/payment-intents", async (request, reply) => {
    const key = request.headers["idempotency-key"];
    if (typeof key !== "string" || !key) throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required.");
    const organizationId = (request as typeof request & { organizationId: string }).organizationId;
    const prior = store.idempotency.get(`${organizationId}:${key}`);
    if (prior) return reply.code(200).send({ data: prior });
    const input = schema.parse(request.body);
    const agent = store.agents.get(input.agentId);
    const policy = agent && [...store.policies.values()].find((item) => item.agentId === agent.id && item.active);
    if (!agent || agent.organizationId !== organizationId) throw new ApiError(404, "AGENT_NOT_FOUND", "Agent was not found.");
    if (agent.status !== "ACTIVE") throw new ApiError(403, "AGENT_DISABLED", "Disabled agents cannot create payment intents.");
    if (!policy) throw new ApiError(403, "POLICY_REQUIRED", "An active policy is required.");
    const merchantAllowed = policy.allowedMerchants.length === 0 || policy.allowedMerchants.includes(input.merchant);
    const withinLimit = input.amountMinor <= policy.transactionLimitMinor;
    const needsApproval = merchantAllowed && withinLimit && policy.approvalThresholdMinor !== undefined && input.amountMinor > policy.approvalThresholdMinor;
    const decision: "ALLOW" | "DENY" | "REQUIRE_APPROVAL" = !merchantAllowed || !withinLimit ? "DENY" : needsApproval ? "REQUIRE_APPROVAL" : "ALLOW";
    const intent = { id: store.id("pi"), organizationId, agentId: agent.id, policyId: policy.id, policyVersion: policy.version, amountMinor: input.amountMinor, currency: input.currency.toUpperCase(), merchant: input.merchant, purpose: input.purpose, status: decision === "ALLOW" ? "AUTHORIZED" as const : decision === "REQUIRE_APPROVAL" ? "PENDING_APPROVAL" as const : "DENIED" as const, decision, approvalId: undefined as string | undefined, idempotencyKey: key, expiresAt: input.expiresAt, createdAt: store.now() };
    if (decision === "REQUIRE_APPROVAL") {
      const approval = { id: store.id("apr"), organizationId, paymentIntentId: intent.id, status: "PENDING" as const, createdAt: store.now() };
      store.approvals.set(approval.id, approval);
      intent.approvalId = approval.id;
    }
    store.intents.set(intent.id, intent);
    store.idempotency.set(`${organizationId}:${key}`, intent);
    recordAudit(store, { organizationId, action: "PAYMENT_INTENT_CREATED", entityId: intent.id, requestId: request.id, metadata: { decision, policyVersion: policy.version } });
    return reply.code(201).send({ data: intent });
  });
  app.get("/api/v1/payment-intents/:id", async (request) => {
    const organizationId = (request as typeof request & { organizationId: string }).organizationId;
    const intent = store.intents.get((request.params as { id: string }).id);
    if (!intent || intent.organizationId !== organizationId) throw new ApiError(404, "PAYMENT_INTENT_NOT_FOUND", "Payment intent was not found.");
    return { data: intent };
  });
  app.post("/api/v1/payment-intents/:id/execute", async (request) => {
    const organizationId = (request as typeof request & { organizationId: string }).organizationId;
    const intent = store.intents.get((request.params as { id: string }).id);
    if (!intent || intent.organizationId !== organizationId) throw new ApiError(404, "PAYMENT_INTENT_NOT_FOUND", "Payment intent was not found.");
    if (intent.status !== "AUTHORIZED") throw new ApiError(409, "PAYMENT_NOT_EXECUTABLE", "Only authorized payment intents can be executed.");
    intent.status = "PROCESSING";
    recordAudit(store, { organizationId, action: "PAYMENT_EXECUTION_STARTED", entityId: intent.id, requestId: request.id, metadata: { provider: "simulated" } });
    return { data: intent };
  });
  app.post("/api/v1/payment-intents/:id/webhook", async (request) => {
    const organizationId = (request as typeof request & { organizationId: string }).organizationId;
    const intent = store.intents.get((request.params as { id: string }).id);
    if (!intent || intent.organizationId !== organizationId) throw new ApiError(404, "PAYMENT_INTENT_NOT_FOUND", "Payment intent was not found.");
    const input = z.object({ status: z.enum(["SUCCEEDED", "FAILED"]) }).parse(request.body);
    if (intent.status !== "PROCESSING") throw new ApiError(409, "PAYMENT_NOT_PROCESSING", "Payment intent is not processing.");
    intent.status = input.status;
    recordAudit(store, { organizationId, action: `PAYMENT_${input.status}`, entityId: intent.id, requestId: request.id, metadata: { provider: "simulated" } });
    return { data: intent };
  });
}
