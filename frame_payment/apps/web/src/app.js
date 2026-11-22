import "./styles.css";

const API_BASE = "http://127.0.0.1:3000";
const API_KEY = "dev-framer-key-please-change";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || "API request failed");
  }
  return payload.data;
}

const navItems = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "agents", label: "Agents", icon: "bot", count: "3" },
  { id: "policies", label: "Policies", icon: "sliders" },
  { id: "payments", label: "Payments", icon: "arrow" },
  { id: "approvals", label: "Approvals", icon: "check", count: "2", alert: true },
  { id: "audit", label: "Audit log", icon: "clock" },
];

const payments = [
  { agent: "DevOps Agent", initials: "DA", merchant: "AWS", purpose: "Production infrastructure", amount: "₹2,400", status: "ALLOW", time: "2 min ago", tone: "allow" },
  { agent: "Procurement Agent", initials: "PA", merchant: "Notion", purpose: "Team workspace renewal", amount: "₹1,800", status: "REQUIRE_APPROVAL", time: "18 min ago", tone: "approval" },
  { agent: "Marketing Agent", initials: "MA", merchant: "Nike", purpose: "Campaign merchandise", amount: "₹6,200", status: "DENY", time: "42 min ago", tone: "deny" },
  { agent: "DevOps Agent", initials: "DA", merchant: "Cloudflare", purpose: "Edge services", amount: "₹980", status: "ALLOW", time: "1 hr ago", tone: "allow" },
];

const approvals = [
  { id: "PI-2048", agent: "Procurement Agent", merchant: "Vendor XYZ", purpose: "Replacement server", amount: "₹18,500", reason: "Amount exceeds ₹10,000 transaction limit", policy: "Infrastructure procurement v4", initials: "PA" },
  { id: "PI-2046", agent: "Support Agent", merchant: "Intercom", purpose: "Annual seat renewal", amount: "₹12,200", reason: "New merchant requires a human review", policy: "SaaS operations v2", initials: "SA" },
];

const icons = {
  grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  bot: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M8 13h.01M16 13h.01M9 17h6"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8M10 21h4"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.8 8.3 7 10 4.2-1.7 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
};

const icon = (name) => icons[name] || "";
const statusBadge = (status, tone) => `<span class="status status-${tone}"><span class="status-dot"></span>${status}</span>`;
const avatar = (initials, extra = "") => `<span class="avatar ${extra}">${initials}</span>`;

function renderLayout(active = "overview") {
  document.querySelector("#app").innerHTML = `
    <div class="shell">
      <aside class="sidebar" aria-label="Primary navigation">
        <div class="brand"><span class="brand-mark" aria-hidden="true"><i></i><b></b></span><span>Framer</span></div>
        <div class="workspace-switcher" role="button" tabindex="0" aria-label="Current workspace: Acme Labs">
          <span class="workspace-avatar">A</span><span class="workspace-copy"><strong>Acme Labs</strong><small>Workspace</small></span>${icon("chevron")}
        </div>
        <nav class="nav-list">
          <p class="nav-label">Control plane</p>
          ${navItems.map(item => `<button class="nav-item ${active === item.id ? "active" : ""}" data-page="${item.id}" aria-current="${active === item.id ? "page" : "false"}">${icon(item.icon)}<span>${item.label}</span>${item.count ? `<em class="${item.alert ? "nav-alert" : ""}">${item.count}</em>` : ""}</button>`).join("")}
        </nav>
        <div class="sidebar-bottom">
          <div class="sandbox-note"><span class="sandbox-dot"></span><div><strong>Sandbox mode</strong><small>Payments are simulated</small></div></div>
          <button class="nav-item"><span class="help-icon">?</span><span>Documentation</span></button>
          <div class="user-row">${avatar("RS", "user-avatar")}<span><strong>Riya Sharma</strong><small>Admin</small></span><button class="more-button" aria-label="User menu">•••</button></div>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <button class="mobile-menu" aria-label="Open navigation">☰</button>
          <div class="breadcrumb"><span>Workspace</span><b>/</b><strong>${navItems.find(item => item.id === active)?.label || "Overview"}</strong></div>
          <div class="top-actions"><button class="icon-button" aria-label="Search">${icon("search")}</button><button class="icon-button notification" aria-label="Notifications">${icon("bell")}<i></i></button><div class="top-avatar">RS</div></div>
        </header>
        <div class="page-content">${pageContent(active)}</div>
      </main>
    </div>
  `;
  bindEvents();
}

