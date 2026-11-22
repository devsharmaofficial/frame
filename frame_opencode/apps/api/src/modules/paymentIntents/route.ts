import type { FastifyInstance } from "fastify";
import {
  createPaymentIntent,
  listPaymentIntents,
  getPaymentIntent,
  getPaymentIntentAudit,
  executePaymentIntent,
} from "./service.js";
import { AppError } from "../../lib/errors.js";

export async function paymentIntentRoutes(app: FastifyInstance) {
  app.post("/payment-intents", { preHandler: [app.agentAuth] }, async (request, reply) => {
    const idempotencyKey = request.headers["idempotency-key"] as string | undefined;
    if (!idempotencyKey) {
      throw new AppError(400, "VALIDATION_ERROR", "Idempotency-Key header is required");
    }

    const body = request.body as {
      amountPaise?: number;
      currency?: string;
      merchant?: string;
      merchantReference?: string;
      purpose?: string;
      taskReference?: string;
      category?: string;
    };

    if (!body?.amountPaise || !body?.merchant) {
      throw new AppError(400, "VALIDATION_ERROR", "amountPaise and merchant are required");
    }

    const result = await createPaymentIntent(
      request.organizationId!,
      request.agent!.id,
      {
        amountPaise: body.amountPaise,
        currency: body.currency,
        merchant: body.merchant,
        merchantReference: body.merchantReference,
        purpose: body.purpose,
        taskReference: body.taskReference,
        category: body.category,
      },
      idempotencyKey,
      request.id,
    );

    return reply.status(result.cached ? 200 : 201).send(result.response);
  });

  app.get("/payment-intents", { preHandler: [app.userAuth] }, async (request) => {
    const { agentId } = request.query as { agentId?: string };
    return listPaymentIntents(request.organizationId!, agentId);
  });

  app.get("/payment-intents/:id", { preHandler: [app.userAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await getPaymentIntent(request.organizationId!, id);
    } catch (e: any) {
      if (e instanceof AppError) {
        return reply.status(e.statusCode).send({
          error: { code: e.code, message: e.message, request_id: request.id },
        });
      }
      throw e;
    }
  });

  app.post("/payment-intents/:id/execute", { preHandler: [app.agentAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await executePaymentIntent(
      request.organizationId!,
      id,
      "agent",
      request.agent!.id,
      request.id,
    );
    return reply.status(200).send(result);
  });

  app.post("/payment-intents/:id/execute-user", { preHandler: [app.userAuth, app.requireRole("admin", "approver")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await executePaymentIntent(
      request.organizationId!,
      id,
      "user",
      request.userId!,
      request.id,
    );
    return reply.status(200).send(result);
  });

  app.get("/payment-intents/:id/audit", { preHandler: [app.userAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await getPaymentIntentAudit(request.organizationId!, id);
    } catch (e: any) {
      if (e instanceof AppError) {
        return reply.status(e.statusCode).send({
          error: { code: e.code, message: e.message, request_id: request.id },
        });
      }
      throw e;
    }
  });
}
