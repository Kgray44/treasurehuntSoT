# ADR 0018: Persisted release authority and evidence truth boundary

- Status: accepted for Phase B-6
- Date: 2026-07-18

## Context

Build success and synthetic replay success do not prove that Vision Waypoints are safe for public automatic progression. Phase B-6 also needs real locked pilot corpora, clean-machine distribution evidence, production trust, external usability, hardware coverage, and independent review. A static badge could become detached from those facts.

## Decision

Release status is represented by versioned `VisionRelease`, `VisionReleaseIssue`, compatibility, artifact, dataset, test-run, update-state, and reliability records. The seeded `0.8.0-b6` release is `EXPERIMENTAL` and `NO_GO`. The dashboard and API derive open blockers from persisted issue state. Synthetic reports carry an explicit non-field evidence class and set `releaseEligible` to false.

Resolved issues remain in the register with their original release-blocking classification, regression command, and evidence. A release can be promoted only after no release-blocking issue remains open and the separate governing gates have evidence.

## Consequences

- The application cannot infer public readiness from one passing test suite.
- Automatic progression remains disabled.
- Locked-corpus and certification identifiers are versioned and hash-addressed.
- External or unavailable evidence is reported as a blocker rather than simulated.
