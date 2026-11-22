"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type ApprovalTask } from "@/lib/api";
import { StatusBadge, decisionTone, statusTone } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Amount } from "@/components/Amount";
import { toast } from "@/components/Toast";
import { formatDateTime, shortId } from "@/lib/utils";

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    api
      .get<ApprovalTask[]>("/approvals?status=pending")
      .then(setApprovals)
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load approvals");
        setApprovals([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function resolve(id: string, action: "approve" | "reject") {
    setBusyId(id);
    const comment = comments[id]?.trim() || undefined;
    try {
      await api.post(`/approvals/${id}/${action}`, comment ? { comment } : {});
      toast.success(
        action === "approve" ? "Approval granted" : "Approval rejected",
        comment || undefined,
      );
      setApprovals((prev) => prev.filter((a) => a.id !== id));
      load();
    } catch (err) {
      toast.error(
        "Action failed",
        err instanceof ApiError ? err.message : "Could not update the approval.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Approvals</h1>
          <p className="page-subtitle">
            Payments waiting for a human decision. Review the agent, merchant, and reason before acting.
          </p>
        </div>
      </div>

      {loadError ? (
        <EmptyState
          icon="!"
          title="Unable to load approvals"
          body={loadError}
          action={<button className="btn" onClick={load}>Retry</button>}
        />
      ) : loading ? (
        <div className="skeleton" style={{ height: 260 }} />
      ) : approvals.length === 0 ? (
        <EmptyState
          icon="CHECK"
          title="Nothing pending"
          body="No payments currently require human approval. New requests will appear here."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {approvals.map((a) => {
            // Enriched shape: { …, paymentIntent, agent, policy, reason }.
            // Every field is optional — degrade gracefully when missing.
            const intent = a.paymentIntent;
            const agentName =
              a.agent?.name ?? intent?.agent?.name ?? shortId(intent?.agentId) ?? "Unknown agent";
            const policyLabel = a.policy?.name
              ? `${a.policy.name} v${a.policy.version}`
              : intent?.policyVersionId
                ? `version ${shortId(intent.policyVersionId)}`
                : "—";
            return (
              <div className="approval-card" key={a.id}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="badge pending">approval required</span>
                    <span className="mono faint" style={{ fontSize: 11.5 }}>
                      {shortId(a.id)} · requested {formatDateTime(a.requestedAt)}
                    </span>
                  </div>
                  <span className="mono faint" style={{ fontSize: 11.5 }}>
                    expires {formatDateTime(a.expiresAt)}
                  </span>
                </div>

                <div className="approval-grid">
                  <div className="approval-field">
                    <span className="approval-field-label">Agent</span>
                    <span className="approval-field-value">{agentName}</span>
                  </div>
                  <div className="approval-field">
                    <span className="approval-field-label">Merchant</span>
                    <span className="approval-field-value">{intent?.merchant ?? "—"}</span>
                  </div>
                  <div className="approval-field">
                    <span className="approval-field-label">Amount</span>
                    <span className="approval-field-value">
                      {intent?.amountPaise != null ? <Amount paise={intent.amountPaise} /> : "—"}
                    </span>
                  </div>
                  <div className="approval-field">
                    <span className="approval-field-label">Purpose</span>
                    <span className="approval-field-value">{intent?.purpose || "—"}</span>
                  </div>
                  <div className="approval-field">
                    <span className="approval-field-label">Policy</span>
                    <span className="approval-field-value">{policyLabel}</span>
                  </div>
                  <div className="approval-field">
                    <span className="approval-field-label">Required role</span>
                    <span className="approval-field-value mono">{a.requiredRole ?? "admin"}</span>
                  </div>
                </div>

                {a.reason || intent?.reasons ? (
                  <div className="banner warn" style={{ padding: "8px 12px" }}>
                    Reason: {a.reason ?? "Amount exceeds the automatic approval threshold for the evaluated policy."}
                  </div>
                ) : null}

                <div className="approval-actions">
                  <label className="field-label" htmlFor={`comment-${a.id}`} style={{ position: "absolute", left: "-9999px" }}>
                    Comment for approval {shortId(a.id)}
                  </label>
                  <input
                    id={`comment-${a.id}`}
                    className="input"
                    style={{ flex: 1, minWidth: 200 }}
                    placeholder="Optional comment (visible in the audit trail)"
                    aria-label={`Comment for approval ${shortId(a.id)}`}
                    value={comments[a.id] ?? ""}
                    onChange={(e) => setComments((prev) => ({ ...prev, [a.id]: e.target.value }))}
                  />
                  <button
                    className="btn btn-success"
                    onClick={() => resolve(a.id, "approve")}
                    disabled={busyId === a.id}
                  >
                    {busyId === a.id ? <span className="spinner" /> : null} Approve
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => resolve(a.id, "reject")}
                    disabled={busyId === a.id}
                  >
                    Reject
                  </button>
                </div>

                {intent ? (
                  <div className="faint" style={{ fontSize: 12 }}>
                    Intent <span className="mono">PI_{shortId(intent.id)}</span> · status{" "}
                    <StatusBadge status={intent.status} label={intent.status} className={statusTone(intent.status)} />
                  </div>
                ) : (
                  <div className="faint" style={{ fontSize: 12 }}>
                    Intent <span className="mono">PI_{shortId(a.paymentIntentId)}</span> · details unavailable
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}