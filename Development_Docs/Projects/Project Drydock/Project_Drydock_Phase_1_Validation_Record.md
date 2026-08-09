---
title: Project Drydock Phase 1 Validation Record
audience: engineering
status: current
canonical_for: project-drydock-phase-1-validation-record
last_reviewed: 2026-08-09
---

# Project Drydock Phase 1 validation record

Validation state: **MAINLINE ACCEPTED**. This record distinguishes focused proof, superseded diagnostics, protected exact-head acceptance, and post-merge verification.

## Completed focused evidence

| Evidence                                                         | Result                                                                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run drydock:generate` and `npm run drydock:artifacts:check` | generated machine artifacts are deterministic and current                                                       |
| `npm run drydock:validate`                                       | 23 / 23 synthetic historical fixtures parse/upcast/canonicalize; sanitized checksums emitted                    |
| `npm run drydock:test`                                           | 5 files, 98 tests passed                                                                                        |
| `npm run typecheck`                                              | passed after Prisma client generation against the SQLite schema                                                 |
| `npm run test:policy`                                            | passed after final reconciliation; 53 suites, 13 owners, 425 contracts, no policy errors                        |
| `npm run docs:validate` and Feature Catalog gates                | documentation validation plus Feature Catalog sync, validation, and tests passed                                |
| `npm run private-content:scan`                                   | passed; frozen Drydock fixtures remain synthetic and contain no private Chronicle material                      |
| focused current-product regression slice                         | 4 discovered files, 22 tests passed for block registry, progression, Studio editor, and private materialization |

## Protected mainline acceptance

Final candidate `2f86938858b91207b6e58245baa9496bdc839b12` was tested by the protected PR #22 workflow against base `d1344e8ce613cdb3e3adc1fc13803b6356f1c0db`. The protected merge source was `8f549a54951712ea2a500289c0e29fc6b8bfba10`.

- decision: `RELEASE_GO`;
- selected receipts: 34;
- passed receipts: 34;
- clean cleanup states: 34;
- failed receipts: 0;
- evidence digest: `0abd730bbd588744175e419ab717d94b9d4c39ede6271f1cad9be4681ac3d47a`;
- PR checks: 37 / 37 successful;
- protected merge: `468530645e983412e5f4c1aaa103915be77c9c07`.

An earlier hosted checkpoint on candidate `3b3836e512b956a9b3569a8635f046c73a46726c` also reached `RELEASE_GO` after a successful rerun of one unrelated Community focus-timing miss. Its 31 / 31 clean receipt digest `0043b0c139a3d70cc3d327e1b8ffc2e6034470ad4c549e33fd6863f9a3dd5870` is retained only as superseded diagnostic evidence because main later advanced.

The incremental performance unit validates a synthetic 230-block sample under its 3,000 ms unit ceiling and exercises the one-block invalidation path; correctness remains authoritative over timing.

## Post-merge verification

Fetched `origin/main` resolved to `468530645e983412e5f4c1aaa103915be77c9c07`. The candidate and merge are both mainline ancestors. The merge parents are the approved base and candidate, and `git merge-tree --write-tree` recomputation produced the exact integrated tree `d3dbb7dfe55ec5fc4a2e58416d2b892ca8132d3a`. This verifies that protected integration introduced no additional tree delta beyond the accepted merge.

No external provider is required. Vision and webhook provider contracts remain truthfully `NOT_CONFIGURED` and are rejected as active completion without a configured owner adapter.
