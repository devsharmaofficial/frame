'use client';

import { useAuth } from '@/lib/auth-context';
import { ShieldCheck, Terminal, ArrowUpRight, Cpu, PlugZap, Lock } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const { user, organization } = useAuth();

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings & Environment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage organization identity, operator access roles, payment adapters, and MCP configurations.
        </p>
      </div>

      {/* Organization Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Organization Profile</h2>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium font-mono">
            {organization?.frame_env || 'sandbox'}
          </span>
        </div>

        <div className="divide-y divide-border/60">
          {[
            ['Organization Name', organization?.name || 'Frame Labs'],
            ['Organization Slug', organization?.slug || 'frame-labs-live'],
            ['Environment Mode', organization?.frame_env || 'sandbox'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between items-center py-3 text-sm">
              <span className="text-muted-foreground font-normal">{label}</span>
              <span className="font-medium text-foreground font-mono text-xs">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Operator Account Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-emerald-500" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Operator Identity</h2>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
            {user?.role || 'owner'}
          </span>
        </div>

        <div className="divide-y divide-border/60">
          {[
            ['Full Name', user?.name || 'Demo Admin'],
            ['Email Address', user?.email || 'demo@frame.dev'],
            ['Assigned Role', user?.role || 'owner'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between items-center py-3 text-sm">
              <span className="text-muted-foreground font-normal">{label}</span>
              <span className="font-medium text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Providers & Rails */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <PlugZap size={18} className="text-indigo-400" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Payment Providers & Rails</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Frame sits as an abstraction firewall above payment rails. Provider secrets are scrubbed and never exposed to agents or logged.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-border bg-secondary/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-foreground">Deterministic Mock Provider</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Active Default
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Deterministic test harness for instant unit tests, failure simulation, timeouts, and state machines.
            </p>
            <div className="text-xs font-mono text-muted-foreground pt-1 border-t border-border/40">
              Supported Rails: <span className="text-foreground">upi, card, mock</span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-secondary/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-foreground">Razorpay Sandbox Adapter</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Configurable
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Production-grade Razorpay REST contract (Orders, Payments, Webhook HMAC-SHA256 verification).
            </p>
            <div className="text-xs font-mono text-muted-foreground pt-1 border-t border-border/40">
              Supported Rails: <span className="text-foreground">upi, card, netbanking</span>
            </div>
          </div>
        </div>

        <div className="text-xs p-3.5 rounded-lg border border-border bg-secondary/30 flex items-center justify-between font-mono">
          <span className="text-muted-foreground">Inbound Webhook Endpoint:</span>
          <span className="text-blue-400 font-semibold select-all">POST /v1/webhooks/razorpay</span>
        </div>
      </div>

      {/* Model Context Protocol (MCP) Server */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Cpu size={18} className="text-amber-400" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Model Context Protocol (MCP) Server</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Autonomous AI agents connect to Frame using standard MCP tools (<code className="text-foreground">frame_get_payment_authority</code>, <code className="text-foreground">frame_create_payment_intent</code>, etc.).
            </p>
          </div>
          <Link
            href="/dashboard/developers/mcp"
            className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition"
          >
            <span>Open MCP Guide</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="rounded-xl p-4 text-xs font-mono border border-border bg-secondary/60 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <span className="text-muted-foreground">claude_desktop_config.json / Cursor MCP configuration:</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              Ready
            </span>
          </div>
          <pre className="overflow-x-auto text-[11px] leading-relaxed text-foreground/90 pt-1">
{`{
  "mcpServers": {
    "frame": {
      "command": "node",
      "args": ["dist/mcp/server.js"],
      "env": {
        "FRAME_API_KEY": "agk_live_...",
        "FRAME_BASE_URL": "https://frame-backend-868z.onrender.com"
      }
    }
  }
}`}
          </pre>
        </div>
      </div>

      {/* Sandbox Isolation Banner */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Sandbox Isolation & Safety</h2>
        <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 flex-shrink-0 animate-pulse" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-blue-400 text-sm">Sandbox Environment Active (FRAME_ENV=sandbox)</p>
            <p className="text-muted-foreground leading-relaxed">
              Strict isolation enforced: live production credentials (<code className="text-foreground">rzp_live_*</code>) are automatically rejected at the adapter boundary in sandbox.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
