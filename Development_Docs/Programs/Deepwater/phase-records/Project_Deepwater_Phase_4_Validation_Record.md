---
title: Project Deepwater Phase 4 Validation Record
audience: product-engineering
status: current
canonical_for: project-deepwater-phase-4-validation-record
last_reviewed: 2026-08-12
---

# Project Deepwater Phase 4 validation record

## Current result

Two historical hosted Mainline Decisions, `31605432896` and `31609917108`,
failed closed as `EVIDENCE_INVALID` solely in `browser.helm`; both finalizers
reported clean cleanup and no missing, duplicate, unknown, or
runtime-conformance evidence. Their source freezes are historical and cannot
be reused. Accepted Helm Phase 2 then advanced main to
`920d92a51a16d60a2dfe35278598e6d921be7e4c`, invalidating the second freeze.

Accepted Drydock Phase 3 subsequently protected-merged PR #52 and advanced
`origin/main` to `191a964488d0df71f8dcb91c5b8372fc73b6b32e`. Accepted
Admiralty Phase 2 then protected-merged PR #28 and advanced current main to
`4edc8de5e30e9748700c19b466061f9b9a97f268`. It expands existing FT-B010 with
a read-only cross-domain Chartroom and dossier-anchored Support Access, without
adding a catalog denominator entry. FT-036 remains `BRANCH_COMPLETE_NOT_MERGED`
because its separate owner-controlled record promotion is pending; Deepwater
records that condition without changing its owner state. The current Deepwater
product-evidence source is `5806ccb3d705eb04322a7be1d176d97dd6f2da9e`. It
retains Helm's accepted route recovery, detaches stale Player event streams on
cancellation or abort, and rechecks the waiting-room state after visibility
settles so an authoritative launch cannot strand a backgrounded Player.

The focused Player, Captain, and stream suite passes 26/26. Drydock current
source qualification passes the owner Sea Trials suite 196/196; its SQLite
migration rehearsal verifies 59 migrations and MySQL static parity. Admiralty
passes 14 direct capability, read-model, and redaction tests; its validator
checks 15 routes, its migrations pass, and its task-owned browser suite passes
3/3. Bridgewatch validates and builds with 24 focused tests. The exact isolated
Helm browser family passes 3/3 in execute-only mode with clean runtime
conformance. The dependency-seed copier now skips junction descendants already
covered by a retained root and cleanly removes an owned runtime on initialization
failure; its authority-cutover and runtime-safety regressions pass. The refreshed
Deepwater audit and validator pass for 58 capabilities with semantic digest
`4886d25203da77b21a46d1a5b330f028ace150ea2677146f8352af664a691813`.

The production-build Homeport matrix remains source-bound to
`b810e2d0c33cbafb8e4d02c19b9af0db94315783`: original journeys A-O,
owner-correction Round 1 journeys A-U, Round 2 journeys A-W with its inherited
regression chain, and Round 3 journeys A-V with the full prior correction
regression. It is retained only through explicit family-level semantic
carry-forward. This result is local synthetic qualification only: it neither
records owner or product acceptance nor substitutes for a canonical hosted
Mainline Decision. Phase 4 has not been accepted into protected main or proven
on exact main.

| Gate                           | Result                                                                                           | Boundary                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Deepwater proof-model tests    | PASS; 66/66                                                                                      | Deterministic local control-plane tests                              |
| Historical hosted decisions    | `EVIDENCE_INVALID`; runs 31605432896 and 31609917108; cleanup CLEAN                              | Historical only; neither candidate may seek authority                |
| Helm repair qualification      | PASS; invitation, Player, and stream tests 26/26; `browser.helm` 3/3                             | Isolated execute-only evidence; cannot issue `RELEASE_GO`            |
| Drydock Creator qualification  | PASS; 33/33, 3/3, 7/7, and 196/196; migration rehearsal PASS                                     | Private Studio Sea Trials; no owner-state override                   |
| Admiralty current-source scope | PASS; 14 direct tests, 15-route validator, migrations, browser 3/3                               | Read-only support and role boundaries; no catalog denominator change |
| Deepwater audit and validation | PASS; 58 capabilities; digest `4886d25203da77b21a46d1a5b330f028ace150ea2677146f8352af664a691813` | Current product source only; no acceptance claim                     |
| Bridgewatch qualification      | PASS; typecheck, 24 tests, build                                                                 | Private operator surface; no public-product or release authority     |

## Runtime proof boundary

The runtime record contains source SHA, test references, state/accessibility
outcomes, sanitized evidence IDs, and SHA-256 screenshot hashes only. It
excludes private fixture locations, browser profiles, credentials, cookies,
tokens, provider responses, and raw images. It establishes local synthetic
behavior and does not establish live-provider behavior, deployment, physical
assistive-technology validation, owner acceptance, product acceptance, or
protected-main acceptance.

## Remaining serialized gates

1. The current reconciled branch is frozen as one candidate; acquire the canonical serialized acceptance lane and dispatch exactly one hosted **Sounding Line / Mainline Decision** for that frozen candidate.
2. Only after `RELEASE_GO`, complete protected merge, exact-main proof, and a
   separately source-bound closure record.

Phase 5 remains unauthorized throughout these gates.
