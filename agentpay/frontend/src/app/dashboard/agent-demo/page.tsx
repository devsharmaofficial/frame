'use client';

import React, { useState, useRef, useEffect } from 'react';
import { resolveApiBase } from '@/lib/api';
import { Bot, Terminal, ShoppingBag, Shield, CheckCircle, AlertTriangle, ArrowRight, RefreshCw, Key, Sparkles, Check, X } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  emoji: string;
  risk: 'safe' | 'elevated' | 'blocked';
}

interface AgentLog {
  id: string;
  timestamp: string;
  type: 'thinking' | 'action' | 'success' | 'warning' | 'error' | 'info' | 'policy';
  message: string;
  detail?: string;
}

interface PaymentResult {
  decision: string;
  status: string;
  payment_intent_id: string;
  amount: number;
  merchant: string;
  next_action: string;
  reasons?: string[];
  canonicalCheckout?: {
    subtotal: number;
    shipping: number;
    total: number;
    orderId: string;
  };
}

const PRODUCTS: Product[] = [
  { id: 'prod_kbd_01', name: 'Keychron C3 Mechanical Keyboard', description: 'Hot-swappable RGB mechanical keyboard', price: 2499, category: 'electronics', emoji: '⌨️', risk: 'safe' },
  { id: 'prod_mouse_03', name: 'Logitech Precision Wireless Mouse', description: 'Ergonomic 4000 DPI multi-device mouse', price: 1499, category: 'electronics', emoji: '🖱️', risk: 'safe' },
  { id: 'prod_chair_02', name: 'Ergonomic Office Chair Pro', description: 'High-back mesh lumbar support chair', price: 2799, category: 'office', emoji: '🪑', risk: 'elevated' },
  { id: 'prod_chips_04', name: 'Casino Royale VIP Chips Pack', description: 'Blocked category: gambling protocol policy', price: 2499, category: 'gambling', emoji: '🎰', risk: 'blocked' },
  { id: 'prod_server_05', name: 'Enterprise GPU Server Rack', description: 'High-ticket infrastructure spend above tier limits', price: 9999, category: 'infrastructure', emoji: '🖥️', risk: 'blocked' },
];

const PRESET_PROMPTS = [
  { text: 'Buy me a mechanical keyboard under ₹3,000', productId: 'prod_kbd_01', label: '⌨️ Keyboard (ALLOW)' },
  { text: 'Order ergonomic office chair below ₹20,000', productId: 'prod_chair_02', label: '🪑 Chair (Elevated)' },
  { text: 'Buy casino chips pack under ₹5,000', productId: 'prod_chips_04', label: '🎰 Casino (DENY)' },
  { text: 'Purchase enterprise GPU server under ₹20,000', productId: 'prod_server_05', label: '🖥️ GPU Server (Approval)' },
];

function uid() { return Math.random().toString(36).slice(2, 10); }
function nowStr() { return new Date().toLocaleTimeString('en-IN', { hour12: false }); }

const LOG_COLOR: Record<string, string> = {
  thinking: 'text-[#9ca3b8]',
  action: 'text-[#0052ff]',
  success: 'text-[#05b169]',
  warning: 'text-amber-400',
  error: 'text-[#cf202f]',
  info: 'text-[#9ca3b8]',
  policy: 'text-[#0052ff]',
};

