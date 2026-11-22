"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api, ApiError, type Agent, type Policy, type PolicyConfig, type PolicyVersion } from "@/lib/api";
import { StatusBadge, statusTone } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { Amount } from "@/components/Amount";
import { toast } from "@/components/Toast";
import { formatDateTime, shortId } from "@/lib/utils";

interface PolicyDetail extends Policy {
  versions?: PolicyVersion[];
  currentVersionConfig?: PolicyConfig;
}

function inrToPaise(value: string): number {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function paiseToInr(value: number | undefined | null): string {
  if (value == null) return "";
  return String(value / 100);
}

function listToCsv(value: string[] | undefined | null): string {
  return (value ?? []).join(", ");
}

export default function PolicyEditorPage() {
  const params = useParams<{ id: string }>();
  const policyId = params.id;

  const [policy, setPolicy] = useState<PolicyDetail | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [name, setName] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [dailyLimit, setDailyLimit] = useState("");
  const [transactionLimit, setTransactionLimit] = useState("");
  const [approvalThreshold, setApprovalThreshold] = useState("");
  const [allowedMerchants, setAllowedMerchants] = useState("");
  const [blockedMerchants, setBlockedMerchants] = useState("");
  const [restrictedCategories, setRestrictedCategories] = useState("");

  const load = useCallback(() => {
    if (!policyId) return;
    setLoading(true);
    setLoadError("");
    Promise.all([
      api.get<PolicyDetail>(`/policies/${policyId}`),
      api.get<PolicyVersion[]>(`/policies/${policyId}/versions`).catch(() => [] as PolicyVersion[]),
    ])
      .then(([data, versions]) => {
        const sorted = [...versions].sort((a, b) => a.version - b.version);
        setPolicy({ ...data, versions: sorted });
        const cfg =
          sorted.slice(-1)[0]?.config ??
          data.currentVersionConfig ??
          undefined;
        if (cfg) {
          setName("");
          setMonthlyLimit(paiseToInr(cfg.monthlyLimitPaise as number | undefined | null));
          setDailyLimit(paiseToInr(cfg.dailyLimitPaise as number | undefined | null));
          setTransactionLimit(paiseToInr(cfg.transactionLimitPaise as number | undefined | null));
          setApprovalThreshold(paiseToInr(cfg.approvalThresholdPaise as number | undefined | null));
          setAllowedMerchants(listToCsv(cfg.allowedMerchants as string[] | undefined));
          setBlockedMerchants(listToCsv(cfg.blockedMerchants as string[] | undefined));
          setRestrictedCategories(listToCsv(cfg.restrictedCategories as string[] | undefined));
        }
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load policy");
        setPolicy(null);
      })
      .finally(() => setLoading(false));
  }, [policyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .get<Agent[]>("/agents")
      .then(setAgents)
      .catch(() => setAgents([]));
  }, []);

  const openEditor = () => {
    setFormError("");
    setShowEdit(true);
  };

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!policy) return;
    setFormError("");
    setSaving(true);
    try {
      const config: PolicyConfig = {
        monthlyLimitPaise: inrToPaise(monthlyLimit),
        dailyLimitPaise: inrToPaise(dailyLimit),
        transactionLimitPaise: inrToPaise(transactionLimit),
        approvalThresholdPaise: inrToPaise(approvalThreshold),
        allowedMerchants: allowedMerchants.split(",").map((s) => s.trim()).filter(Boolean),
        blockedMerchants: blockedMerchants.split(",").map((s) => s.trim()).filter(Boolean),
        restrictedCategories: restrictedCategories.split(",").map((s) => s.trim()).filter(Boolean),
      };
      // Contract: PATCH /policies/:id requires { config } and publishes vN+1.
      await api.patch(`/policies/${policy.id}`, { config });
      setShowEdit(false);
      toast.success("New version published", `Every edit creates an immutable policy version.`);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to publish the new version.");
    } finally {
      setSaving(false);
    }
  }

  const versions = useMemo(() => policy?.versions ?? [], [policy]);
  const latest = versions.slice().reverse()[0];
  const latestConfig = latest?.config ?? policy?.currentVersionConfig ?? undefined;

  function agentName(id: string): string {
    return agents.find((a) => a.id === id)?.name ?? shortId(id);
  }

  function renderConfig(config: PolicyConfig | undefined | null) {
    if (!config) return null;
    const rows: Array<[string, React.ReactNode]> = [];
    if (config.monthlyLimitPaise != null) rows.push(["Monthly limit", <Amount key="m" paise={config.monthlyLimitPaise} />]);
    if (config.dailyLimitPaise != null) rows.push(["Daily limit", <Amount key="d" paise={config.dailyLimitPaise} />]);
    if (config.transactionLimitPaise != null) rows.push(["Transaction limit", <Amount key="t" paise={config.transactionLimitPaise} />]);
    if (config.approvalThresholdPaise != null) rows.push(["Approval threshold", <Amount key="a" paise={config.approvalThresholdPaise} />]);
    if ((config.allowedMerchants as string[] | undefined)?.length) rows.push(["Allowed merchants", (config.allowedMerchants as string[]).join(", ")]);
    if ((config.blockedMerchants as string[] | undefined)?.length) rows.push(["Blocked merchants", (config.blockedMerchants as string[]).join(", ")]);
    if ((config.restrictedCategories as string[] | undefined)?.length) rows.push(["Restricted", (config.restrictedCategories as string[]).join(", ")]);
    return rows;
  }

  if (loading) {
    return <div className="skeleton" style={{ height: 280 }} />;
  }

  if (loadError || !policy) {
    return (
      <EmptyState
        icon="!"
        title="Policy not found"
        body={loadError || "This policy may have been removed."}
        action={
          <Link href="/dashboard/policies" className="btn">
            Back to policies
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/dashboard/policies" className="faint" style={{ fontSize: 12.5 }}>
            ← Policies
          </Link>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            {policy.name}
          </h1>
          <p className="page-subtitle">
            Agent · <Link href={`/dashboard/agents/${policy.agentId}`}>{agentName(policy.agentId)}</Link>
            <span className="mono" style={{ marginLeft: 10 }}>
              {shortId(policy.id)}
            </span>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <StatusBadge status={policy.status} className={statusTone(policy.status)} />
          <button className="btn btn-primary" onClick={openEditor}>
            Edit → new version
          </button>
        </div>
      </div>

      <div className="banner info" style={{ marginBottom: 18 }}>
        Policies are immutable. Every edit publishes a new version (v{(policy.activeVersion ?? 1) + 1}) and never
        overwrites history — intents keep the version they were evaluated against.
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              Current version{" "}
              <span className="mono accent">{latest ? `v${latest.version}` : `v${policy.activeVersion}`}</span>
            </h2>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {renderConfig(latestConfig)?.map(([k, v]) => (
                <div
                  key={k}
                  style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}
                >
                  <span className="muted">{k}</span>
                  <span className="mono" style={{ textAlign: "right" }}>
                    {v}
                  </span>
                </div>
              ))}
              {!renderConfig(latestConfig)?.length ? (
                <span className="muted" style={{ fontSize: 13 }}>
                  No limits configured in this version.
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Version history</h2>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {versions.length === 0 ? (
              <div style={{ padding: 16 }}>
                <EmptyState
                  title="No versions listed"
                  body="Version list is only returned by the policy detail endpoint when available."
                />
              </div>
            ) : (
              <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Published</th>
                      <th className="num">Tx limit</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.slice().reverse().map((v) => (
                      <tr key={v.id}>
                        <td className="mono">v{v.version}</td>
                        <td className="mono-cell">{formatDateTime(v.createdAt)}</td>
                        <td className="num">
                          {v.config.transactionLimitPaise != null ? (
                            <Amount paise={v.config.transactionLimitPaise} />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {v.version === (latest?.version ?? policy.activeVersion) ? (
                            <StatusBadge status="active" label="active" />
                          ) : (
                            <StatusBadge status="archived" label="archived" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={showEdit}
        title={`Edit policy → publishes v${(policy.activeVersion ?? 1) + 1}`}
        onClose={() => setShowEdit(false)}
        wide
        footer={
          <>
            <button className="btn" onClick={() => setShowEdit(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" form="edit-policy-form" type="submit" disabled={saving}>
              {saving ? <span className="spinner" /> : null} Publish v{(policy.activeVersion ?? 1) + 1}
            </button>
          </>
        }
      >
        {formError ? (
          <div className="form-error" role="alert">
            {formError}
          </div>
        ) : null}
        <div className="banner warn" style={{ marginBottom: 14 }}>
          This creates a new immutable version. The current version stays active for in-flight intents until this
          one is promoted.
        </div>
        <form id="edit-policy-form" onSubmit={handleSave}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label className="field-label" htmlFor="edit-monthly">
                Monthly limit (₹)
              </label>
              <input
                id="edit-monthly"
                className="input mono"
                type="number"
                min="0"
                step="0.01"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="edit-daily">
                Daily limit (₹)
              </label>
              <input
                id="edit-daily"
                className="input mono"
                type="number"
                min="0"
                step="0.01"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="edit-tx">
                Transaction limit (₹)
              </label>
              <input
                id="edit-tx"
                className="input mono"
                type="number"
                min="0"
                step="0.01"
                value={transactionLimit}
                onChange={(e) => setTransactionLimit(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="edit-threshold">
                Approval threshold (₹)
              </label>
              <input
                id="edit-threshold"
                className="input mono"
                type="number"
                min="0"
                step="0.01"
                value={approvalThreshold}
                onChange={(e) => setApprovalThreshold(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="edit-allow">
              Allowed merchants
            </label>
            <input
              id="edit-allow"
              className="input"
              value={allowedMerchants}
              onChange={(e) => setAllowedMerchants(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="edit-block">
              Blocked merchants
            </label>
            <input
              id="edit-block"
              className="input"
              value={blockedMerchants}
              onChange={(e) => setBlockedMerchants(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="edit-cat">
              Restricted categories
            </label>
            <input
              id="edit-cat"
              className="input"
              value={restrictedCategories}
              onChange={(e) => setRestrictedCategories(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}