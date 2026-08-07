---
title: Project Homeport Phase 7 Owner Walkthrough Correction Round 2 Architecture
audience: product-engineering
status: current
canonical_for: project-homeport-phase-7-owner-walkthrough-correction-round-2-architecture
last_reviewed: 2026-08-05
---

# Project Homeport Phase 7 owner walkthrough correction Round 2 architecture

## Frozen status boundary

This is Phase 7 correction work, not Phase 8. The owner completed Correction Round 1 re-review and rejected it with 85 actionable findings. The independent state is preserved:

- Owner Walkthrough Round 1 Decision: `OWNER_RETURNED_FOR_CORRECTION`
- Owner Re-Review after Correction Round 1: `OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS`
- Owner Re-Review Round 2: `PENDING_OWNER_DECISION`

The highest automated status this round may reach is `PROJECT HOMEPORT PHASE 7 OWNER WALKTHROUGH CORRECTION ROUND 2 READY FOR OWNER RE-REVIEW`. Neither Codex, tests, visual review, nor Sounding Line may choose the owner decision or claim owner acceptance.

## Frozen source and isolation boundary

| Field                                   | Frozen value                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Round 1 publication / Round 2 start     | `004f366a350fe946e0b672839bdb559bbaf6e930`                                                                         |
| Branch                                  | `codex/project-homeport-product-reality-recovery`                                                                  |
| Worktree                                | `C:\Users\kkids\Documents\Codex_TreasureHunt-homeport`                                                             |
| Fetched local/tracking/advertised state | exact equality at start; divergence `0/0`                                                                          |
| Fetched `origin/main` and merge base    | `8d142227d712d27e363b15903dba9b0c99a04bc8`; no main-only commits                                                   |
| Canonical database start hash           | `54647911F63C6A55E5C6B6C95E5EC0A2977B4580A42DE073C8C503A3D8C7A412`                                                 |
| Round 2 task root                       | `C:\Users\kkids\AppData\Local\ProjectHomeport\phase7-owner-correction-round2-019fd274-d58b-7d00-ab01-8d68b1a29216` |
| Task-owned ports                        | `3751`–`3756`                                                                                                      |
| Required fixture                        | `homeport-phase7-owner-correction-round2-v1`                                                                       |

The stopped Round 1 runtime and database remain preserved historical owner evidence. They are forbidden as Round 2 seeds. Every destructive or mutation-bearing validation uses a new purpose-specific clone. The canonical database is forbidden.

## Preserved accepted architecture

Round 2 preserves Phases 1–7 and Correction Round 1: one AccountSession/current-user context; canonical authentication and email/claiming; ProductShell and all navigation families; one Display Name authority and public/private Profile separation; Harborlight public-safe districts/search/Creator Profiles/collections/reviews/saves; zero unexplained ordinary route orphans; source-derived screen/state registries; Preview versus Start; Chronicle aliases; provider adapters; account export/deactivation/deletion; Personal Harbor; delayed loading; route transitions; and Community compact/full search.

No second Profile, review model, save model, completion source, theme framework, route-local loading timer family, unmanaged animation interval, or live-provider claim is authorized. Moderator/Admin are never auto-granted; private completion and Chronicle content remain private. No merge, PR, deployment, Phase 8, or owner acceptance is authorized.

## Frozen decisions

