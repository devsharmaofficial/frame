// Deterministic, advisory risk signals for payment intents.
//
// ADVISORY ONLY: LLMs never decide payments. This module produces signals;
// the policy firewall decision (ALLOW/DENY/REQUIRE_APPROVAL from
// src/modules/policies/evaluator.ts) is NEVER overridden by risk output.
//
// Pure functions, zero DB access — all history must be passed in by the
// caller (see createPaymentIntent in paymentIntents/service.ts).
//
// Weights (additive, capped at 100):
//   amount_spike (+30, HIGH): amount > 3x agent historical avg. Needs
//     count > 0 and avg > 0 otherwise there is no baseline to compare.
//   new_merchant (+20): first-seen merchant AND amount > approvalThresholdPaise.
//     Threshold is advisory context here, not a decision.
//   repeated_failures (+25): >= 3 DENIED/FAILED intents in last 24h.
//   velocity_burst (+15): paymentsLastHour >= 5.
//   off_hours (+10): UTC hour 0-4 inclusive.
//   large_vs_daily_budget (+10): dailyLimitPaise set and amount > 50% of it.
//
// Score bands: <30 LOW, 30-59 MEDIUM, >=60 HIGH.

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface AgentRiskHistory {
  count: number;
  totalPaise: number;
  avgPaise: number;
  merchants: string[];
  failuresLast24h: number;
}

export interface RiskAssessInput {
  amountPaise: number;
  merchant: string;
  category?: string;
  /** UTC hour of day, 0-23. */
  hourOfDay: number;
  daySpendPaise: number;
  monthSpendPaise: number;
  paymentsLastHour: number;
  paymentsLastDay: number;
  agentHistory: AgentRiskHistory;
  isFirstSeenMerchant: boolean;
  /** Advisory context only — never a decision. Null/undefined disables new_merchant. */
  approvalThresholdPaise?: number | null;
  /** Advisory context only. Null/undefined disables large_vs_daily_budget. */
  dailyLimitPaise?: number | null;
}

export interface RiskSignal {
  name: string;
  triggered: boolean;
  detail: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  signals: RiskSignal[];
}

const SIGNAL_NAMES = [
  "amount_spike",
  "new_merchant",
  "repeated_failures",
  "velocity_burst",
  "off_hours",
  "large_vs_daily_budget",
] as const;

export function assessRisk(input: RiskAssessInput): RiskAssessment {
  const signals: RiskSignal[] = [];
  let score = 0;

  // amount_spike (+30): amount > 3x agent historical average.
  const avg = input.agentHistory.avgPaise;
  if (input.agentHistory.count > 0 && avg > 0 && input.amountPaise > 3 * avg) {
    score += 30;
    signals.push({
      name: "amount_spike",
      triggered: true,
      detail: `Amount ${input.amountPaise} exceeds 3x agent avg ${avg}`,
    });
  } else {
    signals.push({
      name: "amount_spike",
      triggered: false,
      detail:
        input.agentHistory.count === 0 || avg <= 0
          ? "No agent spend baseline yet"
          : `Amount ${input.amountPaise} within 3x agent avg ${avg}`,
    });
  }

  // new_merchant (+20): first-seen merchant + amount above approval-threshold-ish level.
  const threshold = input.approvalThresholdPaise;
  if (input.isFirstSeenMerchant && threshold != null && threshold > 0 && input.amountPaise > threshold) {
    score += 20;
    signals.push({
      name: "new_merchant",
      triggered: true,
      detail: `First-seen merchant "${input.merchant}" with amount ${input.amountPaise} above threshold ${threshold}`,
    });
  } else {
    signals.push({
      name: "new_merchant",
      triggered: false,
      detail: !input.isFirstSeenMerchant
        ? `Merchant "${input.merchant}" seen before`
        : threshold == null || threshold <= 0
          ? "No approval threshold configured"
          : `Amount ${input.amountPaise} within threshold ${threshold}`,
    });
  }

  // repeated_failures (+25): >= 3 failures in last 24h.
  if (input.agentHistory.failuresLast24h >= 3) {
    score += 25;
    signals.push({
      name: "repeated_failures",
      triggered: true,
      detail: `${input.agentHistory.failuresLast24h} failures in last 24h`,
    });
  } else {
    signals.push({
      name: "repeated_failures",
      triggered: false,
      detail: `${input.agentHistory.failuresLast24h} failures in last 24h`,
    });
  }

  // velocity_burst (+15): >= 5 payments in the last hour.
  if (input.paymentsLastHour >= 5) {
    score += 15;
    signals.push({
      name: "velocity_burst",
      triggered: true,
      detail: `${input.paymentsLastHour} payments in last hour`,
    });
  } else {
    signals.push({
      name: "velocity_burst",
      triggered: false,
      detail: `${input.paymentsLastHour} payments in last hour`,
    });
  }

  // off_hours (+10): UTC hour 0-4 inclusive.
  if (input.hourOfDay >= 0 && input.hourOfDay <= 4) {
    score += 10;
    signals.push({
      name: "off_hours",
      triggered: true,
      detail: `UTC hour ${input.hourOfDay} is off-hours (0-4)`,
    });
  } else {
    signals.push({
      name: "off_hours",
      triggered: false,
      detail: `UTC hour ${input.hourOfDay} is not off-hours`,
    });
  }

  // large_vs_daily_budget (+10): amount > 50% of daily limit.
  const dailyLimit = input.dailyLimitPaise;
  if (dailyLimit != null && dailyLimit > 0 && input.amountPaise > dailyLimit * 0.5) {
    score += 10;
    signals.push({
      name: "large_vs_daily_budget",
      triggered: true,
      detail: `Amount ${input.amountPaise} exceeds 50% of daily limit ${dailyLimit}`,
    });
  } else {
    signals.push({
      name: "large_vs_daily_budget",
      triggered: false,
      detail:
        dailyLimit == null || dailyLimit <= 0
          ? "No daily limit configured"
          : `Amount ${input.amountPaise} within 50% of daily limit ${dailyLimit}`,
    });
  }

  if (score > 100) score = 100;

  const level: RiskLevel = score < 30 ? "LOW" : score < 60 ? "MEDIUM" : "HIGH";

  // Defensive: always return every signal in stable order.
  signals.sort(
    (a, b) => SIGNAL_NAMES.indexOf(a.name as (typeof SIGNAL_NAMES)[number]) - SIGNAL_NAMES.indexOf(b.name as (typeof SIGNAL_NAMES)[number]),
  );

  return { level, score, signals };
}
