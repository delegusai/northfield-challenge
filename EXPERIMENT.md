# What this experiment should teach us

Can someone tell an agent what to accomplish, set a boundary they understand, and verify what the agent actually did?

The first slice uses purchasing because the outcome is concrete. A ledger entry either exists or it doesn't. A plausible sentence saying “paid” cannot stand in for that evidence.

## Current slice

The person can inspect a fixed assignment, propose a payment in an explicit command language, attach misleading supporting text, withdraw authority, and inspect the resulting ledger and attempt history. All records belong to a local simulated session. Every accepted payment consumes the same total allowance.

The fixed grant is a fixture. Editing grants in natural language, approval by a real person, cryptographic signing, and external execution are outside this version.

## Questions for a person trying it

1. Before submitting, can you predict whether the payment is allowed?
2. After a refusal, can you explain what boundary stopped it?
3. After a payment, can you point to the record that proves what happened?
4. Is the explicit command easier to inspect than a paragraph? Which fields cause mistakes?

These are usability questions to investigate, not results we have measured yet.

## Next comparison

Keep the same fixtures and authority checks. Compare this explicit-command baseline with a natural-language proposer that must return the same typed fields. Measure interpretation errors, invalid proposals, correct refusals, and unintended ledger entries separately. An agent being persuaded to propose a forbidden action and a forbidden action reaching the ledger are different outcomes.

The proposer must receive only its assigned context and a restricted payment-submission tool. It must not receive reset or revocation controls, credentials, arbitrary network access, or mutable authority state. Any model integration needs a separate evaluation before public exposure.

## Publication boundary

This repository is independent of the live project. Only newly authored experiment files and synthetic fixtures belong here. Do not copy the private product's source, history, operational configuration, customer information, or internal planning documents into this repository. No production calls or deployments are part of this experiment.
