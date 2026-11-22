import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Store } from "../../common/store.js";
import { ApiError } from "../../common/errors.js";

const schema = z.object({ agentId: z.string(), transactionLimitMinor: z.number().int().positive(), approvalThresholdMinor: z.number().int().nonnegative().optional(), allowedMerchants: z.array(z.string()).default([]) });
export function registerPolicyRoutes(app: FastifyInstance, store: Store) {
  app.get("/api/v1/policies", async (request) => {
    const organizationId = (request as typeof request & { organizationId: string }).organizationId;
    return { data: [...store.policies.values()].filter((policy) => policy.organizationId === organizationId) };
  });
  app.post("/api/v1/policies", async (request, reply) => {
    const input = schema.parse(request.body);
    const organizationId = (request as typeof request & { organizationId: string }).organizationId;
    const agent = store.agents.get(input.agentId);
    if (!agent || agent.organizationId !== organizationId) throw new ApiError(404, "AGENT_NOT_FOUND", "Agent was not found.");
    const prior = [...store.policies.values()].find((policy) => policy.agentId === agent.id && policy.active);
    if (prior) prior.active = false;
    const policy = { id: store.id("pol"), organizationId, agentId: agent.id, version: (prior?.version ?? 0) + 1, transactionLimitMinor: input.transactionLimitMinor, approvalThresholdMinor: input.approvalThresholdMinor, allowedMerchants: input.allowedMerchants, active: true, createdAt: store.now() };
    store.policies.set(policy.id, policy);
    return reply.code(201).send({ data: policy });
  });
}
