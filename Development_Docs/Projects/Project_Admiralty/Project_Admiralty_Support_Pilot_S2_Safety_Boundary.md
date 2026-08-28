---
title: Project Admiralty Support Pilot S2 Safety Boundary
audience: product-engineering
status: current
canonical_for: admiralty-support-pilot-s2-safety-boundary
last_reviewed: 2026-08-27
---

# Support Pilot S2 Safety Boundary

| Control      | Enforced behavior                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Registration | Unknown IDs, `RX`, raw SQL, shell access, source patching, secret access, and unregistered endpoints are refused before mutation.            |
| Consent      | The current parent Support Access grant must contain the exact repair ID and every required scope. Revocation takes effect on the next gate. |
| Assurance    | The operator needs the registered Administrator capability and fresh session-bound privileged assurance.                                     |
| Risk         | The owner-approved ceiling is a hard upper bound. R4 additionally requires per-action human approval; no R4 command is enabled in S2.        |
| Budget       | Commands, affected records, and domains debit durably and never reset in a repair loop.                                                      |
| Concurrency  | Proposal and target revisions are checked again at execution. A target lease prevents two cases from racing.                                 |
| Audit        | Start audit persistence occurs atomically before owner mutation. Outcome evidence is retained separately from owner truth.                   |
| Verification | The owner postcondition is mandatory. No successful response can by itself resolve a case.                                                   |

The Support Pilot coordinator calls named owner operations only. It never writes
Wayfarer or One Voyage truth directly. Each enabled owner operation limits the
record count internally as well as in the registry.
