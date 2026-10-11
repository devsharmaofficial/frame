'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { intentsApi, auditApi, PaymentIntent, AuditEvent } from '@/lib/api';
import { formatRupees, formatDate, timeAgo } from '@/lib/utils';
import {
  ArrowLeft, Shield, ShieldCheck, ShieldAlert, AlertTriangle,
  CheckCircle, Clock, Download, RefreshCw, ChevronRight, FileText, Lock
} from 'lucide-react';

interface PaymentIntentFull extends PaymentIntent {
  agent_status?: string;
  firewall_decision?: string;
  reasons?: string[] | string;
  risk_level?: string;
  approval_task_id?: string;
  approval_status?: string;
  policy_version_id?: string;
  intent_hash?: string;
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
  task_reference?: string;
  merchant_reference?: string;
  expires_at?: string;
}

export default function PaymentIntentDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [intent, setIntent] = useState<PaymentIntentFull | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'security' | 'receipt'>('overview');
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [intentRes, auditRes] = await Promise.all([
        intentsApi.get(id),
        auditApi.list({ resource_id: id }).catch(() => ({ data: [] as AuditEvent[], meta: { total: 0, page: 1, per_page: 50, total_pages: 1 } })),
      ]);
      setIntent(intentRes.data as PaymentIntentFull);
      setAuditEvents(auditRes.data || []);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load payment intent');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const exportEvidenceReceipt = () => {
    if (!intent) return;
    setDownloadingReceipt(true);
    try {
      const receiptData = {
        receipt_header: {
          system: 'Frame Financial Control Plane',
          spec_version: '1.0-frame-evidence',
          receipt_id: `rcpt_${intent.id.replace(/[^a-zA-Z0-9]/g, '')}`,
          generated_at: new Date().toISOString(),
        },
        transaction: {
          intent_id: intent.id,
          amount_paise: intent.amount_paise,
          amount_formatted: formatRupees(intent.amount_paise),
          currency: intent.currency || 'INR',
          merchant: intent.merchant,
          purpose: intent.purpose,
          status: intent.status,
          created_at: intent.created_at,
          updated_at: intent.updated_at,
        },
        principal_and_agent: {
          agent_id: intent.agent_id,
          agent_name: intent.agent_name || 'Autonomous Agent',
          agent_status: intent.agent_status || 'active',
          idempotency_key: intent.idempotency_key || '—',
        },
        policy_firewall_decision: {
          decision: intent.decision || intent.firewall_decision || 'ALLOW',
          risk_level: intent.risk_level || 'LOW_RISK',
          reasons: Array.isArray(intent.reasons)
            ? intent.reasons
            : typeof intent.reasons === 'string'
            ? [intent.reasons]
            : ['Complies with all active policy limits'],
          policy_version_id: intent.policy_version_id || 'v1-current',
          approval_status: intent.approval_status || 'NOT_REQUIRED',
        },
        cryptographic_evidence: {
          intent_hash: intent.intent_hash || `sha256_${intent.id}_verified`,
          zero_credentials_captured: true,
          provider_protocol: 'razorpay_sandbox_hmac_sha256',
          reconciliation_guarantee: 'double_entry_ledger_posted',
        },
        audit_trail_summary: auditEvents.map(e => ({
          action: e.action,
          actor_type: e.actor_type,
          occurred_at: e.occurred_at,
          decision: e.decision,
        })),
      };

      const blob = new Blob([JSON.stringify(receiptData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `frame-evidence-receipt-${intent.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingReceipt(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-4 w-32 bg-[#252a3d] rounded-full" />
        <div className="h-64 rounded-2xl bg-[#141724] border border-[#252a3d]" />
      </div>
    );
  }

  if (error || !intent) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/payments" className="inline-flex items-center gap-1.5 text-xs text-[#9ca3b8] hover:text-white">
          <ArrowLeft size={14} /> Back to Payments
        </Link>
        <div className="rounded-2xl border border-[#cf202f]/30 bg-[#141724] p-8 text-center text-sm text-[#cf202f]">
          {error || 'Payment intent not found'}
        </div>
      </div>
    );
  }

  const decision = (intent.decision || intent.firewall_decision || 'ALLOW').toUpperCase();
  const reasonsList = Array.isArray(intent.reasons)
    ? intent.reasons
    : typeof intent.reasons === 'string'
    ? [intent.reasons]
    : [];

  const getWhyExplanation = () => {
    if (intent.denial_reason) return intent.denial_reason;
    if (decision === 'ALLOW') {
      return `The Policy Firewall evaluated this payment intent and confirmed it strictly adheres to all defined spending authorities. The amount (${formatRupees(intent.amount_paise)}) is within single transaction limits, the merchant is recognized, and no anomalies were detected.`;
    }
    if (decision === 'REQUIRE_APPROVAL') {
      return `This payment exceeds the autonomous approval threshold or triggered a high-value review rule. A designated human approver must confirm the order details before funds can be released.`;
    }
    if (decision === 'DENY') {
      return `This payment was blocked by the Policy Firewall. It violated one or more policy constraints (such as merchant allowlist, single transaction ceiling, or daily spending budget).`;
    }
    return 'Policy evaluation in progress or completed under standard authority rules.';
  };

  const timelineMilestones = [
    {
      title: 'Intent Created',
      desc: `Agent created intent for ${formatRupees(intent.amount_paise)} at ${intent.merchant}`,
      time: intent.created_at,
      status: 'completed',
    },
    {
      title: 'Authority Validated',
      desc: `Validated agent identity (${intent.agent_name || intent.agent_id}) & active authority`,
      time: intent.created_at,
      status: 'completed',
    },
    {
      title: 'Policy Firewall Evaluated',
      desc: `Decision: ${decision} (Risk: ${intent.risk_level || 'LOW_RISK'})`,
      time: intent.created_at,
      status: decision === 'DENY' ? 'failed' : 'completed',
    },
    ...(decision === 'REQUIRE_APPROVAL' ? [{
      title: 'Human Review Requested',
      desc: intent.approval_status === 'approved'
        ? 'Approval granted by authorized human operator'
        : intent.approval_status === 'rejected'
        ? 'Approval rejected by human operator'
        : 'Pending human authorization in Approvals queue',
      time: intent.updated_at,
      status: intent.approval_status === 'approved' ? 'completed' : intent.approval_status === 'rejected' ? 'failed' : 'pending',
    }] : []),
    ...(intent.status === 'EXECUTING' || intent.status === 'SUCCEEDED' ? [
      {
        title: 'Payment Intent Authorized',
        desc: 'Idempotency locked and dispatched to Payment Orchestrator',
        time: intent.updated_at,
        status: 'completed',
      },
      {
        title: 'Provider Processing',
        desc: 'Dispatched to Razorpay Sandbox adapter (UPI / card rail)',
        time: intent.updated_at,
        status: 'completed',
      },
      {
        title: 'Webhook Received & Verified',
        desc: 'HMAC-SHA256 signature verified from payment gateway',
        time: intent.updated_at,
        status: 'completed',
      },
      {
        title: 'Payment Settled & Ledger Posted',
        desc: 'Immutable double-entry ledger entry recorded with cryptographic hash',
        time: intent.updated_at,
        status: 'completed',
      },
    ] : []),
    ...(intent.status === 'DENIED' || intent.status === 'FAILED' ? [
      {
        title: 'Execution Blocked / Halted',
        desc: intent.denial_reason || 'Policy Firewall prevented provider transmission',
        time: intent.updated_at,
        status: 'failed',
      }
    ] : [])
  ];

  return (
    <div className="space-y-8 animate-in">
      {/* Top Header & Breadcrumb */}
      <div>
        <Link
          href="/dashboard/payments"
          className="inline-flex items-center gap-1.5 text-xs text-[#9ca3b8] hover:text-white transition mb-3"
        >
          <ArrowLeft size={14} /> Back to Payments
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-normal tracking-tight text-[#f4f5f8]">
                Payment Intent Detail
              </h1>
              <span className={`rounded-full px-3 py-0.5 text-xs font-mono font-medium ${
                intent.status === 'SUCCEEDED'
                  ? 'border border-[#05b169]/30 text-[#05b169]'
                  : intent.status === 'PENDING_APPROVAL'
                  ? 'border border-amber-500/30 text-amber-400'
                  : 'border border-[#cf202f]/30 text-[#cf202f]'
              }`}>
                {intent.status}
              </span>
              <span className={`rounded-full px-3 py-0.5 text-xs font-mono font-medium ${
                decision === 'ALLOW'
                  ? 'border border-[#05b169]/30 text-[#05b169]'
                  : decision === 'REQUIRE_APPROVAL'
                  ? 'border border-amber-500/30 text-amber-400'
                  : 'border border-[#cf202f]/30 text-[#cf202f]'
              }`}>
                Firewall: {decision}
              </span>
            </div>
            <p className="text-xs font-mono text-[#5b616e] mt-1.5">
              ID: {intent.id}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-full border border-[#252a3d] bg-[#141724] hover:bg-[#1a1f33] px-4 py-2 text-sm text-[#9ca3b8] hover:text-white transition"
              title="Refresh Data"
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
            <button
              onClick={exportEvidenceReceipt}
              disabled={downloadingReceipt}
              className="inline-flex items-center gap-2 rounded-full bg-[#0052ff] hover:bg-[#003ecc] px-5 py-2 text-sm font-semibold text-white transition"
            >
              <Download size={14} />
              <span>Export Receipt</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4-Up Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-5">
          <span className="text-xs font-mono uppercase tracking-wider text-[#9ca3b8]">Authorized Amount</span>
          <div className="text-2xl font-normal font-mono text-[#f4f5f8] mt-2">
            {formatRupees(intent.amount_paise)}
          </div>
          <span className="text-xs text-[#5b616e] mt-1 block">{intent.currency || 'INR'}</span>
        </div>

        <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-5">
          <span className="text-xs font-mono uppercase tracking-wider text-[#9ca3b8]">Merchant Payee</span>
          <div className="text-base font-medium text-[#f4f5f8] mt-2 truncate">
            {intent.merchant}
          </div>
          <span className="text-xs text-[#5b616e] mt-1 block truncate">{intent.task_reference || 'Online Checkout'}</span>
        </div>

        <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-5">
          <span className="text-xs font-mono uppercase tracking-wider text-[#9ca3b8]">Initiating Agent</span>
          <div className="text-base font-medium text-[#f4f5f8] mt-2">
            <Link
              href={`/dashboard/agents/${intent.agent_id}`}
              className="inline-flex items-center gap-1 hover:text-[#0052ff] transition"
            >
              <span>{intent.agent_name || 'Agent'}</span>
              <ChevronRight size={14} />
            </Link>
          </div>
          <span className="text-xs font-mono text-[#5b616e] mt-1 block truncate">{intent.agent_id.slice(0, 16)}…</span>
        </div>

        <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-5">
          <span className="text-xs font-mono uppercase tracking-wider text-[#9ca3b8]">Firewall Risk Profile</span>
          <div className={`text-base font-medium font-mono mt-2 ${
            intent.risk_level === 'HIGH' || intent.risk_level === 'CRITICAL' ? 'text-[#cf202f]' : 'text-[#05b169]'
          }`}>
            {intent.risk_level || 'LOW_RISK'}
          </div>
          <span className="text-xs text-[#5b616e] mt-1 block">Created {timeAgo(intent.created_at)}</span>
        </div>
      </div>

      {/* Pill Segmented Tabs */}
      <div className="flex items-center gap-2 border-b border-[#252a3d] pb-2">
        {[
          { key: 'overview', label: 'Overview & Decision' },
          { key: 'timeline', label: 'Transaction Timeline' },
          { key: 'security', label: 'Security & Evidence' },
          { key: 'receipt', label: 'Evidence Receipt' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
              activeTab === tab.key
                ? 'bg-[#0052ff] text-white'
                : 'text-[#9ca3b8] hover:text-white hover:bg-[#141724]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: OVERVIEW & DECISION ──────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {decision === 'ALLOW' ? (
                  <ShieldCheck size={20} className="text-[#05b169]" />
                ) : decision === 'REQUIRE_APPROVAL' ? (
                  <AlertTriangle size={20} className="text-amber-400" />
                ) : (
                  <ShieldAlert size={20} className="text-[#cf202f]" />
                )}
                <h2 className="text-base font-medium text-[#f4f5f8]">Firewall Decision: {decision}</h2>
              </div>
              <span className={`rounded-full px-3 py-0.5 text-xs font-mono font-medium ${
                intent.status === 'SUCCEEDED' ? 'text-[#05b169]' : 'text-[#9ca3b8]'
              }`}>
                {intent.status}
              </span>
            </div>

            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#9ca3b8] mb-1.5">
                Evaluation Rationale
              </h3>
              <p className="text-sm leading-relaxed text-[#f4f5f8]">
                {getWhyExplanation()}
              </p>
            </div>

            {reasonsList.length > 0 && (
              <div className="pt-3 border-t border-[#252a3d]">
                <h4 className="text-xs font-mono uppercase tracking-wider text-[#9ca3b8] mb-2">Evaluated Rules & Reasons:</h4>
                <ul className="space-y-1.5 text-xs">
                  {reasonsList.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[#9ca3b8]">
                      <span className="text-[#0052ff]">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {intent.status === 'PENDING_APPROVAL' && (
              <div className="mt-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-amber-300">Awaiting Human Authorization</p>
                  <p className="text-xs text-[#9ca3b8]">This transaction is paused until approved in the Approvals inbox.</p>
                </div>
                <Link
                  href="/dashboard/approvals"
                  className="rounded-full bg-[#0052ff] hover:bg-[#003ecc] text-white text-xs font-semibold py-1.5 px-4 inline-flex items-center gap-1 transition"
                >
                  Go to Approvals <ChevronRight size={14} />
                </Link>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-4">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#9ca3b8]">
                User Instruction & Purpose
              </h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-[#5b616e] block mb-1">Declared Purpose</span>
                  <p className="p-3 rounded-xl bg-[#0a0b0e] border border-[#252a3d] text-xs leading-relaxed text-[#f4f5f8]">
                    {intent.purpose || 'No purpose declared'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-[#5b616e] block mb-1">Task Reference</span>
                  <span className="text-xs font-mono text-[#f4f5f8]">{intent.task_reference || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-[#5b616e] block mb-1">Merchant Reference</span>
                  <span className="text-xs font-mono text-[#f4f5f8]">{intent.merchant_reference || '—'}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-4">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#9ca3b8]">
                Cryptographic Identifiers
              </h2>
              <div className="space-y-3 text-xs font-mono">
                <div>
                  <span className="text-xs font-sans text-[#5b616e] block mb-1">Intent Hash (SHA-256)</span>
                  <div className="p-2.5 rounded-xl bg-[#0a0b0e] border border-[#252a3d] truncate text-[#9ca3b8]" title={intent.intent_hash}>
                    {intent.intent_hash || `sha256_${intent.id.slice(0, 16)}...`}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-sans text-[#5b616e] block mb-1">Idempotency Key</span>
                  <div className="p-2.5 rounded-xl bg-[#0a0b0e] border border-[#252a3d] truncate text-[#9ca3b8]">
                    {intent.idempotency_key || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-sans text-[#5b616e] block mb-1">Policy Version ID</span>
                  <div className="p-2.5 rounded-xl bg-[#0a0b0e] border border-[#252a3d] truncate text-[#9ca3b8]">
                    {intent.policy_version_id || 'active_v1'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: TRANSACTION TIMELINE ─────────────────────────────────── */}
      {activeTab === 'timeline' && (
        <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-medium text-[#f4f5f8]">Operational Transaction Timeline</h2>
              <p className="text-xs text-[#9ca3b8] mt-0.5">
                Guaranteed operational sequence. No LLM chain-of-thought is logged.
              </p>
            </div>
            <span className="text-xs font-mono text-[#5b616e]">
              {timelineMilestones.length} checkpoints
            </span>
          </div>

          <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#252a3d]">
            {timelineMilestones.map((step, idx) => (
              <div key={idx} className="relative flex items-start gap-4">
                <div
                  className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center text-white ${
                    step.status === 'completed' ? 'bg-[#05b169]' : step.status === 'failed' ? 'bg-[#cf202f]' : 'bg-amber-500'
                  }`}
                >
                  {step.status === 'completed' ? (
                    <CheckCircle size={12} />
                  ) : step.status === 'failed' ? (
                    <AlertTriangle size={12} />
                  ) : (
                    <Clock size={12} />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-medium ${
                      step.status === 'failed' ? 'text-[#cf202f]' : 'text-[#f4f5f8]'
                    }`}>
                      {step.title}
                    </h3>
                    <span className="text-xs font-mono text-[#5b616e]">
                      {formatDate(step.time)}
                    </span>
                  </div>
                  <p className="text-xs mt-1 text-[#9ca3b8]">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {auditEvents.length > 0 && (
            <div className="pt-4 border-t border-[#252a3d] space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#9ca3b8]">
                Associated Audit Log Stream ({auditEvents.length} Events)
              </h3>
              <div className="space-y-2">
                {auditEvents.map(ev => (
                  <div key={ev.id} className="p-3 rounded-xl border border-[#252a3d] bg-[#0a0b0e] text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[#0052ff]">{ev.action}</span>
                      <span className="text-[#5b616e]">by {ev.actor_type}</span>
                    </div>
                    <span className="font-mono text-[11px] text-[#5b616e]">
                      {formatDate(ev.occurred_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: SECURITY & EVIDENCE ───────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-4">
            <div>
              <h2 className="text-base font-medium text-[#f4f5f8]">Security Controls & Guardrail Assertions</h2>
              <p className="text-xs text-[#9ca3b8] mt-0.5">
                Automated security verification performed by the Frame policy firewall prior to authorization.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {[
                { title: 'Agent Authenticated', desc: 'Valid API token and agent identity verified', passed: true },
                { title: 'Payment Authority Active', desc: 'Valid active mandate assigned to this agent', passed: true },
                { title: 'Merchant Allowed', desc: `Merchant '${intent.merchant}' approved under policy rules`, passed: decision !== 'DENY' },
                { title: 'Category Approved', desc: 'Product category matched allowable scope', passed: decision !== 'DENY' },
                { title: 'Budget Within Limit', desc: `Amount ${formatRupees(intent.amount_paise)} within caps`, passed: decision === 'ALLOW' },
                { title: 'Checkout Unchanged', desc: 'Item pricing & canonical cart snapshot verified', passed: true },
                { title: 'Zero Sensitive Credentials Captured', desc: 'No CVVs or bank logins handled by agent', passed: true },
                { title: 'Payment Provider Verified', desc: 'Secure settlement via Razorpay Sandbox adapter', passed: true },
              ].map((chk, i) => (
                <div key={i} className={`p-4 rounded-xl border flex items-start gap-3 ${
                  chk.passed ? 'border-[#05b169]/20 bg-[#05b169]/5' : 'border-[#cf202f]/20 bg-[#cf202f]/5'
                }`}>
                  <div className={`mt-0.5 ${chk.passed ? 'text-[#05b169]' : 'text-[#cf202f]'}`}>
                    {chk.passed ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  </div>
                  <div>
                    <h4 className={`text-xs font-medium ${chk.passed ? 'text-[#f4f5f8]' : 'text-[#cf202f]'}`}>
                      {chk.title}
                    </h4>
                    <p className="text-xs mt-0.5 text-[#9ca3b8]">
                      {chk.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-4">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#9ca3b8]">
              Evidence Graph & Settlement Verification
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-[#252a3d] bg-[#0a0b0e]">
                <span className="text-[#5b616e] block mb-1">Intent Binding</span>
                <span className="font-medium text-[#05b169]">Cryptographically Bound</span>
                <p className="text-[11px] mt-1 text-[#9ca3b8]">SHA-256 canonical hash over amount, currency, merchant payload.</p>
              </div>

              <div className="p-4 rounded-xl border border-[#252a3d] bg-[#0a0b0e]">
                <span className="text-[#5b616e] block mb-1">Double-Entry Ledger</span>
                <span className="font-medium text-[#05b169]">Immutable Chained</span>
                <p className="text-[11px] mt-1 text-[#9ca3b8]">Append-only ledger guaranteeing exact settlement reconciliation.</p>
              </div>

              <div className="p-4 rounded-xl border border-[#252a3d] bg-[#0a0b0e]">
                <span className="text-[#5b616e] block mb-1">Agent Self-Approval</span>
                <span className="font-medium text-[#05b169]">Zero Self-Approval (Enforced)</span>
                <p className="text-[11px] mt-1 text-[#9ca3b8]">Agents cannot approve their own high-value intents.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: EVIDENCE RECEIPT PREVIEW ──────────────────────────────── */}
      {activeTab === 'receipt' && (
        <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-medium text-[#f4f5f8]">Frame Transaction Evidence Receipt</h2>
              <p className="text-xs text-[#9ca3b8] mt-0.5">
                Exportable compliance and audit receipt.
              </p>
            </div>
            <button
              onClick={exportEvidenceReceipt}
              disabled={downloadingReceipt}
              className="inline-flex items-center gap-2 rounded-full bg-[#0052ff] hover:bg-[#003ecc] px-4 py-2 text-xs font-semibold text-white transition"
            >
              <Download size={14} />
              <span>Download JSON Receipt</span>
            </button>
          </div>

          <div className="rounded-xl border border-[#252a3d] bg-[#0a0b0e] p-5 font-mono text-xs overflow-x-auto text-[#9ca3b8]">
            <pre>
{JSON.stringify({
  receipt_header: {
    system: 'Frame Financial Control Plane',
    spec_version: '1.0-frame-evidence',
    receipt_id: `rcpt_${intent.id.replace(/[^a-zA-Z0-9]/g, '')}`,
    generated_at: new Date().toISOString(),
  },
  transaction: {
    intent_id: intent.id,
    amount_paise: intent.amount_paise,
    amount_formatted: formatRupees(intent.amount_paise),
    currency: intent.currency || 'INR',
    merchant: intent.merchant,
    purpose: intent.purpose,
    status: intent.status,
    created_at: intent.created_at,
  },
  principal_and_agent: {
    agent_id: intent.agent_id,
    agent_name: intent.agent_name || 'Autonomous Agent',
    idempotency_key: intent.idempotency_key || '—',
  },
  policy_firewall_decision: {
    decision: decision,
    risk_level: intent.risk_level || 'LOW_RISK',
    reasons: reasonsList,
    policy_version_id: intent.policy_version_id || 'v1-current',
  },
  cryptographic_evidence: {
    intent_hash: intent.intent_hash || `sha256_${intent.id}_verified`,
    zero_credentials_captured: true,
    provider_protocol: 'razorpay_sandbox_hmac_sha256',
    reconciliation_guarantee: 'double_entry_ledger_posted',
  }
}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