|   # | Decision                                      | Frozen contract                                                                                                                                                                                                           |
| --: | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Round 2 owner authority                       | The 85 verbatim HP-OWCR2 findings are the sole correction authority; adjacent defects must be added before repair and owner acceptance remains external.                                                                  |
|   2 | Runtime fixture parity                        | Tests and the final owner runtime use the same canonical fixture builder and alias definitions for roles, status, email, Profile, Community identity, Chronicle, and provider state.                                      |
|   3 | Claimed-account capability backfill           | An idempotent dry-run/commit reconciliation grants ordinary Player, Captain, and Creator workspace capability without granting Moderator, Admin, resource-specific Captain authority, or private Creator access.          |
|   4 | Owner-review database preparation             | Preparation fails closed unless synthetic Sera is claimed, active, verified, publicly configured, unrestricted, expired-session-free, three-workspace capable, and has no active Chronicle.                               |
|   5 | Role-card structural versus decorative motion | Static layout CSS owns icon position before and after hydration; decoration may glow, scale, rotate internally, or change material without translating content flow.                                                      |
|   6 | Account-menu motion visibility                | The rendered menu opens and closes with perceptible 150–200 ms opacity, 6–10 px vertical, and approximately 0.98 scale motion while preserving focus and reduced-motion equivalence.                                      |
|   7 | Lantern transform origin                      | The physical suspension point is the transform origin, with a centered neutral pose and balanced left/right arc without compounded translation.                                                                           |
|   8 | Star-twinkle visibility                       | Staggered twinkles are visibly perceptible but restrained, lifecycle-managed, and static under reduced motion.                                                                                                            |
|   9 | Fog lifecycle                                 | Fog drifts slowly, pauses when hidden, never obscures content, and becomes a coherent static composition under reduced motion.                                                                                            |
|  10 | Dark theme restoration                        | Dark is a coherent product-wide theme; pale mixed surfaces such as What is a Chronicle are defects.                                                                                                                       |
|  11 | Global Light Mode                             | Light is a complete product-wide theme covering shell, routes, dialogs, forms, states, Community, and Personal Harbor.                                                                                                    |
|  12 | System theme behavior                         | System resolves from prefers-color-scheme, follows later operating-system changes unless explicitly overridden, and has a deterministic server-safe fallback.                                                             |
|  13 | Theme persistence                             | Explicit theme choice persists through canonical preferences and applies before interactive paint.                                                                                                                        |
|  14 | Theme cross-tab reconciliation                | Preference changes reconcile across tabs without loops, stale surfaces, or wrong-theme flashes.                                                                                                                           |
|  15 | Theme token architecture                      | One semantic token layer owns surfaces, borders, controls, states, focus, shadows, and text across Dark and Light; components do not invent a second framework.                                                           |
|  16 | Text contrast tokens                          | Headings, body, inactive navigation, metadata, secondary, and disabled text use distinct semantic tokens and governed contrast targets.                                                                                   |
|  17 | Community identity unification                | The existing public Profile is the only user-visible Community identity; Harborlight may consume an allowlisted projection but must not present a second Profile product.                                                 |
|  18 | Review Profile setup return path              | Missing public handle/setup links to Public Profile setup with a validated return target that restores the original review composer.                                                                                      |
|  19 | Community request state machine               | Idle, pending, delayed-loading, success, empty, real-error, retry, stale, and aborted requests are distinct states owned by one shared boundary.                                                                          |
|  20 | Delayed loading                               | Fast success shows no loading; unresolved work exposes loading only after 500 ms and cancels timers on settle, abort, or replacement.                                                                                     |
|  21 | Error transition                              | Error UI appears only after a real failure or governed timeout and does not reuse pending as failure.                                                                                                                     |
|  22 | Retry behavior                                | Retry starts a new request, clears stale error safely, preserves ordinary navigation context, and renders the resulting state once.                                                                                       |
|  23 | Save aggregation                              | Save counts derive from unique active authoritative save records; save/unsave and reconciliation update the projection without fixture literals.                                                                          |
|  24 | Rating aggregation                            | Average and count derive from eligible published reviews; moderation/edit/delete and uniqueness policy reconcile deterministically, and zero ratings are not displayed as zero stars.                                     |
|  25 | Review eligibility                            | Only a server-verified account that completed the exact governed Chronicle/version may create the one active review allowed by policy.                                                                                    |
|  26 | Chronicle completion proof                    | One Voyage completion truth is the only eligibility source; private completion records stay private and client state cannot manufacture eligibility.                                                                      |
|  27 | Chronicle preview expansion                   | Public-safe preview adds practical requirements, experiential metadata, rating/save summary, reviews/comments, spoiler controls, and explicit Preview versus Start separation.                                            |
|  28 | Synthetic email outbox presentation           | The owner package gives an explicit private task-owned synthetic inbox method; ordinary UI exposes no simulator control and live delivery/provider proof remains unclaimed.                                               |
|  29 | Experience image capture architecture         | After exact implementation/build/journey success, one source-bound generator captures the human route/state census into Experience_Images with desktop/mobile/theme/state coverage, index, checksums, and contact sheets. |
|  30 | Exact-source evidence policy                  | Every test, frame, screenshot, manifest, contact sheet, and runtime receipt binds to one 40-character product source; any later source change invalidates affected evidence.                                              |
|  31 | Sounding Line impact                          | All new contracts map to focused and release-relevant cases; only exact-source subsystem and mainline RELEASE_GO decisions authorize publication.                                                                         |
|  32 | Schema/migration decision                     | Existing models are preferred; schema changes require a named invariant gap, additive SQLite/MySQL treatment, fresh/upgrade rehearsal, and rebuildable reconciliation for any cache.                                      |
|  33 | Owner re-review package                       | The additive package preserves Round 1 history and supplies source, fixture, credential path, routes, synthetic inbox method, Experience Images index, status/reset/stop, limits, and rollback.                           |
|  34 | Final status language                         | The highest automated status is PROJECT HOMEPORT PHASE 7 OWNER WALKTHROUGH CORRECTION ROUND 2 READY FOR OWNER RE-REVIEW; owner Round 2 remains PENDING_OWNER_DECISION.                                                    |
|  35 | Rollback                                      | Preserve baseline 004f366…, prior owner artifacts, and migration history; stop only marker-owned processes, invalidate stale evidence, and forward-fix where rollback risks data loss.                                    |

## Schema authorization gate

The post-freeze census must inspect existing Community saves, reviews, Chronicle completion, public Profile, and preference storage before any schema edit. A schema change requires an exact unmet invariant. Any cache is a rebuildable projection with reconciliation and drift protection. SQLite and MySQL must receive equivalent additive treatment with fresh and populated upgrade rehearsal. Arbitrary card counts or ratings are never source truth.

## Privacy and security gates

Tests must cover save/review IDOR, duplicates, completion forgery, Profile visibility, private handles, return URLs, theme mass assignment, capability escalation, Community error leakage, Experience Images leakage, and synthetic-outbox privacy. No committed evidence may contain credentials, session/email/reset tokens, provider secrets, private Chronicle prose, answers, locations, object keys, or real personal data.

## Architecture exit condition

This commit freezes authority, traceability, contracts, test intent, and rollback only. It establishes no implementation, fixture result, journey result, evidence acceptance, Experience Images completeness, Sounding Line decision, publication, runtime readiness, owner re-review, merge, or deployment.
