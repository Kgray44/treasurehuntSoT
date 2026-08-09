---
title: Project Deepwater Phase 1 Integration Record
audience: product-engineering
status: current
canonical_for: project-deepwater-phase-1-integration
last_reviewed: 2026-08-09
---

# Project Deepwater Phase 1 integration record

| Field                 | Value                                             |
| --------------------- | ------------------------------------------------- |
| Program               | Project Deepwater                                 |
| Phase                 | Phase 1 - Sound the Depths                        |
| Base product source   | `f1c2f22dd935322c1a71eb80c51592f243dc196d`        |
| Source branch         | `codex/project-deepwater-phase1-sound-the-depths` |
| Candidate commit      | `ef5113718c9e01571ff4a2620ac3b2e9bd184ba7`        |
| Final reconciled main | `d3b04e54fbf537869fe3969d6ae19e8b23942986`        |
| Protected publication | GitHub pull request #15                           |
| Mainline state        | `ACCEPTED`                                        |

## Integration contract

The final fetch found no intervening commit after the frozen product baseline. Sounding Line returned `RELEASE_GO` for exact candidate `ef5113718c9e01571ff4a2620ac3b2e9bd184ba7`, then the protected hosted matrix passed every required worker, production build, and the final `Sounding Line / Mainline Decision`.

Protected PR #15 merged as `d3b04e54fbf537869fe3969d6ae19e8b23942986` on 2026-08-09. The candidate is an ancestor of that commit, `origin/main` resolves to that commit at finalization, and the Deepwater, Sounding Line, package, Feature Catalog, and documentation paths are byte-identical between candidate and accepted main.

Phase 1 does not authorize Phase 2, product remediation, schema work, deployment, provider operations, or owner-acceptance claims. The 22 initial findings and 44-entry Phase 2 queue remain governed follow-on truth.
