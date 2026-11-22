"""End-to-end demo against a live Frame API (DATABASE_URL-backed server).

Run:  python3 examples/demo_flow.py
Needs: live API at localhost:4100 (or FRAME_API_URL).

Flow (mirrors packages/sdk/examples/demo-flow.mts):
  unique signup -> agent -> policy
  (allowedMerchants=["acme"], transactionLimitPaise=500000,
   approvalThresholdPaise=10000) -> agent intent Rs.19.99 (ALLOW) ->
  big intent (REQUIRE_APPROVAL) -> approve -> execute_user ->
  webhooks.test with returned providerPaymentId + payment.succeeded ->
  audit (expect timeline >= 4) -> print "DEMO OK".
"""

import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from frame import FrameClient, inr_to_paise, paise_to_inr  # noqa: E402

BASE_URL = os.environ.get("FRAME_API_URL", "http://localhost:4100/api/v1")
UNIQ = uuid.uuid4().hex[:8]


def unwrap(obj, *keys):
    """Unwrap TS-style envelopes: {intent}/{agent}/{policy} or raw."""
    if isinstance(obj, dict):
        for k in keys:
            if isinstance(obj.get(k), dict):
                return obj[k]
    return obj if isinstance(obj, dict) else {}


def fail(msg):
    print(f"DEMO FAILED: {msg}", file=sys.stderr)
    sys.exit(1)


def main():
    client = FrameClient(base_url=BASE_URL)

    # 1. Fresh signup (unique org each run).
    email = f"demo+{UNIQ}@example.com"
    try:
        out = client.auth.signup(
            {
                "name": "Demo User",
                "email": email,
                "companyName": f"Demo Co {UNIQ}",
                "password": "password123",
            }
        )
    except Exception as e:
        fail(f"signup failed: {e}")
    token = out.get("token")
    user = out.get("user", {})
    if not token:
        fail(f"signup returned no token: {out}")
    print(f"signup ok user={user.get('id')} token=...{token[-6:]}")

    # 2. Agent (user auth).
    try:
        created = client.agents.create(
            {
                "name": f"demo-agent-{UNIQ}",
                "description": "SDK demo agent",
                "owner": "demo",
                "environment": "sandbox",
                "purpose": "demo",
            }
        )
    except Exception as e:
        fail(f"agents.create failed: {e}")
    agent = unwrap(created, "agent")
    credential = created.get("credential", {}) if isinstance(created, dict) else {}
    agent_id = agent.get("id")
    agent_key = credential.get("key")
    if not agent_id or not agent_key:
        fail(f"agents.create missing agent/credential: {created}")
    print(f"agent ok id={agent_id} key=...{agent_key[-6:]}")

    # 3. Policy with flat dashboard fields.
    try:
        pol = client.policies.create(
            {
                "agentId": agent_id,
                "name": f"demo-policy-{UNIQ}",
                "allowedMerchants": ["acme"],
                "transactionLimitPaise": 500000,
                "approvalThresholdPaise": 10000,
            }
        )
    except Exception as e:
        fail(f"policies.create failed: {e}")
    print(f"policy ok {unwrap(pol, 'policy')}")

    # 4. Intent as AGENT (small amount -> ALLOW path if policy permits).
    agent_client = FrameClient(base_url=BASE_URL, api_key=agent_key)
    try:
        intent = agent_client.payment_intents.create(
            {
                "agentId": agent_id,
                "amountPaise": inr_to_paise(19.99),
                "merchant": "acme",
                "purpose": "demo coffee",
            },
            idempotency_key=uuid.uuid4().hex,
        )
    except Exception as e:
        fail(f"payment_intents.create (small) failed: {e}")
    intent = unwrap(intent, "intent")
    intent_id = intent.get("id")
    if not intent_id:
        fail(f"intent missing id: {intent}")
    amt = intent.get("amountPaise", intent.get("amount", 1999))
    try:
        amt_n = int(amt)
    except (TypeError, ValueError):
        amt_n = 1999
    print(
        f"intent ok id={intent_id} status={intent.get('status')} "
        f"decision={intent.get('decision')} amount=Rs.{paise_to_inr(amt_n)}"
    )
    if intent.get("decision") and intent["decision"] != "ALLOW":
        print(f"note: small intent decision={intent.get('decision')} (expected ALLOW)")

    # 5. Threshold flow: big intent likely needs approval -> approve as admin.
    try:
        big = agent_client.payment_intents.create(
            {
                "agentId": agent_id,
                "amountPaise": 50000,
                "merchant": "acme",
                "purpose": "demo laptop",
            },
            idempotency_key=uuid.uuid4().hex,
        )
    except Exception as e:
        fail(f"payment_intents.create (big) failed: {e}")
    big = unwrap(big, "intent")
    print(
        f"big intent id={big.get('id')} status={big.get('status')} "
        f"decision={big.get('decision')}"
    )
    if big.get("decision") and big["decision"] != "REQUIRE_APPROVAL":
        print(f"note: big intent decision={big.get('decision')} (expected REQUIRE_APPROVAL)")

    try:
        pend = client.approvals.list(status="pending")
    except Exception as e:
        fail(f"approvals.list failed: {e}")
    tasks = pend if isinstance(pend, list) else (pend.get("approvals", []) or [])
    if tasks:
        mine = tasks[-1]
        try:
            client.approvals.approve(mine["id"], comment="sdk demo approve")
        except Exception as e:
            fail(f"approvals.approve failed: {e}")
        print(f"approved {mine['id']}")
    else:
        print("no pending approvals (intent auto-decided)")

    # 6. Execute as user, then webhook test + audit fetch.
    try:
        exec_out = client.payment_intents.execute_user(intent_id)
    except Exception as e:
        fail(f"payment_intents.execute_user failed: {e}")
    print(f"execute-user ok {unwrap(exec_out, 'intent', 'payment')}")

    provider_payment_id = None
    if isinstance(exec_out, dict):
        for k in ("providerPaymentId", "provider_payment_id"):
            if exec_out.get(k):
                provider_payment_id = exec_out[k]
                break
        if not provider_payment_id:
            for wrap in ("payment", "intent"):
                inner = exec_out.get(wrap)
                if isinstance(inner, dict):
                    for k in ("providerPaymentId", "provider_payment_id", "id"):
                        if inner.get(k):
                            provider_payment_id = inner[k]
                            break
                if provider_payment_id:
                    break
    if not provider_payment_id:
        fail(f"execute_user returned no providerPaymentId: {exec_out}")
    try:
        hook = client.webhooks.test(
            {"payment_id": provider_payment_id, "event_type": "payment.succeeded"}
        )
    except Exception as e:
        fail(f"webhooks.test failed: {e}")
    print(f"webhook ok {hook}")

    try:
        audit = client.payment_intents.audit(intent_id)
    except Exception as e:
        fail(f"payment_intents.audit failed: {e}")
    timeline = audit.get("timeline", []) if isinstance(audit, dict) else []
    n = len(timeline) if isinstance(timeline, list) else "?"
    print(f"audit ok timeline={n} events")
    if not isinstance(timeline, list) or len(timeline) < 4:
        fail(f"expected audit timeline >= 4 events, got {n}: {audit}")
    print("DEMO OK")


if __name__ == "__main__":
    main()
