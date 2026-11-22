"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError, setToken, getToken } from "@/lib/api";
import { useEffect } from "react";

export default function SigninPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: { id: string; name: string; email: string; role: string } }>(
        "/auth/login",
        { email, password },
      );
      setToken(res.token);
      window.localStorage.setItem("frame_user", JSON.stringify(res.user));
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div className="sidebar-brand-mark">F</div>
          <div>
            <div style={{ fontWeight: 700 }}>Frame</div>
            <div className="faint" style={{ fontSize: 11.5 }}>
              Payment infrastructure for AI agents
            </div>
          </div>
        </div>

        <h2 className="auth-heading">Sign in</h2>
        <p className="auth-sub">Access the agent payment control console.</p>

        {error ? (
          <div className="form-error" role="alert">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={loading || !email || !password}>
              {loading ? <span className="spinner" /> : null}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>

        <p className="auth-foot">
          New to Frame?{" "}
          <Link href="/onboarding">Create an organization</Link>
        </p>
      </div>
    </div>
  );
}