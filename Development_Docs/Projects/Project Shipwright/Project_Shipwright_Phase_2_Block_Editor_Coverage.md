---
title: Project Shipwright Phase 2 Block Editor Coverage
audience: engineering
status: active
canonical_for: project-shipwright-phase-2-block-editor-coverage
last_reviewed: 2026-08-12
---

# Project Shipwright Phase 2: Current Block Editor Coverage

The inventory is derived from the active `blockTypeIds` and Drydock registry at branch base `191a964488d0df71f8dcb91c5b8372fc73b6b32e`. All contracts are currently version 2 with reader floor 1. “Contract” means the Inspector consumes that Drydock contract; it does not establish new authoring semantics.

| Active type         | Strategy           | Guided / Detailed / Engineering | Variables / targets                                | Assets / accessibility / issues                         | Current evidence and limitation                                            |
| ------------------- | ------------------ | ------------------------------- | -------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| narrative           | PURPOSE_BUILT      | Yes / Yes / Yes                 | — / canonical default edge summary                 | Contract / contract / inline                            | Adapter and Studio Inspector regression coverage.                          |
| captainsNote        | CONTRACT_GENERATED | Yes / Yes / Yes                 | — / default edge summary                           | — / contract / inline                                   | Generic typed controls.                                                    |
| riddle              | CONTRACT_GENERATED | Yes / Yes / Yes                 | Contract read / default edge summary               | — / contract / inline                                   | Generic typed controls; provider identity is summarized.                   |
| information         | CONTRACT_GENERATED | Yes / Yes / Yes                 | — / default edge summary                           | Contract / contract / inline                            | Generic typed controls.                                                    |
| travelDirection     | CONTRACT_GENERATED | Yes / Yes / Yes                 | — / default edge summary                           | Location adapter / contract / inline                    | Generic typed controls.                                                    |
| location            | DOMAIN_ADAPTER     | Yes / Yes / Yes                 | — / default edge summary                           | Location adapter / contract / inline                    | Existing location library is consumed.                                     |
| arrivalCheck        | DOMAIN_ADAPTER     | Yes / Yes / Yes                 | — / default edge summary                           | Location adapter / contract / inline                    | Existing provider configuration remains canonical.                         |
| image               | CONTRACT_GENERATED | Yes / Yes / Yes                 | — / default edge summary                           | Image-constrained / contract / inline                   | Asset control filters through contract requirement.                        |
| imageTransformation | HYBRID             | Yes / Yes / Yes                 | — / default edge summary                           | Image-constrained / contract / inline                   | Adds bounded alignment control; focal diagnostics remain Engineering-only. |
| cinematic           | CONTRACT_GENERATED | Yes / Yes / Yes                 | — / default edge summary                           | Video-constrained / contract / inline                   | Captions/poster requirements are surfaced from contract.                   |
| audio               | CONTRACT_GENERATED | Yes / Yes / Yes                 | — / default edge summary                           | Audio-constrained / contract / inline                   | Transcript requirement is surfaced from contract.                          |
| artifactReveal      | PURPOSE_BUILT      | Yes / Yes / Yes                 | — / default edge summary                           | Artifact/image/video/audio controls / contract / inline | Existing artifact and recipient-policy fields are contract-rendered.       |
| hiddenMessageReveal | CONTRACT_GENERATED | Yes / Yes / Yes                 | — / default edge summary                           | Contract / contract / inline                            | Generic typed controls.                                                    |
| collectionUpdate    | CONTRACT_GENERATED | Yes / Yes / Yes                 | — / default edge summary                           | Artifact adapter / contract / inline                    | Generic typed controls.                                                    |
| confirmation        | CONTRACT_GENERATED | Yes / Yes / Yes                 | — / default edge summary                           | — / contract / inline                                   | Generic typed controls.                                                    |
| choice              | PURPOSE_BUILT      | Yes / Yes / Yes                 | Contract read / readable CHOICE edges              | — / contract / inline                                   | Choice cards project canonical edges through Drydock mirror projection.    |
| textAnswer          | CONTRACT_GENERATED | Yes / Yes / Yes                 | — / default edge summary                           | — / contract / inline                                   | Generic typed controls.                                                    |
| captainApproval     | CONTRACT_GENERATED | Yes / Yes / Yes                 | — / default edge summary                           | — / contract / inline                                   | Provider summary from contract.                                            |
| wait                | PURPOSE_BUILT      | Yes / Yes / Yes                 | — / default edge summary                           | — / contract / inline                                   | Human-readable canonical duration control and presets.                     |
| condition           | PURPOSE_BUILT      | Yes / Yes / Yes                 | Canonical AST / readable SUCCESS and FAILURE edges | — / contract / inline                                   | Visual typed expression builder and Drydock target projection.             |
| setVariable         | PURPOSE_BUILT      | Yes / Yes / Yes                 | Canonical registry / default edge summary          | — / contract / inline                                   | Search/filter variable browser, permitted operations, typed operands.      |
| chapterComplete     | PURPOSE_BUILT      | Yes / Yes / Yes                 | — / default edge summary                           | Artifact adapter / contract / inline                    | Contract-rendered terminal/chapter outcome configuration.                  |
| taleComplete        | PURPOSE_BUILT      | Yes / Yes / Yes                 | — / terminal outcome                               | — / contract / inline                                   | Contract-rendered finale configuration.                                    |

## Totals

- 23 active contracts
- 8 purpose-built strategies
- 12 contract-generated strategies
- 1 hybrid strategy
- 2 domain-adapter strategies
- 0 active types unsupported

Unknown future block types resolve to `SAFE_GENERIC_FALLBACK`; this strategy is tested by `src/studio/authoring/adapters.test.ts`. Per-type end-to-end qualification remains pending and is tracked by the validation record; this coverage document does not claim it has completed.
