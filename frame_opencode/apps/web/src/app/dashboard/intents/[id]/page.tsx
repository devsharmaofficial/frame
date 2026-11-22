"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type PaymentIntent } from "@/lib/api";
import { StatusBadge, decisionTone, statusTone } from "@/components/StatusBadge";
import { Amount } from "@/components/Amount";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/components/Toast";
import { formatDateTime, formatTime, shortId } from "@/lib/utils";

interface RiskSignal {
  name: string;
  triggered: boolean;
  detail: string;
}

interface RiskAssessment {
  level: "LOW" | "MEDIUM" | "HIGH";
  score: number;
  signals: RiskSignal[];
}

interface AuditTimelineEvent {
  id: string;
  actorType?: string;
  actorId?: string | null;
  action?: string;
  resourceType?: string | null;
  resourceId?: string | null;
  requestId?: string | null;
  policyVersionId?: string | null;
  decision?: string | null;
  createdAt?: string | null;
  entityAfter?: { risk?: RiskAssessment } | null;
}

function riskFromTimeline(timeline: AuditTimelineEvent[] | undefined): RiskAssessment | null {
  if (!timeline) return null;
  const created = timeline.find((e) => e.action === "payment_intent.created");
  return created?.entityAfter?.risk ?? null;
}

function riskTone(level: string | undefined): string {
  if (level === "HIGH") return "blocked";
  if (level === "MEDIUM") return "pending";
  if (level === "LOW") return "safe";
  return "neutral";
}

interface IntentAudit {
  intent: PaymentIntent;
  timeline?: AuditTimelineEvent[];
  payment?: {
    status?: string;
    provider?: string;
    providerPaymentId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    createdAt?: string | null;
  } | null;
  approval?: {
    decision?: string;
    comment?: string | null;
    approvedBy?: string | null;
    rejectedBy?: string | null;
    requestedAt?: string | null;
    expiresAt?: string | null;
  } | null;
}

function reasonsList(intent: PaymentIntent): Array<[string, unknown]> {
  const r = intent.reasons;
  if (!r) return [];
  if (Array.isArray(r)) {
    return r.map((item, i) => [`item_${i}`, item] as [string, unknown]);
  }
  if (typeof r === "object") {
    return Object.entries(r as Record<string, unknown>);
  }
  return [["reason", r]];
}

