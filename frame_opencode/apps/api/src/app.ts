import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { authPlugin } from "./plugins/auth.js";
import { requestIdHook } from "./lib/request-id.js";
import { errorHandler } from "./lib/errors.js";
import { authRoutes } from "./modules/auth/route.js";
import { agentRoutes } from "./modules/agents/route.js";
import { policyRoutes } from "./modules/policies/route.js";
import { paymentIntentRoutes } from "./modules/paymentIntents/route.js";
import { approvalRoutes } from "./modules/approvals/route.js";
import { overviewRoutes } from "./modules/overview/route.js";
import { transactionRoutes } from "./modules/transactions/route.js";
import { auditRoutes } from "./modules/audit/route.js";
import { webhookRoutes } from "./modules/provider/routes.js";
import { reconciliationRoutes } from "./modules/reconciliation/route.js";
import { notificationRoutes } from "./modules/notifications/route.js";
import { riskRoutes } from "./modules/risk/route.js";
import { providerRoutes } from "./modules/provider/providerRoutes.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
    bodyLimit: 1024 * 1024,
    // Attach raw body for webhook signature verification
    trustProxy: true,
  });

  await requestIdHook(app);

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(import("@fastify/helmet"));

  // Serialize BigInt (paise) as plain numbers in every JSON response
  app.setReplySerializer((payload) =>
    JSON.stringify(payload, (_key, v) => (typeof v === "bigint" ? Number(v) : v)),
  );

  await app.register(authPlugin);

  app.setErrorHandler(errorHandler);

  // Health check
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  // Register routes under /api/v1 prefix
  await app.register(
    async (v1) => {
      await v1.register(authRoutes);
      await v1.register(agentRoutes);
      await v1.register(policyRoutes);
      await v1.register(paymentIntentRoutes);
      await v1.register(approvalRoutes);
      await v1.register(overviewRoutes);
      await v1.register(transactionRoutes);
      await v1.register(auditRoutes);
      await v1.register(webhookRoutes);
      await v1.register(reconciliationRoutes);
      await v1.register(notificationRoutes);
      await v1.register(riskRoutes);
      await v1.register(providerRoutes);
    },
    { prefix: "/api/v1" },
  );

  return app;
}
