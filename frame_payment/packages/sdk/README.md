# Framer TypeScript SDK

The Framer SDK gives agents a safe, provider-agnostic way to request payments
through the Framer authorization layer. It never calls a payment provider
directly and never handles bank credentials, UPI PINs, or provider secrets.

> **Give agents budgets, not bank accounts.**

## Installation

```bash
npm install @framer/sdk
```

## Authentication

Create the client on a trusted server or agent runtime with a Framer API key.
Do not embed the key in browser code, source control, or logs.

```ts
import { createFramerClient } from "@framer/sdk";

const framer = createFramerClient({
  apiKey: process.env.FRAMER_API_KEY!,
  // Optional for self-hosted/staging API deployments.
  baseUrl: "https://api.framer.example.com",
});
```

The SDK sends an `x-api-key` and an `X-Request-Id` header
on every request. Each method returns `{ data, requestId }`; retain the request
ID in logs and support tickets.

## API examples

### Create an agent

```ts
const agent = await framer.agents.create({
  name: "DevOps Agent",
  description: "Maintains approved production infrastructure",
});
console.log(agent.data.id, agent.requestId);
```

### Create a payment intent

Amounts are integer minor units. For INR, `10050` is ₹100.50. Payment intent
creation requires an idempotency key; reuse the same key when safely retrying.
Policy evaluation and any required approval happen in Framer before a provider
is contacted.

```ts
const intent = await framer.paymentIntents.create(
  {
    agent_id: agent.data.id,
    amount: 240000,
    currency: "INR",
    merchant: "AWS",
    purpose: "Production infrastructure",
  },
  { idempotencyKey: "payment-devops-2026-09-10-001" },
);

console.log(intent.data.status, intent.data.decision);
```

### Read a payment intent or approval

```ts
const current = await framer.paymentIntents.get(intent.data.id);
const approval = await framer.approvals.get("approval_123");
```

Use `requestId` when correlating API responses with audit events. The SDK
does not auto-retry payment creation because unknown provider outcomes must be
reconciled before retrying.

## Errors

API errors have a stable code, HTTP status, request ID, and optional details:

```ts
import { FramerApiError } from "@framer/sdk";

try {
  await framer.paymentIntents.create(
    {
      agent_id: "agent_123",
      amount: 500000,
      currency: "INR",
      merchant: "AWS",
      purpose: "Production infrastructure",
    },
    { idempotencyKey: "payment-unique-key" },
  );
} catch (error) {
  if (error instanceof FramerApiError) {
    console.error(error.code, error.status, error.requestId);
  }
  throw error;
}
```

Error responses follow the Framer API shape:

```json
{
  "error": {
    "code": "POLICY_LIMIT_EXCEEDED",
    "message": "Payment exceeds the agent transaction limit.",
    "request_id": "req_123"
  }
}
```

Provider webhooks are verified and handled by the Framer API. This SDK does
not expose provider credentials or make direct provider calls.
