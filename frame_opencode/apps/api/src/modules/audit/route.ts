import type { FastifyInstance } from "fastify";
import { db } from "../../db.js";
import { auditEvents } from "@frame/db";
import { eq, desc } from "drizzle-orm";

export async function auditRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.userAuth);

  app.get("/audit-events", async (request) => {
    const orgId = request.organizationId!;
    const { limit = "50", offset = "0" } = request.query as { limit?: string; offset?: string };

    return db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, orgId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));
  });
}
