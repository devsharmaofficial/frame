# Frame — Engineering & Product Phases

## Operating Principle

Do not add features randomly.

Every phase must either:
1. remove a material security/compliance risk,
2. prove a critical product assumption,
3. improve distribution,
4. deepen the control-plane moat, or
5. unlock live transaction volume.

---

# Phase 0 — Baseline Freeze

### Goal
Freeze the current MVP as the reference baseline.

### Actions
- tag current release
- record current tests
- export schema/migration state
- document supported vs unsupported capabilities
- preserve working sandbox demo

### Exit
Reproducible clean deployment from scratch.

---

# Phase 1 — P0 Security Hardening

### Goal
Close known trust-boundary holes.

### Build

1. Authenticate every `/agent/*` endpoint.
2. Derive tenant and agent identity only from authenticated credentials.
3. Enforce run ownership.
4. Enforce approval ownership.
5. Prevent one agent from reading another agent's events.
6. Enforce authorization on resume/cancel/intervention.
7. Add rate limits per tenant/agent.
8. Add security audit events for administrative actions.

### Exit

Automated tests prove:

```text
cross-tenant read = DENY
cross-agent read = DENY
cross-agent resume = DENY
cross-agent cancel = DENY
```

---

# Phase 2 — Atomic Financial Authority

### Goal
Make spending limits correct under concurrency.

### Build

Replace:

```text
check budget
→ execute
→ record spend
```

with:

```text
authorize
→ reserve authority capacity atomically
→ execute
→ settle reservation
```

Introduce:

```text
available
reserved
settled
released
```

### Requirements

- PostgreSQL transaction
- row-level locking or atomic conditional update
- idempotency
- reservation expiry
- release on failure
- correct handling of UNKNOWN

### Exit

10–100 concurrent payment attempts cannot overspend one authority.

---

# Phase 3 — Persistent Agent Runtime

### Goal
Remove file-based execution state as the production architecture.

### Build

PostgreSQL tables:

- agent_runs
- agent_steps
- agent_events
- tool_calls
- interventions
- approvals
- run_artifacts

BullMQ handles execution jobs.

### Exit

Agent worker can restart without losing run state.

Two workers cannot execute the same payment step concurrently.

---

# Phase 4 — Transaction Integrity

### Goal
Bind approval and payment to an exact transaction snapshot.

### Build

Transaction snapshot must include:

- agent_id
- authority_id
- merchant_id/domain
- product_id
- variant_id
- quantity
- currency
- item total
- shipping
- tax
- final total
- purpose
- policy version
- authority version

Create:

```text
transaction_binding_hash
approval_hash
```

### Exit

Any material modification invalidates the binding.

---

# Phase 5 — Real Merchant Contract

### Goal
Prove Frame survives more than one storefront implementation.

### Build

Merchant integration contract:

```text
discover
product
cart
checkout
payment_pending
payment_verified
order_status
refund
```

Support at least two independent merchant implementations.

Prefer one:
- custom HTML merchant

and one:
- Shopify/headless-style merchant

### Exit

Same Frame control plane handles both without changing authorization logic.

---

# Phase 6 — Production Network Security

### Goal
Move browser security from application checks toward infrastructure controls.

### Build

- browser sandbox/container
- restricted egress
- explicit domain allowlist
- redirect revalidation
- DNS resolution controls
- IPv4/IPv6 private-range handling
- cloud metadata blocking
- per-run network policy
- navigation audit logs

### Exit

Security review cannot reach:
- internal services
- metadata endpoints
- unauthorized domains
- private network resources

---

# Phase 7 — Multi-Rail Provider Layer

### Goal
Make Frame meaningfully rail agnostic.

### Build provider interface:

```text
authorize
create_payment
get_payment
capture
refund
verify_webhook
reconcile
```

Provider states:

```text
MOCK
SANDBOX
PRODUCTION
```

Never mix them.

### Exit

At least two materially different provider integrations behind one Frame contract.

---

# Phase 8 — Live Rail Pilot

### Goal
Move from technical capability to real money movement.

### Work

- provider KYB/KYC
- production keys
- webhooks
- reconciliation
- refund
- settlement
- incident procedures
- customer terms
- transaction monitoring

### Exit

First controlled production transaction with contractual/legal owner identified.

---

# Phase 9 — Authority Protocol

### Goal
Turn Payment Authority into a platform primitive.

### API

```text
create authority
get authority
rotate
revoke
suspend
expire
scope
```

Authority should support:

- spend limits
- merchants
- categories
- time windows
- frequency
- approval threshold
- purpose
- rail restrictions
- geography
- risk constraints

