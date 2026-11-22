import type { FastifyInstance } from "fastify";
import { listExceptions, runReconciliation } from "./service.js";

export async function reconciliationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.userAuth);

  app.get("/reconciliation/exceptions", async (request) => {
    return listExceptions(request.organizationId!);
  });

  app.post("/reconciliation/run", { preHandler: [app.requireRole("admin", "approver")] }, async (request, reply) => {
    const result = await runReconciliation(request.organizationId!, {
      actorType: "user",
      actorId: request.userId,
      requestId: request.id,
    });
    return reply.status(200).send(result);
  });
}
