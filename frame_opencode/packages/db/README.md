# @frame/db

Drizzle ORM schema and database utilities for Frame.

## Setup

```bash
# Start PostgreSQL
docker compose up -d postgres

# Set DATABASE_URL
export DATABASE_URL="postgresql://frame:frame_dev_password@localhost:5432/frame"

# Generate Drizzle migration
npm run generate

# Run migrations
npm run migrate

# Seed demo data
npm run seed
```

## Schema

All tables use UUID primary keys with `gen_random_uuid()`, `organization_id` FK (multi-tenant), and UTC timestamps.

### Tables

| Table | Description |
|---|---|
| `organizations` | Tenant root |
| `users` | Org members with roles |
| `agents` | AI agent registrations |
| `agent_credentials` | API keys (sha256 hashed) |
| `policies` | Spending policies per agent |
| `policy_versions` | Immutable policy configs |
| `payment_intents` | Pre-authorized payment requests |
| `payment_decisions` | Policy engine decisions |
| `approval_tasks` | Human-in-the-loop approvals |
| `payments` | Executed payments |
| `payment_attempts` | Provider retry attempts |
| `provider_events` | Webhook events from providers |
| `ledger_entries` | Double-entry ledger (debit/credit) |
| `audit_events` | Immutable audit trail |
| `webhook_deliveries` | Outbound webhook tracking |
| `idempotency_keys` | Request deduplication |

### Money

All monetary amounts are stored as `bigint` in **paise** (INR minor units, 1/100 of a rupee). Never use floating point for money.

### Passwords

Demo seed uses sha256 hex hashes. Production will use bcrypt.

## Exports

```ts
import { db, pool } from "@frame/db/drizzle";
import { organizations, users } from "@frame/db/schema";
```
