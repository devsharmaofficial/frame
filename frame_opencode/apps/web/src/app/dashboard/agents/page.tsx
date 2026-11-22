"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type Agent, type AgentCreateResult } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { StatusBadge, statusTone } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Amount } from "@/components/Amount";
import { toast } from "@/components/Toast";
import { IconCopy } from "@/components/icons";
import { copyToClipboard, formatDateTime, shortId } from "@/lib/utils";

const ENVIRONMENTS = ["sandbox", "staging", "production"];

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdCred, setCreatedCred] = useState<{ agent: Agent; credential: { key: string } } | null>(null);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [environment, setEnvironment] = useState("sandbox");
  const [purpose, setPurpose] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    api
      .get<Agent[]>("/agents")
      .then(setAgents)
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load agents");
        setAgents([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await api.post<AgentCreateResult>("/agents", {
        name,
        description: description || undefined,
        owner: owner || undefined,
        environment: environment || "sandbox",
        purpose: purpose || undefined,
      });
      setCreatedCred({ agent: res.agent, credential: res.credential });
      setShowNew(false);
      setCopied(false);
      resetForm();
      toast.success("Agent created", `${res.agent.name} is ready for a policy.`);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create the agent.");
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
    setOwner("");
    setEnvironment("sandbox");
    setPurpose("");
  }

  async function handleCopy() {
    if (!createdCred) return;
    const ok = await copyToClipboard(createdCred.credential.key);
    if (ok) {
      setCopied(true);
      toast.success("Copied", "The credential has been copied to your clipboard.");
    } else {
      toast.error("Copy failed", "Please copy the key manually.");
    }
  }

  function spendOf(agent: Agent): number | null {
    const spend = (agent as unknown as { spendPaise?: number | string }).spendPaise;
    return spend != null ? Number(spend) : null;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Agents</h1>
          <p className="page-subtitle">
            AI agents that hold spend authority in your organization.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          New Agent
        </button>
      </div>

      {loadError ? (
        <EmptyState
          icon="!"
          title="Unable to load agents"
          body={loadError}
          action={<button className="btn" onClick={load}>Retry</button>}
        />
      ) : loading ? (
        <div className="skeleton" style={{ height: 220 }} />
      ) : agents.length === 0 ? (
        <EmptyState
          title="No agents yet"
          body="Create your first agent to issue a spend credential and attach a policy."
          action={
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>
              New Agent
            </button>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Environment</th>
                <th>Purpose</th>
                <th>Status</th>
                <th className="num">Spend</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                const spend = spendOf(agent);
                return (
                  <tr key={agent.id}>
                    <td>
                      <Link href={`/dashboard/agents/${agent.id}`} className="row-title">
                        {agent.name}
                      </Link>
                      <div className="row-sub mono-cell">
                        {shortId(agent.id)} · {agent.owner || agent.environment}
                      </div>
                    </td>
                    <td>
                      <StatusBadge
                        status={agent.environment}
                        label={agent.environment}
                        className={agent.environment === "production" ? "blocked" : agent.environment === "staging" ? "pending" : "neutral"}
                      />
                    </td>
                    <td>{agent.purpose || <span className="faint">—</span>}</td>
                    <td>
                      <StatusBadge status={agent.status} className={statusTone(agent.status)} />
                    </td>
                    <td className="num">
                      {spend != null ? <Amount paise={spend} compact /> : <span className="faint">—</span>}
                    </td>
                    <td className="mono-cell faint">{formatDateTime(agent.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showNew}
        title="New Agent"
        onClose={() => setShowNew(false)}
        footer={
          <>
            <button className="btn" onClick={() => setShowNew(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" form="new-agent-form" type="submit" disabled={creating || !name.trim()}>
              {creating ? <span className="spinner" /> : null} Create agent
            </button>
          </>
        }
      >
        {formError ? (
          <div className="form-error" role="alert">
            {formError}
          </div>
        ) : null}
        <form id="new-agent-form" onSubmit={handleCreate}>
          <div className="field">
            <label className="field-label" htmlFor="agent-name">
              Name
            </label>
            <input
              id="agent-name"
              className="input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Procurement-Agent"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="agent-description">
              Description
            </label>
            <textarea
              id="agent-description"
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this agent is responsible for"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="agent-owner">
              Owner / team
            </label>
            <input
              id="agent-owner"
              className="input"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Finance Ops"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="agent-env">
              Environment
            </label>
            <select
              id="agent-env"
              className="select"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
            >
              {ENVIRONMENTS.map((env) => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="agent-purpose">
              Purpose
            </label>
            <input
              id="agent-purpose"
              className="input"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Buy cloud compute / SaaS subscriptions"
            />
          </div>
          <div className="banner info" style={{ marginTop: 6 }}>
            A credential key is generated after creation. It is shown only once — copy it now.
          </div>
        </form>
      </Modal>

      <Modal
        open={createdCred !== null}
        title="Credential generated"
        onClose={() => setCreatedCred(null)}
        footer={
          <button className="btn btn-primary" onClick={() => setCreatedCred(null)}>
            Done
          </button>
        }
      >
        <div className="banner warn" role="alert" style={{ marginBottom: 14 }}>
          Show once — this key will never be displayed again. Store it in a secret manager.
        </div>
        <div className="key-box">
          <div className="key-box-label">API key for {createdCred?.agent.name}</div>
          <div className="key-box-value" data-testid="agent-credential">
            {createdCred?.credential.key}
          </div>
          <div style={{ display: "flex", gap: 8 }} className="mono">
            <button className="btn btn-sm" onClick={handleCopy}>
              <IconCopy style={{ width: 13, height: 13 }} />
              {copied ? "Copied" : "Copy key"}
            </button>
            <span className="num" style={{ fontSize: 12, alignSelf: "center", color: "var(--text-muted)" }}>
              key prefix: {createdCred?.credential.key.split("_")[1] ?? createdCred?.credential.key.slice(0, 12)}
            </span>
          </div>
        </div>
        {createdCred?.agent && (
          <div style={{ marginTop: 14, fontSize: 13 }} className="muted">
            Next step:{" "}
            <Link href={`/dashboard/policies`} onClick={() => setCreatedCred(null)}>
              attach a policy
            </Link>{" "}
            so this agent can spend within limits.
          </div>
        )}
      </Modal>
    </div>
  );
}