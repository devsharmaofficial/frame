/** End-to-end demo against a live Frame API (DATABASE_URL-backed server). */
import { randomUUID } from "node:crypto";
import { FrameClient, paiseToInr, toPaiseNumber } from "../src/index.js";

const baseUrl = process.env["FRAME_API_URL"] ?? "http://localhost:4100/api/v1";
const uniq = randomUUID().slice(0, 8);
const client = new FrameClient({ baseUrl });

function rs(v: unknown): string {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const inner = ("intent" in o ? o["intent"] : ("agent" in o ? o["agent"] : ("policy" in o ? o["policy"] : v))) as unknown;
    return JSON.stringify(inner ?? v);
  }
  return String(v);
}

async function main(): Promise<void> {
  // 1. Fresh signup (unique org each run).
  const email = `demo+${uniq}@example.com`;
  const { token, user } = await client.auth.signup({
    name: "Demo User", email, companyName: `Demo Co ${uniq}`, password: "password123",
  });
  console.log(`signup ok user=${String((user as { id?: string })?.id)} token=...${token.slice(-6)}`);

  // 2. Agent (user auth).
  const { agent, credential } = await client.agents.create({
    name: `demo-agent-${uniq}`, description: "SDK demo agent",
    owner: "demo", environment: "sandbox", purpose: "demo",
  }) as { agent: { id: string }; credential: { key: string } };
  console.log(`agent ok id=${agent.id} key=...${credential.key.slice(-6)}`);

  // 3. Policy with flat dashboard fields.
  const pol = await client.policies.create({
    agentId: agent.id, name: `demo-policy-${uniq}`,
    allowedMerchants: ["acme"], transactionLimitPaise: 500000,
    approvalThresholdPaise: 10000,
  });
  console.log(`policy ok ${rs(pol)}`);

  // 4. Intent as AGENT (small amount → ALLOW path if policy permits).
  const agentClient = new FrameClient({ baseUrl, apiKey: credential.key });
  const intent = await agentClient.paymentIntents.create(
    { agentId: agent.id, amountPaise: 1999, merchant: "acme", purpose: "demo coffee" },
    { idempotencyKey: randomUUID() },
  ) as { id: string; status?: string; decision?: string; amountPaise: number | string };
  const amt = toPaiseNumber(intent.amountPaise ?? 1999);
  console.log(`intent ok id=${intent.id} status=${intent.status} decision=${intent.decision} amount=₹${paiseToInr(amt)}`);

  // 5. Threshold flow: big intent likely needs approval → approve as admin.
  const big = await agentClient.paymentIntents.create(
    { agentId: agent.id, amountPaise: 50000, merchant: "acme", purpose: "demo laptop" },
    { idempotencyKey: randomUUID() },
  ) as { id: string; status?: string; decision?: string };
  console.log(`big intent id=${big.id} status=${big.status} decision=${big.decision}`);
  const pend = await client.approvals.list({ status: "pending" }) as
    { approvals?: Array<{ id: string }> } | Array<{ id: string }>;
  const tasks = Array.isArray(pend) ? pend : (pend.approvals ?? []);
  const mine = tasks.length > 0 ? tasks[tasks.length - 1] : undefined;
  if (mine) {
    await client.approvals.approve(mine.id, { comment: "sdk demo approve" });
    console.log(`approved ${mine.id}`);
  } else {
    console.log("no pending approvals (intent auto-decided)");
  }

  // 6. Execute as user, then webhook test + audit fetch.
  const exec = await client.paymentIntents.executeUser(intent.id);
  console.log(`execute-user ok ${rs(exec)}`);
  const hook = await client.webhooks.test({ payment_id: (exec as { providerPaymentId: string }).providerPaymentId, event_type: "payment.succeeded" });
  console.log(`webhook ok ${rs(hook)}`);
  const audit = await client.paymentIntents.audit(intent.id);
  console.log(`audit ok timeline=${Array.isArray((audit as { timeline?: unknown[] }).timeline) ? (audit as { timeline: unknown[] }).timeline.length : "?"} events`);
  console.log("DEMO OK");
}

main().catch((e) => { console.error("DEMO FAILED:", e); process.exit(1); });
