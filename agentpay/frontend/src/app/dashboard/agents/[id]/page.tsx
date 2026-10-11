'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { agentsApi, policiesApi, intentsApi, authoritiesApi, Agent, Policy, PaymentIntent, Credential, PaymentAuthority } from '@/lib/api';
import { formatRupees, formatDate, timeAgo } from '@/lib/utils';
import { Key, Power, PowerOff, Plus, Copy, Check, ShieldCheck, ChevronRight, ArrowLeft, ArrowUpRight, Terminal, RefreshCw, AlertTriangle } from 'lucide-react';

export default function AgentDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [authorities, setAuthorities] = useState<PaymentAuthority[]>([]);
  const [intents, setIntents] = useState<PaymentIntent[]>([]);
  const [creds, setCreds] = useState<Credential[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    try {
      const [agentRes, credsRes, intentsRes, policiesRes, authRes] = await Promise.all([
        agentsApi.get(id).catch(() => ({ data: null })),
        agentsApi.listCredentials(id).catch(() => ({ data: [] as Credential[] })),
        intentsApi.list({ agent_id: id, per_page: 10 }).catch(() => ({ data: [] as PaymentIntent[], meta: { total: 0, page: 1, per_page: 10, total_pages: 1 } })),
        policiesApi.list(id).catch(() => ({ data: [] as Policy[] })),
        authoritiesApi.list({ agent_id: id }).catch(() => ({ data: [] as PaymentAuthority[] })),
      ]);
      setAgent(agentRes.data);
      setCreds(credsRes.data || []);
      setIntents(intentsRes.data || []);
      setPolicy(policiesRes.data[0] || null);
      setAuthorities(authRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

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
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggle = async () => {
    if (!agent) return;
    setActionError(null);
    try {
      if (agent.status === 'active') await agentsApi.disable(id, 'Manually disabled via operator console');
      else if (agent.status === 'disabled') await agentsApi.enable(id);
      await load();
    } catch (err: unknown) {
      setActionError((err as Error).message || 'Failed to update agent status');
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-[#141724] rounded-lg animate-pulse" />
        <div className="h-64 rounded-2xl bg-[#141724] border border-[#252a3d] animate-pulse" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-12 text-center max-w-md mx-auto space-y-4">
        <p className="text-sm text-slate-400">Agent not found or has been revoked.</p>
        <Link href="/dashboard/agents" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0052ff] text-white text-xs font-medium">
          <ArrowLeft size={14} /> Back to Agents
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in">
      {/* Back button */}
      <Link href="/dashboard/agents" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition">
        <ArrowLeft size={14} />
        <span>All Agents</span>
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-normal tracking-tight text-white">{agent.name}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              agent.status === 'active'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {agent.status.toUpperCase()}
            </span>
          </div>
          <p className="text-sm font-normal text-slate-400 mt-1">{agent.purpose || 'Autonomous procurement & tool execution'}</p>
          <p className="text-xs font-mono text-slate-500 mt-0.5">Principal ID: {agent.id}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            disabled={agent.status === 'revoked'}
            className="h-10 px-5 rounded-full border border-[#252a3d] bg-[#16181c] hover:bg-[#20232b] text-slate-300 hover:text-white text-xs font-medium transition flex items-center gap-2"
          >
            {agent.status === 'active' ? <><PowerOff size={14} className="text-amber-400" /> Disable Agent</> : <><Power size={14} className="text-emerald-400" /> Enable Agent</>}
          </button>
          <button
            onClick={generateKey}
            className="h-10 px-6 rounded-full bg-[#0052ff] hover:bg-[#003ecc] text-white text-xs font-medium transition shadow-sm flex items-center gap-2"
          >
            <Key size={14} />
            <span>Issue New Key</span>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-medium flex items-center justify-between text-rose-400">
          <span>{actionError}</span>
          <button className="underline ml-4" onClick={() => setActionError(null)}>Dismiss</button>
        </div>
      )}

      {/* One-Time Key Reveal Card */}
      {newKey && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 shadow-xl space-y-4 animate-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Key size={20} />
            </div>
            <div>
              <h3 className="font-normal text-base text-white">Save Raw API Key</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                This secret key will be shown <strong>ONLY ONCE</strong>. Frame stores only a cryptographic salted hash.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={newKey}
              className="w-full font-mono text-xs px-4 py-3 rounded-xl border border-[#252a3d] bg-[#0a0b0e] text-emerald-400 select-all focus:outline-none"
            />
            <button
              onClick={copyKey}
              className="h-11 px-5 rounded-full bg-[#16181c] border border-[#252a3d] hover:bg-[#20232b] text-xs font-medium text-white transition flex items-center gap-1.5 flex-shrink-0"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Settled Spend</span>
          <div className="text-2xl font-mono font-medium text-white">{formatRupees(agent.total_spend_paise || 0)}</div>
          <p className="text-xs text-slate-500">{agent.total_payments || 0} executed payment intents</p>
        </div>

        <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Issued Credentials</span>
          <div className="text-2xl font-mono font-medium text-white">{creds.length}</div>
          <p className="text-xs text-slate-500">{creds.filter(c => c.status === 'active').length} active, {creds.filter(c => c.status === 'revoked').length} revoked</p>
        </div>

        <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Delegated Authorities</span>
          <div className="text-2xl font-mono font-medium text-white">{authorities.length}</div>
          <p className="text-xs text-slate-500">{authorities.filter(a => a.status === 'ACTIVE').length} active spending mandates</p>
        </div>
      </div>

      {/* Credentials Table */}
      <div className="rounded-2xl border border-[#252a3d] bg-[#141724] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#252a3d] flex items-center justify-between bg-[#10131d]/60">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-slate-400" />
            <h2 className="text-sm font-normal text-white">Cryptographic Credentials</h2>
          </div>
          <span className="text-xs text-slate-500">Bcrypt Salted</span>
        </div>

        {creds.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No credentials generated yet.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-[#10131d] text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-[#252a3d]">
              <tr>
                <th className="px-6 py-3">Key Prefix</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#252a3d]">
              {creds.map(c => (
                <tr key={c.id} className="hover:bg-[#171b29]/60 transition">
                  <td className="px-6 py-4 font-mono text-xs text-white">
                    {c.key_prefix}••••••••
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {c.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">{formatDate(c.created_at)}</td>
                  <td className="px-6 py-4 text-xs text-slate-400">{c.last_used_at ? timeAgo(c.last_used_at) : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Intents for Agent */}
      <div className="rounded-2xl border border-[#252a3d] bg-[#141724] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#252a3d] flex items-center justify-between bg-[#10131d]/60">
          <span className="text-sm font-normal text-white">Recent Payment Intents</span>
          <Link href="/dashboard/payments" className="text-xs text-[#0052ff] hover:underline flex items-center gap-1">
            <span>View All</span>
            <ChevronRight size={12} />
          </Link>
        </div>

        {intents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No payment intents recorded for this agent yet.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-[#10131d] text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-[#252a3d]">
              <tr>
                <th className="px-6 py-3">Merchant</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#252a3d]">
              {intents.map(pi => (
                <tr key={pi.id} className="hover:bg-[#171b29]/60 transition">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{pi.merchant}</div>
                    <div className="text-xs text-slate-400 truncate max-w-xs">{pi.purpose}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-white">
                    {formatRupees(pi.amount_paise)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium uppercase bg-[#1e2233] text-slate-300 border border-[#252a3d]">
                      {pi.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">{timeAgo(pi.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
