import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import pg from "pg";
import { buildApp } from "../src/app.js";

const { Pool } = pg;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const uniq = () => `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

let app: Awaited<ReturnType<typeof buildApp>> | null = null;
let pool: pg.Pool | null = null;

async function resolveCanRun(): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("DATABASE_URL not set, skipping security tests");
    return false;
  }
  try {
    const probe = new Pool({ connectionString: dbUrl });
    await probe.query("SELECT 1");
    await probe.end();
    return true;
  } catch (err) {
    console.log("Cannot connect to database, skipping security tests:", (err as Error).message);
    return false;
  }
}

const canRun = await resolveCanRun();

before(async () => {
  if (!canRun) return;
  // NOTE: intentionally NO TRUNCATE here. test/api.test.ts runs in a parallel
  // process against the same database and truncates in its own before();
  // truncating here would wipe its fixtures mid-run and break the 65 existing
  // tests. All fixtures below use unique emails/names so they are isolated.
  pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  app = await buildApp();
  await app.ready();
});

after(async () => {
  if (app) await app.close();
  if (pool) await pool.end();
});

async function signupAdmin(tag: string) {
  const res = await app!.inject({
    method: "POST",
    url: "/api/v1/auth/signup",
    payload: {
      name: `Sec Admin ${tag}`,
      email: `sec-admin-${tag}-${uniq()}@example.com`,
      companyName: `Sec Co ${tag} ${uniq()}`,
      password: "StrongPassword123!",
    },
  });
  assert.equal(res.statusCode, 201);
  return JSON.parse(res.payload) as { token: string; user: any };
}

describe("Security hardening", { skip: !canRun ? "Database not available" : undefined }, () => {
  it("signup hashes with bcrypt and login works", async () => {
    const email = `bcrypt-${uniq()}@example.com`;
    const signupRes = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: { name: "Bcrypt User", email, companyName: `Bcrypt Co ${uniq()}`, password: "BcryptPass123!" },
    });
    assert.equal(signupRes.statusCode, 201);

    const { rows } = await pool!.query("SELECT password_hash FROM users WHERE email = $1", [email]);
    assert.ok(rows[0].password_hash.startsWith("$2"), `expected bcrypt hash, got ${rows[0].password_hash.slice(0, 8)}`);

    const loginRes = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: "BcryptPass123!" },
    });
    assert.equal(loginRes.statusCode, 200);
    assert.ok(JSON.parse(loginRes.payload).token);
  });

  it("legacy sha256 row still logs in and gets upgraded to bcrypt", async () => {
    const { token: adminToken } = await signupAdmin("legacy");
    const adminMe = await app!.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const orgId = JSON.parse(adminMe.payload).user.organizationId;

    const email = `legacy-${uniq()}@example.com`;
    const legacyPassword = "LegacyPass123!";
    await pool!.query(
      "INSERT INTO users (organization_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'admin')",
      [orgId, "Legacy User", email, sha256(legacyPassword)],
    );

    const loginRes = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: legacyPassword },
    });
    assert.equal(loginRes.statusCode, 200);

    const { rows } = await pool!.query("SELECT id, password_hash FROM users WHERE email = $1", [email]);
    assert.ok(rows[0].password_hash.startsWith("$2"), `expected upgraded bcrypt hash, got ${rows[0].password_hash.slice(0, 8)}`);

    const audit = await pool!.query(
      "SELECT id FROM audit_events WHERE organization_id = $1 AND action = 'auth.password_rehashed' AND resource_id = $2",
      [orgId, rows[0].id],
    );
    assert.ok(audit.rows.length >= 1, "expected auth.password_rehashed audit event");
  });

  it("expired agent key is rejected with 401 CREDENTIAL_EXPIRED", async () => {
    const { token: adminToken } = await signupAdmin("expired");
    const agentRes = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: `Expired Agent ${uniq()}` },
    });
    assert.equal(agentRes.statusCode, 201);
    const { agent, credential } = JSON.parse(agentRes.payload);

    await pool!.query("UPDATE agent_credentials SET expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1", [
      credential.id,
    ]);

    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/payment-intents",
      headers: { authorization: `Bearer ${credential.key}`, "idempotency-key": `sec-${uniq()}` },
      payload: { amountPaise: 100, merchant: "expired-key-test" },
    });
    assert.equal(res.statusCode, 401);
    assert.equal(JSON.parse(res.payload).error.code, "CREDENTIAL_EXPIRED");
    void agent;
  });

  it("createAgent and rotate-key set future expires_at; expiresInDays honored and validated", async () => {
    const { token: adminToken } = await signupAdmin("expiry");
    const agentRes = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: `Expiry Agent ${uniq()}` },
    });
    assert.equal(agentRes.statusCode, 201);
    const { agent, credential } = JSON.parse(agentRes.payload);

    const created = await pool!.query("SELECT expires_at FROM agent_credentials WHERE id = $1", [credential.id]);
    assert.ok(created.rows[0].expires_at, "createAgent should set expires_at");
    assert.ok(new Date(created.rows[0].expires_at).getTime() > Date.now(), "expires_at should be in the future");

    const rotateRes = await app!.inject({
      method: "POST",
      url: `/api/v1/agents/${agent.id}/rotate-key`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { expiresInDays: 1 },
    });
    assert.equal(rotateRes.statusCode, 200);
    const newCredId = JSON.parse(rotateRes.payload).credential.id;
    const rotated = await pool!.query("SELECT expires_at FROM agent_credentials WHERE id = $1", [newCredId]);
    const diffMs = new Date(rotated.rows[0].expires_at).getTime() - Date.now();
    assert.ok(diffMs > 0 && diffMs < 2 * 24 * 60 * 60 * 1000, `expected ~1 day expiry, got ${diffMs}ms`);

    // Invalid values rejected
    for (const bad of [0, 366, -5]) {
      const badRes = await app!.inject({
        method: "POST",
        url: `/api/v1/agents/${agent.id}/rotate-key`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { expiresInDays: bad },
      });
      assert.equal(badRes.statusCode, 400, `expiresInDays=${bad} should be rejected`);
    }

    // Rotation is audited
    const audit = await pool!.query(
      "SELECT id FROM audit_events WHERE action = 'agent.key_rotated' AND resource_id = $1",
      [agent.id],
    );
    assert.ok(audit.rows.length >= 1, "expected agent.key_rotated audit event");
  });

  it("RBAC: admin can provision users; viewer is read-only; approver/admin approval matrix holds", async () => {
    const { token: adminToken } = await signupAdmin("rbac");

    // Admin creates approver + viewer
    const mkUser = async (role: string) => {
      const res = await app!.inject({
        method: "POST",
        url: "/api/v1/auth/users",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: `${role} ${uniq()}`, email: `${role}-${uniq()}@example.com`, password: "RolePass123!", role },
      });
      assert.equal(res.statusCode, 201, `admin creating ${role}: ${res.payload}`);
      const body = JSON.parse(res.payload);
      const loginRes = await app!.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: body.user.email, password: "RolePass123!" },
      });
      assert.equal(loginRes.statusCode, 200);
      return JSON.parse(loginRes.payload).token as string;
    };
    const approverToken = await mkUser("approver");
    const viewerToken = await mkUser("viewer");

    // Invalid role rejected
    const badRole = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/users",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "Bad", email: `bad-${uniq()}@example.com`, password: "x", role: "superadmin" },
    });
    assert.equal(badRole.statusCode, 400);

    // Non-admin cannot provision users
    const viewerCreate = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/users",
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { name: "Nope", email: `nope-${uniq()}@example.com`, password: "x", role: "viewer" },
    });
    assert.equal(viewerCreate.statusCode, 403);

    // Viewer: GET ok, POST blocked
    const viewerGet = await app!.inject({
      method: "GET",
      url: "/api/v1/agents",
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    assert.equal(viewerGet.statusCode, 200);

    const viewerPost = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { name: "Viewer Agent" },
    });
    assert.equal(viewerPost.statusCode, 403);
    assert.equal(JSON.parse(viewerPost.payload).error.code, "FORBIDDEN");

    // Viewer blocked from other mutations too
    const viewerRecon = await app!.inject({
      method: "POST",
      url: "/api/v1/reconciliation/run",
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    assert.equal(viewerRecon.statusCode, 403);

    // Setup approvals: agent + policy with approval threshold
    const agentRes = await app!.inject({
      method: "POST",
      url: "/api/v1/agents",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: `RBAC Agent ${uniq()}` },
    });
    const agentKey = JSON.parse(agentRes.payload).credential.key;
    const policyRes = await app!.inject({
      method: "POST",
      url: "/api/v1/policies",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { agentId: JSON.parse(agentRes.payload).agent.id, name: `RBAC Policy ${uniq()}`, config: { approvalThresholdPaise: 100 } },
    });
    assert.equal(policyRes.statusCode, 201);

    const mkPendingIntent = async () => {
      const res = await app!.inject({
        method: "POST",
        url: "/api/v1/payment-intents",
        headers: { authorization: `Bearer ${agentKey}`, "idempotency-key": `rbac-${uniq()}` },
        payload: { amountPaise: 5000, merchant: "rbac-merchant" },
      });
      assert.equal(res.statusCode, 201);
      const intent = JSON.parse(res.payload);
      assert.equal(intent.decision, "REQUIRE_APPROVAL");
      const list = await app!.inject({
        method: "GET",
        url: "/api/v1/approvals?status=pending",
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const task = (JSON.parse(list.payload) as any[]).find((a) => a.paymentIntentId === intent.id);
      assert.ok(task, "approval task exists");
      return task.id as string;
    };

    const approverTaskId = await mkPendingIntent();
    const adminTaskId = await mkPendingIntent();
    // Flip one task to requiredRole approver (allowed: test data setup, no schema change)
    await pool!.query("UPDATE approval_tasks SET required_role = 'approver' WHERE id = $1", [approverTaskId]);

    // Approver can approve approver-tasked approval
    const okApprove = await app!.inject({
      method: "POST",
      url: `/api/v1/approvals/${approverTaskId}/approve`,
      headers: { authorization: `Bearer ${approverToken}` },
      payload: { comment: "approver ok" },
    });
    assert.equal(okApprove.statusCode, 200);

    // Approver cannot approve admin-tasked approval
    const deniedApprove = await app!.inject({
      method: "POST",
      url: `/api/v1/approvals/${adminTaskId}/approve`,
      headers: { authorization: `Bearer ${approverToken}` },
      payload: {},
    });
    assert.equal(deniedApprove.statusCode, 403);

    // Viewer cannot approve anything
    const viewerApprove = await app!.inject({
      method: "POST",
      url: `/api/v1/approvals/${adminTaskId}/approve`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: {},
    });
    assert.equal(viewerApprove.statusCode, 403);

    // Admin can approve the admin-tasked one
    const adminApprove = await app!.inject({
      method: "POST",
      url: `/api/v1/approvals/${adminTaskId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    assert.equal(adminApprove.statusCode, 200);

    // user.created audited
    const adminMe = await app!.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const orgId = JSON.parse(adminMe.payload).user.organizationId;
    const audit = await pool!.query(
      "SELECT id FROM audit_events WHERE organization_id = $1 AND action = 'user.created'",
      [orgId],
    );
    assert.ok(audit.rows.length >= 1, "expected user.created audit events");
  });

  it("GET /auth/me includes role and org slug (backward compatible)", async () => {
    const { token, user } = await signupAdmin("me");
    const res = await app!.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.user.id, user.id);
    assert.equal(body.user.role, "admin");
    assert.ok(body.user.organizationId, "organizationId present");
    assert.ok(typeof body.user.organizationSlug === "string" && body.user.organizationSlug.length > 0, "organizationSlug present");
  });

  it("security headers are present (helmet)", async () => {
    const res = await app!.inject({ method: "GET", url: "/health" });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.ok(res.headers["x-frame-options"], "expected x-frame-options header");
  });

  it("login is rate limited (21st rapid attempt -> 429)", async () => {
    // Fresh app instance so the 20/min budget is untouched by other tests.
    const { buildApp: buildFresh } = await import("../src/app.js");
    const fresh = await buildFresh();
    await fresh.ready();
    try {
      const email = `ratelimit-${uniq()}@example.com`;
      let lastStatus = 0;
      for (let i = 0; i < 21; i++) {
        const res = await fresh.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email, password: "wrong" },
        });
        lastStatus = res.statusCode;
      }
      assert.equal(lastStatus, 429, `expected 429 on 21st attempt, got ${lastStatus}`);
    } finally {
      await fresh.close();
    }
  });
});
