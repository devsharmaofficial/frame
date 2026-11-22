"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, type AuditEvent } from "@/lib/api";
import { StatusBadge, decisionTone } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { formatTime, shortId } from "@/lib/utils";

function dayKey(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    api
      .get<AuditEvent[]>("/audit-events")
      .then(setEvents)
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load audit events");
        setEvents([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, AuditEvent[]>();
    const sorted = [...events].sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return (bt - at) || String(a.id).localeCompare(String(b.id));
    });
    for (const ev of sorted) {
      const key = dayKey(ev.createdAt);
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [events]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit</h1>
          <p className="page-subtitle">
            Append-only event log. Every state change records the actor, action, resource, and decision.
          </p>
        </div>
      </div>

      {loadError ? (
        <EmptyState
          icon="!"
          title="Unable to load audit events"
          body={loadError}
          action={<button className="btn" onClick={load}>Retry</button>}
        />
      ) : loading ? (
        <div className="skeleton" style={{ height: 240 }} />
      ) : events.length === 0 ? (
        <EmptyState
          title="No audit events"
          body="Actions in your organization are logged here — agent creation, policy edits, decisions, and approvals."
        />
      ) : (
        <div>
          {grouped.map(([day, items]) => (
            <div key={day}>
              <div className="audit-group-title">{day}</div>
              <div className="audit-list">
                {items.map((ev) => (
                  <div className="audit-event" key={ev.id}>
                    <div className="audit-event-line">
                      <span className="audit-event-time">{formatTime(ev.createdAt)}</span>
                      <span className="mono" style={{ fontWeight: 600 }}>
                        {ev.action}
                      </span>
                      {ev.decision ? (
                        <StatusBadge
                          status={ev.decision}
                          label={ev.decision}
                          className={decisionTone(ev.decision)}
                        />
                      ) : null}
                    </div>
                    <div className="audit-event-meta">
                      <span>
                        {ev.actorType ?? "system"} · {shortId(ev.actorId)}
                      </span>
                      {ev.resourceType ? (
                        <span style={{ marginLeft: 12 }}>
                          resource · {ev.resourceType} {shortId(ev.resourceId)}
                        </span>
                      ) : null}
                      {ev.requestId ? (
                        <span style={{ marginLeft: 12 }}>req · {shortId(ev.requestId)}</span>
                      ) : null}
                      {ev.entryHash ? (
                        <span style={{ marginLeft: 12 }} title="Tamper-evident hash">
                          {ev.entryHash.slice(0, 16)}…
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}