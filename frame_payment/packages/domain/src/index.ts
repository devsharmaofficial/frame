import { createHash } from "node:crypto";

export type Paise = number & { readonly __brand: "FramerPaise" };
export type Currency = "INR";

export function paise(value: number): Paise {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Money must be a non-negative safe integer number of paise");
  }
  return value as Paise;
}

export function rupeesToPaise(rupees: number): Paise {
  if (!Number.isFinite(rupees) || rupees < 0 || !Number.isInteger(rupees * 100)) {
    throw new Error("Rupees must convert to an exact non-negative paise amount");
  }
  return paise(Math.round(rupees * 100));
}

export type Agent = {
  id: string;
  organizationId: string;
  status: "ACTIVE" | "DISABLED";
  expiresAt?: Date;
};

export type PolicyVersion = {
  id: string;
  policyId: string;
  version: number;
  organizationId: string;
  validFrom: Date;
  expiresAt?: Date;
  transactionLimitPaise?: Paise;
  dailyLimitPaise?: Paise;
  monthlyLimitPaise?: Paise;
  approvalThresholdPaise?: Paise;
  merchantAllowlist?: readonly string[];
  merchantBlocklist?: readonly string[];
  maxPaymentsPerHour?: number;
  maxPaymentsPerDay?: number;
  allowedCategories?: readonly string[];
};

export type PaymentRequest = {
  organizationId: string;
  agentId: string;
  amountPaise: Paise;
  currency: Currency;
  merchant: string;
  purpose: string;
  category?: string;
  expiresAt: Date;
  idempotencyKey: string;
};

export type SpendSnapshot = {
  dailySpentPaise: Paise;
  monthlySpentPaise: Paise;
  paymentsThisHour: number;
  paymentsToday: number;
};

export type PolicyDecision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";
export type DecisionReason =
  | "AGENT_DISABLED"
  | "AGENT_EXPIRED"
  | "POLICY_NOT_YET_ACTIVE"
  | "POLICY_EXPIRED"
  | "ORGANIZATION_MISMATCH"
  | "MISSING_PURPOSE"
  | "INVALID_EXPIRY"
  | "TRANSACTION_LIMIT_EXCEEDED"
  | "DAILY_LIMIT_EXCEEDED"
  | "MONTHLY_LIMIT_EXCEEDED"
  | "MERCHANT_BLOCKED"
  | "MERCHANT_NOT_ALLOWLISTED"
  | "CATEGORY_NOT_ALLOWED"
  | "HOURLY_FREQUENCY_EXCEEDED"
  | "DAILY_FREQUENCY_EXCEEDED"
  | "APPROVAL_THRESHOLD_EXCEEDED";

export type PolicyEvaluation = {
  decision: PolicyDecision;
  reasons: readonly DecisionReason[];
  policyVersionId: string;
};

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function dateAtOrAfter(value: Date, boundary: Date): boolean {
  return value.getTime() >= boundary.getTime();
}

