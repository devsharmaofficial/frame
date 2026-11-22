import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export class AppError extends Error {
  public statusCode: number;
  public code: string;

  constructor(
    statusCode: number,
    code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function errorHandler(
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const requestId = (request as any).id ?? "unknown";
  let statusCode = 500;
  let code = "INTERNAL_ERROR";

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
  } else if ("statusCode" in error && typeof error.statusCode === "number") {
    statusCode = error.statusCode;
    code = error.code ?? "INTERNAL_ERROR";
  }

  const message =
    statusCode >= 500 ? "Internal Server Error" : error.message || "Internal Server Error";

  request.log.error({ err: error }, "request error");

  reply.status(statusCode).send({
    error: {
      code,
      message,
      request_id: requestId,
    },
  });
}
