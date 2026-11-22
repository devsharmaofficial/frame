import { db } from "../../db.js";
import { providers } from "@frame/db";
import { eq, and } from "drizzle-orm";
import { randomHex } from "./sandbox.js";
import { AppError } from "../../lib/errors.js";

const VALID_TYPES = new Set(["sandbox", "stripe", "razorpay", "cashfree"]);

export async function registerProvider(
  orgId: string,
  { name, providerType, config, defaultRoute }: { name: string; providerType: string; config: Record<string, unknown>; defaultRoute?: boolean },
) {
  if (!VALID_TYPES.has(providerType)) {
    throw new AppError(400, "INVALID_PROVIDER_TYPE", `Provider type must be one of: ${[...VALID_TYPES].join(", ")}`);
  }
  const [existing] = await db
    .select()
    .from(providers)
    .where(and(eq(providers.organizationId, orgId), eq(providers.name, name)))
    .limit(1);
  if (existing) {
    throw new AppError(409, "PROVIDER_EXISTS", `Provider ${name} already exists`);
  }
  const [result] = await db.insert(providers).values({
    organizationId: orgId,
    name,
    providerType,
    config: config ?? {},
    status: "active",
    defaultRoute: defaultRoute ?? false,
  }).returning();
  return result;
}

export async function listProviders(orgId: string) {
  return db.select().from(providers).where(eq(providers.organizationId, orgId)).orderBy(providers.createdAt);
}

export async function activateProvider(orgId: string, id: string) {
  const [result] = await db.update(providers).set({ status: "active", updatedAt: new Date() }).where(and(eq(providers.id, id), eq(providers.organizationId, orgId))).returning();
  if (!result) throw new AppError(404, "PROVIDER_NOT_FOUND", "Provider not found");
  return result;
}

export async function deactivateProvider(orgId: string, id: string) {
  const [result] = await db.update(providers).set({ status: "inactive", updatedAt: new Date() }).where(and(eq(providers.id, id), eq(providers.organizationId, orgId))).returning();
  if (!result) throw new AppError(404, "PROVIDER_NOT_FOUND", "Provider not found");
  return result;
}
