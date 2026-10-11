'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { FrameLogo } from '@/components/frame-logo';

/* ─────────────────────────────────────────────────────────────────────────────
   Frame — Marketing Landing Page
   Design: Coinbase-style institutional editorial system, adapted for Frame.
   Palette: Black primary, surface-soft/dark alternating bands, dark hero.
───────────────────────────────────────────────────────────────────────────── */

export default function MarketingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div style={{ background: 'var(--canvas)', color: 'var(--ink)' }}>
      {/* ── Navigation ── */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          background: scrolled ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${scrolled ? 'var(--hairline)' : 'transparent'}`,
          transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        <div className="container-marketing" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          {/* Wordmark */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <FrameLogo size={28} textClassName="text-[17px] font-semibold text-[#0a0b0d]" />
          </Link>

          {/* Desktop Nav Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 40 }} className="hidden md:flex">
            {['For Developers', 'For Enterprises', 'Docs', 'Pricing'].map(label => (
              <a
                key={label}
                href={label === 'Docs' ? '/dashboard/developers' : '#'}
                style={{
                  fontSize: 14, fontWeight: 500, color: 'var(--body)',
                  padding: '6px 12px', borderRadius: 8, textDecoration: 'none',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--body)')}
              >
                {label}
              </a>
            ))}
          </div>

          {/* Right CTAs */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/login" style={{
              fontSize: 14, fontWeight: 500, color: 'var(--body)',
              padding: '6px 14px', borderRadius: 100, textDecoration: 'none',
              transition: 'color 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--body)')}
            >
              Sign In
            </Link>
            <Link href="/login" className="btn-frame-primary" style={{ fontSize: 14, height: 38, padding: '0 18px' }}>
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════════
          BAND 1 — DARK HERO (Signature)
          Full-bleed dark canvas + floating product-UI mockup cards
      ═══════════════════════════════════════════════════════════════════════ */}
      <section style={{
        background: 'var(--surface-dark)',
        color: 'var(--on-dark)',
        padding: '96px 0 80px',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Subtle grid overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }} />

        <div className="container-marketing" style={{ position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>

            {/* Left — Hero copy */}
            <div>
              <div className="badge-section badge-section-dark" style={{ marginBottom: 32 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#05b169' }} />
                Sandbox live — no real money
              </div>

              <h1 className="display-mega" style={{ color: 'var(--on-dark)', marginBottom: 24, maxWidth: 560 }}>
                The financial control plane for AI agents.
              </h1>

              <p style={{
                fontSize: 18, color: 'var(--on-dark-soft)',
                lineHeight: 1.6, maxWidth: 440, marginBottom: 40,
              }}>
                Frame gives every autonomous agent a programmable spending authority, a policy firewall, and a complete audit trail — before a single rupee moves.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link href="/login" className="btn-frame-primary btn-frame-primary-lg">
                  Start building
                </Link>
                <Link href="/dashboard/developers" className="btn-frame-ghost-dark btn-frame-primary-lg">
                  Read the docs
                </Link>
              </div>

              <div style={{ marginTop: 48, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                {[
                  { value: '< 200ms', label: 'Firewall decision' },
                  { value: '14', label: 'Failure scenarios tested' },
                  { value: '0', label: 'Credentials exposed' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 500, color: 'var(--on-dark)' }}>
                      {item.value}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--on-dark-soft)', marginTop: 2 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Floating product-UI mockup cards */}
            <div style={{ position: 'relative', height: 480 }}>

              {/* Primary card — Intent evaluation */}
              <div className="product-card-dark" style={{
                position: 'absolute', top: 0, right: 0,
                width: 340,
                boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--on-dark-soft)', marginBottom: 16, textTransform: 'uppercase' }}>
                  Policy Firewall Decision
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--on-dark-soft)' }}>Procurement Agent</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 500, color: 'var(--on-dark)', marginTop: 4 }}>₹4,200</div>
                  </div>
                  <div style={{
                    padding: '6px 14px', borderRadius: 100,
                    background: 'rgba(5,177,105,0.12)',
                    color: '#05b169', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
                  }}>
                    ALLOW
                  </div>
                </div>

                <div className="product-card-inner" style={{ marginBottom: 12 }}>
                  {[
                    { check: '✓', label: 'Agent authenticated', color: '#05b169' },
                    { check: '✓', label: 'Authority active', color: '#05b169' },
                    { check: '✓', label: 'Merchant allowed', color: '#05b169' },
                    { check: '✓', label: 'Budget within limits', color: '#05b169' },
                    { check: '✓', label: 'Zero credentials captured', color: '#05b169' },
                  ].map(row => (
                    <div key={row.label} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      fontSize: 12,
                    }}>
                      <span style={{ color: row.color, fontWeight: 700, width: 14, flexShrink: 0 }}>{row.check}</span>
                      <span style={{ color: 'var(--on-dark-soft)' }}>{row.label}</span>
                    </div>
                  ))}
                </div>

                <div style={{
                  fontSize: 11, color: 'var(--on-dark-soft)',
                  fontFamily: "'JetBrains Mono', monospace",
                  wordBreak: 'break-all',
                }}>
                  sha256:3f8a1c…9d2e <span style={{ color: 'rgba(255,255,255,0.25)' }}>intent hash</span>
                </div>
              </div>

              {/* Secondary card — Authority summary */}
              <div className="product-card-dark" style={{
                position: 'absolute', bottom: 0, left: 0,
                width: 280,
                boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--on-dark-soft)', marginBottom: 16, textTransform: 'uppercase' }}>
                  Payment Authority
                </div>
                {[
                  { label: 'Per transaction', value: '₹5,000' },
                  { label: 'Daily cap', value: '₹25,000' },
                  { label: 'Spent today', value: '₹11,400' },
                  { label: 'Remaining', value: '₹13,600', green: true },
                ].map(r => (
                  <div key={r.label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '7px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    fontSize: 13,
                  }}>
                    <span style={{ color: 'var(--on-dark-soft)' }}>{r.label}</span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 500,
                      color: r.green ? '#05b169' : 'var(--on-dark)',
                    }}>
                      {r.value}
                    </span>
                  </div>
                ))}
                <div style={{ marginTop: 16, display: 'flex', gap: 6 }}>
                  <div style={{
                    flex: '0 0 auto',
                    padding: '4px 10px', borderRadius: 100,
                    background: 'rgba(5,177,105,0.12)', color: '#05b169',
                    fontSize: 11, fontWeight: 700,
                  }}>ACTIVE</div>
                  <div style={{
                    flex: '0 0 auto',
                    padding: '4px 10px', borderRadius: 100,
                    background: 'rgba(255,255,255,0.05)', color: 'var(--on-dark-soft)',
                    fontSize: 11, fontWeight: 600,
                  }}>razorpay / upi</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          BAND 2 — WHITE — "How it works" (3-step)
      ═══════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: 'var(--canvas)', padding: '96px 0' }}>
        <div className="container-marketing">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className="badge-section" style={{ marginBottom: 20 }}>How it works</div>
            <h2 className="display-lg" style={{ color: 'var(--ink)', maxWidth: 520, margin: '0 auto 16px' }}>
              Agents that pay. Humans that approve.
            </h2>
            <p style={{ fontSize: 17, color: 'var(--body)', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
              Frame sits between your AI agent and the payment rail. Agents declare intent; Frame evaluates, enforces, and executes.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[
              {
                step: '01',
                title: 'Agent declares intent',
                body: 'The agent sends a structured payment intent — merchant, amount, purpose, and a canonical item hash. No free-form strings.',
                detail: 'POST /v1/payment-intents',
              },
              {
                step: '02',
                title: 'Firewall evaluates',
                body: 'Frame checks authority limits, merchant allowlists, daily budgets, injection signatures, and credential exposure. Decision in under 200ms.',
                detail: 'ALLOW · REQUIRE_APPROVAL · DENY',
              },
              {
                step: '03',
                title: 'Settlement & audit',
                body: 'Approved intents execute against the payment provider. Every settlement posts to a hash-chained double-entry ledger. Evidence receipt available for export.',
                detail: 'SHA-256 chained ledger',
              },
            ].map(card => (
              <div key={card.step} className="feature-card">
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12, fontWeight: 600,
                  color: 'var(--muted-soft)',
                  marginBottom: 20,
                  letterSpacing: '0.04em',
                }}>
                  {card.step}
                </div>
                <h3 className="title-md" style={{ color: 'var(--ink)', marginBottom: 12 }}>{card.title}</h3>
                <p className="body-md" style={{ color: 'var(--body)', marginBottom: 20, lineHeight: 1.6 }}>{card.body}</p>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12, fontWeight: 500,
                  color: 'var(--muted)',
                  padding: '8px 12px',
                  background: 'var(--surface-soft)',
                  borderRadius: 8,
                  display: 'inline-block',
                }}>
                  {card.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          BAND 3 — SOFT GRAY — Feature Grid
      ═══════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: 'var(--surface-soft)', padding: '96px 0' }}>
        <div className="container-marketing">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center', marginBottom: 72 }}>
            <div>
              <div className="badge-section" style={{ marginBottom: 20 }}>Policy Firewall</div>
              <h2 className="display-md" style={{ color: 'var(--ink)', marginBottom: 20 }}>
                Rules that run before money moves.
              </h2>
              <p style={{ fontSize: 17, color: 'var(--body)', lineHeight: 1.7, marginBottom: 32 }}>
                The policy firewall evaluates every intent against per-agent spending authorities — single-transaction ceilings, daily budgets, merchant allowlists, and category scopes — before any provider API is called.
              </p>
              <p style={{ fontSize: 17, color: 'var(--body)', lineHeight: 1.7, marginBottom: 32 }}>
                Payments above a configured threshold pause for human approval. The agent waits. No funds move until a designated operator confirms.
              </p>
              <Link href="/login" className="btn-frame-secondary">
                See the policy model →
              </Link>
            </div>

            {/* Policy rule UI mockup */}
            <div style={{
              background: 'var(--canvas)',
              border: '1px solid var(--hairline)',
              borderRadius: 24,
              padding: 32,
              boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 20, textTransform: 'uppercase' }}>
                Active Authority · Procurement Agent
              </div>

              {[
                { label: 'Per transaction limit', value: '₹5,000', tag: null },
                { label: 'Daily cap', value: '₹25,000', tag: null },
                { label: 'Monthly cap', value: '₹2,00,000', tag: null },
                { label: 'Approval threshold', value: '₹5,000+', tag: 'human review' },
                { label: 'Allowed categories', value: 'office_supplies', tag: null },
                { label: 'Payment rail', value: 'razorpay / upi', tag: null },
              ].map(row => (
                <div key={row.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--hairline-soft)',
                  fontSize: 14,
                }}>
                  <span style={{ color: 'var(--body)' }}>{row.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: 'var(--ink)' }}>
                      {row.value}
                    </span>
                    {row.tag && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                        padding: '2px 8px', borderRadius: 100,
                        background: 'rgba(245,158,11,0.1)', color: '#d97706',
                      }}>
                        {row.tag}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
                <div style={{
                  padding: '5px 12px', borderRadius: 100,
                  background: 'rgba(5,177,105,0.08)', color: '#05b169',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                }}>ACTIVE</div>
                <div style={{
                  padding: '5px 12px', borderRadius: 100,
                  background: 'var(--surface-strong)', color: 'var(--muted)',
                  fontSize: 11, fontWeight: 600,
                }}>
                  Expires Dec 31, 2025
                </div>
              </div>
            </div>
          </div>

          {/* 3-up benefit grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2L3 6v4c0 4.42 2.98 8.56 7 9.93 4.02-1.37 7-5.51 7-9.93V6L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                ),
                title: 'Zero credential capture',
                body: "Frame agents never handle CVVs, passwords, or bank PINs. The agent instructs Frame; Frame instructs the provider. Credentials don't cross the agent boundary.",
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                ),
                title: 'Idempotent by default',
                body: 'Every payment intent carries a canonical idempotency key. Duplicate requests — from retries, crashes, or replayed webhooks — are deduplicated at the database layer.',
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4 8h12M4 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <rect x="2" y="4" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                ),
                title: 'Immutable audit ledger',
                body: 'Every settled transaction appends a SHA-256 hash-chained ledger entry. Operators can export a signed Frame Transaction Evidence Receipt for any payment.',
              },
            ].map(card => (
              <div key={card.title} className="feature-card" style={{ background: 'var(--canvas)' }}>
                <div style={{
                  width: 40, height: 40,
                  background: 'var(--surface-strong)',
                  borderRadius: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--ink)',
                  marginBottom: 20,
                }}>
                  {card.icon}
                </div>
                <h3 className="title-md" style={{ color: 'var(--ink)', marginBottom: 10 }}>{card.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--body)', lineHeight: 1.65 }}>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          BAND 4 — DARK — Approval experience
      ═══════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: 'var(--surface-dark)', color: 'var(--on-dark)', padding: '96px 0', overflow: 'hidden' }}>
        <div className="container-marketing">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>

            {/* Left — Approval UI mockup */}
            <div style={{ position: 'relative' }}>
              <div className="product-card-dark" style={{
                boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 20, paddingBottom: 16,
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--on-dark-soft)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Approval Required
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--on-dark)' }}>₹18,500</div>
                  </div>
                  <div style={{
                    padding: '6px 14px', borderRadius: 100,
                    background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                  }}>
                    PENDING
                  </div>
                </div>

                {[
                  ['Agent', 'Procurement Agent'],
                  ['Merchant', 'OfficeDepot India'],
                  ['Category', 'office_supplies'],
                  ['Purpose', 'Q4 desk accessories'],
                  ['Authority', 'PA_4x8a1b…'],
                  ['Policy exception', 'Above ₹5,000 threshold'],
                ].map(([k, v]) => (
                  <div key={k} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontSize: 13,
                  }}>
                    <span style={{ color: 'var(--on-dark-soft)' }}>{k}</span>
                    <span style={{ color: 'var(--on-dark)', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                  <button className="btn-frame-primary" style={{ flex: 1, justifyContent: 'center', borderRadius: 100 }}>
                    Approve
                  </button>
                  <button className="btn-frame-ghost-dark" style={{ flex: 1, justifyContent: 'center' }}>
                    Reject
                  </button>
                </div>

                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--on-dark-soft)', textAlign: 'center' }}>
                  Expires in 23 min · Approving this exact transaction snapshot
                </div>
              </div>
            </div>

            {/* Right — Copy */}
            <div>
              <div className="badge-section badge-section-dark" style={{ marginBottom: 24 }}>Human-in-the-loop</div>
              <h2 className="display-md" style={{ color: 'var(--on-dark)', marginBottom: 20 }}>
                Agents wait. Humans decide.
              </h2>
              <p style={{ fontSize: 17, color: 'var(--on-dark-soft)', lineHeight: 1.7, marginBottom: 24 }}>
                When a payment exceeds an authority threshold, Frame pauses the agent run and sends an approval request. The agent suspends — no polling, no timeouts — until a designated human confirms or rejects the exact transaction snapshot.
              </p>
              <p style={{ fontSize: 17, color: 'var(--on-dark-soft)', lineHeight: 1.7, marginBottom: 40 }}>
                Approval means: &ldquo;I approve this exact order, this exact amount, this exact merchant.&rdquo; Not a blanket permission.
              </p>
              <Link href="/login" className="btn-frame-elevated-dark">
                See the approval flow →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          BAND 5 — WHITE — MCP / Developer integration
      ═══════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: 'var(--canvas)', padding: '96px 0' }}>
        <div className="container-marketing">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
            {/* Left — Copy */}
            <div>
              <div className="badge-section" style={{ marginBottom: 24 }}>MCP + REST</div>
              <h2 className="display-md" style={{ color: 'var(--ink)', marginBottom: 20 }}>
                Works with any agent runtime.
              </h2>
              <p style={{ fontSize: 17, color: 'var(--body)', lineHeight: 1.7, marginBottom: 24 }}>
                Frame ships a fully-typed MCP server for Claude Desktop, Cursor, and any Model Context Protocol client. Six tools. One connection. No custom integration layer.
              </p>
              <p style={{ fontSize: 17, color: 'var(--body)', lineHeight: 1.7, marginBottom: 40 }}>
                For custom runtimes, every operation is available over a standard authenticated REST API with resource-oriented endpoints and stable error codes.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link href="/login" className="btn-frame-primary">Get your API key</Link>
                <Link href="/dashboard/developers" className="btn-frame-secondary">Read the docs</Link>
              </div>
            </div>

            {/* Right — Code mockup */}
            <div>
              <div style={{
                background: 'var(--surface-dark)',
                borderRadius: 24,
                padding: 32,
                boxShadow: '0 4px 40px rgba(0,0,0,0.12)',
              }}>
                <div style={{
                  display: 'flex', gap: 6, marginBottom: 20,
                  paddingBottom: 16,
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                  {['', '', ''].map((_, i) => (
                    <div key={i} style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: i === 0 ? '#ff5f57' : i === 1 ? '#febc2e' : '#28c840',
                    }} />
                  ))}
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                    claude_desktop_config.json
                  </span>
                </div>
                <pre style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13, lineHeight: 1.7,
                  color: 'rgba(255,255,255,0.8)',
                  margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
{`{
  "mcpServers": {
    "frame": {
      "command": "node",
      "args": ["dist/mcp/server.js"],
      "env": {
        "FRAME_API_KEY": `}<span style={{color:'#05b169'}}>{`"agk_live_..."`}</span>{`,
        "FRAME_BASE_URL": `}<span style={{color:'#05b169'}}>{`"https://api.frame.dev"`}</span>{`
      }
    }
  }
}`}
                </pre>
                <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['frame_create_payment_intent', 'frame_get_payment_authority', 'frame_request_approval', 'frame_get_payment_status'].map(tool => (
                    <span key={tool} style={{
                      fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                      color: 'rgba(255,255,255,0.4)',
                      padding: '3px 8px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: 6,
                    }}>
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          BAND 6 — SOFT GRAY — Trust & Security
      ═══════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: 'var(--surface-soft)', padding: '96px 0' }}>
        <div className="container-marketing">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className="badge-section" style={{ marginBottom: 20 }}>Security model</div>
            <h2 className="display-lg" style={{ color: 'var(--ink)', maxWidth: 560, margin: '0 auto 16px' }}>
              Designed to fail closed.
            </h2>
            <p style={{ fontSize: 17, color: 'var(--body)', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
              Frame&apos;s default posture is deny. Every gap in authority, policy, or provider response results in a blocked payment — never a silent pass.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, maxWidth: 800, margin: '0 auto' }}>
            {[
              {
                title: 'Prompt injection quarantine',
                body: 'Merchant page content is scanned for HTML injection patterns before any data reaches the agent context.',
              },
              {
                title: 'SSRF protection',
                body: 'Domain policy blocks requests to private IP ranges, cloud metadata endpoints, and internal subnets. Merchant URLs are validated before any HTTP call.',
              },
              {
                title: 'Agent self-approval prohibition',
                body: 'Agents cannot approve their own payment intents. Approval authority requires a separate human identity with an explicit operator role.',
              },
              {
                title: 'Sandbox isolation',
                body: "Live credentials (rzp_live_*) are rejected at the adapter boundary in sandbox mode. Sandbox operations are cryptographically separated from any production data.",
              },
              {
                title: 'Webhook HMAC verification',
                body: 'All incoming provider webhooks are verified with HMAC-SHA256 against the configured secret before any payment state is updated.',
              },
              {
                title: 'Checkout change detection',
                body: 'The canonical checkout snapshot is hashed at intent creation. If the merchant cart changes between authorization and settlement, Frame blocks execution.',
              },
            ].map(card => (
              <div key={card.title} className="feature-card" style={{ background: 'var(--canvas)' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 20, height: 20,
                    borderRadius: '50%',
                    background: 'rgba(5,177,105,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 2,
                    fontSize: 12, fontWeight: 700, color: '#05b169',
                  }}>✓</div>
                  <div>
                    <h3 className="title-sm" style={{ color: 'var(--ink)', marginBottom: 8 }}>{card.title}</h3>
                    <p style={{ fontSize: 14, color: 'var(--body)', lineHeight: 1.65 }}>{card.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          BAND 7 — DARK — CTA band (pre-footer)
      ═══════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: 'var(--surface-dark)', color: 'var(--on-dark)', padding: '96px 0', textAlign: 'center' }}>
        <div className="container-marketing">
          <h2 className="display-md" style={{ color: 'var(--on-dark)', maxWidth: 600, margin: '0 auto 20px' }}>
            Your agents. Your policy. Zero surprises.
          </h2>
          <p style={{ fontSize: 17, color: 'var(--on-dark-soft)', maxWidth: 480, margin: '0 auto 48px', lineHeight: 1.6 }}>
            Deploy Frame in sandbox today. First payment intent in under 15 minutes.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" className="btn-frame-primary btn-frame-primary-lg">
              Create free account
            </Link>
            <Link href="/dashboard/developers" className="btn-frame-ghost-dark btn-frame-primary-lg">
              View API reference
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER — White canvas, 5-column
      ═══════════════════════════════════════════════════════════════════════ */}
      <footer style={{ background: 'var(--canvas)', borderTop: '1px solid var(--hairline)', padding: '64px 0 40px' }}>
        <div className="container-marketing">
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 32, marginBottom: 48 }}>
            {/* Brand col */}
            <div>
              <div style={{ marginBottom: 16 }}>
                <FrameLogo size={24} textClassName="text-[15px] font-semibold text-[#0a0b0d]" />
              </div>
              <p style={{ fontSize: 14, color: 'var(--body)', lineHeight: 1.65, maxWidth: 240 }}>
                Financial control plane for autonomous AI agents.
              </p>
            </div>

            {/* Link cols */}
            {[
              {
                heading: 'Product',
                links: ['Overview', 'Policy Firewall', 'Approvals', 'Audit Log', 'Providers'],
              },
              {
                heading: 'Developers',
                links: ['API Reference', 'MCP Server', 'SDKs', 'Changelog', 'Status'],
              },
              {
                heading: 'Company',
                links: ['About', 'Blog', 'Careers', 'Contact'],
              },
              {
                heading: 'Legal',
                links: ['Privacy', 'Terms', 'Security', 'Sandbox policy'],
              },
            ].map(col => (
              <div key={col.heading}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 16, textTransform: 'uppercase' }}>
                  {col.heading}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {col.links.map(l => (
                    <li key={l}>
                      <a href="#" style={{ fontSize: 14, color: 'var(--body)', textDecoration: 'none', transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--body)')}
                      >
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Legal strip */}
          <div style={{
            borderTop: '1px solid var(--hairline-soft)',
            paddingTop: 24,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 12,
          }}>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              © 2025 Frame. Sandbox environment — no real money.
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              Built for the AI-first payment infrastructure era.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
