# Northfield research kit 1.1.0

**[Delegus (@delegusai)](https://github.com/delegusai) · [@haqinam](https://github.com/haqinam)**

The pilot recorded 20 validation errors but discarded the rejected proposals and their token usage. This release makes those failures diagnosable in future runs. It cannot recover the pilot's missing outputs.

- Errors retain their category, stage, elapsed time, response status and available token fields.
- Optional `--capture-rejected-output` saves a bounded, redacted excerpt. Review reports before sharing; redaction is not exhaustive.
- Optional `--continue-on-error` attempts all planned slots with no retries. Any error still exits nonzero.
- Measurement totals distinguish attempted, unattempted, parseable and failed trials. Token coverage makes missing usage visible.
- The protocol, scenarios, model prompt and schema are unchanged. Old pilot code, data, paper, archives and release tags stay frozen. The website still uses 1.0.1.

## Get started

Download `northfield-research-1.1.0.zip`, extract it and run:

```sh
node runner.mjs --fixture --out demo.json
node runner.mjs --replay demo.json --out replay.json
```

These commands work offline. For your own agent and model runs, see the included README. Replay old pilot files with kit 1.0.1.

## Validation

The published 1.0.1 archive was downloaded into a clean folder, its manifest verified, and its fixture report replayed exactly. The pilot analysis still accounts for all 108 attempts. The 1.1.0 tests use synthetic provider responses to reproduce invalid commands, incomplete responses, malformed JSON, HTTP failures, timeouts, excessive response size and missing usage. No new billed model calls were made.
