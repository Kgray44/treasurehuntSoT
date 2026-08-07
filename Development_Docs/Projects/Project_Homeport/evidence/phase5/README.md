---
title: Project Homeport Phase 5 Evidence Index
audience: product-engineering
status: current
canonical_for: project-homeport-phase-5-evidence-index
last_reviewed: 2026-08-03
---

# Project Homeport Phase 5 evidence index

This directory contains local, synthetic, exact-source Phase 5 reachability evidence for `b9f1552b78857c36a45f25eb5fdfb7a7e09f102a`. It is not merge, deployment, production, live-user, owner-acceptance, or product-acceptance proof.

`manifest.json` binds 29 screenshots to the branch, source SHA, Chromium version, viewport, fixture version/checksum, route, journey, state, file checksum, and accepted human review classification. `route-receipts/` contains 87 route-level receipts. No raw trace, video, database, session cookie, invitation phrase, or token value belongs here.

## Evidence groups

| IDs                               | Scope                                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `HP-P5-EV-A` through `HP-P5-EV-H` | Gateway, anonymous, Player, Captain, Creator, Personal Harbor, Community, and dynamic-source families             |
| `HP-P5-EV-I`, `Q`, `R`, `S`, `T`  | Dynamic detail/source, invalid ID, permission recovery, compact exit, and immersive exit                          |
| `HP-P5-EV-K` through `HP-P5-EV-M` | Valid, invalid, and expired token states; consumed/revoked states are retained in browser receipts                |
| `HP-P5-EV-N`, `O`, `AB`           | Redirect aliases, deprecated-route canonicalization, and compatibility context adapter                            |
| `HP-P5-EV-P`                      | Governed empty state with an onward action                                                                        |
| `HP-P5-EV-U` through `HP-P5-EV-X` | 390x844 touch-equivalent global, detail, account, and Community paths                                             |
| `HP-P5-EV-Y`                      | Effective 200 percent reflow with visible Home, Explore Chronicles, Community Harbor, Account, and close controls |
| `HP-P5-EV-Z`                      | Keyboard-only gateway-to-Community traversal                                                                      |
| `HP-P5-EV-AA`, `AC`, `AD`         | Zero-orphan, acyclic parent graph, and 42-route full traversal summaries                                          |

See [Project Homeport Phase 5 Reachability Review](Project_Homeport_Phase_5_Reachability_Review.md) for the visual acceptance record.
