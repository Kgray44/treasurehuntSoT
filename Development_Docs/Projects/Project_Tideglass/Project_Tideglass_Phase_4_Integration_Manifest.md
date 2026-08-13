---
title: Project Tideglass Phase 4 Integration Manifest
status: IN_PROGRESS
project: Project Tideglass
phase: "Phase 4 - Fix the Bearings"
canonical_for: project-tideglass-phase-4-integration-manifest
---

# Project Tideglass Phase 4 Integration Manifest

| Consumer          | Canonical seam                                                                                | Current Phase 4 result                              |
| ----------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Drydock           | `src/tideglass/drydock-adapter.ts` -> accepted `parseDrydockBlock`                            | Implemented; no second registry or upcaster         |
| Wakebook/Wayfarer | Existing exact played-anchor passage                                                          | Retained; final regression pending                  |
| Shipwright        | Existing Creator-authorized Studio route                                                      | Retained; final regression pending                  |
| Admiralty         | Dossier approved-grant panel -> `POST /api/admin/support/tideglass` through support grant and target-account authorization | Implemented; exact-pair form is only shown for the scoped category |
| Harborlight       | Community update payload has no accepted source/target Chronicle edition pair on current main | No consumer fabricated; owner boundary retained     |
| Helm              | Current main has no accepted edition-selection/preflight comparison consumer                  | No Captain projection or launch behavior fabricated |

This manifest is deliberately not a completion receipt. It records exact seams
and the reasons unavailable consumers are not simulated.
