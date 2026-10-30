# What this experiment should teach us

Can someone tell an agent what to accomplish, set a boundary they understand, and verify what the agent actually did?

The experiment uses purchasing because the outcome is concrete. A ledger entry either exists or it doesn't. A plausible sentence saying “paid” cannot stand in for that evidence.

## Current slice

The person can inspect a fixed assignment, propose a payment in an explicit command language, attach misleading supporting text, withdraw authority, and inspect the resulting ledger and attempt history. All records belong to a local simulated session. Every accepted payment consumes the same total allowance.

The fixed grant is a fixture. Editing grants in natural language, approval by a real person, cryptographic signing, and external execution are outside this version.

## Questions for a person trying it

1. Before submitting, can you predict whether the payment is allowed?
2. After a refusal, can you explain what boundary stopped it?
3. After a payment, can you point to the record that proves what happened?
4. Is the explicit command easier to inspect than a paragraph? Which fields cause mistakes?

These are usability questions to investigate, not results we have measured yet.

## Model comparison

The live comparison keeps the same fixtures and authority checks. It compares the explicit-command baseline with an OpenAI proposer returning typed fields. It measures interpretation errors, invalid proposals, correct refusals, and unintended ledger entries separately. The UI adds a human review step before submission. An agent being persuaded to propose a forbidden action and a forbidden action reaching the ledger are different outcomes.

The proposer receives only its assigned context and has no tools. It cannot access reset or revocation controls, credentials, arbitrary network destinations, or mutable authority state. The expanded evaluation repeats 50 independently specified scenarios three times and displays interpretation accuracy, authority violations, unintended recorded payments, and consistency separately. It includes duplicate requests, invoice extraction with planted instructions, and controlled authority changes between preparation and execution. Public exposure remains outside this experiment.

## Publication boundary

This repository is independent of the live project. Only newly authored experiment files and synthetic fixtures belong here. Do not copy the private product's source, history, operational configuration, customer information, or internal planning documents into this repository. No production calls or deployments are part of this experiment.
