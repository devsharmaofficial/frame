import type {
  Agent,
  ApprovalTask,
  AuditEvent,
  CreateAgentInput,
  CreateIntentInput,
  CreatePolicyInput,
  Credential,
  Overview,
  Payment,
  PaymentIntent,
  Policy,
  PolicyConfig,
  PolicyVersion,
  SignupInput,
  Transaction,
  User,
  WebhookTestInput,
} from "./types.js";

export type * from "./types.js";

export const DEFAULT_BASE_URL = "http://localhost:4100/api/v1";

export type FetchFn = typeof fetch;

export interface FrameClientOptions {
  baseUrl?: string;
  /** User JWT for dashboard calls. */
  token?: string;
  /** Alias for token (or an agent key when acting as an agent). */
  apiKey?: string;
  /** Injectable fetch (defaults to globalThis.fetch). Required for Node < 18. */
  fetch?: FetchFn;
}

export interface RequestExtras {
  /** Per-call bearer override (e.g. agent key for intent creation). */
  auth?: string;
  headers?: Record<string, string>;
}

export interface CreateIntentOptions extends RequestExtras {
  /** Agent bearer key. Falls back to client token when omitted. */
  agentKey?: string;
  /** Idempotency key. Auto-generated via newIdempotencyKey() when omitted. */
  idempotencyKey?: string;
}

/** Error thrown for non-2xx API responses: { error: { code, message, request_id } }. */
export class FrameError extends Error {
  code: string;
  status: number;
  requestId?: string;

  constructor(opts: { code: string; status: number; message: string; requestId?: string }) {
    super(opts.message);
    this.name = "FrameError";
    this.code = opts.code;
    this.status = opts.status;
    this.requestId = opts.requestId;
  }
}

