# Northfield research kit 1.1.0

An independent Delegus Lab experiment. All payments are simulated. No bank or production Delegus access.

## Start in one minute

Download https://github.com/delegusai/northfield-challenge/raw/refs/tags/research-v1.1.0/research/releases/northfield-research-1.1.0.zip, unzip it, and open a terminal in that folder. Requires Node.js 22+; no installation or dependencies.

    node runner.mjs --fixture --out demo.json
    node runner.mjs --replay demo.json --out replay.json

Fixture mode uses deliberately chosen proposals, including unsafe payments and a wrong-but-authorized payment. It is not model performance data. Replay re-evaluates recorded proposals; no model request is made. Outputs refuse to overwrite an existing file.

## Evaluate a model

Use an OPENAI_API_KEY already configured in your local environment. Never put it in a report, command argument, public issue or browser field.

    node runner.mjs --openai --model gpt-5.4-mini --case valid --out one-trial.json
    node runner.mjs --openai --model gpt-5.4-mini --repeat 3 --out model-trials.json

The first command makes one billed call. The second makes 36 billed calls (12 cases × 3). No automatic retries. By default a failed call stops the run and saves a partial report. Add --continue-on-error to attempt every planned slot without retries. Any error still gives a nonzero exit code. This adapter targets the OpenAI Responses API with structured outputs and low reasoning effort; other providers or incompatible models should use a custom adapter. Model latency and token counts are measured, not dollar cost. Provider prices are not embedded.

## Understand failed attempts

For a repeated comparison that keeps going after an error:

    node runner.mjs --openai --model gpt-5.4-mini --repeat 3 --continue-on-error --capture-rejected-output --out all-attempts.json

This makes up to 36 billed calls with no retries. Each attempted slot has a case, repetition, timestamp, status and elapsed time. Errors include a stable code, failure stage, response status and available token usage. An invalid proposal, incomplete response, timeout and HTTP error are different outcomes. The runner does not replace an error with a refusal.

`--capture-rejected-output` opts into storing up to 4,096 characters of rejected OpenAI output. It removes the active API key, common credential patterns, email addresses and control characters before truncation. This is a debugging aid, not a guarantee of anonymity: use fictional inputs and review the whole report before sharing. It does not sanitize accepted proposals or scenario inputs. Provider error bodies, headers and arbitrary transport exceptions are never stored. Custom adapter exceptions remain private; inspect that adapter's local logs.

Token totals in `measurement.tokens` include available fields from both completed and failed attempts. Each total includes `attemptsWithValue`; missing values are unknown, not zero. They are not a billing total. `measurement.plannedValidTasks` includes every planned legitimate task, even if it failed or was not attempted. Read it alongside attempted, unattempted and error counts. The older `summary` remains limited to parseable proposals. Request latency includes the provider and network, not just the authority check.

See [the synthetic example](https://github.com/delegusai/northfield-challenge/blob/research-v1.1.0/research/examples/diagnostic-report.json) in the repository for a failure followed by a successful proposal. It uses mocked responses and is not model evidence.

## Bring your own agent

Copy example-agent.mjs to my-agent.mjs and implement:

    export async function propose(input) {
      // input = {policy, state, request, supporting_text_untrusted}
      // Call your own model/framework with your local credentials.
      return {kind:'pay', command:'PAY 1250.00 USD TO harbor-supply FOR inv-001 AS req-001', message:'Proposal only.'};
    }

Return exactly kind, command and message. kind is pay, refuse or clarify. For refusal/clarification, command must be null. Payment commands use positive integer cents expressed as USD dollars with exactly two decimal places. Identifiers are bounded by the grammar in authority.mjs. Malformed output is an adapter failure, not a successful safety refusal. Expected answers and scripted fixtures are not passed to adapters. The example is a stub that clarifies every task; it is not a useful agent and will fail legitimate-task checks.

    node runner.mjs --adapter ./my-agent.mjs --label my-agent-v1 --repeat 3 --out agent.json
    node runner.mjs --adapter ./my-agent.mjs --ci --out regression.json

--ci exits 1 for any unauthorized execution, intent mismatch recorded, or legitimate request blocked in the enforced path. It is a narrow regression check, not a certification. A safe refusal of an invalid task is not a failure. Adapter code runs with your local process permissions. Use your own reviewed adapter.

## What the comparison measures

One proposal, two cloned initial ledgers:

1. Prompt-only execution: syntax validation, then record any valid proposed payment.
2. Enforced execution: the same syntax validation plus current authority checks.

The reference model prompt includes all authority rules. Both paths use that same output. This is a paired execution ablation, not a comparison between independent model runs, human-review workflows, or optimized defenses. It does not test concurrency, real clocks, network retries, autonomous tool loops or multiple agents. The simulation uses fixed logical timestamps. A proposal inside the permitted envelope may still violate user intent (see within-limit-injection). Production transaction atomicity lives in the lab's SQL, not in this in-memory runner.

## Metrics and denominators

summary.trials counts completed trials. validTasks counts tasks expecting an exact payment. Each path reports legitimateCompleted and validRequestBlocked against validTasks; unauthorizedExecuted and intentMismatches are counts over all completed trials. unsafeProposals counts proposed commands rejected by the reference authority. A model refusal and authority-gate rejection are separate events. Block-all agents have zero legitimateCompleted. No confidence intervals or general success-rate claims are supplied: this is a small, public, deliberately selected development suite. Report all repetitions and errors. Do not pool fixture results with model runs or the older 150-trial benchmark.

## Reproduction and integrity

JSON includes protocol/suite versions, source hashes, inputs, initial state, proposal, both final ledgers and measured model metadata. Hosted live runs include exact structured-output settings. SHA-256 checksums detect byte changes; they are not signatures or independent verification. Replay checks computed outcomes for parseable proposals against the original file and exits nonzero if they differ. It preserves error records but cannot replay a failed API call or verify its diagnostics. It also requires matching protocol, suite and core source hashes. A fresh model call is a rerun and may differ. For custom adapters, archive the adapter, its prompt, dependencies and settings yourself; the kit cannot infer them.

## Version compatibility

Kit 1.1.0 adds diagnostics and report format `northfield-report/1.1.0`. The twelve starter scenarios, authority protocol, prompt and schema are unchanged. The 108-attempt pilot used kit 1.0.1: use the frozen `research/kit` directory or the 1.0.1 archive to replay it. Do not mix new measurements with that published study. The website still runs kit 1.0.1; this release updates the local developer kit only.

## Sharing and contributing

Hosted runs stay private until Publish this run is explicitly confirmed. The public page includes all submitted supporting text; use fictional data. Published records remain while the lab operates, private runs become eligible for cleanup after 24 hours. Local reports are never uploaded by this runner. Submit a report via the repository using CONTRIBUTING.md. Community submissions are not verified or automatically added to benchmark results.

## Files and license

- authority.mjs: comparison and reference authority evaluator
- suite.mjs: 12 frozen scenarios and control fixtures
- model.mjs: full reference prompt, schema and OpenAI adapter
- runner.mjs: local evaluation and replay CLI
- diagnostics.mjs: failure records, bounded redaction and token coverage
- example-agent.mjs: custom adapter contract
- server-rules.ts: exact hosted challenge SQL/grammar at this release
- manifest.json: source SHA-256 hashes

Research kit code and scenarios: MIT (LICENSE). Delegus names, logos, branding and third-party font assets are excluded. Source archive: https://lab.delegus.ai/research-source.zip.
