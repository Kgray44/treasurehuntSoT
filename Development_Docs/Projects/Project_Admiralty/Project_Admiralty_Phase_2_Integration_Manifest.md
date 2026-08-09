---
title: Project Admiralty Phase 2 Integration Manifest
audience: product-engineering-security
status: current
canonical_for: project-admiralty-phase-2-integration-manifest
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 2 integration manifest

## Source identity

| Item                      | Value                                                       |
| ------------------------- | ----------------------------------------------------------- |
| Starting `origin/main`    | `468530645e983412e5f4c1aaa103915be77c9c07`                  |
| Accepted Phase 1 ancestor | `d1344e8ce613cdb3e3adc1fc13803b6356f1c0db`                  |
| Worktree                  | `C:\Users\kkids\Documents\treasurehuntSoT-admiralty-phase2` |
| Branch                    | `codex/project-admiralty-phase2-open-the-chartroom`         |
| Reconciled `origin/main`  | Pending active mainline coordination hold                   |
| Exact tested source       | Pending final checkpoint and reconciliation                 |
| Owner decision            | `PENDING_OWNER_DECISION`                                    |
| Publication               | Branch only; not canonical main and not deployed            |

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

## Integration boundary

The branch may be pushed for review and walkthrough preparation. It must not be
merged to canonical main until the active coordination hold is released, the
latest main is reconciled, exact-source Sounding Line authority passes, and the
owner explicitly accepts the walkthrough. Phase 2 integration is not a
deployment and does not authorize Phase 3.
