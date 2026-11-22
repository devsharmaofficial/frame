import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { assessRisk, type RiskAssessInput } from "../src/modules/risk/signals.js";

const { Pool } = pg;

// ---------- Pure unit tests (no DB required) ----------

function baseRiskInput(overrides: Partial<RiskAssessInput> = {}): RiskAssessInput {
  return {
    amountPaise: 100,
    merchant: "test-merchant",
    hourOfDay: 12,
    daySpendPaise: 0,
    monthSpendPaise: 0,
    paymentsLastHour: 0,
    paymentsLastDay: 0,
    agentHistory: { count: 0, totalPaise: 0, avgPaise: 0, merchants: [], failuresLast24h: 0 },
    isFirstSeenMerchant: false,
    approvalThresholdPaise: null,
    dailyLimitPaise: null,
    ...overrides,
  };
}

describe("Risk signals (pure)", () => {
  it("LOW when nothing triggers", () => {
    const r = assessRisk(baseRiskInput());
    assert.equal(r.score, 0);
    assert.equal(r.level, "LOW");
    assert.equal(r.signals.length, 6);
    assert.ok(r.signals.every((s) => s.triggered === false));
  });

  it("returns every signal with triggered + detail", () => {
    const r = assessRisk(baseRiskInput());
    const names = r.signals.map((s) => s.name).sort();
    assert.deepEqual(names, [
      "amount_spike",
      "large_vs_daily_budget",
      "new_merchant",
      "off_hours",
      "repeated_failures",
      "velocity_burst",
    ]);
    for (const s of r.signals) {
      assert.equal(typeof s.triggered, "boolean");
      assert.equal(typeof s.detail, "string");
      assert.ok(s.detail.length > 0);
    }
  });

  it("amount_spike triggers above 3x avg (+30)", () => {
    const r = assessRisk(
      baseRiskInput({
        amountPaise: 301,
        agentHistory: { count: 4, totalPaise: 400, avgPaise: 100, merchants: ["m"], failuresLast24h: 0 },
      }),
    );
    const sig = r.signals.find((s) => s.name === "amount_spike")!;
    assert.equal(sig.triggered, true);
    assert.equal(r.score, 30);
    assert.equal(r.level, "MEDIUM");
  });

  it("amount_spike skips at exactly 3x avg and with no baseline", () => {
    const atBoundary = assessRisk(
      baseRiskInput({
        amountPaise: 300,
        agentHistory: { count: 4, totalPaise: 400, avgPaise: 100, merchants: ["m"], failuresLast24h: 0 },
      }),
    );
    assert.equal(atBoundary.signals.find((s) => s.name === "amount_spike")!.triggered, false);

    const noBaseline = assessRisk(baseRiskInput({ amountPaise: 999999 }));
    assert.equal(noBaseline.signals.find((s) => s.name === "amount_spike")!.triggered, false);
  });

  it("new_merchant triggers on first-seen + above threshold (+20)", () => {
    const r = assessRisk(
      baseRiskInput({ amountPaise: 600, isFirstSeenMerchant: true, approvalThresholdPaise: 500 }),
    );
    assert.equal(r.signals.find((s) => s.name === "new_merchant")!.triggered, true);
    assert.equal(r.score, 20);
    assert.equal(r.level, "LOW");
  });

  it("new_merchant skips for known merchant or without threshold", () => {
    const known = assessRisk(
      baseRiskInput({ amountPaise: 600, isFirstSeenMerchant: false, approvalThresholdPaise: 500 }),
    );
    assert.equal(known.signals.find((s) => s.name === "new_merchant")!.triggered, false);

    const noThreshold = assessRisk(baseRiskInput({ amountPaise: 600, isFirstSeenMerchant: true }));
    assert.equal(noThreshold.signals.find((s) => s.name === "new_merchant")!.triggered, false);
  });

  it("repeated_failures triggers at >= 3 (+25)", () => {
    const r = assessRisk(
      baseRiskInput({
        agentHistory: { count: 1, totalPaise: 100, avgPaise: 100, merchants: ["m"], failuresLast24h: 3 },
      }),
    );
    assert.equal(r.signals.find((s) => s.name === "repeated_failures")!.triggered, true);
    assert.equal(r.score, 25);

    const below = assessRisk(
      baseRiskInput({
        agentHistory: { count: 1, totalPaise: 100, avgPaise: 100, merchants: ["m"], failuresLast24h: 2 },
      }),
    );
    assert.equal(below.signals.find((s) => s.name === "repeated_failures")!.triggered, false);
  });

  it("velocity_burst triggers at >= 5 payments/hour (+15)", () => {
    const r = assessRisk(baseRiskInput({ paymentsLastHour: 5 }));
    assert.equal(r.signals.find((s) => s.name === "velocity_burst")!.triggered, true);
    assert.equal(r.score, 15);

    const below = assessRisk(baseRiskInput({ paymentsLastHour: 4 }));
    assert.equal(below.signals.find((s) => s.name === "velocity_burst")!.triggered, false);
  });

  it("off_hours triggers for UTC hour 0-4 (+10)", () => {
    for (const h of [0, 2, 4]) {
      const r = assessRisk(baseRiskInput({ hourOfDay: h }));
      assert.equal(r.signals.find((s) => s.name === "off_hours")!.triggered, true, `hour ${h}`);
    }
    for (const h of [5, 12, 23]) {
      const r = assessRisk(baseRiskInput({ hourOfDay: h }));
      assert.equal(r.signals.find((s) => s.name === "off_hours")!.triggered, false, `hour ${h}`);
    }
  });

  it("large_vs_daily_budget triggers above 50% of daily limit (+10)", () => {
    const r = assessRisk(baseRiskInput({ amountPaise: 5001, dailyLimitPaise: 10000 }));
    assert.equal(r.signals.find((s) => s.name === "large_vs_daily_budget")!.triggered, true);
    assert.equal(r.score, 10);

    const below = assessRisk(baseRiskInput({ amountPaise: 5000, dailyLimitPaise: 10000 }));
    assert.equal(below.signals.find((s) => s.name === "large_vs_daily_budget")!.triggered, false);
  });

  it("score bands: 29 LOW, 30 MEDIUM, 59 MEDIUM, 60 HIGH", () => {
    // 25 (failures) + 10 (off_hours) = 35 MEDIUM baseline check via 29:
    // failures(25) alone -> LOW; failures + off_hours(35) -> MEDIUM
    const low = assessRisk(
      baseRiskInput({
        agentHistory: { count: 0, totalPaise: 0, avgPaise: 0, merchants: [], failuresLast24h: 3 },
        hourOfDay: 12,
      }),
    );
    assert.equal(low.score, 25);
    assert.equal(low.level, "LOW");

    const medium30 = assessRisk(
      baseRiskInput({
        amountPaise: 301,
        agentHistory: { count: 4, totalPaise: 400, avgPaise: 100, merchants: ["m"], failuresLast24h: 0 },
      }),
    );
    assert.equal(medium30.score, 30);
    assert.equal(medium30.level, "MEDIUM");

    // 30 (spike) + 25 (failures) = 55 MEDIUM; + off_hours 10 = 65 HIGH
    const medium55 = assessRisk(
      baseRiskInput({
        amountPaise: 301,
        hourOfDay: 12,
        agentHistory: { count: 4, totalPaise: 400, avgPaise: 100, merchants: ["m"], failuresLast24h: 3 },
      }),
    );
    assert.equal(medium55.score, 55);
    assert.equal(medium55.level, "MEDIUM");

    const high = assessRisk(
      baseRiskInput({
        amountPaise: 301,
        hourOfDay: 2,
        agentHistory: { count: 4, totalPaise: 400, avgPaise: 100, merchants: ["m"], failuresLast24h: 3 },
      }),
    );
    assert.equal(high.score, 65);
    assert.equal(high.level, "HIGH");
  });

  it("score caps at 100", () => {
    const r = assessRisk(
      baseRiskInput({
        amountPaise: 100000,
        merchant: "brand-new",
        hourOfDay: 1,
        paymentsLastHour: 9,
        dailyLimitPaise: 1000,
        isFirstSeenMerchant: true,
        approvalThresholdPaise: 500,
        agentHistory: { count: 10, totalPaise: 1000, avgPaise: 100, merchants: ["old"], failuresLast24h: 9 },
      }),
    );
    // 30+20+25+15+10+10 = 110 -> capped
    assert.equal(r.score, 100);
    assert.equal(r.level, "HIGH");
  });

  it("deterministic: same input -> same output", () => {
    const input = baseRiskInput({
      amountPaise: 5000,
      hourOfDay: 3,
      paymentsLastHour: 6,
      isFirstSeenMerchant: true,
      approvalThresholdPaise: 1000,
      dailyLimitPaise: 8000,
      agentHistory: { count: 5, totalPaise: 1000, avgPaise: 200, merchants: ["a", "b"], failuresLast24h: 4 },
    });
    const a = assessRisk(input);
    const b = assessRisk(JSON.parse(JSON.stringify(input)) as RiskAssessInput);
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });
});

