'use client';

import { useEffect, useState } from 'react';
import { policiesApi, agentsApi, Policy, Agent } from '@/lib/api';
import { formatRupees, timeAgo } from '@/lib/utils';
import { Plus, Shield, ShieldCheck, CheckCircle2, ChevronRight, Sliders, AlertCircle } from 'lucide-react';

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    agent_id: '', name: '',
    transaction_limit_paise: '', daily_limit_paise: '',
    monthly_limit_paise: '', approval_threshold_paise: '',
    merchant_allowlist: '', merchant_blocklist: '',
  });

  const load = async () => {
    try {
      const [pRes, aRes] = await Promise.all([
        policiesApi.list().catch(() => ({ data: [] as Policy[] })),
        agentsApi.list().catch(() => ({ data: [] as Agent[] })),
      ]);
      setPolicies(pRes.data || []);
      setAgents(aRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const body: Record<string, unknown> = { agent_id: form.agent_id, name: form.name };
      if (form.transaction_limit_paise) body.transaction_limit_paise = parseInt(form.transaction_limit_paise) * 100;
      if (form.daily_limit_paise) body.daily_limit_paise = parseInt(form.daily_limit_paise) * 100;
      if (form.monthly_limit_paise) body.monthly_limit_paise = parseInt(form.monthly_limit_paise) * 100;
      if (form.approval_threshold_paise) body.approval_threshold_paise = parseInt(form.approval_threshold_paise) * 100;
      if (form.merchant_allowlist) body.merchant_allowlist = form.merchant_allowlist.split(',').map(s => s.trim()).filter(Boolean);
      if (form.merchant_blocklist) body.merchant_blocklist = form.merchant_blocklist.split(',').map(s => s.trim()).filter(Boolean);
      await policiesApi.create(body as Parameters<typeof policiesApi.create>[0]);
      setShowCreate(false);
      setForm({
        agent_id: '', name: '',
        transaction_limit_paise: '', daily_limit_paise: '',
        monthly_limit_paise: '', approval_threshold_paise: '',
        merchant_allowlist: '', merchant_blocklist: '',
      });
      load();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create policy');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-white">Payment Policies & Firewall Rules</h1>
          <p className="text-sm font-normal text-slate-400 mt-1">
            Programmatic velocity caps, category allowlists, and human-in-the-loop approval thresholds.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="h-11 px-6 rounded-full bg-[#0052ff] hover:bg-[#003ecc] active:bg-[#003ecc] text-white text-sm font-medium transition shadow-sm flex items-center gap-2 self-start md:self-auto"
        >
          <Plus size={16} />
          <span>New Policy</span>
        </button>
      </div>

      {/* Info Notice */}
      <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-5 flex items-start gap-3.5">
        <ShieldCheck size={20} className="text-[#0052ff] mt-0.5 flex-shrink-0" />
        <div className="text-xs space-y-1">
          <p className="font-medium text-white">Deterministic Execution Firewall</p>
          <p className="text-slate-400 leading-relaxed">
            Policy rules evaluate in sub-millisecond real-time before payment rail dispatch. Transactions exceeding thresholds trigger asynchronous human approval tasks rather than outright failure.
          </p>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-[#252a3d] bg-[#141724] p-7 shadow-2xl space-y-5 animate-in my-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#0052ff]/10 border border-[#0052ff]/20 flex items-center justify-center text-[#0052ff]">
                <Sliders size={20} />
              </div>
              <div>
                <h2 className="text-lg font-normal tracking-tight text-white">Define Policy Rule</h2>
                <p className="text-xs text-slate-400">Specify budgetary guardrails and merchant restrictions</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">Target Agent *</label>
                <select
                  value={form.agent_id}
                  onChange={e => setForm(f => ({ ...f, agent_id: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-[#252a3d] bg-[#10131d] px-3.5 py-2.5 text-sm text-[#f4f5f8] focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff] transition"
                >
                  <option value="">Select an AI agent</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">Policy Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Cloud Infrastructure Velocity Cap"
                  required
                  className="w-full rounded-xl border border-[#252a3d] bg-[#10131d] px-3.5 py-2.5 text-sm text-[#f4f5f8] placeholder-slate-500 focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff] transition"
                />
              </div>

              <div className="border-t border-[#252a3d] pt-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-3">Velocity & Spending Bounds (in ₹)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-xs text-slate-300">Max Per Transaction (₹)</label>
                    <input
                      type="number"
                      value={form.transaction_limit_paise}
                      onChange={e => setForm(f => ({ ...f, transaction_limit_paise: e.target.value }))}
                      placeholder="e.g. 5000"
                      className="w-full rounded-xl border border-[#252a3d] bg-[#10131d] px-3.5 py-2 text-sm text-[#f4f5f8] placeholder-slate-500 focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-slate-300">Requires Approval Above (₹)</label>
                    <input
                      type="number"
                      value={form.approval_threshold_paise}
                      onChange={e => setForm(f => ({ ...f, approval_threshold_paise: e.target.value }))}
                      placeholder="e.g. 2500"
                      className="w-full rounded-xl border border-[#252a3d] bg-[#10131d] px-3.5 py-2 text-sm text-[#f4f5f8] placeholder-slate-500 focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-slate-300">Daily Limit (₹)</label>
                    <input
                      type="number"
                      value={form.daily_limit_paise}
                      onChange={e => setForm(f => ({ ...f, daily_limit_paise: e.target.value }))}
                      placeholder="e.g. 20000"
                      className="w-full rounded-xl border border-[#252a3d] bg-[#10131d] px-3.5 py-2 text-sm text-[#f4f5f8] placeholder-slate-500 focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-slate-300">Monthly Limit (₹)</label>
                    <input
                      type="number"
                      value={form.monthly_limit_paise}
                      onChange={e => setForm(f => ({ ...f, monthly_limit_paise: e.target.value }))}
                      placeholder="e.g. 100000"
                      className="w-full rounded-xl border border-[#252a3d] bg-[#10131d] px-3.5 py-2 text-sm text-[#f4f5f8] placeholder-slate-500 focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff]"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-[#252a3d] pt-4 space-y-3">
                <div className="space-y-1">
                  <label className="block text-xs text-slate-300">Merchant Allowlist (Comma separated)</label>
                  <input
                    type="text"
                    value={form.merchant_allowlist}
                    onChange={e => setForm(f => ({ ...f, merchant_allowlist: e.target.value }))}
                    placeholder="AWS, GitHub, OpenAI, Vercel"
                    className="w-full rounded-xl border border-[#252a3d] bg-[#10131d] px-3.5 py-2 text-sm text-[#f4f5f8] placeholder-slate-500 focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs text-slate-300">Merchant Blocklist (Comma separated)</label>
                  <input
                    type="text"
                    value={form.merchant_blocklist}
                    onChange={e => setForm(f => ({ ...f, merchant_blocklist: e.target.value }))}
                    placeholder="Gambling, Crypto Exchanges, Unverified P2P"
                    className="w-full rounded-xl border border-[#252a3d] bg-[#10131d] px-3.5 py-2 text-sm text-[#f4f5f8] placeholder-slate-500 focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff]"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-400">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="h-10 px-5 rounded-full border border-[#252a3d] bg-[#16181c] hover:bg-[#20232b] text-sm font-medium text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="h-10 px-6 rounded-full bg-[#0052ff] hover:bg-[#003ecc] text-white text-sm font-medium transition disabled:opacity-50"
                >
                  {creating ? 'Saving Policy...' : 'Save Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Policies Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-60 rounded-2xl bg-[#141724] border border-[#252a3d] animate-pulse" />
          <div className="h-60 rounded-2xl bg-[#141724] border border-[#252a3d] animate-pulse" />
        </div>
      ) : policies.length === 0 ? (
        <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-12 text-center space-y-3">
          <Shield size={36} className="mx-auto text-slate-600" />
          <p className="text-sm font-medium text-white">No policies configured yet</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Establish spending bounds to protect autonomous transactions against prompt injection or runaway execution.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#0052ff] hover:bg-[#003ecc] text-xs font-medium text-white transition mt-2"
          >
            <Plus size={14} />
            <span>Create First Policy</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {policies.map(policy => {
            const agent = agents.find(a => a.id === policy.agent_id);
            return (
              <div key={policy.id} className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-5 hover:border-[#0052ff]/40 transition shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-normal text-white">{policy.name}</h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {policy.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <span>Agent: <strong className="text-white font-normal">{agent?.name || policy.agent_id}</strong></span>
                      <span>•</span>
                      <span>v{policy.version_number || 1}</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-500">{policy.id.slice(-8)}</span>
                </div>

                {/* Bounds Grid */}
                <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[#10131d] border border-[#252a3d] text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Max Transaction</span>
                    <strong className="text-white font-mono font-medium text-sm">
                      {policy.transaction_limit_paise ? formatRupees(policy.transaction_limit_paise) : 'No Limit'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Approval Threshold</span>
                    <strong className="text-white font-mono font-medium text-sm">
                      {policy.approval_threshold_paise ? formatRupees(policy.approval_threshold_paise) : 'None'}
                    </strong>
                  </div>
                  <div className="pt-2 border-t border-[#252a3d]/60">
                    <span className="text-slate-400 block mb-0.5">Daily Velocity Cap</span>
                    <strong className="text-white font-mono font-medium text-sm">
                      {policy.daily_limit_paise ? formatRupees(policy.daily_limit_paise) : 'No Limit'}
                    </strong>
                  </div>
                  <div className="pt-2 border-t border-[#252a3d]/60">
                    <span className="text-slate-400 block mb-0.5">Monthly Cap</span>
                    <strong className="text-white font-mono font-medium text-sm">
                      {policy.monthly_limit_paise ? formatRupees(policy.monthly_limit_paise) : 'No Limit'}
                    </strong>
                  </div>
                </div>

                {/* Allowlists */}
                {policy.merchant_allowlist && policy.merchant_allowlist.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Merchant Allowlist</span>
                    <div className="flex flex-wrap gap-1.5">
                      {policy.merchant_allowlist.map(m => (
                        <span key={m} className="px-2.5 py-0.5 rounded-full text-xs bg-[#1e2233] text-slate-300 border border-[#252a3d]">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
