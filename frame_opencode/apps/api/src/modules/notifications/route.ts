import type { FastifyInstance } from "fastify";
import {
  listNotifications,
  createTestNotification,
  TEST_NOTIFICATION_TYPES,
} from "./service.js";
import { AppError } from "../../lib/errors.js";

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.userAuth);

  app.get("/notifications", async (request) => {
    const { limit = "25" } = request.query as { limit?: string };
    const parsed = Number(limit);
    return listNotifications(
      request.organizationId!,
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 25,
    );
  });

  app.post("/notifications/test", { preHandler: [app.requireRole("admin", "approver")] }, async (request, reply) => {
    const body = request.body as { type?: string };
    if (
      !body?.type ||
      !(TEST_NOTIFICATION_TYPES as readonly string[]).includes(body.type)
    ) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `type must be one of ${(TEST_NOTIFICATION_TYPES as readonly string[]).join(", ")}`,
      );
    }
    const rendered = await createTestNotification(
      request.organizationId!,
      body.type,
      {
        actorType: "user",
        actorId: request.userId,
        requestId: request.id,
      },
    );
    return reply.status(201).send(rendered);
  });
}
