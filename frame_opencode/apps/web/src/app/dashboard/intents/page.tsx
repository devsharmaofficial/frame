"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Agent, type PaymentIntent } from "@/lib/api";
import { StatusBadge, decisionTone, statusTone } from "@/components/StatusBadge";
import { Amount } from "@/components/Amount";
import { EmptyState } from "@/components/EmptyState";
import { formatDateTime, shortId } from "@/lib/utils";
import type { Column } from "@/components/DataTable";

interface Row extends PaymentIntent {
  _reasons: string[];
}

function reasonsList(intent: PaymentIntent): string[] {
  if (!intent.reasons) return [];
  if (Array.isArray(intent.reasons)) {
    return intent.reasons.map((r) =>
      typeof r === "string" ? r : typeof r === "object" ? JSON.stringify(r) : String(r),
    );
  }
  if (typeof intent.reasons === "object") {
    return Object.entries(intent.reasons as Record<string, unknown>).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  }
  return [String(intent.reasons)];
}

export default function IntentsPage() {
  const [intents, setIntents] = useState<PaymentIntent[]>([]);
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    Promise.all([
      api.get<PaymentIntent[]>("/payment-intents"),
      // Intents are not always enriched with agent names — join client-side.
      api.get<Agent[]>("/agents").catch(() => [] as Agent[]),
    ])
      .then(([intentList, agentList]) => {
        setIntents(intentList);
        const map: Record<string, string> = {};
        for (const a of agentList) map[a.id] = a.name;
        setAgentNames(map);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load payment intents");
        setIntents([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const agentDisplay = (row: PaymentIntent): string =>
    row.agent?.name ?? agentNames[row.agentId] ?? shortId(row.agentId);

  const columns: Array<Column<Row>> = [
    {
      key: "id",
      label: "Intent",
      render: (row) => (
        <div className="mono-cell">
          <Link href={`/dashboard/intents/${row.id}`}>PI_{shortId(row.id)}</Link>
          <div className="row-sub">{formatDateTime(row.createdAt)}</div>
        </div>
      ),
    },
    {
      key: "agent",
      label: "Agent",
      render: (row) => agentDisplay(row),
    },
    {
      key: "merchant",
      label: "Merchant",
      render: (row) => row.merchant,
    },
    {
      key: "amount",
      label: "Amount",
      className: "num",
      render: (row) => <Amount paise={row.amountPaise} />,
    },
    {
      key: "purpose",
      label: "Purpose",
      render: (row) =>
        row.purpose ? (
          <span className="tooltip">
            {row.purpose.length > 38 ? `${row.purpose.slice(0, 38)}…` : row.purpose}
            <span className="tooltip-content">{row.purpose}</span>
          </span>
        ) : (
          <span className="faint">—</span>
        ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} className={statusTone(row.status)} />,
    },
    {
      key: "decision",
      label: "Decision",
      render: (row) => (
        <StatusBadge status={row.decision} label={row.decision} className={decisionTone(row.decision)} />
      ),
    },
    {
      key: "reasons",
      label: "Reasons",
      render: (row) => {
        const rs = reasonsList(row);
        if (rs.length === 0) return <span className="faint">—</span>;
        return (
          <span className="tooltip" title="View reasons">
            <span className="mono" style={{ fontSize: 12 }}>
              {rs.length} reason{rs.length > 1 ? "s" : ""} ⓘ
            </span>
            <span className="tooltip-content">
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Reasons / checks</div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {rs.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </span>
          </span>
        );
      },
    },
  ];

  const rows: Row[] = intents.map((i) => ({ ...i, _reasons: reasonsList(i) }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">
            Every payment intent an agent has requested, with the firewall's decision.
          </p>
        </div>
      </div>

      {loadError ? (
        <EmptyState
          icon="!"
          title="Unable to load intents"
          body={loadError}
          action={<button className="btn" onClick={load}>Retry</button>}
        />
      ) : loading ? (
        <div className="skeleton" style={{ height: 220 }} />
      ) : intents.length === 0 ? (
        <EmptyState
          title="No payment intents"
          body="Intents appear when agents request payments through the Frame API or SDK."
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={c.key} className={c.className}>
                      {c.render!(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}