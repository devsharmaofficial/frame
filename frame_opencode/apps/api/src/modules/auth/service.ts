import { db } from "../../db.js";
import { organizations, users } from "@frame/db";
import { eq } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { appendAudit } from "../../lib/audit.js";

const VALID_ROLES = ["admin", "approver", "viewer"] as const;

export async function signup(input: {
  name: string;
  email: string;
  companyName: string;
  password: string;
}) {
  const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (existing.length > 0) {
    throw new AppError(409, "EMAIL_EXISTS", "Email already registered");
  }

  const baseSlug = input.companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "company";

  let slug = baseSlug;
  let suffix = 2;
  for (let attempt = 0; attempt < 10; attempt++) {
    const [existing] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (!existing) break;
    slug = `${baseSlug}-${suffix++}`;
  }

  const orgResults = await db
    .insert(organizations)
    .values({ name: input.companyName, slug })
    .returning();

  const org = orgResults[0];
  if (!org) throw new AppError(500, "DB_ERROR", "Failed to create organization");

  const userResults = await db
    .insert(users)
    .values({
      organizationId: org.id,
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: "admin",
    })
    .returning();

  const user = userResults[0];
  if (!user) throw new AppError(500, "DB_ERROR", "Failed to create user");

  await appendAudit({
    organizationId: org.id,
    actorType: "user",
    actorId: user.id,
    action: "user.created",
    resourceType: "user",
    resourceId: user.id,
    entityAfter: { id: user.id, email: user.email, role: user.role },
  });

  return { user, org };
}

export async function createUser(
  orgId: string,
  actorId: string,
  input: { name: string; email: string; password: string; role: string },
) {
  if (!(VALID_ROLES as readonly string[]).includes(input.role)) {
    throw new AppError(400, "VALIDATION_ERROR", "role must be one of admin, approver, viewer");
  }
  const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (existing.length > 0) {
    throw new AppError(409, "EMAIL_EXISTS", "Email already registered");
  }
  const results = await db
    .insert(users)
    .values({
      organizationId: orgId,
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
    })
    .returning();
  const user = results[0];
  if (!user) throw new AppError(500, "DB_ERROR", "Failed to create user");

  await appendAudit({
    organizationId: orgId,
    actorType: "user",
    actorId,
    action: "user.created",
    resourceType: "user",
    resourceId: user.id,
    entityAfter: { id: user.id, email: user.email, role: user.role },
  });

  return { user };
}

export async function login(input: { email: string; password: string }) {
  const results = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  const user = results[0];
  if (!user) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const match = await verifyPassword(input.password, user.passwordHash);
  if (!match) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  if (match === "legacy") {
    const newHash = await hashPassword(input.password);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
    await appendAudit({
      organizationId: user.organizationId,
      actorType: "user",
      actorId: user.id,
      action: "auth.password_rehashed",
      resourceType: "user",
      resourceId: user.id,
    });
    return { user: { ...user, passwordHash: newHash } };
  }

  return { user };
}

export async function getMe(userId: string) {
  const results = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = results[0];
  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  const [org] = await db
    .select({ id: organizations.id, slug: organizations.slug, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, user.organizationId))
    .limit(1);

  return { user, org: org ?? null };
}