// ---------- Integration tests (DB-gated, same pattern as api.test.ts) ----------

let app: Awaited<ReturnType<typeof buildApp>> | null = null;
let pool: pg.Pool | null = null;

async function resolveCanRun(): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("DATABASE_URL not set, skipping risk integration tests");
    return false;
  }
  try {
    const probe = new Pool({ connectionString: dbUrl });
    await probe.query("SELECT 1");
    await probe.end();
    return true;
  } catch (err) {
    console.log("Cannot connect to database, skipping risk integration tests:", (err as Error).message);
    return false;
  }
}

const canRun = await resolveCanRun();

before(async () => {
  if (!canRun) return;
  pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const tables = [
    "webhook_deliveries", "ledger_entries", "audit_events",
    "provider_events", "payment_attempts", "payments",
    "approval_tasks", "payment_decisions", "payment_intents",
    "policy_versions", "policies", "agent_credentials", "agents",
    "users", "organizations", "idempotency_keys",
  ];
  await pool.query(`TRUNCATE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
  app = await buildApp();
  await app.ready();
});

after(async () => {
  if (app) await app.close();
  if (pool) await pool.end();
});

describe("Risk integration", { skip: !canRun ? "Database not available" : undefined }, () => {
  let userToken: string;
  let orgId: string;
  let agentId: string;
  let agentKey: string;
  let policyId: string;
  let firstIntentId: string;
  let firstRisk: unknown;

  const uniq = () => `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

  async function createIntent(amountPaise: number, merchant: string) {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/payment-intents",
      headers: { authorization: `Bearer ${agentKey}`, "idempotency-key": `risk-${uniq()}` },
      payload: { amountPaise, merchant },
    });
    assert.equal(res.statusCode, 201);
    return JSON.parse(res.payload) as Record<string, any>;
  }

  it("setup: signup, agent, permissive policy", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        name: "Risk Tester",
        email: `risk-${uniq()}@example.com`,
        companyName: "Risk Co",
        password: "securePassword123",
      },
    });
    assert.equal(res.statusCode, 201);
    userToken = JSON.parse(res.payload).token;

    const me = JSON.parse(
      (
        await app!.inject({
          method: "GET",
          url: "/api/v1/auth/me",
          headers: { authorization: `Bearer ${userToken}` },
        })
      ).payload,
    );
    orgId = me.user.organizationId;
    assert.ok(orgId);

    const agentRes = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: "Risk Agent" },
    });
    assert.equal(agentRes.statusCode, 201);
    agentId = JSON.parse(agentRes.payload).agent.id;
    agentKey = JSON.parse(agentRes.payload).credential.key;

    const policyRes = await app!.inject({
      method: "POST",
      url: "/api/v1/policies",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { agentId, name: "Risk Policy", config: {} },
    });
    assert.equal(policyRes.statusCode, 201);
    policyId = JSON.parse(policyRes.payload).policy.id;
  });

  it("create intent returns risk object with level + signals", async () => {
    const body = await createIntent(100, "risk-merchant-a");
    assert.equal(body.decision, "ALLOW");
    assert.ok(body.risk, "create response carries risk");
    assert.ok(["LOW", "MEDIUM", "HIGH"].includes(body.risk.level));
    assert.equal(typeof body.risk.score, "number");
    assert.ok(Array.isArray(body.risk.signals));
    assert.equal(body.risk.signals.length, 6);
    firstIntentId = body.id;
    firstRisk = body.risk;
  });

  it("idempotent replay returns the same cached risk", async () => {
    const key = `risk-replay-${uniq()}`;
    const mk = () =>
      app!.inject({
        method: "POST",
        url: "/api/v1/payment-intents",
        headers: { authorization: `Bearer ${agentKey}`, "idempotency-key": key },
        payload: { amountPaise: 120, merchant: "risk-replay-merchant" },
      });
    const r1 = JSON.parse((await mk()).payload) as Record<string, any>;
    const r2Res = await mk();
    assert.equal(r2Res.statusCode, 200);
    const r2 = JSON.parse(r2Res.payload) as Record<string, any>;
    assert.deepEqual(r2.risk, r1.risk);
  });

  it("GET /risk/:intentId returns the stored risk", async () => {
    const res = await app!.inject({
      method: "GET",
      url: `/api/v1/risk/${firstIntentId}`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.intentId, firstIntentId);
    assert.deepEqual(body.risk, firstRisk);
  });

  it("GET /risk/:intentId returns 404 RISK_NOT_FOUND for legacy intents", async () => {
    const inserted = await pool!.query(
      `INSERT INTO payment_intents
         (organization_id, agent_id, amount_paise, currency, merchant, status, decision, idempotency_key, expires_at)
       VALUES ($1, $2, 500, 'INR', 'legacy-merchant', 'AUTHORIZED', 'ALLOW', $3, now() + interval '1 day')
       RETURNING id`,
      [orgId, agentId, `legacy-${uniq()}`],
    );
    const legacyId = inserted.rows[0].id as string;

    const res = await app!.inject({
      method: "GET",
      url: `/api/v1/risk/${legacyId}`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(res.statusCode, 404);
    assert.equal(JSON.parse(res.payload).error.code, "RISK_NOT_FOUND");
  });

  it("HIGH-risk ALLOW still ALLOWs but emits high_risk_allowed notification", async () => {
    // Phase 1: strict tx limit -> 3 DENIED intents (failuresLast24h = 3).
    await app!.inject({
      method: "PATCH",
      url: `/api/v1/policies/${policyId}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { config: { transactionLimitPaise: 100 } },
    });
    for (let i = 0; i < 3; i++) {
      const denied = await createIntent(5000, `risk-fail-${i}`);
      assert.equal(denied.decision, "DENY");
    }

    // Phase 2: generous daily limit, no threshold -> ALLOW; build avg ~100.
    await app!.inject({
      method: "PATCH",
      url: `/api/v1/policies/${policyId}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { config: { dailyLimitPaise: 100000 } },
    });
    await createIntent(100, "risk-baseline");
    await createIntent(100, "risk-baseline");

    // Phase 3: 60000 paise = spike(30) + failures(25) + large_vs_daily(10) = 65 HIGH,
    // daySpend(~200-400) + 60000 < 100000 so policy still ALLOWs.
    const high = await createIntent(60000, "risk-baseline");
    assert.equal(high.decision, "ALLOW", "risk must never override the policy decision");
    assert.equal(high.risk.level, "HIGH");
    assert.ok(high.risk.score >= 60);

    const audit = await pool!.query(
      `SELECT action, entity_after FROM audit_events
       WHERE organization_id = $1 AND action = 'notification.high_risk_allowed' AND resource_id = $2`,
      [orgId, high.id],
    );
    assert.equal(audit.rows.length, 1, "high_risk_allowed notification audit present");
    const payload = audit.rows[0].entity_after as Record<string, any>;
    assert.equal(payload.intentId, high.id);
    assert.equal(payload.merchant, "risk-baseline");
    assert.equal(payload.amountPaise, 60000);
    assert.equal(payload.score, high.risk.score);
  });

  it("GET /risk/:intentId requires auth", async () => {
    const res = await app!.inject({ method: "GET", url: `/api/v1/risk/${firstIntentId}` });
    assert.equal(res.statusCode, 401);
  });
});
