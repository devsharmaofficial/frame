import type { FastifyInstance } from "fastify";
import {
  createAgent,
  listAgents,
  getAgent,
  disableAgent,
  enableAgent,
  rotateAgentKey,
} from "./service.js";
import { AppError } from "../../lib/errors.js";

export async function agentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.userAuth);

  const mutate = app.requireRole("admin", "approver");

  app.post("/agents", { preHandler: [mutate] }, async (request, reply) => {
    const body = request.body as {
      name?: string;
      description?: string;
      owner?: string;
      environment?: string;
      purpose?: string;
    };
    if (!body?.name) {
      throw new AppError(400, "VALIDATION_ERROR", "name is required");
    }
    const result = await createAgent(
      request.organizationId!,
      {
        name: body.name,
        description: body.description,
        owner: body.owner,
        environment: body.environment,
        purpose: body.purpose,
      },
      request.id,
    );
    return reply.status(201).send(result);
  });

  app.get("/agents", async (request) => {
    return listAgents(request.organizationId!);
  });

  app.get("/agents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const agent = await getAgent(request.organizationId!, id).catch((e) => {
      if (e instanceof AppError) return null;
      throw e;
    });
    if (!agent) {
      return reply.status(404).send({
        error: { code: "AGENT_NOT_FOUND", message: "Agent not found", request_id: request.id },
      });
    }
    return agent;
  });

  app.post("/agents/:id/disable", { preHandler: [mutate] }, async (request) => {
    const { id } = request.params as { id: string };
    return disableAgent(request.organizationId!, id, request.id);
  });

  app.post("/agents/:id/enable", { preHandler: [mutate] }, async (request) => {
    const { id } = request.params as { id: string };
    return enableAgent(request.organizationId!, id, request.id);
  });

  app.post("/agents/:id/rotate-key", { preHandler: [mutate] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { expiresInDays?: number };
    let expiresInDays = 90;
    if (body.expiresInDays !== undefined) {
      if (
        typeof body.expiresInDays !== "number" ||
        !Number.isInteger(body.expiresInDays) ||
        body.expiresInDays < 1 ||
        body.expiresInDays > 365
      ) {
        throw new AppError(400, "VALIDATION_ERROR", "expiresInDays must be an integer between 1 and 365");
      }
      expiresInDays = body.expiresInDays;
    }
    return rotateAgentKey(request.organizationId!, id, request.id, expiresInDays);
  });
}
