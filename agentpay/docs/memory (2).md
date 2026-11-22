# Frame — Project Memory / Operating Context

## 1. Project Identity

Project:

> Frame

Current thesis:

> **Financial control plane for AI agents.**

Frame provides controlled financial authority to software agents without trusting the agent itself.

---

# 2. What Exists Today

The current project contains:

- Fastify backend
- PostgreSQL
- Redis
- BullMQ
- Next.js dashboard
- Agent identities
- API-key authentication
- Payment Authorities
- Policy Firewall
- Payment Intents
- Payment Orchestrator
- Provider Registry
- Razorpay sandbox adapter
- Webhook verification
- Reconciliation
- Double-entry ledger
- Refund flow
- Audit events
- MCP server
- TS SDK
- Python SDK
- AI shopping agent
- Playwright browser automation
- Demo merchant
- Human approval
- Intent binding
- Prompt injection controls
- sensitive credential scanner
- SSRF/domain controls
- cost/runaway controls
- external agent API

---

# 3. Current Truth Classification

## Working / real in code

- agent identities
- payment authorities
- policy evaluation
- MCP integration
- browser automation
- human approval
- sandbox payment path
- ledger
- reconciliation
- audit events
- security test suite

## Sandbox / controlled environment

- Razorpay payment execution
- demo merchant fulfillment
- current shopping merchant

## Not yet a production capability

- unrestricted general web shopping
- production live payment volume
- autonomous UPI PIN entry
- broad multi-merchant production network
- fully distributed agent execution
- production-grade browser network isolation

Never remove these distinctions in future documentation.

---

# 4. Strategic Position

Frame is NOT:

```text
"an AI that can shop"
```

Frame IS:

```text
"the authorization layer that allows AI agents to act financially within explicit boundaries."
```

The shopping agent exists to make the infrastructure visible.

---

# 5. Strategic Enemy

The main risk is not another shopping agent.

The main risk is:

> payment networks, PSPs, agent platforms, and large infrastructure companies absorbing authorization/policy functionality into their existing stacks.

Therefore Frame must become more than "a policy engine."

---

# 6. Strategic Moat

Target moat:

## A. Authority Graph

```text
Principal
 → Organization
 → Agent
 → Authority
 → Transaction
```

## B. Intent Binding

```text
Human intent
 → structured intent
 → checkout snapshot
 → transaction
```

## C. Evidence Graph

```text
intent
 → policy
 → approval
 → provider
 → ledger
 → outcome
```

## D. Multi-Rail Abstraction

Same agent integration.

Different payment rails underneath.

## E. Trust Layer

Future:

```text
agent identity
 + attestation
 + authority
 + risk
 + transaction history
```

---

# 7. Most Important Technical Debt

## P0

1. Agent API authentication / run authorization
2. Cross-tenant run isolation
3. Atomic authority reservation

## P1

4. PostgreSQL agent-run persistence
5. stronger transaction binding
6. browser network isolation
7. DNS/redirect hardening
8. authoritative merchant payment confirmation

## P2

9. second merchant integration
10. second provider/rail
11. advanced risk engine
12. enterprise controls

---

# 8. Current Architecture Direction

Preferred:

```text
AI Agent
   ↓
MCP / SDK
   ↓
Frame API
   ↓
Identity
   ↓
Authority
   ↓
Intent
   ↓
Policy
   ↓
Risk
   ↓
Approval
   ↓
Payment Intent
   ↓
Orchestrator
   ↓
Provider
   ↓
Webhook
   ↓
Reconciliation
   ↓
Ledger
   ↓
Evidence
```

---

# 9. Agent Architecture

```text
User
 ↓
LLM
 ↓
Intent compiler
 ↓
Browser
 ↓
Merchant adapter
 ↓
Checkout canonicalization
 ↓
Frame MCP
 ↓
Payment
```

The agent remains untrusted.

Frame remains authoritative.

---

# 10. Product Vocabulary

Use:

- Agent
- Principal
- Authority
- Intent
- Policy
- Decision
- Approval
- Payment Intent
- Provider
- Rail
- Evidence
- Settlement
- Reconciliation

