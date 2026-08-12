---
title: Project Helm Phase 2 Validation Record
audience: product-engineering
status: candidate
canonical_for: project-helm-phase-2-validation-record
last_reviewed: 2026-08-10
---

# Project Helm Phase 2 validation record

## Current decision

**CANDIDATE VALIDATION IN PROGRESS.** This record is deliberately not a
`RELEASE_GO`, mainline-acceptance, deployment, provider, or owner-acceptance
claim. The branch is based on
`4a0f803a8ac4c238dc875da07df3cf0d1a5c81a3`; protected integration and its
exact integrated-SHA proof remain outstanding.

## Governing-document reconciliation

The Helm v1.0 governing document correctly defines the **target** operational
presence model, but its repository-context statement that person-level
heartbeat, active-device, and lag evidence already existed was not fully
supported by the source surveyed during Phase 2. Phase 2 therefore implemented
the missing per-member Platform presence source required to satisfy the
governed Phase 2 product contract. This makes the implementation record
truthful without claiming that the governing target itself was wrong.

## Candidate evidence

| Lane                                                                                                | Result                                                                                              | Boundary                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused presence, projection, service, Captain route, Player route, and Phase 1 participation tests | 34 tests in 6 files passed                                                                          | Local deterministic evidence; proves independent aggregation, authorization, lag, stale/unknown handling, removed-member semantics, and no session-aggregate fabrication. |
| Adjacent Player/Captain UI regression tests                                                         | 28 tests in 3 discovered files passed                                                               | Local component evidence; the Vite native-loader warning is pre-existing configuration guidance, not a test failure.                                                      |
| TypeScript                                                                                          | `tsc --noEmit` passed                                                                               | Source type check using the bundled Node runtime.                                                                                                                         |
| Prisma schemas                                                                                      | MySQL and SQLite validation passed with non-secret validation URLs                                  | Schema-only validation; no canonical database was touched.                                                                                                                |
| Documentation                                                                                       | index generation and documentation validation passed                                                | Generator-owned index was regenerated rather than hand-edited.                                                                                                            |
| Sounding Line policy                                                                                | `validate-policy` passed; digest `bcb2611803acb25f3859456d3e747487e5872f5c0af1921c16f6bb14effc5965` | Current local policy shape, not a finalizer receipt.                                                                                                                      |
| Governed Helm unit contract                                                                         | 47 tests in 11 files passed; cleanup `CLEAN`                                                        | Exact-source execute-only suite evidence recorded before final documentation-only changes.                                                                                |
| Governed Helm component contract                                                                    | 3 tests in 1 file passed; cleanup `CLEAN`                                                           | Exact-source execute-only suite evidence recorded before final documentation-only changes.                                                                                |
| Governed Helm browser contract                                                                      | Pending shared validation-runtime lease                                                             | Two attempts were correctly classified as `INFRASTRUCTURE_CONTENTION`; another worktree owns the brokered runtime. No browser pass is claimed.                            |

## Presence acceptance coverage

The candidate proves that no member-level evidence produces `UNKNOWN`, that the legacy
`TaleSession.lastHeartbeatAt` field never fabricates a member state, and that
one authenticated Player membership's heartbeat cannot alter another's.
Fresh evidence is `CONNECTED` with a server-derived synchronized/catching-up
state; expired evidence becomes `RECENTLY_LOST` then `STALE`; inactive member
rows cannot be re-established after removal. Device acknowledgement is bounded
by the canonical session sequence and uses a non-regressing high-water update.
The Captain projection permits only safe label, lifecycle, last-seen,
device-count, safe-activity, and lag fields; it excludes device identifiers,
IP/network/fingerprint data, private Player material, raw events, and story
payloads.

## Isolation and remaining gates

- Presence writes use task-owned validation data during tests; no canonical
  development database or production surface was mutated.
- The browser finalizer will be retried only when the shared brokered lease is
  available. It must exercise the actual Player heartbeat API, not a direct
  database mutation.
- After all exact-source evidence is complete, the candidate still requires a
  targeted commit, push, protected integration, and post-merge parity check.
- Phase 3 commands and Phase 4 recovery/preflight remain intentionally absent.
