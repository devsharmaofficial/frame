CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "email" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "password_hash" text NOT NULL,
  "role" text NOT NULL DEFAULT 'admin',
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "users_org_idx" ON "users" ("organization_id");

CREATE TABLE IF NOT EXISTS "agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "name" text NOT NULL,
  "description" text,
  "owner" text,
  "environment" text NOT NULL DEFAULT 'sandbox',
  "purpose" text,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agents_org_idx" ON "agents" ("organization_id");

CREATE TABLE IF NOT EXISTS "agent_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "agent_id" uuid NOT NULL REFERENCES "agents"("id"),
  "key_prefix" text NOT NULL,
  "key_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "last_used_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "revoked_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "agent_credentials_org_idx" ON "agent_credentials" ("organization_id");
CREATE INDEX IF NOT EXISTS "agent_credentials_agent_idx" ON "agent_credentials" ("agent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_credentials_key_hash_idx" ON "agent_credentials" ("key_hash");

CREATE TABLE IF NOT EXISTS "policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "agent_id" uuid NOT NULL REFERENCES "agents"("id"),
  "name" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'active',
  "current_version_id" uuid,
  "active_version" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "policies_org_idx" ON "policies" ("organization_id");
CREATE INDEX IF NOT EXISTS "policies_agent_idx" ON "policies" ("agent_id");

CREATE TABLE IF NOT EXISTS "policy_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "policy_id" uuid NOT NULL REFERENCES "policies"("id"),
  "version" integer NOT NULL,
  "config" jsonb NOT NULL,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "policy_versions_org_idx" ON "policy_versions" ("organization_id");
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policy_id_version_key" UNIQUE ("policy_id", "version");

CREATE TABLE IF NOT EXISTS "payment_intents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "agent_id" uuid NOT NULL,
  "policy_version_id" uuid REFERENCES "policy_versions"("id"),
  "amount_paise" bigint NOT NULL,
  "currency" text NOT NULL DEFAULT 'INR',
  "merchant" text NOT NULL,
  "merchant_reference" text,
  "purpose" text,
  "task_reference" text,
  "intent_hash" text,
  "status" text NOT NULL DEFAULT 'CREATED',
  "decision" text,
  "reasons" jsonb,
  "idempotency_key" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "payment_intents_org_idx" ON "payment_intents" ("organization_id");
CREATE INDEX IF NOT EXISTS "payment_intents_agent_idx" ON "payment_intents" ("agent_id");
CREATE INDEX IF NOT EXISTS "payment_intents_status_idx" ON "payment_intents" ("status");
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_org_idempotency_key" UNIQUE ("organization_id", "idempotency_key");

CREATE TABLE IF NOT EXISTS "payment_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "payment_intent_id" uuid NOT NULL REFERENCES "payment_intents"("id"),
  "decision" text NOT NULL,
  "reasons" jsonb NOT NULL,
  "policy_version_id" uuid,
  "decided_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "payment_decisions_org_idx" ON "payment_decisions" ("organization_id");
CREATE INDEX IF NOT EXISTS "payment_decisions_intent_idx" ON "payment_decisions" ("payment_intent_id");

CREATE TABLE IF NOT EXISTS "approval_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "payment_intent_id" uuid NOT NULL UNIQUE REFERENCES "payment_intents"("id"),
  "required_role" text NOT NULL DEFAULT 'admin',
  "requested_at" timestamp with time zone DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL,
  "decision" text NOT NULL DEFAULT 'pending',
  "approved_by" uuid REFERENCES "users"("id"),
  "approved_at" timestamp with time zone,
  "rejected_by" uuid REFERENCES "users"("id"),
  "rejected_at" timestamp with time zone,
  "comment" text,
  "escalated_at" timestamp with time zone,
  "escalated_to" text,
  "sla_minutes" integer DEFAULT 1440,
  "source_task_id" uuid REFERENCES "approval_tasks"("id")
);

CREATE INDEX IF NOT EXISTS "approval_tasks_org_idx" ON "approval_tasks" ("organization_id");
CREATE INDEX IF NOT EXISTS "approval_tasks_decision_idx" ON "approval_tasks" ("decision");

CREATE TABLE IF NOT EXISTS "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "payment_intent_id" uuid NOT NULL REFERENCES "payment_intents"("id"),
  "provider" text NOT NULL DEFAULT 'sandbox',
  "provider_payment_id" text,
  "amount_paise" bigint NOT NULL,
  "currency" text NOT NULL DEFAULT 'INR',
  "status" text NOT NULL DEFAULT 'PENDING',
  "error_code" text,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "payments_org_idx" ON "payments" ("organization_id");
