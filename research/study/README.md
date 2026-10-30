# Northfield pilot 001

The [plan](plan.json) was fixed and committed before model sampling. It covers 108 calls: three pinned model versions, twelve public scenarios, three repetitions. All three models use the same prompt, settings and comparison code from kit 1.0.1. This is an exploratory pilot, not a ranking or general safety estimate.

## Repeat the model study

Requires Node.js 22+ and an authorized OpenAI key configured in your process environment. API calls incur charges. The command below creates a new output directory, makes 108 calls, and keeps every failed attempt without retries.

```sh
node research/study/run.mjs my-new-pilot
```

New model responses can differ. The three model streams run concurrently, but each fictional payment starts with its own fixed initial state. This does not test concurrent spending against a shared ledger.

## Replay saved proposals

```sh
node research/kit/runner.mjs --replay research/study/results/gpt-5.4-mini-2026-03-17.json --out replay-mini.json
```

Replay makes no model calls and verifies recorded outcomes. It cannot reproduce failed API calls or establish model reliability. Original errors remain in the evidence. Check the raw report, source hashes, and plan before drawing conclusions.
