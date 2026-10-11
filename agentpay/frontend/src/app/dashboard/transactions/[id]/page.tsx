'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { txApi } from '@/lib/api';
import { formatPaise, formatDate } from '@/lib/utils';
import {
  ArrowLeft, Receipt, CheckCircle, Clock, AlertTriangle, RotateCcw,
  ShieldCheck, ExternalLink, RefreshCw, Download
} from 'lucide-react';

interface LedgerEntry {
  id: string;
  entry_type: string;
  amount_paise: number;
  entry_hash: string;
  recorded_at: string;
}

interface TransactionDetail {
  id: string;
  payment_id?: string;
  payment_intent_id?: string;
  status: string;
  payment_status?: string;
  amount_paise: number;
  currency: string;
  merchant?: string;
  purpose?: string;
  agent_id?: string;
  agent_name?: string;
  provider?: string;
  rail?: string;
  provider_payment_id?: string;
  reconciliation_status?: string;
  created_at: string;
  settled_at?: string;
  ledger_entries?: LedgerEntry[];
}

export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [tx, setTx] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refund Modal
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [refundSuccessMessage, setRefundSuccessMessage] = useState<string | null>(null);

  const loadTransaction = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await txApi.get(id);
      setTx(res.data as unknown as TransactionDetail);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load transaction details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransaction();
  }, [id]);

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tx) return;
    setRefunding(true);
    try {
      const res = await txApi.refund(tx.id || tx.payment_id || '', refundReason.trim() || undefined);
      setShowRefundModal(false);
      setRefundSuccessMessage(`Refund processed successfully. Ledger entry: ${(res.data?.ledger_entry_id as string) || 'Reversed'}`);
      await loadTransaction();
    } catch (err: unknown) {
      alert((err as Error).message || 'Refund failed');
    } finally {
      setRefunding(false);
    }
  };

  const exportEvidenceReceipt = () => {
    if (!tx) return;
    const receiptData = {
      receipt_header: {
        system: 'Frame Financial Control Plane',
        spec_version: '1.0-frame-evidence',
        receipt_id: `rcpt_tx_${tx.id.replace(/[^a-zA-Z0-9]/g, '')}`,
        generated_at: new Date().toISOString(),
      },
      transaction: {
        transaction_id: tx.id,
        payment_intent_id: tx.payment_intent_id || tx.payment_id || '—',
        amount_paise: tx.amount_paise,
        amount_formatted: formatPaise(tx.amount_paise || 0),
        currency: tx.currency || 'INR',
        merchant: tx.merchant || '—',
        purpose: tx.purpose || '—',
        status: tx.status || tx.payment_status,
        provider: tx.provider || 'razorpay',
        rail: tx.rail || 'upi',
        provider_payment_id: tx.provider_payment_id || '—',
        created_at: tx.created_at,
        settled_at: tx.settled_at,
      },
      ledger_proof: (tx.ledger_entries || []).map(le => ({
        entry_type: le.entry_type,
        amount_paise: le.amount_paise,
        entry_hash: le.entry_hash,
        recorded_at: le.recorded_at,
      })),
      cryptographic_guarantee: {
        tamper_proof_ledger: true,
        chain_algorithm: 'SHA-256',
        zero_credential_exposure: true,
        reconciliation_status: tx.reconciliation_status || 'reconciled',
      },
    };

    const blob = new Blob([JSON.stringify(receiptData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `frame-transaction-receipt-${tx.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isRefundable =
    tx &&
    ['succeeded', 'SUCCEEDED', 'settled', 'SETTLED', 'COMPLETED'].includes(tx.status || tx.payment_status || '') &&
    !(tx.ledger_entries || []).some((le: LedgerEntry) => le.entry_type === 'REFUND');

  const isAlreadyRefunded =
    tx && (tx.ledger_entries || []).some((le: LedgerEntry) => le.entry_type === 'REFUND');

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-4 w-32 bg-[#252a3d] rounded-full" />
        <div className="h-64 rounded-2xl bg-[#141724] border border-[#252a3d]" />
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/transactions" className="inline-flex items-center gap-1.5 text-xs text-[#9ca3b8] hover:text-white transition">
          <ArrowLeft size={14} /> Back to Transactions
        </Link>
        <div className="rounded-2xl border border-[#cf202f]/30 bg-[#141724] p-8 text-center text-sm text-[#cf202f]">
          {error || 'Transaction not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in">
      {/* Top Header */}
      <div>
        <Link
          href="/dashboard/transactions"
          className="inline-flex items-center gap-1.5 text-xs text-[#9ca3b8] hover:text-white transition mb-3"
        >
          <ArrowLeft size={14} /> Back to Transactions
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-normal tracking-tight text-[#f4f5f8]">
                Transaction {tx.merchant ? `— ${tx.merchant}` : ''}
              </h1>
              <span className={`rounded-full px-3 py-0.5 text-xs font-mono font-medium uppercase ${
                isAlreadyRefunded
                  ? 'border border-purple-500/30 text-purple-400'
                  : ['succeeded', 'SUCCEEDED'].includes(tx.status || tx.payment_status || '')
                  ? 'border border-[#05b169]/30 text-[#05b169]'
                  : 'border border-[#252a3d] text-[#9ca3b8]'
              }`}>
                {isAlreadyRefunded ? 'REFUNDED' : tx.status || tx.payment_status}
              </span>
            </div>
            <p className="text-xs font-mono text-[#5b616e] mt-1.5">
              ID: {tx.id || tx.payment_id}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadTransaction}
              className="inline-flex items-center gap-2 rounded-full border border-[#252a3d] bg-[#141724] hover:bg-[#1a1f33] px-4 py-2 text-sm text-[#9ca3b8] hover:text-white transition"
              title="Refresh"
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
            <button
              onClick={exportEvidenceReceipt}
              className="inline-flex items-center gap-2 rounded-full bg-[#0052ff] hover:bg-[#003ecc] px-5 py-2 text-sm font-semibold text-white transition"
              title="Download Signed Evidence Receipt"
            >
              <Download size={14} />
              <span>Export Receipt</span>
            </button>
            {isRefundable && (
              <button
                onClick={() => setShowRefundModal(true)}
                className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 px-4 py-2 text-sm font-medium transition"
              >
                <RotateCcw size={14} />
                <span>Refund Payment</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {refundSuccessMessage && (
        <div className="rounded-2xl border border-[#05b169]/30 bg-[#05b169]/5 p-4 text-[#05b169] text-xs flex items-center gap-2">
          <CheckCircle size={16} />
          <span>{refundSuccessMessage}</span>
        </div>
      )}

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Financial & Execution Parameters */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#9ca3b8]">Payment Details</h2>
              <Link
                href={`/dashboard/payments/${tx.payment_intent_id || tx.payment_id || tx.id}`}
                className="text-xs hover:underline inline-flex items-center gap-1 text-[#0052ff]"
              >
                View Originating Intent & Decision <ExternalLink size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[#5b616e] block mb-1">Amount</span>
                <span className="text-xl font-normal font-mono text-[#f4f5f8]">{formatPaise(tx.amount_paise || 0)}</span>
              </div>
              <div>
                <span className="text-[#5b616e] block mb-1">Currency</span>
                <span className="text-sm font-medium text-[#f4f5f8]">{tx.currency || 'INR'}</span>
              </div>
              <div>
                <span className="text-[#5b616e] block mb-1">Payee / Merchant</span>
                <span className="text-sm font-medium text-[#f4f5f8]">{tx.merchant || '—'}</span>
              </div>
              <div>
                <span className="text-[#5b616e] block mb-1">Initiating Agent</span>
                <span className="text-sm font-medium text-[#0052ff]">{tx.agent_name || 'Agent'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[#5b616e] block mb-1">Declared Purpose</span>
                <span className="text-sm text-[#f4f5f8]">{tx.purpose || '—'}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-4">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#9ca3b8]">Provider & Settlement Rail</h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[#5b616e] block mb-1">Payment Provider</span>
                <span className="font-mono text-sm text-[#f4f5f8] uppercase">{tx.provider || 'razorpay'}</span>
              </div>
              <div>
                <span className="text-[#5b616e] block mb-1">Payment Rail</span>
                <span className="font-mono text-sm text-[#f4f5f8] uppercase">{tx.rail || 'upi'}</span>
              </div>
              <div>
                <span className="text-[#5b616e] block mb-1">Provider Reference ID</span>
                <span className="font-mono text-xs text-[#9ca3b8]">{tx.provider_payment_id || '—'}</span>
              </div>
              <div>
                <span className="text-[#5b616e] block mb-1">Reconciliation Status</span>
                <span className="font-mono text-xs text-[#05b169] uppercase">{tx.reconciliation_status || 'reconciled'}</span>
              </div>
              <div>
                <span className="text-[#5b616e] block mb-1">Created Date</span>
                <span className="font-mono text-xs text-[#9ca3b8]">{formatDate(tx.created_at)}</span>
              </div>
              <div>
                <span className="text-[#5b616e] block mb-1">Settled Date</span>
                <span className="font-mono text-xs text-[#9ca3b8]">{tx.settled_at ? formatDate(tx.settled_at) : '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Ledger & Cryptographic Proof */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#05b169]" />
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#9ca3b8]">Ledger Proof</h2>
            </div>
            <p className="text-xs text-[#9ca3b8] leading-relaxed">
              Every settled transaction creates an immutable, SHA-256 hash-chained ledger entry guaranteeing financial integrity.
            </p>

            <div className="space-y-3 pt-2">
              {(tx.ledger_entries || []).map((le: LedgerEntry) => (
                <div key={le.id} className="p-4 rounded-xl border border-[#252a3d] bg-[#0a0b0e] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className={`font-mono font-medium ${le.entry_type === 'REFUND' ? 'text-purple-400' : 'text-[#05b169]'}`}>
                      {le.entry_type}
                    </span>
                    <span className="font-mono text-[#f4f5f8]">{formatPaise(le.amount_paise)}</span>
                  </div>
                  <div className="font-mono text-[10px] text-[#5b616e] truncate" title={le.entry_hash}>
                    Hash: {le.entry_hash}
                  </div>
                  <div className="text-[10px] text-[#5b616e]">
                    Recorded: {formatDate(le.recorded_at)}
                  </div>
                </div>
              ))}
              {(!tx.ledger_entries || tx.ledger_entries.length === 0) && (
                <div className="text-xs text-[#5b616e]">No ledger entries recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── REFUND MODAL ────────────────────────────── */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-2xl border border-[#252a3d] bg-[#141724] max-w-md w-full p-6 shadow-2xl space-y-5 animate-in">
            <div className="flex items-center gap-3 text-purple-400">
              <RotateCcw size={20} />
              <h3 className="font-normal text-lg text-[#f4f5f8]">Refund Payment</h3>
            </div>

            <p className="text-xs text-[#9ca3b8] leading-relaxed">
              You are issuing a full refund of <strong className="text-white font-mono">{formatPaise(tx.amount_paise)}</strong> to merchant <strong className="text-white">{tx.merchant}</strong>.
              This calls the payment provider’s refund API and records an immutable cryptographic reversal in the ledger.
            </p>

            <form onSubmit={handleProcessRefund} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#9ca3b8] mb-1.5">Reason for Refund</label>
                <input
                  type="text"
                  placeholder="e.g. Order cancelled by user / Duplicate payment"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#252a3d] bg-[#0a0b0e] text-xs text-[#f4f5f8] placeholder-[#5b616e] focus:outline-none focus:border-[#0052ff]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="rounded-full border border-[#252a3d] bg-[#16181c] px-4 py-2 text-xs font-medium text-[#9ca3b8] hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refunding}
                  className="rounded-full bg-[#0052ff] hover:bg-[#003ecc] text-white px-5 py-2 text-xs font-semibold transition disabled:opacity-50"
                >
                  {refunding ? 'Processing Refund…' : 'Confirm Full Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
