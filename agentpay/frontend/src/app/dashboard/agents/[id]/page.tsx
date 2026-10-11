'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { agentsApi, policiesApi, intentsApi, authoritiesApi, Agent, Policy, PaymentIntent, Credential, PaymentAuthority } from '@/lib/api';
import { formatRupees, getStatusBadge, timeAgo, formatDate } from '@/lib/utils';
import { Key, Power, PowerOff, Plus, Copy, Check, Eye, EyeOff, ShieldCheck, ChevronRight } from 'lucide-react';

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [authorities, setAuthorities] = useState<PaymentAuthority[]>([]);
  const [intents, setIntents] = useState<PaymentIntent[]>([]);
  const [creds, setCreds] = useState<Credential[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [agentRes, credsRes, intentsRes, policiesRes, authRes] = await Promise.all([
      agentsApi.get(id),
      agentsApi.listCredentials(id),
      intentsApi.list({ agent_id: id, per_page: 10 }),
      policiesApi.list(id),
      authoritiesApi.list({ agent_id: id }).catch(() => ({ data: [] as PaymentAuthority[] })),
    ]);
    setAgent(agentRes.data);
    setCreds(credsRes.data);
    setIntents(intentsRes.data);
    setPolicy(policiesRes.data[0] || null);
    setAuthorities(authRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const [actionError, setActionError] = useState<string | null>(null);

  const generateKey = async () => {
    setActionError(null);
    try {
      const res = await agentsApi.createCredential(id);
      setNewKey(res.data.api_key || null);
      await load();
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to generate API key');
    }
  };

  const copyKey = () => {
    if (newKey) { navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const toggle = async () => {
    if (!agent) return;
    setActionError(null);
    try {
      if (agent.status === 'active') await agentsApi.disable(id, 'Manually disabled');
      else if (agent.status === 'disabled') await agentsApi.enable(id);
      await load();
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to update agent status');
    }
  };

  if (loading) return <div className="p-6"><div className="card h-40 animate-pulse" /></div>;
  if (!agent) return <div className="p-6 text-center">Agent not found</div>;

  return (
    <div className="p-6 space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{agent.name}</h1>
            <span className={`badge ${getStatusBadge(agent.status)}`}>{agent.status}</span>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{agent.purpose || 'No purpose set'}</p>
          <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>ID: {agent.id}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={toggle} disabled={agent.status === 'revoked'}>
            {agent.status === 'active' ? <><PowerOff size={14} /> Disable</> : <><Power size={14} /> Enable</>}
          </button>
          <button className="btn-primary" onClick={generateKey}>
            <Key size={14} /> Generate API Key
          </button>
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="card p-4 text-xs font-medium flex items-center justify-between" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
          <span>{actionError}</span>
          <button className="text-xs underline ml-4" onClick={() => setActionError(null)}>Dismiss</button>
        </div>
      )}

      {/* New API Key */}
      {newKey && (
        <div className="card p-4" style={{ border: '1px solid rgba(34,197,94,0.3)', background: 'var(--success-bg)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--success)' }}>
            ⚠️ Copy this API key now — it will never be shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono px-3 py-2 rounded-lg overflow-x-auto"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
              {newKey}
            </code>
            <button className="btn-secondary p-2" onClick={copyKey}>
              {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
            </button>
          </div>
          <button className="text-xs mt-2" style={{ color: 'var(--text-muted)' }} onClick={() => setNewKey(null)}>
            Dismiss (key is gone after this)
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <span className="stat-label">Team</span>
          <div className="stat-value text-base">{agent.owner_team || '—'}</div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Payments</span>
          <div className="stat-value">{agent.total_payments || 0}</div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Spend</span>
          <div className="stat-value">{formatRupees(agent.total_spend_paise || 0)}</div>
        </div>
      </div>

        {/* Policy */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-3">Active Policy</h2>
        {policy ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>Name</span>
              <span className="font-medium">{policy.name}</span>
            </div>
            {policy.transaction_limit_paise && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Transaction Limit</span>
                <span className="font-mono">{formatRupees(policy.transaction_limit_paise)}</span>
              </div>
            )}
            {policy.daily_limit_paise && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Daily Limit</span>
                <span className="font-mono">{formatRupees(policy.daily_limit_paise)}</span>
              </div>
            )}
            {policy.approval_threshold_paise && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Approval Above</span>
                <span className="font-mono">{formatRupees(policy.approval_threshold_paise)}</span>
              </div>
            )}
            {policy.merchant_allowlist && policy.merchant_allowlist.length > 0 && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Allowed Merchants</span>
                <span className="text-xs">{policy.merchant_allowlist.join(', ')}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
            No policy configured. <a href="/dashboard/policies" style={{ color: 'var(--accent)' }}>Create a policy →</a>
          </div>
        )}
      </div>

      {/* Payment Authorities */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-semibold">Payment Authorities ({authorities.length})</h2>
          </div>
          <Link href="/dashboard/payment-authorities" className="text-xs hover:underline flex items-center gap-1" style={{ color: 'var(--accent)' }}>
            Manage Authorities <ChevronRight size={12} />
          </Link>
        </div>

        {authorities.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
            No payment authorities assigned to this agent yet.
          </p>
        ) : (
          <div className="space-y-3">
            {authorities.map(auth => (
              <div key={auth.id} className="p-3.5 rounded-lg border text-xs space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{auth.id.slice(0, 14)}...</span>
                    <span className="badge badge-neutral text-[10px] uppercase">{auth.provider || 'razorpay'} / {auth.rail || 'upi'}</span>
                  </div>
                  <span className={`badge ${getStatusBadge(auth.status)}`}>{auth.status}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                  <div>
                    <span className="text-[10px] font-sans block" style={{ color: 'var(--text-muted)' }}>Per Tx Limit</span>
                    <span>{formatRupees(auth.max_transaction_amount_paise)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-sans block" style={{ color: 'var(--text-muted)' }}>Daily Cap</span>
                    <span>{formatRupees(auth.daily_limit_paise)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-sans block" style={{ color: 'var(--text-muted)' }}>Daily Left</span>
                    <span style={{ color: 'var(--success)' }}>{formatRupees(auth.remaining_today_paise)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-sans block" style={{ color: 'var(--text-muted)' }}>Approval Over</span>
                    <span>{auth.requires_approval_above_paise ? formatRupees(auth.requires_approval_above_paise) : 'None'}</span>
                  </div>
                </div>

                {auth.purpose && (
                  <p className="text-[11px] italic" style={{ color: 'var(--text-secondary)' }}>
                    &ldquo;{auth.purpose}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Credentials */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-3">API Credentials</h2>
        {creds.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No credentials. Generate one above.</p>
        ) : (
          <div className="space-y-2">
            {creds.map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm p-3 rounded-lg"
                style={{ background: 'var(--bg-secondary)' }}>
                <div>
                  <code className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{c.key_prefix}...</code>
                  <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                    {c.last_used_at ? `Last used ${timeAgo(c.last_used_at)}` : 'Never used'}
                  </span>
                </div>
                <span className={`badge ${getStatusBadge(c.status)}`}>{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent intents */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold">Recent Payment Intents</h2>
        </div>
        <table className="data-table">
          <thead><tr><th>Merchant</th><th>Amount</th><th>Status</th><th>Decision</th><th>Time</th><th></th></tr></thead>
          <tbody>
            {intents.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-6" style={{ color: 'var(--text-muted)' }}>No payment intents yet</td></tr>
            ) : intents.map(pi => (
              <tr key={pi.id} className="hover:bg-zinc-800/20 transition">
                <td className="font-medium">
                  <Link href={`/dashboard/payments/${pi.id}`} className="hover:underline" style={{ color: 'var(--text-primary)' }}>
                    {pi.merchant}
                  </Link>
                </td>
                <td className="font-mono text-sm">{formatRupees(pi.amount_paise)}</td>
                <td><span className={`badge ${getStatusBadge(pi.status)}`}>{pi.status}</span></td>
                <td><span className={`badge ${getStatusBadge(pi.decision || '')}`}>{pi.decision || '—'}</span></td>
                <td style={{ color: 'var(--text-muted)' }}>{timeAgo(pi.created_at)}</td>
                <td className="text-right">
                  <Link href={`/dashboard/payments/${pi.id}`} className="text-xs hover:underline inline-flex items-center gap-0.5" style={{ color: 'var(--accent)' }}>
                    View <ChevronRight size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
