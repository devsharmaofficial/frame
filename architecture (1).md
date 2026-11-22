# Frame — Technical Architecture

## 1. Architecture Objective

Frame must be a **payment-control plane**, not a monolithic shopping application.

Primary separation:

```text
                        ┌───────────────────┐
                        │      HUMAN        │
                        └─────────┬─────────┘
                                  │
                              instruction
                                  │
                                  ▼
                        ┌───────────────────┐
                        │     AI AGENT      │
                        │ LLM + Browser     │
                        └─────────┬─────────┘
                                  │ MCP / SDK
                                  ▼
                 ┌────────────────────────────────┐
                 │             FRAME              │
                 │                                │
                 │ Agent Identity                 │
                 │ Authority                       │
                 │ Intent Compiler                 │
                 │ Policy Firewall                 │
                 │ Risk                            │
                 │ Approval                        │
                 │ Payment Intent                  │
                 │ Orchestrator                    │
                 │ Evidence / Ledger               │
                 └──────────────┬─────────────────┘
                                │
                    Provider / Rail Adapters
                                │
                ┌───────────────┼─────────────────┐
                ▼               ▼                 ▼
             UPI/PSP          Cards         Other rails
```

---

# 2. Logical Components

## API Gateway

Responsibilities:
- authentication
- tenant derivation
- rate limiting
- request validation
- idempotency
- correlation IDs

---

## Identity Service

Objects:

```text
Organization
User
Agent
Credential
Session
```

Rule:

> Agent identity comes from authenticated credentials, never from request payload.

---

## Authority Service

Object:

```text
PaymentAuthority
```

Responsibilities:
- scope
- spending limits
- expiry
- merchant/category allowlists
- frequency
- approval threshold
- revocation

---

## Intent Service

Converts user-level/agent-level requests into a structured financial intent.

Input:
- agent proposal
- checkout facts

Output:
- canonical intent

Intent is immutable after authorization boundary.

---

## Policy Firewall

Deterministic.

Input:

```text
agent
authority
intent
merchant
category
amount
risk
history
policy
```

Output:

```text
ALLOW
REQUIRE_APPROVAL
DENY
UNKNOWN
```

Rules must be deterministic and testable.

---

## Risk Engine

Risk is separate from policy.

Example:

```text
Policy: ALLOW
Risk: HIGH
Final: REQUIRE_APPROVAL
```

Never allow the risk engine to weaken a hard DENY.

---

## Payment Orchestrator

Responsibilities:
- create payment intent
- select provider
- execute
- manage state
- idempotency
- timeout handling
- retry rules
- webhook reconciliation

---

## Provider Registry

Interface:

```ts
interface PaymentProvider {
  createPayment(...)
  getPayment(...)
  capturePayment(...)
  refundPayment(...)
  verifyWebhook(...)
  reconcile(...)
}
```

Capabilities should be explicit:

```text
SANDBOX
PRODUCTION
UPI
CARD
MANDATE
REFUND
WEBHOOK
```

---

# 3. Agent Runtime

Agent runtime is separate from Frame backend.

Components:

```text
Agent API
Agent Worker
LLM Provider
React Loop
Browser Controller
Merchant Adapter
Intent Compiler
Security Scanner
Frame MCP Client
Execution Store
```

Production version:

```text
Agent API
   ↓
PostgreSQL
   ↓
BullMQ
   ↓
Agent Worker
```

---

# 4. Browser Security Architecture

Do not rely only on URL filtering.

Production:

```text
Agent Worker
   ↓
Browser Sandbox
   ↓
Restricted Egress Proxy
   ↓
Domain Policy
   ↓
Internet
```

Rules:
- no host networking
- no cloud metadata
- no private IP access
- no arbitrary redirects
- allowlist revalidation
- isolated browser profile per run
- no persistence of cookies across tenants

---

# 5. Data Architecture

Use PostgreSQL as source of truth.

Core tables:

```text
organizations
users
agents
credentials
payment_authorities
authority_reservations
policies
policy_versions
payment_intents
intent_bindings
approval_tasks
payments
payment_attempts
provider_events
ledger_entries
audit_events
webhook_deliveries
idempotency_keys

agent_runs
agent_steps
agent_events
tool_calls
interventions
run_artifacts
```

---

# 6. Authority Reservation Model

Instead of:

```text
spent = spent + amount
```

use reservation semantics:

```text
AVAILABLE
   ↓
RESERVED
   ↓
SETTLED
```

On failure:

```text
RESERVED
   ↓
RELEASED
```

On UNKNOWN:

