"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Transaction } from "@/lib/api";
import { StatusBadge, statusTone } from "@/components/StatusBadge";
import { Amount } from "@/components/Amount";
import { EmptyState } from "@/components/EmptyState";
import { formatDateTime, shortId } from "@/lib/utils";

export default function TransactionsPage() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    api
      .get<Transaction[]>("/transactions")
      .then(setRows)
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load transactions");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">Ledger of payments executed via provider and reconciled to the ledger.</p>
        </div>
      </div>

      {loadError ? (
        <EmptyState
          icon="!"
          title="Unable to load transactions"
          body={loadError}
          action={<button className="btn" onClick={load}>Retry</button>}
        />
      ) : loading ? (
        <div className="skeleton" style={{ height: 220 }} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No transactions"
          body="No ledger entries yet. Executed payments will appear here as provider events are reconciled."
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Intent</th>
                <th>Provider</th>
                <th>Provider ref</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span className="row-title mono" style={{ fontSize: 12 }}>
                      TX_{shortId(t.id)}
                    </span>
                  </td>
                  <td className="mono-cell">
                    {t.paymentIntentId ? `PI_${shortId(t.paymentIntentId)}` : "—"}
                  </td>
                  <td>
                    <StatusBadge status={t.provider} label={t.provider} className="neutral" />
                  </td>
                  <td className="mono-cell">{t.providerPaymentId ?? "—"}</td>
                  <td className="num">
                    <Amount paise={t.amountPaise} />
                  </td>
                  <td>
                    <StatusBadge status={t.status} className={statusTone(t.status)} />
                    {t.errorCode ? (
                      <div className="mono faint" style={{ fontSize: 11, marginTop: 2 }}>
                        {t.errorCode}
                      </div>
                    ) : null}
                  </td>
                  <td className="mono-cell faint">{formatDateTime(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}