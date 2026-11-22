import { z } from "zod";

export const policyConfigSchema = z
  .object({
    transactionLimitPaise: z.number().int().nonnegative().optional(),
    dailyLimitPaise: z.number().int().nonnegative().optional(),
    monthlyLimitPaise: z.number().int().nonnegative().optional(),
    // canonical evaluator keys
    merchantAllowlist: z.array(z.string()).optional(),
    merchantBlocklist: z.array(z.string()).optional(),
    categoryRestrictions: z.array(z.string()).optional(),
    approvalThresholdPaise: z.number().int().nonnegative().optional(),
    maxPaymentsPerHour: z.number().int().nonnegative().optional(),
    maxPaymentsPerDay: z.number().int().nonnegative().optional(),
    allowedCurrencies: z.array(z.string()).optional(),
    expiresAt: z.string().datetime().optional(),
    // public API / dashboard aliases
    allowedMerchants: z.array(z.string()).optional(),
    blockedMerchants: z.array(z.string()).optional(),
    restrictedCategories: z.array(z.string()).optional(),
  })
  .transform((raw) => ({
    ...raw,
    merchantAllowlist: raw.allowedMerchants ?? raw.merchantAllowlist,
    merchantBlocklist: raw.blockedMerchants ?? raw.merchantBlocklist,
    categoryRestrictions: raw.restrictedCategories ?? raw.categoryRestrictions,
  }));

export type PolicyConfig = z.input<typeof policyConfigSchema>;

export interface EvaluatorInput {
  agentActive: boolean;
  config: PolicyConfig;
  amountPaise: number;
  merchant: string;
  category?: string;
  frequency: {
    paymentsLastHour: number;
    paymentsLastDay: number;
  };
  daySpendPaise: number;
  monthSpendPaise: number;
  now: Date;
}

export interface EvaluatorCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface EvaluatorResult {
  decision: "ALLOW" | "DENY" | "REQUIRE_APPROVAL";
  reasons: string[];
  checks: EvaluatorCheck[];
}

