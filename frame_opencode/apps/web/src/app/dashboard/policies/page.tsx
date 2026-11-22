"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type Agent, type Policy, type PolicyConfig, type PolicyVersion } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { StatusBadge, statusTone } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Amount } from "@/components/Amount";
import { toast } from "@/components/Toast";
import { formatDateTime, shortId } from "@/lib/utils";

function inrToPaise(value: string): number {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function paiseToRupeesLabel(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `₹${(n / 100).toLocaleString("en-IN")}`;
}

function configFields(config: PolicyConfig | undefined): Array<[string, string]> {
  if (!config) return [];
  const rows: Array<[string, string]> = [];
  if (config.monthlyLimitPaise != null) rows.push(["Monthly limit", paiseToRupeesLabel(config.monthlyLimitPaise)]);
  if (config.dailyLimitPaise != null) rows.push(["Daily limit", paiseToRupeesLabel(config.dailyLimitPaise)]);
  if (config.transactionLimitPaise != null) rows.push(["Transaction limit", paiseToRupeesLabel(config.transactionLimitPaise)]);
  if (config.approvalThresholdPaise != null) rows.push(["Approval threshold", paiseToRupeesLabel(config.approvalThresholdPaise)]);
  if (config.allowedMerchants?.length) rows.push(["Allowed merchants", (config.allowedMerchants as string[]).join(", ")]);
  if (config.blockedMerchants?.length) rows.push(["Blocked merchants", (config.blockedMerchants as string[]).join(", ")]);
  if (config.restrictedCategories?.length) rows.push(["Restricted categories", (config.restrictedCategories as string[]).join(", ")]);
  return rows;
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [configs, setConfigs] = useState<Record<string, PolicyConfig>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [conflictPolicyId, setConflictPolicyId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [dailyLimit, setDailyLimit] = useState("");
  const [transactionLimit, setTransactionLimit] = useState("");
  const [approvalThreshold, setApprovalThreshold] = useState("");
  const [allowedMerchants, setAllowedMerchants] = useState("");
  const [blockedMerchants, setBlockedMerchants] = useState("");
  const [restrictedCategories, setRestrictedCategories] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    api
      .get<Policy[]>("/policies")
      .then((list) => {
        setPolicies(list);
        // listPolicies returns bare policy rows (no config). Fetch each
        // policy's versions best-effort so cards can show configured limits.
        Promise.all(
          list.map((p) =>
            api
              .get<PolicyVersion[]>(`/policies/${p.id}/versions`)
              .then((vs) => ({ id: p.id, config: [...vs].sort((a, b) => a.version - b.version).slice(-1)[0]?.config }))
              .catch(() => ({ id: p.id, config: undefined })),
          ),
        ).then((entries) => {
          const map: Record<string, PolicyConfig> = {};
          for (const e of entries) {
            if (e.config) map[e.id] = e.config;
          }
          setConfigs(map);
        });
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load policies");
        setPolicies([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    api
      .get<Agent[]>("/agents")
      .then(setAgents)
      .catch(() => setAgents([]));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    setConflictPolicyId(null);
    if (!name.trim() || !agentId) {
      setFormError("Name and agent are required.");
      return;
    }
    setCreating(true);
    try {
      await api.post("/policies", {
        name,
        agentId,
        monthlyLimitPaise: inrToPaise(monthlyLimit),
        dailyLimitPaise: inrToPaise(dailyLimit),
        transactionLimitPaise: inrToPaise(transactionLimit),
        approvalThresholdPaise: inrToPaise(approvalThreshold),
        allowedMerchants: allowedMerchants
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        blockedMerchants: blockedMerchants
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        restrictedCategories: restrictedCategories
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setShowNew(false);
      resetForm();
      toast.success("Policy created", "Version v1 is now active for the selected agent.");
      load();
    } catch (err) {
      if (err instanceof ApiError && (err.code === "POLICY_EXISTS" || err.status === 409)) {
        // One active policy per agent — point the user at the existing one.
        const existing = policies.find((p) => p.agentId === agentId);
        setConflictPolicyId(existing?.id ?? null);
        setFormError(
          `${err.message} Each agent holds a single active policy; edit it to publish a new version instead.`,
        );
      } else {
        setFormError(err instanceof ApiError ? err.message : "Failed to create the policy.");
      }
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setName("");
    setAgentId("");
    setMonthlyLimit("");
    setDailyLimit("");
    setTransactionLimit("");
    setApprovalThreshold("");
    setAllowedMerchants("");
    setBlockedMerchants("");
    setRestrictedCategories("");
  }

  function agentName(id: string): string {
    return agents.find((a) => a.id === id)?.name ?? shortId(id);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Policies</h1>
          <p className="page-subtitle">
            Deterministic limits that gate every agent payment. Every edit creates a new immutable version.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          New Policy
        </button>
      </div>

      {loadError ? (
        <EmptyState
          icon="!"
          title="Unable to load policies"
          body={loadError}
          action={<button className="btn" onClick={load}>Retry</button>}
        />
      ) : loading ? (
        <div className="skeleton" style={{ height: 220 }} />
      ) : policies.length === 0 ? (
        <EmptyState
          title="No policies yet"
          body="Create a policy and attach it to an agent so the firewall can authorize spend."
          action={
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>
              New Policy
            </button>
          }
        />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {policies.map((policy) => {
            const config =
              configs[policy.id] ??
              (policy as unknown as { currentVersionConfig?: PolicyVersion["config"] })
                .currentVersionConfig;
            return (
              <div className="card" key={policy.id}>
                <div className="card-header">
                  <div>
                    <Link href={`/dashboard/policies/${policy.id}`} className="row-title" style={{ fontSize: 14 }}>
                      {policy.name}
                    </Link>
                    <div className="row-sub">{agentName(policy.agentId)}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <StatusBadge status={policy.status} className={statusTone(policy.status)} />
                    <span className="mono faint" style={{ fontSize: 11 }}>
                      v{policy.activeVersion}
                    </span>
                  </div>
                </div>
                <div className="card-body">
                  {configFields(config).length === 0 ? (
                    <div className="muted" style={{ fontSize: 13 }}>
                      No configured limits yet.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {configFields(config).slice(0, 5).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
                          <span className="muted">{k}</span>
                          <span className="mono">{v}</span>
                        </div>
                      ))}
                      {configFields(config).length > 5 ? (
                        <div className="faint" style={{ fontSize: 12 }}>
                          +{configFields(config).length - 5} more fields
                        </div>
                      ) : null}
                    </div>
                  )}
                  <Link
                    href={`/dashboard/policies/${policy.id}`}
                    className="link-btn"
                    style={{ display: "inline-block", marginTop: 12 }}
                  >
                    Edit policy →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={showNew}
        title="New Policy"
        onClose={() => setShowNew(false)}
        wide
        footer={
          <>
            <button className="btn" onClick={() => setShowNew(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              form="new-policy-form"
              type="submit"
              disabled={creating || !name.trim() || !agentId}
            >
              {creating ? <span className="spinner" /> : null} Create policy
            </button>
          </>
        }
      >
        {formError ? (
          <div className="form-error" role="alert">
            {formError}{" "}
            {conflictPolicyId ? (
              <Link href={`/dashboard/policies/${conflictPolicyId}`} className="link-btn">
                Edit existing policy instead →
              </Link>
            ) : formError.includes("already has") ? (
              <Link href="/dashboard/policies" className="link-btn" onClick={() => setShowNew(false)}>
                Edit existing policy instead →
              </Link>
            ) : null}
          </div>
        ) : null}
        <form id="new-policy-form" onSubmit={handleCreate}>
          <div className="field">
            <label className="field-label" htmlFor="policy-name">
              Policy name
            </label>
            <input
              id="policy-name"
              className="input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cloud Infra"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="policy-agent">
              Agent
            </label>
            <select
              id="policy-agent"
              className="select"
              required
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              <option value="">Select an agent…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.environment})
                </option>
              ))}
            </select>
            {agents.length === 0 ? (
              <span className="field-hint">No agents available. Create an agent first.</span>
            ) : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label className="field-label" htmlFor="policy-monthly">
                Monthly limit (₹)
              </label>
              <input
                id="policy-monthly"
                className="input mono"
                type="number"
                min="0"
                step="0.01"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                placeholder="1000000"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="policy-daily">
                Daily limit (₹)
              </label>
              <input
                id="policy-daily"
                className="input mono"
                type="number"
                min="0"
                step="0.01"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                placeholder="100000"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="policy-tx">
                Transaction limit (₹)
              </label>
              <input
                id="policy-tx"
                className="input mono"
                type="number"
                min="0"
                step="0.01"
                value={transactionLimit}
                onChange={(e) => setTransactionLimit(e.target.value)}
                placeholder="25000"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="policy-threshold">
                Approval threshold (₹)
              </label>
              <input
                id="policy-threshold"
                className="input mono"
                type="number"
                min="0"
                step="0.01"
                value={approvalThreshold}
                onChange={(e) => setApprovalThreshold(e.target.value)}
                placeholder="10000"
              />
              <span className="field-hint">Above this, a human must approve.</span>
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="policy-allow">
              Allowed merchants
            </label>
            <input
              id="policy-allow"
              className="input"
              value={allowedMerchants}
              onChange={(e) => setAllowedMerchants(e.target.value)}
              placeholder="AWS, VERIZON, GCP"
            />
            <span className="field-hint">Comma-separated. Leave empty for all.</span>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="policy-block">
              Blocked merchants
            </label>
            <input
              id="policy-block"
              className="input"
              value={blockedMerchants}
              onChange={(e) => setBlockedMerchants(e.target.value)}
              placeholder="GAMBLING-CASINO, DARKWEB"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="policy-cat">
              Restricted categories
            </label>
            <input
              id="policy-cat"
              className="input"
              value={restrictedCategories}
              onChange={(e) => setRestrictedCategories(e.target.value)}
              placeholder="gambling, adult_content"
            />
          </div>
          <div className="banner info" style={{ marginTop: 4 }}>
            Amounts are entered in ₹ and stored as integer paise. Creating a policy publishes it as version v1.
          </div>
        </form>
      </Modal>
    </div>
  );
}