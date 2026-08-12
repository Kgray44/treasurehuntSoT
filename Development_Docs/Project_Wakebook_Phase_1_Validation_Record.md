---
title: Project Wakebook Phase 1 Validation Record
audience: product-engineering
status: current
canonical_for: project-wakebook-phase-1-validation-record
last_reviewed: 2026-08-12
---

# Project Wakebook Phase 1 validation record

## Decision

**Current classification: OWNER_ACCEPTED - EXTERNAL MAINLINE NO-GO.** The Wakebook unit/component families and the exact isolated browser journey remain passing, including checksum-bound visual evidence. The task owner explicitly accepted Phase 1 on 2026-08-12. The independently owned Helm invitation-handoff repair is accepted on `origin/main`, and Wakebook has reconciled that and all subsequently accepted mainline work. Fresh governed local qualification nevertheless exposes an independently owned root static-compilation defect in accepted Bridgewatch integration. This record does not establish deployment, protected-main integration, or a release decision.

## Source identity

| Field                           | Value                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| Branch                          | `codex/project-wakebook-phase1-open-the-wake`                                                 |
| Owned worktree                  | `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\project-wakebook-phase1-open-the-wake` |
| Reconciled accepted-main base   | `fb0f13e35fcdd98434d22c357aee02f24d6d9036`                                                    |
| Reconciliation merge SHA        | `6d3547b690dab5c35c9cee04a70809fa462ae8cf`                                                    |
| Latest authority run            | `31572273321` (`EVIDENCE_INVALID`, historical)                                                |
| Next authority candidate        | Frozen only after final local qualification, remote parity, and a final `origin/main` fetch   |
| Archive implementation anchor   | `629f5c7a981b80494f7703b6410b573a661e0f39`                                                    |
| Browser-evidence source SHA     | `22940b9004bc89def300a808f426a0ed4dc77658`                                                    |
| Database schema change          | None                                                                                          |
| Canonical mutable database used | No                                                                                            |

## Contract inventory

Sounding Line owns the authoritative definitions for:

- `wakebook.history.version-pinning`;
- `wakebook.history.owner-privacy`;
- `wakebook.history.historical-stability`;
- `wakebook.timing.quality`;
- `wakebook.artifact-context`;
- `wakebook.navigation.reachability`;
- `wakebook.archive.pagination`;
- `wakebook.archive.year-grouping`;
- `wakebook.archive.filters`;
- `wakebook.archive.invitation-separation`;
- `wakebook.archive.partial-history`;
- `wakebook.archive.summary-redaction`.

## Evidence ledger

| Evidence                          | Environment and fixture                                                                                                                     | Result                   | Truth boundary                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------- |
| Focused TypeScript                | Owned worktree; generated SQLite Prisma client                                                                                              | PASS                     | Compile-time only                                                   |
| Focused ESLint and Prettier       | Wakebook source, API, components, pages, tests, styles, control plane                                                                       | PASS                     | Static only                                                         |
| `unit.wakebook`                   | Sounding Line Vitest adapter; repository deterministic fixtures                                                                             | PASS, 11/11              | Unit/API contract evidence                                          |
| `component.wakebook`              | Sounding Line Vitest adapter; JSDOM                                                                                                         | PASS, 3/3                | Component contract evidence                                         |
| `browser.wakebook`                | Task-owned SQLite clone, approved immutable baseline witness, isolated Chromium context                                                     | PASS, 1/1                | Required synthetic browser evidence                                 |
| Visual review                     | 15 source-, fixture-, and SHA256-bound browser captures                                                                                     | ACCEPTED                 | Codex review only; not owner acceptance                             |
| Large archive                     | 1,005 synthetic owner records across 2025/2026 plus separate invitation                                                                     | PASS in browser lane     | Required bounded pagination/year proof                              |
| Owner and cover privacy negatives | Separate synthetic owner and foreign account                                                                                                | PASS in browser lane     | Required private-boundary proof                                     |
| Historical stability              | Mutated current Chronicle and crew profile after archive creation                                                                           | PASS in browser lane     | Required snapshot proof                                             |
| Responsive/accessibility          | 1440x1000, 430x932, 390x844; Axe serious/critical policy                                                                                    | PASS in browser lane     | Synthetic browser only                                              |
| Historical Sounding Line mainline | GitHub runs `31527213266` and `31529958855`; latest prior candidate `33e1316426a4d7f014c1472147e42d040ecdd47e`                              | `EVIDENCE_INVALID`       | Required release authority; no waiver                               |
| Helm dependency repair            | PR #55 source `94200b69343c55632f7f008fda7c95e24e863425`; authority `31642248271`; accepted main `772be633857548d9d4bef06329ff6c54ed1b0465` | `SUCCESS`                | Independently owned repair, now consumed only through accepted main |
| Reconciled local-change authority | Candidate at reconciliation merge `6d3547b690dab5c35c9cee04a70809fa462ae8cf`; fresh selection pending                                       | `PENDING`                | Prior `static.core` invalidity must be retested on this candidate   |
| Owner walkthrough decision        | Task owner instruction, 2026-08-12                                                                                                          | `OWNER_ACCEPTED_PHASE_1` | Owner gate only; not a release decision                             |

