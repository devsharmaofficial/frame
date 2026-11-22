import { cls } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  className,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cls("stat-card", className)}>
      <div className="stat-label">{label}</div>
      <div className={cls("stat-value", valueClassName)}>{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="stat-card" aria-busy="true">
      <div className="skeleton" style={{ height: 12, width: 90 }} />
      <div className="skeleton" style={{ height: 26, width: 130 }} />
      <div className="skeleton" style={{ height: 12, width: 70 }} />
    </div>
  );
}