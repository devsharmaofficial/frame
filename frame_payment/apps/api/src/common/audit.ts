import type { Store } from "./store.js";

export function recordAudit(store: Store, event: Omit<Parameters<typeof makeAudit>[0], "id" | "createdAt">) {
  store.audit.push(makeAudit({ ...event, id: store.id("aud"), createdAt: store.now() }));
}

function makeAudit(event: { id: string; organizationId: string; action: string; entityId: string; requestId: string; metadata: Record<string, unknown>; createdAt: string }) {
  return event;
}
