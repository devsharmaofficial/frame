"use client";

import { cls } from "@/lib/utils";

const STATUS_TONES: Record<string, string> = {
  active: "safe",
  enabled: "safe",
  completed: "safe",
  success: "safe",
  succeeded: "safe",
  succeeded_paid: "safe",
  authorized: "safe",
  allow: "safe",
  reviewed: "safe",
  paid: "safe",

  pending: "pending",
  pending_approval: "pending",
  created: "pending",
  authorizing: "pending",
  authorizing_approved: "pending",
  processing: "pending",
  evaluating: "pending",
  executing: "pending",
  requires_approval: "pending",
  approve: "pending",
  pending_review: "pending",
  in_progress: "pending",
  initiated: "pending",

  blocked: "blocked",
  denied: "blocked",
  rejected: "blocked",
  disabled: "blocked",
  revoked: "blocked",
  failed: "failed",
  declined: "failed",
  error: "failed",
  expired: "failed",
};

function toneFor(status: string | null | undefined): string {
  if (!status) return "neutral";
  const key = status.toLowerCase().replace(/\s+/g, "_");
  return STATUS_TONES[key] ?? "neutral";
}

export function statusTone(status: string | null | undefined): string {
  return toneFor(status);
}

export function StatusBadge({
  status,
  label,
  className,
}: {
  status?: string | null;
  label?: string | null;
  className?: string;
}) {
  const text = label ?? status;
  if (!text) return <span className="badge neutral">—</span>;
  return <span className={cls("badge", toneFor(status ?? text), className)}>{text}</span>;
}

export function decisionTone(decision: string | null | undefined): string {
  if (!decision) return "neutral";
  switch (decision.toUpperCase()) {
    case "ALLOW":
      return "safe";
    case "DENY":
      return "blocked";
    case "REQUIRE_APPROVAL":
      return "pending";
    default:
      return "neutral";
  }
}