function pageHeader(eyebrow, title, description, action = "") {
  return `<div class="page-header"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="page-description">${description}</p></div>${action}</div>`;
}

function pageContent(active) {
  if (active === "overview") return overviewPage();
  if (active === "agents") return simpleTablePage("Agents", "Manage identities, access, and lifecycle for autonomous workers.", "Create agent", agentsTable());
  if (active === "policies") return simpleTablePage("Policies", "Deterministic rules that keep every payment within bounds.", "New policy", policiesTable());
  if (active === "payments") return simpleTablePage("Payments", "Every intent, decision, and provider state in one place.", "Create payment intent", paymentsTable());
  if (active === "approvals") return approvalsPage();
  return auditPage();
}

function overviewPage() {
  return `
    ${pageHeader("OVERVIEW", "Good morning, Riya", "Here’s what your agents are doing with money today.", '<button class="button button-dark" data-action="create-agent">'+icon("plus")+' Create agent</button>')}
    <div class="demo-banner"><div class="banner-icon">${icon("shield")}</div><div><strong>Sandbox environment</strong><span>All payment activity is simulated. No real funds will move.</span></div><button class="banner-link">Learn about sandbox →</button></div>
    <section class="metric-grid" aria-label="Key metrics">
      <article class="metric-card"><div class="metric-top"><span>Total agent spend</span><span class="metric-icon">₹</span></div><strong>₹84,260</strong><small><span class="trend-up">↗ 12.4%</span> vs last month</small></article>
      <article class="metric-card"><div class="metric-top"><span>Today's spend</span><span class="metric-icon">◷</span></div><strong>₹4,380</strong><small><span class="trend-up">↗ 8.2%</span> vs yesterday</small></article>
      <article class="metric-card"><div class="metric-top"><span>Active agents</span><span class="metric-icon">✦</span></div><strong>3 <small class="inline-muted">/ 5</small></strong><small><span class="neutral-dot"></span> 2 in sandbox</small></article>
      <article class="metric-card"><div class="metric-top"><span>Approval queue</span><span class="metric-icon">!</span></div><strong>2</strong><small><span class="attention-text">Needs your review</span></small></article>
    </section>
    <div class="content-grid">
      <section class="panel activity-panel"><div class="panel-heading"><div><p class="eyebrow">LIVE ACTIVITY</p><h2>Recent payments</h2></div><button class="text-button" data-page="payments">View all ${icon("arrow")}</button></div><div class="payment-list">${payments.map(paymentRow).join("")}</div></section>
      <section class="panel firewall-panel"><div class="panel-heading"><div><p class="eyebrow">POLICY FIREWALL</p><h2>Decision health</h2></div><button class="icon-button" aria-label="More options">•••</button></div><div class="health-score"><div class="score-ring"><strong>98<span>%</span></strong><small>healthy</small></div><div><p>Decision accuracy</p><strong>All systems operational</strong><small>Last evaluated just now</small></div></div><div class="decision-bars"><div><span><i class="bar-dot allow"></i>Allowed</span><strong>72 <small>76%</small></strong></div><div class="bar-track"><i style="width:76%"></i></div><div><span><i class="bar-dot approval"></i>Needs approval</span><strong>18 <small>19%</small></strong></div><div class="bar-track amber"><i style="width:19%"></i></div><div><span><i class="bar-dot deny"></i>Blocked</span><strong>5 <small>5%</small></strong></div><div class="bar-track red"><i style="width:5%"></i></div></div></section>
    </div>
    <section class="panel approvals-preview"><div class="panel-heading"><div><p class="eyebrow">ACTION REQUIRED</p><h2>Pending approvals <span class="count-pill">2</span></h2></div><button class="text-button" data-page="approvals">Review queue ${icon("arrow")}</button></div><div class="approval-cards">${approvals.map(approvalCard).join("")}</div></section>
  `;
}

function paymentRow(item) {
  return `<div class="payment-row">${avatar(item.initials)}<div class="payment-main"><strong>${item.merchant}</strong><span>${item.agent} · ${item.purpose}</span></div><div class="payment-amount"><strong>${item.amount}</strong><span>${item.time}</span></div>${statusBadge(item.status, item.tone)}</div>`;
}

