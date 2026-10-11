'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { FrameLogo } from '@/components/frame-logo';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('demo@frame.dev');
  const [password, setPassword] = useState('Password123!');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name, orgName);
      }
      router.replace('/dashboard');
    } catch (err: unknown) {
      setError((err as Error).message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0b0e] text-[#f4f5f8] selection:bg-[#0052ff] selection:text-white relative">
      {/* Subtle institutional ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0, 82, 255, 0.12) 0%, transparent 100%)',
        }}
      />

      <div className="w-full max-w-[420px] relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex flex-col items-center gap-3 no-underline group">
            <FrameLogo size={38} textClassName="text-2xl font-normal tracking-tight text-white" />
          </Link>
          <p className="text-sm font-normal text-slate-400">
            Autonomous Financial Control Plane
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#252a3d] bg-[#141724] p-7 shadow-2xl backdrop-blur-xl space-y-6">
          {/* Pill Segmented Switcher */}
          <div className="flex rounded-full p-1 bg-[#10131d] border border-[#252a3d]">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-medium rounded-full transition-all duration-150 ${
                  tab === t
                    ? 'bg-[#1e2233] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    required
                    className="w-full rounded-xl border border-[#252a3d] bg-[#10131d] px-3.5 py-2.5 text-sm text-[#f4f5f8] placeholder-slate-500 focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff] transition"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">Organization Name</label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    placeholder="Acme Autonomous Labs"
                    required
                    className="w-full rounded-xl border border-[#252a3d] bg-[#10131d] px-3.5 py-2.5 text-sm text-[#f4f5f8] placeholder-slate-500 focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff] transition"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full rounded-xl border border-[#252a3d] bg-[#10131d] px-3.5 py-2.5 text-sm text-[#f4f5f8] placeholder-slate-500 focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff] transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full rounded-xl border border-[#252a3d] bg-[#10131d] px-3.5 py-2.5 text-sm text-[#f4f5f8] placeholder-slate-500 focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff] transition"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-full bg-[#0052ff] hover:bg-[#003ecc] active:bg-[#003ecc] text-white text-sm font-medium transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              <span>{loading ? 'Authenticating...' : tab === 'login' ? 'Sign In to Console' : 'Create Organization'}</span>
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          {/* Sandbox Credentials Banner */}
          <div className="rounded-xl border border-[#252a3d] bg-[#10131d]/80 p-3.5 flex items-start gap-2.5 text-xs text-slate-400">
            <ShieldCheck size={16} className="text-[#0052ff] flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-medium text-slate-200">Sandbox Environment Active:</span> Pre-loaded with <code className="text-white font-mono">demo@frame.dev</code> with seeded authorities and agent policies.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