The first `browser.wakebook` diagnostic attempt did not execute product code because another governed validation process owned the global validation-runtime lock. The runner reported cleanup `CLEAN`; no process was stopped and no lock was removed. That environmental collision is not a product failure and is not counted as passing evidence.

On `69b560110a65e7eee55cda0ae40bf80c1700030b`, the sealed Sounding Line subsystem reran after correcting the isolated-runtime provenance defect: its migrated and seeded task-owned database remains the clone source, while the supplied external baseline is fingerprinted only as an immutable invariance witness. The exact `browser.wakebook` lane passed with cleanup `CLEAN`, expected mutation, and unchanged baseline family. The subsystem did not receive a release decision because the independently selected `browser.admiralty` dependency failed before its own Journey could sign in: its Project Admiralty synthetic fixture lacks the current `AccountEmail` table (`P2021`). That dependency failure is not Wakebook passing evidence and is not repaired or waived here.

On `22940b9004bc89def300a808f426a0ed4dc77658`, the focused governed `browser.wakebook` reran in a task-owned isolated runtime against the approved external baseline witness. It passed 1/1 with runtime conformance `PASSED`; the baseline SHA-256 was unchanged before and after. The capture manifest contains all 15 required states with repository-relative capture paths and SHA-256 checksums. `Project_Wakebook_Phase_1_Visual_Review.md` records their accepted Codex visual review. The successful focused run is minimum-sufficient Wakebook evidence, not a substitute for the protected mainline decision.

On `8c6137d6a3c5b00f9abcf66dac24f37945a101d3`, GitHub Sounding Line authoritative run `31527213266` completed with finalizer decision `EVIDENCE_INVALID`. All Wakebook-owned checks remained clean; `browser.wakebook` and `browser.admiralty` passed. The independently owned `browser.helm` journey failed during guest invitation acceptance: the authoritative accept response was `200`, but the browser remained at `/player/invitation` instead of reaching `/player/playthroughs/<id>`. The worker receipt reported cleanup `CLEAN`. This is a valid mainline no-go, not a Wakebook regression, and must not be repaired, waived, or relabeled from this Phase 1 branch.

For the latest candidate `33e1316426a4d7f014c1472147e42d040ecdd47e`, GitHub Sounding Line authoritative run `31529958855` evaluated the GitHub pull-request merge source `f1de8f9f541f9dc0b01ba945c36f8c969fcc1f9d` and again produced finalizer decision `EVIDENCE_INVALID`. The independently owned `browser.helm` invitation journey timed out after 600 seconds while awaiting its post-click `/api/invitations/accept` response; the worker receipt reported cleanup `CLEAN`. This is a valid protected-main no-go and is not evidence that Wakebook must alter, waive, or take ownership of Project Helm behavior.

For frozen candidate `6ec5b9b797d0272bdde16562ec60a4cb0aa3ee8b`, GitHub Sounding Line authoritative run `31568807207` reached a fail-closed `EVIDENCE_INVALID` finalizer decision. The accepted Helm repair was separately proved by focused run `31568179780`: both governed Helm browser journeys passed with runtime conformance `PASSED` and cleanup `CLEAN`. The authority failure was candidate-integrity-only: `unit.feature-catalog` found 45 catalog entries while its stable-order assertion still expected 44, and `static.core` found Prettier formatting drift in this record and the integration manifest. Both failed receipts cleaned up successfully. Correct those exact defects, requalify the changed candidate, and request one replacement decision; do not waive or misattribute either failure to Wakebook runtime behavior.

For repaired frozen candidate `7b01dab07dd9a4cd45c5119e6f1e7b8afdfbeebc`, GitHub Sounding Line authoritative run `31569669594` reached a fail-closed `EVIDENCE_INVALID` finalizer decision with `component.studio` as the sole invalid receipt. Its `src/components/studio/TaleEditor.test.tsx` keyboard-operable **More actions** disclosure test timed out after 5 seconds; its receipt reported cleanup `CLEAN`. The catalog and formatting repairs passed. `browser.admiralty`, `browser.helm`, and `build.production` were correctly withheld by the wave barrier, not treated as failures. Studio owns this test; Wakebook must preserve its branch, not alter Studio behavior, and wait for the owner to repair and prove that focused dependency before a later exact-candidate decision.

