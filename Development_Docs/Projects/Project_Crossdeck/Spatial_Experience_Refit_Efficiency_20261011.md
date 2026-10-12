---
title: Crossdeck refit task efficiency measurements
audience: product-engineering
status: current
canonical_for: crossdeck-refit-efficiency-20261011
last_reviewed: 2026-10-12
---

# Crossdeck refit efficiency measurements

This task-local engineering ledger records exposed measurements for the
[experience refit](Spatial_Experience_Refit_20261011.md). It is not an account
billing report or an acceptance receipt. Values are reported measurements;
unexposed counters remain `UNAVAILABLE`.

| Measurement                                        | Observed value                                                   | Basis                                                                                                                                                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Native Goal aggregate tokensUsed at pause          | 2,565,200                                                        | Historical paused native Goal snapshot supplied by coordinator; diagnostic telemetry, not resumed usage or billing.                                                                        |
| Native Goal timeUsedSeconds at pause               | 6,537 s                                                          | Same historical paused snapshot. Resumed elapsed usage is unavailable.                                                                                                                     |
| Delegated remaining/budget counters                | `UNAVAILABLE`                                                    | The delegated get_goal returned all null; parent supplied no remaining/budget breakdown.                                                                                                   |
| Input, cached input and output tokens              | `UNAVAILABLE`                                                    | No token-category accounting is exposed for this task.                                                                                                                                     |
| Credits, billed cost and distinct agent cost       | `UNAVAILABLE`                                                    | No task or per-agent billing counters are exposed.                                                                                                                                         |
| Reported focused product batch                     | 16 files / 159 tests passed; 154.66 s                            | Completed pre-0657 Vitest wall duration. Earlier 14-file / 150-test batch passed in 57.39 s; overlapping populations are not added.                                                        |
| Earlier additional product checks                  | 22 passed                                                        | Completed preliminary builder invocation; counts are not added to the final 150-test population.                                                                                           |
| Historical Product Experience helper checks        | 44 passed; 34.789 s                                              | Earlier candidate-helper regression invocation; not qualification of the current unchanged protected helper. Earlier combined run: 43 tests / 34.653 s.                                    |
| Latest measured production build                   | Passed; 77.276 s                                                 | Source `0c4246878bbd3b1d0c5f0d0db9dde20e2746eb80`; total build duration, not a compilation/TypeScript phase estimate.                                                                      |
| Earlier f852 production build                      | Passed; 50.482 s                                                 | Source `f8527d3988d17284a898cbd0f27265c8a2d2ea4c`; retained historical local result.                                                                                                       |
| Preceding production build                         | Failed; 52.624 s                                                 | Checkpoint `839fc784` failed on a test DTO type; corrected before `f8527d39`.                                                                                                              |
| Earlier core browser journeys, first measured pair | Normal motion 28.8 s; reduced motion 18.4 s                      | Both passed on their earlier local source; not substituted for the latest four-spec batch.                                                                                                 |
| Earlier core browser journeys, later measured pair | Normal motion 33.3 s; reduced motion 60 s                        | Both earlier core cases passed; final current-source qualification is separate.                                                                                                            |
| Preceding seven-test browser batch                 | Two passed, three failed, two skipped; 346.297 s                 | Failed local batch retained; hook label overwrite, legacy ambiguous label and recovery harness hash assertion were corrected before the rerun.                                             |
| Committed 0657 browser batch                       | Five passed, two failed; 267.655 s                               | Server readiness 47.987 s; reduced purpose reset and nested recovery locator failed.                                                                                                       |
| Committed 105ec browser batch                      | All 24 passed; 441.150 s                                         | Three refit and 21 Homeport cases; readiness 9.100 s, cleanup 76 ms.                                                                                                                       |
| Latest measured affected browser batch             | Three passed; 101.511 s                                          | Source `0c424687`; runtime execution 99.983 s, readiness 1,392 ms, cleanup 31 ms. Does not replace canonical capture or final review.                                                      |
| Earlier f852 affected browser batch                | Three passed; 89.945 s                                           | Source `f8527d39`; retained historical local result.                                                                                                                                       |
| Latest measured guarded synthetic seed             | Passed; 2.459 s                                                  | Source `0c424687`; nonce identity also passed in 116 ms. These stages do not establish a passed experience capture.                                                                        |
| Earlier f852 guarded synthetic seed                | Passed; 2.094 s                                                  | Source `f8527d39`; nonce identity passed in 137 ms.                                                                                                                                        |
| Latest canonical contract capture                  | Failed; 47.572 s                                                 | Source `0c424687`: published Lens contexts reached; subsequent PRIMARY setup assumed a first-opening dialog despite persisted canonical `hasOpened`. Final repaired-source replay pending. |
| Earlier f852 canonical capture                     | Failed; 5.282 s                                                  | Source `f8527d39`: sign-in/Journal/Lens reached; duplicate active/background Voyage context. This blocker was resolved at `0c424687`; the failed run remains failed.                       |
| Independent cycle 2 inspection                     | 45 PNG; six WebM; 92 sampled frames                              | Source `67ec3f0c`; one open accessibility finding. Final cycle 3 packets/acceptance pending.                                                                                               |
| Baseline capture population                        | 15 numbered checkpoints; 16 PNG, eight WebM, two trace ZIP files | Actual local `artifacts/crossdeck/refit-baseline` inventory; checkpoint 11 has two retained PNG files.                                                                                     |
| Refit rendered capture                             | Pending final candidate                                          | Intermediate files exist; the final frozen-source packet is not yet established.                                                                                                           |
| Protected final check                              | Pending                                                          | No refit protected qualification run is recorded.                                                                                                                                          |

