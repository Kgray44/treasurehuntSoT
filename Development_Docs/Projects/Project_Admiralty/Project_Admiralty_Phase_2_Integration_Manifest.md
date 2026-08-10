---
title: Project Admiralty Phase 2 Integration Manifest
audience: product-engineering-security
status: current
canonical_for: project-admiralty-phase-2-integration-manifest
last_reviewed: 2026-08-10
---

# Project Admiralty Phase 2 integration manifest

## Source identity

| Item                      | Value                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| Starting `origin/main`    | `468530645e983412e5f4c1aaa103915be77c9c07`                                                          |
| Accepted Phase 1 ancestor | `d1344e8ce613cdb3e3adc1fc13803b6356f1c0db`                                                          |
| Worktree                  | `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\project-admiralty-phase2-open-the-chartroom` |
| Branch                    | `codex/project-admiralty-phase2-open-the-chartroom`                                                 |
| Reconciled `origin/main`  | `4a0f803a8ac4c238dc875da07df3cf0d1a5c81a3`                                                          |
| Reconciliation merge      | `4e7a3299bac3f60f14bb52858cabb4c8763fe983`                                                          |
| Exact tested source       | Reconciled browser matrix: `4e7a3299...`; Sounding Line pending                                     |
| Owner decision            | `PENDING_OWNER_DECISION`                                                                            |
| Publication               | Branch only; not canonical main and not deployed                                                    |

## Source families

- `src/admiralty`: capability overlays, typed read models, investigation, page
  authorization, rate limits, and owner-named read ports.
- `src/app/admin` and `src/components/admiralty`: the 15-route responsive
  Chartroom, filtered navigation, dossiers, safe details, and error/loading
  boundaries.
- canonical account/menu navigation integration for authorized roles only.
- `scripts/admiralty`, Playwright configuration, and Phase 2 tests for policy,
  fixtures, journeys, Sounding Line, and walkthrough runtime.
- Project Admiralty Phase 2 governance, Deepwater dispositions, product/admin
  guides, Feature Catalog, and shared test-policy metadata.

## Schema, mutation, and rollback

Phase 2 adds no schema or migration. It adds no broad administrative mutation;
the only mutation path shown is inherited Phase 1 consented Support Access.
Removing the new routes, adapters, navigation mappings, registry overlays, and
test registrations returns the product to accepted Phase 1 without data
migration or backfill.

## Mainline reconciliation

The 2026-08-10 fetch advanced accepted main from the Phase 2 starting base
through Project Helm Phase 1, Project Tideglass Phase 2, and Project Deepwater
Phase 3 final records. Helm/Tideglass product and migration work is `UNRELATED`
to the Chartroom's owner-named read projections. Shared Feature Catalog,
Deepwater, documentation index, package/test metadata, navigation, and Sounding
Line files are `CONTRACT_ADJACENT`; canonical generator output was regenerated
from both inputs. The few shared Admiralty capability/navigation changes are
`AUTHORITY_CHANGING` and were retained additively. There was no unresolved
Chartroom source conflict, no Phase 2 schema migration, and no replacement of a
Wayfarer, Harborlight, One Voyage, Sealed Hold, Deepwater, or Sounding Line
canonical owner.

## Integration boundary

The branch may be pushed for review and walkthrough preparation. It must not be
merged to canonical main until latest main is reconciled, exact-source Sounding
Line authority passes, and the owner explicitly accepts the walkthrough. Phase
2 integration is not a deployment and does not authorize Phase 3.