export function evaluatePolicy(input: {
  agent: Agent;
  policy: PolicyVersion;
  request: Omit<PaymentRequest, "idempotencyKey">;
  spend: SpendSnapshot;
  now: Date;
}): PolicyEvaluation {
  const { agent, policy, request, spend, now } = input;
  const reasons: DecisionReason[] = [];
  const merchant = normalized(request.merchant);
  const blocklist = new Set((policy.merchantBlocklist ?? []).map(normalized));
  const allowlist = new Set((policy.merchantAllowlist ?? []).map(normalized));
  const category = request.category ? normalized(request.category) : undefined;

  if (agent.status === "DISABLED") reasons.push("AGENT_DISABLED");
  else if (agent.expiresAt && dateAtOrAfter(now, agent.expiresAt)) reasons.push("AGENT_EXPIRED");
  if (
    agent.id !== request.agentId ||
    agent.organizationId !== request.organizationId ||
    policy.organizationId !== request.organizationId
  ) {
    reasons.push("ORGANIZATION_MISMATCH");
  }
  if (!dateAtOrAfter(now, policy.validFrom)) reasons.push("POLICY_NOT_YET_ACTIVE");
  if (policy.expiresAt && dateAtOrAfter(now, policy.expiresAt)) reasons.push("POLICY_EXPIRED");
  if (!request.purpose.trim()) reasons.push("MISSING_PURPOSE");
  if (request.expiresAt.getTime() <= now.getTime()) reasons.push("INVALID_EXPIRY");
  if (policy.transactionLimitPaise !== undefined && request.amountPaise > policy.transactionLimitPaise) {
    reasons.push("TRANSACTION_LIMIT_EXCEEDED");
  }
  if (policy.dailyLimitPaise !== undefined && spend.dailySpentPaise + request.amountPaise > policy.dailyLimitPaise) {
    reasons.push("DAILY_LIMIT_EXCEEDED");
  }
  if (
    policy.monthlyLimitPaise !== undefined &&
    spend.monthlySpentPaise + request.amountPaise > policy.monthlyLimitPaise
  ) {
    reasons.push("MONTHLY_LIMIT_EXCEEDED");
  }
  if (blocklist.has(merchant)) reasons.push("MERCHANT_BLOCKED");
  else if (allowlist.size > 0 && !allowlist.has(merchant)) reasons.push("MERCHANT_NOT_ALLOWLISTED");
  if (policy.allowedCategories && (!category || !policy.allowedCategories.map(normalized).includes(category))) {
    reasons.push("CATEGORY_NOT_ALLOWED");
  }
  if (policy.maxPaymentsPerHour !== undefined && spend.paymentsThisHour >= policy.maxPaymentsPerHour) {
    reasons.push("HOURLY_FREQUENCY_EXCEEDED");
  }
  if (policy.maxPaymentsPerDay !== undefined && spend.paymentsToday >= policy.maxPaymentsPerDay) {
    reasons.push("DAILY_FREQUENCY_EXCEEDED");
  }

  if (reasons.length > 0) {
    return { decision: "DENY", reasons, policyVersionId: policy.id };
  }
  if (policy.approvalThresholdPaise !== undefined && request.amountPaise > policy.approvalThresholdPaise) {
    return {
      decision: "REQUIRE_APPROVAL",
      reasons: ["APPROVAL_THRESHOLD_EXCEEDED"],
      policyVersionId: policy.id,
    };
  }
  return { decision: "ALLOW", reasons: [], policyVersionId: policy.id };
}

export type PaymentIntentStatus =
  | "CREATED"
  | "EVALUATING"
  | "DENIED"
  | "PENDING_APPROVAL"
  | "REJECTED"
  | "APPROVED"
  | "AUTHORIZED"
  | "EXECUTING"
  | "FAILED"
  | "SUCCEEDED"
  | "EXPIRED";

const terminalStatuses = new Set<PaymentIntentStatus>(["DENIED", "REJECTED", "FAILED", "SUCCEEDED", "EXPIRED"]);
const transitions: Record<PaymentIntentStatus, readonly PaymentIntentStatus[]> = {
  CREATED: ["EVALUATING", "EXPIRED"],
  EVALUATING: ["DENIED", "PENDING_APPROVAL", "AUTHORIZED", "EXPIRED"],
  DENIED: [],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "EXPIRED"],
  REJECTED: [],
  APPROVED: ["AUTHORIZED", "EXPIRED"],
  AUTHORIZED: ["EXECUTING", "EXPIRED"],
  EXECUTING: ["FAILED", "SUCCEEDED"],
  FAILED: [],
  SUCCEEDED: [],
  EXPIRED: [],
};

