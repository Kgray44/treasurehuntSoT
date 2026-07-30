---
title: Project Sounding Line Phase 4 Preparation Design Record
audience: engineering
status: planned
canonical_for: sounding-line-phase-4-preparation
last_reviewed: 2026-07-29
---

# Project Sounding Line Phase 4 Preparation Design Record

## Status and boundary

**Program:** Project Sounding Line
**Phase:** Phase 4, Prove the Passage
**Status:** PREPARATION ONLY - NONAUTHORITATIVE
**Original base:** `3d26ebc697a89efd7ff19d28399f3d41e32e423e`
**Accepted Phase 3 mainline:** `0aad93f49eae6a39db2571ccbbc79c850c565a6e`
**Phase 3 policy identity:** `testing/policy-manifest.json` version `1.1.0`, SHA-256 `c0cf74d2c24e23a2bd0a2d40a6efee0a9c342ac5c2576f49f61301abc726c946`

This record defines the future release and distributed-execution design. It does
not activate CI, create a workflow, connect a worker, issue a release decision,
alter branch protection, sign evidence, change `npm run validate`, or retire the
legacy harness. The serialized legacy harness remains authoritative.

## Governing inputs

The consolidated governing record is the applicable equivalent of Sounding Line
Parts I through III: its proof meaning controls evidence, its runtime section
controls isolation and scheduling, and its CI/release section controls future
authority. This preparation also reads the accepted Harborlight handoff, current
testing architecture, release validation policy, security/privacy policy,
Ledgerlight records, and Breakwater-owned release boundaries. Project Drydock
continues to govern authored Chronicle validity; Sounding Line governs software
verification only.

Phase 1, Phase 2, and Phase 3 are **ACCEPTED AND MAINLINE**. Phase 3 supplies
schema-2 history, evidence intelligence, deterministic planning, capacity
governance, durable control, and completion-report validation. Phase 4 consumes
those interfaces without redefining their proof meaning. Phase 2 remains the
local runtime foundation:
it supplies the local, single-host, sealed-plan, allowlisted-adapter, resource
lease, process-ownership, clone-isolation, browser/server-identity, cleanup,
and quarantine foundations. Phase 3 is **PREPARATION COMPLETE /
IMPLEMENTATION NOT STARTED**. Phase 4 is **PREPARATION COMPLETE /
IMPLEMENTATION NOT STARTED**. Neither preparation state is an accepted
implementation or release-authority claim.

## Prepared record set

| Record                                 | Future responsibility                                            | Current effect               |
| -------------------------------------- | ---------------------------------------------------------------- | ---------------------------- |
| CI and distributed worker architecture | provider-neutral controller, capability dispatch, lifecycle      | design only                  |
| Worker trust and security model        | enrollment, least privilege, revocation, hostile-worker handling | design only                  |
| Dual-run comparison                    | prove equivalence with the legacy harness                        | no dual run executed         |
| Release decision model                 | future decisions, vetoes, and authority                          | synthetic examples only      |
| Cutover and rollback                   | staged authority and emergency serial preservation               | legacy remains authoritative |
| Performance and capacity               | budget observation and capacity experiments                      | no worker provisioning       |
| Evidence retention                     | manifest, integrity, privacy, retention, and revocation          | no signing key               |
| Incident playbook                      | stop-work, exception, investigation, and recovery                | no live incident system      |
| Final acceptance matrix                | eventual gate ownership and evidence                             | not an acceptance result     |

The JSON schema drafts in `Phase_4_Drafts/` are non-networked data-shape
definitions. They contain no endpoint, credential, token, or executable
workflow. They are validated only as preparation artifacts.

## Non-negotiable future invariants

1. Same source, sealed policy, and declared environment must yield the same
   applicable plan and final decision locally and in CI.
2. A worker can execute only a node allowed by its trust class and verified
   capability profile; absence or ambiguity is a veto, not an assumed match.
3. Missing mandatory test, contract, cleanup proof, source identity, or
   evidence-chain element invalidates the decision.
4. External unavailability remains `RELEASE_INCOMPLETE` or
   `RELEASE_GO_WITH_EXTERNAL_PENDING` only under the future policy; it is never
   a pass by omission.
5. The legacy harness and emergency serial mode remain recoverable through the
   full observation period after any future authority change.

## Accepted Phase 2 assumptions

Phase 4 design consumes the final 14-suite, 17-contract, and 19-resource
catalogue. It assumes only the reviewed product adapters in
`scripts/sounding-line/adapters.mjs`, never caller-supplied executables.
Phase 2 leases are lane-specific and atomic, retain run/controller identity,
and write allocation, adapter, release, cleanup, and quarantine receipts.
Process ownership requires PID, start time, boot identity, controller identity,
and command fingerprint, preventing PID-reuse cleanup. SQLite clones, browser
contexts, traces, storage, and loopback servers are run-owned; server shutdown
requires the retained handle and matching token.

The two certified Harborlight browser lanes are execution-isolation evidence:
separate mirrors, SQLite copies, Chromium trees, artifacts, storage state, and
listeners. They are not Phase 4 dual-run authority evidence, local/CI parity,
distributed-worker proof, or release cutover. Focused Phase 2 lanes may narrow
their reviewed resource locks, while `npm run validate` retains the global
full-release lock and remains the emergency-serial authority.

The current Feature Catalog includes Sounding Line. The retained
`P34-BME-20260729` browser-matrix exception and external-provider/MySQL debt
remain explicit blockers or pending evidence; neither becomes a pass by
integration, planning, or focused certification.

## Handoff

Implementation may begin only after accepted Phases 2 and 3, sufficient
dual-run evidence, completed security/privacy review, proven local/CI parity,
and proven rollback/emergency-serial recovery. The prerequisite checklist and
final acceptance matrix are the controlling handoff artifacts.
