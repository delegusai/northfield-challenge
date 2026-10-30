# Northfield purchasing lab

Ask a simulated purchasing agent to pay an invoice. Give it an instruction to ignore its limit. See whether a payment actually reaches the ledger.

This is an independent, local experiment in human-agent language and bounded authority. The proposer is scripted. There is no language model, real payment system, production connection, or Delegus protocol implementation here.

## Run it

Python 3.9 or newer is enough. There are no packages to install.

```sh
python3 server.py
```

Open the printed address, normally `http://127.0.0.1:8765`. To choose another port, use `python3 server.py --port 8766`. The server binds only to your own machine.

Try an allowed payment, then the same request again. Try a payment above the limit or to an unlisted supplier. Withdraw authority and try another payment. The ledger records accepted payments; refused attempts stay in the attempt history. Download the session evidence before resetting if you want to keep it.

All names and records in the lab are synthetic. The company starts with a simulated $1 million budget, while the purchasing assignment permits only $25,000 in total, across every invoice in that session. Authority lasts 15 minutes and can be withdrawn earlier. Restarting the server or starting a new session clears the relevant in-memory records.

## The first language

```text
PAY 1250.00 USD TO harbor-supply FOR inv-104 AS req-001
```

The command states an amount, currency, supplier, invoice, and request identifier. Amounts need two decimal places. The command words are uppercase. The approved supplier identifiers are `harbor-supply` and `cedar-parts`. Request and invoice names contain ASCII letters, digits, and hyphens, starting with a letter or digit, up to 64 characters.

This grammar is deliberately narrow. Ambiguous prose is refused, and an attached note is recorded as untrusted text. A future language model may translate a person's request into a proposal; the authority check must still run independently. This version does not test a model's resistance to prompt injection.

## What is measured

```sh
python3 -m unittest discover -s tests -v
```

The tests cover exact limits, split payments, replayed requests, duplicate invoices, supplier restrictions, revocation, expiry, session isolation, and simultaneous requests competing for the same allowance. A seeded sequence test exercises 1,600 proposals and checks ledger invariants after each attempt. HTTP tests check session cookies and reject unexpected hosts, cross-origin writes, and client-supplied authority fields.

Passing these tests is evidence about this simulator. It does not establish security of a language model, Delegus, a payment provider, or a public deployment.

## Boundaries

The check and ledger append happen under one process lock. Money uses integer cents. Browser text is rendered as text, never HTML. No part of a command or note is executed as code. The browser can propose an action, but it cannot supply a larger allowance in that request.

The person running the lab can withdraw authority and reset the entire exercise. Those are operator controls, not tools exposed to a model. This separation is a prototype convention, not authenticated role separation. A future model adapter needs a separate restricted interface.

Records are unsigned and ephemeral. This is a single-process local lab, not a public challenge service. There is no durable audit storage, login system, cross-process transaction control, or cryptographic receipt verification. It includes no deploy workflows, production credentials, copied private source, or private repository history.

See [the experiment plan](EXPERIMENT.md) for the questions to test next.
