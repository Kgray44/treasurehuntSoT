---
title: Project Homeport Phase 7 Correction Round 3 Patch A Validation Record
audience: product-engineering
status: current
canonical_for: project-homeport-phase-7-correction-round-3-patch-a-validation-record
last_reviewed: 2026-08-06
---

# Project Homeport Phase 7 Correction Round 3 Patch A validation record

## Exact-product-source focused authority

| Family                                             | Exact product source                       | Result                                                                           |
| -------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- |
| Patch A journeys A-N                               | `0edae8a4509656f98d68aa248f6ee7fb087436eb` | 14/14 passed on one sealed production artifact                                   |
| Retained Round 3 critical F/G/H/I/K/N/O/P/S/U      | `0edae8a4509656f98d68aa248f6ee7fb087436eb` | 10/10 passed on fresh disposable clones with the current additive migration      |
| Original Phase 7 account/session A/B/G/H/I/J/L/M/N | `0edae8a4509656f98d68aa248f6ee7fb087436eb` | 9/9 passed on fresh disposable clones with current migrations and reconciliation |
| Focused Vitest family                              | current Patch A implementation family      | 103/103 passed                                                                   |
| Account notice component family                    | current Patch A implementation family      | 22/22 passed                                                                     |
| Final route-boundary family                        | `0edae8a4509656f98d68aa248f6ee7fb087436eb` | 15/15 passed                                                                     |
| SQLite migration rehearsal                         | task-owned fresh database                  | 51/51 migrations applied                                                         |
| SQLite and MySQL schema validation                 | current schemas                            | passed                                                                           |
| Sounding Line subsystem                            | `0edae8a4509656f98d68aa248f6ee7fb087436eb` | `RELEASE_GO`; 2/2 clean receipts                                                 |
| Sounding Line mainline                             | `28442ddd6d8932aff1dab5fc41d51a63ccad342c` | `RELEASE_GO`; 28/28 clean receipts                                               |

The registration validator passed successful creation, display-name and email
conflicts, concurrent conflict, transaction rollback, zero orphan state,
provider failure, delivery retry, repeated submission, and ordinary unverified
sign-in. Reconciliation passed DRY_RUN, COMMIT, and VERIFY on a task-owned copy.

## Sounding Line focused contract registration

All 20 exact Patch A contract IDs named by the governing brief are registered
in the contract catalog, the three governed Homeport suites, the impact map,
and the active case registry. Policy validation passes with 411 contracts, zero
referential-integrity errors, and policy digest
`13327bc1698fadff741456d43e31ccb9b73eca272f8e947cc1c08e9eb340379d`.
Under the existing Homeport family policy, each focused contract has 394 active
case bindings; the exact behavior claims continue to rely on the focused
source-bound families and browser journeys above rather than that aggregate
binding count alone.

Sounding Line subsystem plan
`2442ebc92f4fff3de520bf06fce34397e528e6d83a9a15a8146d77b17c315a5f`
has evidence digest
`3c2fc538c636b35aba50cd429d585fd48ed92195064c84e6df03717d805dde72`.
Mainline plan
`e4d22f3464c7d7a83d13a8cb6e88bb73bb44fc242fb5d91524b68e85b3d32eeb`
has evidence digest
`ecd61cb27bcd164a4ac79473a5af209c27ac0b9501da79c3e44dd06d56288757`.
The mainline source differs only by the committed private-content test-boundary
alignment required to mock the canonical Studio workspace guard.

## Visual and temporal evidence

All 13 required visual checkpoints were captured from isolated synthetic
journeys and received Codex inspection. Five temporal receipts under the task
root record source SHA, generation, sampled time, loading state, old and
destination layers, opacity, focus, bounding boxes, transition duration, and
background-only state:

- `HP-AUTH-PATCH-MOTION-A-FAST-NO-SPINNER`
- `HP-AUTH-PATCH-MOTION-B-SLOW-LOADING`
- `HP-AUTH-PATCH-MOTION-C-SIGNIN-TO-HOME`
- `HP-AUTH-PATCH-MOTION-D-INTERRUPTED-NAV`
- `HP-AUTH-PATCH-MOTION-E-BACK-FORWARD`

The evidence proves fast routes never show delayed loading, controlled slow
routes show loading only after 500 ms and dismiss it once, authenticated Home
does not restore Sign In, interrupted generations cannot win, Back/Forward does
not duplicate layers, reduced motion has no blink, and no sampled sequence has
a background-only frame.

## Canonical workspace authorization

The source audit covers 55 ordinary Captain and Creator files and reports zero
legacy GM requirements and zero role-specific workspace sign-in redirects.
Focused authorization tests cover canonical Captain workspace entry, owned and
foreign Voyage authority, canonical Creator workspace entry, owner and scoped
collaborator Chronicle authority, and private media ownership. The expanded
Journey N keeps one account ID and one AccountSession across Personal Harbor,
Player, Captain, and Creator; creates an owned Voyage and Chronicle; and denies
foreign resources.

## Data and external boundary

All mutation-bearing work used task-owned databases. The canonical database was
not a migration, reconciliation, fixture, or browser target. Resend is the
selected real provider; the synthetic outbox remains test-only and Postmark is a
dormant compatibility adapter. Provider submission, inbox receipt, and code
consumption are recorded only when directly observed. Live provider message
`652a3347-2d49-4182-9499-399deb5957f3` was accepted at
`2026-08-07T00:27:01.379Z`; the owner confirmed inbox receipt; the application
consumed the code at `2026-08-07T00:27:47.816Z`; and direct disposable-database
inspection confirmed `ACTIVE`, `VERIFIED`, consumed-token, and ordinary-entry
state. Webhook deployment is deferred. `.env.example` documents names only; the
real key remains solely in ignored `.env.local`. Publication gates, Sounding
Line decisions, remote parity, final canonical hash, and retained runtime health
are separate closure facts.