Avoid ambiguous phrases:

- "AI wallet" unless a real wallet exists
- "autonomous UPI" unless supported by a legitimate production rail
- "production payment" for sandbox behavior
- "exactly once" unless a provider contract proves it

---

# 11. Non-Negotiable Safety Boundary

Frame never solves autonomous payment by collecting a user's:

- UPI PIN
- OTP
- bank password
- CVV

Do not weaken this rule for demos.

---

# 12. Key Domain Invariants

### Invariant 1
Agent cannot self-authorize.

### Invariant 2
Agent cannot modify its own authority.

### Invariant 3
A revoked authority cannot authorize new execution.

### Invariant 4
A transaction above authority scope cannot execute.

### Invariant 5
Material checkout changes invalidate the intent binding.

### Invariant 6
Unknown external payment outcome remains UNKNOWN until reconciled.

### Invariant 7
Ledger must never record an unauthorized payment.

### Invariant 8
Cross-tenant data must never be visible.

### Invariant 9
Human approval is bound to a specific transaction.

### Invariant 10
Financial authorization is deterministic.

---

# 13. Open Strategic Questions

These must be answered through customer discovery, not assumptions:

1. Which ICP has the most urgent financial-agent problem?
2. Is the first buyer an AI company, enterprise, fintech, merchant platform, or PSP?
3. Which workflow has enough transaction frequency to justify infrastructure adoption?
4. Which compliance burden are customers willing to pay Frame to own?
5. Which payment rails will Frame realistically access in production?
6. Will customers integrate Frame directly or through existing agent platforms?
7. Does evidence/audit become a budget line?
8. What exact switching cost emerges after adoption?

---

# 14. Falsification Tests

Frame should be considered strategically weak if:

### Test A
AI companies say:
> "We can build this inside our own application."

### Test B
PSPs offer equivalent authority/policy controls for free.

### Test C
Payment networks expose the complete same abstraction and developers prefer using them directly.

### Test D
Customers care only about payment execution and not agent authorization/evidence.

### Test E
No customer is willing to pay before production scale.

If any of these become true, revisit positioning.

---

# 15. Metrics That Matter Most

### Product
- successful agent payment intents
- active authorities
- authorization latency
- approval latency
- denial/block rate
- provider success rate
- UNKNOWN rate

### Security
- prevented unauthorized transactions
- prompt injections blocked
- merchant substitutions blocked
- cross-tenant failures
- authority abuse attempts

### Business
- active design partners
- paid pilots
- payment volume
- revenue
- retention
- expansion

---

# 16. Future Agent Instruction

Any coding agent working on Frame must follow:

```text
1. Read this memory first.
2. Read architecture.md.
3. Read rules.md.
4. Inspect current code before proposing rewrites.
5. Never rebuild working systems without evidence.
6. Never claim a sandbox feature is production.
7. Preserve tenant isolation.
8. Preserve fail-closed financial decisions.
9. Treat Frame as the control plane.
10. Update docs when architecture changes.
```

---

# 17. CTO Decision Log

### Decision
Shopping agent is reference client, not core company.

### Decision
Payment Authority is a first-class domain object.

### Decision
Policy decisions are deterministic.

### Decision
MCP is a first-class integration surface.

### Decision
Provider abstraction is mandatory.

### Decision
PostgreSQL becomes the production source of truth for agent execution.

### Decision
Unknown provider outcomes are reconciled, not blindly retried.

### Decision
Production browser execution must be isolated.

### Decision
Frame should integrate with payment rails rather than compete with the rails themselves.

---

# 18. Long-Term Product Direction

Potential evolution:

```text
Phase 1
Payment authorization

        ↓

Phase 2
Agent transaction control

        ↓

Phase 3
Agent trust + evidence

        ↓

Phase 4
Enterprise agent action control

        ↓

Phase 5
Cross-rail agent authorization infrastructure
```

The long-term opportunity is broader than shopping:

> **A trusted execution and authorization layer for software agents that can cause financial consequences.**

Payments are the first and most valuable action domain.
