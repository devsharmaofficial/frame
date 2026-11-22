import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { db } from "../db.js";
import { users, organizations, agentCredentials, agents } from "@frame/db";
import { eq, and } from "drizzle-orm";
import { sha256 } from "../lib/hash.js";
import { AppError } from "../lib/errors.js";
import { config } from "../config.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    organizationId?: string;
    role?: string;
    agent?: { id: string; organizationId: string; name: string; status: string };
  }
}

export const VALID_ROLES = ["admin", "approver", "viewer"] as const;
export type UserRole = (typeof VALID_ROLES)[number];

export const authPlugin: FastifyPluginAsync = fp(async function authPlugin(app: FastifyInstance) {
  await app.register(import("@fastify/jwt"), {
    secret: config.JWT_SECRET,
    sign: { expiresIn: "7d" },
  });

  app.decorate(
    "userAuth",
    async function userAuth(request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch {
        throw new AppError(401, "UNAUTHORIZED", "Invalid or missing token");
      }
      const payload = request.user as { userId: string; orgId: string; role: string };
      request.userId = payload.userId;
      request.organizationId = payload.orgId;
      request.role = payload.role;
    },
  );

  app.decorate(
    "agentAuth",
    async function agentAuth(request: FastifyRequest, reply: FastifyReply) {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer fr_")) {
        throw new AppError(401, "UNAUTHORIZED", "Missing or invalid agent key");
      }

      const token = authHeader.slice(7);
      const parts = token.split("_");
      if (parts.length < 3 || parts[0] !== "fr") {
        throw new AppError(401, "UNAUTHORIZED", "Invalid agent key format");
      }
      const prefix = parts[1]!;
      const secret = parts.slice(2).join("_");
      const keyHash = sha256(prefix + secret);

      const [cred] = await db
        .select({
          id: agentCredentials.id,
          agentId: agentCredentials.agentId,
          organizationId: agentCredentials.organizationId,
          status: agentCredentials.status,
          expiresAt: agentCredentials.expiresAt,
          agentStatus: agents.status,
          agentName: agents.name,
        })
        .from(agentCredentials)
        .innerJoin(agents, eq(agentCredentials.agentId, agents.id))
        .where(eq(agentCredentials.keyHash, keyHash))
        .limit(1);

      if (!cred) {
        throw new AppError(401, "UNAUTHORIZED", "Invalid agent key");
      }
      if (cred.expiresAt && new Date() > cred.expiresAt) {
        throw new AppError(401, "CREDENTIAL_EXPIRED", "Agent key has expired");
      }
      if (cred.status !== "active") {
        throw new AppError(403, "AGENT_KEY_REVOKED", "Agent key is revoked");
      }
      if (cred.agentStatus !== "active") {
        throw new AppError(403, "AGENT_DISABLED", "Agent is disabled");
      }

      await db
        .update(agentCredentials)
        .set({ lastUsedAt: new Date() })
        .where(eq(agentCredentials.id, cred.id));

      request.agent = {
        id: cred.agentId,
        organizationId: cred.organizationId,
        name: cred.agentName,
        status: cred.agentStatus,
      };
      request.organizationId = cred.organizationId;
    },
  );

  // Role gate for user-authenticated mutating routes.
  // Usage: preHandler: [app.requireRole("admin", "approver")]
  // Viewer is read-only: only routes listing admin/approver pass.
  // agentAuth routes are unaffected (they don't set request.role).
  app.decorate("requireRole", (...allowed: string[]) => {
    return async function requireRoleHandler(request: FastifyRequest, reply: FastifyReply) {
      // Agent-authenticated requests carry no user role; leave them alone.
      if (request.agent && !request.userId) return;
      const role = request.role;
      if (!role || !allowed.includes(role)) {
        throw new AppError(403, "FORBIDDEN", "Insufficient role");
      }
    };
  });

  // Admin-only gate (e.g. user provisioning).
  app.decorate("requireAdmin", async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    if (request.agent && !request.userId) return;
    if (request.role !== "admin") {
      throw new AppError(403, "FORBIDDEN", "Admin role required");
    }
  });
});

declare module "fastify" {
  interface FastifyInstance {
    userAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    agentAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...allowed: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