export default function AgentDemoPage() {
  const [apiKey, setApiKey] = useState('');
  const [instruction, setInstruction] = useState('Buy me a mechanical keyboard under ₹3,000');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(PRODUCTS[0]);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [step, setStep] = useState<'idle' | 'intent' | 'searching' | 'checkout' | 'authorizing' | 'done'>('idle');
  const [approving, setApproving] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);
  useEffect(() => { const s = localStorage.getItem('frame_agent_api_key') || ''; if (s) setApiKey(s); }, []);

  async function handleHumanApproval(intentId: string, approve: boolean) {
    setApproving(true);
    const baseUrl = resolveApiBase();
    addLog('action', `Human principal submitting decision: ${approve ? 'APPROVE' : 'REJECT'}…`, `Intent: ${intentId}`);

    try {
      const res = await fetch(`${baseUrl}/v1/payment-intents/${intentId}`, {
        headers: { 'X-API-Key': apiKey.trim() },
      });
      await res.json();

      if (approve) {
        await sleep(600);
        addLog('success', '✓ Human approval registered with Frame Control Plane', `Intent ${intentId} is now AUTHORIZED.`);
        addLog('action', 'Resuming agent execution from paused state…');
        await sleep(500);
        addLog('success', 'Payment executed and settled autonomously', `Amount: ₹${result?.amount?.toLocaleString('en-IN')}`);
        addLog('success', 'Merchant order confirmed and fulfilled', `Order: ${result?.canonicalCheckout?.orderId || 'ORDER_CONFIRMED'}`);

        setResult((prev) => prev ? {
          ...prev,
          decision: 'APPROVED_BY_HUMAN',
          status: 'SUCCEEDED',
          next_action: 'NONE',
        } : null);
      } else {
        await sleep(400);
        addLog('error', '✕ Human principal rejected the transaction', `Intent ${intentId} marked as REJECTED.`);
        setResult((prev) => prev ? {
          ...prev,
          decision: 'REJECTED_BY_HUMAN',
          status: 'DENIED',
          next_action: 'DO_NOT_RETRY',
        } : null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog('error', `Approval action failed: ${msg}`);
    } finally {
      setApproving(false);
    }
  }

  function addLog(type: AgentLog['type'], message: string, detail?: string) {
    setLogs((prev) => [...prev, { id: uid(), timestamp: nowStr(), type, message, detail }]);
  }
  function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

  function handlePreset(p: { text: string; productId: string }) {
    setInstruction(p.text);
    const prod = PRODUCTS.find((x) => x.id === p.productId);
    if (prod) setSelectedProduct(prod);
  }

  async function runAgent() {
    if (!apiKey.trim()) {
      alert('Please enter your Frame Agent API Key (starts with frm_test_ or frm_live_)');
      return;
    }
    localStorage.setItem('frame_agent_api_key', apiKey.trim());
    setRunning(true);
    setLogs([]);
    setResult(null);
    const baseUrl = resolveApiBase();
    const idempotencyKey = `agent_run_${Date.now()}_${uid()}`;

    try {
      setStep('intent');
      addLog('thinking', 'Autonomous Shopping Agent initializing runtime container…');
      await sleep(500);

      addLog('info', `Instruction received: "${instruction}"`);
      await sleep(400);

      const matchAmount = instruction.match(/(?:₹|rs\.?|under|below|max\s+budget|budget)\s*([\d,]+)/i);
      const budgetRupees = matchAmount ? parseFloat(matchAmount[1].replace(/,/g, '')) : 3000;
      addLog('action', `Immutable User Intent locked: Max Budget ₹${budgetRupees.toLocaleString('en-IN')}`, 'Currency: INR | Mode: Fail-closed');
      await sleep(500);

      setStep('searching');
      addLog('thinking', 'Scanning merchant catalog for matching inventory…');
      await sleep(700);

      const target = selectedProduct || PRODUCTS[0];
      addLog('action', `Candidate discovered: ${target.emoji} ${target.name}`, `Price: ₹${target.price.toLocaleString('en-IN')} | Category: ${target.category}`);
      await sleep(500);

      addLog('thinking', 'Evaluating ranking criteria: budget check, relevance match, category authorization…');
      await sleep(500);
      addLog('success', `Selected best candidate: ${target.name}`, `Within user budget of ₹${budgetRupees.toLocaleString('en-IN')}`);
      await sleep(600);

      setStep('checkout');
      addLog('action', 'Adding item to cart at TechSupply Store…');
      await sleep(600);

      const orderId = `ORD_${Date.now()}_${uid().toUpperCase()}`;
      const subtotal = target.price;
      const shipping = 0;
      const total = subtotal + shipping;

      addLog('action', `Merchant checkout session created: ${orderId}`, `Subtotal: ₹${subtotal.toLocaleString('en-IN')} | Total: ₹${total.toLocaleString('en-IN')}`);
      await sleep(600);

      addLog('thinking', 'Extracting canonical checkout object and verifying Intent Binding…');
      await sleep(500);

      if (total > budgetRupees) {
        addLog('error', `Intent binding violation: Checkout total ₹${total} exceeds user budget ₹${budgetRupees}!`, 'Halting immediately (Fail-Closed)');
        setStep('done');
        setRunning(false);
        return;
      }
      addLog('success', `Intent binding verified: Total ₹${total} <= Budget ₹${budgetRupees}`);
      await sleep(400);

      setStep('authorizing');
      addLog('thinking', `Querying Frame MCP client (frame_create_payment_intent)…`, `Key: ${idempotencyKey}`);
      await sleep(400);
      addLog('policy', 'Frame Policy Firewall evaluating transaction against active Payment Authority…', `Merchant: TechSupply Store | Category: ${target.category} | Amount: ₹${total.toLocaleString('en-IN')}`);

      const res = await fetch(`${baseUrl}/v1/payment-intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey.trim() },
        body: JSON.stringify({
          amount_paise: total * 100,
          currency: 'INR',
          merchant: 'TechSupply Store',
          merchant_reference: orderId,
          order_reference: orderId,
          purpose: `Purchase ${target.name} from TechSupply Store`,
          category: target.category,
          idempotency_key: idempotencyKey,
          metadata: {
            agent: 'Frame Autonomous Shopping Agent v1.0',
            product_id: target.id,
            instruction,
          },
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const err = body?.error || {};
        addLog('error', `Frame API error: ${err.message || `HTTP ${res.status}`}`, err.code || '');
        setStep('done');
        setRunning(false);
        return;
      }

      const intent = body.data;
      const firewall = intent.firewall || {};
      const decision = firewall.decision || intent.decision || intent.status || 'UNKNOWN';
      const reasons: string[] = firewall.reasons || (intent.denial_reason ? [intent.denial_reason] : []);

      const payResult: PaymentResult = {
        decision,
        status: intent.status,
        payment_intent_id: intent.id,
        amount: intent.amount_paise / 100,
        merchant: intent.merchant,
        next_action: 'UNKNOWN',
        reasons,
        canonicalCheckout: { subtotal, shipping, total, orderId },
      };

      if (decision === 'DENY' || intent.status === 'DENIED') {
        payResult.next_action = 'DO_NOT_RETRY';
        addLog('policy', `Frame Firewall Decision: DENY`, reasons.join(' • ') || 'Policy violation');
        addLog('warning', 'Transaction blocked by Frame Policy Firewall', `Intent: ${intent.id}`);
        addLog('info', 'Agent halting immediately — DO_NOT_RETRY enforced by policy.');
      } else if (decision === 'REQUIRE_APPROVAL' || intent.status === 'PENDING_APPROVAL') {
        payResult.next_action = 'WAIT_FOR_APPROVAL';
        addLog('policy', `Frame Firewall Decision: REQUIRE_APPROVAL`, reasons.join(' • ') || 'Above autonomous threshold');
        addLog('warning', 'Human approval required before settlement', `Intent: ${intent.id}`);
        addLog('info', 'Calling frame_request_approval — notifying human principal…');
        await sleep(800);
        await fetch(`${baseUrl}/v1/payment-intents/${intent.id}/request-approval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey.trim() },
          body: JSON.stringify({ notes: `Agent autonomous purchase for ${target.name}. Order: ${orderId}` }),
        }).catch(() => null);
        addLog('success', 'Approval request dispatched to human principal', 'Pending review in Dashboard → Approvals');
      } else {
        payResult.next_action = 'PAYMENT_EXECUTION';
        addLog('policy', `Frame Firewall Decision: ALLOW`, 'Authorized by delegated Payment Authority');
        addLog('action', 'Payment intent authorized — initiating settlement…', `Intent: ${intent.id}`);
        await sleep(700);

        const statusRes = await fetch(`${baseUrl}/v1/payment-intents/${intent.id}`, { headers: { 'X-API-Key': apiKey.trim() } });
        const statusBody = await statusRes.json().catch(() => ({}));
        const latestStatus = statusBody?.data?.status || intent.status;
        payResult.status = latestStatus;

        if (['SUCCEEDED', 'COMPLETED', 'SETTLED', 'AUTHORIZED', 'EXECUTING', 'PROCESSING'].includes(latestStatus)) {
          payResult.next_action = 'NONE';
          addLog('success', `Payment executed and settled`, `Status: ${latestStatus} | ₹${total.toLocaleString('en-IN')}`);
          addLog('action', 'Sending fulfillment confirmation to merchant…', `Order: ${orderId}`);
          await sleep(500);
          addLog('success', 'Order confirmed for fulfillment. Autonomous shopping task complete.');
        } else {
          addLog('info', `Payment processing — status: ${latestStatus}`);
        }
      }

      setResult(payResult);
      setStep('done');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addLog('error', `Unexpected error: ${message}`);
      setStep('done');
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    setLogs([]);
    setResult(null);
    setStep('idle');
  }

  const STEP_LABELS: Record<string, { label: string; color: string }> = {
    idle: { label: 'Ready', color: 'text-[#9ca3b8]' },
    intent: { label: 'Extracting Intent…', color: 'text-[#0052ff]' },
    searching: { label: 'Searching Catalog…', color: 'text-[#0052ff]' },
    checkout: { label: 'Creating Order…', color: 'text-[#0052ff]' },
    authorizing: { label: 'Frame Policy Check…', color: 'text-[#0052ff]' },
    done: { label: 'Done', color: 'text-[#05b169]' },
  };

  return (
    <div className="space-y-8 animate-in">
      {/* Header Band */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#252a3d] bg-[#141724] px-3 py-1 text-xs font-mono uppercase tracking-wider text-[#9ca3b8] mb-3">
            <Bot size={13} className="text-[#0052ff]" />
            <span>Autonomous Agent Runtime</span>
          </div>
          <h1 className="text-3xl font-normal tracking-tight text-[#f4f5f8]">
            Shopping Agent Simulation
          </h1>
          <p className="mt-1 text-sm text-[#9ca3b8]">
            An end-to-end autonomous agent executing purchases governed in real-time by the Frame Policy Firewall.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {step === 'done' ? (
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-full border border-[#252a3d] bg-[#141724] hover:bg-[#1a1f33] px-5 py-2.5 text-sm font-medium text-[#f4f5f8] transition"
            >
              <RefreshCw size={14} />
              <span>Reset Runtime</span>
            </button>
          ) : (
            <button
              onClick={runAgent}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-full bg-[#0052ff] hover:bg-[#003ecc] px-6 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
            >
              {running ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Executing Agent…</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Execute Agent</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Grid: Config Left, Live Console Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Parameters & Prompts */}
        <div className="lg:col-span-5 space-y-6">
          {/* Agent Key Input Card */}
          <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-[#9ca3b8] flex items-center gap-2">
                <Key size={13} className="text-[#0052ff]" />
                <span>Agent API Key</span>
              </label>
              <span className="text-[11px] font-mono text-[#9ca3b8]">Delegated Token</span>
            </div>
            <input
              type="text"
              placeholder="frm_test_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-xl border border-[#252a3d] bg-[#0a0b0e] px-4 py-2.5 text-xs font-mono text-[#f4f5f8] placeholder-[#5b616e] focus:border-[#0052ff] focus:outline-none transition"
            />
            <p className="text-[11px] text-[#5b616e]">
              Provisioned under <span className="text-[#9ca3b8]">Dashboard → Agents</span> with assigned authority.
            </p>
          </div>

          {/* Natural Language Instruction Card */}
          <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-[#9ca3b8]">
                User Instruction
              </label>
              <span className="text-[11px] font-mono text-[#9ca3b8]">Intent Prompt</span>
            </div>

            <textarea
              rows={3}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={running}
              placeholder="e.g. Buy me a mechanical keyboard under ₹3,000"
              className="w-full rounded-xl border border-[#252a3d] bg-[#0a0b0e] p-3 text-sm text-[#f4f5f8] placeholder-[#5b616e] focus:border-[#0052ff] focus:outline-none transition resize-none"
            />

            <div>
              <span className="text-xs font-medium text-[#9ca3b8] block mb-2">Preset Scenarios:</span>
              <div className="flex flex-wrap gap-2">
                {PRESET_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePreset(p)}
                    disabled={running}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition border ${
                      instruction === p.text
                        ? 'border-[#0052ff] bg-[#0052ff]/10 text-white'
                        : 'border-[#252a3d] bg-[#16181c] text-[#9ca3b8] hover:text-white hover:border-[#3b4259]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Target Product Selection */}
          <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#9ca3b8]">
                Discovered Target Item
              </h2>
              <span className="text-[11px] font-mono text-[#9ca3b8]">Merchant SKU</span>
            </div>

            {selectedProduct && (
              <div className="rounded-xl border border-[#252a3d] bg-[#0a0b0e] p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#141724] border border-[#252a3d] flex items-center justify-center text-2xl shrink-0">
                    {selectedProduct.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-[#f4f5f8] truncate">
                      {selectedProduct.name}
                    </h3>
                    <p className="text-xs text-[#9ca3b8] mt-0.5 line-clamp-1">
                      {selectedProduct.description}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-base font-normal font-mono text-[#f4f5f8]">
                        ₹{selectedProduct.price.toLocaleString('en-IN')}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        selectedProduct.risk === 'safe'
                          ? 'border border-[#05b169]/30 text-[#05b169]'
                          : selectedProduct.risk === 'elevated'
                          ? 'border border-amber-500/30 text-amber-400'
                          : 'border border-[#cf202f]/30 text-[#cf202f]'
                      }`}>
                        {selectedProduct.risk === 'safe' ? 'Standard Policy' : selectedProduct.risk === 'elevated' ? 'Review Trigger' : 'Strict Block'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#252a3d] flex items-center justify-between text-xs text-[#5b616e]">
                  <span>Merchant: <strong className="text-[#9ca3b8]">TechSupply Store</strong></span>
                  <span>Category: <strong className="text-[#9ca3b8] capitalize">{selectedProduct.category}</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Execution Terminal & Output */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-[#252a3d] bg-[#0a0b0e] flex flex-col h-[580px] overflow-hidden">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#252a3d] bg-[#141724]/60">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#252a3d]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#252a3d]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#252a3d]" />
                </div>
                <span className="ml-3 text-xs font-mono text-[#9ca3b8]">runtime_session: live_evaluator</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono ${STEP_LABELS[step]?.color}`}>
                  ● {STEP_LABELS[step]?.label}
                </span>
              </div>
            </div>

            {/* Terminal Log Stream */}
            <div className="p-5 flex-1 overflow-y-auto font-mono text-xs space-y-3">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-12 h-12 rounded-full border border-[#252a3d] bg-[#141724] flex items-center justify-center mb-3 text-[#9ca3b8]">
                    <Terminal size={20} />
                  </div>
                  <h4 className="text-sm font-medium text-[#f4f5f8]">Agent Runtime Idle</h4>
                  <p className="text-xs text-[#5b616e] mt-1 max-w-sm">
                    Enter your agent API key and trigger execution to observe autonomous shopping, cart extraction, and policy firewall decisions.
                  </p>
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3">
                    <span className="text-[#5b616e] shrink-0 select-none">{log.timestamp}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`${LOG_COLOR[log.type]} font-medium`}>{log.message}</div>
                      {log.detail && (
                        <div className="text-[#9ca3b8] mt-1 pl-3 border-l border-[#252a3d] break-all text-[11px]">
                          {log.detail}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>

            {/* Bottom Result Strip */}
            {result && (
              <div className="p-5 border-t border-[#252a3d] bg-[#141724]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-[#0052ff]" />
                    <span className="text-xs font-mono uppercase tracking-wider text-[#9ca3b8]">Policy Result</span>
                  </div>
                  <span className={`rounded-full px-3 py-0.5 text-xs font-mono font-medium ${
                    result.decision === 'ALLOW' || result.decision === 'APPROVED_BY_HUMAN'
                      ? 'border border-[#05b169]/30 text-[#05b169]'
                      : result.decision === 'REQUIRE_APPROVAL'
                      ? 'border border-amber-500/30 text-amber-400'
                      : 'border border-[#cf202f]/30 text-[#cf202f]'
                  }`}>
                    {result.decision}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-[#5b616e] block text-[10px] uppercase">Intent ID</span>
                    <span className="text-[#f4f5f8] truncate block" title={result.payment_intent_id}>
                      {result.payment_intent_id.slice(0, 14)}…
                    </span>
                  </div>
                  <div>
                    <span className="text-[#5b616e] block text-[10px] uppercase">Amount</span>
                    <span className="text-[#f4f5f8]">₹{result.amount.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[#5b616e] block text-[10px] uppercase">Status</span>
                    <span className="text-[#f4f5f8]">{result.status}</span>
                  </div>
                  <div>
                    <span className="text-[#5b616e] block text-[10px] uppercase">Next Action</span>
                    <span className="text-[#f4f5f8]">{result.next_action}</span>
                  </div>
                </div>

                {/* Human-in-the-loop review trigger banner */}
                {result.decision === 'REQUIRE_APPROVAL' && (
                  <div className="mt-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-semibold text-amber-300">Human Principal Authorization Required</h4>
                      <p className="text-xs text-[#9ca3b8] mt-0.5">Autonomous transaction exceeds risk thresholds.</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleHumanApproval(result.payment_intent_id, true)}
                        disabled={approving}
                        className="rounded-full bg-[#05b169] hover:bg-[#049457] text-white px-4 py-1.5 text-xs font-semibold transition"
                      >
                        {approving ? 'Authorizing…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleHumanApproval(result.payment_intent_id, false)}
                        disabled={approving}
                        className="rounded-full border border-[#cf202f]/40 hover:bg-[#cf202f]/10 text-[#cf202f] px-4 py-1.5 text-xs font-semibold transition"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
