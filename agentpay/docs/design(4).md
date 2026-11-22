# Frame — Product & System Design

## 1. Design Philosophy

Frame should feel like:

> **Stripe-quality developer infrastructure + enterprise authorization system + security control plane.**

The UI is not the moat.

The system should be:
- minimal
- predictable
- inspectable
- policy-first
- audit-first
- developer-friendly

---

# 2. Primary User Experience

## Developer onboarding

```text
Create organization
      ↓
Create agent
      ↓
Create authority
      ↓
Attach policy
      ↓
Copy MCP / SDK config
      ↓
Create first sandbox payment
```

Goal:

> first successful payment intent in <15 minutes.

---

# 3. Agent Developer UX

### Agent setup

Show:

- Agent name
- Agent ID
- status
- owner
- environment
- last seen
- permissions
- authorities

Never show secrets after initial creation.

---

# 4. Payment Authority UX

Authority is the core control object.

Example:

```yaml
name: Procurement Agent
status: ACTIVE

limits:
  per_transaction: ₹5,000
  daily: ₹25,000
  monthly: ₹2,00,000

scope:
  categories:
    - office_supplies
  merchants:
    - approved.example

approval:
  above: ₹5,000

validity:
  starts: ...
  expires: ...
```

UI should make this understandable to non-engineers.

---

# 5. Policy UX

Policies should read like rules, not SQL.

Example:

> This agent may spend up to ₹5,000 per transaction and ₹25,000 per day on approved office-supply merchants. Purchases above ₹5,000 require approval.

Show the compiled rule underneath.

---

# 6. Payment Intent UX

Every intent detail page must show:

### Intent

- user instruction summary
- agent
- authority
- merchant
- amount
- currency
- purpose

### Decision

```text
ALLOW
REQUIRE_APPROVAL
DENY
UNKNOWN
```

### Why

Human-readable policy explanation.

### Evidence

- intent hash
- authority version
- policy version
- checkout snapshot hash
- provider
- provider payment ID
- webhook IDs

---

# 7. Approval UX

Approval must show exactly what is being approved.

Display:

```text
AGENT
AUTHORITY
MERCHANT
ITEM
VARIANT
QUANTITY
TOTAL
POLICY EXCEPTION
RISK
EXPIRY
```

Actions:

```text
Approve
Reject
Cancel
```

Approval should explicitly mean:

> "Approve this exact transaction snapshot."

---

# 8. Transaction Timeline

Example:

```text
12:01:02 Intent created
12:01:03 Authority validated
12:01:03 Policy evaluated
12:01:03 Checkout verified
12:01:04 Payment intent authorized
12:01:05 Provider processing
12:01:06 Webhook received
12:01:06 Payment settled
12:01:06 Ledger posted
12:01:07 Merchant fulfilled
```

No raw chain-of-thought.

Only operational events.

---

# 9. Security UI

Add an "Evidence / Security" tab.

Show:

- policy checks
- authority checks
- intent binding
- domain checks
- injection checks
- credential scanner
- approval
- provider verification

Example:

```text
✓ Agent authenticated
✓ Authority active
✓ Merchant allowed
✓ Category allowed
✓ Budget within limit
✓ Checkout unchanged
✓ No sensitive credentials requested
✓ Payment provider verified
```

---

# 10. API Design

Use resource-oriented REST + MCP.

Example:

```http
POST /v1/payment-intents
GET  /v1/payment-intents/:id
POST /v1/payment-intents/:id/cancel

GET  /v1/payment-authorities
POST /v1/payment-authorities
POST /v1/payment-authorities/:id/revoke

GET  /v1/payments/:id
POST /v1/payments/:id/refund

GET  /v1/agents
POST /v1/agents

GET  /v1/audit-events
```

Agent runtime:

```http
POST /v1/agent-runs
GET  /v1/agent-runs/:id
POST /v1/agent-runs/:id/resume
POST /v1/agent-runs/:id/cancel
POST /v1/agent-runs/:id/intervention
GET  /v1/agent-runs/:id/events
```

All must authenticate.

---

# 11. MCP Design

MCP must expose actions, not internals.

Preferred tools:

```text
frame_get_payment_authority
frame_list_payment_authorities
frame_create_payment_intent
frame_get_payment_intent
frame_get_payment_status
frame_request_approval
```

Future tools:

```text
frame_get_policy_explanation
frame_get_transaction_evidence
frame_cancel_payment
```

Never expose:
- DB queries
- secret credentials
- internal ledger mutation
- provider private APIs
- admin operations

---

# 12. Merchant Integration Design

Canonical merchant interface:

```text
MerchantAdapter
 ├─ discoverProducts()
 ├─ getProduct()
 ├─ addToCart()
 ├─ getCheckout()
 ├─ placeOrder()
 ├─ verifyPayment()
 ├─ getOrder()
 └─ requestRefund()
```

Merchant adapters must not implement Frame policy logic.

They provide facts.

Frame decides permission.

---

# 13. Intent Design

Canonical intent:

```json
{
  "agent_id": "...",
  "purpose": "...",
  "item": {
    "type": "...",
    "product_id": "...",
    "variant_id": "..."
  },
  "quantity": 1,
  "constraints": {
    "max_amount": 300000,
    "currency": "INR",
    "allowed_merchants": [],
    "allowed_categories": []
  }
}
```

All money values are integer minor units.

No floating-point money.

---

# 14. State Machines

## Agent Run

```text
CREATED
 ↓
PLANNING
 ↓
BROWSING
 ↓
CHECKOUT
 ↓
AWAITING_AUTHORIZATION
 ↓
PAYMENT
 ↓
FULFILLMENT
 ↓
SUCCEEDED
```

Terminal failures:

```text
DENIED
CANCELLED
FAILED
EXPIRED
```

Human branch:

```text
AWAITING_AUTHORIZATION
 ↓
WAITING_FOR_HUMAN_APPROVAL
 ↓
RESUMED
```

---

# 15. Payment State

```text
CREATED
EVALUATING
AUTHORIZED
PENDING_APPROVAL
PROCESSING
SUCCEEDED
FAILED
UNKNOWN
REFUNDED
```

UNKNOWN must never be converted to FAILED without reconciliation.

---

# 16. Error UX

Every failure needs:

- stable machine error code
- safe human explanation
- retry recommendation
- audit event

Examples:

```text
AUTHORITY_INACTIVE
POLICY_DENIED
BUDGET_EXCEEDED
INTENT_MISMATCH
MERCHANT_NOT_ALLOWED
CHECKOUT_CHANGED
MCP_UNAVAILABLE
PROVIDER_TIMEOUT
PAYMENT_UNKNOWN
```

---

# 17. Dashboard Information Architecture

```text
Overview
Agents
Payment Authorities
Policies
Payment Intents
Transactions
Approvals
Audit
Providers
Webhooks
Developers
Settings
```

---

# 18. Design Constraint

The dashboard is for humans.

MCP/SDK is for agents/developers.

Do not blur these interfaces.

---

# 19. Evidence UX

Every transaction gets an exportable:

```text
Frame Transaction Evidence Receipt
```

Containing:

- transaction ID
- principal
- agent
- authority
- intent hash
- policy version
- merchant
- amount
- decision
- approval
- provider outcome
- ledger outcome
- timestamps
- hashes

This becomes a strategic product artifact.

