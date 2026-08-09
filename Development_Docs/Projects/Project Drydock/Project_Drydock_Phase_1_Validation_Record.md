---
title: Project Drydock Phase 1 Validation Record
audience: engineering
status: current
canonical_for: project-drydock-phase-1-validation-record
last_reviewed: 2026-08-09
---

# Project Drydock Phase 1 validation record

Candidate state: **IMPLEMENTATION VALIDATION IN PROGRESS**. This record distinguishes diagnostic/focused proof from final Sounding Line mainline acceptance.

## Completed focused evidence

| Evidence                                                         | Result                                                                                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm run drydock:generate` and `npm run drydock:artifacts:check` | generated machine artifacts are deterministic and current                                                                           |
| `npm run drydock:validate`                                       | 23 / 23 synthetic historical fixtures parse/upcast/canonicalize; sanitized checksums emitted                                        |
| `npm run drydock:test`                                           | 5 files, 98 tests passed at the current-product compatibility/privacy checkpoint; final governed count is supplied by Sounding Line |
| `npm run typecheck`                                              | passed after Prisma client generation against the SQLite schema                                                                     |
| `npm run test:policy`                                            | passed; 49 suites, 11 owners, 413 contracts, no policy errors at the recorded checkpoint                                            |

Sounding Line local-change decision at the pre-reconciliation checkpoint: `RELEASE_GO`, evidence digest `c268204f6fdb80330a9d61bb6f7146ede8261ac12f8b00bfbf80fe62ab7e7a55`. This is governed local evidence, not the required exact-candidate mainline decision.

The incremental performance unit validates a synthetic 230-block sample under its 3,000 ms unit ceiling and exercises the one-block invalidation path. Final evidence will record observed Sounding Line duration/environment; correctness remains authoritative over timing.

## Pending exact-candidate evidence

- final Drydock CLI/artifact check after documentation is complete;
- current validator, Studio component, One Voyage progression, architecture, docs, Feature Catalog, formatting/lint, build, and required database checks selected by Sounding Line;
- exact committed candidate source binding and mainline decision;
- protected PR integration and post-merge permanent-stop proof.

No external provider is required. Vision and webhook provider contracts remain truthfully `NOT_CONFIGURED` and are rejected as active completion without a configured owner adapter.
