import type { FastifyInstance } from "fastify";
import { getRiskForIntent } from "./service.js";
import { AppError } from "../../lib/errors.js";

export async function riskRoutes(app: FastifyInstance) {
  app.get("/risk/:intentId", { preHandler: [app.userAuth] }, async (request, reply) => {
    const { intentId } = request.params as { intentId: string };
    try {
      return await getRiskForIntent(request.organizationId!, intentId);
    } catch (e: unknown) {
      if (e instanceof AppError) {
        return reply.status(e.statusCode).send({
          error: { code: e.code, message: e.message, request_id: request.id },
        });
      }
      throw e;
    }
  });
}
