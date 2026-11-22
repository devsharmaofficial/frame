"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type User } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";

interface OrgInfo {
  id: string;
  name: string;
  slug?: string;
  status?: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<{ user: User }>("/auth/me")
      .then((res) => setUser(res.user))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : ""));
    api
      .get<OrgInfo>("/organizations/me")
      .then(setOrg)
      .catch(() => {
        const cached = window.localStorage.getItem("frame_org");
        if (cached) {
          try {
            setOrg(JSON.parse(cached));
          } catch {
            setOrg(null);
          }
        } else {
          setOrg(null);
        }
      });
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Organization identity, webhook configuration, and environment.</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Organization</h2>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <span className="muted">Name</span>
                <span className="row-title">{org?.name ?? "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <span className="muted">Slug</span>
                <span className="mono">{org?.slug ?? "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <span className="muted">Signed in as</span>
                <span className="mono-cell">
                  {user?.name} · {user?.email}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <span className="muted">Role</span>
                <span className="mono">{user?.role ?? "—"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Webhook</h2>
          </div>
          <div className="card-body">
            <div className="mono" style={{ fontSize: 14 }}>
              whsec_••••••••••••••••
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
              The webhook signing secret is used to verify provider events. It is only shown at
              creation time; rotate it in production.
            </p>
            <hr className="divider" />
            <div className="muted" style={{ fontSize: 12.5 }}>
              Endpoint format: <span className="mono">POST /api/v1/webhooks/{org?.slug ?? "org"}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Environment</h2>
          </div>
          <div className="card-body">
            <div className="banner info" style={{ marginBottom: 12 }}>
              Sandbox only in this MVP. Payments execute against the sandbox provider and never move real funds.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="tag">sandbox</span>
              <span className="tag">simulated provider</span>
              <span className="tag">no external cards</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Security</h2>
          </div>
          <div className="card-body">
            {error ? (
              <EmptyState icon="!" title="Details unavailable" body={error} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <span className="muted">Session duration</span>
                  <span className="mono">7 days</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <span className="muted">Auth</span>
                  <span className="mono">JWT bearer</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <span className="muted">Approvals required for</span>
                  <span className="mono">amounts above threshold</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}