import type { FastifyInstance } from "fastify";
import { createPolicy, listPolicies, getPolicy, getPolicyVersions, updatePolicy } from "./service.js";
import { AppError } from "../../lib/errors.js";

const CONFIG_KEYS = [
  "monthlyLimitPaise",
  "dailyLimitPaise",
  "transactionLimitPaise",
  "approvalThresholdPaise",
  "allowedMerchants",
  "blockedMerchants",
  "allowedCategories",
  "restrictedCategories",
  "maxPaymentsPerHour",
  "maxPaymentsPerDay",
] as const;

function normalizeFlatConfig(body: Record<string, unknown>): Record<string, unknown> | null {
  const cfg: Record<string, unknown> = {};
  if (typeof body.expiresInHours === "number") cfg.expiresInHours = body.expiresInHours;
  for (const key of CONFIG_KEYS) {
    if (body[key] !== undefined) cfg[key] = body[key];
  }
  return Object.keys(cfg).length > 0 ? cfg : null;
}

export async function policyRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.userAuth);

  const mutate = app.requireRole("admin", "approver");

  app.post("/policies", { preHandler: [mutate] }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    if (!body?.agentId || !body?.name) {
      throw new AppError(400, "VALIDATION_ERROR", "agentId and name are required");
    }
    const config = (body.config as unknown) ?? normalizeFlatConfig(body);
    if (!config) {
      throw new AppError(400, "VALIDATION_ERROR", "policy config is required");
    }
    const result = await createPolicy(
      request.organizationId!,
      { agentId: body.agentId as string, name: body.name as string, description: body.description as string | undefined, config },
      request.id,
    );
    return reply.status(201).send(result);
  });

  app.get("/policies", async (request) => {
    return listPolicies(request.organizationId!);
  });

  app.get("/policies/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await getPolicy(request.organizationId!, id);
    } catch (e: any) {
      if (e instanceof AppError) {
        return reply.status(e.statusCode).send({
          error: { code: e.code, message: e.message, request_id: request.id },
        });
      }
      throw e;
    }
  });

  app.get("/policies/:id/versions", async (request) => {
    const { id } = request.params as { id: string };
    return getPolicyVersions(request.organizationId!, id);
  });

  app.patch("/policies/:id", { preHandler: [mutate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; description?: string; config?: unknown };
    if (!body?.config) {
      throw new AppError(400, "VALIDATION_ERROR", "config is required");
    }
    const result = await updatePolicy(
      request.organizationId!,
      id,
      { name: body.name, description: body.description, config: body.config },
      request.id,
    );
    return reply.status(200).send(result);
  });
}
