---
title: Project Sounding Line Phase 4 Release Decision and Authority Model
audience: engineering
status: planned
canonical_for: sounding-line-phase-4-release-authority
last_reviewed: 2026-07-29
---

# Phase 4 Release Decision and Authority Model

## Future decisions

| Decision                           | Meaning                                                                     | Minimum condition                                          |
| ---------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `RELEASE_GO`                       | all required evidence is valid and complete                                 | no veto, valid cleanup, authorized review                  |
| `RELEASE_GO_WITH_EXTERNAL_PENDING` | core release is complete under a future approved external-pending rule      | named pending external gate, expiry, compensating evidence |
| `RELEASE_NO_GO`                    | a required product, policy, security, or release gate failed                | retained failure and remediation owner                     |
| `RELEASE_INCOMPLETE`               | required evidence was blocked, unavailable, stale, or not run               | no authority to release                                    |
| `EVIDENCE_INVALID`                 | an identity, chain, count, artifact, or cleanup defect invalidates evidence | revoke affected receipt and rerun                          |

These names are schemas for future decisions only. This branch can produce no
authoritative decision. Any illustrative decision must be marked `synthetic`.

Required evidence is source/policy/lock identity, selected and omitted suites,
contract coverage, worker/environment identity, counts, artifacts/hashes,
retry/flake classification, cleanup proof, applicable security/privacy review,
and authorized review. Mandatory-gate failure, invalid evidence, security veto,
missing cleanup, revoked worker, stale evidence, or source movement after
receipt is a veto. Quarantine and flake effects must be explicit and cannot
hide privacy, authorization, migration, lifecycle, accessibility, or provider
weakening.

## Future branch-protection proposal

The future human-readable proposal requires policy validation, plan validation,
focused gate, integration gate, and release gate where applicable; owner
approval; stale-review invalidation; verified evidence; no force push; time-bound
exception records; and an audited emergency bypass. It is deliberately not an
API request, workflow, or branch-protection change.

Only an approved future release authority, operating under accepted policy and
with no unresolved veto, may issue a decision. A new source, policy, lockfile,
worker revocation, artifact discrepancy, or missing cleanup invalidates the
receipt and requires fresh evidence.
