import type { FastifyInstance } from "fastify";
import { db } from "../../db.js";
import { ledgerEntries, paymentIntents, payments } from "@frame/db";
import { eq, and, desc } from "drizzle-orm";

export async function transactionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.userAuth);

  app.get("/transactions", async (request) => {
    const orgId = request.organizationId!;
    const { limit = "50", offset = "0" } = request.query as { limit?: string; offset?: string };

    const rows = await db
      .select({
        id: ledgerEntries.id,
        organizationId: ledgerEntries.organizationId,
        paymentIntentId: ledgerEntries.paymentIntentId,
        paymentId: ledgerEntries.paymentId,
        entryType: ledgerEntries.entryType,
        amountPaise: ledgerEntries.amountPaise,
        currency: ledgerEntries.currency,
        providerReference: ledgerEntries.providerReference,
        previousHash: ledgerEntries.previousHash,
        entryHash: ledgerEntries.entryHash,
        createdAt: ledgerEntries.createdAt,
        intentStatus: paymentIntents.status,
        intentMerchant: paymentIntents.merchant,
        intentAmount: paymentIntents.amountPaise,
        paymentStatus: payments.status,
      })
      .from(ledgerEntries)
      .leftJoin(paymentIntents, eq(ledgerEntries.paymentIntentId, paymentIntents.id))
      .leftJoin(payments, eq(ledgerEntries.paymentId, payments.id))
      .where(eq(ledgerEntries.organizationId, orgId))
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    return rows.map((r) => ({
      id: r.id,
      entryType: r.entryType,
      amountPaise: Number(r.amountPaise),
      currency: r.currency,
      providerReference: r.providerReference,
      entryHash: r.entryHash,
      createdAt: r.createdAt,
      intent: r.paymentIntentId
        ? {
            id: r.paymentIntentId,
            status: r.intentStatus,
            merchant: r.intentMerchant,
            amountPaise: r.intentAmount ? Number(r.intentAmount) : null,
          }
        : null,
      payment: r.paymentId
        ? {
            id: r.paymentId,
            status: r.paymentStatus,
          }
        : null,
    }));
  });
}
