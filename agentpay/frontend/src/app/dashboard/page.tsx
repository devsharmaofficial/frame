'use client';

import { useEffect, useState } from 'react';
import { overviewApi, intentsApi, Overview, PaymentIntent } from '@/lib/api';
import { formatRupees, timeAgo } from '@/lib/utils';
import { TrendingUp, Bot, Clock, ShieldX, CheckCircle, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export default function OverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [recent, setRecent] = useState<PaymentIntent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([overviewApi.get(), intentsApi.list({ per_page: 8 })])
      .then(([ov, intents]) => {
        setOverview(ov.data);
        setRecent(intents.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  const stats = [
    {
      label: 'Active Agents',
      value: overview?.active_agents ?? 0,
      icon: Bot,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      label: 'Total Spend',
      value: formatRupees(overview?.total_spend_paise ?? 0),
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: "Today's Spend",
      value: formatRupees(overview?.today_spend_paise ?? 0),
      icon: TrendingUp,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      label: 'Pending Approvals',
      value: overview?.pending_approvals ?? 0,
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      link: '/dashboard/approvals',
    },
    {
      label: 'Blocked Payments',
      value: overview?.blocked_payments ?? 0,
      icon: ShieldX,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
    },
    {
      label: 'Success Rate',
      value: `${overview?.payment_success_rate ?? 0}%`,
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Command & Control Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time policy firewall telemetry, delegated spending authority usage, and agent activities.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/agent-demo"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition"
          >
            <span>Run Agent Demo</span>
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:border-border/80 hover:bg-card/90 ${
              stat.link ? 'cursor-pointer' : ''
            }`}
            onClick={() => stat.link && (window.location.href = stat.link)}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${stat.bg}`}>
                <stat.icon size={16} className={stat.color} />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-foreground mt-3 tracking-tight">{stat.value}</div>
            {stat.label === 'Pending Approvals' && (overview?.pending_approvals ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Action required by human operator →</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Status Breakdown */}
      {overview && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">Payment Intent Status Breakdown</h2>
          <div className="flex flex-wrap gap-2.5">
            {Object.entries(overview.payment_intents_by_status).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center gap-2.5 rounded-lg px-3.5 py-2 text-xs border border-border bg-secondary/50 font-medium"
              >
                <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] tracking-wider ${getStatusBadge(status)}`}>
                  {status}
                </span>
                <span className="font-mono text-foreground font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Payment Intents Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Recent Payment Intents</h2>
          <Link href="/dashboard/payments" className="text-xs font-medium text-blue-400 hover:text-blue-300 transition flex items-center gap-1">
            <span>View all intents</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-xs font-semibold text-muted-foreground border-b border-border">
              <tr>
                <th className="px-6 py-3.5">Agent</th>
                <th className="px-6 py-3.5">Merchant</th>
                <th className="px-6 py-3.5">Amount</th>
                <th className="px-6 py-3.5">Firewall Status</th>
                <th className="px-6 py-3.5 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
                    No payment intents evaluated yet. Run the Agent Demo to evaluate real intents against the policy firewall.
                  </td>
                </tr>
              ) : (
                recent.map((pi) => (
                  <tr key={pi.id} className="hover:bg-secondary/20 transition">
                    <td className="px-6 py-4">
                      <span className="font-medium text-foreground text-xs font-mono">
                        {pi.agent_name || pi.agent_id?.slice(0, 12)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground text-sm">{pi.merchant}</td>
                    <td className="px-6 py-4 font-mono font-bold text-foreground text-sm">{formatRupees(pi.amount_paise)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${getStatusBadge(pi.status)}`}>
                        {pi.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-muted-foreground font-mono">{timeAgo(pi.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function getStatusBadge(status: string): string {
  const map: Record<string, string> = {
    SUCCEEDED: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    AUTHORIZED: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    DENIED: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    REJECTED: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    FAILED: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    PENDING_APPROVAL: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    EXECUTING: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    CREATED: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
    EVALUATING: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    EXPIRED: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
  };
  return map[status] || 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
}

function PageSkeleton() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-card" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card h-24" />
        ))}
      </div>
    </div>
  );
}
