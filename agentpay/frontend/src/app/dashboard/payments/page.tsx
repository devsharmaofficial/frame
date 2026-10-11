'use client';

import { useEffect, useState } from 'react';
import { intentsApi, PaymentIntent } from '@/lib/api';
import { formatRupees, timeAgo } from '@/lib/utils';
import Link from 'next/link';
import { ChevronRight, CreditCard, Filter, ArrowUpRight } from 'lucide-react';

export default function PaymentsPage() {
  const [intents, setIntents] = useState<PaymentIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const load = () => {
    setLoading(true);
    intentsApi.list({ status: statusFilter || undefined, per_page: 50 })
      .then(r => setIntents(r.data || [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const statuses = [
    { label: 'All Intents', value: '' },
    { label: 'Completed', value: 'completed' },
    { label: 'Requires Approval', value: 'requires_approval' },
    { label: 'Processing', value: 'processing' },
    { label: 'Denied', value: 'denied' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-white">Payment Intents</h1>
          <p className="text-sm font-normal text-slate-400 mt-1">
            Real-time telemetry of agent-initiated transactions, firewall determinations, and settled orders.
          </p>
        </div>
      </div>

      {/* Pill Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {statuses.map(s => {
          const isActive = statusFilter === s.value;
          return (
            <button
              key={s.value || 'all'}
              onClick={() => setStatusFilter(s.value)}
              className={`h-9 px-4 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#0052ff] text-white shadow-sm'
                  : 'bg-[#16181c] border border-[#252a3d] text-slate-400 hover:text-white hover:bg-[#20232b]'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-[#252a3d] bg-[#141724] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#252a3d] flex items-center justify-between bg-[#10131d]/60">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-slate-400" />
            <span className="font-normal text-sm text-white">Execution Telemetry ({intents.length})</span>
          </div>
          <button onClick={load} className="text-xs text-slate-400 hover:text-white transition">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Loading payment intents...</div>
        ) : intents.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <CreditCard size={36} className="mx-auto text-slate-600" />
            <p className="text-sm font-medium text-white">No payment intents found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Transactions will stream here in real time as AI agents initiate checkout mandates.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#10131d] text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-[#252a3d]">
                <tr>
                  <th className="px-6 py-3.5">Intent ID</th>
                  <th className="px-6 py-3.5">Agent</th>
                  <th className="px-6 py-3.5">Merchant</th>
                  <th className="px-6 py-3.5">Amount</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Time</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252a3d]">
                {intents.map(pi => (
                  <tr key={pi.id} className="hover:bg-[#171b29]/60 transition">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">
                      {pi.id.slice(-10)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{pi.agent_name || pi.agent_id}</div>
                      <div className="text-xs text-slate-400 truncate max-w-xs">{pi.purpose}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-200">
                      {pi.merchant || '—'}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-medium text-white">
                      {formatRupees(pi.amount_paise)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase ${
                        pi.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : pi.status === 'requires_approval'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : pi.status === 'denied' || pi.status === 'failed'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}>
                        {pi.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {timeAgo(pi.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/payments/${pi.id}`}
                        className="inline-flex items-center gap-1 p-2 rounded-full border border-[#252a3d] bg-[#16181c] hover:bg-[#20232b] text-slate-300 hover:text-white transition"
                        title="View Detailed Receipt"
                      >
                        <ChevronRight size={13} />
                      </Link>
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