The Studio owner repaired that independent defect in PR #48. GitHub Sounding Line authoritative run `31570478927` completed `SUCCESS` on its exact source `ac622f4306299dcb48d11d1f0b246cf7d7ce78c9`, including `component.studio` and final `browser.helm` receipts. The protected merge binding then refreshed successfully and PR #48 merged to accepted main as `54e3d818d49d45282a9c419d562d4b5c78911ccd`. Wakebook reconciled that source without changing Studio behavior. This clears the external dependency; it does not waive the need to requalify and obtain a new exact-candidate Wakebook decision.

For requalified candidate `bbadc6adfe88b53a6677ef08ecfb4137f617f976`, GitHub Sounding Line authoritative run `31572273321` again reached a fail-closed `EVIDENCE_INVALID` finalizer decision. Every completed receipt other than `browser.helm` passed, including `component.studio`, `browser.admiralty`, and `build.production`. `browser.helm` alone returned `FAILED`, exit code `124`, and cleanup `CLEAN` after 910370ms in the visible Captain/Player invitation journey; its failure trace enters `acceptGuestInvitation` at `tests/e2e/project-helm-phase1.spec.ts:204`. Runtime conformance was `PASSED`. This is an independently owned Helm mainline regression; Wakebook must neither waive it nor change Helm behavior. The next valid action is a Helm-owned repair with focused evidence, followed by a later exact-candidate authority only after accepted main changes.

The Helm owner repaired the launch-handoff regression in PR #55. The exact source `94200b69343c55632f7f008fda7c95e24e863425` received focused `SUCCESS` in `31641766364`, authoritative `SUCCESS` in `31642248271`, and protected binding `SUCCESS` in `31643763885`; its protected merge is `772be633857548d9d4bef06329ff6c54ed1b0465`. Wakebook then reconciled current accepted main `fb0f13e35fcdd98434d22c357aee02f24d6d9036` in merge `6d3547b690dab5c35c9cee04a70809fa462ae8cf`, preserving the Wakebook control-plane mappings and regenerating derived catalogs. The repair clears the prior external dependency. This candidate now proceeds to fresh minimum-sufficient local qualification and one later exact-candidate, source-bound Mainline Decision.

Fresh governed local-change qualification on the reconciled candidate selected `static.core`, `unit.bridgewatch`, the required Sounding Line runtime conformance family, and the affected broader family set. The Bridgewatch unit receipt passed after provisioning its declared workspace dependencies; the runtime-conformance receipt also passed with clean cleanup. `static.core` alone remained invalid: root `tsc --noEmit` resolves repository `@types/node` `20.19.43`, which lacks the `node:sqlite` declaration required by accepted `bridgewatch/lib/store.ts`, while Bridgewatch's own workspace correctly provides Node 22 types. This is a current-main integration/compiler-configuration defect, not a Wakebook change. Wakebook neither changes Bridgewatch ownership nor weakens root typechecking; a separately accepted repair is required before replacement qualification and authority.

## Privacy and source-safety assertions

- List projection contains no Reflection text, Memory body, full Chronicle snapshot, raw event payload, storage key, request-derived authorization, or foreign-owner detail.
- Owner and missing detail/cover identifiers share a neutral not-found boundary.
- Detail returns owner-authorized remembrance while preserving the distinction between shared Voyage artifact context and personal Artifact Cabinet records.
- Current Chronicle or profile changes do not replace stored historical title, crew, version, or checksum evidence.
- Materialization failure cannot erase already accepted owner records; it becomes a safe partial-history warning.
- Browser fixtures and large-archive records are synthetic and live only in a Sounding Line task-owned database clone.

## Boundedness and performance assertions

The archive query reads at most `limit + 1` candidates from each of four provider-neutral date-source partitions, merges them deterministically, and returns at most 24 records. Year summaries use bounded aggregate queries and report full matching-year totals, not current-page totals. The browser fixture traverses every opaque page in a 1,005-record archive and rejects duplicates, gaps, and an oversized requested limit.

## Permanent-stop result

Phase 1 exposes no disabled Timeline, People, Statistics, map, Tideglass, sharing, replay, or notification control. If later phases never start, Archive Home, detail, first-use, one/many, invitation-only, filtered-empty, unavailable, partial, loading, and failure behavior remain coherent and useful.

## Remaining gates

1. Wait for an accepted mainline repair of the root static compilation/configuration mismatch for Bridgewatch `node:sqlite`; do not suppress, retarget, or waive `static.core` from Wakebook.
2. Fetch and reconcile that accepted repair, then repeat minimum-sufficient local qualification and verify remote parity with the pull-request/base identity envelope.
3. Run one protected Sounding Line Mainline Decision only after the replacement qualification is clean. Do not start Phase 2 or merge to protected main without its source-bound `RELEASE_GO` decision receipt.
