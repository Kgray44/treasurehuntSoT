---
title: Project Tideglass Phase 4 Integration Manifest
status: ACCEPTED_MAINLINE
project: Project Tideglass
phase: "Phase 4 - Fix the Bearings"
canonical_for: project-tideglass-phase-4-integration-manifest
---

# Project Tideglass Phase 4 Integration Manifest

> Current status: Phase 4 is accepted on protected main through PR #195
> (`d3787ccc3260611580fa44b83ece844c80563cc2`). This manifest records the
> accepted seams; it does not claim deployment or live-Voyage operation.

| Consumer          | Canonical seam                                                                                                             | Current Phase 4 result                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Drydock           | `src/tideglass/drydock-adapter.ts` -> accepted `parseDrydockBlock`                                                         | Implemented; no second registry or upcaster                                                                                                                              |
| Wakebook/Wayfarer | Existing exact played-anchor passage                                                                                       | Retained and accepted on protected main                                                                                                                                  |
| Shipwright        | Existing Creator-authorized Studio route                                                                                   | Retained and accepted on protected main                                                                                                                                  |
| Admiralty         | Dossier approved-grant panel -> `POST /api/admin/support/tideglass` through support grant and target-account authorization | Implemented; exact-pair form is only shown for the scoped category                                                                                                       |
| Harborlight       | Community listing current release plus an earlier active release with exact same-Chronicle source editions                 | Public Tideglass handoff implemented; package checksums, install, rollback, and license data remain Harborlight-owned                                                    |
| Helm              | Captain Library -> `GET /api/captain/tideglass/preflight` -> exact selected-to-recommended Tideglass pair                  | Implemented; requires active Captain workspace, verifies public-or-own Chronicle scope, returns CAPTAIN_SAFE category/count summary only, and never changes Voyage state |

This manifest records accepted seams, including the read-only Helm preflight.
The Phase 4 completion receipt records the protected integration identity.
