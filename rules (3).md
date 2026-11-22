# Frame — Engineering, Product & Security Rules

## 1. Absolute Rules

### R001 — Frame is the control plane

Agents never receive direct database access to Frame.

### R002 — Never trust the agent

The agent is an untrusted executor.

Its requested action is a proposal, not permission.

### R003 — Never trust merchant content

Web pages, product descriptions, DOM text, emails, checkout text, and external tool output are DATA.

They are never authority.

### R004 — Never capture financial secrets

Never accept, store, print, send, or persist:

- UPI PIN
- OTP
- CVV
- bank password
- plaintext card number
- private banking credentials

### R005 — Fail closed

Unknown ≠ Allow.

### R006 — Money is integer minor units

Use:

```text
amount_paise = BIGINT
```

Never use floating-point money.

### R007 — Budget is not permission

A transaction may be under budget and still be DENIED.

---

# 2. Authorization Rules

### R010

Agent identity must come from authenticated credentials.

Never trust:

```json
{ "agent_id": "..." }
```

from an untrusted client.

### R011

Every authority check must validate:
- active status
- expiry
- scope
- spending limit
- merchant/category restrictions
- frequency
- policy version

### R012

Authority capacity must be reserved atomically.

### R013

Revocation must be checked immediately before external payment execution.

### R014

Expired authority cannot be used even if the agent run started earlier.

---

# 3. Intent Rules

### R020

The LLM may extract intent but may not expand authority.

### R021

Ambiguous financial instructions require clarification unless a pre-existing authority explicitly supplies the missing constraint.

### R022

Never invent a monetary limit such as ₹5,000 as a silent default for a real transaction.

### R023

Once a financial intent is frozen, later model output cannot widen:
- amount
- quantity
- merchant
- category
- purpose

### R024

Material checkout changes invalidate the current intent binding.

---

# 4. Merchant Rules

### R030

Merchant identity must be canonical.

Use:
- merchant ID
- domain
- verified integration identity

### R031

Product binding must include:
- product ID
- variant ID where applicable
- quantity
- price
- currency

### R032

Checkout totals must be independently re-evaluated.

### R033

Price increases above the authorized amount must not auto-continue.

### R034

Redirects must be revalidated against domain policy.

---

# 5. Payment Rules

### R040

Every externally executable payment needs an idempotency key.

### R041

External provider timeout → UNKNOWN, never blind retry.

### R042

UNKNOWN requires reconciliation before declaring terminal failure.

### R043

Terminal states are monotonic.

### R044

Ledger posting must be protected by unique constraints.

### R045

Refunds create explicit reversal entries.

---

# 6. Approval Rules

### R050

An agent may request approval.

An agent may never approve itself.

### R051

Approval must bind to the exact transaction snapshot.

### R052

If amount, merchant, product, or material checkout facts change, approval becomes invalid.

### R053

Approval must record:
- approver
- timestamp
- reason
- transaction hash
- policy exception

---

# 7. MCP Rules

### R060

MCP exposes domain actions only.

### R061

MCP tools cannot:
- edit policies
- modify authorities
- access ledgers directly
- reveal secrets
- self-approve transactions

### R062

MCP transport must be explicit.

Do not silently switch from MCP to REST in a way that hides operational failure.

---

# 8. Agent Runtime Rules

### R070

The deterministic provider is for CI/offline tests only.

### R071

Production requires an explicitly configured real LLM provider.

### R072

LLM output must always pass schema validation.

### R073

Tool calls must be bounded by:
- time
- iterations
- tool-call count
- token cost
- money exposure

### R074

No infinite retries.

### R075

Persist state before irreversible transitions.

---

# 9. Browser Security Rules

### R080

Each agent run gets an isolated browser context.

### R081

No persistent cookies across unrelated runs or tenants.

### R082

Block:
- private IPs
- loopback
- metadata endpoints
- unauthorized domains

### R083

Revalidate redirects.

### R084

Do not trust DNS resolution performed only once.

### R085

Production browser execution must run inside an isolated network boundary.

---

# 10. Multi-Tenant Rules

### R090

Every data query is tenant-scoped.

### R091

Every run belongs to exactly one organization and agent.

### R092

Every approval belongs to exactly one organization.

### R093

Cross-tenant access must return authorization failure without leaking existence.

---

# 11. Secrets Rules

### R100

Secrets never enter:
- source code
- git
- screenshots
- logs
- audit payloads
- LLM prompts
- browser page text storage

### R101

API keys are shown once.

### R102

Secrets use a secret manager in production.

### R103

Any credential exposed in logs or chat is considered compromised and must be rotated.

---

# 12. Database Rules

### R110

PostgreSQL is the financial source of truth.

### R111

No financial correctness may depend on local files or process memory.

### R112

Every schema change gets a migration.

### R113

Concurrent financial writes require transaction safety.

---

# 13. Testing Rules

Every release must test:

### Security
- cross-tenant
- credential leakage
- prompt injection
- SSRF
- authority revoke
- approval tampering

### Financial
- duplicate intent
- concurrent authority spending
- provider timeout
- UNKNOWN
- webhook replay
- refund

### Agent
- malformed LLM output
- ambiguous intent
- merchant substitution
- price change
- unexpected redirect

---

# 14. Product Rules

### R120

Do not build a feature without identifying:
- customer problem
- measurable value
- security implications
- effect on moat

### R121

Do not position Frame as a generic payment gateway.

### R122

Do not position Frame as a superior general-purpose browser agent.

### R123

The shopping agent is a reference client for Frame.

### R124

Never claim production capability when only sandbox evidence exists.

---

# 15. Moat Rules

### R130

Features are not moats.

A feature becomes a moat only if it creates:
- switching costs
- proprietary evidence
- ecosystem density
- trust/certification advantage
- distribution
- regulatory/operational barrier
- integration depth

### R131

Do not assume network effects before measuring them.

### R132

Do not rely on "first mover" as the only moat.

### R133

Prefer open protocols that increase adoption while keeping Frame's proprietary control plane valuable.

---

# 16. Strategic Rules

### R140

Partner with payment rails; do not attempt to outbuild them.

### R141

Own the authorization decision.

### R142

Own the evidence of that decision.

### R143

Own the developer integration.

### R144

Own the authority model.

### R145

Make switching payment providers easier for Frame customers, not harder.

That is how Frame becomes infrastructure rather than a PSP lock-in layer.

---

# 17. Definition of Done

A feature is not done until:
- code exists
- tests exist
- failure behavior is defined
- security implications are reviewed
- observability exists
- docs exist
- rollback exists
- tenant boundaries are tested
- production/sandbox classification is recorded