function approvalCard(item) {
  return `<article class="approval-card"><div class="approval-card-top">${avatar(item.initials)}<div><strong>${item.agent}</strong><span>${item.id} · ${item.merchant}</span></div>${statusBadge("REQUIRE_APPROVAL", "approval")}</div><div class="approval-details"><div><span>Purpose</span><strong>${item.purpose}</strong></div><div><span>Amount</span><strong class="approval-amount">${item.amount}</strong></div></div><div class="approval-reason">${icon("shield")}<span>${item.reason}</span></div><div class="approval-card-bottom"><span>Policy: <strong>${item.policy}</strong></span><div><button class="button button-light reject-button" data-approval="${item.id}" data-decision="rejected">Reject</button><button class="button button-dark approve-button" data-approval="${item.id}" data-decision="approved">Approve</button></div></div></article>`;
}

function simpleTablePage(title, description, action, table) {
  const actionType = title === "Policies" ? "create-policy" : title === "Payments" ? "create-payment" : "create-agent";
  return `${pageHeader(title.toUpperCase(), title, description, `<button class="button button-dark" data-action="${actionType}">${icon("plus")} ${action}</button>`)}<div class="filter-row"><div class="search-field">${icon("search")}<input aria-label="Search ${title}" placeholder="Search ${title.toLowerCase()}..." /></div><button class="filter-button">All statuses ${icon("chevron")}</button><button class="filter-button">Last 30 days ${icon("chevron")}</button></div><section class="panel table-panel">${table}</section>`;
}

function agentsTable() {
  const agents = [["DA", "DevOps Agent", "Production infrastructure", "Riya Sharma", "Active", "₹50,000 / mo"], ["PA", "Procurement Agent", "Approved business purchases", "Aarav Mehta", "Active", "₹25,000 / mo"], ["MA", "Marketing Agent", "Campaign operations", "Riya Sharma", "Paused", "₹15,000 / mo"]];
  return `<div class="table-heading"><div><h2>All agents</h2><span>3 identities in Acme Labs</span></div><span class="table-count">3 total</span></div><div class="data-table"><div class="table-row table-head"><span>Agent</span><span>Owner</span><span>Status</span><span>Monthly budget</span><span></span></div>${agents.map(a => `<div class="table-row"><span class="agent-cell">${avatar(a[0])}<strong>${a[1]}<small>${a[2]}</small></strong></span><span>${a[3]}</span><span><span class="status ${a[4] === "Active" ? "status-allow" : "status-paused"}"><span class="status-dot"></span>${a[4]}</span></span><span>${a[5]}</span><button class="more-button" aria-label="Actions for ${a[1]}">•••</button></div>`).join("")}</div>`;
}

function policiesTable() {
  const policies = [["Cloud Infrastructure", "DevOps Agent", "v3", "₹10,000", "Active", "2 min ago"], ["SaaS Operations", "Support Agent", "v2", "₹25,000", "Active", "Yesterday"], ["Marketing Spend", "Marketing Agent", "v1", "₹5,000", "Draft", "3 days ago"]];
  return `<div class="table-heading"><div><h2>Policy library</h2><span>Immutable versions protect every decision</span></div><span class="table-count">3 policies</span></div><div class="data-table"><div class="table-row table-head"><span>Policy</span><span>Attached to</span><span>Version</span><span>Txn. limit</span><span>Status</span></div>${policies.map(p => `<div class="table-row"><span class="agent-cell"><span class="policy-icon">${icon("sliders")}</span><strong>${p[0]}<small>Updated ${p[5]}</small></strong></span><span>${p[1]}</span><span class="mono">${p[2]}</span><span>${p[3]}</span><span class="status ${p[4] === "Active" ? "status-allow" : "status-paused"}"><span class="status-dot"></span>${p[4]}</span></div>`).join("")}</div>`;
}

function paymentsTable() {
  return `<div class="table-heading"><div><h2>Payment intents</h2><span>Normalized activity across your agents</span></div><span class="table-count">99 intents</span></div><div class="data-table"><div class="table-row table-head"><span>Intent</span><span>Agent</span><span>Amount</span><span>Decision</span><span>Created</span></div>${payments.concat([{agent:"Support Agent", initials:"SA", merchant:"Intercom", purpose:"Seat renewal", amount:"₹12,200", status:"REQUIRE_APPROVAL", tone:"approval", time:"Yesterday"}]).map((p, i) => `<div class="table-row"><span class="agent-cell"><span class="payment-symbol">↗</span><strong>${p.merchant}<small>PI-${2049-i} · ${p.purpose}</small></strong></span><span>${p.agent}</span><span>${p.amount}</span><span>${statusBadge(p.status,p.tone)}</span><span>${p.time}</span></div>`).join("")}</div>`;
}

