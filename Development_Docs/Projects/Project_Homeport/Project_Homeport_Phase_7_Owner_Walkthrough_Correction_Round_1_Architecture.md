---
title: Project Homeport Phase 7 Owner Walkthrough Correction Round 1 Architecture
audience: product-engineering
status: current
canonical_for: project-homeport-phase-7-owner-walkthrough-correction-round-1-architecture
last_reviewed: 2026-08-04
---

# Project Homeport Phase 7 owner walkthrough correction round 1 architecture

## Frozen status boundary

This is Phase 7 correction work, not Phase 8. The prior automated result remains
`PROJECT HOMEPORT PHASE 7 READY FOR OWNER WALKTHROUGH`. The owner performed that walkthrough and returned the product:

- Owner Walkthrough Round 1 Decision: `OWNER_RETURNED_FOR_CORRECTION`
- Owner Re-Review Decision: `PENDING_OWNER_DECISION`

The correction round may reach
`PROJECT HOMEPORT PHASE 7 OWNER WALKTHROUGH CORRECTION ROUND 1 READY FOR OWNER RE-REVIEW`. It cannot choose the owner's
re-review decision and cannot claim owner acceptance, product acceptance, merge, deployment, or production readiness.

## Frozen source and isolation boundary

| Field                             | Frozen value                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Correction baseline and start SHA | `9d1cb60af3fe93085b6b13630759cdbf5552c97e`                                                                         |
| Branch                            | `codex/project-homeport-product-reality-recovery`                                                                  |
| Worktree                          | `C:\Users\kkids\Documents\Codex_TreasureHunt-homeport`                                                             |
| Local/tracking/advertised parity  | exact equality, divergence `0/0` after fetch with prune                                                            |
| Fetched `origin/main`             | `8d142227d712d27e363b15903dba9b0c99a04bc8`; no newer main-only commits                                             |
| Canonical database                | `C:\Users\kkids\Documents\Codex_TreasureHunt\prisma\dev.db`                                                        |
| Canonical database start hash     | `54647911F63C6A55E5C6B6C95E5EC0A2977B4580A42DE073C8C503A3D8C7A412`                                                 |
| Correction task root              | `C:\Users\kkids\AppData\Local\ProjectHomeport\phase7-owner-correction-round1-019fcf4f-7cc1-79a0-a8ae-e378bba35cc4` |
| Retired walkthrough runtime       | PID `55784`, port `3717`, stopped through the governed controller; task root retained                              |
| Correction ports                  | `3731` through `3735`, task-owned and recorded in the port-lease manifest                                          |

The old walkthrough database is preserved only as owner-observed history. It is forbidden as a correction seed or test
database. Every correction test uses a new immutable seed and a fresh purpose-specific clone.

## Frozen decisions

