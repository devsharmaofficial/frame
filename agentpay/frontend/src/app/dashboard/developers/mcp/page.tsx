'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Terminal, Copy, Check, ArrowLeft, ShieldCheck, AlertCircle, Bot, Layers, Sparkles
} from 'lucide-react';

export default function McpConnectionGuidePage() {
  const [activeTab, setActiveTab] = useState<'claude' | 'cursor' | 'generic'>('claude');
  const [activeEnv, setActiveEnv] = useState<'test' | 'production'>('test');
  const [copied, setCopied] = useState<string | null>(null);

  const copyCode = (key: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        frame: {
          command: "npx",
          args: [
            "-y",
            "ts-node",
            "-r",
            "tsconfig-paths/register",
            "/Users/dev/Desktop/Frame/agentpay/backend/src/mcp/index.ts"
          ],
          env: {
            FRAME_API_URL: activeEnv === 'test' ? "http://localhost:3001/v1" : "https://api.framepay.ai/v1",
            FRAME_AGENT_API_KEY: activeEnv === 'test' ? "YOUR_FRAME_AGENT_API_KEY_HERE" : "frm_live_YOUR_KEY_HERE"
          }
        }
      }
    },
    null,
    2
  );

  const cursorConfig = JSON.stringify(
    {
      mcpServers: {
        frame: {
          command: "node",
          args: [
            "/Users/dev/Desktop/Frame/agentpay/backend/dist/mcp/index.js"
          ],
          env: {
            FRAME_API_URL: activeEnv === 'test' ? "http://localhost:3001/v1" : "https://api.framepay.ai/v1",
            FRAME_AGENT_API_KEY: activeEnv === 'test' ? "YOUR_FRAME_AGENT_API_KEY_HERE" : "frm_live_YOUR_KEY_HERE"
          }
        }
      }
    },
    null,
    2
  );

  const genericConfig = `# 1. Stdio Server Invocation
FRAME_API_URL="${activeEnv === 'test' ? 'http://localhost:3001/v1' : 'https://api.framepay.ai/v1'}" \\
FRAME_AGENT_API_KEY="${activeEnv === 'test' ? 'YOUR_FRAME_AGENT_API_KEY' : 'frm_live_YOUR_KEY'}" \\
npx ts-node -r tsconfig-paths/register src/mcp/index.ts

# 2. JSON-RPC tool initialization payload
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}`;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in">
      {/* Back button & Header */}
      <div>
        <Link
          href="/dashboard/developers"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-4"
        >
          <ArrowLeft size={14} />
          <span>Back to Developer Console</span>
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-normal tracking-tight text-white">Frame MCP Connection Guide</h1>
            <p className="text-sm font-normal text-slate-400 mt-1">
              Connect external AI agents (Claude Desktop, Cursor, or custom runners) to Frame’s financial control plane.
            </p>
          </div>

          {/* Environment Switcher */}
          <div className="flex items-center p-1 rounded-full border border-[#252a3d] bg-[#10131d]">
            <button
              onClick={() => setActiveEnv('test')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                activeEnv === 'test'
                  ? 'bg-[#1e2233] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              TEST / SANDBOX
            </button>
            <button
              onClick={() => setActiveEnv('production')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                activeEnv === 'production'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              PRODUCTION
            </button>
          </div>
        </div>
      </div>

      {/* Environment Callout */}
      {activeEnv === 'production' ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 flex items-start gap-3.5">
          <AlertCircle size={20} className="text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-medium text-rose-400">Production Mode Selected</p>
            <p className="text-slate-400 leading-relaxed">
              Production configurations require real provider credentials and live API keys (<code className="text-white font-mono">frm_live_*</code>).
              Never commit production MCP configuration files containing secrets to version control repositories.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-5 flex items-start gap-3.5">
          <ShieldCheck size={20} className="text-[#0052ff] flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-medium text-white">Sandbox / Test Mode Active</p>
            <p className="text-slate-400 leading-relaxed">
              In test mode, payments execute against the Razorpay Sandbox API. Real debit orders and double-entry ledger entries are created without live financial deduction.
            </p>
          </div>
        </div>
      )}

      {/* Client Configuration Tabs */}
      <div className="rounded-2xl border border-[#252a3d] bg-[#141724] overflow-hidden shadow-sm">
        <div className="border-b border-[#252a3d] flex items-center px-6 bg-[#10131d]/60">
          <button
            onClick={() => setActiveTab('claude')}
            className={`py-3.5 px-4 text-xs font-medium border-b-2 transition -mb-px flex items-center gap-2 ${
              activeTab === 'claude'
                ? 'border-[#0052ff] text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Bot size={15} />
            <span>Claude Desktop</span>
          </button>
          <button
            onClick={() => setActiveTab('cursor')}
            className={`py-3.5 px-4 text-xs font-medium border-b-2 transition -mb-px flex items-center gap-2 ${
              activeTab === 'cursor'
                ? 'border-[#0052ff] text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Layers size={15} />
            <span>Cursor IDE</span>
          </button>
          <button
            onClick={() => setActiveTab('generic')}
            className={`py-3.5 px-4 text-xs font-medium border-b-2 transition -mb-px flex items-center gap-2 ${
              activeTab === 'generic'
                ? 'border-[#0052ff] text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Terminal size={15} />
            <span>Generic MCP / CLI</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {activeTab === 'claude' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400 leading-relaxed">
                Add this to your Claude Desktop configuration file at:
                <code className="block mt-1 font-mono text-[11px] p-2.5 rounded-xl bg-[#0a0b0e] border border-[#252a3d] text-white">
                  ~/Library/Application Support/Claude/claude_desktop_config.json
                </code>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-[#0a0b0e] border border-[#252a3d] font-mono text-xs text-slate-200 overflow-x-auto">
                  {claudeConfig}
                </pre>
                <button
                  onClick={() => copyCode('claude', claudeConfig)}
                  className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#16181c] border border-[#252a3d] hover:bg-[#20232b] text-xs font-medium text-white transition shadow-sm"
                >
                  {copied === 'claude' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copied === 'claude' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'cursor' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400 leading-relaxed">
                Add this to your Cursor project settings or global config at:
                <code className="block mt-1 font-mono text-[11px] p-2.5 rounded-xl bg-[#0a0b0e] border border-[#252a3d] text-white">
                  .cursor/mcp.json
                </code>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-[#0a0b0e] border border-[#252a3d] font-mono text-xs text-slate-200 overflow-x-auto">
                  {cursorConfig}
                </pre>
                <button
                  onClick={() => copyCode('cursor', cursorConfig)}
                  className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#16181c] border border-[#252a3d] hover:bg-[#20232b] text-xs font-medium text-white transition shadow-sm"
                >
                  {copied === 'cursor' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copied === 'cursor' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'generic' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400 leading-relaxed">
                Direct command-line or stdio process invocation for custom autonomous agents:
              </div>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-[#0a0b0e] border border-[#252a3d] font-mono text-xs text-slate-200 overflow-x-auto">
                  {genericConfig}
                </pre>
                <button
                  onClick={() => copyCode('generic', genericConfig)}
                  className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#16181c] border border-[#252a3d] hover:bg-[#20232b] text-xs font-medium text-white transition shadow-sm"
                >
                  {copied === 'generic' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copied === 'generic' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Discovered MCP Tools Guide */}
      <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-4">
        <h3 className="font-normal text-sm text-white">Available MCP Tools for AI Agents</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-[#252a3d] bg-[#10131d] space-y-1">
            <div className="font-mono font-medium text-xs text-[#0052ff]">frame_list_payment_authorities</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Allows the AI agent to inspect remaining daily spend limits, category allowances, and single-transaction caps.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-[#252a3d] bg-[#10131d] space-y-1">
            <div className="font-mono font-medium text-xs text-[#0052ff]">frame_create_payment_intent</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Evaluates spending against Policy Firewall. Returns <code className="text-emerald-400">ALLOW</code>, <code className="text-amber-400">REQUIRE_APPROVAL</code>, or <code className="text-rose-400">DENY</code>.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-[#252a3d] bg-[#10131d] space-y-1">
            <div className="font-mono font-medium text-xs text-[#0052ff]">frame_get_payment_status</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Polls real-time payment settlement state (<code className="text-white">SUCCEEDED</code>, <code className="text-white">PENDING_APPROVAL</code>, <code className="text-white">FAILED</code>).
            </p>
          </div>
          <div className="p-4 rounded-xl border border-[#252a3d] bg-[#10131d] space-y-1">
            <div className="font-mono font-medium text-xs text-[#0052ff]">frame_request_approval</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Escalates transactions that exceed autonomous threshold to human approvers with purchase context.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
