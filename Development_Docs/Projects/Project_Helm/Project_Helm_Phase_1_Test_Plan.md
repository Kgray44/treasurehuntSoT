---
title: Project Helm Phase 1 Test Plan
audience: product-engineering
status: current
canonical_for: project-helm-phase-1-test-plan
last_reviewed: 2026-08-09
---

# Project Helm Phase 1 test plan

## Evidence boundary

This plan defines required evidence; it does not claim results. Mutation-bearing
tests use task-owned SQLite databases and isolated runtime resources. Raw unit,
integration, browser, build, and accessibility output is diagnostic until the
current Sounding Line finalizer classifies the reconciled source.

## Contract matrix

| Family           | Required cases                                                                                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Truth table      | `NO_ACCESS`, `PLAYER_ONLY`, `CAPTAIN_ONLY`, and `CAPTAIN_AND_PLAYER` derive only from canonical authority and access-bearing membership                                                                                 |
| Creation         | Captain-only creates no self membership; Captain+Player creates one READY self membership; same-account external invite is rejected; partial failure rolls back both relationships                                      |
| Idempotency      | same and new idempotency keys, retry, reload, and double-submit preserve one membership and original history                                                                                                            |
| Lifecycle        | add/remove before launch; ordinary late join while active; removal while active; post-launch rejoin limitation; terminal and preview denial; stale concurrency denial                                                   |
| Independence     | membership removal preserves Captain API; authority revocation preserves Player API and immediately denies Captain API; existing Player plus authority preserves original membership identity and join time             |
| Player firewall  | participating-Captain Player DTO field set equals an equivalent Player-only DTO and excludes Captain notes, future graph, unreleased hints, commands, audit, raw evidence, provider, account, and private Player fields |
| Captain firewall | bounded participation DTO excludes private memories/reflections/notes, answers, email, sessions, provider IDs, device data, draft notes, and raw ORM relations                                                          |
| IDOR/security    | authorized Captain, unrelated Captain, Player-only account, revoked Captain, modified Voyage ID, direct URL, stale session, malformed mode, missing/invalid CSRF, replay, rate limit, terminal Voyage                   |
| Artifacts        | Captain-only no personal grant; Captain+Player ordinary event-time policy; join after grant no retroactive grant; removal before grant no later grant                                                                   |
| History          | Captain-only no record; Captain+Player version-pinned member record; late join excludes earlier event summary; removal remains removed after Voyage completion                                                          |
| Crew/presence    | participating Captain appears once as ordinary crew; removal updates crew; Captain-only does not fabricate crew; per-member presence reports unknown rather than inferred                                               |
| Perspective      | one account opens Captain and ordinary Player routes without reauthentication; both tabs refresh independently; Open Player View is absent without membership and ordinary when present                                 |
| Regression       | external invitation lifecycle, launch, Captain commands, Player Library/Journal, Homeport locks for unrelated Player Voyages, compatibility readers, schema parity, docs, Feature Catalog                               |

## Browser and accessibility matrix

Validate natural navigation from `/` through account/workspace entry, Captain
Library, Voyage setup, both participation choices, Voyage card, ordinary Player
Journal, and visible return navigation. Direct deep links are security tests,
not reachability proof.

Required presentation checks:

- desktop, tablet, and phone viewports;
- effective 200 percent zoom;
- keyboard-only setup, confirmation, perspective switch, and return;
- focus trap/restore and mutation status announcement;
- reduced-motion behavior with no semantic delay;
- Axe results for changed surfaces;
- simultaneous Captain and Player tabs with independent refresh;
- truthful loading, success, failure, stale, blocked, and unauthorized states.

## Governed validation sequence

1. Focused unit and service tests on a task-owned database.
2. Route and contract tests for CSRF, IDOR, retries, stale versions, and DTO
   allowlists.
3. Schema generation/validation for SQLite and MySQL without migration.
4. Natural-path browser and accessibility evidence on an isolated runtime.
5. `npm run docs:validate`, `npm run features:sync`, and
   `npm run features:validate`.
6. Current-main reconciliation and targeted invalidation reruns.
7. Current Sounding Line completion gate.
8. Integrated-SHA validation and advertised-remote parity proof.