|   # | Decision                 | Frozen contract                                                                                                                                                                                                                                                                                                                       |
| --: | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Owner-feedback authority | The 44 verbatim findings in `Project_Homeport_Phase_7_Owner_Feedback_Round_1_Ledger.csv` are the correction authority. They remain individually traceable through implementation, tests, evidence, limitations, and HP-NC records.                                                                                                    |
|   2 | Correction scope         | Scope is limited to the 44 owner findings and directly adjacent defects discovered while correcting them. Adjacent findings enter both ledgers before repair. No unrelated future program is authorized.                                                                                                                              |
|   3 | Specialist ownership     | Wayfarer owns account/profile/preferences; One Voyage owns Chronicle and active participation truth; Harborlight owns Community and reviews; True North owns navigation; Sealed Hold owns media; Lanternwake owns motion; Universal Language owns product terms; Sounding Line owns release evidence. Homeport owns convergence only. |
|   4 | Chronicle preview        | `Preview Chronicle` opens the existing public-safe Community Chronicle detail family as a nonmutating preview. It never creates a session or participant and never asks for a player name. Only its explicit `Start Chronicle` action enters preparation.                                                                             |
|   5 | Display-name authority   | `/account/personal-information` is the sole editable canonical account display-name authority. Public Profile consumes it and links back for changes.                                                                                                                                                                                 |
|   6 | Chronicle alias          | A Chronicle-specific alias belongs to the canonical participation/playthrough boundary. It defaults from the signed-in display name, is locked initially, becomes editable only through `Edit for this Chronicle`, persists for that Chronicle, and never mutates account/Profile identity.                                           |
|   7 | Account claim lifecycle  | Internal guest states remain private. Human states are Guest profile, Account setup required, Verification required, Active account, Deactivation pending, Deletion scheduled, or Restricted account. Claiming preserves memberships, history, invitations, artifacts, consent, dates, and aliases.                                   |
|   8 | Email lifecycle          | Primary email is normalized and case-insensitively unique. Registration, verification, resend, sign-in, change, old-address notice, recovery, rate limiting, expiry, one-time consumption, reauthentication, and session policy use hashed challenges and enumeration-safe responses. Local proof uses a synthetic outbox.            |
|   9 | Workspace capabilities   | Player, Captain, and Creator are capabilities of one AccountSession. Claimed active accounts have Player and may idempotently self-initialize Captain and Creator workspaces; resource authority remains assignment-specific.                                                                                                         |
|  10 | Active-Chronicle lock    | A server-owned workspace-transition decision blocks Creator or Captain context while an active Player participation could expose or corrupt Chronicle truth. The safe-leave action requires explanation and confirmation; switching unlocks only after authoritative exit. Same-Chronicle Captain escalation is denied across tabs.   |
|  11 | Linked identities        | Discord, Steam, and Microsoft/Xbox implement one provider-adapter contract with state/CSRF validation, PKCE/nonce where applicable, bounded callbacks, collision handling, unlink reauthentication, last-credential protection, safe summaries, and no raw tokens/subjects. Unconfigured providers are truthfully unavailable.        |
|  12 | Export                   | Export is a reauthenticated account-owned job with `REQUESTED`, `BUILDING`, `READY`, `FAILED`, and `EXPIRED` states; a versioned manifest, safe JSON/CSV archive, checksum, scoped data statement, and short-lived authorized download.                                                                                               |
|  13 | Deactivation             | Deactivation is reversible, distinct from deletion, revokes sessions, hides public Profile, suspends workspaces, resolves active Chronicle participation, notifies through the delivery boundary, and uses one centralized 30-day reactivation policy.                                                                                |
|  14 | Deletion                 | Deletion is a high-danger scheduled lifecycle with export recommendation, reauthentication, typed confirmation, 30-day cancellation window, session revocation, provider unlinking, dependency-aware reassignment/anonymization/tombstones, audit records, and an idempotent due-job processor.                                       |
|  15 | Personal Harbor IA       | Remove only the redundant normal `Current Area · Personal Harbor` banner. Strengthen noninteractive group headings, add a final faint-red Sign Out destination, keep one Display Name authority, route `View My Profile` to the public projection, and complete Data & Account.                                                       |
|  16 | Preferences              | Every visible preference must have a documented runtime consumer, observable effect, persistence behavior, multi-tab behavior, failure state, and test. Inert or obsolete controls are removed from ordinary UI rather than preserved decoratively.                                                                                   |
|  17 | Delayed loading          | One shared delayed-loading primitive exposes visible loading only after 500 ms of unresolved work, cancels stale timers, may set bounded assistive busy state immediately, and never leaves stale private content or anonymous flashes.                                                                                               |
|  18 | Route transitions        | One shared transition lifecycle coordinates navigation settlement, focus, scroll, interruption, Back/Forward, delayed loading, and reduced motion. No route-local duplicate ceremony or stale interactive layer is permitted.                                                                                                         |
|  19 | Account-menu motion      | The existing platform/Lanternwake motion authority supplies a restrained 140-200 ms opacity/translate/scale open/close transition with keyboard, Escape, outside-click, focus restoration, route-close, touch, and reduced-motion behavior.                                                                                           |
|  20 | Home ambient motion      | Lantern, staggered stars, and fog use governed lifecycle-managed motion. The lantern is visibly restrained, stars twinkle occasionally, fog drifts slowly, hidden documents pause work, and reduced motion is static. Role icons use final-layout CSS before first paint.                                                             |
|  21 | Community search         | A single compact search immediately below the Harbor introduction owns the canonical URL state. Enter and the icon submit identically. `Full Search` animates that same form into advanced filters, preserves focus/value/state, and collapses safely.                                                                                |
|  22 | Community reviews        | Harborlight remains truth. Homeport supplies a coherent summary, accessible composer, spoiler behavior, pending/success/failure/moderation states, responsive review cards, safe reviewer projections, edit/delete-own behavior where supported, and a deliberate empty state.                                                        |
|  23 | Accessibility            | Every changed surface includes semantic hierarchy, keyboard/focus behavior, accessible names and status, 200-percent zoom, non-color meaning, touch parity, screen-reader-oriented checks, and reduced-motion equivalence.                                                                                                            |
|  24 | Responsive behavior      | Desktop, mobile, narrow mobile, and effective 200-percent layouts expose equivalent ordinary capabilities without overflow, clipping, hover dependence, or desktop-only controls.                                                                                                                                                     |
|  25 | Fixture                  | Create `homeport-phase7-owner-correction-round1-v1` from a new immutable task-owned seed with synthetic email outbox/providers, lifecycle variants, capabilities, active Chronicle lock, exports, deactivation/deletion states, reviews, and fast/slow loading.                                                                       |
|  26 | Schema/migration         | No schema edit occurs before the post-freeze census states each exact data gap and proves no accepted model/adapter can represent it. Additive SQLite and MySQL migrations are conditionally authorized for confirmed gaps only, with fresh, upgrade, populated, and rollback/forward-fix rehearsals.                                 |
|  27 | Sounding Line            | Every listed correction contract is registered to focused and release-relevant suites. Raw tests remain diagnostic; subsystem and mainline authority must each issue `RELEASE_GO` for the exact publication source.                                                                                                                   |
|  28 | Owner re-review package  | The package is additive to the returned Round 1 record and includes exact source, fixture, credentials path, routes/journeys, visual evidence, known limits, status/reset/stop, rollback, and one fresh production-shaped re-review clone/runtime.                                                                                    |
|  29 | Final language           | Success uses exactly `PROJECT HOMEPORT PHASE 7 OWNER WALKTHROUGH CORRECTION ROUND 1 READY FOR OWNER RE-REVIEW`; owner Round 1 remains returned and re-review remains pending.                                                                                                                                                         |
|  30 | Rollback                 | Preserve baseline `9d1cb60…`, never rewrite prior migrations/history, keep old owner artifacts, use additive compatibility, invalidate evidence after source changes, forward-fix data where rollback risks loss, and stop only marker-owned processes.                                                                               |

## Schema authorization gate

The architecture recognizes likely persistence gaps for verified email/challenges, linked providers, workspace activation,
Chronicle aliases, export jobs, deactivation, deletion, and audit events. This is not proof that the gaps exist. The
post-freeze census must name existing models, the exact missing invariant, and the reason an adapter is insufficient
before any Prisma or migration file changes.

## Architecture exit condition

This freeze establishes decisions, traceability, and planned verification only. It establishes no correction
implementation, migration result, screenshot acceptance, Sounding Line decision, re-review readiness, merge, deployment,
or owner acceptance.
