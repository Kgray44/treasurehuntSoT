---
title: Project Wakebook Phase 1 Integration Manifest
audience: product-engineering
status: current
canonical_for: project-wakebook-phase-1-integration-manifest
last_reviewed: 2026-08-12
---

# Project Wakebook Phase 1 integration manifest

## Current integration state

| Item                    | State                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Initial branch base     | `f1c2f22dd935322c1a71eb80c51592f243dc196d`                                                                                      |
| Current reconciled base | `dc430b79aa3ddd27443f47bb493ae6c471a41616`                                                                                      |
| Incoming accepted work  | Protected-main runtime/finalization correction at `236c27241bb8d1630274f5d5412ec9addbdb8893`, including the Helm browser repair |
| Semantic reconciliation | `afd3c15d8` retains Wakebook and takes all accepted mainline documentation/index updates                                        |
| Implementation commits  | Preserved from the existing remote candidate                                                                                    |
| Sounding Line evidence  | `22940b9004bc89def300a808f426a0ed4dc77658`: focused governed `browser.wakebook` PASS (1/1); 15 capture review accepted          |
| Owner walkthrough       | `OWNER_ACCEPTED_PHASE_1` recorded 2026-08-12                                                                                    |
| Main merge              | Blocked until focused requalification and a source-bound protected Mainline Decision `RELEASE_GO`                               |

## Owned implementation paths

Expected Wakebook-owned additions are `src/wakebook/**`, `src/components/wakebook/**`, `/api/passport/voyages/**`, focused tests, and Phase 1 records. Existing Passport page entry points and Personal Harbor styles/navigation are shared seams and will receive targeted changes only.

Wayfarer materialization/mutation ownership, One Voyage runtime rows, Artifact Cabinet provenance, Homeport shell identity, and adjacent-project contracts remain outside Wakebook ownership.

## Shared-file protocol

Before each shared-file edit and final validation, compare current `origin/main`. Preserve accepted Deepwater additions in Feature Catalog and Sounding Line files. Stage only enumerated Wakebook paths. Do not merge, rebase, copy, or modify concurrent Phase 1 worktrees.

## Final convergence requirements

Immediately before final evidence: fetch origin; inspect every incoming relevant change; reconcile semantically; regenerate docs/Feature Catalog/test registry; rerun invalidated Sounding Line gates; record final SHA relationship; commit and push the Wakebook branch; verify local/remote parity; leave main untouched unless the governed owner-acceptance process authorizes normal protected integration.
