export type Currency = "INR" | (string & {});

export type AgentStatus = "ACTIVE" | "DISABLED";

export interface Agent {
  id: string;
  name: string;
  description?: string;
  status: AgentStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentParams {
  name: string;
  description?: string;
}

export type PaymentIntentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "REQUIRES_APPROVAL"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "UNKNOWN"
  | "EXPIRED"
  | "CANCELED";

export type PaymentDecision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

export interface PaymentIntent {
  id: string;
  agent_id: string;
  amount: number;
  currency: Currency;
  merchant: string;
  purpose: string;
  status: PaymentIntentStatus;
  decision: PaymentDecision;
  policy_version_id?: string;
  intent_hash?: string;
  expires_at: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentIntentParams {
  agent_id: string;
  /** Integer minor units. For INR, 10050 represents ₹100.50. */
  amount: number;
  currency: Currency;
  merchant: string;
  purpose: string;
  task_reference?: string;
  merchant_reference?: string;
  expires_at?: string;
}

export interface Approval {
  id: string;
  payment_intent_id: string;
  required_role: string;
  decision: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  requested_at: string;
  expires_at: string;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  comment?: string;
}

export interface RequestOptions {
  /**
   * Reuse this value when retrying a request. Payment intent creation requires
   * an idempotency key to prevent duplicate payments.
   */
  idempotencyKey?: string;
  /** Override the generated request ID for distributed tracing. */
  requestId?: string;
}

export interface SdkResult<T> {
  data: T;
  /** Framer request ID, sourced from the response or generated for the call. */
  requestId: string;
}

export interface FramerErrorBody {
  error: {
    code: string;
    message: string;
    request_id?: string;
    details?: Record<string, unknown>;
  };
}

export class FramerApiError extends Error {
  readonly code: string;
  readonly requestId: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      code: string;
      requestId: string;
      status: number;
      details?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = "FramerApiError";
    this.code = options.code;
    this.requestId = options.requestId;
    this.status = options.status;
    this.details = options.details;
  }
}

export interface FramerClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

const DEFAULT_BASE_URL = "https://api.framer.example.com";

function createRequestId(): string {
  return `req_${crypto.randomUUID()}`;
}

function assertNonEmpty(value: string, name: string): void {
  if (!value.trim()) {
    throw new TypeError(`${name} must not be empty`);
  }
}

function assertMinorUnits(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new TypeError("amount must be a non-negative integer in minor units");
  }
}

export class FramerClient {
  readonly agents: {
    create: (
      params: CreateAgentParams,
      options?: RequestOptions,
    ) => Promise<SdkResult<Agent>>;
  };
  readonly paymentIntents: {
    create: (
      params: CreatePaymentIntentParams,
      options: RequestOptions,
    ) => Promise<SdkResult<PaymentIntent>>;
    get: (
      paymentIntentId: string,
      options?: RequestOptions,
    ) => Promise<SdkResult<PaymentIntent>>;
  };
  readonly approvals: {
    get: (
      approvalId: string,
      options?: RequestOptions,
    ) => Promise<SdkResult<Approval>>;
  };

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(options: FramerClientOptions) {
    assertNonEmpty(options.apiKey, "apiKey");
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetcher = options.fetch ?? globalThis.fetch;

    this.agents = {
      create: (params, requestOptions) =>
        this.request<Agent>("POST", "/v1/agents", params, requestOptions),
    };
    this.paymentIntents = {
      create: (params, requestOptions) => {
        if (!requestOptions?.idempotencyKey) {
          throw new TypeError(
            "paymentIntents.create requires an idempotencyKey",
          );
        }
        assertMinorUnits(params.amount);
        return this.request<PaymentIntent>(
          "POST",
          "/v1/payment_intents",
          params,
          requestOptions,
        );
      },
      get: (paymentIntentId, requestOptions) => {
        assertNonEmpty(paymentIntentId, "paymentIntentId");
        return this.request<PaymentIntent>(
          "GET",
          `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`,
          undefined,
          requestOptions,
        );
      },
    };
    this.approvals = {
      get: (approvalId, requestOptions) => {
        assertNonEmpty(approvalId, "approvalId");
        return this.request<Approval>(
          "GET",
          `/v1/approvals/${encodeURIComponent(approvalId)}`,
          undefined,
          requestOptions,
        );
      },
    };
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<SdkResult<T>> {
    const requestId = options?.requestId ?? createRequestId();
    const headers: Record<string, string> = {
      Accept: "application/json",
      "x-api-key": this.apiKey,
      "X-Request-Id": requestId,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (options?.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }

    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const responseRequestId =
      response.headers.get("X-Request-Id") ?? requestId;
    const payload: unknown = await response
      .json()
      .catch(() => undefined);

    if (!response.ok) {
      const error = this.parseError(payload, response.status, responseRequestId);
      throw error;
    }

    return {
      data: payload as T,
      requestId: responseRequestId,
    };
  }

  private parseError(
    payload: unknown,
    status: number,
    requestId: string,
  ): FramerApiError {
    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "code" in payload.error &&
      "message" in payload.error &&
      typeof payload.error.code === "string" &&
      typeof payload.error.message === "string"
    ) {
      const error = payload.error as FramerErrorBody["error"];
      return new FramerApiError(error.message, {
        code: error.code,
        requestId: error.request_id ?? requestId,
        status,
        details: error.details,
      });
    }
    return new FramerApiError("Framer API request failed", {
      code: "API_ERROR",
      requestId,
      status,
    });
  }
}

export function createFramerClient(options: FramerClientOptions): FramerClient {
  return new FramerClient(options);
}
