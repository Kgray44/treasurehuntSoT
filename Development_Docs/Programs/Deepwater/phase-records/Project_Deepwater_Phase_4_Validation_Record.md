---
title: Project Deepwater Phase 4 Validation Record
audience: product-engineering
status: current
canonical_for: project-deepwater-phase-4-validation-record
last_reviewed: 2026-08-12
---

# Project Deepwater Phase 4 validation record

## Current result

Before a canonical hosted decision was dispatched, accepted Helm Phase 2
advanced current main from `54e3d818d49d45282a9c419d562d4b5c78911ccd` to
`ca40227cbef3575315c089d224a0cd26ec77bc78`. A replacement candidate was
prepared, but accepted Bridgewatch Phase 2 then advanced current main to
`5735d43821209adb2259ec2c38979281da1bb5b9` before a hosted decision. That
advance adds FT-035 and changes the private observer plus Sounding Line
projection scope, so the replacement candidate is historical only. Phase 4
rebased onto that exact current main at
`e57670a010406dc48c7ede1f2939d3d35260484f`. Its hosted Mainline Decision
failed closed as `EVIDENCE_INVALID`: all mandatory evidence was present, but
the `browser.helm` receipt failed after an invitation remained in `resolving`.
No release, protected merge, or acceptance was recorded. The narrow retry
repair is committed at `ec564fc632fa4836b6eb0a6f0298815649ac452c` and has
passed its focused component regression and the exact three-case Helm browser
family in an isolated runtime. The proof model now accounts for all 57 current
capabilities: the accepted 55-capability Phase 3 population plus Bridgewatch
FT-034 and FT-035.

The production-build Homeport matrix remains source-bound to
`b810e2d0c33cbafb8e4d02c19b9af0db94315783`: original journeys A-O,
owner-correction Round 1 journeys A-U, Round 2 journeys A-W with its inherited
regression chain, and Round 3 journeys A-V with the full prior correction
regression. It is retained only through the explicit family-level semantic
carry-forward declaration. The changed Bridgewatch family has passed its
current production build, typecheck, 24 focused tests, private-loopback desktop
and 390px responsive review with no horizontal overflow, and local-only
telemetry plus summary, activity, and tests endpoint observations. The
refreshed Deepwater audit and validator pass for the repaired source with 57
capabilities and semantic digest `94e28de6a9a30b639c6db9519178f370a2829b1e587aaaaafb31b3fd8608a172`.
This remains local synthetic qualification only: it neither records owner or
product acceptance nor substitutes for a canonical hosted Mainline Decision.
Phase 4 has not been accepted into protected main or proven on exact main.

| Gate                                | Result                                                                                           | Boundary                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Deepwater proof-model tests         | PASS; 66/66                                                                                      | Deterministic local control-plane tests                           |
| Hosted Mainline Decision            | `EVIDENCE_INVALID`; run 31605432896; `browser.helm` failed; cleanup CLEAN                        | Failed closed; candidate invalidated and acceptance lane released |
| Helm repair qualification           | PASS; component regression 9/9 and exact `browser.helm` 3/3                                      | Isolated, local evidence only; repair awaits full Phase 4 refresh |
| Deepwater audit and validation      | PASS; 57 capabilities; digest `94e28de6a9a30b639c6db9519178f370a2829b1e587aaaaafb31b3fd8608a172` | Repaired product source only; no acceptance claim                 |
| Production-build Homeport journeys  | RETAINED; original A-O, Round 1 A-U, Round 2 A-W, Round 3 A-V with inherited regressions         | Explicit semantic carry-forward from the historical source        |
| Bridgewatch qualification           | PASS; production build, typecheck, 24 tests, private-loopback desktop and 390px review           | Private operator surface; no public-product or release authority  |
| Focused Sounding Line qualification | PASS; frozen candidate local-change plan with finalization disabled                              | Qualification evidence only; cannot issue `RELEASE_GO`            |
| Documentation and catalog           | PASS; documentation validation and catalog refresh required before authority                     | No owning Feature Catalog fragment change is expected             |

## Runtime proof boundary

The runtime record contains source SHA, test references, state/accessibility
outcomes, sanitized evidence IDs, and SHA-256 screenshot hashes only. It
excludes private fixture locations, browser profiles, credentials, cookies,
tokens, provider responses, and raw images. It establishes local synthetic
behavior and does not establish live-provider behavior, deployment, physical
assistive-technology validation, owner acceptance, product acceptance, or
protected-main acceptance.

## Remaining serialized gates

1. Acquire the canonical serialized acceptance lane.
2. Dispatch exactly one new canonical hosted **Sounding Line / Mainline
   Decision** for this frozen repaired candidate.
3. Only after `RELEASE_GO`, complete protected merge, exact-main proof, and a
   separately source-bound closure record.

Phase 5 remains unauthorized throughout these gates.
