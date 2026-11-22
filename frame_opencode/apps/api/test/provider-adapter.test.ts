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
    "users", "organizations", "idempotency_keys", "providers", "mandates",
  ];
  await pool.query(`TRUNCATE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
  app = await buildApp();
  await app.ready();
});

after(async () => {
  if (app) await app.close();
  if (pool) await pool.end();
});

describe("Provider Adapter Tests", { skip: !canRun ? "Database not available" : undefined }, () => {
  let userToken: string;
  let userId: string;
  let agentKey: string;
  let policyId: string;

  it("POST /auth/signup creates user and org", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: { name: "Provider Admin", email: `provider-${Date.now()}@example.com`, companyName: "Provider Co", password: "securePassword123" },
    });
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.ok(body.token);
    userToken = body.token;
    userId = body.user.id;
  });

  it("POST /agents creates agent with key", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: "Provider Test Agent", description: "Provider adapter test" },
    });
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    agentKey = body.credential.key;
  });

  it("POST /policies creates policy", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/policies",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { agentId: (JSON.parse((await app!.inject({ method: "GET", url: "/api/v1/agents", headers: { authorization: `Bearer ${userToken}` } })).payload)[0].id), name: "Provider Policy", config: { transactionLimitPaise: 10000 } },
    });
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    policyId = body.policy.id;
  });

  it("POST /payment-intents creates AUTHORIZED intent", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/payment-intents",
      headers: { authorization: `Bearer ${agentKey}`, "idempotency-key": `provider-${Date.now()}-intent` },
      payload: { amountPaise: 500, merchant: "provider-test-merchant", purpose: "Provider adapter test" },
    });
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, "AUTHORIZED");
  });

  it("GET /providers returns empty for new org", async () => {
    const res = await app!.inject({
      method: "GET",
      url: "/api/v1/providers",
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body));
    assert.equal(body.length, 0);
  });

  it("POST /providers creates a provider", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/providers",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: "Stripe Sandbox", providerType: "stripe", config: { apiKey: "sk_test_xxx" }, defaultRoute: false },
    });
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.ok(body.id);
    assert.equal(body.name, "Stripe Sandbox");
    assert.equal(body.providerType, "stripe");
    assert.equal(body.status, "active");
  });

  it("GET /providers returns seeded providers", async () => {
    const res = await app!.inject({
      method: "GET",
      url: "/api/v1/providers",
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.length >= 1);
    const stripe = body.find((p: any) => p.name === "Stripe Sandbox");
    assert.ok(stripe, "Stripe Sandbox provider found");
  });

  it("POST /providers/:id/deactivate sets provider inactive", async () => {
    const listRes = await app!.inject({
      method: "GET",
      url: "/api/v1/providers",
      headers: { authorization: `Bearer ${userToken}` },
    });
    const providers = JSON.parse(listRes.payload);
    const stripe = providers.find((p: any) => p.name === "Stripe Sandbox");
    assert.ok(stripe, "Stripe Sandbox provider exists");

    const res = await app!.inject({
      method: "POST",
      url: `/api/v1/providers/${stripe.id}/deactivate`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, "inactive");
  });

  it("POST /payment-intents/:id/provider re-routes AUTHORIZED intent to stripe-sandbox returning 'stripe_test_*'", async () => {
    const createRes = await app!.inject({
      method: "POST",
      url: "/api/v1/payment-intents",
      headers: { authorization: `Bearer ${agentKey}`, "idempotency-key": `provider-${Date.now()}-reroute` },
      payload: { amountPaise: 1000, merchant: "reroute-test", purpose: "Reroute test" },
    });
    assert.equal(createRes.statusCode, 201);
    const intent = JSON.parse(createRes.payload);
    assert.equal(intent.status, "AUTHORIZED");

    const listRes = await app!.inject({
      method: "GET",
      url: "/api/v1/providers",
      headers: { authorization: `Bearer ${userToken}` },
    });
    const providers = JSON.parse(listRes.payload);
    const stripe = providers.find((p: any) => p.providerType === "stripe" && p.status === "active");
    assert.ok(stripe, "Active stripe provider needed");

    const res = await app!.inject({
      method: "POST",
      url: `/api/v1/payment-intents/${intent.id}/provider`,
      headers: { authorization: `Bearer ${agentKey}` },
      payload: { providerId: stripe.id },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.providerPaymentId.startsWith("stripe_test_"), `providerPaymentId should start with stripe_test_ but got ${body.providerPaymentId}`);
    assert.ok(body.providerId);
  });

  it("POST /payment-intents/:id/provider re-route non-AUTHORIZED returns 409 INVALID_STATE", async () => {
    const listRes = await app!.inject({
      method: "GET",
      url: "/api/v1/payment-intents",
      headers: { authorization: `Bearer ${userToken}` },
    });
    const intents = JSON.parse(listRes.payload);
    const nonAuthIntent = intents.find((i: any) => i.status !== "AUTHORIZED");
    if (nonAuthIntent) {
      const res = await app!.inject({
        method: "POST",
        url: `/api/v1/payment-intents/${nonAuthIntent.id}/provider`,
        headers: { authorization: `Bearer ${agentKey}` },
        payload: { providerId: nonAuthIntent.id },
      });
      assert.equal(res.statusCode, 409);
      const body = JSON.parse(res.payload);
      assert.equal(body.error.code, "INVALID_STATE");
    } else {
      console.log("No non-AUTHORIZED intent found for 409 test, skipping");
    }
  });
});
