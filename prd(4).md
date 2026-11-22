# Frame — Product Requirements Document

## 0. Document Status

- Product: Frame
- Role: financial control plane / authorization infrastructure for AI agents
- Document type: forward-looking CTO PRD
- Status: Active
- Primary deployment target: India first, multi-rail architecture
- Current maturity: working MVP; sandbox-first; production payment onboarding is not complete

---

## 1. Executive Product Thesis

Frame must become the **authorization and control layer between autonomous software agents and payment rails**.

Frame is not primarily:
- a shopping assistant
- a payment gateway
- a browser automation framework
- an LLM platform
- a bank
- a replacement for UPI/card rails

Frame is:

> **A programmable authority layer that decides whether an AI agent is allowed to turn an instruction into a financial transaction, under which exact constraints, and produces verifiable evidence of what happened.**

The central product primitive is:

```text
Principal
  ↓ delegates
Agent Identity
  ↓ operates under
Payment Authority
  ↓ constrained by
Intent + Policy + Risk
  ↓ creates
Payment Intent
  ↓ executed through
Payment Rail
  ↓ produces
Transaction + Audit Evidence
```

---

## 2. Problem

AI agents can increasingly search, compare, browse, negotiate, and execute actions. The payment stack was designed primarily around humans, merchants, wallets/cards, and application-controlled transactions.

The missing infrastructure problem is not merely "how does an agent send money?"

The real problem is:

1. Who is this agent?
2. Who authorized it?
3. What is it allowed to spend?
4. For what purpose?
5. With which merchants or categories?
6. Under what time and frequency constraints?
7. What exact user intent was the transaction bound to?
8. What happens when the checkout changes?
9. What happens when the merchant or webpage is malicious?
10. When must a human approve?
11. How is every decision audited?
12. How can a PSP or payment rail be swapped without rebuilding the agent application?

Generic payment APIs solve execution.

Frame must solve **controlled delegation**.

---

## 3. Core Product

### 3.1 Frame Control Plane

Core services:

- Agent Identity
- Principal / organization ownership
- Payment Authorities
- Intent Compiler
- Policy Firewall
- Transaction Risk Controls
- Payment Intent API
- Provider / Rail Orchestrator
- Human Approval
- Idempotency
- Ledger
- Reconciliation
- Audit Evidence
- Webhooks
- SDKs
- MCP interface

### 3.2 Reference Agent

The shopping agent is a first-party/reference client used to prove the platform:

```text
User
 ↓
AI Shopping Agent
 ↓
Browser / merchant
 ↓
Canonical checkout
 ↓
Frame
 ↓
Payment rail
```

The shopping agent is not the company thesis. It is the best demonstration of the thesis.

---

## 4. Primary Users

### Beachhead ICP

AI-native companies building agents that need to transact.

Examples:
- commerce agents
- procurement agents
- travel/booking agents
- operations agents
- expense agents
- service agents
- vertical AI platforms
- fintechs adding agentic functionality

### Secondary ICP

Enterprises that want internal agents with controlled financial authority.

Example:

> "Allow our procurement agent to buy office supplies up to ₹25,000/day from approved merchants without requiring a human for every purchase."

### Future ICP

- payment providers
- banks
- marketplaces
- merchant platforms
- agent platforms
- infrastructure providers

---

## 5. Core Use Cases

### UC-01 — Controlled Autonomous Purchase

User delegates:

> Buy office supplies up to ₹5,000/day from approved merchants.

Frame:
- authenticates agent
- validates authority
- verifies intent
- checks policy
- executes through configured rail
- records evidence

### UC-02 — Approval Escalation

If transaction crosses a configured threshold:

```text
ALLOW → normal execution
REQUIRE_APPROVAL → pause
DENY → terminate
```

Human approval must be bound to the exact transaction snapshot.

### UC-03 — Intent Protection

User says:

> Buy a mechanical keyboard under ₹3,000.

Checkout becomes ₹3,499.

Frame must reject the transaction.

### UC-04 — Merchant / Category Restrictions

Authority may allow:

```text
category = OFFICE_SUPPLIES
merchant = allowlist
daily_limit = ₹25,000
per_tx = ₹5,000
```

### UC-05 — Revocation

If authority is revoked while an agent is running:

```text
pending execution → re-evaluate → DENY
```

### UC-06 — Audit / Dispute Evidence

Produce:

