/**
 * Shared types for @frame/sdk.
 *
 * Money is INTEGER PAISE everywhere on the wire. Fields typed as
 * `number | string` are tolerant on read (some endpoints serialize
 * big integers as strings); always send numbers.
 */

/** Integer paise amount, tolerant of string-serialized values on read. */
export type Paise = number | string;

export interface User {
  id: string;
  name: string;
  email: string;
  companyName?: string;
  companyId?: string;
  createdAt?: string;
  [k: string]: unknown;
}

export interface Agent {
  id: string;
  name: string;
  description?: string | null;
  owner?: string | null;
  environment?: string | null;
  purpose?: string | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: unknown;
}

export interface Credential {
  id: string;
  prefix: string;
  /** Full agent bearer key. Only returned once at creation / rotation. */
  key: string;
  secretShownOnce?: boolean;
  [k: string]: unknown;
}

/**
 * Policy config. The server accepts both canonical keys and dashboard
 * aliases (e.g. `allowedMerchants` → `merchantAllowlist`). The SDK passes
 * config through untouched; both spellings are typed here.
 */
export interface PolicyConfig {
  merchantAllowlist?: string[];
  allowedMerchants?: string[];
  maxAmountPaise?: Paise;
  maxAmount?: Paise;
  requireApprovalAbovePaise?: Paise;
  approvalThresholdPaise?: Paise;
  allowedCategories?: string[];
  blockedMerchants?: string[];
  merchantBlocklist?: string[];
  dailyLimitPaise?: Paise;
  velocityLimit?: unknown;
  [k: string]: unknown;
}

export interface Policy {
  id: string;
  agentId: string;
  agent_id?: string;
  name: string;
  description?: string | null;
  config: PolicyConfig;
  status?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: unknown;
}

export interface PolicyVersion {
  version: number;
  policyId?: string;
  config: PolicyConfig;
  createdAt?: string;
  [k: string]: unknown;
}

export interface IntentCheck {
  name: string;
  passed: boolean;
  reason?: string;
  [k: string]: unknown;
}

export interface PaymentIntent {
  id: string;
  agentId?: string;
  status: string;
  decision?: string;
  reasons?: string[];
  checks?: IntentCheck[];
  amountPaise: Paise;
  amount?: Paise;
  merchant?: string;
  currency?: string;
  createdAt?: string;
  [k: string]: unknown;
}

export interface Payment {
  id: string;
  intentId?: string;
  status: string;
  amountPaise?: Paise;
  [k: string]: unknown;
}

export interface ApprovalTask {
  id: string;
  status: string;
  reason?: string | null;
  comment?: string | null;
  paymentIntent?: PaymentIntent | null;
  payment_intent?: PaymentIntent | null;
  agent?: Agent | null;
  policy?: Policy | null;
  createdAt?: string;
  [k: string]: unknown;
}

export interface Transaction {
  id: string;
  amountPaise?: Paise;
  status?: string;
  merchant?: string;
  createdAt?: string;
  [k: string]: unknown;
}

export interface AuditEvent {
  id: string;
  type?: string;
  eventType?: string;
  actor?: string;
  createdAt?: string;
  [k: string]: unknown;
}

export interface Overview {
  totals?: Record<string, unknown>;
  counts?: Record<string, unknown>;
  [k: string]: unknown;
}

/* ---------- request inputs ---------- */

export interface SignupInput {
  name: string;
  email: string;
  companyName: string;
  password: string;
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  owner?: string;
  environment?: string;
  purpose?: string;
}

export interface CreatePolicyInput {
  agentId: string;
  name: string;
  description?: string;
  /** Nested config object (preferred). */
  config?: PolicyConfig;
  /** Flat dashboard fields merged into config (e.g. merchantAllowlist, maxAmountPaise). */
  [flat: string]: unknown;
}

export interface CreateIntentInput {
  agentId?: string;
  amountPaise: number;
  merchant: string;
  purpose?: string;
  description?: string;
  currency?: string;
  metadata?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface WebhookTestInput {
  payment_id: string;
  event_type: string;
}
