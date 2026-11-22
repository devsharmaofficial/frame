import type { FastifyInstance, FastifyRequest } from "fastify";
import { createHash } from "node:crypto";
import { ApiError } from "../../common/errors.js";
import type { Store } from "../../common/store.js";

export function registerAuth(app: FastifyInstance, store: Store, apiKey: string) {
  app.addHook("onRequest", async (request) => {
    if (request.url === "/health" || request.method === "OPTIONS") return;
    const supplied = request.headers["x-api-key"];
    if (supplied !== apiKey) throw new ApiError(401, "UNAUTHORIZED", "A valid x-api-key is required.");
    (request as FastifyRequest & { organizationId: string }).organizationId = "org_default";
  });
  if (!store.organizations.has("org_default")) {
    store.organizations.set("org_default", { id: "org_default", name: "Framer Demo Organization", createdAt: store.now() });
  }
  return { hashCredential: (secret: string) => createHash("sha256").update(secret).digest("hex") };
}
