---
title: Project Tideglass Phase 4 Cross-Project Integration Matrix
status: IN_PROGRESS
project: Project Tideglass
phase: "Phase 4 - Fix the Bearings"
canonical_for: project-tideglass-phase-4-integration-matrix
---

# Project Tideglass Phase 4 Cross-Project Integration Matrix

| Owner                   | Tideglass may consume                                                          | Tideglass must not own or mutate                                         | Current Phase 4 state                                                                       |
| ----------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| One Voyage / publishing | Exact authorized immutable editions, checksums, playability and recommendation | Edition identity, publishing policy, active session pinning, progression | Existing read-only resolver audited                                                         |
| Drydock                 | Historical reader, block contracts, declared migrations and provider semantics | Story Block registry, upcasters, validation, simulation                  | Narrow adapter implemented; qualification continuing                                        |
| Wayfarer                | Exact owner-bound played anchor                                                | Durable history and privacy policy                                       | Existing Phase 3 handoff retained; regression pending                                       |
| Wakebook                | Existing Journey Detail comparison return context                              | Journey Archive, Memories, Keepsakes and private context                 | Existing Phase 3 handoff retained; regression pending                                       |
| Harborlight             | Community release source editions for one public Chronicle                     | Package, lineage, install, rollback, licensing and visibility            | Exact source-edition handoff implemented; package data is never compared                    |
| Helm                    | Selected playable edition and recommended edition context                      | Captain authority, Voyage creation, launch and live command              | Current accepted Helm has no edition-selection/preflight consumer; no projection fabricated |
| Shipwright              | Creator-authorized comparison projection                                       | Authoring workflow and version-list ownership                            | Existing Studio consumer audited; regression pending                                        |
| Admiralty               | Authorized, audited diagnostic context                                         | Administrative authorization, support grants and audit authority         | Scoped support-grant diagnostic route implemented; target resource authorization retained   |
| Lanternwake             | Presentation runtime and reduced-motion contract                               | Semantic comparison truth                                                | No semantic dependency permitted                                                            |

No row in this matrix authorizes a Tideglass business-state writer, active-Voyage
re-pinning, private-history cache entry, or cross-Chronicle comparison.
