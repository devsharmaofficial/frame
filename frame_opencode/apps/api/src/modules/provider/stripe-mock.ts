import { randomHex } from "./sandbox.js";
import type { PaymentProvider } from "./sandbox.js";

export class StripeProvider implements PaymentProvider {
  async createAuthorization(params: { amountPaise: number; currency: string; merchant: string }): Promise<{ providerPaymentId: string }> {
    return { providerPaymentId: `stripe_auth_${randomHex(8)}` };
  }

  async executePayment(_providerPaymentId: string): Promise<{ status: string }> {
    return { providerPaymentId: `stripe_test_${randomHex(8)}`, status: "PENDING" } as { status: string };
  }

  async getPaymentStatus(providerPaymentId: string): Promise<{ status: string }> {
    if (providerPaymentId.startsWith("stripe_test_")) {
      return { status: "SUCCEEDED" };
    }
    return { status: "UNKNOWN" };
  }

  async cancelPayment(providerPaymentId: string): Promise<{ status: string }> {
    return { status: "canceled" };
  }

  async handleWebhook(payload: unknown, signature: string): Promise<{ eventType: string; paymentId: string }> {
    const body = payload as { eventType?: string; paymentId?: string };
    return { eventType: body.eventType ?? "payment.succeeded", paymentId: body.paymentId ?? `stripe_${randomHex(8)}` };
  }
}
