import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Store } from "../../common/store.js";
import { ApiError } from "../../common/errors.js";

const createSchema = z.object({ name: z.string().min(1).max(120) });
export function registerOrganizationRoutes(app: FastifyInstance, store: Store) {
  app.get("/api/v1/organizations/:id", async (request) => {
    const { id } = request.params as { id: string };
    const organization = store.organizations.get(id);
    if (!organization) throw new ApiError(404, "ORGANIZATION_NOT_FOUND", "Organization was not found.");
    return { data: organization };
  });
  app.post("/api/v1/organizations", async (request, reply) => {
    const input = createSchema.parse(request.body);
    const organization = { id: store.id("org"), name: input.name, createdAt: store.now() };
    store.organizations.set(organization.id, organization);
    return reply.code(201).send({ data: organization });
  });
}