export type PaymentIntent = {
  id: string;
  request: PaymentRequest;
  policyVersion: PolicyVersion;
  decision: PolicyDecision;
  status: PaymentIntentStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type AuditEvent = {
  id: string;
  organizationId: string;
  actor: { type: "AGENT" | "USER" | "SYSTEM"; id: string };
  requestId: string;
  occurredAt: Date;
  action: string;
  previousState?: string;
  newState?: string;
  reason: string;
  policyVersionId?: string;
  previousHash?: string;
  eventHash: string;
};

export class AppendOnlyAuditLog {
  private readonly events: AuditEvent[] = [];

  append(event: Omit<AuditEvent, "eventHash" | "previousHash">): AuditEvent {
    const previousHash = this.events.at(-1)?.eventHash;
    const payload = JSON.stringify({ ...event, previousHash });
    const eventHash = createHash("sha256").update(payload).digest("hex");
    const stored = Object.freeze({ ...event, previousHash, eventHash });
    this.events.push(stored);
    return stored;
  }

  all(): readonly AuditEvent[] {
    return this.events.slice();
  }
}

function fingerprint(request: Omit<PaymentRequest, "idempotencyKey">): string {
  return JSON.stringify({
    ...request,
    expiresAt: request.expiresAt.toISOString(),
  });
}

export class PaymentIntentService {
  private readonly byIdempotencyKey = new Map<string, { fingerprint: string; intent: PaymentIntent }>();

  constructor(private readonly audit: AppendOnlyAuditLog = new AppendOnlyAuditLog()) {}

  create(input: {
    id: string;
    agent: Agent;
    policy: PolicyVersion;
    request: PaymentRequest;
    spend: SpendSnapshot;
    now: Date;
    requestId: string;
  }): PaymentIntent {
    const { request } = input;
    const key = `${request.organizationId}:${request.idempotencyKey}`;
    const requestFingerprint = fingerprint(request);
    const existing = this.byIdempotencyKey.get(key);
    if (existing) {
      if (existing.fingerprint !== requestFingerprint) throw new Error("IDEMPOTENCY_KEY_REUSED");
      return existing.intent;
    }
    if (request.organizationId !== input.agent.organizationId || request.organizationId !== input.policy.organizationId) {
      throw new Error("ORGANIZATION_MISMATCH");
    }
    const evaluation = evaluatePolicy({
      agent: input.agent,
      policy: input.policy,
      request,
      spend: input.spend,
      now: input.now,
    });
    const policyVersion = Object.freeze({
      ...input.policy,
      merchantAllowlist: input.policy.merchantAllowlist ? Object.freeze([...input.policy.merchantAllowlist]) : undefined,
      merchantBlocklist: input.policy.merchantBlocklist ? Object.freeze([...input.policy.merchantBlocklist]) : undefined,
      allowedCategories: input.policy.allowedCategories ? Object.freeze([...input.policy.allowedCategories]) : undefined,
    });
    const intent: PaymentIntent = {
      id: input.id,
      request: { ...request },
      policyVersion,
      decision: evaluation.decision,
      status: evaluation.decision === "DENY" ? "DENIED" : evaluation.decision === "REQUIRE_APPROVAL" ? "PENDING_APPROVAL" : "AUTHORIZED",
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.byIdempotencyKey.set(key, { fingerprint: requestFingerprint, intent });
    this.audit.append({
      id: `audit_${input.id}`,
      organizationId: request.organizationId,
      actor: { type: "AGENT", id: request.agentId },
      requestId: input.requestId,
      occurredAt: input.now,
      action: "PAYMENT_INTENT_CREATED",
      newState: intent.status,
      reason: evaluation.reasons.join(",") || "POLICY_ALLOWED",
      policyVersionId: input.policy.id,
    });
    return intent;
  }

  transition(intent: PaymentIntent, next: PaymentIntentStatus, at: Date, reason: string): PaymentIntent {
    if (terminalStatuses.has(intent.status) || !transitions[intent.status].includes(next)) {
      throw new Error(`INVALID_PAYMENT_INTENT_TRANSITION:${intent.status}->${next}`);
    }
    const transitioned = { ...intent, status: next, updatedAt: at };
    this.audit.append({
      id: `audit_${intent.id}_${at.getTime()}_${next}`,
      organizationId: intent.request.organizationId,
      actor: { type: "SYSTEM", id: "framer-domain" },
      requestId: intent.id,
      occurredAt: at,
      action: "PAYMENT_INTENT_STATE_CHANGED",
      previousState: intent.status,
      newState: next,
      reason,
      policyVersionId: intent.policyVersion.id,
    });
    return transitioned;
  }

  getAuditLog(): AppendOnlyAuditLog {
    return this.audit;
  }
}