function approvalsPage() {
  return `${pageHeader("APPROVALS", "Approval queue", "Review payment intents that need a human decision before they can execute.", '<span class="queue-status"><i></i> 2 waiting for review</span>')}<div class="approval-layout"><section><div class="section-label">NEEDS YOUR DECISION <span>2</span></div>${approvals.map(approvalCard).join("")}</section><aside class="panel approval-guide"><div class="guide-icon">${icon("shield")}</div><h2>Approve with context</h2><p>Framer checks the approver’s role, payment hash, policy version, and expiry before allowing a decision.</p><div class="guide-rule"><span>✓</span><div><strong>Deterministic by default</strong><small>Every approval is recorded in the audit log.</small></div></div><div class="guide-rule"><span>◷</span><div><strong>Expires in 22 hours</strong><small>Expired intents cannot be approved.</small></div></div></aside></div>`;
}

function auditPage() {
  const events = [["14:24:08", "Payment confirmed", "AWS · ₹2,400", "DevOps Agent", "allow"], ["14:23:14", "Policy evaluated", "Decision: REQUIRE_APPROVAL", "Procurement Agent", "approval"], ["14:23:14", "Payment intent created", "PI-2048 · Vendor XYZ", "Procurement Agent", "neutral"], ["14:18:32", "Agent policy updated", "Cloud Infrastructure v3", "Riya Sharma", "neutral"], ["13:51:07", "Payment blocked", "Nike · ₹6,200", "Marketing Agent", "deny"], ["12:06:44", "Agent created", "Support Agent", "Riya Sharma", "neutral"]];
  return `${pageHeader("AUDIT LOG", "Audit trail", "A tamper-evident record of every identity, policy, and payment decision.", '<button class="button button-light">Export log ↓</button>')}<div class="audit-toolbar"><span class="audit-integrity"><i>✓</i> Integrity verified <small>Last checked just now</small></span><div class="filter-row"><button class="filter-button">All events ${icon("chevron")}</button><button class="filter-button">Last 24 hours ${icon("chevron")}</button></div></div><section class="panel audit-panel"><div class="audit-head"><span>EVENT</span><span>ACTOR</span><span>REQUEST ID</span><span>TIMESTAMP</span></div>${events.map((e,i)=>`<div class="audit-row"><span class="audit-event"><i class="timeline-dot ${e[4]}"></i><strong>${e[1]}<small>${e[2]}</small></strong></span><span>${e[3]}</span><span class="mono">req_8f${i}2a9c</span><span>${e[0]}<small>Today</small></span></div>`).join("")}</section>`;
}

function bindEvents() {
  document.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => renderLayout(button.dataset.page)));
  document.querySelectorAll(".approve-button, .reject-button").forEach(button => button.addEventListener("click", async () => {
    const card = button.closest(".approval-card");
    const approved = button.dataset.decision === "approved";
    try {
      await apiRequest(`/api/v1/approvals/${button.dataset.approval}/${approved ? "approve" : "reject"}`, { method: "POST" });
      card.classList.add("is-resolved");
      card.innerHTML = `<div class="resolved-state"><span class="resolved-icon">${approved ? "✓" : "×"}</span><div><strong>Payment ${approved ? "approved" : "rejected"}</strong><span>${button.dataset.approval} has been ${approved ? "authorized for execution" : "blocked"} in sandbox.</span></div></div>`;
    } catch (error) {
      showToast(error.message);
    }
  }));
  document.querySelectorAll("[data-action='create-agent']").forEach(button => button.addEventListener("click", async () => {
    const name = window.prompt("Agent name");
    if (!name?.trim()) return;
    try {
      const agent = await apiRequest("/api/v1/agents", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      await apiRequest("/api/v1/policies", { method: "POST", body: JSON.stringify({ agentId: agent.id, transactionLimitMinor: 100000, approvalThresholdMinor: 50000 }) });
      showToast(`${agent.name} created with a default sandbox policy.`);
    } catch (error) {
      showToast(error.message);
    }
  }));
  document.querySelectorAll("[data-action='create-policy']").forEach(button => button.addEventListener("click", async () => {
    const agentId = window.prompt("Agent ID to attach this policy to");
    const limit = Number(window.prompt("Transaction limit in minor units", "100000"));
    if (!agentId?.trim() || !Number.isSafeInteger(limit) || limit <= 0) return;
    try {
      await apiRequest("/api/v1/policies", { method: "POST", body: JSON.stringify({ agentId: agentId.trim(), transactionLimitMinor: limit }) });
      showToast("Policy published.");
    } catch (error) {
      showToast(error.message);
    }
  }));
  document.querySelector(".mobile-menu")?.addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("open"));
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 2800);
}

renderLayout();
