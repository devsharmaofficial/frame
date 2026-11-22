"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, type Agent, type PaymentIntent, type Policy, type PolicyVersion } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Amount } from "@/components/Amount";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/components/Toast";
import { copyToClipboard, shortId } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100/api/v1";

type ScenarioId = "A" | "B" | "C" | "D" | "E";

interface ScenarioState {
  status: "unknown" | "checking" | "satisfied" | "missing";
  evidence: string;
}

const INITIAL: Record<ScenarioId, ScenarioState> = {
  A: { status: "unknown", evidence: "" },
  B: { status: "unknown", evidence: "" },
  C: { status: "unknown", evidence: "" },
  D: { status: "unknown", evidence: "" },
  E: { status: "unknown", evidence: "" },
};

function Snippet({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      toast.success("Copied", label ?? "Snippet copied to clipboard.");
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Copy failed", "Select the snippet and copy it manually.");
    }
  }
  return (
    <div style={{ position: "relative" }}>
      <pre className="demo-snippet">{text}</pre>
      <button className="btn btn-sm" onClick={copy} style={{ position: "absolute", top: 8, right: 8 }}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function DemoPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [states, setStates] = useState<Record<ScenarioId, ScenarioState>>(INITIAL);
  const [checkingAll, setCheckingAll] = useState(false);

  useEffect(() => {
    api.get<Agent[]>("/agents").then(setAgents).catch(() => setAgents([]));
    api.get<Policy[]>("/policies").then(setPolicies).catch(() => setPolicies([]));
  }, []);

  const setOne = (id: ScenarioId, s: ScenarioState) =>
    setStates((prev) => ({ ...prev, [id]: s }));

  const demoIntents = useCallback(async (): Promise<PaymentIntent[]> => {
    const all = await api.get<PaymentIntent[]>("/payment-intents");
    return all.filter((i) => i.merchant?.toLowerCase().startsWith("demo-"));
  }, []);

  async function verify(id: ScenarioId) {
    setOne(id, { status: "checking", evidence: "Querying live endpoints…" });
    try {
      if (id === "A") {
        const intents = await demoIntents();
        const hit = intents.find((i) => ["SUCCEEDED", "AUTHORIZED", "EXECUTING"].includes(i.status));
        if (hit) {
          setOne(id, {
            status: "satisfied",
            evidence: `Found ${hit.id.slice(0, 8)} · ${hit.merchant} · ${hit.status}.`,
          });
        } else {
          setOne(id, {
            status: "missing",
            evidence: `No demo-* intent in SUCCEEDED/AUTHORIZED/EXECUTING yet (${intents.length} demo intent(s) total).`,
          });
        }
      } else if (id === "B") {
        const [intents, approvals] = await Promise.all([
          demoIntents(),
          api.get<Array<{ paymentIntentId: string }>>("/approvals?status=pending").catch(() => []),
        ]);
        const hit = intents.find((i) => i.status === "PENDING_APPROVAL");
        if (hit || approvals.length > 0) {
          setOne(id, {
            status: "satisfied",
            evidence: hit
              ? `Found ${hit.id.slice(0, 8)} awaiting human approval.`
              : `${approvals.length} pending approval task(s) in the org.`,
          });
        } else {
          setOne(id, { status: "missing", evidence: "No PENDING_APPROVAL intent or pending approval task found." });
        }
      } else if (id === "C") {
        const intents = await demoIntents();
        const hit = intents.find((i) => ["DENIED", "REJECTED", "FAILED"].includes(i.status));
        if (hit) {
          setOne(id, {
            status: "satisfied",
            evidence: `Found ${hit.id.slice(0, 8)} · ${hit.merchant} · ${hit.status} (firewall denied).`,
          });
        } else {
          setOne(id, { status: "missing", evidence: `No DENIED/REJECTED/FAILED demo intent yet (${intents.length} demo intent(s) total).` });
        }
      } else if (id === "D") {
        const intents = await demoIntents();
        const hit = intents.find((i) => ["EXECUTING", "SUCCEEDED"].includes(i.status));
        if (hit) {
          const audit = await api
            .get<{ payment?: { providerPaymentId?: string | null } }>(`/payment-intents/${hit.id}/audit`)
            .catch(() => null);
          setOne(id, {
            status: "satisfied",
            evidence: `Found ${hit.id.slice(0, 8)} executed${audit?.payment?.providerPaymentId ? ` · provider ref ${audit.payment.providerPaymentId}` : ""}.`,
          });
        } else {
          setOne(id, { status: "missing", evidence: "No EXECUTING/SUCCEEDED demo intent yet — run POST /payment-intents/:id/execute-user." });
        }
      } else {
        // E: audit trail + policy versioning
        const [policiesList, audit] = await Promise.all([
          api.get<Policy[]>("/policies"),
          api.get<Array<unknown>>("/audit-events").catch(() => [] as Array<unknown>),
        ]);
        const versionCounts = await Promise.all(
          policiesList.slice(0, 5).map((p) =>
            api.get<PolicyVersion[]>(`/policies/${p.id}/versions`).then((v) => v.length).catch(() => 0),
          ),
        );
        const multiVersion = versionCounts.some((n) => n >= 2);
        if (multiVersion || audit.length > 0) {
          setOne(id, {
            status: "satisfied",
            evidence: multiVersion
              ? "A policy with ≥2 versions exists (immutable history)."
              : `${audit.length} audit event(s) recorded (append-only trail).`,
          });
        } else {
          setOne(id, { status: "missing", evidence: "No multi-version policy or audit events found yet." });
        }
      }
    } catch (err) {
      setOne(id, { status: "missing", evidence: err instanceof ApiError ? err.message : "Verification query failed." });
    }
  }

  async function verifyAll() {
    setCheckingAll(true);
    for (const id of ["A", "B", "C", "D", "E"] as ScenarioId[]) {
      await verify(id);
    }
    setCheckingAll(false);
  }

  function badge(id: ScenarioId) {
    const s = states[id];
    if (s.status === "satisfied") return <StatusBadge status="satisfied" label="Satisfied ✓" className="safe" />;
    if (s.status === "missing") return <StatusBadge status="missing" label="Not yet observed" className="pending" />;
    if (s.status === "checking") return <StatusBadge status="checking" label="Checking…" className="pending" />;
    return <StatusBadge status="unknown" label="Unverified" className="neutral" />;
  }

  const agentHint = agents.length > 0 ? agents[0] : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">End-to-end demo</h1>
          <p className="page-subtitle">
            Phase-7 Scenarios A–E. The dashboard cannot mint intents (creation needs an agent key), so this page is a{" "}
            <strong>guided checklist with live verification</strong>: run the curl snippets in your terminal, then press
            Verify to confirm the records exist via real API reads.
          </p>
        </div>
        <button className="btn btn-primary" onClick={verifyAll} disabled={checkingAll}>
          {checkingAll ? <span className="spinner" /> : null} Verify all
        </button>
      </div>

      <div className="banner info" style={{ marginBottom: 16 }}>
        Tag demo traffic with a <span className="mono">demo-</span> merchant prefix (e.g.{" "}
        <span className="mono">demo-acme</span>) so Verify can find it. Amounts are integer paise (₹10 = 1000).
        {agentHint ? (
          <span>
            {" "}Existing agent available: <strong>{agentHint.name}</strong>{" "}
            <Link href={`/dashboard/agents/${agentHint.id}`}>({shortId(agentHint.id)})</Link> — attach a policy under{" "}
            <Link href="/dashboard/policies">Policies</Link> before running intents.
          </span>
        ) : (
          <span> Create an agent + policy first (steps 0–1 below).</span>
        )}
      </div>

      {/* Setup */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <h2 className="card-title">0 · Setup — signup, agent, policy (run once)</h2>
          <Link href="/dashboard/agents" className="link-btn">Agents →</Link>
        </div>
        <div className="card-body">
          <ol className="demo-steps">
            <li>Sign up (or sign in) and export your <span className="mono">user</span> token as <span className="mono">$FRAME_TOKEN</span>.</li>
            <li>Create an agent from the dashboard (owner + environment required) and save its one-time credential as <span className="mono">$AGENT_KEY</span>.</li>
            <li>Create a policy for that agent: transaction limit ₹500 (50000 paise), approval threshold ₹100 (10000 paise).</li>
          </ol>
          <Snippet
            label="Setup snippet copied."
            text={`BASE="${API_BASE}"
# signup (skips if you already have a token)
curl -s -X POST $BASE/auth/signup \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"Demo Dev","email":"dev@demo.test","companyName":"Demo Co","password":"password123"}'
export FRAME_TOKEN="<user-jwt-from-signup-or-signin>"

# agent (or create in /dashboard/agents and copy the one-time key)
curl -s -X POST $BASE/agents \\
  -H "Authorization: Bearer $FRAME_TOKEN" -H 'Content-Type: application/json' \\
  -d '{"name":"demo-runner","owner":"Demo","environment":"sandbox"}'
export AGENT_KEY="<agent-key-shown-once>"

# policy: flat fields accepted; 409 POLICY_EXISTS means edit the existing one
curl -s -X POST $BASE/policies \\
  -H "Authorization: Bearer $FRAME_TOKEN" -H 'Content-Type: application/json' \\
  -d '{"name":"demo-policy","agentId":"<agent-id>","transactionLimitPaise":50000,"approvalThresholdPaise":10000}'`}
          />
        </div>
      </div>

      {/* A */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <h2 className="card-title">A · Auto-approved payment (small amount under threshold)</h2>
          {badge("A")}
        </div>
        <div className="card-body">
          <ol className="demo-steps">
            <li>Create a ₹10 intent with the <strong>agent key</strong> and an <span className="mono">Idempotency-Key</span> header.</li>
            <li>Expect decision <span className="mono">ALLOW</span> → status <span className="mono">AUTHORIZED</span>, no approval task.</li>
            <li>Press Verify — it queries <span className="mono">GET /payment-intents</span> for a <span className="mono">demo-*</span> intent in AUTHORIZED/EXECUTING/SUCCEEDED.</li>
          </ol>
          <Snippet
            text={`BASE="${API_BASE}"
curl -s -X POST $BASE/payment-intents \\
  -H "Authorization: Bearer $AGENT_KEY" \\
  -H 'Content-Type: application/json' -H 'Idempotency-Key: demo-a-001' \\
  -d '{"amountPaise":1000,"merchant":"demo-acme","purpose":"Scenario A auto-approve"}'`}
          />
          <div className="demo-verify">
            <button className="btn btn-sm" onClick={() => verify("A")}>Verify A</button>
            {states.A.evidence ? <span className="muted" style={{ fontSize: 12.5 }}>{states.A.evidence}</span> : null}
          </div>
        </div>
      </div>

      {/* B */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <h2 className="card-title">B · Human approval (amount above threshold)</h2>
          {badge("B")}
        </div>
        <div className="card-body">
          <ol className="demo-steps">
            <li>Create a ₹200 intent (above the ₹100 threshold) — expect <span className="mono">REQUIRE_APPROVAL</span> → <span className="mono">PENDING_APPROVAL</span>.</li>
            <li>Approve it from <Link href="/dashboard/approvals">Approvals</Link> (enriched agent / policy / reason shown).</li>
            <li>Verify checks <span className="mono">GET /payment-intents</span> + <span className="mono">GET /approvals?status=pending</span>.</li>
          </ol>
          <Snippet
            text={`BASE="${API_BASE}"
curl -s -X POST $BASE/payment-intents \\
  -H "Authorization: Bearer $AGENT_KEY" \\
  -H 'Content-Type: application/json' -H 'Idempotency-Key: demo-b-001' \\
  -d '{"amountPaise":20000,"merchant":"demo-acme","purpose":"Scenario B approval"}'
# then approve in the dashboard, or:
curl -s -X POST $BASE/approvals/<approval-id>/approve \\
  -H "Authorization: Bearer $FRAME_TOKEN" -H 'Content-Type: application/json' \\
  -d '{"comment":"demo B approved"}'`}
          />
          <div className="demo-verify">
            <button className="btn btn-sm" onClick={() => verify("B")}>Verify B</button>
            {states.B.evidence ? <span className="muted" style={{ fontSize: 12.5 }}>{states.B.evidence}</span> : null}
          </div>
        </div>
      </div>

      {/* C */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <h2 className="card-title">C · Policy deny (blocked merchant / over limit)</h2>
          {badge("C")}
        </div>
        <div className="card-body">
          <ol className="demo-steps">
            <li>Block <span className="mono">demo-blocked</span> in the policy (edit → new version vN+1), or exceed the ₹500 transaction limit.</li>
            <li>Create the intent — expect decision <span className="mono">DENY</span> → status <span className="mono">DENIED</span>.</li>
            <li>Verify looks for a <span className="mono">demo-*</span> intent in DENIED/REJECTED/FAILED.</li>
          </ol>
          <Snippet
            text={`BASE="${API_BASE}"
curl -s -X POST $BASE/payment-intents \\
  -H "Authorization: Bearer $AGENT_KEY" \\
  -H 'Content-Type: application/json' -H 'Idempotency-Key: demo-c-001' \\
  -d '{"amountPaise":100000,"merchant":"demo-blocked","purpose":"Scenario C deny"}'`}
          />
          <div className="demo-verify">
            <button className="btn btn-sm" onClick={() => verify("C")}>Verify C</button>
            {states.C.evidence ? <span className="muted" style={{ fontSize: 12.5 }}>{states.C.evidence}</span> : null}
          </div>
        </div>
      </div>

      {/* D */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <h2 className="card-title">D · Execute an authorized payment (user execution)</h2>
          {badge("D")}
        </div>
        <div className="card-body">
          <ol className="demo-steps">
            <li>Take an <span className="mono">AUTHORIZED</span> intent from Scenario A.</li>
            <li>Execute it with the <strong>user token</strong>: <span className="mono">POST /payment-intents/:id/execute-user</span>.</li>
            <li>Verify checks for EXECUTING/SUCCEEDED and reads <span className="mono">GET /payment-intents/:id/audit</span> for the provider ref.</li>
          </ol>
          <Snippet
            text={`BASE="${API_BASE}"
curl -s -X POST $BASE/payment-intents/<intent-id>/execute-user \\
  -H "Authorization: Bearer $FRAME_TOKEN"
curl -s $BASE/payment-intents/<intent-id>/audit \\
  -H "Authorization: Bearer $FRAME_TOKEN" | head -c 600`}
          />
          <div className="demo-verify">
            <button className="btn btn-sm" onClick={() => verify("D")}>Verify D</button>
            {states.D.evidence ? <span className="muted" style={{ fontSize: 12.5 }}>{states.D.evidence}</span> : null}
          </div>
        </div>
      </div>

      {/* E */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <h2 className="card-title">E · Audit trail + policy versioning</h2>
          {badge("E")}
        </div>
        <div className="card-body">
          <ol className="demo-steps">
            <li>Edit the demo policy (e.g. raise the transaction limit) — the editor sends <span className="mono">PATCH {"{config}"}</span> and publishes vN+1; history lives at <span className="mono">GET /policies/:id/versions</span>.</li>
            <li>Every state change appends to <span className="mono">GET /audit-events</span> and the intent timeline at <span className="mono">GET /payment-intents/:id/audit → {"{intent,timeline,payment,approval}"}</span>.</li>
            <li>Verify checks for a policy with ≥2 versions or any audit events.</li>
          </ol>
          <Snippet
            text={`BASE="${API_BASE}"
curl -s -X PATCH $BASE/policies/<policy-id> \\
  -H "Authorization: Bearer $FRAME_TOKEN" -H 'Content-Type: application/json' \\
  -d '{"config":{"transactionLimitPaise":75000,"approvalThresholdPaise":10000}}'
curl -s $BASE/policies/<policy-id>/versions -H "Authorization: Bearer $FRAME_TOKEN" | head -c 400`}
          />
          <div className="demo-verify">
            <button className="btn btn-sm" onClick={() => verify("E")}>Verify E</button>
            {states.E.evidence ? <span className="muted" style={{ fontSize: 12.5 }}>{states.E.evidence}</span> : null}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Live context</h2>
        </div>
        <div className="card-body">
          {policies.length === 0 && agents.length === 0 ? (
            <EmptyState
              title="No agents or policies yet"
              body="Create an agent and a policy first — every scenario depends on them."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <div>
                <span className="muted">Agents: </span>
                {agents.length === 0 ? "—" : agents.slice(0, 5).map((a) => a.name).join(", ")}
              </div>
              <div>
                <span className="muted">Policies: </span>
                {policies.length === 0 ? "—" : policies.slice(0, 5).map((p) => `${p.name} (v${p.activeVersion})`).join(", ")}
              </div>
              <div>
                <span className="muted">Recent demo spend: </span>
                <DemoSpend />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DemoSpend() {
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    api
      .get<PaymentIntent[]>("/payment-intents")
      .then((all) => {
        const demo = all.filter((i) => i.merchant?.toLowerCase().startsWith("demo-"));
        setTotal(demo.reduce((sum, i) => sum + Number(i.amountPaise ?? 0), 0));
      })
      .catch(() => setTotal(null));
  }, []);
  if (total == null) return <span className="faint">unavailable</span>;
  return <Amount paise={total} />;
}
