import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { ApiError, errorBody } from "./common/errors.js";
import { createStore } from "./common/store.js";
import { registerAuth } from "./modules/auth/index.js";
import { registerOrganizationRoutes } from "./modules/organizations/routes.js";
import { registerAgentRoutes } from "./modules/agents/routes.js";
import { registerCredentialRoutes } from "./modules/credentials/routes.js";
import { registerPolicyRoutes } from "./modules/policies/routes.js";
import { registerPaymentIntentRoutes } from "./modules/payment-intents/routes.js";
import { registerApprovalRoutes } from "./modules/approvals/routes.js";
import { registerAuditRoutes } from "./modules/audit/routes.js";

export function buildApp(config = loadConfig()) {
  const app = Fastify({ logger: config.NODE_ENV !== "test", requestIdHeader: "x-request-id", genReqId: () => `req_${crypto.randomUUID()}` });
  const store = createStore(config.NODE_ENV === "test" ? undefined : config.DATA_FILE);
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Headers", "content-type, x-api-key, idempotency-key, x-request-id");
    reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  });
  app.options("*", async (_request, reply) => reply.code(204).send());
  registerAuth(app, store, config.FRAMER_API_KEY);
  app.get("/health", async () => ({ data: { status: "ok", service: "framer-api", environment: config.NODE_ENV } }));
  registerOrganizationRoutes(app, store);
  registerAgentRoutes(app, store);
  registerCredentialRoutes(app, store);
  registerPolicyRoutes(app, store);
  registerPaymentIntentRoutes(app, store);
  registerApprovalRoutes(app, store);
  registerAuditRoutes(app, store);
  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id;
    if (error instanceof ApiError) return reply.code(error.statusCode).send(errorBody(error, requestId));
    if (error instanceof Error && error.name === "ZodError") return reply.code(400).send(errorBody(new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", error), requestId));
    request.log.error(error instanceof Error ? error : new Error(String(error)));
    return reply.code(500).send(errorBody(new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred."), requestId));
  });
  app.addHook("onResponse", async () => {
    store.persist();
  });
  return app;
}
