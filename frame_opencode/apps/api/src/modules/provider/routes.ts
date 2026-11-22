import type { FastifyInstance } from "fastify";
import { createHmac } from "node:crypto";
import { db } from "../../db.js";
import { payments } from "@frame/db";
import { eq } from "drizzle-orm";
import { simulateWebhook } from "./sandbox.js";
import { AppError } from "../../lib/errors.js";
import { config } from "../../config.js";

export async function webhookRoutes(app: FastifyInstance) {
  // Capture the exact raw bytes of the JSON body for HMAC-SHA256 verification.
  // Must be registered before routes in this scope (and only affects them).
  void app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body: string, done) => {
      try {
        (req as any).rawBody = Buffer.from(body);
        done(null, JSON.parse(body));
      } catch (err) {
        done(err as Error, undefined as any);
      }
    },
  );

  app.post("/webhooks/provider", async (request, reply) => {
    const rawBody = (request as any).rawBody as Buffer | undefined;
    if (!rawBody) {
      throw new AppError(400, "MISSING_BODY", "Request body is required");
    }

    const signature = request.headers["x-frame-signature"] as string | undefined;
    if (!signature) {
      throw new AppError(400, "MISSING_SIGNATURE", "X-Frame-Signature header is required");
    }

    const expectedSignature = createHmac("sha256", config.WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    if (signature !== expectedSignature) {
      throw new AppError(401, "INVALID_SIGNATURE", "Invalid webhook signature");
    }

    const body = JSON.parse(rawBody.toString()) as {
      event_type?: string;
      provider_payment_id?: string;
    };

    if (!body.event_type || !body.provider_payment_id) {
      throw new AppError(400, "VALIDATION_ERROR", "event_type and provider_payment_id are required");
    }

    if (!["payment.succeeded", "payment.failed"].includes(body.event_type)) {
      throw new AppError(400, "UNSUPPORTED_EVENT", `Unsupported event_type ${body.event_type}`);
    }

    const paymentResults = await db
      .select({
        id: payments.id,
        organizationId: payments.organizationId,
        providerPaymentId: payments.providerPaymentId,
      })
      .from(payments)
      .where(eq(payments.providerPaymentId, body.provider_payment_id))
      .limit(1);

    const payment = paymentResults[0];
    if (!payment) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "No payment matches provider_payment_id");
    }

    const result = await simulateWebhook(
      payment.organizationId,
      body.event_type,
      body.provider_payment_id,
    );

    return { received: true, processed: result.processed };
  });

  app.post("/webhooks/test", { preHandler: [app.userAuth, app.requireRole("admin", "approver")] }, async (request, reply) => {
    const body = request.body as {
      payment_id?: string;
      event_type?: string;
    };

    if (!body?.payment_id || !body?.event_type) {
      throw new AppError(400, "VALIDATION_ERROR", "payment_id and event_type are required");
    }

    const result = await simulateWebhook(
      request.organizationId!,
      body.event_type,
      body.payment_id,
    );

    return { processed: result.processed, status: result.status };
  });
}