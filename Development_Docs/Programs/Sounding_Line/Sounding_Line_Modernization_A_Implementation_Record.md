---
title: Sounding Line modernization A implementation and qualification record
audience: engineering
status: in-progress
canonical_for: sounding-line-modernization-a-implementation
last_reviewed: 2026-10-31
---

# Modernization A: reliability, cost containment and merge integrity

This increment implements A and its A0 transaction boundary. B depends on A's
landed execution identities; C depends on B's complete logical evidence model.
This record is not qualification, owner acceptance or a release decision.

## Source and incident boundary

The October 25 audit used protected main
`696ecec0fd89293074b271ab33d9256709158700`. Implementation refreshed protected
main at `f7ef7de4b606eec734d04eeaed316fea959cf80e`, then reconciled the complete
landed #805 tree at `809b6d54025fb66000960f30dc750b44ee056d49`. The only shared
index conflict was resolved from that landed index plus A's single new record;
all #805 records, assets and metadata were preserved. The source-bound incident
proposal remains [PR #819](https://github.com/Kgray44/treasurehuntSoT/pull/819),
original candidate `ee7f6b68173fdaa9a726db824fb5184a35fc1df1`.
Its failed [run 40541578392, attempt 2](https://github.com/Kgray44/treasurehuntSoT/actions/runs/40541578392/attempts/2)
is retained. No retry reclassifies that failure.

The #776 incident remains `REQUIRED_PROTECTED_DECISION_MISSING`. Existing capture,
review ordinals, original candidate identities, owner restrictions and 48 deferred
authored/photo states retain their existing scope. This work grants no historical
or post-merge `RELEASE_GO`. PR #805 and its owner workspace are excluded.

## Implementation

- Ordinary transport fetches exact source ancestry and the installed typed reader
  closure through the existing supervised checkout engine. Base/candidate
  snapshots remain complete. Missing objects fail closed; late transport remains
  disabled. The #721 and #776 finite selectors retain their installed routes.
- Authority checkout materializes scripts, policy and the existing finite
  controller's local reader files. The independent fixture compares actual file
  bytes and module imports with a full checkout after disabling transport.
- Ordinary preflight binds protected authority, candidate/tree, controller bytes,
  policy and runtime. It checks bounded inputs, ancestry and disk availability.
  Command transport is checked before execution, retaining whole obligations.
- An external asynchronous supervisor contains synchronous hangs using the
  existing Linux/Windows process ownership implementation. It debits actual setup
  time from the current job/attempt and reserves two minutes for finalization.
  Existing finite job ceilings remain separate. Command timeouts retain their
  original cause; cleanup and retention failures remain distinct.
- Supervision receipts are create-only and explicitly non-qualifying. Unknown
  CPU, child memory, fresh/reused-work and billing measurements remain unavailable.
  An evidence-publication failure retains a fixed-shape original-outcome fallback
  in Actions logs. Completed-obligation authority is unchanged.
- The required decision job explicitly fails when custody or verification did
  not succeed, including draft-triggered skipped work. Its source/readiness gate
  rechecks the exact live PR transaction. A protected dispatch uses its actual
  event input; candidate-written dispatch claims confer no authority.
- The owner-side merge client independently checks the successful app-15368
  decision, workflow, run/attempt, head/base, readiness history and live strict
  server protection. It requires administrator enforcement and an audited ruleset
  state, rereads before merge, supplies an exact-head server compare-and-swap,
  and checks observed merge parents. Failure never triggers another merge attempt.

The existing finalizer and `Sounding Line / Mainline Decision` remain authoritative.
New generic artifact inheritance and preparation/transport optimizations are not
activated by A. They start in shadow mode in their dependent increments.

## Measured development evidence

| Observation                                       | Result and scope                                                                                                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Historical authority fetch, #819 attempt 2        | 518.703 seconds                                                                                                                                                                                |
| Historical candidate checkout, same attempt       | Timed out at 600 seconds while fetching all branches/tags; custody and verification did not execute                                                                                            |
| Existing selected-checkout regressions on Windows | 19 passed, one existing platform skip; 304.071 seconds; includes exact ancestry, omitted unrelated refs, stalls, cancellation, long paths and missing-object attacks                           |
| First authority parity fixture                    | Preserved failure: cone mode intentionally includes root files; fixture media moved under `public/`                                                                                            |
| Corrected authority parity fixture                | 134 files byte-equivalent; full 3.055 seconds, sparse 3.920 seconds; 1 MiB synthetic media omitted with transport disabled; fixture-only, no hosted speedup claim                              |
| Reliability focused tests                         | External synchronous-hang containment, detached listener cleanup, command timeout cause, retention failure, source drift, job-clock debit and merge races passed                               |
| Existing Windows verifier/diagnostics run         | 210 passed, 13 failed; the same 13 failure reasons reproduced on exact protected main and candidate `b42cf7ccb273f67112ffda28634366c8c5f5c204` in the same runtime with isolated fixture state |

Original logs and failed fixture source are retained privately with SHA-256
receipts. The matched baseline does not turn any failed assertion into a pass.
Linux protected qualification remains required. Test counts do not establish
billing savings or human/product acceptance.

## Remaining integration proof

The startup live audit found strict required app-15368 checks, administrator
enforcement disabled and no rulesets. Source tests alone do not close A0.
Record actual protection correction, actor permissions, an effective protected
transaction, exact candidate/base/run/attempt, hosted before/after timings,
successful protected integration and landed smoke before completing this record.

The ordinary ten-minute objective and fifteen-minute governing ceiling remain
the performance target. A retains the installed job ceilings while debiting setup
and bounding execution; it does not claim those targets have already been met.
Any measured overrun requires an explicit candidate-specific disposition.

The task's single additional workspace has an explicit owner-authorized admission
exception. Both drive reserves and the twelve-GiB workspace peak remain in force;
the stored aggregate policy was not raised. Preserve receipts and retire the
workspace through the lifecycle manager when the modernization is complete.
