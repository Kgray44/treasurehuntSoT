---
title: Project Wakebook Phase 1 Validation Record
audience: product-engineering
status: current
canonical_for: project-wakebook-phase-1-validation-record
last_reviewed: 2026-08-12
---

# Project Wakebook Phase 1 validation record

## Decision

**Current classification: OWNER_ACCEPTED - ACCEPTED_MAINLINE.** The task owner
accepted Phase 1 on 2026-08-12. Exact implementation candidate
`1d1c1aaa5a0f2fbbc6b083911cb19422782afff0` then received hosted Sounding Line
`RELEASE_GO` with 38/38 mandatory receipts `PASSED` and `CLEAN`. Protected PR
#41 merged that exact head as `cbf634d4d5db9cf47edebb89e005e8cc910068bd`.
Reconciliations `5a999090`, `fac85f2d`, and `ebf6afe2` preserved that accepted
implementation through main `582f32a3`; follow-up merge `147d4cbe` consumes the
accepted Admiralty Phase 2 record closure `95cff272`. The candidate updates
generated/catalog records without changing Wakebook runtime behavior. This is
source integration and owner acceptance, not deployment or authorization for
Phase 2.

## Source identity

| Field                           | Value                                                                    |
| ------------------------------- | ------------------------------------------------------------------------ |
| Branch                          | `codex/project-wakebook-phase1-open-the-wake`                            |
| Owned worktree                  | `C:\Users\kkids\Documents\treasurehuntSoT-wakebook-phase1-open-the-wake` |
| Accepted implementation head    | `1d1c1aaa5a0f2fbbc6b083911cb19422782afff0`                               |
| Accepted implementation base    | `bb7676a75581d8d415c3ff7712cc38bc8decb031`                               |
| Protected merge                 | `cbf634d4d5db9cf47edebb89e005e8cc910068bd` (PR #41)                      |
| Hosted authority                | `31651096047` (`RELEASE_GO`, 38/38 `PASSED` and `CLEAN`)                 |
| Protected binding               | `31652303048` (`Sounding Line / Mainline Decision` successful)           |
| Current accepted-main base      | `95cff272450af34a3f8c00eb3ae01081be810f79`                               |
| Current-main reconciliation     | `147d4cbe` (parents `0aed6050` and `95cff272`)                           |
| Archive implementation anchor   | `629f5c7a981b80494f7703b6410b573a661e0f39`                               |
| Browser-evidence source SHA     | `22940b9004bc89def300a808f426a0ed4dc77658`                               |
| Database schema change          | None                                                                     |
| Canonical mutable database used | No                                                                       |

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

| Evidence                          | Environment and fixture                                                                                                                                                                                                                 | Result                               | Truth boundary                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Focused TypeScript                | Owned worktree; generated SQLite Prisma client                                                                                                                                                                                          | PASS                                 | Compile-time only                                                                                  |
| Focused ESLint and Prettier       | Wakebook source, API, components, pages, tests, styles, control plane                                                                                                                                                                   | PASS                                 | Static only                                                                                        |
| `unit.wakebook`                   | Sounding Line Vitest adapter; repository deterministic fixtures                                                                                                                                                                         | PASS, 11/11                          | Unit/API contract evidence                                                                         |
| `component.wakebook`              | Sounding Line Vitest adapter; JSDOM                                                                                                                                                                                                     | PASS, 3/3                            | Component contract evidence                                                                        |
| `browser.wakebook`                | Task-owned SQLite clone, approved immutable baseline witness, isolated Chromium context                                                                                                                                                 | PASS, 1/1                            | Required synthetic browser evidence                                                                |
| Visual review                     | 15 source-, fixture-, and SHA256-bound browser captures                                                                                                                                                                                 | ACCEPTED                             | Codex review only; not owner acceptance                                                            |
| Large archive                     | 1,005 synthetic owner records across 2025/2026 plus separate invitation                                                                                                                                                                 | PASS in browser lane                 | Required bounded pagination/year proof                                                             |
| Owner and cover privacy negatives | Separate synthetic owner and foreign account                                                                                                                                                                                            | PASS in browser lane                 | Required private-boundary proof                                                                    |
| Historical stability              | Mutated current Chronicle and crew profile after archive creation                                                                                                                                                                       | PASS in browser lane                 | Required snapshot proof                                                                            |
| Responsive/accessibility          | 1440x1000, 430x932, 390x844; Axe serious/critical policy                                                                                                                                                                                | PASS in browser lane                 | Synthetic browser only                                                                             |
| Historical Sounding Line mainline | GitHub runs `31527213266` and `31529958855`; latest prior candidate `33e1316426a4d7f014c1472147e42d040ecdd47e`                                                                                                                          | `EVIDENCE_INVALID`                   | Required release authority; no waiver                                                              |
| Helm dependency repair            | PR #55 source `94200b69343c55632f7f008fda7c95e24e863425`; authority `31642248271`; accepted main `772be633857548d9d4bef06329ff6c54ed1b0465`                                                                                             | `SUCCESS`                            | Independently owned repair, now consumed only through accepted main                                |
| Fresh local subsystem authority   | Candidate `ae5a28a751a437f8476f25c18ccc06ab4c03a52b`; 15 governed receipts, including `browser.wakebook` 1/1 in 33s                                                                                                                     | `RELEASE_GO`                         | Local-only source boundary; all runtime conformance and cleanup clean                              |
| Pre-acceptance local broad proof  | Candidate `b846631bf02fbf064cea86e9ce3bbaf4de994270`; subsystem 12/12 and mainline 40/40 `PASSED`/`CLEAN`; release-candidate 42/54 passed, all 54 clean                                                                                 | `EVIDENCE_INVALID`                   | Retained historical diagnosis only; never used as acceptance                                       |
| Exact hosted implementation gate  | Candidate `1d1c1aaa5a0f2fbbc6b083911cb19422782afff0`; authority run `31651096047`; plan `839c6e8a54f63cc8fe8b414dc39db3996524b477b9b70152161fe1190feb52bb`; evidence `290c5062dc4f779eee2c7ca6ead51fc706db498b9e61491e3e9e94fe0d8100eb` | `RELEASE_GO`, 38/38 `PASSED`/`CLEAN` | Exact implementation authority; zero missing, duplicate, unknown, invalid, or conformance evidence |
| Protected merge binding           | PR #41 run `31652303048`; exact head `1d1c1aaa`; base `bb7676a7`; merge `cbf634d4`                                                                                                                                                      | `SUCCESS`                            | Protected `Sounding Line / Mainline Decision`                                                      |
| Owner walkthrough decision        | Task owner instruction, 2026-08-12                                                                                                                                                                                                      | `OWNER_ACCEPTED_PHASE_1`             | Owner gate; deployment remains separate                                                            |

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

The accepted mainline repair restored root static qualification without any Wakebook ownership change. On candidate `ae5a28a751a437f8476f25c18ccc06ab4c03a52b`, the governed `subsystem` authority selected 15 suites and returned local finalizer `RELEASE_GO`: `static.core`, both Wakebook families, and `browser.wakebook` (1/1 in 33 seconds) all passed; every runtime-conformance and cleanup receipt was `CLEAN`. This evidence is source-bound only to that local candidate. `origin/main` then advanced through accepted Tideglass Phase 3 work, so Wakebook reconciled it in `72a1ae3df50e8972e530c1bd96f4f098f72a4164`, preserving the Wakebook control plane alongside the accepted mainline registrations. No local receipt substitutes for the fresh hosted decision required for that reconciliation commit.

The succeeding exact candidate `1d1c1aaa5a0f2fbbc6b083911cb19422782afff0`
received hosted mainline authority in run `31651096047`. The finalizer retained
38 mandatory receipts, all 38 `PASSED` and all 38 cleanup states `CLEAN`, with
zero missing, duplicate, unknown, invalid, missing-conformance, or
invalid-conformance evidence. Its plan digest is
`839c6e8a54f63cc8fe8b414dc39db3996524b477b9b70152161fe1190feb52bb`
and evidence digest is
`290c5062dc4f779eee2c7ca6ead51fc706db498b9e61491e3e9e94fe0d8100eb`.
Protected binding run `31652303048` verified that exact authority against PR
#41's head/base/merge identity, and the protected merge became
`cbf634d4d5db9cf47edebb89e005e8cc910068bd`.

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

No Phase 1 implementation, owner, Sounding Line, or protected-main acceptance
gate remains. The current task is record/catalog reconciliation only: keep the
accepted implementation unchanged, validate and publish the current records
through the governed closure path, and preserve deployment and Phase 2 as
separate future decisions.