The work uses one owned worktree, the existing generic runtime/database guard
and the unchanged protected browser helper. The persisted seed supplies
synthetic account/edition/Voyage content; canonical sign-in and **Use this
device** controls perform account/device entry. Protected qualification retains
the existing runner's exact-source build and authority rules.
Historical failed runs and baseline defects remain classified as failures or
incomplete observations. No token, credit or elapsed-time savings are inferred.

The latest measured source is `0c4246878bbd3b1d0c5f0d0db9dde20e2746eb80`,
tree `245d2522a4787e40b3b40f0ac2bb59136825cba1`, against accepted base
`81fa477c5099b259e0d3bd8e8e0e6e52a7dc02bb`. Its
[stage receipt](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/0c424687-local-stage-receipt.json)
and [log](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/0c424687-local-stage.log)
preserve the passed build/browser stages and failed canonical capture. Partial
capture evidence remains historical. Exactly two independent review cycles have
occurred; cycle 3 awaits the trusted final packet.

Two intermediate native-modal regression invocations failed the return witness
before it explicitly required the dialog to disappear; the final 44-test pass
does not reclassify those intermediate failures.

The focused contract-policy suite also passed 33/33 in 3.039 s after the spatial
consumer extension. The service-test duration sum was 132.79 s across parallel
tests; it is not substituted for the measured 57.39 s Vitest wall duration.

The intermediate build compiled in 41 s, then failed TypeScript on a route owner
union and two compact-control test props. Corrections were made before the next
rebuild. A prior successful build compiled in 32.1 s and completed TypeScript in
40 s. Another successful build compiled in 21.1 s and completed TypeScript in
15.5 s. Pre-0657 compilation/TypeScript took 36.3/56 s; source `105ec0d8` took
62/102 s. The `4e563f95` build was interrupted before compilation completed.
These historical measurements do not establish final-source qualification.

Earlier reported goal snapshots were 1,248,145 tokens / 2,275 s, 1,826,763 /
3,622 s and 2,125,298 / 5,347 s. The native Goal paused snapshot is historical;
resumed input/cache/output, credits and per-agent accounting remain
`UNAVAILABLE`. No billing, productivity or savings estimate is inferred.

The [historical export manifest](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/manifest.json)
binds selected original review observations, failure PNGs and build/local-stage
receipts by exact bytes. Historical review/raw IDs are not current protected
capture artifact identities. Final accepted source/base/tree, capture/packet digests,
separate cycle 3 reviewer result, protected run and landed smoke remain pending.
