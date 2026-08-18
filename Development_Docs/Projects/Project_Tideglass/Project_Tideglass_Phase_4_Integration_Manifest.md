---
title: Project Tideglass Phase 4 Integration Manifest
status: IN_PROGRESS
project: Project Tideglass
phase: "Phase 4 - Fix the Bearings"
canonical_for: project-tideglass-phase-4-integration-manifest
---

# Project Tideglass Phase 4 Integration Manifest

| Consumer          | Canonical seam                                                                                                             | Current Phase 4 result                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Drydock           | `src/tideglass/drydock-adapter.ts` -> accepted `parseDrydockBlock`                                                         | Implemented; no second registry or upcaster                                                                           |
| Wakebook/Wayfarer | Existing exact played-anchor passage                                                                                       | Retained; final regression pending                                                                                    |
| Shipwright        | Existing Creator-authorized Studio route                                                                                   | Retained; final regression pending                                                                                    |
| Admiralty         | Dossier approved-grant panel -> `POST /api/admin/support/tideglass` through support grant and target-account authorization | Implemented; exact-pair form is only shown for the scoped category                                                    |
| Harborlight       | Community listing current release plus an earlier active release with exact same-Chronicle source editions                 | Public Tideglass handoff implemented; package checksums, install, rollback, and license data remain Harborlight-owned |
| Helm              | Captain Library -> `GET /api/captain/tideglass/preflight` -> exact selected-to-recommended Tideglass pair                 | Implemented; requires active Captain workspace, verifies public-or-own Chronicle scope, returns CAPTAIN_SAFE category/count summary only, and never changes Voyage state |

This manifest is deliberately not a completion receipt. It records exact seams,
including the read-only Helm preflight. Owner acceptance is recorded; protected
integration remains a separate gate.
