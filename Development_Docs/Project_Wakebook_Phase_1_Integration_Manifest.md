---
title: Project Wakebook Phase 1 Integration Manifest
audience: product-engineering
status: current
canonical_for: project-wakebook-phase-1-integration-manifest
last_reviewed: 2026-08-10
---

# Project Wakebook Phase 1 integration manifest

## Current integration state

| Item                    | State                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial branch base     | `f1c2f22dd935322c1a71eb80c51592f243dc196d`                                                                                                                                                              |
| Current reconciled base | `4a0f803a8ac4c238dc875da07df3cf0d1a5c81a3`                                                                                                                                                              |
| Current merge anchor    | `d2a4c18536ea099586acb3d0b991214319113c72`                                                                                                                                                              |
| Incoming accepted work  | Deepwater through Phase 3 closure, Tideglass Phases 1-2, Helm Phase 1, Admiralty Phase 1, Drydock Phase 1, Harborlight corrections, Feature Catalog, Homeport catalogs, and Sounding Line control plane |
| Semantic reconciliation | Combined shared catalogs/control-plane truth; Wakebook moved to `FT-B011`; accepted application/schema behavior preserved                                                                               |
| Implementation anchor   | `ab47dc33a29b2cdd80a97da7fd1af4a9e897b2cc`                                                                                                                                                              |
| Sounding Line evidence  | Focused/browser evidence complete; final exact-source broader authorities pending                                                                                                                       |
| Owner walkthrough       | Package and retained synthetic runtime prepared; owner decision pending                                                                                                                                 |
| Main merge              | Forbidden in this task                                                                                                                                                                                  |

## Owned implementation paths

Wakebook-owned additions are `src/wakebook/**`, `src/components/wakebook/**`, `/api/passport/voyages/**`, focused tests, and Phase 1 records. Existing Passport page entry points and Personal Harbor styles/navigation received targeted shared-seam changes only.

Wayfarer materialization/mutation ownership, One Voyage runtime rows, Artifact Cabinet provenance, Homeport shell identity, and adjacent-project contracts remain outside Wakebook ownership.

## Shared-file protocol

Before each shared-file edit and final validation, compare current `origin/main`. Preserve accepted Deepwater, Tideglass, Helm, Admiralty, and Drydock additions in Feature Catalog, Homeport catalogs, and Sounding Line files. Stage only enumerated Wakebook paths. Do not rebase, copy, or modify concurrent Phase 1 worktrees.

The reconciled control plane contains 44 Feature Catalog entries, 55 Deepwater capabilities, the combined Tideglass `FT-B009`, Admiralty `FT-B010`, and branch-only Wakebook `FT-B011` identities, plus Helm's accepted expansion of Captain `FT-007`. Homeport's accepted inventory contains 295 routes: 92 pages and 203 service sources. The regenerated Sounding Line registry contains 1,902 registered cases across 54 families, including accepted Drydock, Tideglass, Helm, Deepwater, Wakebook, and Community ownership and contracts. The current policy contains 452 contracts, 59 suites, and 15 owners. These generated counts must be rechecked if `origin/main` advances again.

The accepted interval `468530645e983412e5f4c1aaa103915be77c9c07..f07fbb693e32f6b1069870fae9da668ed3392d4b` contains only Drydock's Phase 1 acceptance record and protected closure merge. It changes Drydock records, the Studio Feature Catalog fragment, the generated Feature Catalog, and Ledgerlight inventory. It changes no Wakebook source, test, Prisma, runtime, or Sounding Line policy ownership. Merge `c5baf0e` preserved that accepted truth and all Wakebook-owned implementation; the generated catalog, documentation inventory, and test registry were then regenerated from their authoritative inputs.

The final accepted interval `f07fbb693e32f6b1069870fae9da668ed3392d4b..9de00293c73c2d4aea49dc5d2e7a2a4a0515afe1` corrects only Harborlight's two public Feature Catalog surface paths through Deepwater PR #26. Its exact protected merge parents are the accepted base and validated head `38dd98e1b31251ee991b2fee52e5a998b1a22b47`; hosted Sounding Line returned `RELEASE_GO` with 36/36 required checks successful and clean. Merge `0dcef864` preserved that accepted fragment and all Wakebook work, after which the generated Feature Catalog was rebuilt from all 44 authoritative fragments.

The accepted interval `9de00293c73c2d4aea49dc5d2e7a2a4a0515afe1..fca58389a5e6be7bcf1db55e252b7427eb32b2aa` adds Tideglass Phase 2 edition intelligence and its corrected final records. Wakebook preserved Tideglass-owned schema, service, API, UI, tests, `FT-B009` program identity, documentation, and Sounding Line mappings while retaining Wakebook's owner-private history projection and `FT-B011` identity. No accepted Tideglass change replaced Wakebook's version-pinned historical edition contract.

The final accepted interval `fca58389a5e6be7bcf1db55e252b7427eb32b2aa..4a0f803a8ac4c238dc875da07df3cf0d1a5c81a3` adds Helm Phase 1 participating-Captain behavior and Deepwater Phase 3 final control-plane and closure truth. Eighteen shared paths were audited. Conflicts in the changelog, generated Feature Catalog, Playwright registration, Sounding Line registry, generated active-test inventory, and impact map were resolved from authoritative inputs by retaining both Wakebook and Helm registrations and regenerating shared outputs. Merge `d2a4c185` leaves Wakebook zero commits behind accepted main and preserves all Wakebook-owned implementation without a destructive rebase or schema change.

## Final convergence requirements

Immediately before final evidence: fetch origin; inspect every incoming relevant change; reconcile semantically; regenerate docs/Feature Catalog/test registry; rerun invalidated Sounding Line gates; record final SHA relationship; commit and push the Wakebook branch; verify local/remote parity; leave main untouched.