export default function IntentDetailPage() {
  const params = useParams<{ id: string }>();
  const intentId = params.id;

  const [primary, setPrimary] = useState<PaymentIntent | null>(null);
  const [audit, setAudit] = useState<IntentAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [executing, setExecuting] = useState(false);

  const load = useCallback(() => {
    if (!intentId) return;
    setLoading(true);
    setLoadError("");
    api
      .get<PaymentIntent>(`/payment-intents/${intentId}`)
      .then((data) => {
        setPrimary(data);
      })
      .catch((err: unknown) => {
        const fallback = (err as unknown) as { intent?: PaymentIntent };
        if (fallback?.intent) {
          setPrimary(fallback.intent);
          setLoadError("");
        } else {
          setLoadError(err instanceof ApiError ? err.message : "Failed to load intent");
          setPrimary(null);
        }
      })
      .finally(() => setLoading(false));
  }, [intentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!intentId) return;
    api
      .get<IntentAudit>(`/payment-intents/${intentId}/audit`)
      .then(setAudit)
      .catch(() => setAudit(null));
  }, [intentId]);

  async function handleExecute() {
    if (!primary) return;
    setExecuting(true);
    try {
      const res = await api.post<PaymentIntent>(`/payment-intents/${primary.id}/execute-user`);
      setPrimary({ ...res });
      toast.success("Payment executing", "The provider attempt has been submitted.");
      load();
    } catch (err) {
      toast.error("Execution failed", err instanceof ApiError ? err.message : "Could not execute payment.");
    } finally {
      setExecuting(false);
    }
  }

  if (loading) {
    return <div className="skeleton" style={{ height: 320 }} />;
  }

  const intent = primary ?? audit?.intent ?? null;

  if (loadError && !intent) {
    return (
      <EmptyState
        icon="!"
        title="Intent not found"
        body={loadError || "This payment intent may have expired or been removed."}
        action={
          <Link href="/dashboard/intents" className="btn">
            Back to payments
          </Link>
        }
      />
    );
  }
  if (!intent) {
    return (
      <EmptyState
        icon="!"
        title="Intent not found"
        action={
          <Link href="/dashboard/intents" className="btn">
            Back to payments
          </Link>
        }
      />
    );
  }

  const isAuthorized = intent.status === "AUTHORIZED";
  const timeline = audit?.timeline ?? [];
  const reasons = reasonsList(intent);

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/dashboard/intents" className="faint" style={{ fontSize: 12.5 }}>
            ← Payments
          </Link>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            Payment Intent <span className="mono">PI_{shortId(intent.id)}</span>
          </h1>
          <p className="page-subtitle mono-cell">
            {intent.id} · created {formatDateTime(intent.createdAt)}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isAuthorized ? (
            <button className="btn btn-primary" onClick={handleExecute} disabled={executing}>
              {executing ? <span className="spinner" /> : null}
              Execute payment
            </button>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Intent</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <StatusBadge status={intent.status} className={statusTone(intent.status)} />
            <StatusBadge status={intent.decision} label={intent.decision} className={decisionTone(intent.decision)} />
          </div>
        </div>
        <div className="card-body">
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">Agent</div>
              <div className="detail-value">
                {intent.agent ? (
                  <Link href={`/dashboard/agents/${intent.agent.id}`}>{intent.agent.name}</Link>
                ) : (
                  <Link href={`/dashboard/agents/${intent.agentId}`} className="mono" style={{ fontSize: 12 }}>
                    {shortId(intent.agentId)}
                  </Link>
                )}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Merchant</div>
              <div className="detail-value">{intent.merchant}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Amount</div>
              <div className="detail-value">
                <Amount paise={intent.amountPaise} />{" "}
                <span className="faint">({intent.currency ?? "INR"})</span>
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Purpose</div>
              <div className="detail-value">{intent.purpose || "—"}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Policy version</div>
              <div className="detail-value mono" style={{ fontSize: 12 }}>
                {intent.policyVersionId ? shortId(intent.policyVersionId) : "—"}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Merchant reference</div>
              <div className="detail-value">{intent.merchantReference || "—"}</div>
            </div>
            <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
              <div className="detail-label">Intent hash</div>
              <div className="detail-value hash-value">{intent.intentHash || "—"}</div>
            </div>
            <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
              <div className="detail-label">Idempotency key</div>
              <div className="detail-value hash-value">{intent.idempotencyKey || "—"}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Expires</div>
              <div className="detail-value mono-cell">{formatDateTime(intent.expiresAt)}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Updated</div>
              <div className="detail-value mono-cell">{formatDateTime(intent.updatedAt)}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 20 }} />

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Decision &amp; reasons</h2>
            {(() => {
              const risk = riskFromTimeline(timeline);
              return risk ? (
                <StatusBadge status={`${risk.level} RISK`} label={`${risk.level} RISK · ${risk.score}`} className={riskTone(risk.level)} />
              ) : null;
            })()}
          </div>
          <div className="card-body">
            {reasons.length === 0 ? (
              <div className="muted" style={{ fontSize: 13 }}>
                No reasons recorded. The evaluation output is only attached when the risk engine produces
                checks for this intent.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {reasons.map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "baseline",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      padding: "8px 11px",
                      fontSize: 12.5,
                      background: "var(--bg-elevated)",
                    }}
                  >
                    <span className="mono faint" style={{ width: 140, flexShrink: 0 }}>
                      {k}
                    </span>
                    <span className="mono" style={{ wordBreak: "break-word" }}>
                      {typeof v === "string" ? v : JSON.stringify(v)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {(() => {
              const risk = riskFromTimeline(timeline);
              if (!risk) return null;
              return (
                <div style={{ marginTop: 14 }}>
                  <div className="detail-label" style={{ marginBottom: 8 }}>
                    Risk signals (advisory only — policy decision stands)
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {risk.signals.map((s) => (
                      <div
                        key={s.name}
                        style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 12.5 }}
                      >
                        <span className="mono" style={{ width: 170, flexShrink: 0, color: s.triggered ? "var(--failed)" : "var(--text-muted)" }}>
                          {s.triggered ? "●" : "○"} {s.name}
                        </span>
                        <span className="muted">{s.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Payment state</h2>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrap" style={{ border: "none" }}>
                <table className="data-table">
                  <tbody>
                    <tr>
                      <td className="muted" style={{ width: 130 }}>Provider</td>
                      <td className="mono">{audit?.payment?.provider ?? "—"}</td>
                    </tr>
                    <tr>
                      <td className="muted">Provider ref</td>
                      <td className="mono-cell">{audit?.payment?.providerPaymentId ?? "—"}</td>
                    </tr>
                    <tr>
                      <td className="muted">Payment status</td>
                      <td>
                        <StatusBadge
                          status={audit?.payment?.status}
                          label={audit?.payment?.status}
                          className={statusTone(audit?.payment?.status)}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="muted">Error</td>
                      <td className="mono" style={{ color: audit?.payment?.errorCode ? "var(--failed)" : undefined }}>
                        {audit?.payment?.errorMessage || audit?.payment?.errorCode || "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {audit?.approval ? (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Approval context</h2>
              </div>
              <div className="card-body">
                <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="muted">Decision</span>
                    <StatusBadge
                      status={audit.approval.decision}
                      label={audit.approval.decision}
                      className={decisionTone(audit.approval.decision)}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="muted">Requested</span>
                    <span className="mono-cell">{formatDateTime(audit.approval.requestedAt)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="muted">Expires</span>
                    <span className="mono-cell">{formatDateTime(audit.approval.expiresAt)}</span>
                  </div>
                  {audit.approval.comment ? (
                    <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 8 }}>
                      <span className="muted">Comment · </span>
                      <span>{audit.approval.comment}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ height: 20 }} />

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Audit timeline</h2>
        </div>
        <div className="card-body">
          {timeline.length === 0 ? (
            <EmptyState
              title="No timeline events"
              body="The audit trail for this intent is available from the audit panel or the intent audit endpoint."
            />
          ) : (
            <div className="audit-list" style={{ borderLeft: "none", paddingLeft: 0 }}>
              {timeline.map((ev) => (
                <div className="audit-event" key={ev.id}>
                  <span className="audit-event-time">{formatTime(ev.createdAt)}</span>
                  <span className="audit-event-line">
                    <span className="mono" style={{ color: "var(--text-muted)" }}>
                      {ev.action ?? "event"}
                    </span>
                    {ev.decision ? (
                      <StatusBadge status={ev.decision} label={ev.decision} className={decisionTone(ev.decision)} />
                    ) : null}
                    <span className="audit-event-meta">
                      {ev.actorType ? `${ev.actorType} · ` : ""}
                      {shortId(ev.actorId)}
                    </span>
                  </span>
                  <span className="audit-event-meta">{formatDateTime(ev.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}