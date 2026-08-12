---
title: Project Wakebook Phase 1 Validation Record
audience: product-engineering
status: current
canonical_for: project-wakebook-phase-1-validation-record
last_reviewed: 2026-08-12
---

# Project Wakebook Phase 1 validation record

## Decision

**Current classification: OWNER_ACCEPTED - EXTERNAL MAINLINE NO-GO.** The Wakebook unit/component families and the exact isolated browser journey are passing, including checksum-bound visual evidence. The task owner explicitly accepted Phase 1 on 2026-08-12. The accepted Helm repair has fresh clean focused browser evidence, but the latest protected Sounding Line authority is blocked by independently owned Studio component evidence. This record does not establish deployment, protected-main integration, or a release decision.

## Source identity

| Field                                 | Value                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| Branch                                | `codex/project-wakebook-phase1-open-the-wake`                                                 |
| Owned worktree                        | `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\project-wakebook-phase1-open-the-wake` |
| Reconciled accepted-main base         | `dc430b79aa3ddd27443f47bb493ae6c471a41616`                                                    |
| Latest mainline-attempt candidate SHA | `33e1316426a4d7f014c1472147e42d040ecdd47e`                                                    |
| Latest authority merge source SHA     | `f1de8f9f541f9dc0b01ba945c36f8c969fcc1f9d`                                                    |
| Archive implementation anchor         | `629f5c7a981b80494f7703b6410b573a661e0f39`                                                    |
| Browser-evidence source SHA           | `22940b9004bc89def300a808f426a0ed4dc77658`                                                    |
| Database schema change                | None                                                                                          |
| Canonical mutable database used       | No                                                                                            |

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

| Evidence                          | Environment and fixture                                                                                        | Result                   | Truth boundary                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------- |
| Focused TypeScript                | Owned worktree; generated SQLite Prisma client                                                                 | PASS                     | Compile-time only                       |
| Focused ESLint and Prettier       | Wakebook source, API, components, pages, tests, styles, control plane                                          | PASS                     | Static only                             |
| `unit.wakebook`                   | Sounding Line Vitest adapter; repository deterministic fixtures                                                | PASS, 11/11              | Unit/API contract evidence              |
| `component.wakebook`              | Sounding Line Vitest adapter; JSDOM                                                                            | PASS, 3/3                | Component contract evidence             |
| `browser.wakebook`                | Task-owned SQLite clone, approved immutable baseline witness, isolated Chromium context                        | PASS, 1/1                | Required synthetic browser evidence     |
| Visual review                     | 15 source-, fixture-, and SHA256-bound browser captures                                                        | ACCEPTED                 | Codex review only; not owner acceptance |
| Large archive                     | 1,005 synthetic owner records across 2025/2026 plus separate invitation                                        | PASS in browser lane     | Required bounded pagination/year proof  |
| Owner and cover privacy negatives | Separate synthetic owner and foreign account                                                                   | PASS in browser lane     | Required private-boundary proof         |
| Historical stability              | Mutated current Chronicle and crew profile after archive creation                                              | PASS in browser lane     | Required snapshot proof                 |
| Responsive/accessibility          | 1440x1000, 430x932, 390x844; Axe serious/critical policy                                                       | PASS in browser lane     | Synthetic browser only                  |
| Historical Sounding Line mainline | GitHub runs `31527213266` and `31529958855`; latest prior candidate `33e1316426a4d7f014c1472147e42d040ecdd47e` | `EVIDENCE_INVALID`       | Required release authority; no waiver   |
| Owner walkthrough decision        | Task owner instruction, 2026-08-12                                                                             | `OWNER_ACCEPTED_PHASE_1` | Owner gate only; not a release decision |

The first `browser.wakebook` diagnostic attempt did not execute product code because another governed validation process owned the global validation-runtime lock. The runner reported cleanup `CLEAN`; no process was stopped and no lock was removed. That environmental collision is not a product failure and is not counted as passing evidence.

