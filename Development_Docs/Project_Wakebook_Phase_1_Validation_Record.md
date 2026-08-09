---
title: Project Wakebook Phase 1 Validation Record
audience: product-engineering
status: current
canonical_for: project-wakebook-phase-1-validation-record
last_reviewed: 2026-08-09
---

# Project Wakebook Phase 1 validation record

## Decision

**Current classification: FINAL SOURCE-BOUND VALIDATION PENDING.** The Wakebook unit, component, browser, accessibility, retained-runtime, privacy, and large-archive evidence is complete at the stated boundaries below. The branch has been semantically reconciled through accepted `origin/main` `468530645e983412e5f4c1aaa103915be77c9c07`. The final exact-source Sounding Line authorities, completion-record update, branch push/parity proof, and final retained-runtime restart must complete before this record may classify the branch `READY_FOR_OWNER_WALKTHROUGH`. This record does not establish owner acceptance, deployment, or mainline integration.

## Source identity

| Field                           | Value                                                                    |
| ------------------------------- | ------------------------------------------------------------------------ |
| Branch                          | `codex/project-wakebook-phase1-open-the-wake`                            |
| Owned worktree                  | `C:\Users\kkids\Documents\treasurehuntSoT-wakebook-phase1-open-the-wake` |
| Reconciled accepted-main base   | `468530645e983412e5f4c1aaa103915be77c9c07`                               |
| Archive implementation anchor   | `ab47dc33a29b2cdd80a97da7fd1af4a9e897b2cc`                               |
| Final validation SHA            | Pending final evidence commit                                            |
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

| Evidence                             | Environment and fixture                                                  | Result                  | Truth boundary                         |
| ------------------------------------ | ------------------------------------------------------------------------ | ----------------------- | -------------------------------------- |
| Focused TypeScript                   | Owned worktree; generated SQLite Prisma client                           | PASS                    | Compile-time only                      |
| Focused ESLint and Prettier          | Wakebook source, API, components, pages, tests, styles, control plane    | PASS                    | Static only                            |
| `unit.wakebook`                      | Sounding Line Vitest adapter; repository deterministic fixtures          | PASS, 11/11             | Unit/API contract evidence             |
| `component.wakebook`                 | Sounding Line Vitest adapter; JSDOM                                      | PASS, 3/3               | Component contract evidence            |
| `browser.wakebook`                   | Task-owned SQLite clone, leased loopback port, isolated Chromium context | PASS / CLEAN            | Source `c3d68307`; synthetic browser   |
| Large archive                        | 1,005 synthetic owner records across 2025/2026 plus separate invitation  | PASS                    | Bounded pagination/year proof          |
| Owner and cover privacy negatives    | Separate synthetic owner and foreign account                             | PASS                    | Neutral foreign/missing boundary       |
| Historical stability                 | Mutated current Chronicle and crew profile after archive creation        | PASS                    | Stored snapshot proof                  |
| Responsive/accessibility             | 1440x1000, 430x932, 390x844; Axe serious/critical policy                 | PASS / CLEAN, 148/148   | Local synthetic browser diagnostic     |
| Retained owner-runtime visual review | Loopback `3717`; task-owned database; desktop in-app browser             | PASS                    | Manual synthetic product-reality proof |
| Sounding Line mainline authority     | Generated registry at source `5012d285`                                  | RELEASE_GO, 32/32 CLEAN | Superseded by later reconciliations    |
| Final Sounding Line authorities      | Exact final reconciled source and generated registry                     | Pending                 | Required release authority             |

The first `browser.wakebook` diagnostic attempt and a later focused Community attempt did not execute product code because another governed validation process owned the global validation-runtime lock. Both runners reported cleanup `CLEAN`; no process was stopped and no lock was removed. Those environmental collisions are not product failures and are not counted as passing evidence.

The retained task-owned runtime was inspected through ordinary product navigation. A synthetic owner reached Chronicle Passport and History from `/`, searched the 1,005-record archive, opened **The Lantern Below**, inspected every Phase 1 detail section, and followed the personal Artifact Cabinet provenance link. A foreign synthetic account received the neutral `Voyage record not found` boundary for the same record ID. A first-use synthetic account received the intentional zero-Voyage orientation with Chronicle discovery, invitation, and Passport actions. Desktop geometry showed no horizontal overflow. Automated governed browser evidence remains the responsive/mobile, effective-zoom, keyboard, reduced-motion, and accessibility authority.

During that inspection, the retained owner initially lacked Homeport's canonical ordinary-workspace entry timestamp even though the synthetic account was active, claimed, and assigned the Player role. The task-owned database was repaired without touching canonical or immutable fixture data, and `scripts/homeport/seed-phase7-fixture.mjs` now seeds that accepted authorization fact for active Phase 7 identities and inherited active walkthrough accounts. A fresh isolated fixture preparation completed with the Player, Creator-only, and first-use accounts all holding the expected timestamp.

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

1. Re-fetch `origin/main` after the active governed validation lane releases and reconcile any newly accepted source semantically.
2. Run the focused impacted browser evidence and the Sounding Line subsystem, mainline, and release-candidate authorities on the final reconciled SHA.
3. Confirm documentation, Feature Catalog, route/screen/journey catalogs, source/remote parity, and runtime ownership.
4. Restart the retained walkthrough runtime on the exact completion source and verify its PID, port, database, source SHA, and health.
5. Change the decision only if every mandatory receipt passes with cleanup `CLEAN`.
