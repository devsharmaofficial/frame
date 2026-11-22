"use client";

import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: string;
  className?: string;
  render?: (row: T) => ReactNode;
}

export function DataTable<T extends { id: string | number }>({
  columns,
  rows,
  empty,
  onRowClick,
}: {
  columns: Array<Column<T>>;
  rows: T[];
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="empty" role="status">
        <div className="empty-icon">∅</div>
        <div className="empty-title">No data</div>
        <div className="empty-body">
          {empty ?? "Nothing to show here yet."}
        </div>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.className}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: "pointer" } : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className={c.className}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}