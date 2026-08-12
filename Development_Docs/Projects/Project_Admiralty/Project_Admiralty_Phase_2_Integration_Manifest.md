---
title: Project Admiralty Phase 2 Integration Manifest
audience: product-engineering-security
status: current
canonical_for: project-admiralty-phase-2-integration-manifest
last_reviewed: 2026-08-12
---

# Project Admiralty Phase 2 integration manifest

## Source identity

| Item                      | Value                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Starting `origin/main`    | `468530645e983412e5f4c1aaa103915be77c9c07`                                                                        |
| Accepted Phase 1 ancestor | `d1344e8ce613cdb3e3adc1fc13803b6356f1c0db`                                                                        |
| Worktree                  | `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\project-admiralty-phase2-open-the-chartroom`               |
| Branch                    | `codex/project-admiralty-phase2-open-the-chartroom`                                                               |
| Reconciled `origin/main`  | `236c27241bb8d1630274f5d5412ec9addbdb8893`                                                                        |
| Reconciliation merge      | `5e6ca3f34ea8eb7eff1fd92ca2fb832f71b3bec1`                                                                        |
| Reconciliation repairs    | `f50613964`, `c046df741`, and `7bdcc97a8`                                                                         |
| Exact tested source       | Sounding Line-governed isolated Chartroom browser 3/3: `7bdcc97a8...`; explicit frozen-candidate decision pending |
| Owner decision            | `PENDING_OWNER_DECISION`                                                                                          |
| Publication               | Branch only; not canonical main and not deployed                                                                  |

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

The 2026-08-12 fetch advanced accepted main through the explicit-dispatch
Sounding Line finalization boundary, Bridgewatch workspace delivery, and
cross-program product, governance, and documentation records. Those changes are
`CONTRACT_ADJACENT` to the Chartroom's owner-named read projections. The sole
merge conflict was generated Feature Catalog source identity; accepted-main
generator state was retained and regenerated. A subsequent Studio duplicate-close
declaration and Sounding Line Phase 2 browser-adapter classification defect were
repaired with focused tests. There is no Phase 2 schema migration and no
replacement of a Wayfarer, Harborlight, One Voyage, Sealed Hold, Deepwater, or
Sounding Line canonical owner.

## Integration boundary

The branch may be pushed for review and walkthrough preparation. It must not be
merged to canonical main until an explicit frozen-candidate Sounding Line
Mainline Decision passes and the owner explicitly accepts the walkthrough. Phase
2 integration is not a deployment and does not authorize Phase 3.