### Exit

A third-party agent developer can use Frame without understanding internal payment implementation.

---

# Phase 10 — Evidence Graph

### Goal
Make Frame the system of record for agentic financial decisions.

### Build

Every transaction produces linked evidence:

```text
principal
→ authority
→ user intent
→ agent action
→ merchant evidence
→ policy decision
→ approval
→ payment
→ provider event
→ ledger
→ fulfillment
```

Add tamper-evident hashes.

### Exit

One transaction can be reconstructed end-to-end from immutable evidence.

---

# Phase 11 — Risk Engine

### Goal
Go beyond simple spend rules.

Signals:

- merchant reputation
- transaction velocity
- unusual amount
- unusual category
- authority age
- agent behavior
- failed attempts
- policy changes
- checkout changes
- destination risk

Output:

```text
LOW
MEDIUM
HIGH
UNKNOWN
```

Risk never overrides hard policy.

---

# Phase 12 — Developer Platform

### Goal
Make Frame an infrastructure product, not a founder-operated demo.

Build:

- self-serve onboarding
- API keys
- MCP setup
- SDK quickstarts
- test mode
- webhooks
- event explorer
- sandbox merchants
- authority templates
- example agents

Target:

> developer → first successful sandbox payment < 15 minutes

---

# Phase 13 — Design Partner Program

### Goal
Validate product-market fit.

Acquire 3–5 serious design partners.

Prefer:

1. AI-native commerce
2. procurement/expense agents
3. travel/service agents
4. enterprise workflow agents

For each partner measure:

- transaction volume
- prevented failures
- approval rate
- operational savings
- integration time
- willingness to pay

---

# Phase 14 — Moat Expansion

### Goal
Turn product features into structural defensibility.

Build:

### Authority portability
One authority model across rails.

### Policy portability
Organizations can keep their rules while changing payment providers.

### Evidence portability
Standard transaction/audit receipt usable by merchants, providers and enterprises.

### Agent trust
Agent identity + attestation + reputation.

### Integration density
More agents and providers increase usefulness of the control layer.

---

# Phase 15 — Enterprise Controls

Add:

- SSO
- SCIM
- RBAC
- approval groups
- policy versioning
- four-eyes approvals
- separation of duties
- organization-wide limits
- budget hierarchies
- retention policies
- exportable audit logs

---

# Phase 16 — Rail / Protocol Adaptation

Frame should adapt to emerging agentic payment protocols rather than compete with payment networks.

Build adapters around:
- delegated UPI capabilities
- mandates / preauthorization primitives
- card-network agent protocols
- provider-specific agent wallets
- emerging machine-payment protocols

Rule:

> **Frame owns the policy layer; payment networks own settlement.**

---

# Phase 17 — Agent Security Platform

Expand from payment security into action security.

Potential future controls:

```text
payment
booking
purchase
subscription
refund
transfer
payout
```

Each action can use:

```text
identity
authority
intent
policy
risk
approval
evidence
```

This creates a wider "agent action authorization" platform.

---

# Phase 18 — Production Reliability

Targets:

- multi-region strategy
- queue durability
- database failover
- provider circuit breakers
- webhook replay
- reconciliation jobs
- disaster recovery
- key rotation
- observability
- incident response

---

# Phase 19 — Economic Engine

Add commercial primitives:

- usage billing
- per-authorized-intent pricing
- enterprise subscriptions
- transaction pricing where legally/economically viable
- committed-volume pricing

Do not optimize for payment volume alone.

Optimize for:

> value of controlled agent activity.

---

# Phase 20 — Network Effect Validation

Do not assume network effects.

Prove one of:

```text
more providers → more useful to agents
more agents → more valuable to providers
more transaction evidence → better risk decisions
more authority templates → faster onboarding
```

Only then call it a network effect.

---

# Phase 21 — Production Certification

Target:

- external security review
- penetration testing
- privacy review
- compliance mapping
- operational controls
- contractual terms
- enterprise security questionnaire package

---

# Phase 22 — Scale

Only after repeatable PMF:

- additional countries
- additional payment rails
- additional verticals
- enterprise distribution
- strategic partnerships

---

# Phase Gates

No phase advances because code was written.

Advance only when the acceptance criterion is measurable.

Example:

```text
Phase 2 gate:
100 concurrent authority tests
0 overspend

Phase 5 gate:
2 merchant implementations
0 authorization regressions

Phase 13 gate:
3 design partners
at least 1 willing to pay

Phase 14 gate:
documented switching cost / integration advantage
```

