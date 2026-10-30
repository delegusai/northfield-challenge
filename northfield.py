"""An independent, in-memory authority experiment. No external services."""

from dataclasses import dataclass
from datetime import datetime, timezone
import re
import threading
import time


SUPPLIERS = {"harbor-supply": "Harbor Supply", "cedar-parts": "Cedar Parts"}
GRAMMAR = re.compile(
    r"PAY ([0-9]{1,9}\.[0-9]{2}) USD TO ([a-z][a-z0-9-]{0,63}) "
    r"FOR ([A-Za-z0-9][A-Za-z0-9-]{0,63}) AS ([A-Za-z0-9][A-Za-z0-9-]{0,63})",
    re.ASCII,
)


@dataclass(frozen=True)
class Proposal:
    amount_cents: int
    supplier: str
    invoice: str
    request: str


def parse(text):
    if not isinstance(text, str) or len(text) > 1024:
        raise ValueError("Use one payment command, up to 1,024 characters.")
    match = GRAMMAR.fullmatch(text.strip())
    if not match:
        raise ValueError("Use PAY 1250.00 USD TO harbor-supply FOR inv-104 AS req-001. No extra instructions.")
    amount, supplier, invoice, request = match.groups()
    dollars, cents = amount.split(".")
    value = int(dollars) * 100 + int(cents)
    if value <= 0:
        raise ValueError("The payment must be greater than zero.")
    return Proposal(value, supplier, invoice, request)


class Session:
    """Check and append share a lock; all authority lives outside proposal text."""

    def __init__(self, clock=time.time):
        self.clock = clock
        self.created_at = clock()
        self.expires_at = self.created_at + 15 * 60
        self.limit_cents = 2_500_000
        self.company_budget_cents = 100_000_000
        self.revoked = False
        self._ledger = []
        self._attempts = []
        self._lock = threading.Lock()

    def _snapshot(self):
        spent = sum(row["amount_cents"] for row in self._ledger)
        return {
            "simulation": True,
            "proposer": "scripted",
            "grant": {
                "status": "revoked" if self.revoked else "expired" if self.clock() >= self.expires_at else "active",
                "limit_cents": self.limit_cents,
                "remaining_cents": self.limit_cents - spent,
                "expires_at": self.expires_at,
                "suppliers": dict(SUPPLIERS),
            },
            "company_budget_cents": self.company_budget_cents,
            "spent_cents": spent,
            "ledger": [dict(row) for row in self._ledger],
            "attempts": [dict(row) for row in self._attempts],
        }

    def snapshot(self):
        with self._lock:
            return self._snapshot()

    def revoke(self):
        with self._lock:
            self.revoked = True
            return self._snapshot()

    def submit(self, text, note=""):
        if not isinstance(note, str) or len(note) > 4096:
            raise ValueError("Supporting text must be at most 4,096 characters.")
        with self._lock:
            if len(self._attempts) >= 200:
                raise ValueError("This local session has reached 200 attempts. Start a new session.")
            proposal = None
            try:
                proposal = parse(text)
                code, reason = self._check(proposal)
            except ValueError as error:
                code, reason = "INVALID_COMMAND", str(error)
            allowed = code == "RECORDED"
            event = {
                "number": len(self._attempts) + 1,
                "command": text if isinstance(text, str) else "[invalid input]",
                "note": note,
                "result": "recorded" if allowed else "refused",
                "code": code,
                "reason": reason,
                "at": datetime.fromtimestamp(self.clock(), timezone.utc).isoformat(),
            }
            if allowed:
                self._ledger.append({
                    "entry": len(self._ledger) + 1,
                    "request": proposal.request,
                    "invoice": proposal.invoice,
                    "supplier": proposal.supplier,
                    "amount_cents": proposal.amount_cents,
                    "at": event["at"],
                })
            self._attempts.append(event)
            return {"decision": dict(event), "state": self._snapshot()}

    def _check(self, proposal):
        if self.revoked:
            return "REVOKED", "The person in charge withdrew this authority. Nothing was recorded."
        if self.clock() >= self.expires_at:
            return "EXPIRED", "The 15-minute authority window has ended. Nothing was recorded."
        if proposal.supplier not in SUPPLIERS:
            return "SUPPLIER_NOT_ALLOWED", "This supplier is outside the approved list."
        if any(row["request"] == proposal.request for row in self._ledger):
            return "DUPLICATE_REQUEST", "This request already produced a ledger entry. It cannot pay twice."
        if any(row["invoice"] == proposal.invoice and row["supplier"] == proposal.supplier for row in self._ledger):
            return "DUPLICATE_INVOICE", "This supplier's invoice has already been paid, even if the request name changed."
        spent = sum(row["amount_cents"] for row in self._ledger)
        if proposal.amount_cents > self.limit_cents - spent:
            return "BUDGET_EXCEEDED", "This payment would exceed the total delegated allowance. Splitting payments doesn't increase it."
        return "RECORDED", "Within the remaining allowance and approved supplier list. One simulated ledger entry was recorded."
