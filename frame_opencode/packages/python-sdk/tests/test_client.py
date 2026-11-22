"""frame-sdk unit tests (stdlib unittest only, stubbed opener — no network)."""

import io
import json
import unittest
import urllib.error
import urllib.request

from frame import FrameClient, FrameError, inr_to_paise, new_idempotency_key, paise_to_inr
from frame.client import DEFAULT_BASE_URL, to_paise_number


class StubResponse:
    def __init__(self, status=200, body=None, headers=None):
        self.status = status
        self._body = b"" if body is None else json.dumps(body).encode()
        self.headers = dict(headers or {})

    def read(self):
        return self._body


def headers_lower(req):
    """Case-insensitive view of headers set on a urllib Request."""
    out = {}
    for k, v in dict(getattr(req, "headers", {})).items():
        out[str(k).lower()] = v
    for k, v in dict(getattr(req, "unredirected_hdrs", {})).items():
        out.setdefault(str(k).lower(), v)
    # urllib may also expose via get_header(); cover both spellings.
    return out


def make_client(handler, **kwargs):
    calls = []

    def opener(req, timeout=None):
        calls.append(req)
        return handler(req, calls)

    kwargs.setdefault("base_url", "http://x:4100/api/v1")
    c = FrameClient(opener=opener, **kwargs)
    return c, calls


class TestRequestShape(unittest.TestCase):
    def test_dashboard_call_url_method_auth(self):
        def handler(req, calls):
            return StubResponse(200, {"agents": []})

        c, calls = make_client(handler, token="tok123")
        out = c.agents.list()
        self.assertEqual(out, {"agents": []})
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0].full_url, "http://x:4100/api/v1/agents")
        self.assertEqual(calls[0].get_method(), "GET")
        h = headers_lower(calls[0])
        self.assertEqual(h.get("authorization"), "Bearer tok123")

    def test_payment_intent_idempotency_injected_and_auto(self):
        def handler(req, calls):
            return StubResponse(200, {"id": "pi_1", "status": "pending"})

        c, calls = make_client(handler)
        c.payment_intents.create(
            {"amountPaise": 1999, "merchant": "acme"},
            agent_key="ag_key",
            idempotency_key="fixed-key",
        )
        self.assertEqual(calls[0].full_url, "http://x:4100/api/v1/payment-intents")
        self.assertEqual(calls[0].get_method(), "POST")
        h1 = headers_lower(calls[0])
        self.assertEqual(h1.get("idempotency-key"), "fixed-key")
        self.assertEqual(h1.get("authorization"), "Bearer ag_key")
        self.assertEqual(h1.get("content-type"), "application/json")

        c.payment_intents.create({"amountPaise": 100, "merchant": "acme"}, agent_key="ag_key")
        h2 = headers_lower(calls[1])
        auto = h2.get("idempotency-key")
        self.assertIsInstance(auto, str)
        self.assertGreaterEqual(len(auto), 8)
        self.assertNotEqual(auto, "fixed-key")

    def test_per_call_api_key_override(self):
        def handler(req, calls):
            return StubResponse(200, {"id": "pi_9"})

        c, calls = make_client(handler, token="user-token")
        c.payment_intents.create(
            {"amountPaise": 50, "merchant": "acme"}, api_key="agent-override"
        )
        h = headers_lower(calls[0])
        self.assertEqual(h.get("authorization"), "Bearer agent-override")

    def test_bodiless_posts_send_no_content_type(self):
        def handler(req, calls):
            return StubResponse(200, {"agent": {"id": "a1"}})

        c, calls = make_client(handler, token="t")
        c.agents.disable("a1")
        c.agents.enable("a1")
        c.agents.rotate_key("a1")
        c.payment_intents.execute("pi_1", agent_key="ag")
        c.payment_intents.execute_user("pi_1")
        c.reconciliation.run()
        self.assertEqual(len(calls), 6)
        for req in calls:
            h = headers_lower(req)
            self.assertNotIn("content-type", h, f"{req.full_url} must not send Content-Type")
            self.assertEqual(req.get_method(), "POST")
        self.assertTrue(calls[0].full_url.endswith("/agents/a1/disable"))
        self.assertTrue(calls[3].full_url.endswith("/payment-intents/pi_1/execute"))
        self.assertTrue(calls[5].full_url.endswith("/reconciliation/run"))

    def test_error_envelope_to_frame_error_with_request_id(self):
        def handler(req, calls):
            raise urllib.error.HTTPError(
                req.full_url, 409,
                "Conflict",
                {"X-Request-Id": "req_9", "Content-Type": "application/json"},
                io.BytesIO(json.dumps(
                    {"error": {"code": "POLICY_EXISTS", "message": "edit instead",
                               "request_id": "req_9"}}
                ).encode()),
            )

        c, _ = make_client(handler, token="t")
        with self.assertRaises(FrameError) as ctx:
            c.policies.create({"agentId": "a", "name": "p"})
        e = ctx.exception
        self.assertEqual(e.code, "POLICY_EXISTS")
        self.assertEqual(e.status, 409)
        self.assertEqual(e.request_id, "req_9")
        self.assertEqual(e.requestId, "req_9")
        self.assertIn("edit instead", str(e))

    def test_error_request_id_falls_back_to_header(self):
        def handler(req, calls):
            raise urllib.error.HTTPError(
                req.full_url, 400, "Bad Request",
                {"X-Request-Id": "hdr_1", "Content-Type": "application/json"},
                io.BytesIO(json.dumps(
                    {"error": {"code": "VALIDATION_ERROR", "message": "bad"}}).encode()),
            )

        c, _ = make_client(handler)
        with self.assertRaises(FrameError) as ctx:
            c.webhooks.test({"payment_id": "p", "event_type": "payment.succeeded"})
        self.assertEqual(ctx.exception.request_id, "hdr_1")

    def test_opener_injectable_no_network(self):
        seen = []

        def opener(req, timeout=None):
            seen.append(req)
            return StubResponse(200, {"ok": True})

        c = FrameClient(base_url="http://x/api/v1", opener=opener)
        out = c.overview.get()
        self.assertEqual(out, {"ok": True})
        self.assertEqual(len(seen), 1)

    def test_query_params_and_body_shapes(self):
        bodies = {}

        def handler(req, calls):
            raw = req.data.decode() if req.data else None
            bodies[req.full_url] = raw
            return StubResponse(200, {})

        c, calls = make_client(handler, token="t")
        c.payment_intents.list(agent_id="ag1")
        c.approvals.list(status="pending")
        c.approvals.approve("ap1", comment="looks good")
        c.webhooks.test({"payment_id": "sandbox_1", "event_type": "payment.succeeded"})
        c.policies.update("pol1", {"merchantAllowlist": ["acme"]})

        self.assertTrue(calls[0].full_url.endswith("/payment-intents?agentId=ag1"))
        self.assertTrue(calls[1].full_url.endswith("/approvals?status=pending"))
        self.assertEqual(json.loads(bodies[calls[2].full_url]), {"comment": "looks good"})
        self.assertEqual(
            json.loads(bodies[calls[3].full_url]),
            {"payment_id": "sandbox_1", "event_type": "payment.succeeded"},
        )
        self.assertEqual(
            json.loads(bodies[calls[4].full_url]),
            {"config": {"merchantAllowlist": ["acme"]}},
        )
        self.assertEqual(calls[4].get_method(), "PATCH")


