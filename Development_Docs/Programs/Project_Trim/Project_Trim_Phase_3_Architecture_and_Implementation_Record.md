---
title: Project Trim Phase 3 Architecture and Implementation Record
audience: engineering
status: current
canonical_for: project-trim-phase-3-architecture
last_reviewed: 2026-08-18
---

# Project Trim Phase 3 - Carry the Logbook

## Governing boundary

Phase 3 implements the Phase Capsule, read/search ledger, bounded expansion, and workstream-slice requirements from Project Trim v1.0-R1 Sections 17 through 19 and 24 through 28. It extends agent context only. Current source and governing authority remain controlling, and Sounding Line remains the sole `RELEASE_GO` and protected-merge authority.

Phase 4 is not started. This increment does not add continuous learning, retention across unrelated tasks, or any independent release authority.

## Accepted capsule and startup

`Development_Docs/Programs/Project_Trim/Project_Trim_Phase_2_Accepted_Capsule.json` is the retained canonical Phase 2 capsule. It binds the accepted protected-main commit `d3c06e076fda99f7c18baa28e66847f4e79697fa` and tree `d9c0c0aff8bc623f1aaab3cc40c21043dd13c2c2`; it is a historical record, not a mutable current-state summary. `scripts/agent-context/phase-capsule.mjs` produces canonical accepted or explicitly provisional capsules, while `packet-v2.mjs` discovers the retained capsule for Project Trim Phase 3 startup and preserves its identity in the prior-plateau slice.

## Logbook contracts

`scripts/agent-context/logbook.mjs` provides the reusable API and `logbook-cli.mjs` provides task-local JSON operations. A logbook records bounded summaries, source identities, coverage, exact-text status, searches, unresolved questions, and classified expansion decisions. It reuses a prior read only when source identity is unchanged and no exact-text, partial-coverage, mainline-crossing, contradictory, low-confidence, or security re-verification exception applies. Scope-changing expansion without explicit authorization fails closed.

The workstream API emits a minimal capsule-aware slice with owned contracts, authority, sources, test constraints, allowed expansion, escalation rules, and a distilled return contract. Slices reject overlapping mutable ownership, copied parent context, shared governing ambiguity, and work too small to amortize delegation.

## Privacy, determinism, and evidence

Secret-like keys and credential-shaped values are redacted before capsule, ledger, slice, or return material is persisted. Logbooks are task-local derived context and do not retain raw prompts, private content, or raw logs. Canonical key ordering and digest fields make capsule, slice, and ledger outputs deterministic for identical inputs.

`benchmark-phase3.mjs` compares a Phase 2 ordinary prior-status startup with Phase 3 accepted-capsule startup and exercises unchanged versus changed-identity reuse. It records exact bytes, pointer counts, and process timing; whole-project-search avoidance and total task-token savings remain unavailable without comparable live task replays.
