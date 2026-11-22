import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { buildApp } from "../src/app.js";

const { Pool } = pg;

let app: Awaited<ReturnType<typeof buildApp>> | null = null;
let pool: pg.Pool | null = null;

async function resolveCanRun(): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("DATABASE_URL not set, skipping integration tests");
    return false;
  }
  try {
    const probe = new Pool({ connectionString: dbUrl });
    await probe.query("SELECT 1");
    await probe.end();
    return true;
  } catch (err) {
    console.log("Cannot connect to database, skipping integration tests:", (err as Error).message);
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

/** Insert an AUTHORIZED intent + PENDING payment directly (avoids the 2s auto-succeed timer). */
async function seedStalePayment(
  orgId: string,
  agentId: string,
  opts: { merchant: string; ageMinutes: number; attemptStatus?: string },
): Promise<{ intentId: string; paymentId: string; providerPaymentId: string }> {
  const providerPaymentId = `sandbox_recon_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const intentRes = await pool!.query(
    `INSERT INTO payment_intents
       (organization_id, agent_id, amount_paise, currency, merchant, status, decision, idempotency_key, expires_at)
     VALUES ($1, $2, 500, 'INR', $3, 'AUTHORIZED', 'ALLOW', $4, now() + interval '1 day')
     RETURNING id`,
    [orgId, agentId, opts.merchant, `recon-${providerPaymentId}`],
  );
  const intentId = intentRes.rows[0].id as string;
  const payRes = await pool!.query(
    `INSERT INTO payments
       (organization_id, payment_intent_id, provider, provider_payment_id, amount_paise, currency, status, created_at)
     VALUES ($1, $2, 'sandbox', $3, 500, 'INR', 'PENDING', now() - ($4 || ' minutes')::interval)
     RETURNING id`,
    [orgId, intentId, providerPaymentId, String(opts.ageMinutes)],
  );
  const paymentId = payRes.rows[0].id as string;
  await pool!.query(
    `INSERT INTO payment_attempts (organization_id, payment_id, attempt_number, provider_status)
     VALUES ($1, $2, 1, $3)`,
    [orgId, paymentId, opts.attemptStatus ?? "PENDING"],
  );
  return { intentId, paymentId, providerPaymentId };
}

async function exceptionAuditCount(paymentId: string): Promise<number> {
  const res = await pool!.query(
    `SELECT count(*)::int AS count FROM audit_events
     WHERE action = 'reconciliation.exception' AND resource_id = $1`,
    [paymentId],
  );
  return res.rows[0].count as number;
}

describe("Reconciliation", { skip: !canRun ? "Database not available" : undefined }, () => {
  let userToken: string;
  let userId: string;
  let orgId: string;
  let agentId: string;
  let stalePaymentId: string;

  it("setup: signup, agent, allow-all policy", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        name: "Recon Tester",
        email: `recon-${Date.now()}@example.com`,
        companyName: "Recon Co",
        password: "securePassword123",
      },
    });
    assert.equal(res.statusCode, 201);
    userToken = JSON.parse(res.payload).token;
    userId = JSON.parse(res.payload).user.id;

    const orgRes = await pool!.query(`SELECT organization_id FROM users WHERE id = $1`, [userId]);
    orgId = orgRes.rows[0].organization_id as string;
    assert.ok(orgId);

    const agentRes = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: "Recon Agent" },
    });
    assert.equal(agentRes.statusCode, 201);
    agentId = JSON.parse(agentRes.payload).agent.id;

    const policyRes = await app!.inject({
      method: "POST",
      url: "/api/v1/policies",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { agentId, name: "Recon Policy", config: {} },
    });
    assert.equal(policyRes.statusCode, 201);
  });

  it("POST /reconciliation/run on empty org returns zeros", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/reconciliation/run",
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.checked, 0);
    assert.equal(body.fixed, 0);
    assert.deepEqual(body.exceptions, []);
  });

  it("stale PENDING older than 5 min is flagged STALE_PENDING", async () => {
    const seeded = await seedStalePayment(orgId, agentId, {
      merchant: "stale-merchant",
      ageMinutes: 10,
    });
    stalePaymentId = seeded.paymentId;

    const res = await app!.inject({
      method: "GET",
      url: "/api/v1/reconciliation/exceptions",
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(res.statusCode, 200);
    const list = JSON.parse(res.payload) as Array<{
      paymentId: string;
      intentId: string;
      status: string;
      amountPaise: number;
      currency: string;
      providerPaymentId: string;
      ageMinutes: number;
      issue: string;
    }>;
    const found = list.find((e) => e.paymentId === seeded.paymentId);
    assert.ok(found, "stale payment listed in exceptions");
    assert.equal(found.issue, "STALE_PENDING");
    assert.equal(found.status, "PENDING");
    assert.ok(found.ageMinutes >= 5, `ageMinutes ${found.ageMinutes} >= 5`);
    assert.equal(found.providerPaymentId, seeded.providerPaymentId);
  });

  it("run is idempotent for UNKNOWN provider state under 30 min (no fix, no audit)", async () => {
    const first = await app!.inject({
      method: "POST",
      url: "/api/v1/reconciliation/run",
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(first.statusCode, 200);
    const firstBody = JSON.parse(first.payload);
    assert.ok(firstBody.checked >= 1);
    assert.equal(firstBody.fixed, 0);

    const second = await app!.inject({
      method: "POST",
      url: "/api/v1/reconciliation/run",
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(second.statusCode, 200);
    const secondBody = JSON.parse(second.payload);
    assert.equal(secondBody.fixed, 0);
    assert.equal(secondBody.checked, firstBody.checked);

    const count = await exceptionAuditCount(stalePaymentId);
    assert.equal(count, 0, "no reconciliation.exception audit for <30min UNKNOWN payment");
  });

  it("UNKNOWN payment older than 30 min records reconciliation.exception exactly once", async () => {
    const seeded = await seedStalePayment(orgId, agentId, {
      merchant: "unknown-merchant",
      ageMinutes: 45,
    });

    const run1 = await app!.inject({
      method: "POST",
      url: "/api/v1/reconciliation/run",
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(run1.statusCode, 200);
    const body1 = JSON.parse(run1.payload);
    const ex1 = body1.exceptions.find((e: any) => e.paymentId === seeded.paymentId);
    assert.ok(ex1, "45-min UNKNOWN payment reported as exception");
    assert.equal(await exceptionAuditCount(seeded.paymentId), 1);

    const run2 = await app!.inject({
      method: "POST",
      url: "/api/v1/reconciliation/run",
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(run2.statusCode, 200);
    assert.equal(await exceptionAuditCount(seeded.paymentId), 1, "no duplicate exception audit on repeat run");
    const body2 = JSON.parse(run2.payload);
    assert.equal(body2.fixed, 0);
  });

  it("STATUS_MISMATCH payment is repaired from provider state and run stays idempotent", async () => {
    const seeded = await seedStalePayment(orgId, agentId, {
      merchant: "mismatch-merchant",
      ageMinutes: 10,
      attemptStatus: "SUCCEEDED",
    });

    const listRes = await app!.inject({
      method: "GET",
      url: "/api/v1/reconciliation/exceptions",
      headers: { authorization: `Bearer ${userToken}` },
    });
    const list = JSON.parse(listRes.payload) as Array<{ paymentId: string; issue: string }>;
    assert.equal(list.find((e) => e.paymentId === seeded.paymentId)?.issue, "STATUS_MISMATCH");

    const run = await app!.inject({
      method: "POST",
      url: "/api/v1/reconciliation/run",
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(run.statusCode, 200);
    assert.ok(JSON.parse(run.payload).fixed >= 1, "mismatched payment fixed");

    const statusRes = await pool!.query(`SELECT status FROM payments WHERE id = $1`, [seeded.paymentId]);
    assert.equal(statusRes.rows[0].status, "SUCCEEDED");

    const rerun = await app!.inject({
      method: "POST",
      url: "/api/v1/reconciliation/run",
      headers: { authorization: `Bearer ${userToken}` },
    });
    const rerunBody = JSON.parse(rerun.payload);
    const stillListed = (
      JSON.parse(
        (
          await app!.inject({
            method: "GET",
            url: "/api/v1/reconciliation/exceptions",
            headers: { authorization: `Bearer ${userToken}` },
          })
        ).payload,
      ) as Array<{ paymentId: string }>
    ).some((e) => e.paymentId === seeded.paymentId);
    assert.equal(stillListed, false, "repaired payment drops out of exceptions");
    assert.ok(rerunBody.fixed >= 0);
  });

  it("unauthenticated reconciliation requests return 401", async () => {
    const res = await app!.inject({ method: "GET", url: "/api/v1/reconciliation/exceptions" });
    assert.equal(res.statusCode, 401);
    const run = await app!.inject({ method: "POST", url: "/api/v1/reconciliation/run" });
    assert.equal(run.statusCode, 401);
  });
});