/** UUID-ish idempotency key (crypto.randomUUID when available). */
export function newIdempotencyKey(): string {
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // Fallback: 32 hex chars (no dashes) — accepted as an opaque key.
  const bytes = c?.getRandomValues
    ? c.getRandomValues(new Uint8Array(16))
    : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Convert rupees → integer paise (Math.round(x * 100)). */
export function inrToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Convert integer paise → rupees. */
export function paiseToInr(paise: number): number {
  return paise / 100;
}

/** Normalize tolerant paise (number|string) → number. */
export function toPaiseNumber(v: number | string): number {
  return typeof v === "string" ? Number(v) : v;
}

function resolveBaseUrl(explicit?: string): string {
  const raw =
    explicit ??
    (typeof process !== "undefined" ? process.env["FRAME_API_URL"] : undefined) ??
    DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

export class FrameClient {
  readonly baseUrl: string;
  private token?: string;
  private doFetch: FetchFn;

  constructor(opts: FrameClientOptions = {}) {
    this.baseUrl = resolveBaseUrl(opts.baseUrl);
    this.token = opts.token ?? opts.apiKey;
    this.doFetch = opts.fetch ?? globalThis.fetch;
    if (!this.doFetch) throw new Error("No fetch implementation: inject one via { fetch } or use Node 18+.");
  }

  setToken(token: string | undefined): void {
    this.token = token;
  }

  get authToken(): string | undefined {
    return this.token;
  }

  private authHeader(explicit?: string): Record<string, string> {
    const t = explicit ?? this.token;
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  private async req<T>(
    method: string,
    path: string,
    opts: { body?: unknown; auth?: string; headers?: Record<string, string> } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...this.authHeader(opts.auth),
      ...(opts.headers ?? {}),
    };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await this.doFetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const requestId = res.headers?.get?.("x-request-id") ?? undefined;
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const err = (data as { error?: { code?: string; message?: string; request_id?: string } } | null)
        ?.error;
      throw new FrameError({
        code: err?.code ?? `HTTP_${res.status}`,
        status: res.status,
        message: err?.message ?? `Request failed: ${method} ${path} (${res.status})`,
        requestId: err?.request_id ?? requestId,
      });
    }
    return data as T;
  }

  /* ---------------- auth ---------------- */
  auth = {
    signup: async (input: SignupInput): Promise<{ token: string; user: User }> => {
      const out = await this.req<{ token: string; user: User }>("POST", "/auth/signup", {
        body: input,
      });
      if (out?.token) this.token = out.token;
      return out;
    },
  };

  /* ---------------- agents ---------------- */
  agents = {
    create: (input: CreateAgentInput): Promise<{ agent: Agent; credential: Credential }> =>
      this.req("POST", "/agents", { body: input }),
    list: (): Promise<{ agents: Agent[] } | Agent[]> => this.req("GET", "/agents"),
    get: (id: string): Promise<{ agent: Agent } | Agent> => this.req("GET", `/agents/${id}`),
    disable: (id: string): Promise<{ agent: Agent } | Agent> =>
      this.req("POST", `/agents/${id}/disable`),
    enable: (id: string): Promise<{ agent: Agent } | Agent> =>
      this.req("POST", `/agents/${id}/enable`),
    rotateKey: (id: string): Promise<{ agent: Agent; credential: Credential }> =>
      this.req("POST", `/agents/${id}/rotate-key`),
  };

  /* ---------------- policies ---------------- */
  policies = {
    create: (input: CreatePolicyInput): Promise<{ policy: Policy; version: PolicyVersion }> =>
      this.req("POST", "/policies", { body: input }),
    update: (id: string, patch: { config: PolicyConfig }): Promise<{ policy: Policy }> =>
      this.req("PATCH", `/policies/${id}`, { body: patch }),
    list: (): Promise<{ policies: Policy[] } | Policy[]> => this.req("GET", "/policies"),
    get: (id: string): Promise<{ policy: Policy } | Policy> => this.req("GET", `/policies/${id}`),
    versions: (id: string): Promise<{ versions: PolicyVersion[] } | PolicyVersion[]> =>
      this.req("GET", `/policies/${id}/versions`),
  };

  /* ---------------- payment intents ---------------- */
  paymentIntents = {
    create: (
      input: CreateIntentInput,
      opts: CreateIntentOptions = {},
    ): Promise<PaymentIntent & Record<string, unknown>> => {
      const key = opts.idempotencyKey ?? newIdempotencyKey();
      return this.req("POST", "/payment-intents", {
        body: input,
        auth: opts.agentKey ?? opts.auth,
        headers: { "Idempotency-Key": key, ...(opts.headers ?? {}) },
      });
    },
    list: (params: { agentId?: string } = {}): Promise<{ intents: PaymentIntent[] } | PaymentIntent[]> => {
      const qs = params.agentId ? `?agentId=${encodeURIComponent(params.agentId)}` : "";
      return this.req("GET", `/payment-intents${qs}`);
    },
    get: (id: string): Promise<{ intent: PaymentIntent } | PaymentIntent> =>
      this.req("GET", `/payment-intents/${id}`),
    audit: (id: string): Promise<{ intent: PaymentIntent; timeline: unknown; payment: Payment | null; approval: ApprovalTask | null }> =>
      this.req("GET", `/payment-intents/${id}/audit`),
    /** Execute with agent auth (pass agentKey or use agent-keyed client). */
    execute: (id: string, opts: RequestExtras & { agentKey?: string } = {}) =>
      this.req("POST", `/payment-intents/${id}/execute`, { auth: opts.agentKey ?? opts.auth }),
    /** Execute with user auth (dashboard token). */
    executeUser: (id: string, opts: RequestExtras = {}) =>
      this.req("POST", `/payment-intents/${id}/execute-user`, { auth: opts.auth }),
  };

  /* ---------------- approvals ---------------- */
  approvals = {
    list: (params: { status?: string } = {}): Promise<{ approvals: ApprovalTask[] } | ApprovalTask[]> => {
      const qs = params.status ? `?status=${encodeURIComponent(params.status)}` : "";
      return this.req("GET", `/approvals${qs}`);
    },
    approve: (id: string, body: { comment?: string } = {}) =>
      this.req("POST", `/approvals/${id}/approve`, { body }),
    reject: (id: string, body: { comment?: string } = {}) =>
      this.req("POST", `/approvals/${id}/reject`, { body }),
  };

  /* ---------------- dashboards ---------------- */
  overview = {
    get: (): Promise<Overview> => this.req("GET", "/overview"),
  };

  transactions = {
    list: (): Promise<{ transactions: Transaction[] } | Transaction[]> =>
      this.req("GET", "/transactions"),
  };

  audit = {
    list: (): Promise<{ events: AuditEvent[] } | AuditEvent[]> =>
      this.req("GET", "/audit-events"),
  };

  webhooks = {
    test: (input: WebhookTestInput): Promise<unknown> =>
      this.req("POST", "/webhooks/test", { body: input }),
  };
}
