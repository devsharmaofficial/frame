"""Shared types for frame-sdk.

Money is INTEGER PAISE everywhere on the wire. Fields typed as
``int | str`` are tolerant on read (some endpoints serialize big integers
as strings); always send ``int``.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Union

try:
    from typing import TypedDict
except ImportError:  # pragma: no cover - 3.10 always has TypedDict
    from typing_extensions import TypedDict  # type: ignore[no-redef]

#: Integer paise amount, tolerant of string-serialized values on read.
Paise = Union[int, str]


class User(TypedDict, total=False):
    id: str
    name: str
    email: str
    companyName: str
    companyId: str
    createdAt: str


class Agent(TypedDict, total=False):
    id: str
    name: str
    description: Optional[str]
    owner: Optional[str]
    environment: Optional[str]
    purpose: Optional[str]
    status: str
    createdAt: str
    updatedAt: str


class Credential(TypedDict, total=False):
    id: str
    prefix: str
    #: Full agent bearer key. Only returned once at creation / rotation.
    key: str
    secretShownOnce: bool


class PolicyConfig(TypedDict, total=False):
    merchantAllowlist: List[str]
    allowedMerchants: List[str]
    maxAmountPaise: Paise
    maxAmount: Paise
    requireApprovalAbovePaise: Paise
    approvalThresholdPaise: Paise
    allowedCategories: List[str]
    blockedMerchants: List[str]
    merchantBlocklist: List[str]
    dailyLimitPaise: Paise
    velocityLimit: Any


class Policy(TypedDict, total=False):
    id: str
    agentId: str
    agent_id: str
    name: str
    description: Optional[str]
    config: PolicyConfig
    status: str
    version: int
    createdAt: str
    updatedAt: str


class PolicyVersion(TypedDict, total=False):
    version: int
    policyId: str
    config: PolicyConfig
    createdAt: str


class IntentCheck(TypedDict, total=False):
    name: str
    passed: bool
    reason: str


class PaymentIntent(TypedDict, total=False):
    id: str
    agentId: str
    status: str
    decision: str
    reasons: List[str]
    checks: List[IntentCheck]
    amountPaise: Paise
    amount: Paise
    merchant: str
    currency: str
    createdAt: str


class Payment(TypedDict, total=False):
    id: str
    intentId: str
    status: str
    amountPaise: Paise


class ApprovalTask(TypedDict, total=False):
    id: str
    status: str
    reason: Optional[str]
    comment: Optional[str]
    paymentIntent: Optional[PaymentIntent]
    payment_intent: Optional[PaymentIntent]
    agent: Optional[Agent]
    policy: Optional[Policy]
    createdAt: str


class Transaction(TypedDict, total=False):
    id: str
    amountPaise: Paise
    status: str
    merchant: str
    createdAt: str


class AuditEvent(TypedDict, total=False):
    id: str
    type: str
    eventType: str
    actor: str
    createdAt: str


class Overview(TypedDict, total=False):
    totals: Dict[str, Any]
    counts: Dict[str, Any]


class SignupInput(TypedDict, total=False):
    name: str
    email: str
    companyName: str
    password: str


class CreateAgentInput(TypedDict, total=False):
    name: str
    description: str
    owner: str
    environment: str
    purpose: str


class CreatePolicyInput(TypedDict, total=False):
    agentId: str
    name: str
    description: str
    config: PolicyConfig


class CreateIntentInput(TypedDict, total=False):
    agentId: str
    amountPaise: int
    merchant: str
    purpose: str
    description: str
    currency: str
    metadata: Dict[str, Any]


class WebhookTestInput(TypedDict, total=False):
    payment_id: str
    event_type: str


__all__ = [
    "Paise",
    "User",
    "Agent",
    "Credential",
    "PolicyConfig",
    "Policy",
    "PolicyVersion",
    "IntentCheck",
    "PaymentIntent",
    "Payment",
    "ApprovalTask",
    "Transaction",
    "AuditEvent",
    "Overview",
    "SignupInput",
    "CreateAgentInput",
    "CreatePolicyInput",
    "CreateIntentInput",
    "WebhookTestInput",
]
