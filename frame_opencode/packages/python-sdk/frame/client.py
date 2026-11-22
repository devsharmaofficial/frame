"""frame-sdk HTTP client (stdlib only: urllib.request + json)."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable, Dict, Mapping, Optional

from .types import (
    ApprovalTask,
    CreateAgentInput,
    CreateIntentInput,
    CreatePolicyInput,
    Overview,
    PaymentIntent,
    PolicyConfig,
    SignupInput,
    WebhookTestInput,
)

DEFAULT_BASE_URL = "http://localhost:4100/api/v1"


def new_idempotency_key() -> str:
    """UUID-ish idempotency key (uuid4 hex)."""
    import uuid

    return str(uuid.uuid4())


def inr_to_paise(rupees: float) -> int:
    """Convert rupees to integer paise (round(x * 100))."""
    return round(rupees * 100)


def paise_to_inr(paise: Any) -> float:
    """Convert integer paise to rupees."""
    return float(paise) / 100


def to_paise_number(v: Any) -> float:
    """Normalize tolerant paise (int | str) to a number."""
    return float(v) if isinstance(v, str) else v


class FrameError(Exception):
    """Raised for non-2xx API responses: { error: { code, message, request_id } }."""

    def __init__(
        self,
        code: str,
        status: int,
        message: str,
        request_id: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status = status
        self.message = message
        self.request_id = request_id
        # camelCase alias for parity with @frame/sdk.
        self.requestId = request_id

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.code} ({self.status}): {self.message}"

    def __repr__(self) -> str:  # pragma: no cover - trivial
        return (
            f"FrameError(code={self.code!r}, status={self.status!r}, "
            f"message={self.message!r}, request_id={self.request_id!r})"
        )


def _resolve_base_url(explicit: Optional[str] = None) -> str:
    raw = explicit or os.environ.get("FRAME_API_URL") or DEFAULT_BASE_URL
    return raw.rstrip("/")


def _parse_json_body(raw: bytes) -> Any:
    if not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None


def _header_get(headers: Any, name: str) -> Optional[str]:
    if headers is None:
        return None
    try:
        # Plain dict (test stubs).
        if isinstance(headers, dict):
            for k, v in headers.items():
                if str(k).lower() == name.lower():
                    return str(v)
            return None
        # HTTPMessage / email.message style.
        get = getattr(headers, "get", None)
        if callable(get):
            v = get(name)
            if v is None:
                v = get(name.lower())
            return str(v) if v is not None else None
    except Exception:
        return None
    return None


def _as_dict(body: Optional[Mapping[str, Any]], **kwargs: Any) -> Dict[str, Any]:
    out: Dict[str, Any] = dict(body) if body else {}
    for k, v in kwargs.items():
        if v is not None:
            out[k] = v
    return out


class _AuthNamespace:
    def __init__(self, client: "FrameClient") -> None:
        self._c = client

    def signup(self, data: Optional[Mapping[str, Any]] = None, **kwargs: Any) -> Dict[str, Any]:
        """POST /auth/signup. Stores the returned token on the client."""
        payload: Dict[str, Any] = _as_dict(data, **kwargs)  # type: ignore[arg-type]
        out = self._c._request("POST", "/auth/signup", body=payload)
        token = out.get("token") if isinstance(out, dict) else None
        if token:
            self._c.set_token(str(token))
        return out


class _AgentsNamespace:
    def __init__(self, client: "FrameClient") -> None:
        self._c = client

    def create(
        self,
        data: Optional[Mapping[str, Any]] = None,
        *,
        api_key: Optional[str] = None,
        auth: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """POST /agents {name,description,owner,environment,purpose}."""
        return self._c._request(
            "POST", "/agents",
            body=_as_dict(data, **kwargs),  # type: ignore[arg-type]
            api_key=api_key, auth=auth,
        )

    def list(
        self, *, api_key: Optional[str] = None, auth: Optional[str] = None
    ) -> Any:
        """GET /agents."""
        return self._c._request("GET", "/agents", api_key=api_key, auth=auth)

    def get(
        self, agent_id: str, *, api_key: Optional[str] = None, auth: Optional[str] = None
    ) -> Any:
        """GET /agents/:id."""
        return self._c._request(
            "GET", f"/agents/{urllib.parse.quote(agent_id, safe='')}",
            api_key=api_key, auth=auth,
        )

    def disable(
        self, agent_id: str, *, api_key: Optional[str] = None, auth: Optional[str] = None
    ) -> Any:
        """POST /agents/:id/disable (bodiless — no Content-Type)."""
        return self._c._request(
            "POST", f"/agents/{urllib.parse.quote(agent_id, safe='')}/disable",
            api_key=api_key, auth=auth,
        )

    def enable(
        self, agent_id: str, *, api_key: Optional[str] = None, auth: Optional[str] = None
    ) -> Any:
        """POST /agents/:id/enable (bodiless — no Content-Type)."""
        return self._c._request(
            "POST", f"/agents/{urllib.parse.quote(agent_id, safe='')}/enable",
            api_key=api_key, auth=auth,
        )

    def rotate_key(
        self, agent_id: str, *, api_key: Optional[str] = None, auth: Optional[str] = None
    ) -> Dict[str, Any]:
        """POST /agents/:id/rotate-key (bodiless — no Content-Type)."""
        return self._c._request(
            "POST", f"/agents/{urllib.parse.quote(agent_id, safe='')}/rotate-key",
            api_key=api_key, auth=auth,
        )


class _PoliciesNamespace:
    def __init__(self, client: "FrameClient") -> None:
        self._c = client

    def create(
        self,
        data: Optional[Mapping[str, Any]] = None,
        *,
        api_key: Optional[str] = None,
        auth: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """POST /policies (flat fields or nested config)."""
        return self._c._request(
            "POST", "/policies",
            body=_as_dict(data, **kwargs),  # type: ignore[arg-type]
            api_key=api_key, auth=auth,
        )

    def update(
        self,
        policy_id: str,
        config: Optional[Mapping[str, Any]] = None,
        patch: Optional[Mapping[str, Any]] = None,
        *,
        api_key: Optional[str] = None,
        auth: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """PATCH /policies/:id {config}."""
        if patch is not None:
            body = dict(patch)
            if config is not None and "config" not in body:
                body["config"] = dict(config)
            body.update({k: v for k, v in kwargs.items() if v is not None})
        else:
            body = {"config": dict(config or {})}
            body.update({k: v for k, v in kwargs.items() if v is not None})
        return self._c._request(
            "PATCH", f"/policies/{urllib.parse.quote(policy_id, safe='')}",
            body=body, api_key=api_key, auth=auth,
        )

    def list(
        self, *, api_key: Optional[str] = None, auth: Optional[str] = None
    ) -> Any:
        """GET /policies."""
        return self._c._request("GET", "/policies", api_key=api_key, auth=auth)

    def get(
        self, policy_id: str, *, api_key: Optional[str] = None, auth: Optional[str] = None
    ) -> Any:
        """GET /policies/:id."""
        return self._c._request(
            "GET", f"/policies/{urllib.parse.quote(policy_id, safe='')}",
            api_key=api_key, auth=auth,
        )

    def versions(
        self, policy_id: str, *, api_key: Optional[str] = None, auth: Optional[str] = None
    ) -> Any:
        """GET /policies/:id/versions."""
        return self._c._request(
            "GET", f"/policies/{urllib.parse.quote(policy_id, safe='')}/versions",
            api_key=api_key, auth=auth,
        )


class _PaymentIntentsNamespace:
    def __init__(self, client: "FrameClient") -> None:
        self._c = client

    def create(
        self,
        data: Optional[Mapping[str, Any]] = None,
        *,
        agent_key: Optional[str] = None,
        api_key: Optional[str] = None,
        auth: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        idempotencyKey: Optional[str] = None,  # noqa: N803 - TS-parity alias
        headers: Optional[Mapping[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """POST /payment-intents (+Idempotency-Key, agent Bearer).

        The idempotency key is auto-generated via :func:`new_idempotency_key`
        unless provided.
        """
        key = idempotency_key if idempotency_key is not None else idempotencyKey
        if key is None:
            key = new_idempotency_key()
        merged: Dict[str, str] = dict(headers) if headers else {}
        merged["Idempotency-Key"] = key
        return self._c._request(
            "POST", "/payment-intents",
            body=_as_dict(data, **kwargs),  # type: ignore[arg-type]
            api_key=agent_key or api_key or auth,
            headers=merged,
        )

    def list(
        self,
        agent_id: Optional[str] = None,
        params: Optional[Mapping[str, Any]] = None,
        *,
        api_key: Optional[str] = None,
        auth: Optional[str] = None,
    ) -> Any:
        """GET /payment-intents?agentId=."""
        aid = agent_id
        if aid is None and params:
            aid = params.get("agentId", params.get("agent_id"))
        qs = f"?agentId={urllib.parse.quote(str(aid), safe='')}" if aid else ""
        return self._c._request(
            "GET", f"/payment-intents{qs}", api_key=api_key, auth=auth
        )

    def get(
        self, intent_id: str, *, api_key: Optional[str] = None, auth: Optional[str] = None
    ) -> Any:
        """GET /payment-intents/:id."""
        return self._c._request(
            "GET", f"/payment-intents/{urllib.parse.quote(intent_id, safe='')}",
            api_key=api_key, auth=auth,
        )

    def audit(
        self, intent_id: str, *, api_key: Optional[str] = None, auth: Optional[str] = None
    ) -> Dict[str, Any]:
        """GET /payment-intents/:id/audit."""
        return self._c._request(
            "GET", f"/payment-intents/{urllib.parse.quote(intent_id, safe='')}/audit",
            api_key=api_key, auth=auth,
        )

    def execute(
        self,
        intent_id: str,
        *,
        agent_key: Optional[str] = None,
        api_key: Optional[str] = None,
        auth: Optional[str] = None,
    ) -> Any:
        """POST /payment-intents/:id/execute (agent auth, bodiless)."""
        return self._c._request(
            "POST", f"/payment-intents/{urllib.parse.quote(intent_id, safe='')}/execute",
            api_key=agent_key or api_key or auth,
        )

    def execute_user(
        self,
        intent_id: str,
        *,
        api_key: Optional[str] = None,
        auth: Optional[str] = None,
    ) -> Any:
        """POST /payment-intents/:id/execute-user (user auth, bodiless)."""
        return self._c._request(
            "POST",
            f"/payment-intents/{urllib.parse.quote(intent_id, safe='')}/execute-user",
            api_key=api_key, auth=auth,
        )


class _ApprovalsNamespace:
    def __init__(self, client: "FrameClient") -> None:
        self._c = client

    def list(
        self,
        status: Optional[str] = None,
        params: Optional[Mapping[str, Any]] = None,
        *,
        api_key: Optional[str] = None,
        auth: Optional[str] = None,
    ) -> Any:
        """GET /approvals?status=."""
        st = status
        if st is None and params:
            st = params.get("status")
        qs = f"?status={urllib.parse.quote(str(st), safe='')}" if st else ""
        return self._c._request("GET", f"/approvals{qs}", api_key=api_key, auth=auth)

    def approve(
        self,
        approval_id: str,
        comment: Optional[str] = None,
        data: Optional[Mapping[str, Any]] = None,
        *,
        api_key: Optional[str] = None,
        auth: Optional[str] = None,
    ) -> Any:
        """POST /approvals/:id/approve {comment}."""
        body: Dict[str, Any] = dict(data) if data else {}
        if comment is not None:
            body["comment"] = comment
        return self._c._request(
            "POST", f"/approvals/{urllib.parse.quote(approval_id, safe='')}/approve",
            body=body, api_key=api_key, auth=auth,
        )

    def reject(
        self,
        approval_id: str,
        comment: Optional[str] = None,
        data: Optional[Mapping[str, Any]] = None,
        *,
        api_key: Optional[str] = None,
        auth: Optional[str] = None,
    ) -> Any:
        """POST /approvals/:id/reject {comment}."""
        body: Dict[str, Any] = dict(data) if data else {}
        if comment is not None:
            body["comment"] = comment
        return self._c._request(
            "POST", f"/approvals/{urllib.parse.quote(approval_id, safe='')}/reject",
            body=body, api_key=api_key, auth=auth,
        )


class _OverviewNamespace:
    def __init__(self, client: "FrameClient") -> None:
        self._c = client

    def get(
        self, *, api_key: Optional[str] = None, auth: Optional[str] = None
    ) -> Dict[str, Any]:
        """GET /overview."""
        return self._c._request("GET", "/overview", api_key=api_key, auth=auth)


class _TransactionsNamespace:
    def __init__(self, client: "FrameClient") -> None:
        self._c = client

    def list(
        self, *, api_key: Optional[str] = None, auth: Optional[str] = None
    ) -> Any:
        """GET /transactions."""
        return self._c._request("GET", "/transactions", api_key=api_key, auth=auth)


class _AuditNamespace:
    def __init__(self, client: "FrameClient") -> None:
        self._c = client

    def list(
        self, *, api_key: Optional[str] = None, auth: Optional[str] = None
    ) -> Any:
        """GET /audit-events."""
        return self._c._request("GET", "/audit-events", api_key=api_key, auth=auth)


class _NotificationsNamespace:
    def __init__(self, client: "FrameClient") -> None:
        self._c = client

    def list(
        self,
        limit: Optional[int] = None,
        *,
        api_key: Optional[str] = None,
        auth: Optional[str] = None,
    ) -> Any:
        """GET /notifications."""
        qs = f"?limit={int(limit)}" if limit is not None else ""
        return self._c._request(
            "GET", f"/notifications{qs}", api_key=api_key, auth=auth
        )

    def test(
        self,
        type: Optional[str] = None,  # noqa: A002 - mirrors server field name
        data: Optional[Mapping[str, Any]] = None,
        *,
        api_key: Optional[str] = None,
        auth: Optional[str] = None,
        **kwargs: Any,
    ) -> Any:
        """POST /notifications/test."""
        body = _as_dict(data, **kwargs)
        if type is not None:
            body["type"] = type
        return self._c._request(
            "POST", "/notifications/test", body=body, api_key=api_key, auth=auth
        )


class _ReconciliationNamespace:
    def __init__(self, client: "FrameClient") -> None:
        self._c = client

    def exceptions(
        self, *, api_key: Optional[str] = None, auth: Optional[str] = None
    ) -> Any:
        """GET /reconciliation/exceptions."""
        return self._c._request(
            "GET", "/reconciliation/exceptions", api_key=api_key, auth=auth
        )

    def run(
        self, *, api_key: Optional[str] = None, auth: Optional[str] = None
    ) -> Any:
        """POST /reconciliation/run (bodiless — no Content-Type)."""
        return self._c._request(
            "POST", "/reconciliation/run", api_key=api_key, auth=auth
        )


class _WebhooksNamespace:
    def __init__(self, client: "FrameClient") -> None:
        self._c = client

    def test(
        self,
        data: Optional[Mapping[str, Any]] = None,
        *,
        api_key: Optional[str] = None,
        auth: Optional[str] = None,
        **kwargs: Any,
    ) -> Any:
        """POST /webhooks/test {payment_id, event_type}."""
        return self._c._request(
            "POST", "/webhooks/test",
            body=_as_dict(data, **kwargs),  # type: ignore[arg-type]
            api_key=api_key, auth=auth,
        )


class FrameClient:
    """Official Frame API client (stdlib only).

    :param base_url: API base URL. Defaults to ``FRAME_API_URL`` env or
        ``http://localhost:4100/api/v1``.
    :param token: User JWT for dashboard calls.
    :param api_key: Alias for ``token`` (or an agent key when acting as an agent).
    :param opener: Injectable HTTP opener for tests. Defaults to
        :func:`urllib.request.urlopen`. Called as ``opener(request, timeout=...)``.
    :param timeout: Default request timeout in seconds.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        token: Optional[str] = None,
        api_key: Optional[str] = None,
        opener: Optional[Callable[..., Any]] = None,
        timeout: float = 30.0,
        *,
        baseUrl: Optional[str] = None,  # noqa: N803 - TS-parity alias
    ) -> None:
        self.base_url = _resolve_base_url(base_url if base_url is not None else baseUrl)
        # Alias parity with TS (.baseUrl).
        self.baseUrl = self.base_url
        self._token = token if token is not None else api_key
        self._opener = opener or urllib.request.urlopen
        self.timeout = timeout

        self.auth = _AuthNamespace(self)
        self.agents = _AgentsNamespace(self)
        self.policies = _PoliciesNamespace(self)
        self.payment_intents = _PaymentIntentsNamespace(self)
        # camelCase alias mirroring TS (`paymentIntents`).
        self.paymentIntents = self.payment_intents
        self.approvals = _ApprovalsNamespace(self)
        self.overview = _OverviewNamespace(self)
        self.transactions = _TransactionsNamespace(self)
        self.audit = _AuditNamespace(self)
        self.notifications = _NotificationsNamespace(self)
        self.reconciliation = _ReconciliationNamespace(self)
        self.webhooks = _WebhooksNamespace(self)

    def set_token(self, token: Optional[str]) -> None:
        """Set (or clear) the stored bearer token."""
        self._token = token

    # camelCase alias mirroring TS.
    setToken = set_token  # type: ignore[assignment]

    @property
    def auth_token(self) -> Optional[str]:
        return self._token

    @property
    def authToken(self) -> Optional[str]:  # noqa: N802 - TS-parity alias
        return self._token

    def _auth_value(self, explicit: Optional[str]) -> Optional[str]:
        return explicit if explicit is not None else self._token

    def _request(
        self,
        method: str,
        path: str,
        body: Optional[Any] = None,
        api_key: Optional[str] = None,
        auth: Optional[str] = None,
        headers: Optional[Mapping[str, str]] = None,
    ) -> Any:
        url = f"{self.base_url}{path}"
        req_headers: Dict[str, str] = {}
        token = self._auth_value(api_key if api_key is not None else auth)
        if token:
            req_headers["Authorization"] = f"Bearer {token}"
        if headers:
            req_headers.update(dict(headers))

        data: Optional[bytes] = None
        # IMPORTANT: bodiless POSTs must NOT send Content-Type
        # (Fastify rejects empty JSON bodies).
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            req_headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=data, method=method)
        # Assign directly to preserve exact header casing (urllib's
        # add_header() would capitalize e.g. "Idempotency-Key").
        for k, v in req_headers.items():
            req.headers[k] = v

        try:
            resp = self._opener(req, timeout=self.timeout)
        except urllib.error.HTTPError as e:
            raise self._parse_error(method, path, e, getattr(e, "headers", None)) from None
        return self._parse_response(method, path, resp)

    def _parse_response(self, method: str, path: str, resp: Any) -> Any:
        status = getattr(resp, "status", None)
        if status is None:
            getcode = getattr(resp, "getcode", None)
            status = getcode() if callable(getcode) else 200
        raw = resp.read() if hasattr(resp, "read") else b""
        if isinstance(raw, str):
            raw = raw.encode("utf-8")
        resp_headers = getattr(resp, "headers", None)
        if resp_headers is None:
            info = getattr(resp, "info", None)
            resp_headers = info() if callable(info) else None
        if status is not None and status >= 400:
            raise self._error_from_payload(
                status, _parse_json_body(raw or b""), _header_get(resp_headers, "x-request-id"),
                method, path,
            )
        if not raw:
            return {}
        parsed = _parse_json_body(raw)
        return parsed if parsed is not None else {}

    def _parse_error(
        self, method: str, path: str, err: Any, headers: Any = None
    ) -> FrameError:
        status = getattr(err, "code", None)
        if status is None:
            status = getattr(err, "status", None) or 0
        try:
            raw = err.read() if hasattr(err, "read") else b""
        except Exception:
            raw = b""
        if isinstance(raw, str):
            raw = raw.encode("utf-8")
        if headers is None:
            headers = getattr(err, "headers", None)
        return self._error_from_payload(
            int(status) if isinstance(status, int) else 0,
            _parse_json_body(raw or b""),
            _header_get(headers, "x-request-id"),
            method, path,
        )

    @staticmethod
    def _error_from_payload(
        status: int, data: Any, request_id: Optional[str],
        method: str, path: str,
    ) -> FrameError:
        err = data.get("error") if isinstance(data, dict) else None
        if not isinstance(err, dict):
            err = {}
        code = err.get("code") or f"HTTP_{status}"
        message = err.get("message") or f"Request failed: {method} {path} ({status})"
        rid = err.get("request_id") or request_id
        return FrameError(code=str(code), status=status, message=str(message), request_id=rid)


__all__ = [
    "DEFAULT_BASE_URL",
    "FrameClient",
    "FrameError",
    "new_idempotency_key",
    "inr_to_paise",
    "paise_to_inr",
    "to_paise_number",
]
