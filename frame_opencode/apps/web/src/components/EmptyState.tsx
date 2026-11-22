import type { ReactNode } from "react";

export function EmptyState({
  icon = "∅",
  title = "No data",
  body,
  action,
}: {
  icon?: string;
  title?: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty" role="status">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {body ? <div className="empty-body">{body}</div> : null}
      {action ? <div style={{ marginTop: 10 }}>{action}</div> : null}
    </div>
  );
}