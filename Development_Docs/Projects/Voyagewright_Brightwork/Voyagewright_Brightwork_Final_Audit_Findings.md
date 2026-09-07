---
title: Voyagewright Brightwork Final Audit Findings
audience: engineering-evidence
status: current
canonical_for: voyagewright-brightwork-final-audit-findings
last_reviewed: 2026-09-07
---

# Voyagewright Brightwork Final Audit Findings

**Disposition: `READY_FOR_FINAL_HUMAN_REVIEW`**

This is the final current-protected-main evidence recertification and independent product audit for Brightwork. It is evidence only: no ordinary product source, deployment, live provider, user data, or acceptance state was changed.

## Scope and truth binding

- Protected product baseline: `87ce8a959ceca056c3e91304b0aa7dcf64fde649` (`origin/main`).
- Audit-runtime binding: `2599d694f132e87eab23ee580fb45fddeb9e6f13`.
- Build and data: task-owned Next production build, disposable synthetic SQLite/storage, external providers disabled, synthetic outbox only.
- Corpus: 478 required captures / 478 current; stale, missing, blocked, orphaned, duplicate, and semantic-invalid counts are all zero.
- The corpus is current visual and behavioral evidence only. It is not public deployment, production-data, live-provider, physical-device, assistive-technology, owner, or end-user acceptance proof.

## Final product findings

No new serious or critical product finding was demonstrated by the current corpus, current-source reconciliation, or the independent Journal browser lane.

| ID           | Classification                                               | Severity                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                  | Disposition                                                                                                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BW-FINAL-001 | `TEST_EVIDENCE_DRIFT`, not a demonstrated product regression | P3 engineering-evidence quality | The dedicated Journal browser run reported one failure after 11 passes because `tests/e2e/lanternwake-journal.spec.ts` still requires `.historical-lock`. Wave 6 commit `e5bcfb81f5118c823914588140416d5d504619db` intentionally replaced that old objective-tray node with the rendered `.journal-historical-volume` aside. The captured completed archive visibly and semantically states that the voyage is read-only. | Preserve the test runner receipt and screenshot; do not classify it as a user-facing read-only failure or alter product code in this audit. A future test-maintenance change should target the labeled Historical volume surface rather than the removed class. |

The selector discrepancy is preserved in `Experience_Images/Final_Attention/Journal_Historical_Read_Only_Selector_Discrepancy.png` and in the Journal reproduction record. The screenshot shows the completed archive, replay controls, a readable journal, and the current historical-volume treatment; it does not show the removed selector.

## Master finding recheck

Every Stage 7 master item was rechecked against the current protected source, the source-bound 478-capture corpus, its semantic/reachability/state ledgers, and the owning Stage 8 completion evidence. `REPAIR_VERIFIED_CURRENT` means that the current recertification found no regression of the completed repair in its applicable rendered/current evidence. It does not claim that each historical acceptance procedure was rerun manually or that a public deployment was accepted.

| Master items                                       | Current recheck outcome   | Current evidence                                                                                                         |
| -------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| BW-M-001 to BW-M-007                               | `REPAIR_VERIFIED_CURRENT` | Systemic visual-governance records, dark/light and desktop/mobile contact sheets, full current corpus.                   |
| BW-M-008, BW-M-020, BW-M-023 to BW-M-025, BW-M-038 | `REPAIR_VERIFIED_CURRENT` | Wave 1 evidence, current state matrix, semantic capture validation, text-integrity evidence.                             |
| BW-M-009 to BW-M-019                               | `REPAIR_VERIFIED_CURRENT` | Wave 3 record and current Passport/Harbor corpus and reachability evidence.                                              |
| BW-M-026 to BW-M-029, BW-M-035 to BW-M-037         | `REPAIR_VERIFIED_CURRENT` | Wave 4 record and current Community/Studio corpus.                                                                       |
| BW-M-030 to BW-M-034                               | `REPAIR_VERIFIED_CURRENT` | Wave 5 record and current Admiralty corpus.                                                                              |
| BW-M-021, BW-M-022, BW-M-039 to BW-M-041           | `REPAIR_VERIFIED_CURRENT` | Wave 6 and Wave 7 records, current Journal/Captain/auth/public-entry corpus, and the independent Journal lifecycle lane. |

The machine-readable record enumerates all 41 individual outcomes in `Voyagewright_Brightwork_Final_Audit_Findings.json`.

## Reference-quality recheck

All 15 Stage 7 reference contracts remain protected by current source-bound evidence. Their review lenses are: Gateway (`BW-REF-001`), Passport (`002`), Community (`003`), invitation ceremony (`004`), Journal/fallback (`005`), Captain (`006`), Studio publishing (`007`), Admiralty (`008`), account focus behavior (`009`), truthful historical absence (`010`), safe secret-reference handling (`011`), consent-scoped support (`012`), Drydock publication gates (`013`), Studio overlay/mobile accessibility (`014`), and Exchange validation/sandbox (`015`).

The product-wide sheets, `Critical_States_01.png`, and the area sheets in `Experience_Images/Contact_Sheets/` are the current reference-protection visual set. The completed-archive screenshot is additionally preserved as final-attention evidence; it documents the test assertion drift while affirming the visible read-only treatment.

## Pending Journal findings

| Pending ID  | Current status                          | Evidence and boundary                                                                                                                                                                                                                                                                                                                                     |
| ----------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BW-PEND-001 | `NOT_REPRODUCED_IN_TASK_OWNED_CHROMIUM` | The dedicated production-browser lifecycle check passed the missing-opening-actor/infinite-CSS fallback case and the other opening/fallback checks. The old Stage 6 live observation is not recreated in this coherent synthetic voyage. WebKit remains explicitly skipped by the test fixture, so this is not multi-browser or live-environment closure. |
| BW-PEND-002 | `NOT_REPRODUCED_IN_TASK_OWNED_CHROMIUM` | The same lane passed PageFlip control/keyboard authority, readiness interruption, and all dynamic-import/runtime-init/readiness-probe fallback cases. The original page-3-to-4 post-fallback symptom did not recur. This does not authorize page-turn changes or claim broader browser certification.                                                     |

The exact invocation history, environment-only failures, runner receipt, source/test divergence, and preserved screenshot are in `Voyagewright_Brightwork_Journal_Pending_Reproduction_Record.md`.

## Audit machinery corrections made before the authoritative corpus

These were audit-only corrections, each committed before the final source-bound recertification. They were not ordinary product changes:

- `7a5eb03b`: re-bound the census's ordinary-product baseline to current protected main after its fail-closed source-binding check correctly detected that the old baseline was stale.
- `f37659bc` and `3aae77a9`: aligned the audit sign-in selector/action with current rendered product copy.
- `2599d694`: classified the mocked private-operations `503` state with its current unavailable copy rather than the obsolete unauthorized expectation.

The final corpus is bound to the protected product SHA above and the final audit-runtime SHA `2599d694`; failed pre-correction capture attempts were not promoted into the corpus.

## Required follow-up

This evidence package is ready for final human review. It does **not** state “Brightwork complete,” authorize a release, or close acceptance. If test maintenance is authorized later, update the stale historical-lock assertion and rerun the focused Journal browser lane; that is a separate engineering change, not a finding that justifies product repair.
