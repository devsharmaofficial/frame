'use client';

import { useEffect, useState } from 'react';
import { txApi, Transaction } from '@/lib/api';
import { formatRupees, timeAgo } from '@/lib/utils';
import { Receipt, ExternalLink, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    txApi.list().then(r => setTxs(r.data || [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-white">Settled Transactions</h1>
          <p className="text-sm font-normal text-slate-400 mt-1">
            Immutable settlement ledger across Razorpay UPI, Cards, and NetBanking gateways.
          </p>
        </div>
        <button onClick={load} className="h-10 px-5 rounded-full border border-[#252a3d] bg-[#16181c] hover:bg-[#20232b] text-slate-300 hover:text-white text-xs font-medium transition self-start md:self-auto">
          Refresh Ledger
        </button>
      </div>

      {/* Ledger Table */}
      <div className="rounded-2xl border border-[#252a3d] bg-[#141724] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#252a3d] flex items-center justify-between bg-[#10131d]/60">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-slate-400" />
            <span className="font-normal text-sm text-white">Settlement Records ({txs.length})</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">Real-Time Ingestion</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Loading ledger records...</div>
        ) : txs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Receipt size={36} className="mx-auto text-slate-600" />
            <p className="text-sm font-medium text-white">No transactions settled yet</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Completed payment executions will automatically post to this immutable ledger.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#10131d] text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-[#252a3d]">
                <tr>
                  <th className="px-6 py-3.5">Provider Reference</th>
                  <th className="px-6 py-3.5">Agent</th>
                  <th className="px-6 py-3.5">Merchant</th>
                  <th className="px-6 py-3.5">Amount</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Provider</th>
                  <th className="px-6 py-3.5">Settled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252a3d]">
                {txs.map(tx => (
                  <tr key={tx.id} className="hover:bg-[#171b29]/60 transition">
                    <td className="px-6 py-4 font-mono text-xs text-white">
                      {tx.provider_payment_id || tx.id}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {tx.agent_name || 'Autonomous Agent'}
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      {tx.merchant || '—'}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-medium text-white">
                      {formatRupees(tx.amount_paise)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase ${
                        tx.status === 'succeeded' || tx.status === 'captured'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono uppercase bg-[#16181c] border border-[#252a3d] text-slate-300">
                        {tx.provider}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {timeAgo(tx.created_at)}
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
