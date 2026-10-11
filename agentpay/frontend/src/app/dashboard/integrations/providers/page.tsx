'use client';

import { useEffect, useState } from 'react';
import { providersApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  Plug, CheckCircle2, ShieldCheck, AlertCircle, RefreshCw, Cpu, Globe, ArrowUpRight
} from 'lucide-react';

export default function ProvidersPage() {
  const [data, setData] = useState<{
    available_providers: Array<{ providerType: string; name: string; supportedRails: string[] }>;
    configured_providers: Array<{ id: string; provider_type: string; name: string; is_default: boolean; status: string; created_at: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProviders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await providersApi.list();
      setData(res.data as unknown as typeof data);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load provider configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-white">Payment Rail Adapters</h1>
          <p className="text-sm font-normal text-slate-400 mt-1">
            Settlement connectivity across Razorpay Sandbox, UPI rails, Card networks, and Deterministic Mocks.
          </p>
        </div>
        <button
          onClick={loadProviders}
          className="h-10 px-5 rounded-full border border-[#252a3d] bg-[#16181c] hover:bg-[#20232b] text-slate-300 hover:text-white text-xs font-medium transition self-start md:self-auto"
        >
          <RefreshCw size={14} className="inline mr-1.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Ground Truth Policy Notice */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex items-start gap-3.5">
        <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-medium text-white">Strict Rail Classification Protocol</p>
          <p className="text-slate-400 leading-relaxed">
            Frame strictly segregates runtime execution environments: <strong>MOCK</strong> (local zero-latency deterministic harness for automated tests), <strong>SANDBOX</strong> (genuine external Razorpay test keys with signed webhook processing), and <strong>PRODUCTION</strong>. Test credentials are never mixed with production settlement lines.
          </p>
        </div>
      </div>

      {/* Configured Providers */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-400">Active Rail Connections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0052ff]/10 border border-[#0052ff]/20 flex items-center justify-center text-[#0052ff]">
                  <Cpu size={20} />
                </div>
                <div>
                  <h3 className="font-normal text-base text-white">Deterministic Mock Adapter</h3>
                  <p className="text-xs text-slate-400">In-Memory Sandbox Engine</p>
                </div>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Provides millisecond response times, deterministic failure injection, and automated intent binding validation for developer test suites.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#252a3d]">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#10131d] border border-[#252a3d] text-slate-300">mock_rail</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#10131d] border border-[#252a3d] text-slate-300">instant_settlement</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0052ff]/10 border border-[#0052ff]/20 flex items-center justify-center text-[#0052ff]">
                  <Globe size={20} />
                </div>
                <div>
                  <h3 className="font-normal text-base text-white">Razorpay Sandbox Adapter</h3>
                  <p className="text-xs text-slate-400">API Test Network</p>
                </div>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                CONFIGURED
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Direct integration against Razorpay Order & Payment APIs with HMAC-SHA256 signature verification and asynchronous webhook deduplication.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#252a3d]">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#10131d] border border-[#252a3d] text-slate-300">upi</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#10131d] border border-[#252a3d] text-slate-300">card</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#10131d] border border-[#252a3d] text-slate-300">netbanking</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
