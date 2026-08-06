---
title: Project Homeport Phase 7 Owner Walkthrough Correction Round 3 Architecture
audience: product-engineering
status: current
canonical_for: project-homeport-phase-7-owner-walkthrough-correction-round-3-architecture
last_reviewed: 2026-08-05
---

# Project Homeport Phase 7 owner walkthrough correction Round 3 architecture

## Frozen status boundary

This is Phase 7 correction work, not Phase 8. Independent owner history is preserved:

- Owner Walkthrough Round 1: `OWNER_RETURNED_FOR_CORRECTION`
- Owner Re-Review after Round 1: `OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS`
- Owner Re-Review after Round 2: `OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS`
- Owner Re-Review Round 3: `PENDING_OWNER_DECISION`

The highest automated status is `PROJECT HOMEPORT PHASE 7 OWNER WALKTHROUGH CORRECTION ROUND 3 READY FOR OWNER RE-REVIEW`. Automation, Codex visual review, Postmark receipts, Sounding Line, publication, or a healthy runtime cannot choose the owner decision.

## Frozen source and isolation boundary

| Field                               | Frozen value                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Round 2 publication / Round 3 start | `8e3900a734674cb58800878aaeaf91a0e9f2285e`                                                                         |
| Branch                              | `codex/project-homeport-product-reality-recovery`                                                                  |
| Worktree                            | `C:\Users\kkids\Documents\Codex_TreasureHunt-homeport`                                                             |
| Local, tracking, advertised remote  | exact equality at start; divergence `0/0`                                                                          |
| Current origin/main relevance       | no main-only commits after fetch                                                                                   |
| Canonical database SHA-256          | `54647911f63c6a55e5c6b6c95e5ec0a2977b4580a42de073c8c503a3d8c7a412`                                                 |
| Round 3 task root                   | `C:\Users\kkids\AppData\Local\ProjectHomeport\phase7-owner-correction-round3-019fd522-78ff-7e41-a3f4-98695fac9bde` |
| Task-owned ports                    | `3761`-`3768`                                                                                                      |
| Required fixture                    | `homeport-phase7-owner-correction-round3-v1`                                                                       |
| Postmark start classification       | `POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION`                                                                          |

The preserved Round 2 owner database, media, credential handoff, evidence, and runtime root are historical records and forbidden as mutation seeds. The governed Round 2 process was stopped without deleting its root. Every mutation-bearing validation uses a purpose-specific Round 3 clone. The canonical database is forbidden.

## Preserved architecture and explicit non-goals

AccountSession, one current-user context, safe return, account claim, ProductShell, navigation families, Personal Information Display Name authority, Public Profile identity, server-enforced privacy, Community aggregates/reviews, delayed loading, zero-orphan navigation, Experience Images, Lanternwake/platform motion, Sealed Hold, and previous Phase 1-7 contracts remain authoritative.

Round 3 does not create Phase 8, redesign Light Mode, replace Sealed Hold, create another asset or identity system, create workspace-specific accounts, grant unrelated resource authority, weaken Chronicle safety, create another route-transition or animation runtime, expose originals/secrets/codes, merge main, open a PR, deploy, or claim owner acceptance.

## Frozen decisions