```text
RESERVED
   ↓
PENDING_RECONCILIATION
```

This prevents concurrent overspend.

---

# 7. Transaction Binding

Create a canonical JSON representation:

```text
agent
authority
merchant
product
variant
quantity
price
shipping
tax
total
currency
purpose
policy_version
authority_version
```

Canonicalize.

Hash.

Store:

```text
intent_hash
checkout_hash
approval_hash
```

Execution must verify hashes again.

---

# 8. Evidence Chain

Every transaction creates:

```text
IntentCreated
AuthorityChecked
PolicyEvaluated
CheckoutVerified
ApprovalGranted?
PaymentAuthorized
ProviderRequest
ProviderResponse
WebhookReceived
LedgerPosted
FulfillmentConfirmed
```

Events reference:

```text
previous_event_hash
current_event_hash
```

This makes the evidence tamper-evident.

---

# 9. Queue Architecture

Queues:

```text
agent.run
payment.execute
payment.reconcile
payment.webhook
refund.execute
audit.export
```

Every job must contain IDs, not secrets.

Use:
- retries with backoff
- dead-letter queues
- job idempotency
- visibility timeouts where applicable

---

# 10. Concurrency Model

Every financially meaningful transition needs transactional safety.

Use:
- DB transactions
- row locks where needed
- optimistic versioning where suitable
- idempotency keys
- monotonic state transitions

Never rely on application memory for financial correctness.

---

# 11. MCP Architecture

```text
External Agent
      ↓
Frame MCP Server
      ↓
Auth Context
      ↓
Tenant Context
      ↓
Frame Application Services
```

MCP must call domain services.

It must never directly mutate DB records.

---

# 12. Provider Boundary

Frame should know:

```text
"payment succeeded"
```

not:

```text
Razorpay-specific internal behavior
```

Provider adapters normalize external states into Frame states.

Example:

```text
Razorpay:
captured → SUCCEEDED
authorized → PROCESSING
timeout → UNKNOWN
refunded → REFUNDED
```

---

# 13. Webhook Architecture

```text
Provider
 ↓
Webhook Gateway
 ↓
Signature Validation
 ↓
Replay / Dedup
 ↓
Provider Event Store
 ↓
Payment State Machine
 ↓
Ledger / Reconciliation
```

Webhook handlers must be safe to replay.

---

# 14. Reliability Guarantees

Frame should explicitly guarantee:

### Internal idempotency
The same Frame intent cannot create duplicate internal settlement.

### Monotonic state
Terminal states cannot regress.

### At-most-once ledger posting
Unique constraints protect ledger entries.

### Ambiguous outcomes
Provider uncertainty → UNKNOWN, then reconciliation.

Do not promise exactly-once execution across an external provider unless the provider contract actually provides it.

---

# 15. Authentication

Environment-separated keys:

```text
frm_test_...
frm_live_...
```

Store hashes, not raw secrets.

Production improvements:
- key rotation
- expiration
- scoped keys
- IP restrictions
- service identities
- short-lived session credentials where possible

---

# 16. Observability

Every request gets:

```text
request_id
trace_id
organization_id
agent_id
run_id
payment_intent_id
payment_id
provider_id
```

Metrics:

- authorization latency
- policy outcomes
- provider latency
- UNKNOWN rate
- approval latency
- reconciliation mismatch
- queue lag
- agent tool-call count
- LLM cost

---

# 17. Deployment

Recommended:

```text
                    Load Balancer
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
          API replicas         MCP replicas
              │                     │
              └──────────┬──────────┘
                         ▼
                    PostgreSQL
                         │
                       Redis
                         │
                     BullMQ
                         │
                   Worker pool
                         │
       ┌─────────────────┼────────────────┐
       ▼                 ▼                ▼
   Agent workers    Payment workers   Reconcile workers
```

Secrets:
- cloud secret manager
- no secrets in git
- no secrets in logs

---

# 18. Environment Model

```text
LOCAL
TEST
SANDBOX
PRODUCTION
```

Every provider credential is environment-scoped.

Never allow a test agent to access live provider credentials.

---

# 19. Scaling Strategy

Scale independently:

- API
- MCP
- agent workers
- payment workers
- browser workers
- reconciliation workers

Browser workers should be isolated because they are the highest-risk compute boundary.

---

# 20. Future Control Plane Expansion

Once payments are stable, the same architecture can authorize:

```text
booking
purchase
subscription
refund
payout
transfer
financial action
```

Long-term architecture:

> Agent Action Control Plane

Payment is the first high-value action category.

