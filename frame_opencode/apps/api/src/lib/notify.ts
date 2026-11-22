import { appendAudit } from "./audit.js";

export interface NotifyOptions {
  actorType?: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  requestId?: string;
}

/**
 * Central notification emitter.
 *
 * Persists a `notification.<type>` audit event (the durable, queryable
 * record — no new tables) and best-effort pushes to an email/log channel.
 * Dependency-free: when SMTP_URL is set we emit a structured "email queued"
 * log line for an external mailer to pick up; otherwise nothing external.
 *
 * Never throws — notification failures must never break payments.
 */
export async function emitNotification(
  orgId: string,
  type: string,
  payload: unknown,
  opts: NotifyOptions = {},
): Promise<void> {
  try {
    await appendAudit({
      organizationId: orgId,
      actorType: opts.actorType ?? "system",
      actorId: opts.actorId,
      action: `notification.${type}`,
      resourceType: opts.resourceType,
      resourceId: opts.resourceId,
      entityAfter: payload,
      requestId: opts.requestId,
    });
  } catch {
    return;
  }

  try {
    if (process.env.SMTP_URL) {
      console.log(
        JSON.stringify({
          channel: "email",
          queued: true,
          message: "email queued",
          organizationId: orgId,
          type,
          resourceType: opts.resourceType ?? null,
          resourceId: opts.resourceId ?? null,
        }),
      );
    }
  } catch {
    // logging must never break callers
  }
}
