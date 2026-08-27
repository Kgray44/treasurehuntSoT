---
title: Project Helm Amendment A2 Validation Record
audience: product-engineering
status: current
canonical_for: project-helm-amendment-a2-validation-record
last_reviewed: 2026-08-27
---

# Project Helm Amendment A2 validation record

## Local candidate evidence

This recovery starts from failed candidate `8473d3e47327a1c6fce9455bd47cce65623be29c` and reconciles protected main `6db14e3e142eee561385f6205cbc0c9d2333fb29` exactly once through local merge `5e981dc5`. The following evidence is task-owned and local until a candidate-bound Sounding Line decision and protected merge are recorded separately.

| Evidence                                   | Result               | Boundary                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                                 | passed               | `npm run typecheck` with the A2 authority, projection, route, and UI changes.                                                                                                                                                                                                                                                                                                            |
| Authority lifecycle unit suite             | passed               | Direct transfer, retry authorization, relinquishment, first-committed takeover, one safe fork, concurrent independent forks, and receipt privacy.                                                                                                                                                                                                                                        |
| Player Library and Waiting Room components | passed               | Succession Hold wording and Take Captaincy, Continue Solo, and canonical Leave Voyage mutations.                                                                                                                                                                                                                                                                                         |
| SQLite migration rehearsal                 | passed               | Fresh and upgrade task-owned databases retain shared state, default existing/fresh authority to `ASSIGNED`, create zero backfill receipts, and pass foreign-key checks.                                                                                                                                                                                                                  |
| MySQL migration boundary                   | schema/DDL validated | Checked-in additive DDL is present and schema-valid; a configured live MySQL execution was not used.                                                                                                                                                                                                                                                                                     |
| Production-style browser journeys          | passed, 6/6          | One isolated Chromium journey on a fresh task-owned SQLite database uses `next build` and `next start`, not dev HMR; it proves transfer, relinquishment, succession refresh and takeover contention, solo continuation, independent forks, and Player projection/privacy boundaries.                                                                                                     |
| Default Sounding Line Chromium fixture     | passed, 5/5          | A fresh standard SQLite bootstrap and seed with the default `playwright.config.ts` prove the legacy Helm path, all six A2 semantics, zero-invite creation, presence projection, and responsive/keyboard/reduced-motion behavior against the built `next start` server. The former Webpack development fixture committed A2-2 but could lose its response; it is not used for acceptance. |

## Privacy and lineage proof

Fork tests use a private-payload canary and verify it never reaches the child event copy. The child receives only the same published edition, allowlisted canonical event types, and shared state. Receipts are read only after the requester is still authorized for the matching Voyage/membership, preventing idempotency-key probing from exposing a successor or child Voyage.

## Pending final authority

This record does not itself accept the work. Final candidate SHA, hosted Sounding Line decision, protected pull request, merge tree parity, and landed main smoke belong to the protected integration closeout.
