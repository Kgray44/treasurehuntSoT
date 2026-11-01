---
title: PR 776 protected-decision ordering incident
audience: engineering-owner
status: proposed-inactive
canonical_for: sl-inc-pr776-20261026
last_reviewed: 2026-10-26
---

# SL-INC-PR776-20261026: required protected decision missing

**Historical disposition: `REQUIRED_PROTECTED_DECISION_MISSING`.** PR [#776](https://github.com/Kgray44/treasurehuntSoT/pull/776) merged on protected `main` without a successful pre-merge `Sounding Line / Mainline Decision` for its exact head and base. This incident record is proposed for normal protected review. It does not issue or retroactively imply `RELEASE_GO`, product acceptance, or an exception to current authority.

## Immutable source and event identities

| Item                     | Identity                                   |
| ------------------------ | ------------------------------------------ |
| Qualified base requested | `7dee007617084e2ecb31aff06dc326d0a735b506` |
| PR head                  | `2d6e8a62d54e7897c6390d7e87afbadf493a0115` |
| Landed merge on `main`   | `f7ef7de4b606eec734d04eeaed316fea959cf80e` |
| Head and landed tree     | `08d7097459f7880313047162227a0ef560922e7e` |

The [draft-triggered run 40418550781](https://github.com/Kgray44/treasurehuntSoT/actions/runs/40418550781) began at 2026-10-26 23:15:59 UTC. Its [required decision job](https://github.com/Kgray44/treasurehuntSoT/actions/runs/40418550781/job/121906869340) concluded `skipped` at 23:16:01. The PR became ready at 23:16:15 and merged at 23:16:18. The [active run 40418600190](https://github.com/Kgray44/treasurehuntSoT/actions/runs/40418600190) began only at 23:16:25. Its custody job compared requested base `7dee0076` with trusted workflow SHA `f7ef7de4` and failed at 23:16:30; the [required decision job](https://github.com/Kgray44/treasurehuntSoT/actions/runs/40418600190/job/121907054612) concluded `failure` at 23:16:37. The active run therefore never qualified the pre-merge transaction. Preserve both runs and their failed/skipped conclusions.

At the incident audit, GitHub branch protection required `Sounding Line / Mainline Decision` from app `15368` with strict status checks, but `enforce_admins` was false and no active ruleset supplied an additional gate. GitHub treats a skipped required job as a passing conclusion. The merge actor had administrator permission; the PR timeline showed no auto-merge-enabled event. The available evidence does not isolate which permissive path actually effected the merge. Both the skipped-check behavior and administrator/automation bypass exposure require correction through the separate [A0 prevention proposal](Sounding_Line_Modernization_PR_A0_Protected_Merge_Transaction_Integrity.md), including verification of live GitHub settings.

## Evidence and limits retained

The accepted 118-context product capture (Actions artifact `12585174268`), independent 32-contract review (artifact `12696129128`), committed immutable media and review history remain attached to their existing source and scope. The landed source tree matches the reviewed head tree, and the existing landed SceneManager smoke passed 9/9. These facts support source custody and bounded technical observations; they do not replace the missing pre-merge protected decision. `candidate-review.json` retains `ownerAcceptance: NOT_CLAIMED`. The 48 explicitly deferred authored/photo states remain pending and outside acceptance. Do not erase the historical failure, release the held checkout under its current lifecycle rule, or reinterpret these facts as `PRODUCT_ACCEPTED`.

No present authority permits post-merge `RELEASE_GO` for this missing transaction. A separately scoped, budgeted 51-browser-file diagnostic remains an **undispatched technical-confidence option** for current `main`; it cannot repair the historical acceptance order or close this incident. Any future exceptional post-merge validation requires its own authorized governance decision and must record a distinct, non-retroactive outcome. This amendment changes no executable authority, GitHub setting, workflow, or source.
