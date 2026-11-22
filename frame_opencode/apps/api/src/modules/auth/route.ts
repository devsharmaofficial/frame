import type { FastifyInstance } from "fastify";
import { signup, login, getMe, createUser } from "./service.js";
import { AppError } from "../../lib/errors.js";

export async function authRoutes(app: FastifyInstance) {
  app.post(
    "/auth/signup",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = request.body as {
        name?: string;
        email?: string;
        companyName?: string;
        password?: string;
      };
      if (!body?.name || !body?.email || !body?.companyName || !body?.password) {
        throw new AppError(400, "VALIDATION_ERROR", "name, email, companyName, and password are required");
      }

      const result = await signup({
        name: body.name,
        email: body.email,
        companyName: body.companyName,
        password: body.password,
      });

      const token = app.jwt.sign({
        userId: result.user.id,
        orgId: result.org.id,
        role: result.user.role,
      });

      return reply.status(201).send({
        token,
        user: { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role },
      });
    },
  );

  app.post(
    "/auth/login",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = request.body as { email?: string; password?: string };
      if (!body?.email || !body?.password) {
        throw new AppError(400, "VALIDATION_ERROR", "email and password are required");
      }

      const result = await login({ email: body.email, password: body.password });

      const token = app.jwt.sign({
        userId: result.user.id,
        orgId: result.user.organizationId,
        role: result.user.role,
      });

      return { token, user: { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role } };
    },
  );

  app.post(
    "/auth/users",
    { preHandler: [app.userAuth, app.requireAdmin] },
    async (request, reply) => {
      const body = request.body as {
        name?: string;
        email?: string;
        password?: string;
        role?: string;
      };
      if (!body?.name || !body?.email || !body?.password || !body?.role) {
        throw new AppError(400, "VALIDATION_ERROR", "name, email, password, and role are required");
      }
      const result = await createUser(request.organizationId!, request.userId!, {
        name: body.name,
        email: body.email,
        password: body.password,
        role: body.role,
      });
      return reply.status(201).send({
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          organizationId: result.user.organizationId,
        },
      });
    },
  );

  app.get("/auth/me", { preHandler: [app.userAuth] }, async (request) => {
    const result = await getMe(request.userId!);
    return {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        organizationId: result.user.organizationId,
        organizationSlug: result.org?.slug ?? null,
        organizationName: result.org?.name ?? null,
      },
    };
  });
}
