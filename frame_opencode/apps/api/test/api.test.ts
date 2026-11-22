import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
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

describe("API Integration Tests", { skip: !canRun ? "Database not available" : undefined }, () => {
  let userToken: string;
  let userId: string;
  let agentId: string;
  let agentKey: string;
  let policyId: string;

  it("POST /auth/signup creates user and org", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        name: "Test Admin",
        email: `test-${Date.now()}@example.com`,
        companyName: "Test Company",
        password: "securePassword123",
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.ok(body.token);
    assert.ok(body.user);
    assert.equal(body.user.role, "admin");
    userToken = body.token;
    userId = body.user.id;
  });

  it("POST /auth/login returns token", async () => {
    const signupRes = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        name: "Login Test",
        email: `login-${Date.now()}@example.com`,
        companyName: "Login Company",
        password: "password123",
      },
    });
    const signupBody = JSON.parse(signupRes.payload);

    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: signupBody.user.email, password: "password123" },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.token);
  });

  it("GET /auth/me returns user", async () => {
    const res = await app!.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.user);
    assert.equal(body.user.id, userId);
  });

  it("POST /agents creates agent with key", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: "Test Agent", description: "Integration test agent" },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.ok(body.agent);
    assert.ok(body.credential);
    assert.ok(body.credential.key.startsWith("fr_"));
    assert.equal(body.credential.secretShownOnce, true);
    agentId = body.agent.id;
    agentKey = body.credential.key;
  });

  it("GET /agents lists agents", async () => {
    const res = await app!.inject({
      method: "GET",
      url: "/api/v1/agents",
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
  });

  it("POST /policies creates policy", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/policies",
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        agentId,
        name: "Test Policy",
        config: { transactionLimitPaise: 10000 },
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.ok(body.policy);
    assert.ok(body.version);
    assert.equal(body.version.version, 1);
    policyId = body.policy.id;
  });

  it("GET /policies :id/versions returns versions", async () => {
    const res = await app!.inject({
      method: "GET",
      url: `/api/v1/policies/${policyId}/versions`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body));
    assert.equal(body.length, 1);
    assert.equal(body[0].version, 1);
  });

  it("POST /payment-intents creates ALLOWED intent", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/payment-intents",
      headers: {
        authorization: `Bearer ${agentKey}`,
        "idempotency-key": `test-${Date.now()}-allow`,
      },
      payload: {
        amountPaise: 500,
        merchant: "test-merchant",
        purpose: "Integration test",
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.decision, "ALLOW");
    assert.equal(body.status, "AUTHORIZED");
    assert.ok(body.id);
  });

  it("POST /payment-intents with duplicate idempotency key returns cached", async () => {
    const key = `idempotent-${Date.now()}`;
    const res1 = await app!.inject({
      method: "POST",
      url: "/api/v1/payment-intents",
      headers: {
        authorization: `Bearer ${agentKey}`,
        "idempotency-key": key,
      },
      payload: { amountPaise: 200, merchant: "cached-merchant" },
    });

    const res2 = await app!.inject({
      method: "POST",
      url: "/api/v1/payment-intents",
      headers: {
        authorization: `Bearer ${agentKey}`,
        "idempotency-key": key,
      },
      payload: { amountPaise: 200, merchant: "cached-merchant" },
    });

    assert.equal(res1.statusCode, 201);
    assert.equal(res2.statusCode, 200);
    const body1 = JSON.parse(res1.payload);
    const body2 = JSON.parse(res2.payload);
    assert.equal(body1.id, body2.id);
  });

  it("POST /payment-intents DENIED when amount exceeds limit", async () => {
    await app!.inject({
      method: "PATCH",
      url: `/api/v1/policies/${policyId}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { config: { transactionLimitPaise: 100 } },
    });

    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/payment-intents",
      headers: {
        authorization: `Bearer ${agentKey}`,
        "idempotency-key": `test-${Date.now()}-deny`,
      },
      payload: { amountPaise: 5000, merchant: "test-merchant" },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.decision, "DENY");
    assert.equal(body.status, "DENIED");
    assert.ok(body.reasons.length > 0, "should include reasons");
  });

  it("POST /payment-intents REQUIRE_APPROVAL when above threshold", async () => {
    await app!.inject({
      method: "PATCH",
      url: `/api/v1/policies/${policyId}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { config: { approvalThresholdPaise: 500 } },
    });

    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/payment-intents",
      headers: {
        authorization: `Bearer ${agentKey}`,
        "idempotency-key": `test-${Date.now()}-approval`,
      },
      payload: { amountPaise: 1000, merchant: "test-merchant" },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.decision, "REQUIRE_APPROVAL");
    assert.equal(body.status, "PENDING_APPROVAL");
  });

  it("GET /approvals lists pending approvals", async () => {
    const res = await app!.inject({
      method: "GET",
      url: "/api/v1/approvals?status=pending",
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body));
    assert.ok(body.length >= 1);
  });

  it("POST /approvals/:id/approve approves a task and authorizes intent", async () => {
    const listRes = await app!.inject({
      method: "GET",
      url: "/api/v1/approvals?status=pending",
      headers: { authorization: `Bearer ${userToken}` },
    });
    const approvals = JSON.parse(listRes.payload);
    assert.ok(approvals.length > 0, "expected at least one pending approval");

    const taskId = approvals[0].id;
    const res = await app!.inject({
      method: "POST",
      url: `/api/v1/approvals/${taskId}/approve`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { comment: "Looks good" },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, "approved");
  });

  it("POST /payment-intents/:id/execute executes AUTHORIZED intent", async () => {
    await app!.inject({
      method: "PATCH",
      url: `/api/v1/policies/${policyId}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { config: {} },
    });

    const createRes = await app!.inject({
      method: "POST",
      url: "/api/v1/payment-intents",
      headers: {
        authorization: `Bearer ${agentKey}`,
        "idempotency-key": `test-${Date.now()}-exec`,
      },
      payload: { amountPaise: 100, merchant: "exec-test" },
    });
    assert.equal(createRes.statusCode, 201);
    const intent = JSON.parse(createRes.payload);
    assert.equal(intent.decision, "ALLOW");

    const res = await app!.inject({
      method: "POST",
      url: `/api/v1/payment-intents/${intent.id}/execute`,
      headers: { authorization: `Bearer ${agentKey}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.providerPaymentId);
    assert.ok(body.providerPaymentId.startsWith("sandbox_"));
    assert.equal(body.status, "PENDING");
  });

  it("GET /payment-intents lists intents", async () => {
    const res = await app!.inject({
      method: "GET",
      url: "/api/v1/payment-intents",
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body));
  });

  it("GET /transactions returns ledger entries", async () => {
    const res = await app!.inject({
      method: "GET",
      url: "/api/v1/transactions",
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body));
  });

  it("GET /audit-events lists audit events", async () => {
    const res = await app!.inject({
      method: "GET",
      url: "/api/v1/audit-events",
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
  });

  it("GET /overview returns summary", async () => {
    const res = await app!.inject({
      method: "GET",
      url: "/api/v1/overview",
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok("totalSpendPaise" in body);
    assert.ok("todaySpendPaise" in body);
    assert.ok("activeAgents" in body);
    assert.ok("pendingApprovals" in body);
    assert.ok("blockedAttempts" in body);
    assert.ok("successRate" in body);
    assert.ok(body.successRate >= 0, "success rate non-negative");
    assert.ok(Array.isArray(body.recentPayments));
    assert.ok(Array.isArray(body.alerts));
  });

  it("GET /health returns ok", async () => {
    const res = await app!.inject({ method: "GET", url: "/health" });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, "ok");
  });

  it("revoked agent key is rejected", async () => {
    const createRes = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: "Revoked Agent" },
    });
    const { agent, credential } = JSON.parse(createRes.payload);

    await app!.inject({
      method: "POST",
      url: `/api/v1/agents/${agent.id}/disable`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/payment-intents",
      headers: {
        authorization: `Bearer ${credential.key}`,
        "idempotency-key": `test-${Date.now()}-revoked`,
      },
      payload: { amountPaise: 100, merchant: "test" },
    });

    assert.ok([401, 403].includes(res.statusCode), `Expected 401 or 403, got ${res.statusCode}`);
  });

  it("missing idempotency key returns 400", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/payment-intents",
      headers: { authorization: `Bearer ${agentKey}` },
      payload: { amountPaise: 100, merchant: "test" },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.ok(body.error.request_id, "error includes request_id");
  });

  it("unauthenticated request returns 401", async () => {
    const res = await app!.inject({
      method: "GET",
      url: "/api/v1/agents",
    });

    assert.equal(res.statusCode, 401);
  });

  it("POST /agents/:id/disable then enable works", async () => {
    const disableRes = await app!.inject({
      method: "POST",
      url: `/api/v1/agents/${agentId}/disable`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(disableRes.statusCode, 200);
    assert.equal(JSON.parse(disableRes.payload).status, "disabled");

    const enableRes = await app!.inject({
      method: "POST",
      url: `/api/v1/agents/${agentId}/enable`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(enableRes.statusCode, 200);
    assert.equal(JSON.parse(enableRes.payload).status, "active");
  });

  it("POST /agents/:id/rotate-key returns new key", async () => {
    const res = await app!.inject({
      method: "POST",
      url: `/api/v1/agents/${agentId}/rotate-key`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.credential);
    assert.ok(body.credential.key.startsWith("fr_"));
    assert.equal(body.credential.secretShownOnce, true);
    agentKey = body.credential.key;
  });

  it("POST /payment-intents :execute rejects non-AUTHORIZED intent", async () => {
    // Create another REQUIRE_APPROVAL intent and try to execute it directly
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
        "idempotency-key": `test-${Date.now()}-reject`,
      },
      payload: { amountPaise: 2000, merchant: "reject-route" },
    });
    assert.equal(createRes.statusCode, 201);
    const intent = JSON.parse(createRes.payload);
    assert.equal(intent.decision, "REQUIRE_APPROVAL");

    const execRes = await app!.inject({
      method: "POST",
      url: `/api/v1/payment-intents/${intent.id}/execute`,
      headers: { authorization: `Bearer ${agentKey}` },
    });
    assert.equal(execRes.statusCode, 409);
    const execBody = JSON.parse(execRes.payload);
    assert.equal(execBody.error.code, "INVALID_STATE");

    await app!.inject({
      method: "PATCH",
      url: `/api/v1/policies/${policyId}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { config: {} },
    });
  });

  it("POST /approvals/:id/reject rejects a task", async () => {
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
        "idempotency-key": `test-${Date.now()}-reject-flow`,
      },
      payload: { amountPaise: 1500, merchant: "reject-flow" },
    });
    assert.equal(createRes.statusCode, 201);
    const intent = JSON.parse(createRes.payload);
    assert.equal(intent.decision, "REQUIRE_APPROVAL");

    const listRes = await app!.inject({
      method: "GET",
      url: `/api/v1/approvals?status=pending`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    const approvals = JSON.parse(listRes.payload);
    const task = approvals.find((a: any) => a.paymentIntentId === intent.id);
    assert.ok(task, "approval task exists for intent");

    const res = await app!.inject({
      method: "POST",
      url: `/api/v1/approvals/${task.id}/reject`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { comment: "Not allowed" },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, "rejected");

    await app!.inject({
      method: "PATCH",
      url: `/api/v1/policies/${policyId}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { config: {} },
    });
  });

  it("POST /webhooks/provider rejects invalid signature", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/webhooks/provider",
      headers: {
        "content-type": "application/json",
        "x-frame-signature": "invalid",
      },
      payload: { event_type: "payment.succeeded", provider_payment_id: "sandbox_abc" },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.equal(body.error.code, "INVALID_SIGNATURE");
  });

  it("POST /webhooks/provider verifies valid signature then rejects unknown payment", async () => {
    const bodyStr = JSON.stringify({ event_type: "payment.succeeded", provider_payment_id: "sandbox_nonexistent" });
    const signature = createHmac("sha256", "frame_dev_webhook_secret")
      .update(bodyStr)
      .digest("hex");

    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/webhooks/provider",
      headers: {
        "content-type": "application/json",
        "x-frame-signature": signature,
      },
      payload: { event_type: "payment.succeeded", provider_payment_id: "sandbox_nonexistent" },
    });

    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.payload);
    assert.equal(body.error.code, "PAYMENT_NOT_FOUND");
  });

  it("POST /webhooks/test processes sandbox event", async () => {
    // Reset policy to allow
    await app!.inject({
      method: "PATCH",
      url: `/api/v1/policies/${policyId}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { config: {} },
    });

    const createRes = await app!.inject({
      method: "POST",
      url: "/api/v1/payment-intents",
      headers: {
        authorization: `Bearer ${agentKey}`,
        "idempotency-key": `test-${Date.now()}-webhook`,
      },
      payload: { amountPaise: 250, merchant: "webhook-test" },
    });
    assert.equal(createRes.statusCode, 201);
    const intent = JSON.parse(createRes.payload);
    assert.equal(intent.decision, "ALLOW");

    const execRes = await app!.inject({
      method: "POST",
      url: `/api/v1/payment-intents/${intent.id}/execute`,
      headers: { authorization: `Bearer ${agentKey}` },
    });
    assert.equal(execRes.statusCode, 200);
    const exec = JSON.parse(execRes.payload);
    assert.ok(exec.providerPaymentId.startsWith("sandbox_"));

    const webhookRes = await app!.inject({
      method: "POST",
      url: "/api/v1/webhooks/test",
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        payment_id: exec.providerPaymentId,
        event_type: "payment.succeeded",
      },
    });
    assert.equal(webhookRes.statusCode, 200);
    const webhook = JSON.parse(webhookRes.payload);
    assert.equal(webhook.processed, true);
    assert.equal(webhook.status, "SUCCEEDED");

    const transactionRes = await app!.inject({
      method: "GET",
      url: "/api/v1/transactions",
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(transactionRes.statusCode, 200);
    const txs = JSON.parse(transactionRes.payload);
    const found = txs.find((tx: any) => tx.intent?.id === intent.id);
    assert.ok(found, "ledger entry created for intent");
    assert.ok(found.entryHash, "ledger entry has hash");
    assert.equal(found.entryType, "payment_success");
  });

  it("POST /agents persists owner and environment", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: "Owned Agent", owner: "platform-team", environment: "staging" },
    });
    assert.equal(res.statusCode, 201);
    const { agent } = JSON.parse(res.payload);
    assert.equal(agent.owner, "platform-team");
    assert.equal(agent.environment, "staging");
  });

  it("POST /policies accepts flat dashboard-style config", async () => {
    const agentRes = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: "Flat Policy Agent" },
    });
    const flatAgentId = JSON.parse(agentRes.payload).agent.id;

    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/policies",
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        agentId: flatAgentId,
        name: "Flat Policy",
        monthlyLimitPaise: 100000,
        dailyLimitPaise: 10000,
        transactionLimitPaise: 2000,
        approvalThresholdPaise: 500,
        allowedMerchants: ["AWS", "GCP"],
        blockedMerchants: ["Nike"],
        restrictedCategories: ["gambling"],
      },
    });
    assert.equal(res.statusCode, 201);
    const { version } = JSON.parse(res.payload);
    assert.equal(version.version, 1);
    assert.equal(version.config.transactionLimitPaise, 2000);
    assert.deepEqual(version.config.allowedMerchants, ["AWS", "GCP"]);
  });

  it("POST /policies rejects a second active policy for the same agent", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/policies",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { agentId, name: "Duplicate Policy", config: { transactionLimitPaise: 10 } },
    });
    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.payload);
    assert.equal(body.error.code, "POLICY_EXISTS");
  });

  it("GET /payment-intents/:id/audit returns intent, timeline, payment, approval", async () => {
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
        "idempotency-key": `test-${Date.now()}-audit`,
      },
      payload: { amountPaise: 1000, merchant: "audit-merchant", purpose: "Audit check" },
    });
    assert.equal(createRes.statusCode, 201);
    const intent = JSON.parse(createRes.payload);
    assert.equal(intent.status, "PENDING_APPROVAL");

    const listRes = await app!.inject({
      method: "GET",
      url: "/api/v1/approvals?status=pending",
      headers: { authorization: `Bearer ${userToken}` },
    });
    const approvals = JSON.parse(listRes.payload);
    const enriched = approvals.find((a: any) => a.paymentIntentId === intent.id);
    assert.ok(enriched, "approval present");
    assert.ok(enriched.paymentIntent, "approval exposes paymentIntent");
    assert.ok(enriched.agent, "approval exposes agent");
    assert.ok(enriched.policy, "approval exposes policy");
    assert.ok(enriched.reason, "approval exposes reason");

    await app!.inject({
      method: "POST",
      url: `/api/v1/approvals/${enriched.id}/approve`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    const auditRes = await app!.inject({
      method: "GET",
      url: `/api/v1/payment-intents/${intent.id}/audit`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(auditRes.statusCode, 200);
    const audit = JSON.parse(auditRes.payload);
    assert.equal(audit.intent.id, intent.id);
    assert.ok(Array.isArray(audit.timeline));
    assert.ok(audit.timeline.length >= 2, "intent.created + approval.approved audited");
    assert.ok(!audit.approval || audit.approval.decision === "approved", "approval reflected");
  });

  it("POST /payment-intents/:id/execute-user executes with user auth", async () => {
    await app!.inject({
      method: "PATCH",
      url: `/api/v1/policies/${policyId}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { config: {} },
    });

    const createRes = await app!.inject({
      method: "POST",
      url: "/api/v1/payment-intents",
      headers: {
        authorization: `Bearer ${agentKey}`,
        "idempotency-key": `test-${Date.now()}-exec-user`,
      },
      payload: { amountPaise: 120, merchant: "exec-user-test" },
    });
    const intent = JSON.parse(createRes.payload);
    assert.equal(intent.decision, "ALLOW");

    const res = await app!.inject({
      method: "POST",
      url: `/api/v1/payment-intents/${intent.id}/execute-user`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.providerPaymentId.startsWith("sandbox_"));
  });
});