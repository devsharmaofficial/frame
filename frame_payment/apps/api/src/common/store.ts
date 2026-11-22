import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type Organization = { id: string; name: string; createdAt: string };
export type Agent = { id: string; organizationId: string; name: string; status: "ACTIVE" | "DISABLED"; createdAt: string };
export type Credential = { id: string; agentId: string; organizationId: string; keyHash: string; createdAt: string; revokedAt?: string };
export type Policy = { id: string; organizationId: string; agentId: string; version: number; transactionLimitMinor: number; approvalThresholdMinor?: number; allowedMerchants: string[]; active: boolean; createdAt: string };
export type PaymentIntent = {
  id: string; organizationId: string; agentId: string; policyId: string; policyVersion: number; approvalId?: string;
  amountMinor: number; currency: string; merchant: string; purpose: string; status: "AUTHORIZED" | "DENIED" | "PENDING_APPROVAL" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "EXPIRED";
  decision: "ALLOW" | "DENY" | "REQUIRE_APPROVAL"; idempotencyKey: string; expiresAt: string; createdAt: string;
};
export type Approval = { id: string; organizationId: string; paymentIntentId: string; status: "PENDING" | "APPROVED" | "REJECTED"; createdAt: string };
export type AuditEvent = { id: string; organizationId: string; action: string; entityId: string; requestId: string; metadata: Record<string, unknown>; createdAt: string };

export type Store = ReturnType<typeof createStore>;

type PersistedStore = {
  organizations: Organization[];
  agents: Agent[];
  credentials: Credential[];
  policies: Policy[];
  intents: PaymentIntent[];
  approvals: Approval[];
  audit: AuditEvent[];
  idempotency: Array<[string, PaymentIntent]>;
};

export function createStore(filePath?: string) {
  const organizations = new Map<string, Organization>();
  const agents = new Map<string, Agent>();
  const credentials = new Map<string, Credential>();
  const policies = new Map<string, Policy>();
  const intents = new Map<string, PaymentIntent>();
  const approvals = new Map<string, Approval>();
  const audit: AuditEvent[] = [];
  const idempotency = new Map<string, PaymentIntent>();
  const now = () => new Date().toISOString();
  const id = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const persist = () => {
    if (!filePath) return;
    mkdirSync(dirname(filePath), { recursive: true });
    const data: PersistedStore = {
      organizations: [...organizations.values()],
      agents: [...agents.values()],
      credentials: [...credentials.values()],
      policies: [...policies.values()],
      intents: [...intents.values()],
      approvals: [...approvals.values()],
      audit,
      idempotency: [...idempotency.entries()],
    };
    writeFileSync(filePath, JSON.stringify(data, null, 2));
  };
  if (filePath && existsSync(filePath)) {
    const data = JSON.parse(readFileSync(filePath, "utf8")) as PersistedStore;
    for (const item of data.organizations ?? []) organizations.set(item.id, item);
    for (const item of data.agents ?? []) agents.set(item.id, item);
    for (const item of data.credentials ?? []) credentials.set(item.id, item);
    for (const item of data.policies ?? []) policies.set(item.id, item);
    for (const item of data.intents ?? []) intents.set(item.id, item);
    for (const item of data.approvals ?? []) approvals.set(item.id, item);
    audit.push(...(data.audit ?? []));
    for (const item of data.idempotency ?? []) idempotency.set(item[0], item[1]);
  }
  if (organizations.size === 0) {
    organizations.set("org_default", { id: "org_default", name: "Acme Labs", createdAt: now() });
  }
  if (agents.size === 0) {
    const seededAgents = [
      { id: "agt_devops", organizationId: "org_default", name: "DevOps Agent", status: "ACTIVE" as const, createdAt: now() },
      { id: "agt_procurement", organizationId: "org_default", name: "Procurement Agent", status: "ACTIVE" as const, createdAt: now() },
      { id: "agt_marketing", organizationId: "org_default", name: "Marketing Agent", status: "ACTIVE" as const, createdAt: now() },
    ];
    for (const agent of seededAgents) agents.set(agent.id, agent);
    policies.set("pol_devops", { id: "pol_devops", organizationId: "org_default", agentId: "agt_devops", version: 1, transactionLimitMinor: 100000, approvalThresholdMinor: 50000, allowedMerchants: ["AWS", "Cloudflare"], active: true, createdAt: now() });
    policies.set("pol_procurement", { id: "pol_procurement", organizationId: "org_default", agentId: "agt_procurement", version: 1, transactionLimitMinor: 100000, approvalThresholdMinor: 10000, allowedMerchants: [], active: true, createdAt: now() });
    policies.set("pol_marketing", { id: "pol_marketing", organizationId: "org_default", agentId: "agt_marketing", version: 1, transactionLimitMinor: 25000, approvalThresholdMinor: 5000, allowedMerchants: [], active: true, createdAt: now() });
  }
  return { organizations, agents, credentials, policies, intents, approvals, audit, idempotency, now, id, persist };
}
