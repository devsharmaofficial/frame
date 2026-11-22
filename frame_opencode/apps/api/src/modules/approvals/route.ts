import type { FastifyInstance } from "fastify";
import { listApprovals, approveTask, rejectTask } from "./service.js";

export async function approvalRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.userAuth);

  const mutate = app.requireRole("admin", "approver");

  app.get("/approvals", async (request) => {
    const { status } = request.query as { status?: string };
    return listApprovals(request.organizationId!, status);
  });

  app.post("/approvals/:id/approve", { preHandler: [mutate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { comment?: string };
    const result = await approveTask(
      request.organizationId!,
      id,
      request.userId!,
      request.role!,
      body?.comment,
      request.id,
    );
    return reply.status(200).send(result);
  });

  app.post("/approvals/:id/reject", { preHandler: [mutate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { comment?: string };
    const result = await rejectTask(
      request.organizationId!,
      id,
      request.userId!,
      request.role!,
      body?.comment,
      request.id,
    );
    return reply.status(200).send(result);
  });
}
