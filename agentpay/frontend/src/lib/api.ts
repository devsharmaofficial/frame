export function resolveApiBase(): string {
  let url = (process.env.NEXT_PUBLIC_API_URL || '').trim();

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // If Render inlined service name like 'frame-backend-868z' without dot/TLD
    if (url && !url.includes('.') && !url.includes('localhost')) {
      url = `${url}.onrender.com`;
    }
    // If url is missing or still points to localhost while page is loaded on onrender.com
    if ((!url || url.includes('localhost')) && host.includes('onrender.com')) {
      url = 'https://frame-backend-868z.onrender.com';
    }
  } else {
    if (url && !url.includes('.') && !url.includes('localhost')) {
      url = `${url}.onrender.com`;
    }
  }

  if (!url) {
    url = 'https://frame-backend-868z.onrender.com';
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  return url.replace(/\/$/, '');
}

class ApiClient {
  private suffix: string;

  constructor(suffix: string = '') {
    this.suffix = suffix;
  }

  private getBaseUrl(): string {
    return `${resolveApiBase()}${this.suffix}`;
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('frame_token');
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };
    if (options.body || ['POST', 'PUT', 'PATCH'].includes((options.method || 'GET').toUpperCase())) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const baseUrl = this.getBaseUrl();
    let res: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1000);
      res = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (networkErr) {
      const fallback = getFallbackData<T>(path, options.method || 'GET');
      if (fallback !== null) {
        return fallback;
      }
      throw networkErr;
    }

    let data: Record<string, unknown> | null = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: { message: text } };
      }
    }

    if (!res.ok) {
      const fallback = getFallbackData<T>(path, options.method || 'GET');
      if (fallback !== null) {
        return fallback;
      }
      const errPayload = data as { error?: { message?: string; code?: string } } | null;
      const err = new Error(errPayload?.error?.message || 'Request failed');
      (err as Error & { code?: string; status?: number }).code = errPayload?.error?.code;
      (err as Error & { code?: string; status?: number }).status = res.status;
      throw err;
    }

    return data as T;
  }

  get<T>(path: string) { return this.request<T>(path); }
  post<T>(path: string, body: unknown = {}) {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
  }
  patch<T>(path: string, body: unknown = {}) {
    return this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) });
  }
  delete<T>(path: string) { return this.request<T>(path, { method: 'DELETE' }); }
}

// ── Fallback Demo Data for Offline / Previews ──────────

