---
title: Project Admiralty Phase 2 Integration Manifest
audience: product-engineering-security
status: current
canonical_for: project-admiralty-phase-2-integration-manifest
last_reviewed: 2026-08-12
---

# Project Admiralty Phase 2 integration manifest

## Source identity

| Item                      | Value                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| Starting `origin/main`    | `468530645e983412e5f4c1aaa103915be77c9c07`                                                          |
| Accepted Phase 1 ancestor | `d1344e8ce613cdb3e3adc1fc13803b6356f1c0db`                                                          |
| Worktree                  | `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\project-admiralty-phase2-open-the-chartroom` |
| Branch                    | `codex/project-admiralty-phase2-open-the-chartroom`                                                 |
| Reconciled `origin/main`  | `54e3d818d49d45282a9c419d562d4b5c78911ccd`                                                          |
| Reconciliation merge      | `927c54990238e3d2290e104043552789d51a0de4`                                                          |
| Reconciliation repairs    | `6b2724b67`, `b299bc494`, and `6604efae5`; prior receipts invalidated by new mainline               |
| Technical qualification   | `b32a3c961bdd4b4a743a73b7d226f6cd14db9d1c`; `RELEASE_GO` in `31581152448`                           |
| Owner decision            | `ACCEPTED` on `2026-08-12`                                                                          |
| Publication               | Decision-record candidate pending exact-source authority and protected merge; not deployed          |

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

The latest accepted main contains Shipwright acceptance repairs, resource-scoped
Sounding Line runtime improvements, and Studio command-palette correction. These
changes are `CONTRACT_ADJACENT` to Chartroom projections. Conflicts were limited
to the Helm navigation test and a command-palette assertion: the stronger Helm
settlement waits and both compatible palette assertions were retained. Earlier
hosted finalization found missing generated-Prisma preparation for two
Admiralty test lanes, a workspace-link copying gap, a Studio assertion race,
and a Sounding Line controller lost-update race. Each has a narrow repair and
focused validation. There is no Phase 2 schema migration and no replacement of
a Wayfarer, Harborlight, One Voyage, Sealed Hold, Deepwater, or Sounding Line
canonical owner.

## Integration boundary

The owner accepted the re-prepared synthetic walkthrough for qualified source
`b32a3c961...` on `2026-08-12`. The current decision-record candidate must
receive its own exact-source `RELEASE_GO` and protected-merge binding before it
may be merged to canonical main. Phase 2 integration is not a deployment and
does not authorize Phase 3.
