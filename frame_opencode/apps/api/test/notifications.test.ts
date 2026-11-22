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

describe("Notifications", { skip: !canRun ? "Database not available" : undefined }, () => {
  let userToken: string;
  let agentId: string;
  let agentKey: string;
  let policyId: string;

  it("setup: signup, agent, policy", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        name: "Notify Tester",
        email: `notify-${Date.now()}@example.com`,
        companyName: "Notify Co",
        password: "securePassword123",
      },
    });
    assert.equal(res.statusCode, 201);
    userToken = JSON.parse(res.payload).token;

    const agentRes = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: "Notify Agent" },
    });
    assert.equal(agentRes.statusCode, 201);
    agentId = JSON.parse(agentRes.payload).agent.id;
    agentKey = JSON.parse(agentRes.payload).credential.key;

    const policyRes = await app!.inject({
      method: "POST",
      url: "/api/v1/policies",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { agentId, name: "Notify Policy", config: { transactionLimitPaise: 100 } },
    });
    assert.equal(policyRes.statusCode, 201);
    policyId = JSON.parse(policyRes.payload).policy.id;
  });

  it("DENY intent surfaces a payment-denied notification", async () => {
    const createRes = await app!.inject({
      method: "POST",
      url: "/api/v1/payment-intents",
      headers: {
        authorization: `Bearer ${agentKey}`,
        "idempotency-key": `notify-deny-${Date.now()}`,
      },
      payload: { amountPaise: 5000, merchant: "deny-merchant" },
    });
    assert.equal(createRes.statusCode, 201);
    assert.equal(JSON.parse(createRes.payload).decision, "DENY");

    const res = await app!.inject({
      method: "GET",
      url: "/api/v1/notifications",
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(res.statusCode, 200);
    const list = JSON.parse(res.payload) as Array<{
      id: string;
      type: string;
      title: string;
      detail: string | null;
      severity: string;
      createdAt: string;
      read: boolean;
    }>;
    const denied = list.find((n) => n.type === "payment.denied");
    assert.ok(denied, "payment.denied notification present after DENY intent");
    assert.equal(denied.title, "Payment denied");
    assert.equal(denied.read, false);
    assert.ok(denied.id);
    assert.ok(denied.createdAt);
    assert.ok(
      denied.detail?.includes("deny-merchant"),
      `detail mentions merchant: ${denied.detail}`,
    );
  });

  it("approval flow surfaces approval.requested then approval.approved", async () => {
    await app!.inject({
      method: "PATCH",
      url: `/api/v1/policies/${policyId}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { config: { approvalThresholdPaise: 500 } },
    });

    const createRes = await app!.inject({
      method: "POST",
      url: "/api/v1/payment-intents",
      headers: {
        authorization: `Bearer ${agentKey}`,
        "idempotency-key": `notify-approval-${Date.now()}`,
      },
      payload: { amountPaise: 1000, merchant: "approval-merchant" },
    });
    assert.equal(createRes.statusCode, 201);
    assert.equal(JSON.parse(createRes.payload).decision, "REQUIRE_APPROVAL");

    const before = JSON.parse(
      (
        await app!.inject({
          method: "GET",
          url: "/api/v1/notifications",
          headers: { authorization: `Bearer ${userToken}` },
        })
      ).payload,
    ) as Array<{ type: string; title: string }>;
    const requested = before.find((n) => n.type === "approval.requested");
    assert.ok(requested, "approval.requested notification present");
    assert.equal(requested.title, "Approval requested");

    const approvals = JSON.parse(
      (
        await app!.inject({
          method: "GET",
          url: "/api/v1/approvals?status=pending",
          headers: { authorization: `Bearer ${userToken}` },
        })
      ).payload,
    ) as Array<{ id: string; paymentIntentId: string }>;
    const intentId = JSON.parse(createRes.payload).id as string;
    const task = approvals.find((a) => a.paymentIntentId === intentId);
    assert.ok(task, "pending approval task exists");

    const approveRes = await app!.inject({
      method: "POST",
      url: `/api/v1/approvals/${task.id}/approve`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { comment: "ok" },
    });
    assert.equal(approveRes.statusCode, 200);

    const after = JSON.parse(
      (
        await app!.inject({
          method: "GET",
          url: "/api/v1/notifications",
          headers: { authorization: `Bearer ${userToken}` },
        })
      ).payload,
    ) as Array<{ type: string; title: string }>;
    const approved = after.find((n) => n.type === "approval.approved");
    assert.ok(approved, "approval.approved notification present after approve");
    assert.equal(approved.title, "Approval approved");

    await app!.inject({
      method: "PATCH",
      url: `/api/v1/policies/${policyId}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { config: {} },
    });
  });

  it("POST /notifications/test returns a rendered notification object", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/notifications/test",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { type: "payment.succeeded" },
    });
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.type, "payment.succeeded");
    assert.equal(body.title, "Payment succeeded");
    assert.equal(body.severity, "info");
    assert.equal(body.read, false);
    assert.ok(body.id);
    assert.ok(body.createdAt);

    const bad = await app!.inject({
      method: "POST",
      url: "/api/v1/notifications/test",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { type: "bogus.type" },
    });
    assert.equal(bad.statusCode, 400);
  });

  it("GET /notifications honors limit and newest-first order", async () => {
    const res = await app!.inject({
      method: "GET",
      url: "/api/v1/notifications?limit=1",
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(res.statusCode, 200);
    const list = JSON.parse(res.payload) as Array<{ createdAt: string }>;
    assert.ok(list.length <= 1);

    const full = JSON.parse(
      (
        await app!.inject({
          method: "GET",
          url: "/api/v1/notifications?limit=25",
          headers: { authorization: `Bearer ${userToken}` },
        })
      ).payload,
    ) as Array<{ createdAt: string }>;
    assert.ok(full.length >= 1);
    for (let i = 1; i < full.length; i++) {
      assert.ok(
        new Date(full[i - 1]!.createdAt).getTime() >= new Date(full[i]!.createdAt).getTime(),
        "notifications newest first",
      );
    }
  });

  it("unauthenticated notification requests return 401", async () => {
    assert.equal((await app!.inject({ method: "GET", url: "/api/v1/notifications" })).statusCode, 401);
    assert.equal(
      (
        await app!.inject({
          method: "POST",
          url: "/api/v1/notifications/test",
          payload: { type: "payment.succeeded" },
        })
      ).statusCode,
      401,
    );
  });
});
