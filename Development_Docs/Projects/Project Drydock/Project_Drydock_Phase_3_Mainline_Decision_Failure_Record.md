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
