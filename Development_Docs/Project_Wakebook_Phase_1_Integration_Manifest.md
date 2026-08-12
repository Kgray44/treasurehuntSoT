---
title: Project Wakebook Phase 1 Integration Manifest
audience: product-engineering
status: current
canonical_for: project-wakebook-phase-1-integration-manifest
last_reviewed: 2026-08-12
---

# Project Wakebook Phase 1 integration manifest

## Current integration state

| Item                    | State                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Initial branch base     | `f1c2f22dd935322c1a71eb80c51592f243dc196d`                                                                                |
| Current reconciled base | `54e3d818d49d45282a9c419d562d4b5c78911ccd`                                                                                |
| Incoming accepted work  | Shipwright Phase 1 acceptance repair at `54e3d818d49d45282a9c419d562d4b5c78911ccd`, including the Studio and Helm repairs |
| Semantic reconciliation | `7a7f43837b7e948081f6b6b3f44bc8f2c80cfaae` retains Wakebook and takes all accepted mainline updates                       |
| Implementation commits  | Preserved from the existing remote candidate                                                                              |
| Sounding Line evidence  | `22940b9004bc89def300a808f426a0ed4dc77658`: focused governed `browser.wakebook` PASS (1/1); 15 capture review accepted    |
| Owner walkthrough       | `OWNER_ACCEPTED_PHASE_1` recorded 2026-08-12                                                                              |
| Main merge              | Blocked by the external Helm invitation repair and a later source-bound Mainline Decision `RELEASE_GO`                    |

## Owned implementation paths

Expected Wakebook-owned additions are `src/wakebook/**`, `src/components/wakebook/**`, `/api/passport/voyages/**`, focused tests, and Phase 1 records. Existing Passport page entry points and Personal Harbor styles/navigation are shared seams and will receive targeted changes only.

Wayfarer materialization/mutation ownership, One Voyage runtime rows, Artifact Cabinet provenance, Homeport shell identity, and adjacent-project contracts remain outside Wakebook ownership.

## Shared-file protocol

Before each shared-file edit and final validation, compare current `origin/main`. Preserve accepted Deepwater additions in Feature Catalog and Sounding Line files. Stage only enumerated Wakebook paths. Do not merge, rebase, copy, or modify concurrent Phase 1 worktrees.

## Final convergence requirements

Immediately before final evidence: fetch origin; inspect every incoming relevant change; reconcile semantically; regenerate docs/Feature Catalog/test registry; rerun invalidated Sounding Line gates; record final SHA relationship; commit and push the Wakebook branch; verify local/remote parity; leave main untouched unless the governed owner-acceptance process authorizes normal protected integration.