export function evaluate(input: EvaluatorInput): EvaluatorResult {
  const checks: EvaluatorCheck[] = [];
  const reasons: string[] = [];

  // 1. Agent must be active
  if (!input.agentActive) {
    checks.push({ name: "agent_active", passed: false, detail: "Agent is not active" });
    reasons.push("Agent is not active");
  } else {
    checks.push({ name: "agent_active", passed: true, detail: "Agent is active" });
  }

  // 2. Transaction limit
  if (input.config.transactionLimitPaise != null && input.config.transactionLimitPaise > 0) {
    if (input.amountPaise > input.config.transactionLimitPaise) {
      checks.push({
        name: "transaction_limit",
        passed: false,
        detail: `Amount ${input.amountPaise} exceeds limit ${input.config.transactionLimitPaise}`,
      });
      reasons.push(`Amount ${input.amountPaise} exceeds transaction limit ${input.config.transactionLimitPaise}`);
    } else {
      checks.push({ name: "transaction_limit", passed: true, detail: "Within transaction limit" });
    }
  } else {
    checks.push({ name: "transaction_limit", passed: true, detail: "No transaction limit set" });
  }

  // 3. Daily limit
  if (input.config.dailyLimitPaise != null && input.config.dailyLimitPaise > 0) {
    const projected = input.daySpendPaise + input.amountPaise;
    if (projected > input.config.dailyLimitPaise) {
      checks.push({
        name: "daily_limit",
        passed: false,
        detail: `Day spend ${projected} would exceed daily limit ${input.config.dailyLimitPaise}`,
      });
      reasons.push(`Day spend would exceed daily limit ${input.config.dailyLimitPaise}`);
    } else {
      checks.push({ name: "daily_limit", passed: true, detail: "Within daily limit" });
    }
  } else {
    checks.push({ name: "daily_limit", passed: true, detail: "No daily limit set" });
  }

  // 4. Monthly limit
  if (input.config.monthlyLimitPaise != null && input.config.monthlyLimitPaise > 0) {
    const projected = input.monthSpendPaise + input.amountPaise;
    if (projected > input.config.monthlyLimitPaise) {
      checks.push({
        name: "monthly_limit",
        passed: false,
        detail: `Month spend ${projected} would exceed monthly limit ${input.config.monthlyLimitPaise}`,
      });
      reasons.push(`Month spend would exceed monthly limit ${input.config.monthlyLimitPaise}`);
    } else {
      checks.push({ name: "monthly_limit", passed: true, detail: "Within monthly limit" });
    }
  } else {
    checks.push({ name: "monthly_limit", passed: true, detail: "No monthly limit set" });
  }

  // 5. Merchant allowlist
  if (input.config.merchantAllowlist && input.config.merchantAllowlist.length > 0) {
    if (!input.config.merchantAllowlist.includes(input.merchant)) {
      checks.push({
        name: "merchant_allowlist",
        passed: false,
        detail: `Merchant "${input.merchant}" not in allowlist`,
      });
      reasons.push(`Merchant "${input.merchant}" not in allowlist`);
    } else {
      checks.push({ name: "merchant_allowlist", passed: true, detail: "Merchant in allowlist" });
    }
  } else {
    checks.push({ name: "merchant_allowlist", passed: true, detail: "No merchant allowlist set" });
  }

  // 6. Merchant blocklist
  if (input.config.merchantBlocklist && input.config.merchantBlocklist.length > 0) {
    if (input.config.merchantBlocklist.includes(input.merchant)) {
      checks.push({
        name: "merchant_blocklist",
        passed: false,
        detail: `Merchant "${input.merchant}" is blocklisted`,
      });
      reasons.push(`Merchant "${input.merchant}" is blocklisted`);
    } else {
      checks.push({ name: "merchant_blocklist", passed: true, detail: "Merchant not blocklisted" });
    }
  } else {
    checks.push({ name: "merchant_blocklist", passed: true, detail: "No merchant blocklist set" });
  }

  // 7. Category restrictions
  if (input.category && input.config.categoryRestrictions && input.config.categoryRestrictions.length > 0) {
    if (input.config.categoryRestrictions.includes(input.category)) {
      checks.push({
        name: "category_restricted",
        passed: false,
        detail: `Category "${input.category}" is restricted`,
      });
      reasons.push(`Category "${input.category}" is restricted`);
    } else {
      checks.push({ name: "category_restricted", passed: true, detail: "Category not restricted" });
    }
  } else {
    checks.push({ name: "category_restricted", passed: true, detail: "No category restrictions" });
  }

  // 8. Approval threshold
  let requiresApproval = false;
  if (input.config.approvalThresholdPaise != null && input.config.approvalThresholdPaise > 0) {
    if (input.amountPaise > input.config.approvalThresholdPaise) {
      checks.push({
        name: "approval_threshold",
        passed: false,
        detail: `Amount ${input.amountPaise} exceeds approval threshold ${input.config.approvalThresholdPaise}`,
      });
      reasons.push(`Amount exceeds approval threshold ${input.config.approvalThresholdPaise}`);
      requiresApproval = true;
    } else {
      checks.push({ name: "approval_threshold", passed: true, detail: "Below approval threshold" });
    }
  } else {
    checks.push({ name: "approval_threshold", passed: true, detail: "No approval threshold set" });
  }

  // 9. Frequency limits
  if (input.config.maxPaymentsPerHour != null && input.config.maxPaymentsPerHour > 0) {
    if (input.frequency.paymentsLastHour >= input.config.maxPaymentsPerHour) {
      checks.push({
        name: "frequency_hour",
        passed: false,
        detail: `Hourly payments ${input.frequency.paymentsLastHour} >= limit ${input.config.maxPaymentsPerHour}`,
      });
      reasons.push(`Hourly payment frequency limit reached`);
    } else {
      checks.push({ name: "frequency_hour", passed: true, detail: "Within hourly frequency limit" });
    }
  } else {
    checks.push({ name: "frequency_hour", passed: true, detail: "No hourly frequency limit" });
  }

  if (input.config.maxPaymentsPerDay != null && input.config.maxPaymentsPerDay > 0) {
    if (input.frequency.paymentsLastDay >= input.config.maxPaymentsPerDay) {
      checks.push({
        name: "frequency_day",
        passed: false,
        detail: `Daily payments ${input.frequency.paymentsLastDay} >= limit ${input.config.maxPaymentsPerDay}`,
      });
      reasons.push(`Daily payment frequency limit reached`);
    } else {
      checks.push({ name: "frequency_day", passed: true, detail: "Within daily frequency limit" });
    }
  } else {
    checks.push({ name: "frequency_day", passed: true, detail: "No daily frequency limit" });
  }

  // 10. Expiration
  if (input.config.expiresAt) {
    const expiryDate = new Date(input.config.expiresAt);
    if (input.now > expiryDate) {
      checks.push({
        name: "policy_expired",
        passed: false,
        detail: `Policy expired at ${input.config.expiresAt}`,
      });
      reasons.push("Policy has expired");
    } else {
      checks.push({ name: "policy_expired", passed: true, detail: "Policy not expired" });
    }
  } else {
    checks.push({ name: "policy_expired", passed: true, detail: "No expiration set" });
  }

  // Determine final decision
  const hasHardDeny = checks.some((c) => {
    if (!c.passed) {
      const denyChecks = [
        "agent_active", "transaction_limit", "daily_limit", "monthly_limit",
        "merchant_allowlist", "merchant_blocklist", "category_restricted",
        "frequency_hour", "frequency_day", "policy_expired",
      ];
      return denyChecks.includes(c.name);
    }
    return false;
  });

  if (hasHardDeny) {
    return { decision: "DENY", reasons, checks };
  }

  if (requiresApproval) {
    return { decision: "REQUIRE_APPROVAL", reasons, checks };
  }

  return { decision: "ALLOW", reasons, checks };
}
