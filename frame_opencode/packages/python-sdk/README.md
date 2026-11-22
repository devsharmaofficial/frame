# frame-sdk

Official Python SDK for **Frame** — AI-agent payment-control infrastructure. Mirrors `@frame/sdk` (method names in `snake_case`). Zero third-party runtime dependencies (stdlib only: `urllib.request`, `json`, `os`, `uuid`). Python 3.10+.

## Quickstart

```python
from frame import FrameClient, inr_to_paise, paise_to_inr

frame = FrameClient()  # http://localhost:4100/api/v1 or FRAME_API_URL

signup = frame.auth.signup({
    "name": "Asha", "email": "asha@acme.com",
    "companyName": "Acme", "password": "secret123",
})

created = frame.agents.create({
    "name": "shopper", "description": "buys supplies", "owner": "asha",
    "environment": "prod", "purpose": "procurement",
})
agent, credential = created["agent"], created["credential"]

frame.policies.create({
    "agentId": agent["id"], "name": "default",
    "merchantAllowlist": ["acme"], "maxAmountPaise": inr_to_paise(5000),
})

import uuid
agent_client = FrameClient(base_url=frame.base_url, api_key=credential["key"])
intent = agent_client.payment_intents.create(
    {"agentId": agent["id"], "amountPaise": inr_to_paise(19.99), "merchant": "acme"},
    idempotency_key=uuid.uuid4().hex,
)
print(f"Rs.{paise_to_inr(int(intent['amountPaise']))}", intent.get("decision"))
```

Money is **integer paise** everywhere. Env override: `FRAME_API_URL`.

Per-call agent auth override: `frame.payment_intents.create(input, agent_key="...")`
(or `api_key=` / `auth=`). `Idempotency-Key` is auto-generated unless passed.

## API

- `FrameClient(base_url=None, token=None, api_key=None, opener=None, timeout=30.0)`, `.set_token(t)`, `.auth_token` (aliases: `baseUrl`, `setToken`, `authToken`)
- `auth.signup({...})` — stores token on the client
- `agents.create/list/get/disable/enable/rotate_key`
- `policies.create({agentId, name, description?, config? | flat fields})/update/get/list/versions` — `409 POLICY_EXISTS` means edit instead
- `payment_intents.create(input, agent_key=None, idempotency_key=None)` — sends `Idempotency-Key`; agent `Bearer` key
- `payment_intents.list(agent_id=None)/get/audit/execute (agent auth)/execute_user (user auth)`
- `approvals.list(status=None)/approve/reject`
- `overview.get()`, `transactions.list()`, `audit.list()`
- `notifications.list(limit=None)/test(type=...)`, `reconciliation.exceptions/run()`
- `webhooks.test({payment_id, event_type})`
- Errors raise `FrameError { code, status, message, request_id }` (alias `requestId`) parsed from `{ error: { code, message, request_id } }`
- Helpers: `new_idempotency_key()`, `inr_to_paise()`, `paise_to_inr()`, `to_paise_number()`, `DEFAULT_BASE_URL`

Bodiless POSTs (`agents.disable/enable/rotate_key`, `payment_intents.execute/execute_user`, `reconciliation.run`) send **no** `Content-Type` header (Fastify rejects empty JSON bodies).

Demo: `python3 examples/demo_flow.py` (needs live API at `localhost:4100`).

Tests: `python3 -m unittest discover -s tests` (stubbed opener, no network).
