# Test your agent with Northfield

Can your agent complete a valid payment and stay within the limits you set? This small public experiment gives you the code and evidence to check.

[Try it in your browser](https://lab.delegus.ai/research) or run the same comparison locally. All payments are fictional. The kit has no access to the live Delegus product or any payment system.

## Start here

Use Node.js 22.18 or newer (native TypeScript support is needed only for the test suite). The runner has no dependencies.

```sh
git clone --branch northfield-challenge https://github.com/delegusai/northfield-challenge.git
cd northfield-challenge
node research/kit-1.1.0/runner.mjs --fixture --out demo.json
node research/kit-1.1.0/runner.mjs --replay demo.json --out replay.json
```

These commands make no AI calls. They use chosen examples to show how the checks work; they do not measure model performance. Output files must not already exist.

## Use your own agent

Follow [the adapter guide](kit-1.1.0/README.md#bring-your-own-agent). The agent sees the task and policy, never the expected answer. Your credentials and reports stay on your machine unless you choose to share them.

```sh
node research/kit-1.1.0/runner.mjs --adapter ./my-agent.mjs --repeat 3 --out agent.json
node research/kit-1.1.0/runner.mjs --adapter ./my-agent.mjs --ci --out regression.json
```

The CI check fails for unauthorized execution, wrong payments, or valid tasks left uncompleted in the enforced path. It is a development check, not security certification.

## What is in this release?

- [Research kit 1.1.0](releases/northfield-research-1.1.0.zip), with failed-attempt diagnostics and optional redacted output capture. The hosted lab and frozen pilot still use [1.0.1](releases/northfield-research-1.0.1.zip).
- [Readable comparison engine](kit-1.1.0/authority.mjs), [twelve scenarios](kit-1.1.0/suite.mjs), and [full model prompt](kit-1.1.0/model.mjs).
- [Hosted payment SQL](server/rules.ts) and tests comparing its decisions with the portable engine.
- [Sanitized site source](releases/northfield-site-source-3bbbc9b.zip), from hosted commit 3bbbc9b. Hosting identity, keys, dependencies, branding assets and runtime data are excluded. It documents the app; the kit above is the immediately runnable download.

```sh
node --test research/tests/*.test.mjs
```

## Read the results carefully

Both paths receive the same proposal and initial payment history. One checks command syntax; the other also checks authority. This isolates the extra check for that proposal. It does not compare independently trained agents, real payments, or human review workflows.

The public suite is small and deliberately selected. It does not establish general model reliability. The current intent metric checks amount, supplier and invoice; it does not score request-ID fidelity. A payment can be within authority and still be wrong. See the [full methodology and limits](kit-1.1.0/README.md).

## Contribute

[Open a research issue](https://github.com/delegusai/northfield-challenge/issues/new) with fictional inputs, all attempts, expected behavior, actual behavior and a replayable report. [Contribution guide](kit/CONTRIBUTING.md). Credit is opt-in; submissions need independent reproduction before acceptance.

Research kit code and scenarios use the [MIT license](kit/LICENSE). This does not grant rights to Delegus branding or third-party assets. The older Python experiment and its 150-trial report remain separate.

## First comparison study

[Read the 108-attempt pilot](study/RESULTS.md), inspect all model records, or [explore the charts](https://lab.delegus.ai/studies/northfield-pilot-001/). It keeps errors visible and makes no general model-ranking claim.

## Diagnose errors without hiding them

[Kit 1.1.0 diagnostics](kit-1.1.0/README.md#understand-failed-attempts) preserve error categories, elapsed time and available token usage. Optional redacted excerpts help diagnose rejected model proposals. [Synthetic report example](examples/diagnostic-report.json); [release notes](releases/research-v1.1.0.md). No new live model comparison is claimed by this release.

## Contributors

- [@haqinam](https://github.com/haqinam) — Coder
