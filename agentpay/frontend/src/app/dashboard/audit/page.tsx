'use client';

import { useEffect, useState } from 'react';
import { auditApi, AuditEvent } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ScrollText, ShieldCheck } from 'lucide-react';

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    auditApi.list({ per_page: 100 } as Parameters<typeof auditApi.list>[0])
      .then(r => setEvents(r.data || [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-white">Cryptographic Audit Trail</h1>
          <p className="text-sm font-normal text-slate-400 mt-1">
            Immutable, append-only record of all policy decisions, key rotations, and financial events.
          </p>
        </div>
        <button onClick={load} className="h-10 px-5 rounded-full border border-[#252a3d] bg-[#16181c] hover:bg-[#20232b] text-slate-300 hover:text-white text-xs font-medium transition self-start md:self-auto">
          Refresh Log
        </button>
      </div>

      {/* Security Architecture Callout */}
      <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-5 flex items-start gap-3.5">
        <ShieldCheck size={20} className="text-[#0052ff] mt-0.5 flex-shrink-0" />
        <div className="text-xs space-y-1">
          <p className="font-medium text-white">Non-Repudiation Architecture</p>
          <p className="text-slate-400 leading-relaxed">
            Audit logs are hash-chained and signed at write time. Operator overrides, agent credential creations, and firewall denials cannot be truncated or altered retrospectively.
          </p>
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-[#252a3d] bg-[#141724] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#252a3d] flex items-center justify-between bg-[#10131d]/60">
          <div className="flex items-center gap-2">
            <ScrollText size={18} className="text-slate-400" />
            <span className="font-normal text-sm text-white">Append-Only Event Stream ({events.length})</span>
          </div>
          <span className="text-xs font-mono text-slate-500">Hash-Chained</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Loading audit events...</div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ScrollText size={36} className="mx-auto text-slate-600" />
            <p className="text-sm font-medium text-white">No audit events recorded yet</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              System events, approvals, and credential generation will stream here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#10131d] text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-[#252a3d]">
                <tr>
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">Action</th>
                  <th className="px-6 py-3.5">Actor Type</th>
                  <th className="px-6 py-3.5">Resource ID</th>
                  <th className="px-6 py-3.5">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252a3d]">
                {events.map(evt => (
                  <tr key={evt.id} className="hover:bg-[#171b29]/60 transition">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                      {formatDate(evt.occurred_at || (evt as unknown as { created_at?: string }).created_at || '')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-[#1e2233] text-white border border-[#252a3d]">
                        {evt.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs capitalize text-slate-300">
                      {evt.actor_type || 'system'}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">
                      {evt.resource_id || evt.id.slice(-8)}
                    </td>
                    <td className="px-6 py-4">
                      {evt.decision ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase ${
                          evt.decision === 'ALLOW'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : evt.decision === 'DENY'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {evt.decision}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
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
