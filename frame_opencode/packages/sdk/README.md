# @frame/sdk

Official TypeScript SDK for **Frame** — AI-agent payment-control infrastructure. No runtime dependencies (injectable `fetch`).

## Quickstart

```ts
import { FrameClient, inrToPaise, paiseToInr } from "@frame/sdk";

const frame = new FrameClient(); // http://localhost:4100/api/v1 or FRAME_API_URL

const { token, user } = await frame.auth.signup({
  name: "Asha", email: "asha@acme.com", companyName: "Acme", password: "secret123",
});

const { agent, credential } = await frame.agents.create({
  name: "shopper", description: "buys supplies", owner: "asha",
  environment: "prod", purpose: "procurement",
});

await frame.policies.create({
  agentId: agent.id, name: "default",
  merchantAllowlist: ["acme"], maxAmountPaise: inrToPaise(5000),
});

import { randomUUID } from "node:crypto";
const agentClient = new FrameClient({ baseUrl: frame.baseUrl, apiKey: credential.key });
const intent = await agentClient.paymentIntents.create(
  { agentId: agent.id, amountPaise: inrToPaise(19.99), merchant: "acme" },
  { idempotencyKey: randomUUID() },
);
console.log(`₹${paiseToInr(Number(intent.amountPaise))}`, intent.decision);
```

Money is **integer paise** everywhere. Env override: `FRAME_API_URL`.

## API

- `new FrameClient({ baseUrl?, token?, apiKey?, fetch? })`, `.setToken(t)`, `.authToken`
- `auth.signup({ name, email, companyName, password })`
- `agents.create/list/get/disable/enable/rotateKey`
- `policies.create({ agentId, name, description?, config? | flat fields })/update/list/get/versions` — `409 POLICY_EXISTS` means edit instead
- `paymentIntents.create(input, { agentKey?, idempotencyKey? })` — sends `Idempotency-Key`; agent `Bearer` key
- `paymentIntents.list({ agentId? })/get/audit/execute (agent auth)/executeUser (user auth)`
- `approvals.list({ status? })/approve/reject`
- `overview.get()`, `transactions.list()`, `audit.list()`, `webhooks.test({ payment_id, event_type })`
- Errors throw `FrameError { code, status, message, requestId }` parsed from `{ error: { code, message, request_id } }`
- Helpers: `newIdempotencyKey()`, `inrToPaise()`, `paiseToInr()`, `toPaiseNumber()`, `DEFAULT_BASE_URL`

Demo: `npx tsx examples/demo-flow.mts` (needs live API at `localhost:4100`).
