import type { FastifyInstance } from "fastify";
import type { Store } from "../../common/store.js";
export function registerAuditRoutes(app: FastifyInstance, store: Store) {
  app.get("/api/v1/audit-events", async (request) => {
    const organizationId = (request as typeof request & { organizationId: string }).organizationId;
    return { data: store.audit.filter((event) => event.organizationId === organizationId) };
  });
}
