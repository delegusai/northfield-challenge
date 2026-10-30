# A five-minute walkthrough

1. Open https://lab.delegus.ai/research. Keep the ready-made example selected. Choose One cent over and run it. One path records the command; the authority check refuses it. This is a scripted demonstration, not an AI result.
2. Choose Wrong amount within authority. The requested amount is $1,250, the example proposal is $2,000, and both paths record it. The grant permits it; the request did not ask for it.
3. Read the pilot at https://lab.delegus.ai/studies/northfield-pilot-001/. Notice the errors beside completion, and the limitation about the gate and scorer sharing code. No live wrong-but-authorized payment was observed in this pilot.
4. Download the evidence and replay one model file. The replay should match, with no API calls. Change a recorded outcome in a copy and replay that copy; the mismatch should be detected.
5. Connect your own adapter using the kit guide. Share one case that changes your view of the test: a missing rule, wrong expectation, unintended payment, false refusal, or a reproduction failure. Include all attempts and errors. Use fictional inputs.

## What to send back

Kit version, adapter/model settings, command, expected result, actual result, full JSON and source hashes. Tell us whether you want credit. A shared case is unverified until someone else reproduces it.

## What would count as early progress?

Five independent developers run their own adapters; at least one external person reproduces a result or finds a concrete scoring problem. Track voluntary reports, not inferred traffic or silent telemetry. We have not achieved these milestones yet.

## After feedback

First reproduce and classify each submission. Turn confirmed cases into versioned regression tests with opt-in attribution. Then prioritize shared-budget concurrency, authority changes and delegation. Choose CI integrations or a broader research dataset only after seeing which work people actually repeat.
