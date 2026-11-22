import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const config = { NODE_ENV: "test" as const, HOST: "127.0.0.1", PORT: 3000, FRAMER_API_KEY: "test-framer-api-key" };

describe("Framer API foundation", () => {
  it("exposes a health endpoint without authentication", async () => {
    const app = buildApp(config);
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.service).toBe("framer-api");
    await app.close();
  });

  it("enforces idempotency for payment intents", async () => {
    const app = buildApp(config);
    const headers = { "x-api-key": config.FRAMER_API_KEY, "idempotency-key": "payment-1" };
    const agent = await app.inject({ method: "POST", url: "/api/v1/agents", headers, payload: { name: "Build Agent" } });
    const agentId = agent.json().data.id;
    await app.inject({ method: "POST", url: "/api/v1/policies", headers, payload: { agentId, transactionLimitMinor: 10000, allowedMerchants: ["AWS"] } });
    const payload = { agentId, amountMinor: 1200, currency: "INR", merchant: "AWS", purpose: "build infrastructure", expiresAt: new Date(Date.now() + 3600000).toISOString() };
    const first = await app.inject({ method: "POST", url: "/api/v1/payment-intents", headers, payload });
    const second = await app.inject({ method: "POST", url: "/api/v1/payment-intents", headers, payload });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().data.id).toBe(first.json().data.id);
    await app.close();
  });

  it("holds intents above the approval threshold and resolves them", async () => {
    const app = buildApp(config);
    const headers = { "x-api-key": config.FRAMER_API_KEY, "idempotency-key": "payment-approval-1" };
    const agent = await app.inject({ method: "POST", url: "/api/v1/agents", headers, payload: { name: "Procurement Agent" } });
    const agentId = agent.json().data.id;
    await app.inject({ method: "POST", url: "/api/v1/policies", headers, payload: { agentId, transactionLimitMinor: 10000, approvalThresholdMinor: 5000 } });
    const created = await app.inject({ method: "POST", url: "/api/v1/payment-intents", headers, payload: { agentId, amountMinor: 6000, currency: "INR", merchant: "AWS", purpose: "server", expiresAt: new Date(Date.now() + 3600000).toISOString() } });
    expect(created.statusCode).toBe(201);
    expect(created.json().data.status).toBe("PENDING_APPROVAL");
    const approvalId = created.json().data.approvalId;
    const approval = await app.inject({ method: "POST", url: `/api/v1/approvals/${approvalId}/approve`, headers });
    expect(approval.statusCode).toBe(200);
    expect(approval.json().payment_intent.status).toBe("AUTHORIZED");
    await app.close();
  });

  it("executes an authorized intent and reconciles a simulated provider webhook", async () => {
    const app = buildApp(config);
    const headers = { "x-api-key": config.FRAMER_API_KEY, "idempotency-key": "payment-execution-1" };
    const agent = await app.inject({ method: "POST", url: "/api/v1/agents", headers, payload: { name: "Runtime Agent" } });
    const agentId = agent.json().data.id;
    await app.inject({ method: "POST", url: "/api/v1/policies", headers, payload: { agentId, transactionLimitMinor: 10000 } });
    const created = await app.inject({ method: "POST", url: "/api/v1/payment-intents", headers, payload: { agentId, amountMinor: 1200, currency: "INR", merchant: "AWS", purpose: "compute", expiresAt: new Date(Date.now() + 3600000).toISOString() } });
    const id = created.json().data.id;
    const executing = await app.inject({ method: "POST", url: `/api/v1/payment-intents/${id}/execute`, headers });
    expect(executing.json().data.status).toBe("PROCESSING");
    const webhook = await app.inject({ method: "POST", url: `/api/v1/payment-intents/${id}/webhook`, headers, payload: { status: "SUCCEEDED" } });
    expect(webhook.json().data.status).toBe("SUCCEEDED");
    await app.close();
  });
});
