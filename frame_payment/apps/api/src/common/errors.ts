export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorBody(error: ApiError, requestId: string) {
  return { error: { code: error.code, message: error.message, request_id: requestId, details: error.details } };
}