class TestHelpers(unittest.TestCase):
    def test_inr_to_paise(self):
        self.assertEqual(inr_to_paise(19.99), 1999)

    def test_paise_to_inr_round_trip(self):
        self.assertEqual(paise_to_inr(1999), 19.99)

    def test_new_idempotency_key_unique(self):
        a = new_idempotency_key()
        b = new_idempotency_key()
        self.assertGreaterEqual(len(a), 8)
        self.assertGreaterEqual(len(b), 8)
        self.assertNotEqual(a, b)

    def test_to_paise_number_tolerant(self):
        self.assertEqual(to_paise_number("1999"), 1999.0)
        self.assertEqual(to_paise_number(1999), 1999)

    def test_base_url_default_and_env(self):
        c = FrameClient(opener=lambda req, timeout=None: StubResponse(200, {}))
        self.assertEqual(c.base_url, DEFAULT_BASE_URL)
        import os

        os.environ["FRAME_API_URL"] = "http://env:4100/api/v1/"
        try:
            c2 = FrameClient(opener=lambda req, timeout=None: StubResponse(200, {}))
            self.assertEqual(c2.base_url, "http://env:4100/api/v1")
        finally:
            del os.environ["FRAME_API_URL"]

    def test_signup_stores_token(self):
        def handler(req, calls):
            return StubResponse(200, {"token": "jwt1", "user": {"id": "u1"}})

        c, _ = make_client(handler)
        self.assertIsNone(c.auth_token)
        out = c.auth.signup(
            {"name": "N", "email": "e@x.com", "companyName": "C", "password": "secret123"}
        )
        self.assertEqual(out["token"], "jwt1")
        self.assertEqual(c.auth_token, "jwt1")


if __name__ == "__main__":
    unittest.main()
