"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Overview, type ApprovalTask, type PaymentIntent } from "@/lib/api";
import { Amount } from "@/components/Amount";
import { StatusBadge, decisionTone } from "@/components/StatusBadge";
import { StatCard, StatCardSkeleton } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/components/Toast";
import { formatDateTime, shortId } from "@/lib/utils";

export default function OverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalTask[]>([]);
  const [recentPayments, setRecentPayments] = useState<PaymentIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    Promise.all([
      api.get<Overview>("/overview"),
      // Backend /overview returns only counts + raw payment rows + alerts.
      // Hydrate the dashboard lists from their source endpoints.
      api.get<ApprovalTask[]>("/approvals?status=pending").catch(() => [] as ApprovalTask[]),
      api.get<PaymentIntent[]>("/payment-intents").catch(() => [] as PaymentIntent[]),
    ])
      .then(([data, approvals, intents]) => {
        setOverview(data);
        setPendingApprovals(approvals);
        setRecentPayments(
          [...intents].sort((a, b) =>
            String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
          ),
        );
      })
      .catch((err: unknown) => {
        const message = err instanceof ApiError ? err.message : "Failed to load overview";
        setLoadError(message);
        setOverview(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function resolveApproval(id: string, action: "approve" | "reject", comment?: string) {
    try {
      await api.post(`/approvals/${id}/${action}`, comment ? { comment } : {});
      toast.success(
        action === "approve" ? "Approval granted" : "Approval rejected",
        comment || "The pending approval was updated.",
      );
      load();
    } catch (err) {
      toast.error(
        "Action failed",
        err instanceof ApiError ? err.message : "Could not update the approval.",
      );
    }
  }

  const pendingApprovalsList = pendingApprovals;
  const recentPaymentsList = recentPayments;
  // Backend returns alerts: [{action, resourceType, resourceId, createdAt}].
  // Accept either shape so the card degrades gracefully.
  const rawAlerts = (overview?.alerts ?? overview?.securityAlerts ?? []) as Array<{
    id?: string;
    severity?: string;
    title?: string;
    message?: string;
    action?: string;
    resourceType?: string | null;
    resourceId?: string | null;
    createdAt?: string;
  }>;
  const alerts = rawAlerts.map((a, i) => ({
    id: a.id ?? `${a.action ?? "alert"}-${i}`,
    severity: a.severity ?? (/denied|rejected|failed/i.test(a.action ?? "") ? "high" : "medium"),
    title: a.title ?? a.action ?? "Security event",
    message: a.message ?? (a.resourceType ? `${a.resourceType} ${shortId(a.resourceId)}` : undefined),
    createdAt: a.createdAt,
  }));

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Overview</h1>
            <p className="page-subtitle">What are your agents doing with money?</p>
          </div>
        </div>
        <div className="grid grid-cards">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (loadError || !overview) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Overview</h1>
            <p className="page-subtitle">What are your agents doing with money?</p>
          </div>
        </div>
        <EmptyState
          icon="!"
          title="Overview unavailable"
          body={
            loadError ||
            "The overview endpoint is not responding. Make sure the API server is running."
          }
          action={
            <button className="btn" onClick={load}>
              Retry
            </button>
          }
        />
      </div>
    );
  }

  const successRate = overview.successRate != null ? Number(overview.successRate) : null;
  // Backend reports successRate as a 0..1 fraction; tolerate a 0..100 percent too.
  const successRateLabel =
    successRate != null && Number.isFinite(successRate)
      ? `${((successRate <= 1 ? successRate * 100 : successRate)).toFixed(1)}%`
      : "—";
  const blockedAttempts = overview.blockedAttempts;
  const pendingCount = overview.pendingApprovals;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">What are your agents doing with money?</p>
        </div>
      </div>

      <div className="grid grid-cards">
        <StatCard
          label="Total spend"
          value={<Amount paise={overview.totalSpendPaise} />}
          hint="All time, all agents"
        />
        <StatCard
          label="Today's spend"
          value={<Amount paise={overview.todaySpendPaise} />}
          hint={new Date().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        />
        <StatCard
          label="Active agents"
          value={overview.activeAgents ?? 0}
          hint="Enabled and issuing intents"
        />
        <StatCard
          label="Pending approvals"
          value={pendingCount ?? 0}
          hint="Awaiting a human decision"
          valueClassName="stat-value"
        />
        <StatCard
          label="Blocked attempts"
          value={blockedAttempts ?? 0}
          hint="Denied by the policy firewall"
        />
        <StatCard
          label="Success rate"
          value={successRateLabel}
          hint="Payments that reached a terminal success"
        />
      </div>

      <div style={{ height: 20 }} />

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent payments</h2>
            <Link href="/dashboard/intents" className="link-btn">
              View all →
            </Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {recentPaymentsList.length === 0 ? (
              <div style={{ padding: 16 }}>
                <EmptyState
                  title="No payments yet"
                  body="Subscription events and payouts will appear once agents start transacting."
                />
              </div>
            ) : (
              <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Intent</th>
                      <th>Agent</th>
                      <th>Merchant</th>
                      <th className="num">Amount</th>
                      <th>Status</th>
                      <th>Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPaymentsList.slice(0, 8).map((p) => (
                      <tr key={p.id} style={{ cursor: "pointer" }}>
                        <td className="mono-cell">
                          <Link href={`/dashboard/intents/${p.id}`} className="row-title">
                            PI_{shortId(p.id)}
                          </Link>
                          <div className="row-sub">{formatDateTime(p.createdAt)}</div>
                        </td>
                        <td>{p.agent?.name ?? shortId(p.agentId)}</td>
                        <td>{p.merchant}</td>
                        <td className="num">
                          <Amount paise={p.amountPaise} />
                        </td>
                        <td>
                          <StatusBadge status={p.status} />
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

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Pending approvals</h2>
            <Link href="/dashboard/approvals" className="link-btn">
              View all →
            </Link>
          </div>
          <div className="card-body">
            {pendingApprovalsList.length === 0 ? (
              <EmptyState
                icon="✓"
                title="Nothing pending"
                body="No payments currently require a human decision."
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pendingApprovalsList.slice(0, 4).map((a) => (
                  <div
                    key={a.id}
                    className="card"
                    style={{ background: "var(--bg-elevated-2)", borderColor: "var(--border-subtle)" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div className="row-title" style={{ fontSize: 13 }}>
                          {a.agent?.name ?? a.paymentIntent?.agent?.name ?? shortId(a.paymentIntent?.agentId)}
                        </div>
                        <div className="row-sub">
                          {a.paymentIntent?.merchant ?? "—"}
                          {a.paymentIntent?.amountPaise != null ? (
                            <>
                              {" · "}
                              <Amount paise={a.paymentIntent.amountPaise} compact />
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="mono-cell faint">{a.id.slice(0, 8)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button className="btn btn-success btn-sm" onClick={() => resolveApproval(a.id, "approve")}>
                        Approve
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => resolveApproval(a.id, "reject")}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: 20 }} />

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Security alerts</h2>
        </div>
        <div className="card-body">
          {alerts.length === 0 ? (
            <EmptyState
              icon="🛡"
              title="No alerts"
              body="No blocked attempts or security events in the current window."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {alerts.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 12px",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--bg-elevated)",
                  }}
                >
                  <StatusBadge
                    status={a.severity}
                    label={a.severity}
                    className={a.severity === "high" ? "blocked" : a.severity === "medium" ? "pending" : "neutral"}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                    {a.message ? <div className="row-sub">{a.message}</div> : null}
                  </div>
                  <span className="mono faint" style={{ fontSize: 11.5 }}>
                    {formatDateTime(a.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}