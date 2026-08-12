---
title: Project Drydock Phase 3 Browser Qualification Record
audience: engineering
status: current
canonical_for: project-drydock-phase-3-browser-qualification
last_reviewed: 2026-08-12
---

# Project Drydock Phase 3 browser qualification record

## Environment and boundary

The qualification used a task-owned Creator account, task-owned Chronicle, task-owned SQLite database, isolated browser state, and a locally built `next start` runtime at `127.0.0.1:3114`. The Chronicle contained only synthetic content. The browser session and local server were finalized after the check.

This is local browser qualification evidence. It is not staging, deployment, live-provider, physical-device, owner-acceptance, protected-mainline, or exact-main proof.

## Observed successful flow

The authenticated Creator opened Sea Trials and:

- saved and ran a normal source-bound Scenario, receiving a redacted `PAUSED` receipt with one trace entry;
- replayed that frozen receipt, then compared the two receipts and observed compatible source lineage, matching result/adapter, and no semantic trace divergence;
- opened the coverage view and observed `INCOMPLETE_PROOF` plus bounded unsaved Scenario suggestions;
- saved the current Scenario revision as a source-bound Scenario Suite; and
- ran the Suite and received its individual safe receipt with the expected incomplete-proof notice.

Normal controls and labelled semantic regions were located through the browser during the flow. That supports the focused local interaction path, not an assistive-technology or device qualification.

## Defects found and repaired before the successful rerun

The first normal Scenario save exposed an invalid `maxVirtualMilliseconds` schema bound: the valid default one-day value exceeded the inherited generic count limit. The Scenario schema now applies its dedicated one-week virtual-time bound, and `schema.test.ts` verifies that default value.

The first Scenario Suite save exposed a Prisma client/model field that did not exist in the additive SQLite migration. The unused direct Scenario relation was removed from both Prisma schema variants, the client was regenerated, and the Phase 3 migration rehearsal now verifies the exact Scenario Suite member table and model shapes. The local browser flow was rebuilt and rerun successfully after that repair.

## Remaining acceptance boundary

Focused local qualification is complete. Full candidate qualification, one current-main reconciliation, serialized acceptance ownership, a single Sounding Line Mainline Decision, protected integration, exact-main proof, and the Phase 3 closure record remain required before any acceptance claim.
