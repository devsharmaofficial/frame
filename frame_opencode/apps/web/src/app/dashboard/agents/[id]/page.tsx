"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Agent, type PaymentIntent } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { StatusBadge, statusTone, decisionTone } from "@/components/StatusBadge";
import { Amount } from "@/components/Amount";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/components/Toast";
import { IconCopy } from "@/components/icons";
import { copyToClipboard, formatDateTime, shortId } from "@/lib/utils";

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const agentId = params.id;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [intents, setIntents] = useState<PaymentIntent[]>([]);
  const [intentsError, setIntentsError] = useState("");
  const [busy, setBusy] = useState(false);

  const [rotateKey, setRotateKey] = useState<string | null>(null);
  const [rotatedCopied, setRotatedCopied] = useState(false);

  const load = useCallback(() => {
    if (!agentId) return;
    setLoading(true);
    setLoadError("");
    api
      .get<Agent>(`/agents/${agentId}`)
      .then(setAgent)
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load agent");
        setAgent(null);
      })
      .finally(() => setLoading(false));
  }, [agentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!agentId) return;
    api
      .get<PaymentIntent[]>(`/payment-intents?agentId=${encodeURIComponent(agentId)}`)
      .then(setIntents)
      .catch((err: unknown) => {
        setIntentsError(err instanceof ApiError ? err.message : "Failed to load payment intents");
        setIntents([]);
      });
  }, [agentId]);

  async function setStatus(next: "active" | "disabled") {
    if (!agent) return;
    setBusy(true);
    try {
      await api.post(`/agents/${agent.id}/${next === "active" ? "enable" : "disable"}`);
      toast.success(next === "active" ? "Agent enabled" : "Agent disabled", undefined);
      load();
    } catch (err) {
      toast.error(
        "Update failed",
        err instanceof ApiError ? err.message : "Could not update agent status.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRotateKey() {
    if (!agent) return;
    setBusy(true);
    try {
      const res = await api.post<{ credential: { key: string; prefix: string } }>(
        `/agents/${agent.id}/rotate-key`,
      );
      setRotateKey(res.credential.key);
      setRotatedCopied(false);
      toast.success("Key rotated", "The previous key has been revoked.");
    } catch (err) {
      toast.error("Rotation failed", err instanceof ApiError ? err.message : "Could not rotate the key.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyRotated() {
    if (!rotateKey) return;
    const ok = await copyToClipboard(rotateKey);
    if (ok) {
      setRotatedCopied(true);
      toast.success("Copied", "The new key has been copied to your clipboard.");
    }
  }

  if (loading) {
    return <div className="skeleton" style={{ height: 280 }} />;
  }

  if (loadError || !agent) {
    return (
      <EmptyState
        icon="!"
        title="Agent not found"
        body={loadError || "This agent may have been deleted."}
        action={
          <Link href="/dashboard/agents" className="btn">
            Back to agents
          </Link>
        }
      />
    );
  }

  const active = agent.status === "active";
  const spend = (agent as unknown as { spendPaise?: number | string }).spendPaise;
  const spendToday = (agent as unknown as { todaySpendPaise?: number | string }).todaySpendPaise;
  const policy = (agent as unknown as { policyId?: string; policyName?: string; policyVersion?: number })
    ? (agent as unknown as { policyId?: string; policyName?: string; policyVersion?: number })
    : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/dashboard/agents" className="faint" style={{ fontSize: 12.5 }}>
            ← Agents
          </Link>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            {agent.name}
          </h1>
          <p className="page-subtitle mono-cell">
            {shortId(agent.id)} · {agent.environment} · {agent.owner || "no owner"}
          </p>
        </div>
        <div className="status-bar">
          {active ? (
            <button className="btn" onClick={() => setStatus("disabled")} disabled={busy}>
              Disable
            </button>
          ) : (
            <button className="btn btn-success" onClick={() => setStatus("active")} disabled={busy}>
              Enable
            </button>
          )}
          <button className="btn" onClick={handleRotateKey} disabled={busy}>
            Rotate Key
          </button>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Agent</h2>
            <StatusBadge status={agent.status} className={statusTone(agent.status)} />
          </div>
          <div className="card-body">
            <div className="detail-grid" style={{ border: "none", background: "transparent" }}>
              <div className="detail-item">
                <div className="detail-label">Description</div>
                <div className="detail-value">{agent.description || "—"}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Purpose</div>
                <div className="detail-value">{agent.purpose || "—"}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Environment</div>
                <div className="detail-value">{agent.environment}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Owner</div>
                <div className="detail-value">{agent.owner || "—"}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Created</div>
                <div className="detail-value mono-cell">{formatDateTime(agent.createdAt)}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">ID</div>
                <div className="detail-value hash-value">{agent.id}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Policy</h2>
          </div>
          <div className="card-body">
            {policy?.policyId ? (
              <div>
                <Link href={`/dashboard/policies/${policy.policyId}`} className="row-title">
                  {policy.policyName ?? "Attached policy"}
                </Link>
                <div className="row-sub">version {policy.policyVersion ?? "—"}</div>
              </div>
            ) : (
              <EmptyState
                title="No policy attached"
                body="This agent will be denied any payment until an active policy is configured."
                action={
                  <Link href="/dashboard/policies" className="btn">
                    Open policies
                  </Link>
                }
              />
            )}
          </div>
        </div>
      </div>

      <div style={{ height: 20 }} />

      <div className="grid grid-cards">
        <div className="card card-pad">
          <div className="stat-label">Total spend</div>
          <div className="stat-value" style={{ fontSize: 20 }}>
            {spend != null ? <Amount paise={spend} /> : "—"}
          </div>
        </div>
        <div className="card card-pad">
          <div className="stat-label">Today's spend</div>
          <div className="stat-value" style={{ fontSize: 20 }}>
            {spendToday != null ? <Amount paise={spendToday} /> : "—"}
          </div>
        </div>
        <div className="card card-pad">
          <div className="stat-label">Credential</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="mono" style={{ fontSize: 14 }}>
              fr_{shortId(agent.id)}
            </div>
            <span className="faint" style={{ fontSize: 11 }}>
              Active key · rotate to invalidate
            </span>
          </div>
        </div>
      </div>

      <div style={{ height: 20 }} />

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent intents</h2>
          <Link href="/dashboard/intents" className="link-btn">
            View all →
          </Link>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {intentsError ? (
            <div style={{ padding: 16 }}>
              <EmptyState
                icon="!"
                title="Intents unavailable"
                body={intentsError}
              />
            </div>
          ) : intents.length === 0 ? (
            <div style={{ padding: 16 }}>
              <EmptyState
                title="No intents"
                body="Payment intents for this agent will appear here once the SDK or API issues them."
              />
            </div>
          ) : (
            <div className="table-wrap" style={{ border: "none" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Intent</th>
                    <th>Merchant</th>
                    <th className="num">Amount</th>
                    <th>Status</th>
                    <th>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {intents.slice(0, 12).map((p) => (
                    <tr key={p.id}>
                      <td className="mono-cell">
                        <Link href={`/dashboard/intents/${p.id}`}>PI_{shortId(p.id)}</Link>
                      </td>
                      <td>{p.merchant}</td>
                      <td className="num">
                        <Amount paise={p.amountPaise} />
                      </td>
                      <td>
                        <StatusBadge status={p.status} className={statusTone(p.status)} />
                      </td>
                      <td>
                        <StatusBadge status={p.decision} label={p.decision} className={decisionTone(p.decision)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={rotateKey !== null}
        title="New credential generated"
        onClose={() => setRotateKey(null)}
        footer={
          <button className="btn btn-primary" onClick={() => setRotateKey(null)}>
            Done
          </button>
        }
      >
        <div className="banner warn" role="alert" style={{ marginBottom: 14 }}>
          Show once — previous key for {agent.name} is now revoked and cannot sign requests.
        </div>
        <div className="key-box">
          <div className="key-box-label">New API key</div>
          <div className="key-box-value" data-testid="rotated-key">
            {rotateKey}
          </div>
          <button className="btn btn-sm" onClick={handleCopyRotated}>
            <IconCopy style={{ width: 13, height: 13 }} />
            {rotatedCopied ? "Copied" : "Copy key"}
          </button>
        </div>
      </Modal>
    </div>
  );
}