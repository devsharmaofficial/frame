import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluate, type EvaluatorInput, type PolicyConfig } from "../src/modules/policies/evaluator.js";

function baseInput(overrides: Partial<EvaluatorInput> = {}): EvaluatorInput {
  return {
    agentActive: true,
    config: {},
    amountPaise: 100,
    merchant: "test-merchant",
    category: undefined,
    frequency: { paymentsLastHour: 0, paymentsLastDay: 0 },
    daySpendPaise: 0,
    monthSpendPaise: 0,
    now: new Date("2025-06-15T12:00:00Z"),
    ...overrides,
  };
}

function makeConfig(overrides: Partial<PolicyConfig> = {}): PolicyConfig {
  return { ...overrides };
}

describe("Policy Evaluator", () => {
  it("allows when no restrictions set", () => {
    const result = evaluate(baseInput());
    assert.equal(result.decision, "ALLOW");
    assert.equal(result.reasons.length, 0);
    assert.ok(result.checks.every((c) => c.passed));
  });

  it("denies when agent is inactive", () => {
    const result = evaluate(baseInput({ agentActive: false }));
    assert.equal(result.decision, "DENY");
    assert.ok(result.reasons.some((r) => r.includes("not active")));
    assert.ok(result.checks.find((c) => c.name === "agent_active" && !c.passed));
  });

  it("denies when amount exceeds transaction limit", () => {
    const result = evaluate(
      baseInput({
        amountPaise: 5000,
        config: makeConfig({ transactionLimitPaise: 1000 }),
      }),
    );
    assert.equal(result.decision, "DENY");
    assert.ok(result.reasons.some((r) => r.includes("transaction limit")));
    assert.ok(result.checks.find((c) => c.name === "transaction_limit" && !c.passed));
  });

  it("allows when amount equals transaction limit", () => {
    const result = evaluate(
      baseInput({
        amountPaise: 1000,
        config: makeConfig({ transactionLimitPaise: 1000 }),
      }),
    );
    assert.equal(result.decision, "ALLOW");
  });

  it("denies when merchant not in allowlist", () => {
    const result = evaluate(
      baseInput({
        merchant: "unknown-merchant",
        config: makeConfig({ merchantAllowlist: ["allowed-a", "allowed-b"] }),
      }),
    );
    assert.equal(result.decision, "DENY");
    assert.ok(result.reasons.some((r) => r.includes("not in allowlist")));
  });

  it("allows when merchant is in allowlist", () => {
    const result = evaluate(
      baseInput({
        merchant: "allowed-a",
        config: makeConfig({ merchantAllowlist: ["allowed-a", "allowed-b"] }),
      }),
    );
    assert.equal(result.decision, "ALLOW");
  });

  it("denies when merchant is blocklisted", () => {
    const result = evaluate(
      baseInput({
        merchant: "bad-merchant",
        config: makeConfig({ merchantBlocklist: ["bad-merchant"] }),
      }),
    );
    assert.equal(result.decision, "DENY");
    assert.ok(result.reasons.some((r) => r.includes("blocklisted")));
  });

  it("denies when category is restricted", () => {
    const result = evaluate(
      baseInput({
        category: "gambling",
        config: makeConfig({ categoryRestrictions: ["gambling", "crypto"] }),
      }),
    );
    assert.equal(result.decision, "DENY");
    assert.ok(result.reasons.some((r) => r.includes("restricted")));
  });

  it("requires approval when amount exceeds threshold", () => {
    const result = evaluate(
      baseInput({
        amountPaise: 10000,
        config: makeConfig({ approvalThresholdPaise: 5000 }),
      }),
    );
    assert.equal(result.decision, "REQUIRE_APPROVAL");
    assert.ok(result.reasons.some((r) => r.includes("approval threshold")));
    assert.ok(result.checks.find((c) => c.name === "approval_threshold" && !c.passed));
  });

  it("denies when daily limit exceeded", () => {
    const result = evaluate(
      baseInput({
        amountPaise: 600,
        daySpendPaise: 500,
        config: makeConfig({ dailyLimitPaise: 1000 }),
      }),
    );
    assert.equal(result.decision, "DENY");
    assert.ok(result.reasons.some((r) => r.includes("daily limit")));
  });

  it("denies when monthly limit exceeded", () => {
    const result = evaluate(
      baseInput({
        amountPaise: 1000,
        monthSpendPaise: 9500,
        config: makeConfig({ monthlyLimitPaise: 10000 }),
      }),
    );
    assert.equal(result.decision, "DENY");
    assert.ok(result.reasons.some((r) => r.includes("monthly limit")));
  });

  it("denies when hourly frequency limit reached", () => {
    const result = evaluate(
      baseInput({
        frequency: { paymentsLastHour: 3, paymentsLastDay: 3 },
        config: makeConfig({ maxPaymentsPerHour: 3 }),
      }),
    );
    assert.equal(result.decision, "DENY");
    assert.ok(result.reasons.some((r) => r.includes("frequency")));
    assert.ok(result.checks.find((c) => c.name === "frequency_hour" && !c.passed));
  });

  it("denies when daily frequency limit reached", () => {
    const result = evaluate(
      baseInput({
        frequency: { paymentsLastHour: 0, paymentsLastDay: 10 },
        config: makeConfig({ maxPaymentsPerDay: 10 }),
      }),
    );
    assert.equal(result.decision, "DENY");
    assert.ok(result.checks.find((c) => c.name === "frequency_day" && !c.passed));
  });

  it("denies when policy is expired", () => {
    const result = evaluate(
      baseInput({
        now: new Date("2025-06-15T12:00:00Z"),
        config: makeConfig({ expiresAt: "2025-06-14T00:00:00Z" }),
      }),
    );
    assert.equal(result.decision, "DENY");
    assert.ok(result.reasons.some((r) => r.includes("expired")));
    assert.ok(result.checks.find((c) => c.name === "policy_expired" && !c.passed));
  });

  it("allows when policy has not expired", () => {
    const result = evaluate(
      baseInput({
        now: new Date("2025-06-15T12:00:00Z"),
        config: makeConfig({ expiresAt: "2025-12-31T23:59:59Z" }),
      }),
    );
    assert.equal(result.decision, "ALLOW");
    assert.ok(result.checks.find((c) => c.name === "policy_expired" && c.passed));
  });

  it("allows when daily spend within limit", () => {
    const result = evaluate(
      baseInput({
        amountPaise: 400,
        daySpendPaise: 500,
        config: makeConfig({ dailyLimitPaise: 1000 }),
      }),
    );
    assert.equal(result.decision, "ALLOW");
    assert.ok(result.checks.find((c) => c.name === "daily_limit" && c.passed));
  });

  it("returns all reasons for multiple failures", () => {
    const result = evaluate(
      baseInput({
        agentActive: false,
        amountPaise: 999999,
        merchant: "unknown",
        category: "gambling",
        config: makeConfig({
          transactionLimitPaise: 1000,
          merchantAllowlist: ["only-this"],
          categoryRestrictions: ["gambling"],
        }),
      }),
    );
    assert.equal(result.decision, "DENY");
    assert.ok(result.reasons.length >= 3, `Expected >=3 reasons, got ${result.reasons.length}`);
  });

  it("complex: deny merchant but allow transaction", () => {
    const result = evaluate(
      baseInput({
        amountPaise: 100,
        merchant: "blocked-shop",
        config: makeConfig({ merchantBlocklist: ["blocked-shop"], transactionLimitPaise: 500 }),
      }),
    );
    assert.equal(result.decision, "DENY");
    assert.ok(result.checks.find((c) => c.name === "transaction_limit" && c.passed));
    assert.ok(result.checks.find((c) => c.name === "merchant_blocklist" && !c.passed));
  });
});
