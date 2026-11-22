import { fmtINR } from "./utils";

export { fmtINR };

export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100/api/v1";

export const TOKEN_KEY = "frame_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  code: string;
  requestId?: string;

  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = ApiError.name;
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;
  const headers: Record<string, string> = {};

  const authToken = token !== undefined ? token : getToken();
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Unable to reach the Frame API. Is the API server running?");
  }

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const err = (payload as { error?: { code?: string; message?: string; request_id?: string } } | null)?.error;
    throw new ApiError(
      response.status,
      err?.code ?? "API_ERROR",
      err?.message ?? `Request failed (${response.status})`,
      err?.request_id,
    );
  }

  return payload as T;
}

export const api = {
  get<T>(path: string, token?: string | null): Promise<T> {
    return apiRequest<T>(path, { method: "GET", token });
  },
  post<T>(path: string, body?: unknown, token?: string | null): Promise<T> {
    return apiRequest<T>(path, { method: "POST", body, token });
  },
  patch<T>(path: string, body?: unknown, token?: string | null): Promise<T> {
    return apiRequest<T>(path, { method: "PATCH", body, token });
  },
  put<T>(path: string, body?: unknown, token?: string | null): Promise<T> {
    return apiRequest<T>(path, { method: "PUT", body, token });
  },
  delete<T>(path: string, token?: string | null): Promise<T> {
    return apiRequest<T>(path, { method: "DELETE", token });
  },
};

// ---------------------------------------------------------------- types

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Agent {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  owner?: string | null;
  environment: string;
  purpose?: string | null;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface Credential {
  id: string;
  prefix: string;
  key: string;
  secretShownOnce: boolean;
}

export interface AgentCreateResult {
  agent: Agent;
  credential: Credential;
}

export interface Policy {
  id: string;
  organizationId: string;
  agentId: string;
  name: string;
  description?: string | null;
  status: string;
  currentVersionId?: string | null;
  activeVersion: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PolicyConfig {
  monthlyLimitPaise?: number;
  dailyLimitPaise?: number;
  transactionLimitPaise?: number;
  approvalThresholdPaise?: number;
  allowedMerchants?: string[];
  blockedMerchants?: string[];
  restrictedCategories?: string[];
  maxPaymentsPerHour?: number;
  maxPaymentsPerDay?: number;
  [key: string]: unknown;
}

export interface PolicyVersion {
  id: string;
  organizationId: string;
  policyId: string;
  version: number;
  config: PolicyConfig;
  createdBy?: string | null;
  createdAt?: string | null;
}

export interface PaymentIntent {
  id: string;
  organizationId: string;
  agentId: string;
  policyVersionId?: string | null;
  amountPaise: number | string;
  currency?: string;
  merchant: string;
  merchantReference?: string | null;
  purpose?: string | null;
  taskReference?: string | null;
  intentHash?: string | null;
  status: string;
  decision?: string | null;
  reasons?: unknown;
  idempotencyKey?: string;
  expiresAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  agent?: { id: string; name: string; status: string } | null;
}

export interface ApprovalTask {
  id: string;
  organizationId: string;
  paymentIntentId: string;
  requiredRole: string;
  requestedAt?: string | null;
  expiresAt?: string | null;
  decision: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  comment?: string | null;
  paymentIntent?: PaymentIntent | null;
  agent?: { id: string; name: string } | null;
  policy?: { id: string; name: string; version: number } | null;
  reason?: string | null;
}

export interface Transaction {
  id: string;
  organizationId: string;
  paymentIntentId?: string | null;
  provider: string;
  providerPaymentId?: string | null;
  amountPaise: number | string;
  currency?: string;
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AuditEvent {
  id: string;
  organizationId: string;
  actorType: string;
  actorId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  entityBefore?: unknown;
  entityAfter?: unknown;
  requestId?: string | null;
  policyVersionId?: string | null;
  decision?: string | null;
  previousHash?: string | null;
  entryHash?: string | null;
  createdAt?: string | null;
}

export interface Overview {
  totalSpendPaise?: number | string;
  todaySpendPaise?: number | string;
  activeAgents?: number;
  pendingApprovals?: number;
  blockedAttempts?: number;
  successRate?: number;
  recentPayments?: PaymentIntent[];
  securityAlerts?: Array<{ id: string; severity: string; title: string; message?: string; createdAt?: string }>;
  [key: string]: unknown;
}

export function statusToDecisionTone(decision: string | null | undefined): string {
  if (!decision) return "neutral";
  switch (decision) {
    case "ALLOW":
      return "safe";
    case "DENY":
      return "blocked";
    case "REQUIRE_APPROVAL":
      return "pending";
    default:
      return "neutral";
  }
}