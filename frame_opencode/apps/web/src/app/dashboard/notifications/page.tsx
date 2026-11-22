"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "@/components/Toast";
import { formatDateTime } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  detail?: string | null;
  severity?: string | null;
  createdAt?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDateTime(iso);
}

function severityClass(severity: string | null | undefined): string {
  switch ((severity ?? "info").toLowerCase()) {
    case "critical":
    case "high":
    case "error":
      return "blocked";
    case "warning":
    case "medium":
    case "pending":
      return "pending";
    case "success":
    case "low":
    case "info":
      return "safe";
    default:
      return "neutral";
  }
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notDeployed, setNotDeployed] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sending, setSending] = useState(false);
  const [testType, setTestType] = useState("payment.succeeded");

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    setNotDeployed(false);
    api
      .get<NotificationItem[] | { notifications: NotificationItem[] }>("/notifications?limit=25")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res.notifications ?? []);
        setItems(list);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          // Backend has no notification service — honest empty state, no mocks.
          setNotDeployed(true);
          setItems([]);
        } else {
          setLoadError(err instanceof ApiError ? err.message : "Failed to load notifications");
          setItems([]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function sendTest() {
    setSending(true);
    try {
      await api.post("/notifications/test", { type: testType });
      toast.success("Test notification sent", `Type "${testType}" was queued for delivery.`);
      load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotDeployed(true);
        toast.error("Notification service not deployed yet", "The backend has no /notifications/test route.");
      } else {
        toast.error("Send failed", err instanceof ApiError ? err.message : "Could not send the test notification.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">Payment events routed to your organization — newest first.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label className="field-label" htmlFor="notif-type" style={{ margin: 0 }}>
            Test type
          </label>
          <select
            id="notif-type"
            className="select"
            style={{ width: 200 }}
            value={testType}
            onChange={(e) => setTestType(e.target.value)}
          >
            <option value="payment.succeeded">payment.succeeded</option>
            <option value="payment.failed">payment.failed</option>
            <option value="approval.requested">approval.requested</option>
            <option value="policy.denied">policy.denied</option>
          </select>
          <button className="btn" onClick={sendTest} disabled={sending}>
            {sending ? <span className="spinner" /> : null} Send test notification
          </button>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 240 }} />
      ) : notDeployed ? (
        <EmptyState
          icon="🔕"
          title="Notification service not deployed yet"
          body="The API has no /notifications route (404). Deploy the notification service, then retry — no placeholder data is shown."
          action={
            <button className="btn" onClick={load}>
              Retry
            </button>
          }
        />
      ) : loadError ? (
        <EmptyState
          icon="!"
          title="Unable to load notifications"
          body={loadError}
          action={
            <button className="btn" onClick={load}>
              Retry
            </button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No notifications"
          body="Payment, approval, and policy events will appear here once the notification service emits them."
          action={
            <button className="btn" onClick={load}>
              Refresh
            </button>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((n) => (
            <div className="approval-card" key={n.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StatusBadge
                    status={n.severity ?? "info"}
                    label={n.severity ?? "info"}
                    className={severityClass(n.severity)}
                  />
                  <span className="mono faint" style={{ fontSize: 11.5 }}>
                    {n.type}
                  </span>
                </div>
                <span className="mono faint" style={{ fontSize: 11.5 }} title={formatDateTime(n.createdAt)}>
                  {relativeTime(n.createdAt)}
                </span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{n.title}</div>
              {n.detail ? (
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {n.detail}
                </div>
              ) : null}
              {n.resourceType || n.resourceId ? (
                <div className="faint mono" style={{ fontSize: 11.5 }}>
                  {n.resourceType ?? "resource"} · {n.resourceId ?? "—"}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
