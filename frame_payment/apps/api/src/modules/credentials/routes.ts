import type { FastifyInstance } from "fastify";
import { randomBytes, createHash } from "node:crypto";
import type { Store } from "../../common/store.js";
import { ApiError } from "../../common/errors.js";

export function registerCredentialRoutes(app: FastifyInstance, store: Store) {
  app.post("/api/v1/agents/:agentId/credentials", async (request, reply) => {
    const organizationId = (request as typeof request & { organizationId: string }).organizationId;
    const agent = store.agents.get((request.params as { agentId: string }).agentId);
    if (!agent || agent.organizationId !== organizationId) throw new ApiError(404, "AGENT_NOT_FOUND", "Agent was not found.");
    const secret = `framer_${randomBytes(24).toString("hex")}`;
    const credential = { id: store.id("cred"), agentId: agent.id, organizationId, keyHash: createHash("sha256").update(secret).digest("hex"), createdAt: store.now() };
    store.credentials.set(credential.id, credential);
    return reply.code(201).send({ data: { id: credential.id, secret } });
  });
}
