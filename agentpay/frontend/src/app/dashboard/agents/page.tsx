'use client';

import { useEffect, useState } from 'react';
import { agentsApi, Agent } from '@/lib/api';
import { formatRupees, timeAgo } from '@/lib/utils';
import { Plus, Bot, PowerOff, Power, ChevronRight, ShieldCheck, Key, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', owner_team: '', purpose: '' });
  const [error, setError] = useState('');

  const load = () => agentsApi.list().then(r => setAgents(r.data || [])).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await agentsApi.create(form);
      setShowCreate(false);
      setForm({ name: '', description: '', owner_team: '', purpose: '' });
      load();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create agent');
    } finally {
      setCreating(false);
    }
  };

  const toggleAgent = async (agent: Agent) => {
    if (agent.status === 'active') {
      await agentsApi.disable(agent.id, 'Manually disabled via operator console');
    } else if (agent.status === 'disabled') {
      await agentsApi.enable(agent.id);
    }
    load();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-white">AI Agents</h1>
          <p className="text-sm font-normal text-slate-400 mt-1">
            Manage autonomous software agent identities, delegations, and issued payment keys.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="h-11 px-6 rounded-full bg-[#0052ff] hover:bg-[#003ecc] active:bg-[#003ecc] text-white text-sm font-medium transition shadow-sm flex items-center gap-2 self-start md:self-auto"
        >
          <Plus size={16} />
          <span>Provision Agent</span>
        </button>
      </div>

      {/* Security Architecture Callout */}
      <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-5 flex items-start gap-3.5">
        <ShieldCheck size={20} className="text-[#0052ff] mt-0.5 flex-shrink-0" />
        <div className="text-xs space-y-1">
          <p className="font-medium text-white">Delegated Authority Boundary</p>
          <p className="text-slate-400 leading-relaxed">
            Every provisioned AI agent operates under an immutable zero-trust principal ID. Agents hold no direct bank credentials; payments are validated in real-time through the Frame Firewall before being submitted to settlement rails.
          </p>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl border border-[#252a3d] bg-[#141724] p-7 shadow-2xl space-y-5 animate-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#0052ff]/10 border border-[#0052ff]/20 flex items-center justify-center text-[#0052ff]">
                <Bot size={20} />
              </div>
              <div>
                <h2 className="text-lg font-normal tracking-tight text-white">Provision New AI Agent</h2>
                <p className="text-xs text-slate-400">Establish a zero-trust cryptographic identity</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">Agent Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Claude Procurement Agent"
                  required
                  className="w-full rounded-xl border border-[#252a3d] bg-[#10131d] px-3.5 py-2.5 text-sm text-[#f4f5f8] placeholder-slate-500 focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff] transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">Primary Purpose / Mission</label>
                <input
                  type="text"
                  value={form.purpose}
                  onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                  placeholder="e.g. Autonomous cloud infrastructure & developer seat licenses"
                  className="w-full rounded-xl border border-[#252a3d] bg-[#10131d] px-3.5 py-2.5 text-sm text-[#f4f5f8] placeholder-slate-500 focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff] transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">Owner Team</label>
                <input
                  type="text"
                  value={form.owner_team}
                  onChange={e => setForm(f => ({ ...f, owner_team: e.target.value }))}
                  placeholder="e.g. Platform Engineering"
                  className="w-full rounded-xl border border-[#252a3d] bg-[#10131d] px-3.5 py-2.5 text-sm text-[#f4f5f8] placeholder-slate-500 focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff] transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Contextual guardrails or delegation mandates..."
                  className="w-full rounded-xl border border-[#252a3d] bg-[#10131d] px-3.5 py-2.5 text-sm text-[#f4f5f8] placeholder-slate-500 focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff] transition resize-none"
                />
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
                  {creating ? 'Provisioning...' : 'Provision Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agents Table */}
      <div className="rounded-2xl border border-[#252a3d] bg-[#141724] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#252a3d] flex items-center justify-between bg-[#10131d]/60">
          <div className="flex items-center gap-2.5">
            <Bot size={18} className="text-slate-400" />
            <span className="font-normal text-sm text-white">Registered Agents ({agents.length})</span>
          </div>
          <button
            onClick={load}
            className="text-xs text-slate-400 hover:text-white transition"
          >
            Refresh List
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Loading registered agents...</div>
        ) : agents.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Bot size={36} className="mx-auto text-slate-600" />
            <p className="text-sm font-medium text-white">No agents provisioned yet</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Create your first agent identity to grant delegated spend authorities and generate an MCP API key.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0052ff] hover:bg-[#003ecc] text-xs font-medium text-white transition mt-2"
            >
              <Plus size={14} />
              <span>Create Agent</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#10131d] text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-[#252a3d]">
                <tr>
                  <th className="px-6 py-3.5">Agent Identity</th>
                  <th className="px-6 py-3.5">Agent ID</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Total Spend</th>
                  <th className="px-6 py-3.5">Credentials</th>
                  <th className="px-6 py-3.5">Last Active</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252a3d]">
                {agents.map(agent => (
                  <tr key={agent.id} className="hover:bg-[#171b29]/60 transition">
                    <td className="px-6 py-4">
                      <Link href={`/dashboard/agents/${agent.id}`} className="font-medium text-white hover:text-[#0052ff] transition flex items-center gap-1.5">
                        <span>{agent.name}</span>
                        <ArrowUpRight size={13} className="opacity-40" />
                      </Link>
                      {agent.purpose && (
                        <div className="text-xs text-slate-400 truncate max-w-xs mt-0.5">{agent.purpose}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">
                      {agent.id}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        agent.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : agent.status === 'disabled'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {agent.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-white">
                      {formatRupees(agent.total_spend_paise || 0)}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">
                      {Number(agent.credential_count || 0) > 0 ? (
                        <span className="text-emerald-400">{agent.credential_count} issued</span>
                      ) : (
                        <span className="text-amber-400">0 issued</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {agent.last_used_at ? timeAgo(agent.last_used_at) : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleAgent(agent)}
                          title={agent.status === 'active' ? 'Disable Agent' : 'Enable Agent'}
                          disabled={agent.status === 'revoked'}
                          className="p-2 rounded-full border border-[#252a3d] bg-[#16181c] hover:bg-[#20232b] text-slate-300 hover:text-white transition disabled:opacity-40"
                        >
                          {agent.status === 'active' ? <PowerOff size={13} className="text-amber-400" /> : <Power size={13} className="text-emerald-400" />}
                        </button>
                        <Link
                          href={`/dashboard/agents/${agent.id}`}
                          className="p-2 rounded-full border border-[#252a3d] bg-[#16181c] hover:bg-[#20232b] text-slate-300 hover:text-white transition"
                        >
                          <ChevronRight size={13} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
