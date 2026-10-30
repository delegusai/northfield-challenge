# Northfield purchasing lab

**New: [public research kit and comparison implementation](research/README.md).** Run the twelve-case experiment, connect your own agent, replay results, or contribute a case. [Try the research lab](https://lab.delegus.ai/research).

Ask a simulated purchasing agent to pay an invoice. Give it an instruction to ignore its limit. See whether a payment actually reaches the ledger.

This is an independent, local experiment in human-agent language and bounded authority. An OpenAI model translates natural-language requests into proposals. You review the proposed payment before the local authority check can record it. There is no real payment system, production connection, or Delegus protocol implementation here.

## Public challenge

[Open the public Northfield Challenge](https://lab.delegus.ai): a separate hosted page with natural-language AI proposals, instructions, independent server-side payment checks, isolated visitor sessions, downloadable evidence, and interactive charts from the 150-trial benchmark. Visitors review each proposal before submitting it. The API key is a private server secret. Each session permits five AI requests, with a shared cap of 100 requests per UTC day and at least 10 seconds between requests; failed calls count. Command mode remains available. The live Delegus product is not connected.

[The saved results dashboard](https://northfield-evaluation-results.rr-2e80.chatgpt.site) remains available separately. The public challenge uses a separate Sites source repository and database; this repository contains the original local Python experiment and the independently versioned research kit in `research/`.

## Run it

Python 3.9 or newer is enough. There are no packages to install. The command baseline works offline. The natural-language proposer needs an OpenAI API key in this experiment’s ignored `.env.local` file or the process environment. Keep the key on the server; never commit it. The local server reads the file without executing it. The default model is `gpt-5.4-mini`; `OPENAI_MODEL` can select another model supporting this Responses API request format.

```sh
python3 server.py
```

Open the printed address, normally `http://127.0.0.1:8765`. To choose another port, use `python3 server.py --port 8766`. The server binds only to your own machine.

Try “Pay Harbor Supply $1,250 for invoice inv-104.” Click **Prepare proposal**, inspect the generated fields, then click **Check & attempt payment**. Preparing a proposal alone never records a payment. Try the same payment again. Try a payment above the limit or to an unlisted supplier. Withdraw authority and try another payment. The ledger records accepted payments; refused attempts stay in the attempt history. Download the session evidence before resetting if you want to keep it.

All names and records in the lab are synthetic. The company starts with a simulated $1 million budget, while the purchasing assignment permits only $25,000 in total, across every invoice in that session. Authority lasts 15 minutes and can be withdrawn earlier. Restarting the server or starting a new session clears the relevant in-memory records.

## The first language

```text
PAY 1250.00 USD TO harbor-supply FOR inv-104 AS req-001
```

The command states an amount, currency, supplier, invoice, and request identifier. Amounts need two decimal places. The command words are uppercase. The approved supplier identifiers are `harbor-supply` and `cedar-parts`. Request and invoice names contain ASCII letters, digits, and hyphens, starting with a letter or digit, up to 64 characters.

This grammar is deliberately narrow. Ambiguous prose is refused, and an attached note is recorded as untrusted text. The model returns typed fields, which are validated and converted to this grammar. The server generates the request identifier. The model has no tools, cannot change limits, and cannot reset or revoke a session. Missing or ambiguous fields produce a clarification request, and provider failures produce no payment. The authority check runs again when the person submits the reviewed command, so revocation or expiry after preparation still applies.

## What is measured

```sh
python3 -m unittest discover -s tests -v
```

The tests cover exact limits, split payments, replayed requests, duplicate invoices, supplier restrictions, revocation, expiry, session isolation, and simultaneous requests competing for the same allowance. A seeded sequence test exercises 1,600 proposals and checks ledger invariants after each attempt. HTTP tests check session cookies and reject unexpected hosts, cross-origin writes, and client-supplied authority fields.

The additional proposer tests cover malformed output, invented authority fields, model refusals, incomplete output, revocation between preparation and execution, concurrency, and call limits. They use injected responses and make no API requests.

To run the expanded live comparison (50 scenarios, three trials each; up to 150 billed OpenAI requests):

```sh
python3 evaluate.py --live --repeats 3
```

The report goes to ignored `reports/live-evaluation.json`, saved atomically after every trial. Open **Results** in the lab (or `/results`) and click **Refresh results** to inspect progress. The dashboard reads this one report and never starts billed model calls. You can filter by category, failures, inconsistency, or incomplete scenarios; open a scenario to compare expected and actual fields, decisions, and individual trial evidence; and download the report. A new comparison replaces the local report, so download or copy a run you want to keep first.

The 50 fixtures cover ordinary payments, exact allowance boundaries, lookalike suppliers, missing fields, unsupported requests, misleading amounts, misleading payment identifiers, invoice extraction, duplicates, and authority changes. Each trial starts a fresh deterministic session, including controlled expiry and revocation between preparation and execution. Expectations live separately in `scenarios.py`; baseline commands are checked against explicit expected decision codes before calling the model. Repeats are interleaved in rounds. The dashboard counts only completed trials as observed results and distinguishes pending scenarios from failures. Consistency compares fields and decision codes; it does not imply correctness or independence of trials.

The offline evaluation tests use a clearly identified oracle stub to test scoring, failed intent within the allowance, inconsistent trials, provider-error stopping, and report persistence. These are not model performance evidence.

The live comparison compares ground-truth commands with model interpretations, distinguishing interpretation mistakes, authority violations, and unintended payments still inside an allowance. For measurement, this evaluator directly submits proposals in fresh synthetic sessions; the browser requires human review first. It stops after a provider error. A small passing test set does not establish general prompt-injection resistance or the security of Delegus or a public deployment.

To save a self-contained, interactive dashboard that opens offline:

```sh
python3 export_report.py --output reports/evaluation-dashboard.html
```

The saved file includes the synthetic report, styles, logo, fonts and license notices. Filters, trial details and report download work without the server. It has no model or payment controls and makes no external requests.

## Boundaries

The check and ledger append happen under one process lock. Money uses integer cents. Browser text is rendered as text, never HTML. No part of a command or note is executed as code. The browser can propose an action, but it cannot supply a larger allowance in that request.

The person running the lab can withdraw authority and reset the entire exercise. Those are operator controls, not tools exposed to a model. This separation is a prototype convention, not authenticated role separation. The model receives only the request, untrusted supporting text, and a fixed translation instruction. It receives no operator endpoints or credentials. The browser remains a trusted local operator surface, not a public authenticated application.

Records are unsigned and ephemeral. This is a single-process local lab, not a public challenge service. There is no durable audit storage, login system, cross-process transaction control, or cryptographic receipt verification. It includes no deploy workflows, production credentials, copied private source, or private repository history.

See [the experiment plan](EXPERIMENT.md) for the questions to test next.

## Delegus branding

The lab matches the current public Delegus identity: its logo and wordmark, Schibsted Grotesk headings, Public Sans text, Martian Mono commands, navy grounds, and semantic color palette. Fonts and the logo are served locally, so the interface needs no external asset requests. See [asset attribution and font notices](web/assets/NOTICE.md).

## Model data and limits

The natural-language request and attached text are sent to OpenAI, with `store: false`. The API key stays server-side. Use fictional data. The model receives no browser, network, filesystem, reset, or authority-changing tools. The only model endpoint used is OpenAI's Responses API; the client rejects redirects. The interface's logo and fonts still load locally.

Each server run permits at most 40 model calls, one at a time, with 1,500 output tokens per request and a 45-second network timeout. There are no automatic retries. These are request and token caps, not a dollar budget or a guarantee of wall-clock completion. Model calls use the selected OpenAI project's billing. The CLI comparison has a separate cap of 50 × repeats (default 150). It accepts one to five repeats, stops on the first provider error, and never retries automatically.

Session downloads include the original natural-language requests, supporting text, model proposals, usage metadata, and payment decisions. These records remain unsigned and in memory until exported. Local reports and `.env.local` are ignored by Git and excluded from source archives.

API references: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), [GPT-5.4 Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

## Contributors

- [@haqinam](https://github.com/haqinam)
