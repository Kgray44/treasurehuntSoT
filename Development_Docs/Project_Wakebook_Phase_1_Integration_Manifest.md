---
title: Project Wakebook Phase 1 Integration Manifest
audience: product-engineering
status: current
canonical_for: project-wakebook-phase-1-integration-manifest
last_reviewed: 2026-08-10
---

# Project Wakebook Phase 1 integration manifest

## Current integration state

| Item                    | State                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Initial branch base     | `f1c2f22dd935322c1a71eb80c51592f243dc196d`                                                                               |
| Current reconciled base | `384ad39fbc40e8cbe16dd2aa2c83abd3e00a56c6`                                                                               |
| Incoming accepted work  | Previously reconciled Deepwater, Tideglass, Helm, Drydock, Admiralty, and Homeport governance; then Shipwright Phase 1    |
| Semantic reconciliation | `4382584d3` retained Wakebook with the prior accepted wave; `620ef4eb1` retains Wakebook while adopting Shipwright Phase 1 |
| Implementation commits  | Preserved from the existing remote candidate                                                                             |
| Sounding Line evidence  | Pending                                                                                                                  |
| Owner walkthrough       | Pending                                                                                                                  |
| Main merge              | Blocked until final governed evidence and the separately required owner walkthrough/acceptance                           |

## Owned implementation paths

Expected Wakebook-owned additions are `src/wakebook/**`, `src/components/wakebook/**`, `/api/passport/voyages/**`, focused tests, and Phase 1 records. Existing Passport page entry points and Personal Harbor styles/navigation are shared seams and will receive targeted changes only.

Wayfarer materialization/mutation ownership, One Voyage runtime rows, Artifact Cabinet provenance, Homeport shell identity, and adjacent-project contracts remain outside Wakebook ownership.

## Shared-file protocol

Before each shared-file edit and final validation, compare current `origin/main`. Preserve accepted Deepwater additions in Feature Catalog and Sounding Line files. Stage only enumerated Wakebook paths. Do not merge, rebase, copy, or modify concurrent Phase 1 worktrees.

## Final convergence requirements

Immediately before final evidence: fetch origin; inspect every incoming relevant change; reconcile semantically; regenerate docs/Feature Catalog/test registry; rerun invalidated Sounding Line gates; record final SHA relationship; commit and push the Wakebook branch; verify local/remote parity; leave main untouched unless the governed owner-acceptance process authorizes normal protected integration.
