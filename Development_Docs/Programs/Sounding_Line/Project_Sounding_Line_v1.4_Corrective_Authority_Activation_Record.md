---
title: Project Sounding Line v1.4 Corrective Authority Activation Record
audience: engineering
status: corrective-activation-candidate
canonical_for: sounding-line-v14-corrective-authority-activation
last_reviewed: 2026-08-13
---

# Project Sounding Line v1.4 Corrective Authority Activation Record

## Disposition

| Control                      | Permanent disposition        |
| ---------------------------- | ---------------------------- |
| `ATOMIC_CUTOVER_REQUIREMENT` | `NOT_SATISFIED_HISTORICALLY` |
| `PROTECTED_HISTORY`          | `PRESERVED`                  |
| `CORRECTIVE_SECOND_MERGE`    | `OWNER_AUTHORIZED`           |
| `FUNCTIONAL_V1.4_ACTIVATION` | `PENDING_THIS_CORRECTION`    |
| `EVIDENCE_REQUIREMENTS`      | `NOT_WAIVED`                 |

This record does not revise, reinterpret, or replace the ratified amendment. It records the corrective path after the original one-merge activation condition became historically impossible without rewriting protected history.

## Ratified amendment and original integration evidence

| Field                    | Value                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| Ratified amendment       | `CS-SL-XP-001 v1.4-R1`                                                                   |
| Amendment SHA-256        | `4D9DE559A24A7A2A8427171EAB679CCD423A1E9BE94FA104CF10B3D14AA31211`                       |
| Intended activation rule | One atomic protected-main merge after current-authority acceptance and protected binding |
| Implementation PR        | PR #90                                                                                   |
| Accepted candidate SHA   | `eaaf46dacf13bd8c01a06dd7c9168d7a4889ae2a`                                               |
| Accepted candidate tree  | `b01818c59794b7281c26cc496eeffefe6ed04e5c`                                               |
| Landed PR #90 merge SHA  | `1ebc702d57de63d74c9f80d82a11051446e7b12e`                                               |
| Landed tree              | `b01818c59794b7281c26cc496eeffefe6ed04e5c`                                               |
| Landed-tree equality     | Confirmed: accepted candidate tree equals landed tree                                    |
| v1.3 `RELEASE_GO`        | Authoritative run `31754046173`, 38 mandatory clean receipts                             |
| Protected binding        | Run `31755553665`, successful `Sounding Line / Mainline Decision`                        |

PR #90 did not change `currentAuthorityVersion` from `1.3`; Version 1.4 was integrated but was not activated. No Version 1.4 `CURRENT` workflow was exercised before activation: the planner requires `refs/heads/main` for that mode, and no post-PR #90 Version 1.4 current-authority dispatch was run.

## Owner-authorized corrective control

The owner authorized one corrective second protected merge on 2026-08-13 with these non-negotiable controls:

- Protected history is not rewritten, force-pushed, or reverted to recreate the appearance of the original atomic cutover.
- The ratified amendment remains unchanged.
- Current protected main remains Version 1.3 authority while this candidate is qualified.
- The correction changes authority and its matching documentation only; it does not reopen broad Version 1.4 implementation or product behavior.
- One frozen corrective candidate must earn a fresh Version 1.3 `RELEASE_GO` and protected binding before its one corrective merge.
- Version 1.4 must be self-verified only after the actual protected-main activation.

## Candidate and final evidence protocol

The corrective candidate is this record's containing pull request. Its immutable candidate SHA, the fresh Version 1.3 acceptance envelope, protected-binding run, physical merge SHA, landed tree identity, and bounded post-cutover Version 1.4 self-verification are recorded in that pull request's **Corrective Activation Attestation** after each event. The merged pull request and this source-controlled record together are the permanent activation evidence: the future merge SHA cannot truthfully be prewritten into a candidate commit.

The final attestation must state exactly:

> SOUNDING LINE v1.4 FUNCTIONAL AUTHORITY ACTIVATION COMPLETE  
> PROTECTED HISTORY PRESERVED  
> ATOMIC-ONE-MERGE CUTOVER REQUIREMENT RECORDED AS A HISTORICAL DEVIATION  
> CORRECTIVE ACTIVATION COMPLETED BY OWNER-AUTHORIZED SECOND PROTECTED MERGE