CREATE INDEX IF NOT EXISTS "payments_intent_idx" ON "payments" ("payment_intent_id");
ALTER TABLE "payments" ADD CONSTRAINT "payments_provider_provider_payment_id_key" UNIQUE ("provider", "provider_payment_id");

CREATE TABLE IF NOT EXISTS "payment_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "payment_id" uuid NOT NULL REFERENCES "payments"("id"),
  "attempt_number" integer NOT NULL DEFAULT 1,
  "provider_status" text,
  "error_code" text,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "payment_attempts_org_idx" ON "payment_attempts" ("organization_id");
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_id_attempt_number_key" UNIQUE ("payment_id", "attempt_number");

CREATE TABLE IF NOT EXISTS "provider_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "payment_id" uuid REFERENCES "payments"("id"),
  "provider" text NOT NULL DEFAULT 'sandbox',
  "event_type" text NOT NULL,
  "raw_payload" jsonb NOT NULL,
  "received_at" timestamp with time zone DEFAULT now(),
  "processed" boolean NOT NULL DEFAULT false,
  "dedup_key" text UNIQUE
);

CREATE INDEX IF NOT EXISTS "provider_events_org_idx" ON "provider_events" ("organization_id");

CREATE TABLE IF NOT EXISTS "ledger_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "payment_intent_id" uuid REFERENCES "payment_intents"("id"),
  "payment_id" uuid REFERENCES "payments"("id"),
  "entry_type" text NOT NULL,
  "amount_paise" bigint NOT NULL,
  "currency" text NOT NULL DEFAULT 'INR',
  "provider_reference" text,
  "previous_hash" text,
  "entry_hash" text NOT NULL UNIQUE,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ledger_entries_org_idx" ON "ledger_entries" ("organization_id");
CREATE INDEX IF NOT EXISTS "ledger_entries_intent_idx" ON "ledger_entries" ("payment_intent_id");

CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "actor_type" text NOT NULL,
  "actor_id" uuid,
  "action" text NOT NULL,
  "resource_type" text,
  "resource_id" text,
  "entity_before" jsonb,
  "entity_after" jsonb,
  "request_id" text,
  "policy_version_id" uuid,
  "decision" text,
  "previous_hash" text,
  "entry_hash" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_events_org_idx" ON "audit_events" ("organization_id");
CREATE INDEX IF NOT EXISTS "audit_events_action_idx" ON "audit_events" ("action");

CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "event_type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "destination_url" text,
  "status" text NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "delivered_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "webhook_deliveries_org_idx" ON "webhook_deliveries" ("organization_id");
CREATE INDEX IF NOT EXISTS "webhook_deliveries_status_idx" ON "webhook_deliveries" ("status");

CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "scope" text NOT NULL,
  "key" text NOT NULL,
  "response_code" integer,
  "response_body" jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_org_scope_key" UNIQUE ("organization_id", "scope", "key");

CREATE TABLE IF NOT EXISTS "providers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "name" text NOT NULL,
  "provider_type" text NOT NULL,
  "config" jsonb NOT NULL DEFAULT '{}',
  "status" text NOT NULL DEFAULT 'active',
  "default_route" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  UNIQUE("organization_id", "name")
);

CREATE INDEX IF NOT EXISTS "providers_org_idx" ON "providers" ("organization_id");
CREATE INDEX IF NOT EXISTS "providers_status_idx" ON "providers" ("status");

CREATE TABLE IF NOT EXISTS "mandates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "agent_id" uuid NOT NULL REFERENCES "agents"("id"),
  "name" text NOT NULL,
  "schedule_cron" text NOT NULL,
  "amount_paise" bigint NOT NULL,
  "currency" text NOT NULL DEFAULT 'INR',
  "merchant" text,
  "category" text,
  "max_executions" integer NOT NULL DEFAULT 0,
  "executed_count" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'draft',
  "next_execution" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "mandates_org_status_idx" ON "mandates" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "mandates_agent_idx" ON "mandates" ("agent_id");
CREATE INDEX IF NOT EXISTS "mandates_next_execution_idx" ON "mandates" ("next_execution") WHERE "status" = 'active';


CREATE INDEX IF NOT EXISTS "approval_tasks_escalation_idx" ON "approval_tasks" ("organization_id", "decision", "escalated_at");

ALTER TABLE "agents" ADD COLUMN "webhook_url" text;
ALTER TABLE "webhook_deliveries" ADD COLUMN "source" text NOT NULL DEFAULT 'inbound';
ALTER TABLE "ledger_entries" ADD COLUMN "category" text;

ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "provider_type" text;
