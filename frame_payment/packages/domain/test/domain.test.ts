import { describe, expect, it } from "vitest";
import {
  AppendOnlyAuditLog,
  PaymentIntentService,
  evaluatePolicy,
  paise,
  type Agent,
  type PaymentRequest,
  type PolicyVersion,
  type SpendSnapshot,
} from "../src/index.js";

const now = new Date("2026-09-10T12:00:00.000Z");
const activeAgent: Agent = { id: "agent_1", organizationId: "org_1", status: "ACTIVE" };
const basePolicy: PolicyVersion = {
  id: "policy_v3",
  policyId: "policy",
  version: 3,
  organizationId: "org_1",
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
  transactionLimitPaise: paise(100_000),
  dailyLimitPaise: paise(500_000),
  monthlyLimitPaise: paise(2_000_000),
  merchantAllowlist: ["AWS"],
};
const baseSpend: SpendSnapshot = {
  dailySpentPaise: paise(0),
  monthlySpentPaise: paise(0),
  paymentsThisHour: 0,
  paymentsToday: 0,
};

function request(overrides: Partial<PaymentRequest> = {}): PaymentRequest {
  return {
    organizationId: "org_1",
    agentId: "agent_1",
    amountPaise: paise(10_000),
    currency: "INR",
    merchant: "AWS",
    purpose: "production infrastructure",
    expiresAt: new Date("2026-09-10T13:00:00.000Z"),
    idempotencyKey: "idem_1",
    ...overrides,
  };
}

function decision(
  policy: PolicyVersion = basePolicy,
  agent: Agent = activeAgent,
  payment: PaymentRequest = request(),
  spend: SpendSnapshot = baseSpend,
) {
  return evaluatePolicy({ agent, policy, request: payment, spend, now });
}

describe("Framer policy firewall", () => {
  it("allows a valid payment", () => expect(decision().decision).toBe("ALLOW"));
  it("denies a transaction over its limit", () =>
    expect(decision(basePolicy, activeAgent, request({ amountPaise: paise(100_001) })).decision).toBe("DENY"));
  it("denies when the daily budget would be exceeded", () =>
    expect(decision(basePolicy, activeAgent, request({ amountPaise: paise(50_001) }), { ...baseSpend, dailySpentPaise: paise(450_000) }).reasons).toContain("DAILY_LIMIT_EXCEEDED"));
  it("denies a blocked merchant", () =>
    expect(decision({ ...basePolicy, merchantBlocklist: ["AWS"] }).reasons).toContain("MERCHANT_BLOCKED"));
  it("requires approval over the configured threshold", () =>
    expect(decision({ ...basePolicy, approvalThresholdPaise: paise(5_000) }).decision).toBe("REQUIRE_APPROVAL"));
  it("denies an expired policy", () =>
    expect(decision({ ...basePolicy, expiresAt: new Date("2026-09-10T11:59:59.000Z") }).reasons).toContain("POLICY_EXPIRED"));
  it("denies a disabled agent", () =>
    expect(decision(basePolicy, { ...activeAgent, status: "DISABLED" }).reasons).toContain("AGENT_DISABLED"));
  it("returns the same intent for a duplicate idempotency request", () => {
    const service = new PaymentIntentService();
    const input = { id: "pi_1", agent: activeAgent, policy: basePolicy, request: request(), spend: baseSpend, now, requestId: "req_1" };
    const first = service.create(input);
    const duplicate = service.create({ ...input, id: "pi_2", requestId: "req_2" });
    expect(duplicate).toBe(first);
    expect(service.getAuditLog().all()).toHaveLength(1);
  });
  it("rejects reuse of an idempotency key for different parameters", () => {
    const service = new PaymentIntentService();
    const input = { id: "pi_1", agent: activeAgent, policy: basePolicy, request: request(), spend: baseSpend, now, requestId: "req_1" };
    service.create(input);
    expect(() => service.create({ ...input, request: request({ amountPaise: paise(11_000) }) })).toThrow("IDEMPOTENCY_KEY_REUSED");
  });
});

describe("Framer payment intents and audit", () => {
  it("enforces explicit state transitions and retains the policy snapshot", () => {
    const audit = new AppendOnlyAuditLog();
    const service = new PaymentIntentService(audit);
    const intent = service.create({ id: "pi_1", agent: activeAgent, policy: basePolicy, request: request(), spend: baseSpend, now, requestId: "req_1" });
    expect(intent.status).toBe("AUTHORIZED");
    expect(service.transition(intent, "EXECUTING", now, "provider submission").status).toBe("EXECUTING");
    expect(intent.policyVersion.version).toBe(3);
    expect(() => service.transition(intent, "SUCCEEDED", now, "skip execution")).toThrow("INVALID_PAYMENT_INTENT_TRANSITION");
    const events = audit.all();
    expect(events[0].policyVersionId).toBe("policy_v3");
    expect(events[0].eventHash).toBeTruthy();
  });
});
