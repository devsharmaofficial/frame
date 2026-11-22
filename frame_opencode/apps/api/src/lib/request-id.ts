import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

export async function requestIdHook(app: FastifyInstance) {
  app.addHook("onRequest", async (request) => {
    if (!request.id) {
      request.id = randomUUID();
    }
  });
}
