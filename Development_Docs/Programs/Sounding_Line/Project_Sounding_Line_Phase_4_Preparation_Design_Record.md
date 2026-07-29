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
**Base:** `integration/sounding-line-phase1-phase2-mainline` at `3d26ebc697a89efd7ff19d28399f3d41e32e423e`

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

Phase 1 is the inventory and deterministic-plan foundation. Phase 2 is the
local, single-host, sealed-plan and lease foundation. Their integration is the
source baseline, not a claim of final acceptance. No Phase 3 preparation record
is available at this base; Phase 3 remains an explicit prerequisite.

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

## Handoff

Implementation may begin only after accepted Phases 2 and 3, sufficient
dual-run evidence, completed security/privacy review, proven local/CI parity,
and proven rollback/emergency-serial recovery. The prerequisite checklist and
final acceptance matrix are the controlling handoff artifacts.