```text
who
what
why
which policy
which authority
which merchant
which amount
which checkout snapshot
which payment provider
which approval
which outcome
```

---

## 6. Product Principles

### P1 — Frame owns authorization, not intelligence

The LLM may propose an action.

Frame decides whether the action is financially permissible.

### P2 — Budget is not permission

Remaining budget alone never authorizes a transaction.

### P3 — Immutable intent

Once financial constraints are frozen, downstream agent output cannot silently widen them.

### P4 — Fail closed

Unknown policy state, unknown authority state, missing merchant identity, malformed checkout, or ambiguous approval must never become ALLOW by fallback.

### P5 — No credential capture

Frame must never receive/store:
- UPI PIN
- OTP
- CVV
- bank password
- plaintext card credentials

### P6 — Rail agnostic

The agent should integrate with Frame once, not separately with every payment rail.

### P7 — Evidence is a first-class product

Auditability is not an afterthought. Every payment decision must produce machine-verifiable evidence.

---

## 7. MVP Scope

### Must Have

- Agent identities
- Payment authorities
- Policy engine
- Intent model
- Payment intents
- Approval workflow
- MCP server
- TS/Python SDKs
- Provider abstraction
- Razorpay sandbox
- Webhooks
- Idempotency
- Ledger
- Reconciliation
- Audit events
- Agent browser reference implementation
- Developer onboarding
- Run persistence
- Multi-tenant isolation
- security test suite

### Must Not Become

- generic browser automation SaaS
- consumer wallet first
- merchant marketplace first
- LLM provider
- payment processor without a clear licensed/partner model

---

## 8. Production Acceptance Criteria

Frame is not considered production-ready until:

### Security

- every agent endpoint authenticated
- every resource tenant-scoped
- run ownership enforced
- approval ownership enforced
- atomic authority reservation
- no secret leakage
- SSRF/network isolation tested
- redirect validation
- concurrency tests pass

### Payment

- at least one production rail/provider live
- authoritative payment status verified
- webhook signature verification
- reconciliation
- refund path verified
- ambiguous provider outcomes handled as UNKNOWN

### Agent

- persistent state in PostgreSQL
- distributed worker execution
- resumable runs
- deterministic step transitions
- real LLM path separated from CI deterministic provider

### Merchant

- at least two independently implemented merchant experiences
- canonical checkout extraction
- product/variant binding
- price/shipping/tax verification
- payment confirmation tied to authoritative provider result

### Operations

- metrics
- tracing
- alerting
- audit retention
- incident runbooks
- rate limits
- abuse controls

---

## 9. Success Metrics

Product metrics:

- active agent identities
- active payment authorities
- payment intents/month
- authorized payment volume
- approval rate
- denial rate
- transaction completion rate
- median authorization latency
- provider failure rate
- reconciliation mismatch rate
- fraud / attack block rate
- merchant integration time
- developer time-to-first-payment

Business metrics:

- design partners
- paying customers
- monthly recurring revenue
- payment volume
- gross margin
- retention
- expansion
- net revenue per customer

Technical reliability targets:

- authorization decision p95 < 300 ms excluding external provider latency
- zero unauthorized payment executions in controlled tests
- zero cross-tenant access
- no double debit for an idempotent intent
- 100% terminal-state audit coverage

---

## 10. Moat-Building Product Requirements

Frame must progressively own five layers:

1. **Authority graph**
   - principal → organization → agent → authority → transaction

2. **Intent binding**
   - user intent → structured constraints → transaction snapshot

3. **Policy execution**
   - deterministic policy and risk evaluation

4. **Evidence graph**
   - signed decision/evidence chain connecting every event

5. **Multi-rail control**
   - one agent integration → multiple payment providers / rails

These are more defensible than the shopping UI itself.

---

## 11. Strategic Non-Goals

Frame should not try to win by:
- building a superior general-purpose browser agent
- outspending Visa/Mastercard on payment rails
- becoming the next generic PSP
- becoming a consumer-facing shopping destination
- owning every merchant integration directly

The strategic goal is to make Frame **infrastructure that other agents use**.

---

## 12. Product Wedge

Initial wedge:

> Give AI agents bounded financial authority.

Not:

> Let AI agents pay.

The distinction is the product.

---

## 13. North Star

Every agentic transaction should be answerable with:

> **"Who authorized this agent to do this exact transaction, under what rules, through which rail, and what evidence proves the decision?"**

Frame wins when that answer can be retrieved instantly and trusted.

