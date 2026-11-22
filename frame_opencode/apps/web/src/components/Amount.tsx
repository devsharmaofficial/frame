import { fmtINR } from "@/lib/utils";

export function Amount({
  paise,
  compact = false,
  className,
}: {
  paise: number | string | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  const value = Number(paise ?? 0);
  const text = compact
    ? fmtCompact(value)
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value / 100);

  return <span className={`num ${className ?? ""}`}>{text}</span>;
}

function fmtCompact(paise: number): string {
  const r = paise / 100;
  if (Math.abs(r) >= 10000000) return `₹${(r / 10000000).toFixed(1)}Cr`;
  if (Math.abs(r) >= 100000) return `₹${(r / 100000).toFixed(1)}L`;
  if (Math.abs(r) >= 1000) return `₹${(r / 1000).toFixed(1)}k`;
  return `₹${r.toFixed(0)}`;
}