On `69b560110a65e7eee55cda0ae40bf80c1700030b`, the sealed Sounding Line subsystem reran after correcting the isolated-runtime provenance defect: its migrated and seeded task-owned database remains the clone source, while the supplied external baseline is fingerprinted only as an immutable invariance witness. The exact `browser.wakebook` lane passed with cleanup `CLEAN`, expected mutation, and unchanged baseline family. The subsystem did not receive a release decision because the independently selected `browser.admiralty` dependency failed before its own Journey could sign in: its Project Admiralty synthetic fixture lacks the current `AccountEmail` table (`P2021`). That dependency failure is not Wakebook passing evidence and is not repaired or waived here.

On `22940b9004bc89def300a808f426a0ed4dc77658`, the focused governed `browser.wakebook` reran in a task-owned isolated runtime against the approved external baseline witness. It passed 1/1 with runtime conformance `PASSED`; the baseline SHA-256 was unchanged before and after. The capture manifest contains all 15 required states with repository-relative capture paths and SHA-256 checksums. `Project_Wakebook_Phase_1_Visual_Review.md` records their accepted Codex visual review. The successful focused run is minimum-sufficient Wakebook evidence, not a substitute for the protected mainline decision.

On `8c6137d6a3c5b00f9abcf66dac24f37945a101d3`, GitHub Sounding Line authoritative run `31527213266` completed with finalizer decision `EVIDENCE_INVALID`. All Wakebook-owned checks remained clean; `browser.wakebook` and `browser.admiralty` passed. The independently owned `browser.helm` journey failed during guest invitation acceptance: the authoritative accept response was `200`, but the browser remained at `/player/invitation` instead of reaching `/player/playthroughs/<id>`. The worker receipt reported cleanup `CLEAN`. This is a valid mainline no-go, not a Wakebook regression, and must not be repaired, waived, or relabeled from this Phase 1 branch.

For the latest candidate `33e1316426a4d7f014c1472147e42d040ecdd47e`, GitHub Sounding Line authoritative run `31529958855` evaluated the GitHub pull-request merge source `f1de8f9f541f9dc0b01ba945c36f8c969fcc1f9d` and again produced finalizer decision `EVIDENCE_INVALID`. The independently owned `browser.helm` invitation journey timed out after 600 seconds while awaiting its post-click `/api/invitations/accept` response; the worker receipt reported cleanup `CLEAN`. This is a valid protected-main no-go and is not evidence that Wakebook must alter, waive, or take ownership of Project Helm behavior.

For frozen candidate `6ec5b9b797d0272bdde16562ec60a4cb0aa3ee8b`, GitHub Sounding Line authoritative run `31568807207` reached a fail-closed `EVIDENCE_INVALID` finalizer decision. The accepted Helm repair was separately proved by focused run `31568179780`: both governed Helm browser journeys passed with runtime conformance `PASSED` and cleanup `CLEAN`. The authority failure was candidate-integrity-only: `unit.feature-catalog` found 45 catalog entries while its stable-order assertion still expected 44, and `static.core` found Prettier formatting drift in this record and the integration manifest. Both failed receipts cleaned up successfully. Correct those exact defects, requalify the changed candidate, and request one replacement decision; do not waive or misattribute either failure to Wakebook runtime behavior.

For repaired frozen candidate `7b01dab07dd9a4cd45c5119e6f1e7b8afdfbeebc`, GitHub Sounding Line authoritative run `31569669594` reached a fail-closed `EVIDENCE_INVALID` finalizer decision with `component.studio` as the sole invalid receipt. Its `src/components/studio/TaleEditor.test.tsx` keyboard-operable **More actions** disclosure test timed out after 5 seconds; its receipt reported cleanup `CLEAN`. The catalog and formatting repairs passed. `browser.admiralty`, `browser.helm`, and `build.production` were correctly withheld by the wave barrier, not treated as failures. Studio owns this test; Wakebook must preserve its branch, not alter Studio behavior, and wait for the owner to repair and prove that focused dependency before a later exact-candidate decision.

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

1. Wait for the Studio owner to repair and prove the focused `component.studio` dependency that failed in run `31569669594`; do not waive, retime, or take ownership of it from Wakebook.
2. After the dependency is accepted, fetch and reconcile current main, requalify the exact candidate, then run one protected Sounding Line Mainline Decision with its pull-request/base identity envelope.
3. Do not start Phase 2 or merge to protected main without a source-bound `RELEASE_GO` decision receipt.
