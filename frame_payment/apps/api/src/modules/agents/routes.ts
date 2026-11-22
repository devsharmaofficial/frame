import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Store } from "../../common/store.js";
import { ApiError } from "../../common/errors.js";

const schema = z.object({ organizationId: z.string().optional(), name: z.string().min(1).max(120) });
export function registerAgentRoutes(app: FastifyInstance, store: Store) {
  app.post("/api/v1/agents", async (request, reply) => {
    const input = schema.parse(request.body);
    const organizationId = (request as typeof request & { organizationId: string }).organizationId;
    const agent = { id: store.id("agt"), organizationId, name: input.name, status: "ACTIVE" as const, createdAt: store.now() };
    store.agents.set(agent.id, agent);
    return reply.code(201).send({ data: agent });
  });
  app.get("/api/v1/agents", async (request) => {
    const organizationId = (request as typeof request & { organizationId: string }).organizationId;
    return { data: [...store.agents.values()].filter((agent) => agent.organizationId === organizationId) };
  });
  app.post("/api/v1/agents/:id/disable", async (request) => {
    const organizationId = (request as typeof request & { organizationId: string }).organizationId;
    const agent = store.agents.get((request.params as { id: string }).id);
    if (!agent || agent.organizationId !== organizationId) throw new ApiError(404, "AGENT_NOT_FOUND", "Agent was not found.");
    agent.status = "DISABLED";
    return { data: agent };
  });
}
