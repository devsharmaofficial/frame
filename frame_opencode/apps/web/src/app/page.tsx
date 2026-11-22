"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getToken } from "@/lib/api";
import { IconArrowRight } from "@/components/icons";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    if (getToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <div className="landing">
      <div className="landing-brand">
        <div className="landing-brand-mark">F</div>
        <div className="landing-brand-name">Frame</div>
      </div>

      <h1 className="landing-tagline">
        Give agents <em>budgets</em>, not bank accounts.
      </h1>

      <p className="landing-sub">
        Payment infrastructure for AI agents. A deterministic policy firewall decides
        every payment before a single rupee moves.
      </p>

      <div className="landing-status-line">
        <span className="landing-status-dot" />
        <span>firewall</span>
        <span>·</span>
        <span>policies</span>
        <span>·</span>
        <span>audit</span>
        <span>·</span>
        <span>sandbox</span>
      </div>

      <div className="landing-pipeline" aria-hidden>
        <span className="step">Create</span>
        <span className="arrow">→</span>
        <span className="step">Authorize</span>
        <span className="arrow">→</span>
        <span className="step">Request</span>
        <span className="arrow">→</span>
        <span className="step">Decide</span>
        <span className="arrow">→</span>
        <span className="step">Execute</span>
        <span className="arrow">→</span>
        <span className="step">Audit</span>
      </div>

      <div className="landing-ctas">
        <Link href="/onboarding" className="btn btn-primary">
          Get started
          <IconArrowRight style={{ width: 14, height: 14 }} />
        </Link>
        <Link href="/signin" className="btn">
          Sign in
        </Link>
      </div>
    </div>
  );
}