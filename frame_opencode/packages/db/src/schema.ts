import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  bigint,
  timestamp,
  boolean,
  integer,
  index,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

function eq(col: any, val: any) {
  return sql`${col} = ${val}` as any;
}

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("admin"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("users_org_idx").on(t.organizationId)]
);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    description: text("description"),
    owner: text("owner"),
    environment: text("environment").notNull().default("sandbox"),
    purpose: text("purpose"),
    status: text("status").notNull().default("active"),
    webhookUrl: text("webhook_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("agents_org_idx").on(t.organizationId)]
);

export const agentCredentials = pgTable(
  "agent_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    status: text("status").notNull().default("active"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    index("agent_credentials_org_idx").on(t.organizationId),
    index("agent_credentials_agent_idx").on(t.agentId),
    uniqueIndex("agent_credentials_key_hash_idx").on(t.keyHash),
  ]
);

export const policies = pgTable(
  "policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    currentVersionId: uuid("current_version_id"),
    activeVersion: integer("active_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("policies_org_idx").on(t.organizationId),
    index("policies_agent_idx").on(t.agentId),
  ]
);

export const policyVersions = pgTable(
  "policy_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => policies.id),
    version: integer("version").notNull(),
    config: jsonb("config").notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("policy_versions_org_idx").on(t.organizationId),
    unique("policy_versions_policy_id_version_key").on(t.policyId, t.version),
  ]
);

export const paymentIntents = pgTable(
  "payment_intents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    agentId: uuid("agent_id").notNull(),
    policyVersionId: uuid("policy_version_id").references(
      () => policyVersions.id
    ),
    amountPaise: bigint("amount_paise", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull().default("INR"),
    merchant: text("merchant").notNull(),
    merchantReference: text("merchant_reference"),
    purpose: text("purpose"),
    taskReference: text("task_reference"),
    intentHash: text("intent_hash"),
    status: text("status").notNull().default("CREATED"),
    decision: text("decision"),
    reasons: jsonb("reasons"),
    idempotencyKey: text("idempotency_key").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("payment_intents_org_idx").on(t.organizationId),
    index("payment_intents_agent_idx").on(t.agentId),
    index("payment_intents_status_idx").on(t.status),
    unique("payment_intents_org_idempotency_key").on(
      t.organizationId,
      t.idempotencyKey
    ),
  ]
);

export const paymentDecisions = pgTable(
  "payment_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    paymentIntentId: uuid("payment_intent_id")
      .notNull()
      .references(() => paymentIntents.id),
    decision: text("decision").notNull(),
    reasons: jsonb("reasons").notNull(),
    policyVersionId: uuid("policy_version_id"),
    decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("payment_decisions_org_idx").on(t.organizationId),
    index("payment_decisions_intent_idx").on(t.paymentIntentId),
  ]
);

export const approvalTasks = pgTable("approval_tasks", {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    paymentIntentId: uuid("payment_intent_id")
      .notNull()
      .references(() => paymentIntents.id),
    requiredRole: text("required_role").notNull().default("admin"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    decision: text("decision").notNull().default("pending"),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedBy: uuid("rejected_by").references(() => users.id),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    comment: text("comment"),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    escalatedTo: text("escalated_to"),
    slaMinutes: integer("sla_minutes").default(1440),
    sourceTaskId: uuid("source_task_id"),
  },
  (t) => [
    index("approval_tasks_org_idx").on(t.organizationId),
    index("approval_tasks_decision_idx").on(t.decision),
    index("approval_tasks_org_status_escalated_idx").on(t.organizationId, t.decision, t.escalatedAt),
  ]
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    paymentIntentId: uuid("payment_intent_id")
      .notNull()
      .references(() => paymentIntents.id),
    provider: text("provider").notNull().default("sandbox"),
    providerPaymentId: text("provider_payment_id"),
    amountPaise: bigint("amount_paise", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull().default("INR"),
    status: text("status").notNull().default("PENDING"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("payments_org_idx").on(t.organizationId),
    index("payments_intent_idx").on(t.paymentIntentId),
    unique("payments_provider_provider_payment_id_key").on(
      t.provider,
      t.providerPaymentId
    ),
  ]
);

export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    attemptNumber: integer("attempt_number").notNull().default(1),
    providerStatus: text("provider_status"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("payment_attempts_org_idx").on(t.organizationId),
    unique("payment_attempts_payment_id_attempt_number_key").on(
      t.paymentId,
      t.attemptNumber
    ),
  ]
);

export const providerEvents = pgTable(
  "provider_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    paymentId: uuid("payment_id").references(() => payments.id),
    provider: text("provider").notNull().default("sandbox"),
    eventType: text("event_type").notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow(),
    processed: boolean("processed").notNull().default(false),
    dedupKey: text("dedup_key").unique(),
  },
  (t) => [index("provider_events_org_idx").on(t.organizationId)]
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    paymentIntentId: uuid("payment_intent_id").references(
      () => paymentIntents.id
    ),
    paymentId: uuid("payment_id").references(() => payments.id),
    entryType: text("entry_type").notNull(),
    amountPaise: bigint("amount_paise", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull().default("INR"),
    providerReference: text("provider_reference"),
    previousHash: text("previous_hash"),
    entryHash: text("entry_hash").notNull().unique(),
    category: text("category"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("ledger_entries_org_idx").on(t.organizationId),
    index("ledger_entries_intent_idx").on(t.paymentIntentId),
  ]
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    actorType: text("actor_type").notNull(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    entityBefore: jsonb("entity_before"),
    entityAfter: jsonb("entity_after"),
    requestId: text("request_id"),
    policyVersionId: uuid("policy_version_id"),
    decision: text("decision"),
    previousHash: text("previous_hash"),
    entryHash: text("entry_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("audit_events_org_idx").on(t.organizationId),
    index("audit_events_action_idx").on(t.action),
  ]
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    destinationUrl: text("destination_url"),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    source: text("source").notNull().default("inbound"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (t) => [
    index("webhook_deliveries_org_idx").on(t.organizationId),
    index("webhook_deliveries_status_idx").on(t.status),
    index("webhook_deliveries_source_idx").on(t.source),
  ]
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    responseCode: integer("response_code"),
    responseBody: jsonb("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique("idempotency_keys_org_scope_key").on(
      t.organizationId,
      t.scope,
      t.key
    ),
  ]
);

export const providers = pgTable(
  "providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    providerType: text("provider_type").notNull(),
    config: jsonb("config").notNull().default({}),
    status: text("status").notNull().default("active"),
    defaultRoute: boolean("default_route").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("providers_org_idx").on(t.organizationId),
    index("providers_status_idx").on(t.status),
    unique("providers_org_name").on(t.organizationId, t.name),
  ]
);

export const mandates = pgTable(
  "mandates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id),
    name: text("name").notNull(),
    scheduleCron: text("schedule_cron").notNull(),
    amountPaise: bigint("amount_paise", { mode: "bigint" }),
    currency: text("currency").notNull().default("INR"),
    merchant: text("merchant"),
    category: text("category"),
    maxExecutions: integer("max_executions").notNull().default(0),
    executedCount: integer("executed_count").notNull().default(0),
    status: text("status").notNull().default("draft"),
    nextExecution: timestamp("next_execution", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("mandates_org_status_idx").on(t.organizationId, t.status),
    index("mandates_agent_idx").on(t.agentId),
    index("mandates_next_execution_idx").on(t.nextExecution).where(eq(t.status, "active")),
  ]
);
