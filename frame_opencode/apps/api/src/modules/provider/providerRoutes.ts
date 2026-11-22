import type { FastifyInstance } from "fastify";
import { db } from "../../db.js";
import { payments, paymentIntents, providers } from "@frame/db";
import { eq, and } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { registerProvider, listProviders, activateProvider, deactivateProvider } from "./providerRegistry.js";
import { StripeProvider } from "./stripe-mock.js";
import { randomHex } from "./sandbox.js";
import type { PaymentProvider } from "./sandbox.js";

export async function providerRoutes(app: FastifyInstance) {
  app.get("/providers", { preHandler: [app.userAuth] }, async (request) => {
    return listProviders(request.organizationId!);
  });

  app.post("/providers", { preHandler: [app.userAuth, app.requireAdmin] }, async (request) => {
    const body = request.body as { name: string; providerType: string; config?: Record<string, unknown>; defaultRoute?: boolean };
    if (!body?.name || !body?.providerType) {
      throw new AppError(400, "VALIDATION_ERROR", "name and providerType are required");
    }
    return registerProvider(request.organizationId!, body);
  });

  app.post("/providers/:id/activate", { preHandler: [app.userAuth, app.requireAdmin] }, async (request) => {
    const { id } = request.params as { id: string };
    return activateProvider(request.organizationId!, id);
  });

  app.post("/providers/:id/deactivate", { preHandler: [app.userAuth, app.requireAdmin] }, async (request) => {
    const { id } = request.params as { id: string };
    return deactivateProvider(request.organizationId!, id);
  });

  app.post("/payment-intents/:id/provider", { preHandler: [app.userAuth] }, async (request) => {
    const { id } = request.params as { id: string };
    const { providerId } = request.body as { providerId: string };

    const intentResults = await db
      .select()
      .from(paymentIntents)
      .where(and(eq(paymentIntents.id, id), eq(paymentIntents.organizationId, request.organizationId!)))
      .limit(1);
    const intent = intentResults[0];
    if (!intent) {
      throw new AppError(404, "INTENT_NOT_FOUND", "Payment intent not found");
    }
    if (intent.status !== "AUTHORIZED") {
      throw new AppError(409, "INVALID_STATE", `Intent status is ${intent.status}, expected AUTHORIZED`);
    }

    const [providerRow] = await db.select().from(providers).where(and(eq(providers.id, providerId), eq(providers.organizationId, request.organizationId!))).limit(1);
    if (!providerRow) {
      throw new AppError(404, "PROVIDER_NOT_FOUND", "Provider not found");
    }

    const provider: PaymentProvider = new StripeProvider();
    const execResult = await provider.executePayment(`stripe_${providerRow.id}`) as { status: string; providerPaymentId?: string };
    const providerPaymentId = execResult.providerPaymentId ?? `stripe_test_${randomHex(8)}`;

    await db.insert(payments).values({
      organizationId: intent.organizationId,
      paymentIntentId: intent.id,
      provider: providerRow.name,
      providerPaymentId,
      amountPaise: intent.amountPaise,
      currency: intent.currency,
      status: "PENDING",
    });

    await db.update(paymentIntents).set({ status: "EXECUTING", updatedAt: new Date() }).where(eq(paymentIntents.id, id));

    return { providerId: providerRow.id, providerPaymentId };
  });
}
