---
title: Project Homeport Phase 4 Test Plan
audience: quality-engineering
status: current
canonical_for: project-homeport-phase-4-test-plan
last_reviewed: 2026-08-03
---

# Project Homeport Phase 4 test plan

## Purpose and authority

This plan binds the frozen Community Harbor architecture to isolated, reproducible evidence. It is a plan, not a result. Sounding Line finalizer decisions are authoritative; direct Vitest, Playwright, build, and script exits are diagnostic evidence only.

## Owned resources

- Branch/worktree: existing Homeport branch and retained Homeport worktree only.
- Database: task-owned SQLite copy; never the canonical development database.
- Storage/media: task-owned fixture, public-media, profile-media, and private-content roots.
- Runtime: one task-owned server process and port with `reuseExistingServer: false`.
- Browser: Phase 4-only Playwright project, output, trace, and authentication state.
- Evidence: `Development_Docs/Projects/Project_Homeport/evidence/phase4` plus task-owned raw artifacts.
- Fixture: deterministic `homeport-phase4-synthetic-v1` with a recorded checksum and reset receipt.

## Contract families

### Unit and service

- District registry uniqueness, parent existence, status vocabulary, active visibility, desktop/mobile equality, DTO/card compatibility, state actions, and preview exclusion.
- Public listing, creator, collection, Guide, and Voyage Log allowlists; foreign-account privacy; block filtering; lifecycle exclusion; and no object-key/private-coordinate leakage.
- Shelf selection, deterministic order, truthful editorial labels, within-shelf deduplication, and non-starvation of later shelves.
- Card variants, applicable metadata omission, fallback artwork, destinations, accessible names, and no nested interactive controls.
- Search normalization, human URL parsing, type/duration/difficulty/player/environment/accessibility/free/remix filters, sorting, cursor binding, invalid input, and privacy filtering.
- Batch social projection, anonymous state, save/follow success, self-follow denial, restricted account, and recoverable failure.
- Idempotent fixture, inventory updater, contract validator, and exact historical preservation.

### API

- `/api/community/discover` returns only the Homeport public card DTO plus public facets/cursor and rejects invalid criteria without leaking internals.
- Public listing, creator, collection, Guide, and Voyage Log routes return only eligible projections.
- Social state is bounded and batched; mutations retain canonical auth/CSRF and explicit denial behavior.
- Quarantined, private, unlisted, removed, archived, blocked, and private-real-world subjects do not enumerate; direct ineligible routes do not explain which rule hid them.

### Components

- Harbor Home shelves precede search and remain meaningful without input.
- Desktop/mobile district navigator, current district, compact search, sort, type/duration controls, advanced disclosure, filter chips, active summary, loading, no-results, Harbor-empty, district-empty, dependency-unavailable, and partial-media states.
- Every supported card variant and detail family, including Creator with no work and empty collection.
- Keyboard, focus visibility, live announcements, 390-pixel mobile, 200-percent zoom, and reduced motion.

## Browser journeys

The governed A-AR journey family is implemented in a Phase 4-only Playwright suite. It covers gateway entry; anonymous/authenticated default discovery; Harbor-wide empty; search/no result; compact/advanced filters; sort; each active district; Chronicle open; media fallback; Creator follow/self-follow; collections; Guides; Voyage Logs; save/unsave/failure; lifecycle privacy; dependency unavailable; restricted account; mobile; keyboard; zoom; reduced motion; Phase 1-3 regression; and the natural full Community loop.

The suite must record route, viewport, motion setting, actor, fixture version/checksum, database hash, source SHA, screenshot ID/path, and outcome. Visual assertions are not loosened to accept poor composition.

## Validation order

1. Validate fixture and run focused unit/service/API/component tests.
2. Run Phase 4 artifact updater twice and prove the second run has no diff.
3. Validate Phase 4 registries/contracts/matrices and additive Homeport inventories.
4. Generate the exact Sounding Line impact plan from the complete change set.
5. Create an exact tested-source anchor.
6. Run the Phase 4 browser suite and inspect every critical screenshot.
7. Run language, documentation, Feature Catalog, privacy, schema, formatting, lint, typecheck, and production-build gates.
8. Run Sounding Line subsystem; repair until its finalizer returns `RELEASE_GO`.
9. Run Sounding Line mainline; repair until its finalizer returns `RELEASE_GO`.
10. Re-run updater/idempotency, remote parity, canonical DB immutability, process/port cleanup, ignored artifact checks, and worktree cleanliness.

## Truth boundary

Passing local synthetic validation proves only the exact Homeport branch source against the isolated fixture and runtime. It does not prove merge to `main`, deployment, production MySQL, hosted storage, live scanning, external providers, real users, owner acceptance, or product acceptance. Phase 5 is not authorized by Phase 4 completion.
