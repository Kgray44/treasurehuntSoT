---
title: Project Tideglass Phase 3 Test Plan
audience: product-engineering
status: current
canonical_for: project-tideglass-phase-3-test-plan
last_reviewed: 2026-08-13
---

# Project Tideglass Phase 3 test plan: Choose the Passage

## Testing lifecycle

Development verification runs the smallest relevant Tideglass, Wayfarer, Studio, route, or component test immediately after every coherent behavior change. A red focused test is repaired before unrelated work continues. Candidate qualification is deferred until the complete user journey is present. `Sounding Line / Mainline Decision` is not a debugging tool and is dispatched exactly once only for the owner-accepted, reconciled, frozen candidate.

## Required qualification matrix

| Area                     | Required proof                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| View model and selection | Exact edition status, current-publishing target from the owner-controlled `isCurrent` pointer, no newest-is-recommended inference, source/target swap, safe return target, and malicious return fallback.      |
| Wayfarer adapter         | Exact owned played anchor, multiple records, up-to-date, historical-only, partial/redacted projection, and foreign record denial.                                                                              |
| Comparison API           | Independent exact-edition authorization, same-Chronicle enforcement, public/player/Creator server-derived audience, no client elevation, and no raw snapshot payload.                                          |
| Components               | Edition card, selectors, summary, significance, compatibility, filter, change card, disclosure, annotation panel, history chooser, no-change, partial, error, mobile stack, and keyboard semantics.            |
| Studio cutover           | Semantic branch rewire, ending, Captain requirement, and caption change render from Tideglass; a regression fails if the ordinary Studio path calls the raw snapshot comparator.                               |
| Navigation               | Chronicle-detail, Passport, and accepted Wakebook Journey Detail entries are visible and return naturally; route and screen records have no orphaned route.                                                    |
| Product journeys         | Discovery, what-I-played, multiple playthroughs, up-to-date, historical, spoiler safety, Studio, mobile, keyboard/zoom/reduced-motion, and Axe journeys use privacy-safe synthetic data.                       |
| Privacy/security         | History and edition IDOR, cross-Chronicle pair, Creator/technical escalation, spoiler escalation, open redirect, storage/raw snapshot/private media/Creator note/hidden-count absence.                         |
| Performance              | Synthetic multi-chapter, hundreds-of-blocks comparison measures service, summary/projection, initial page render, and category filtering without a Phase 4 distributed-job design.                             |
| Static and documentation | Typecheck, lint, format, docs validation, generated documentation index, Feature Catalog source/sync/validation, route/screen catalog validation, and production build as selected by the current impact plan. |

## Implemented focused checks

- `tests/tideglass/phase3-passage.test.ts` covers current-pointer selection, exact pair reversal, owned-history selection, redaction, incompatibility, and safe return paths.
- `tests/tideglass/phase3-passage-service.test.ts` covers server-derived edition visibility, exact owned history, and fail-closed redacted edition behavior.
- `src/wakebook/archive-query.test.ts` covers the owner-bound Wakebook Journey Detail adapter input and verifies that only a safe comparison link/state enters its DTO.
- `src/components/wakebook/WakebookVoyageDetail.test.tsx` covers the visible Journey Detail entry and its no-dead-control absence state.
- `src/components/tideglass/TideglassPassage.test.tsx` covers visible state copy, partial/no-change/up-to-date treatment, and bounded retry behavior.
- `tests/tideglass/phase3-performance.test.ts` uses a 600-block synthetic comparison and preserves the Phase 3 synchronous scope rather than introducing Phase 4 processing.
- `tests/e2e/tideglass-phase3.spec.ts` provides the A-K visible-entry browser record, including a captured Passport -> Wakebook Journey Detail entry, See what changed, and exact-record return; it writes its private local evidence manifest.
- `npm run tideglass:phase3:validate` is a non-authoritative source contract check. It must pass before candidate qualification but is not a Sounding Line decision.

## Truth boundaries

All fixtures are synthetic and task-owned. Browser, visual, and performance
proof demonstrate the local governed runtime only; they do not claim staging,
production, private Chronicle, physical-device, provider, protected-mainline,
or owner-acceptance proof. Owner acceptance was a separate mandatory gate for
this human-facing phase and is recorded as satisfied below.

## Completion disposition

The owner gate was accepted on 2026-08-12, including the Wakebook Journey
Detail addendum. The qualified product candidate received hosted `RELEASE_GO`
through `31670646385` with 38 clean mandatory receipts and protected merge
`634312adbf72a8a4279a755b20fb06957ced7e77`. Record-only run `31673540201`
then sealed the acceptance packet and PR #79 merged as
`0fb9dfe96e1d414b45edf1841198beeda40e9c27`. This plan is complete; Phase 4 is
not authorized by it.
