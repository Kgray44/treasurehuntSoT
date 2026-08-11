---
title: Project Wakebook Phase 1 Validation Record
audience: product-engineering
status: current
canonical_for: project-wakebook-phase-1-validation-record
last_reviewed: 2026-08-11
---

# Project Wakebook Phase 1 validation record

## Decision

**Current classification: WAKEBOOK-LOCAL VALIDATION COMPLETE - OWNER AND MAINLINE ACCEPTANCE PENDING.** The Wakebook unit/component families and the exact isolated browser journey are passing, including checksum-bound visual evidence. This record does not establish owner acceptance, deployment, protected-main integration, or a release decision.

## Source identity

| Field                           | Value                                                                     |
| ------------------------------- | ------------------------------------------------------------------------- |
| Branch                          | `codex/project-wakebook-phase1-open-the-wake`                             |
| Owned worktree                  | `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\project-wakebook-phase1-open-the-wake` |
| Reconciled accepted-main base   | `dc430b79aa3ddd27443f47bb493ae6c471a41616`                                |
| Archive implementation anchor   | `629f5c7a981b80494f7703b6410b573a661e0f39`                                |
| Browser-evidence source SHA     | `22940b9004bc89def300a808f426a0ed4dc77658`                                |
| Database schema change          | None                                                                      |
| Canonical mutable database used | No                                                                        |

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

| Evidence                                 | Environment and fixture                                                  | Result               | Truth boundary                         |
| ---------------------------------------- | ------------------------------------------------------------------------ | -------------------- | -------------------------------------- |
| Focused TypeScript                       | Owned worktree; generated SQLite Prisma client                           | PASS                 | Compile-time only                      |
| Focused ESLint and Prettier              | Wakebook source, API, components, pages, tests, styles, control plane    | PASS                 | Static only                            |
| `unit.wakebook`                          | Sounding Line Vitest adapter; repository deterministic fixtures          | PASS, 11/11          | Unit/API contract evidence             |
| `component.wakebook`                     | Sounding Line Vitest adapter; JSDOM                                      | PASS, 3/3            | Component contract evidence            |
| `browser.wakebook`                       | Task-owned SQLite clone, approved immutable baseline witness, isolated Chromium context | PASS, 1/1 | Required synthetic browser evidence |
| Visual review                            | 15 source-, fixture-, and SHA256-bound browser captures                 | ACCEPTED             | Codex review only; not owner acceptance |
| Large archive                            | 1,005 synthetic owner records across 2025/2026 plus separate invitation  | PASS in browser lane | Required bounded pagination/year proof |
| Owner and cover privacy negatives        | Separate synthetic owner and foreign account                             | PASS in browser lane | Required private-boundary proof        |
| Historical stability                     | Mutated current Chronicle and crew profile after archive creation        | PASS in browser lane | Required snapshot proof                |
| Responsive/accessibility                 | 1440x1000, 430x932, 390x844; Axe serious/critical policy                 | PASS in browser lane | Synthetic browser only                 |
| Sounding Line subsystem/mainline/release | Mainline decision awaits owner acceptance and all gate dependencies       | Pending              | Required release authority             |

The first `browser.wakebook` diagnostic attempt did not execute product code because another governed validation process owned the global validation-runtime lock. The runner reported cleanup `CLEAN`; no process was stopped and no lock was removed. That environmental collision is not a product failure and is not counted as passing evidence.

On `69b560110a65e7eee55cda0ae40bf80c1700030b`, the sealed Sounding Line subsystem reran after correcting the isolated-runtime provenance defect: its migrated and seeded task-owned database remains the clone source, while the supplied external baseline is fingerprinted only as an immutable invariance witness. The exact `browser.wakebook` lane passed with cleanup `CLEAN`, expected mutation, and unchanged baseline family. The subsystem did not receive a release decision because the independently selected `browser.admiralty` dependency failed before its own Journey could sign in: its Project Admiralty synthetic fixture lacks the current `AccountEmail` table (`P2021`). That dependency failure is not Wakebook passing evidence and is not repaired or waived here.

On `22940b9004bc89def300a808f426a0ed4dc77658`, the focused governed `browser.wakebook` reran in a task-owned isolated runtime against the approved external baseline witness. It passed 1/1 with runtime conformance `PASSED`; the baseline SHA-256 was unchanged before and after. The capture manifest contains all 15 required states with repository-relative capture paths and SHA-256 checksums. `Project_Wakebook_Phase_1_Visual_Review.md` records their accepted Codex visual review. The successful focused run is minimum-sufficient Wakebook evidence, not a substitute for the protected mainline decision.

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

1. Push this reconciled candidate and verify exact remote parity.
2. Obtain the required owner walkthrough and explicit acceptance; Codex visual review does not fulfill it.
3. Resolve or receive the owning-project disposition for the independently failing `browser.admiralty` fixture; do not waive it from a Wakebook authority.
4. Run the protected Sounding Line Mainline Decision on the accepted candidate once the owner and dependency gates permit it.
5. Do not start Phase 2 or merge to protected main without that decision receipt.