|   # | Decision                           | Frozen contract                                                                                                                                                                                                            |
| --: | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Round 3 owner authority            | The 54 HP-OWCR3 findings are the correction authority; prior history is preserved and owner acceptance remains external.                                                                                                   |
|   2 | Profile-media ownership            | One account-owned Player Profile controls PROFILE_AVATAR and PROFILE_BANNER media; no second profile or asset system is authorized.                                                                                        |
|   3 | Image-selection lifecycle          | Selection validates locally, creates a temporary preview, opens the editor, and uploads only after explicit confirmation while the existing media remains active until replacement succeeds.                               |
|   4 | Client-side preview lifecycle      | Object URLs are local and temporary, never persisted, and revoked on replacement, cancellation, unmount, success, or terminal failure.                                                                                     |
|   5 | Crop and focal-point model         | Normalized center X/Y, scale, source orientation, optional rotation, and output aspect reproduce a crop independently of viewport pixels.                                                                                  |
|   6 | Avatar aspect and mask             | Avatar output is a high-resolution square derivative shown through a circular CSS mask with pan, zoom, keyboard alternatives, and dimmed exclusion.                                                                        |
|   7 | Banner aspect and safe areas       | Banner output uses the governed wide aspect with explicit desktop/mobile safe-area preview, pan, zoom, keyboard alternatives, and focal-point persistence.                                                                 |
|   8 | Media validation                   | Server validation trusts decoded bytes rather than extension, bounds bytes/pixels/dimensions, accepts PNG/JPEG/WebP, rejects malformed or unintended animation, and strips metadata from derivatives.                      |
|   9 | Private original storage           | The confirmed original is stored privately under task/configured media authority, is never the ordinary public response, and is retained or removed through explicit lifecycle policy.                                     |
|  10 | Public/safe derivative storage     | Server-generated checksum-addressed normalized derivatives are the only ordinary avatar/banner delivery assets and remain governed by Profile visibility.                                                                  |
|  11 | Scan and processing states         | UPLOADED, VALIDATING, SCAN_PENDING, PROCESSING, READY, QUARANTINED, FAILED, REPLACED, and REMOVED are explicit; only READY derivatives may become active.                                                                  |
|  12 | Identity-media propagation         | The canonical current-user and public Profile projections carry authorized derivative URLs to Personal Harbor, account trigger/menu, and Community identity surfaces; initials remain a no-avatar fallback.                |
|  13 | Profile Overview composition       | Banner, avatar, display name, handle state, and biography lead the identity hero; completion utilities are subordinate.                                                                                                    |
|  14 | Profile-completion prompt policy   | A missing-handle reminder is modest and actionable; no dominant percentage or large progress bar is rendered.                                                                                                              |
|  15 | Registration state machine         | SUBMITTING creates a pending account and delivery challenge, then routes to CODE_REQUIRED; ACTIVE is impossible until server verification succeeds.                                                                        |
|  16 | Verification-code state machine    | CODE_REQUIRED, VERIFYING, INVALID, EXPIRED, RATE_LIMITED, RESEND_AVAILABLE, VERIFIED, and UNAVAILABLE are distinct server-backed states with safe retry and resend.                                                        |
|  17 | Code security policy               | Codes are six random digits, stored only as hashes, expire, have bounded attempts and resend rotation, are single-use, are never logged or committed, and verification is account/email/challenge scoped.                  |
|  18 | Postmark provider contract         | A provider-neutral transactional-email port selects Postmark only when complete validated configuration exists; unconfigured production fails closed and cannot silently discard delivery.                                 |
|  19 | Postmark templates                 | Verified aliases and typed models cover verification code, password reset, email change, change notice, and security notice through a transactional Message Stream.                                                        |
|  20 | Postmark delivery receipt handling | Provider MessageID, submission time, purpose, account, recipient hash, status, and failure classification are persisted without codes, tokens, secrets, or message bodies.                                                 |
|  21 | Postmark webhook policy            | Delivery and bounce events use a dedicated authenticated endpoint, validate structure, correlate MessageID, process idempotently, suppress unsafe disclosure, and acknowledge governed retries.                            |
|  22 | Synthetic-provider behavior        | The task-owned synthetic provider implements the same delivery port, emits deterministic secret-safe receipts to an isolated outbox, and never proves external delivery.                                                   |
|  23 | Live-provider evidence boundary    | Only a configured Postmark send plus real inbox receipt and correlated provider evidence may establish live delivery; absence is classified POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION.                                       |
|  24 | Dark default policy                | Dark is the deterministic server-safe default for anonymous sessions, new accounts, missing preferences, and the owner fixture while explicit stored choices remain respected.                                             |
|  25 | Light Mode deferral                | Existing Light support is preserved without a broad redesign; Round 3 fixes no unrelated Light polish and records its remaining work as deferred.                                                                          |
|  26 | Workspace entry capability         | Every active claimed verified ordinary account may enter Player, Captain, and Creator workspaces through one AccountSession.                                                                                               |
|  27 | Resource-specific authority        | Workspace entry grants no ownership, edit, publication, moderation, administration, or access to another person's Voyage, Chronicle, draft, or private content.                                                            |
|  28 | New-account provisioning           | Verification activation creates or reconciles ordinary entry capability atomically and idempotently; no privileged or resource-scoped grant is synthesized.                                                                |
|  29 | Existing-account reconciliation    | Dry-run/commit reconciliation repairs active claimed verified accounts, records an audit event, is repeat-safe, and skips restricted, unclaimed, or unverified accounts.                                                   |
|  30 | Active-Chronicle lock              | The lock is computed only from authoritative active non-preview Player membership; it blocks Captain/Creator transition only when true and never masquerades as missing capability.                                        |
|  31 | Route crossfade lifecycle          | The stable ProductShell owns one transition runtime that overlaps outgoing and incoming page layers; the destination becomes visible before the source reaches zero opacity and no background-only frame is allowed.       |
|  32 | Loading integration                | Route crossfade begins immediately while loading UI remains a separate request truth exposed only after 500 ms; loading never creates an intermediate blank frame.                                                         |
|  33 | Focus and scroll integration       | Destination scroll restoration and heading focus occur after committed navigation without focusing an exiting layer, losing keyboard context, or destabilizing the shell.                                                  |
|  34 | Account-menu animation             | The production disclosure uses stronger visible opacity, translation, scale, and material/depth change with symmetric opening and closing, stable geometry, and focus safety.                                              |
|  35 | Reduced-motion behavior            | Reduced motion removes spatial travel and long fades while preserving immediate comprehensible state, focus, input, and cleanup.                                                                                           |
|  36 | Fixture updates                    | The one Round 3 fixture builder supplies Dark preference, verified account/code states, all ordinary workspace entry, empty Captain/Creator data, authoritative lock variants, media roots, and synthetic email isolation. |
|  37 | Schema/migration decision          | Additive schema changes are authorized only for reproducible crop/original/derivative lifecycle, verification challenge security, and provider receipts; SQLite and MySQL receive equivalent fresh and populated upgrades. |
|  38 | Testing and evidence               | Focused units, API/service/component tests, journeys A-V, retained regressions, accessibility/responsive/privacy checks, and evidence A-AD bind to the exact implementation source; motion requires frame sequences.       |
|  39 | Sounding Line impact               | Subsystem and mainline Sounding Line evaluate exact-source receipts after validation; RELEASE_GO may authorize publication but never owner acceptance or deployment.                                                       |
|  40 | Owner re-review runtime            | One healthy task-owned production runtime uses the final owner clone, Round 3 fixture, Dark default, isolated media/outbox, and truthful Postmark classification; prior evidence remains preserved.                        |
|  41 | Final status language              | The highest automated success is PROJECT HOMEPORT PHASE 7 OWNER WALKTHROUGH CORRECTION ROUND 3 READY FOR OWNER RE-REVIEW; Round 3 remains PENDING_OWNER_DECISION.                                                          |
|  42 | Rollback                           | Stop only the task-owned Round 3 runtime, restore configuration pointers, preserve databases/media/evidence, and roll back additive code/schema without touching canonical or prior-round state.                           |

## Schema authorization

The existing ProfileMedia, AccountToken, AccountEmail, delivery, preference, role, and Chronicle membership structures must be censused before edits. Additive fields/tables are authorized only where the 42 decisions cannot be represented safely. Crop metadata is normalized, verification material is hashed and bounded, originals/derivatives have explicit lifecycle states, and provider receipts contain no raw secrets. SQLite and MySQL require equivalent fresh and populated migration rehearsals.

## Provider truth boundary

The current host has no approved Postmark server token, verified sender, Message Stream, template aliases, or webhook credentials. Local implementation and synthetic proof therefore continue under `POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION`. Postmark can become configured only through approved external secrets and verified provider state; only a real inbox receipt plus correlated MessageID evidence may establish `POSTMARK_LIVE_DELIVERY_VERIFIED`.

## Architecture exit condition

This commit freezes authority, ownership, lifecycles, security, traceability, test intent, provider truth, and rollback. It establishes no implementation, migration result, test pass, capture acceptance, Sounding Line decision, publication, live inbox delivery, runtime readiness, owner decision, merge, PR, or deployment.
