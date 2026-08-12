---
title: Project Drydock Phase 3 Mainline Decision failure record
audience: engineering
status: historical
canonical_for: project-drydock-phase-3-mainline-decision-failure-20260812
last_reviewed: 2026-08-12
---

# Project Drydock Phase 3 Mainline Decision failure record

## Candidate and decision boundary

The frozen candidate `1c888c92d7aa54abf9d16d86e916751bab4b7fc1`, tagged
`project-drydock-phase3-candidate-20260812`, received its single serialized
Sounding Line Mainline Decision on 2026-08-12. The decision terminated
`RELEASE_NO_GO`; this record does not claim protected integration, mainline
acceptance, deployment, or exact-main proof.

The sealed decision reported no missing mandatory suites and no invalid runtime
conformance. It rejected invalid evidence from four suites:

| Suite                     | Result   | Recorded cause                                                                             |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `browser.access-sentinel` | `FAILED` | Another validation run held the shared validation-runtime lock.                            |
| `browser.helm`            | `FAILED` | Another validation run held the shared validation-runtime lock.                            |
| `browser.admiralty`       | `FAILED` | Its isolated production build could not write `.next` because C: had no free space.        |
| `static.core`             | `FAILED` | Prettier found generated `tsconfig.json` formatting drift after the failed build sequence. |

## Disposition

The decision is terminal for this candidate. Its branch/tag remain historical
evidence and will not be reused for authority. The shared validation lock was
subsequently observed released, with no listener on the task's checked ports,
and the Bridgewatch lane was notified that it could proceed.

The task-owned ignored browser environment file that selected a Drydock-specific
build directory was removed. `tsconfig.json` was restored to the repository's
formatted, tracked content. These steps repair local validation provenance only;
they do not change the Phase 3 product scope or turn earlier local browser
evidence into acceptance evidence.

## Required path back to authority

Development may use focused non-authoritative checks. Before any replacement
Mainline Decision, the phase must be requalified, frozen at a new exact SHA,
and granted the serialized acceptance lane. Only one Mainline Decision may be
dispatched for that replacement candidate.

## Hosted r3 decision

The r3 frozen candidate `01a925d13fb5ab0a6064c1e6e4d2f1995a032349`, tagged
`project-drydock-phase3-candidate-20260812-r3`, received its one explicit
hosted `Sounding Line / Mainline Decision` on 2026-08-12 (run
`31601859085`, PR #52, qualified base
`5735d43821209adb2259ec2c38979281da1bb5b9`). The sealed finalizer is
`SOUNDING_LINE_FINALIZER` with decision `EVIDENCE_INVALID`, not `RELEASE_GO`.
It has 38 mandatory receipts, no missing suite, and one failed cleanly
teardown-bound receipt: `browser.helm`.

`browser.helm` ran its three registered cases on a task-owned hosted runtime.
The first case passed; the second case,
`authenticated membership heartbeats are independently visible in the Captain
operational projection`, failed while its `acceptGuestInvitation` helper waited
for the Player handoff. The acceptance request returned HTTP 200, but the page
remained at `/player/invitation` rather than reaching
`/player/playthroughs/`. The worker recorded `FAILED`, exit code `1`, and
`cleanupState: CLEAN`.

This is classified as a required cross-project Helm browser compatibility
failure. The candidate introduces no Helm, invitation, membership, Player route,
or test source changes; its only shared runtime input is the additive Drydock
simulation/provenance migration pair. It does not minimize the failure, claim an
inherited pass, or permit the r3 candidate to receive another authority
decision.

The exact focused hosted `browser.helm` diagnostic (run `31604050573`) then
reproduced the required-suite failure at the same source without invoking a
finalizer or authority. Its receipt is `FAILED`, exit code `1`, and
`cleanupState: CLEAN`. In that run the invitation handoffs completed, but the
same second Helm case timed out waiting for the Captain projection to report all
four accepted memberships as `CONNECTED_SYNCED:SYNCHRONIZED`, although every
heartbeat POST returned HTTP 200. The two source-bound observations establish a
Helm browser compatibility failure family: Player handoff after accepted
invitation and Captain presence projection convergence both require focused
Helm-owned repair and verification.

## Focused recovery evidence

Project Helm repaired the two source-level resilience gaps in published commit
`bf03b0811eada44f6f9db56858b76e7c778e1d81`: an accepted invitation now has a
single bounded hard-navigation recovery when the soft handoff remains on the
invitation route, and membership presence records timestamps at persistence
time so delayed concurrent heartbeat writes retain bounded freshness. The
repair's 15 focused unit cases and its exact three-case browser suite passed
locally; its hosted focused diagnostic run `31606851534` passed all three
registered cases with clean teardown.

Drydock incorporated that exact repair as
`5717ab5c2f1445cd899471932b99eacf20e81bc1`. The same smallest direct unit
scope passed 15/15 on the combined source, and focused hosted run `31608295048`
then passed the exact `browser.helm` suite: three registered, discovered,
executed, and passed cases; exit code `0`; `cleanupState: CLEAN`; duration
454,023 ms. The focused workflow contains no finalizer and issued no authority
decision. Current `origin/main` remains
`5735d43821209adb2259ec2c38979281da1bb5b9`, unchanged from the r3 base.

The phase is therefore returned to full replacement-candidate qualification.
The r3 authority result remains terminal history: these focused recovery
receipts do not alter it or claim protected integration.

## Hosted r4 decision

The r4 frozen candidate `fd57f0f23330d86502808b197c2b9d5f3a90e422`, tagged
`project-drydock-phase3-candidate-20260812-r4`, consumed its one explicit
hosted Mainline Decision in run `31612564391` against qualified base
`5735d43821209adb2259ec2c38979281da1bb5b9`. The sealed finalizer is
`SOUNDING_LINE_FINALIZER` with decision `EVIDENCE_INVALID`, not `RELEASE_GO`.
It received 18 receipts: 17 `PASSED` with `cleanupState: CLEAN`; there were no
missing, duplicate, unknown, invalid, or runtime-conformance failures.

The sole failed clean receipt is `unit.feature-catalog`. Its audited-catalog
ordering test expected 45 entries, while the current source contains 46
entries because this Phase 3 branch-complete fragment is now eligible and
present. The failure is an exact Feature Catalog test-maintenance defect, not
a Drydock simulation, Studio, migration, browser, or protected-main defect.
The r4 candidate remains terminal and cannot be retried. The required path is
to repair and prove the smallest Feature Catalog scope, then requalify and
freeze a new candidate before acquiring a future serialized authority lane.