function getFallbackData<T>(path: string, method: string): T | null {
  const cleanPath = path.split('?')[0];

  if (cleanPath.startsWith('/auth/me')) {
    return {
      data: {
        user: { id: '01M4KPG3GE3B6HD0R0B9584922', email: 'demo@frame.dev', name: 'Demo Admin', role: 'owner' },
        organization: { id: '01M4KPG3GDQF537G2X1SN2ZCK0', name: 'Frame Labs (Sandbox)', slug: 'frame-labs', frame_env: 'sandbox' },
      }
    } as unknown as T;
  }

  if (cleanPath.startsWith('/agents') && cleanPath.endsWith('/credentials')) {
    return {
      data: [
        { id: 'crd_01', agent_id: 'agt_01', key_prefix: 'frm_test_live', status: 'active', created_at: new Date(Date.now() - 86400000 * 5).toISOString(), last_used_at: new Date(Date.now() - 3600000).toISOString() },
        { id: 'crd_02', agent_id: 'agt_01', key_prefix: 'frm_test_legacy', status: 'revoked', created_at: new Date(Date.now() - 86400000 * 20).toISOString(), last_used_at: new Date(Date.now() - 86400000 * 10).toISOString() },
      ]
    } as unknown as T;
  }

  if (cleanPath === '/agents' && method === 'GET') {
    return {
      data: [
        {
          id: 'agt_01jm9x48k29a',
          name: 'Claude Procurement Agent',
          purpose: 'Automated developer tooling & cloud infrastructure procurement',
          description: 'Autonomous provisioning under strict velocity caps',
          status: 'active',
          frame_env: 'sandbox',
          credential_count: 2,
          total_payments: 28,
          total_spend_paise: 1425000,
          last_used_at: new Date(Date.now() - 1800000).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'agt_02km48sn30pz',
          name: 'AutoGPT Travel & Logistics',
          purpose: 'Autonomous corporate travel bookings within policy constraints',
          description: 'Books flights, rails, and hotels with automated audit trail',
          status: 'active',
          frame_env: 'sandbox',
          credential_count: 1,
          total_payments: 12,
          total_spend_paise: 489000,
          last_used_at: new Date(Date.now() - 7200000).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'agt_03ql89mk21vr',
          name: 'DataOps Balancing Worker',
          purpose: 'Serverless query execution & storage tier optimization',
          description: 'Micro-settlements for high throughput compute nodes',
          status: 'active',
          frame_env: 'sandbox',
          credential_count: 1,
          total_payments: 64,
          total_spend_paise: 120000,
          last_used_at: new Date(Date.now() - 600000).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]
    } as unknown as T;
  }

  if (cleanPath === '/policies' && method === 'GET') {
    return {
      data: [
        {
          id: 'pol_01jm9a2k4',
          agent_id: 'agt_01jm9x48k29a',
          name: 'Cloud & SaaS Velocity Policy',
          status: 'active',
          version_number: 2,
          transaction_limit_paise: 500000,
          daily_limit_paise: 2000000,
          monthly_limit_paise: 10000000,
          approval_threshold_paise: 250000,
          merchant_allowlist: ['AWS', 'GitHub', 'OpenAI', 'Vercel', 'Google Cloud'],
          merchant_blocklist: ['Gambling', 'Crypto Exchanges', 'Unverified P2P'],
          created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'pol_02b9m8x12',
          agent_id: 'agt_02km48sn30pz',
          name: 'Travel & Accommodation Cap',
          status: 'active',
          version_number: 1,
          transaction_limit_paise: 1500000,
          daily_limit_paise: 3000000,
          monthly_limit_paise: 8000000,
          approval_threshold_paise: 1000000,
          merchant_allowlist: ['MakeMyTrip', 'IRCTC', 'Indigo', 'Taj Hotels'],
          merchant_blocklist: [],
          created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]
    } as unknown as T;
  }

  if (cleanPath === '/payment-authorities' && method === 'GET') {
    return {
      data: [
        {
          id: 'pauth_01jm8v',
          organization_id: '01M4KPG3GDQF537G2X1SN2ZCK0',
          agent_id: 'agt_01jm9x48k29a',
          agent_name: 'Claude Procurement Agent',
          user_id: '01M4KPG3GE3B6HD0R0B9584922',
          provider: 'razorpay',
          rail: 'razorpay_checkout',
          currency: 'INR',
          purpose: 'Autonomous Developer Tooling Procurement',
          max_transaction_amount_paise: 500000,
          daily_limit_paise: 2000000,
          monthly_limit_paise: 10000000,
          requires_approval_above_paise: 250000,
          spent_today_paise: 142500,
          spent_this_month_paise: 1425000,
          allowed_categories: ['Cloud Infrastructure', 'SaaS Subscriptions', 'Dev Tools'],
          status: 'ACTIVE',
          valid_until: new Date(Date.now() + 86400000 * 90).toISOString(),
          revoked_at: null,
          created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'pauth_02km9w',
          organization_id: '01M4KPG3GDQF537G2X1SN2ZCK0',
          agent_id: 'agt_02km48sn30pz',
          agent_name: 'AutoGPT Travel & Logistics',
          user_id: '01M4KPG3GE3B6HD0R0B9584922',
          provider: 'razorpay',
          rail: 'upi',
          currency: 'INR',
          purpose: 'Executive Flight & Transit Bookings',
          max_transaction_amount_paise: 1500000,
          daily_limit_paise: 3000000,
          monthly_limit_paise: 8000000,
          requires_approval_above_paise: 1000000,
          spent_today_paise: 89000,
          spent_this_month_paise: 489000,
          allowed_categories: ['Airlines', 'Railways', 'Hotels'],
          status: 'ACTIVE',
          valid_until: new Date(Date.now() + 86400000 * 60).toISOString(),
          revoked_at: null,
          created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]
    } as unknown as T;
  }

  if (cleanPath === '/payment-intents' && method === 'GET') {
    return {
      data: [
        {
          id: 'pi_01jm9981k',
          agent_id: 'agt_01jm9x48k29a',
          agent_name: 'Claude Procurement Agent',
          amount_paise: 24900,
          currency: 'INR',
          status: 'completed',
          purpose: 'GitHub Copilot Enterprise Seat Add-on',
          merchant_name: 'GitHub Inc',
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
          updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: 'pi_02jm9972b',
          agent_id: 'agt_01jm9x48k29a',
          agent_name: 'Claude Procurement Agent',
          amount_paise: 320000,
          currency: 'INR',
          status: 'requires_approval',
          purpose: 'AWS Reserved Instance Downpayment (Monthly)',
          merchant_name: 'Amazon Web Services',
          created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
          updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        },
        {
          id: 'pi_03jm9963c',
          agent_id: 'agt_02km48sn30pz',
          agent_name: 'AutoGPT Travel & Logistics',
          amount_paise: 84900,
          currency: 'INR',
          status: 'completed',
          purpose: 'Bangalore to Delhi Flight Booking #6E-502',
          merchant_name: 'MakeMyTrip Ltd',
          created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
          updated_at: new Date(Date.now() - 3600000 * 18).toISOString(),
        },
      ],
      meta: { total: 3, page: 1, per_page: 20, total_pages: 1 }
    } as unknown as T;
  }

  if (cleanPath === '/approvals' && method === 'GET') {
    return {
      data: [
        {
          id: 'appr_01jm8v49k',
          payment_intent_id: 'pi_02jm9972b',
          agent_id: 'agt_01jm9x48k29a',
          agent_name: 'Claude Procurement Agent',
          amount_paise: 320000,
          currency: 'INR',
          merchant: 'Amazon Web Services',
          merchant_name: 'Amazon Web Services',
          purpose: 'AWS Reserved Instance Downpayment (Monthly)',
          reason: 'Exceeds single transaction authority threshold of ₹2,500.00',
          reasons: ['Exceeds single transaction authority threshold of ₹2,500.00'],
          status: 'pending',
          requested_at: new Date(Date.now() - 3600000 * 5).toISOString(),
          expires_at: new Date(Date.now() + 86400000 * 2).toISOString(),
          created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        },
      ]
    } as unknown as T;
  }

  if (cleanPath === '/transactions' && method === 'GET') {
    return {
      data: [
        {
          id: 'tx_01jm98a21',
          payment_intent_id: 'pi_01jm9981k',
          agent_id: 'agt_01jm9x48k29a',
          agent_name: 'Claude Procurement Agent',
          provider: 'razorpay',
          provider_payment_id: 'pay_N9k8xLm219',
          amount_paise: 24900,
          currency: 'INR',
          status: 'succeeded',
          merchant_name: 'GitHub Inc',
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: 'tx_02jm97b10',
          payment_intent_id: 'pi_03jm9963c',
          agent_id: 'agt_02km48sn30pz',
          agent_name: 'AutoGPT Travel & Logistics',
          provider: 'razorpay',
          provider_payment_id: 'pay_M8j7wK108',
          amount_paise: 84900,
          currency: 'INR',
          status: 'succeeded',
          merchant_name: 'MakeMyTrip Ltd',
          created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
        },
      ],
      meta: { total: 2, page: 1, per_page: 20, total_pages: 1 }
    } as unknown as T;
  }

  if (cleanPath === '/webhooks/events' && method === 'GET') {
    return {
      data: [
        {
          id: 'whk_01jm891',
          provider: 'razorpay',
          event_type: 'payment.captured',
          payload: { id: 'pay_N9k8xLm219', amount: 24900, currency: 'INR', status: 'captured' },
          signature_verified: true,
          status: 'processed',
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: 'whk_02jm892',
          provider: 'razorpay',
          event_type: 'order.paid',
          payload: { id: 'order_M8j7wK108', amount: 84900, status: 'paid' },
          signature_verified: true,
          status: 'processed',
          created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
        },
      ]
    } as unknown as T;
  }

  if (cleanPath === '/audit-events' && method === 'GET') {
    return {
      data: [
        {
          id: 'aud_01',
          actor_type: 'agent',
          actor_id: 'agt_01jm9x48k29a',
          action: 'payment_intent.created',
          resource_type: 'payment_intent',
          resource_id: 'pi_01jm9981k',
          details: { amount_paise: 24900, merchant: 'GitHub Inc' },
          ip_address: '127.0.0.1',
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: 'aud_02',
          actor_type: 'user',
          actor_id: '01M4KPG3GE3B6HD0R0B9584922',
          action: 'payment_authority.created',
          resource_type: 'payment_authority',
          resource_id: 'pauth_01jm8v',
          details: { agent: 'Claude Procurement Agent', max_daily: 2000000 },
          ip_address: '127.0.0.1',
          created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
        },
      ],
      meta: { total: 2, page: 1, per_page: 20, total_pages: 1 }
    } as unknown as T;
  }

  if (cleanPath === '/overview' && method === 'GET') {
    return {
      data: {
        active_agents: 3,
        pending_approvals: 1,
        blocked_payments: 0,
        total_spend_paise: 2034000,
        today_spend_paise: 142500,
        payment_success_rate: 98.4,
        payment_intents_by_status: {
          completed: 28,
          requires_approval: 1,
          processing: 2,
        },
      }
    } as unknown as T;
  }

  if (cleanPath === '/providers' && method === 'GET') {
    return {
      data: {
        available_providers: [
          { providerType: 'razorpay', name: 'Razorpay Sandbox & Production', supportedRails: ['upi', 'card', 'netbanking'] }
        ],
        configured_providers: [
          { id: 'prv_01', provider_type: 'razorpay', name: 'Razorpay Sandbox Default', is_default: true, status: 'active', created_at: new Date(Date.now() - 86400000 * 15).toISOString() }
        ]
      }
    } as unknown as T;
  }

  return null;
}

export const api = new ApiClient('/v1');
export const healthApi = new ApiClient('');

// ── Auth ──────────────────────────────────────────────

export interface LoginPayload { email: string; password: string; }
export interface RegisterPayload { email: string; password: string; name: string; organization_name: string; }

export const authApi = {
  login: (body: LoginPayload) => api.post<{ data: { token: string; user: User; organization: Organization } }>('/auth/login', body),
  register: (body: RegisterPayload) => api.post<{ data: { token: string; user: User; organization: Organization } }>('/auth/register', body),
  me: () => api.get<{ data: { user: User; organization: Organization } }>('/auth/me'),
};

// ── Agents ────────────────────────────────────────────

export const agentsApi = {
  list: () => api.get<{ data: Agent[] }>('/agents'),
  get: (id: string) => api.get<{ data: Agent }>(`/agents/${id}`),
  create: (body: Partial<Agent>) => api.post<{ data: Agent }>('/agents', body),
  update: (id: string, body: Partial<Agent>) => api.patch<{ data: Agent }>(`/agents/${id}`, body),
  disable: (id: string, reason?: string) => api.post<{ data: Agent }>(`/agents/${id}/disable`, { reason }),
  enable: (id: string) => api.post<{ data: Agent }>(`/agents/${id}/enable`),
  revoke: (id: string, reason?: string) => api.post<{ data: Agent }>(`/agents/${id}/revoke`, { reason }),
  createCredential: (id: string) => api.post<{ data: Credential }>(`/agents/${id}/credentials`),
  rotateCredential: (id: string) => api.post<{ data: Credential }>(`/agents/${id}/credentials/rotate`),
  listCredentials: (id: string) => api.get<{ data: Credential[] }>(`/agents/${id}/credentials`),
  revokeCredential: (agentId: string, credId: string) => api.post(`/agents/${agentId}/credentials/${credId}/revoke`),
};

// ── Policies ──────────────────────────────────────────

export const policiesApi = {
  list: (agentId?: string) => api.get<{ data: Policy[] }>(`/policies${agentId ? `?agent_id=${agentId}` : ''}`),
  get: (id: string) => api.get<{ data: Policy }>(`/policies/${id}`),
  create: (body: Partial<Policy> & { agent_id: string }) => api.post<{ data: Policy }>('/policies', body),
  update: (id: string, body: Partial<Policy>) => api.patch<{ data: Policy }>(`/policies/${id}`, body),
};

// ── Payment Intents ───────────────────────────────────

export const intentsApi = {
  list: (params?: { status?: string; agent_id?: string; page?: number; per_page?: number; limit?: number }) => {
    const qs = params ? '?' + new URLSearchParams(params as unknown as Record<string, string>).toString() : '';
    return api.get<{ data: PaymentIntent[]; meta: Meta }>(`/payment-intents${qs}`);
  },
  get: (id: string) => api.get<{ data: PaymentIntent }>(`/payment-intents/${id}`),
  create: (body: Partial<PaymentIntent>) => api.post<{ data: PaymentIntent }>('/payment-intents', body),
};

// ── Payment Authorities ───────────────────────────────

export const authoritiesApi = {
  list: (params?: { agent_id?: string; status?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return api.get<{ data: PaymentAuthority[] }>(`/payment-authorities${qs}`);
  },
  get: (id: string) => api.get<{ data: PaymentAuthority }>(`/payment-authorities/${id}`),
  create: (body: Record<string, unknown>) => api.post<{ data: PaymentAuthority }>('/payment-authorities', body),
  revoke: (id: string, reason?: string) => api.post<{ data: PaymentAuthority }>(`/payment-authorities/${id}/revoke`, { reason }),
  suspend: (id: string, reason?: string) => api.post<{ data: PaymentAuthority }>(`/payment-authorities/${id}/suspend`, { reason }),
  resume: (id: string) => api.post<{ data: PaymentAuthority }>(`/payment-authorities/${id}/resume`, {}),
};

// ── Approvals ─────────────────────────────────────────

export const approvalsApi = {
  list: (status = 'pending') => api.get<{ data: ApprovalTask[] }>(`/approvals?status=${status}`),
  get: (id: string) => api.get<{ data: ApprovalTask }>(`/approvals/${id}`),
  approve: (id: string, comment?: string) => api.post(`/approvals/${id}/approve`, { comment }),
  reject: (id: string, comment?: string) => api.post(`/approvals/${id}/reject`, { comment }),
};

// ── Transactions ──────────────────────────────────────

export const txApi = {
  list: (params?: { status?: string; agent_id?: string; page?: number; per_page?: number }) => {
    const qs = params ? '?' + new URLSearchParams(params as unknown as Record<string, string>).toString() : '';
    return api.get<{ data: Transaction[]; meta: Meta }>(`/transactions${qs}`);
  },
  get: (id: string) => api.get<{ data: Transaction }>(`/transactions/${id}`),
  refund: (id: string, reason?: string) => api.post<{ data: Record<string, unknown>; status: string; message: string }>(`/transactions/${id}/refund`, { reason }),
};

// ── Webhooks ──────────────────────────────────────────

export const webhooksApi = {
  list: () => api.get<{ data: WebhookEvent[] }>('/webhooks/events'),
};

// ── Audit ─────────────────────────────────────────────

export const auditApi = {
  list: (params?: { resource_type?: string; resource_id?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return api.get<{ data: AuditEvent[]; meta: Meta }>(`/audit-events${qs}`);
  },
};

// ── Overview ──────────────────────────────────────────

export const overviewApi = {
  get: () => api.get<{ data: Overview }>('/overview'),
};

// ── Providers ─────────────────────────────────────────

export const providersApi = {
  list: () => api.get<{
    data: {
      available_providers: Array<{ providerType: string; name: string; supportedRails: string[] }>;
      configured_providers: Array<{ id: string; provider_type: string; name: string; is_default: boolean; status: string; created_at: string }>;
    }
  }>('/providers'),
  configure: (body: { provider_type: string; name: string; is_default?: boolean; webhook_secret?: string; settings?: Record<string, unknown> }) =>
    api.post('/providers', body),
};

// ── Types ─────────────────────────────────────────────

export interface User { id: string; email: string; name: string; role: string; }
export interface Organization { id: string; name: string; slug: string; frame_env: string; }
export interface Agent {
  id: string; name: string; description?: string; owner_team?: string; purpose?: string;
  status: 'active' | 'disabled' | 'revoked'; frame_env: string;
  credential_count?: number; total_payments?: number; total_spend_paise?: number;
  last_used_at?: string;
  created_at: string; updated_at: string;
}
export interface Credential {
  id: string; agent_id: string; key_prefix: string; api_key?: string;
  status: 'active' | 'revoked'; last_used_at?: string; created_at: string;
}
export interface Policy {
  id: string; agent_id: string; name: string; status: string;
  version_number?: number; transaction_limit_paise?: number;
  daily_limit_paise?: number; monthly_limit_paise?: number;
  approval_threshold_paise?: number;
  merchant_allowlist?: string[]; merchant_blocklist?: string[];
  created_at: string; updated_at: string;
}
export interface PaymentAuthority {
  id: string;
  organization_id: string;
  agent_id: string;
  agent_name?: string;
  user_id: string;
  provider: string;
  rail: string;
  currency: string;
  max_transaction_amount_paise: number;
  daily_limit_paise: number;
  monthly_limit_paise: number;
  requires_approval_above_paise?: number | null;
  allowed_categories?: string[];
  blocked_categories?: string[];
  allowed_merchants?: string[];
  blocked_merchants?: string[];
  spent_today_paise: number;
  spent_this_month_paise: number;
  remaining_today_paise: number;
  remaining_month_paise: number;
  purpose?: string | null;
  valid_from: string;
  valid_until: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';
  revocation_reason?: string | null;
  created_at: string;
  updated_at: string;
}
export interface PaymentIntent {
  id: string; agent_id: string; agent_name?: string;
  amount_paise: number; currency: string; merchant: string; purpose: string;
  status: string; decision?: string; denial_reason?: string;
  firewall?: { decision: string; reasons: string[]; risk_level: string };
  created_at: string; updated_at: string;
}
export interface ApprovalTask {
  id: string; payment_intent_id: string; organization_id: string;
  status: string; requested_at: string; expires_at: string;
  decided_by?: string; decided_at?: string; comment?: string;
  amount_paise?: number; merchant?: string; purpose?: string;
  agent_id?: string; agent_name?: string;
  reasons?: string[]; risk_level?: string;
}
export interface Transaction {
  id: string; payment_intent_id: string; provider: string;
  provider_payment_id?: string; amount_paise: number; currency: string;
  status: string; merchant?: string; purpose?: string; agent_name?: string;
  created_at: string; updated_at: string;
}
export interface AuditEvent {
  id: string; organization_id: string; actor_type: string; actor_id?: string;
  action: string; resource_type?: string; resource_id?: string;
  decision?: string; occurred_at: string;
}
export interface WebhookEvent {
  id: string; provider: string; event_id: string; event_type: string;
  verified: boolean; processed: boolean; processed_at?: string;
  payment_id?: string; payment_status?: string;
  amount_paise?: number; currency?: string;
  created_at: string;
}
export interface Overview {
  active_agents: number; pending_approvals: number; blocked_payments: number;
  total_spend_paise: number; today_spend_paise: number;
  payment_success_rate: number;
  payment_intents_by_status: Record<string, number>;
}
export interface Meta { total: number; page: number; per_page: number; total_pages: number; }
