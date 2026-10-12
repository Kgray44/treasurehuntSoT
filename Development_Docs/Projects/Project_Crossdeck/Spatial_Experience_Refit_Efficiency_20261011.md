---
title: Crossdeck refit task efficiency measurements
audience: product-engineering
status: current
canonical_for: crossdeck-refit-efficiency-20261011
last_reviewed: 2026-10-11
---

# Crossdeck refit efficiency measurements

This task-local engineering ledger records exposed measurements for the
[experience refit](Spatial_Experience_Refit_20261011.md). It is not an account
billing report or an acceptance receipt. Values are reported measurements;
unexposed counters remain `UNAVAILABLE`.

| Measurement                                        | Observed value                                                   | Basis                                                                                                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Goal aggregate tokensUsed                          | 1,826,763                                                        | Latest parent get_goal snapshot supplied on 2026-10-11; aggregate diagnostic goal telemetry, not billing.                                             |
| Goal elapsed timeUsedSeconds                       | 3,622 s                                                          | Same parent goal snapshot; not an estimate of device, build or per-agent cost.                                                                        |
| Delegated remaining/budget counters                | `UNAVAILABLE`                                                    | The delegated get_goal returned all null; parent supplied no remaining/budget breakdown.                                                              |
| Input, cached input and output tokens              | `UNAVAILABLE`                                                    | No token-category accounting is exposed for this task.                                                                                                |
| Credits, billed cost and distinct agent cost       | `UNAVAILABLE`                                                    | No task or per-agent billing counters are exposed.                                                                                                    |
| Reported focused product batch                     | 14 files / 150 tests passed; 57.39 s                             | Completed Vitest wall duration reported by builder. The preliminary invocation passed 63 tests; final-source qualification remains pending.           |
| Earlier additional product checks                  | 22 passed                                                        | Completed preliminary builder invocation; counts are not added to the final 150-test population.                                                      |
| Product Experience policy/helper regression checks | 44 passed; 34.789 s                                              | Final combined Node invocation, including the native-modal continuity/return regression. The earlier combined invocation passed 43 tests in 34.653 s. |
| Latest local production compilation                | 21.1 s                                                           | Completed successful build in `artifacts/crossdeck/review-candidate-build.log`; source qualification remains pending.                                 |
| Latest local production TypeScript phase           | 15.5 s                                                           | Exact completed TypeScript measurement in the same build log.                                                                                         |
| Earlier core browser journeys                      | Normal motion 28.8 s; reduced motion 18.4 s                      | Both passed on their earlier local source; not substituted for the latest four-spec batch.                                                            |
| Latest core browser journeys                       | Normal motion 33.3 s; reduced motion 60 s                        | Both core cases passed in the current four-spec batch; remaining batch outcome and independent criticism are pending.                                 |
| Preceding seven-test browser batch                 | Two passed, three failed, two skipped; 346.297 s                 | Failed local batch retained; hook label overwrite, legacy ambiguous label and recovery harness hash assertion were corrected before the rerun.        |
| Latest four-spec / seven-test browser batch        | Two core cases passed; remaining result pending                  | Final batch result, capture and independent criticism remain pending.                                                                                 |
| Baseline capture population                        | 15 numbered checkpoints; 16 PNG, eight WebM, two trace ZIP files | Actual local `artifacts/crossdeck/refit-baseline` inventory; checkpoint 11 has two retained PNG files.                                                |
| Refit rendered capture                             | Pending final candidate                                          | Intermediate files exist; the final frozen-source packet is not yet established.                                                                      |
| Protected final check                              | Pending                                                          | No refit protected qualification run is recorded.                                                                                                     |

The work used one owned worktree and the existing generic browser authority.
Capture provisioning allocates its own nonce-bound database. The local diagnostic
invocation can reuse an explicitly confirmed unchanged production build;
protected qualification retains the existing runner's build and authority rules.
Historical failed runs and baseline defects remain classified as failures or
incomplete observations. No token, credit or elapsed-time savings are inferred.

Two intermediate native-modal regression invocations failed the return witness
before it explicitly required the dialog to disappear; the final 44-test pass
does not reclassify those intermediate failures.

The focused contract-policy suite also passed 33/33 in 3.039 s after the spatial
consumer extension. The service-test duration sum was 132.79 s across parallel
tests; it is not substituted for the measured 57.39 s Vitest wall duration.

The intermediate build compiled in 41 s, then failed TypeScript on a route owner
union and two compact-control test props. Corrections were made before the next
rebuild. A prior successful build compiled in 32.1 s and completed TypeScript in
40 s. These earlier measurements are not replaced by the latest build timings.

The earlier goal snapshot reported 1,248,145 aggregate tokens and 2,275 s. The
latest snapshot supersedes it for current diagnostic totals; neither snapshot
exposes input/cache/output categories, credits, billed cost or distinct agent
cost. No billing, productivity or savings estimate is inferred.
