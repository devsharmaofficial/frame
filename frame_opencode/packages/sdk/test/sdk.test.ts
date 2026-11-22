import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { FrameClient, FrameError, inrToPaise, newIdempotencyKey, paiseToInr } from "../src/index.js";

type Call = { url: string; init: RequestInit };

function fakeFetch(handler: (url: string, init: RequestInit) => unknown) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { fn, calls };
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
  };
}

describe("sdk: request shape", () => {
  it("sends correct URL/method/auth headers for dashboard calls", async () => {
    const { fn, calls } = fakeFetch((_url, _init) =>
      jsonResponse(200, { agents: [] }),
    );
    const c = new FrameClient({ baseUrl: "http://x:4100/api/v1", token: "tok123", fetch: fn });
    await c.agents.list();
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "http://x:4100/api/v1/agents");
    assert.equal(calls[0]!.init.method, "GET");
    assert.equal((calls[0]!.init.headers as Record<string, string>)["Authorization"], "Bearer tok123");
  });

  it("creates payment intent with Idempotency-Key (injected + auto)", async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse(200, { id: "pi_1", status: "pending" }));
    const c = new FrameClient({ baseUrl: "http://x/api/v1", fetch: fn });

    await c.paymentIntents.create(
      { amountPaise: 1999, merchant: "acme" },
      { agentKey: "ag_key", idempotencyKey: "fixed-key" },
    );
    const h1 = calls[0]!.init.headers as Record<string, string>;
    assert.equal(calls[0]!.url, "http://x/api/v1/payment-intents");
    assert.equal(calls[0]!.init.method, "POST");
    assert.equal(h1["Idempotency-Key"], "fixed-key");
    assert.equal(h1["Authorization"], "Bearer ag_key");

    await c.paymentIntents.create({ amountPaise: 100, merchant: "acme" }, { agentKey: "ag_key" });
    const h2 = calls[1]!.init.headers as Record<string, string>;
    assert.ok(typeof h2["Idempotency-Key"] === "string" && h2["Idempotency-Key"].length >= 8);
  });

  it("parses server errors into FrameError{code,requestId}", async () => {
    const { fn } = fakeFetch(() =>
      jsonResponse(
        409,
        { error: { code: "POLICY_EXISTS", message: "edit instead", request_id: "req_9" } },
        { "x-request-id": "req_9" },
      ),
    );
    const c = new FrameClient({ baseUrl: "http://x/api/v1", token: "t", fetch: fn });
    await assert.rejects(() => c.policies.create({ agentId: "a", name: "p" }), (e: unknown) => {
      assert.ok(e instanceof FrameError);
      assert.equal((e as FrameError).code, "POLICY_EXISTS");
      assert.equal((e as FrameError).status, 409);
      assert.equal((e as FrameError).requestId, "req_9");
      return true;
    });
  });

  it("injectable fetch is used (no network)", async () => {
    const fetchMock = mock.fn(async () => jsonResponse(200, { ok: true }));
    const c = new FrameClient({
      baseUrl: "http://x/api/v1",
      fetch: fetchMock as unknown as typeof fetch,
    });
    await c.overview.get();
    assert.equal(fetchMock.mock.calls.length, 1);
  });
});

describe("sdk: helpers", () => {
  it("inrToPaise(19.99) === 1999 and paiseToInr round-trips", () => {
    assert.equal(inrToPaise(19.99), 1999);
    assert.equal(paiseToInr(1999), 19.99);
  });

  it("newIdempotencyKey generates unique keys", () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    assert.ok(a.length >= 8 && b.length >= 8);
    assert.notEqual(a, b);
  });
});
