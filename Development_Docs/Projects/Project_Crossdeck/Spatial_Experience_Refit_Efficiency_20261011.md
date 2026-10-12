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

The [repair ledger](../../Testing/Product_Experience/evidence/crossdeck-refit-b53291133625/repair-ledger.json)
records 10 completed repair-to-recapture attempts: seven product and three
fixture/contract. All ten count toward the workflow limit of three (`EXCEEDED`),
independently of the two completed reviews; final review 3 is unconsumed. Failed
or interrupted `4e563f95`/`839fc784` builds and evidence-only `d52df96d` are
separate. The counter is neither reset nor waived; automatic product repair is stopped.

The [verified local full capture](../../Testing/Product_Experience/evidence/crossdeck-refit-b53291133625/capture.json)
remains historical local proof. GitHub connectivity was restored; the owned
branch was pushed and one draft PR, #721, was created. Active continuation and `BLOCK_WITH_EVIDENCE` handling live only
in [the automation checkpoint](../../../.agents/crossdeck-refit-checkpoint.md).
Protected acceptance, final independent review and owner acceptance remain pending.

The owner-authorized reconciliation with accepted Parallax PR #719 and helper
PR #720 used one fresh production build (155.481 s) and one three-case browser
batch (107.851 s), candidate `76e24ae5`, base `5e72620c`, source `e643d3acc6f8`.
There was no dependency installation, duplicate local 20-context capture, new
product/fixture repair or independent review in this continuation. The fresh
62-file supplemental packet totals 25,524,349 bytes; its Git blobs and original
Windows stage log were verified. Existing task outputs and shared runtime state
were preserved; new build/temp/database outputs use task-owned D-drive paths.

Exactly one hosted capture dispatch was made: run `38277482404`, attempt 1,
job `114906394818`, started 16:27:10 UTC and completed 17:07:30 UTC on 2026-10-12.
It reached the configured 40-minute limit and was cancelled, returning zero
artifacts. Build completed at 16:31:30 UTC; server ready appeared at 16:31:32 UTC;
the next result was cancellation at 17:07:26 UTC. The
[terminal receipt](../../Testing/Product_Experience/evidence/crossdeck-refit-integration-e643d3acc6f8/protected-capture-receipt.json)
preserves actual API/log evidence without inferring a product cause. This hosted
attempt is the largest measured execution cost of the reconciliation. No retry,
final third review, ordinary qualification or merge occurred. Two independent
reviews and ten applicable repairs against three remain unchanged. Future
continuation needs a source-bound diagnosis or explicit bounded capture decision;
repeating the same capture without one provides no new evidence. Current tokens,
cache, credits, billing and per-agent usage remain `UNAVAILABLE`.

Measurements in the following table describe the earlier local stages. They do
not qualify the reconciled source or supersede the terminal hosted result above.

| Measurement                                        | Observed value                                                                       | Basis                                                                                                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native Goal aggregate tokensUsed at pause          | 2,565,200                                                                            | Historical paused native Goal snapshot supplied by coordinator; diagnostic telemetry, not resumed usage or billing.                                                                                      |
| Native Goal timeUsedSeconds at pause               | 6,537 s                                                                              | Same historical paused snapshot. Resumed elapsed usage is unavailable.                                                                                                                                   |
| Delegated remaining/budget counters                | `UNAVAILABLE`                                                                        | The delegated get_goal returned all null; parent supplied no remaining/budget breakdown.                                                                                                                 |
| Input, cached input and output tokens              | `UNAVAILABLE`                                                                        | No token-category accounting is exposed for this task.                                                                                                                                                   |
| Credits, billed cost and distinct agent cost       | `UNAVAILABLE`                                                                        | No task or per-agent billing counters are exposed.                                                                                                                                                       |
| Reported focused product batch                     | 16 files / 159 tests passed; 154.66 s                                                | Completed pre-0657 Vitest wall duration. Earlier 14-file / 150-test batch passed in 57.39 s; overlapping populations are not added.                                                                      |
| Earlier additional product checks                  | 22 passed                                                                            | Completed preliminary builder invocation; counts are not added to the final 150-test population.                                                                                                         |
| Implemented companion disclosure checks            | 13 tests passed                                                                      | Earlier focused Companion checks plus native semantic/Enter evidence; not independent accessibility acceptance or an added total across overlapping populations.                                         |
| Implemented canonical composition checks           | 15 tests passed; 2.74 s                                                              | Earlier realistic CHART/JOURNAL composition checks; lint/format passed. Local implemented proof, not independent acceptance.                                                                             |
| Scoped opacity/animation consumer checks           | 35 tests passed; duration `UNAVAILABLE`                                              | Existing consumer checks, lint/format and CSS-module validation passed before the current full stage; overlapping populations are not added.                                                             |
| Historical Product Experience helper checks        | 44 passed; 34.789 s                                                                  | Earlier candidate-helper regression invocation; not qualification of the current unchanged protected helper. Earlier combined run: 43 tests / 34.653 s.                                                  |
| Latest measured production build                   | Passed; 50.928 s                                                                     | Fresh local build at source `7ebaa80e223c93b430b8fbb36a1a9eec61a86c91`; protected qualification is separate.                                                                                             |
| Earlier 0e production build                        | Passed; 51.385 s                                                                     | Source `0e1074c1cf3e7abbe7dd572c6cb828cf45419dc4`; its unchanged binary was reused for the historical `001de655` subset.                                                                                 |
| Earlier 737 production build                       | Passed; 50.304 s                                                                     | Source `737fc73596bc4b81fad775c46632bcd3b93b0fd4`; total duration, not a compilation/TypeScript phase estimate.                                                                                          |
| Earlier 4b8c production build                      | Passed; 50.881 s                                                                     | Source `4b8c953f8578fdf87273e8d6c800cb191db7576f`; retained historical local result.                                                                                                                     |
| Earlier 0c424 production build                     | Passed; 77.276 s                                                                     | Source `0c4246878bbd3b1d0c5f0d0db9dde20e2746eb80`; retained historical local result.                                                                                                                     |
| Earlier f852 production build                      | Passed; 50.482 s                                                                     | Source `f8527d3988d17284a898cbd0f27265c8a2d2ea4c`; retained historical local result.                                                                                                                     |
| Preceding production build                         | Failed; 52.624 s                                                                     | Checkpoint `839fc784` failed on a test DTO type; corrected before `f8527d39`.                                                                                                                            |
| Earlier core browser journeys, first measured pair | Normal motion 28.8 s; reduced motion 18.4 s                                          | Both passed on their earlier local source; not substituted for the latest four-spec batch.                                                                                                               |
| Earlier core browser journeys, later measured pair | Normal motion 33.3 s; reduced motion 60 s                                            | Both earlier core cases passed; final current-source qualification is separate.                                                                                                                          |
| Preceding seven-test browser batch                 | Two passed, three failed, two skipped; 346.297 s                                     | Failed local batch retained; hook label overwrite, legacy ambiguous label and recovery harness hash assertion were corrected before the rerun.                                                           |
| Committed 0657 browser batch                       | Five passed, two failed; 267.655 s                                                   | Server readiness 47.987 s; reduced purpose reset and nested recovery locator failed.                                                                                                                     |
| Committed 105ec browser batch                      | All 24 passed; 441.150 s                                                             | Three refit and 21 Homeport cases; readiness 9.100 s, cleanup 76 ms.                                                                                                                                     |
| Latest measured affected browser batch             | Three passed; 91.876 s                                                               | Source `7ebaa80e`; browser execution 90.461 s, readiness 1.283 s, cleanup 0.032 s. Local emulated proof, not independent acceptance.                                                                     |
| Earlier 0e affected browser batch                  | Three passed; 91.260 s                                                               | Source `0e1074c1`; browser execution 89.843 s, readiness 1,292 ms, cleanup 34 ms.                                                                                                                        |
| Earlier 737 affected browser batch                 | Three passed; 89.455 s                                                               | Source `737fc735`; runtime execution 88.027 s, readiness 1,297 ms, cleanup 34 ms.                                                                                                                        |
| Earlier 4b8c affected browser batch                | Three passed; 89.160 s                                                               | Source `4b8c953f`; runtime execution 87.470 s, readiness 1,562 ms, cleanup 35 ms.                                                                                                                        |
| Earlier 0c424 affected browser batch               | Three passed; 101.511 s                                                              | Source `0c424687`; runtime execution 99.983 s, readiness 1,392 ms, cleanup 31 ms.                                                                                                                        |
| Earlier f852 affected browser batch                | Three passed; 89.945 s                                                               | Source `f8527d39`; retained historical local result.                                                                                                                                                     |
| Latest measured guarded synthetic seed             | Passed; 2.115 s                                                                      | Source `7ebaa80e`; nonce identity also passed in 112 ms. Fixture setup alone is not experience acceptance.                                                                                               |
| Earlier 001 guarded synthetic seed                 | Passed; 2.148 s                                                                      | Focused source `001de655`; nonce identity passed in 117 ms.                                                                                                                                              |
| Earlier 0e guarded synthetic seed                  | Passed; 2.118 s                                                                      | Source `0e1074c1`; nonce identity also passed in 124 ms.                                                                                                                                                 |
| Earlier 737 guarded synthetic seed                 | Passed; 2.236 s                                                                      | Source `737fc735`; nonce identity also passed in 118 ms.                                                                                                                                                 |
| Earlier c8c646 guarded synthetic seed              | Passed; 2.072 s                                                                      | Diagnostic source `c8c64648`; nonce identity also passed in 116 ms.                                                                                                                                      |
| Earlier 4b8c guarded synthetic seed                | Passed; 2.060 s                                                                      | Source `4b8c953f`; nonce identity also passed in 327 ms.                                                                                                                                                 |
| Earlier 0c424 guarded synthetic seed               | Passed; 2.459 s                                                                      | Source `0c424687`; nonce identity also passed in 116 ms.                                                                                                                                                 |
| Earlier f852 guarded synthetic seed                | Passed; 2.094 s                                                                      | Source `f8527d39`; nonce identity passed in 137 ms.                                                                                                                                                      |
| Latest full canonical capture                      | Local pass; 20 contexts / six contracts; 138.140 s                                   | Source `7ebaa80e`; full normal/reduced matrix passed. Protected trusted capture and independent review remain pending.                                                                                   |
| Automated evidence validation                      | Passed; 120 artifact references checked                                              | Unchanged `validateExperienceEvidence` with `automatedOnly`; artifact bytes and keyboard/focus/continuity/role/return checks passed; zero serious AXE/overflow observations.                             |
| Current trace AXE analysis                         | 20 traces; 100 analyses; zero serious/critical contexts                              | Source-bound current canonical traces; technical local proof, not independent accessibility acceptance.                                                                                                  |
| Earlier 0e full canonical capture                  | Failed; 110.368 s                                                                    | Source `0e1074c1`; first 16 contexts passed. Correct Chart/objective were visible; objective assertion assumed incorrect inner-region containment.                                                       |
| Latest focused companion diagnostic                | Process passed; 4/4 contexts; 37.966 s                                               | Source `001de655`; unchanged `0e1074c1` binary. Two Artifact NORMAL contrast failures remain historical; repaired-source accessibility acceptance and omitted 16-context qualification remain unclaimed. |
| Earlier fb focused diagnostic                      | Failed; 5.731 s; zero contexts passed                                                | Four selected contexts; verified unchanged `737fc735` binary. Duplicate outer/inner Voyage Chart accessible regions.                                                                                     |
| Earlier 737 canonical diagnostic                   | Failed; 138.597 s                                                                    | Source `737fc735`; first 16 contexts passed. Next companion context captured Journal/Lens, then Chart waited for the purpose menu closed by the prior role switch.                                       |
| Earlier c8c646 canonical diagnostic                | Failed; 112.514 s                                                                    | Source `c8c64648` reused the unchanged `4b8c953f` app binary. First 12 contexts passed; Homeport desktop setup then failed the button-role lookup for the visible native purpose disclosure.             |
| Earlier 737 browser timing, normal/reduced         | QR 446/513 ms; claim 426/415 ms; rendered ACK 452/445 ms                             | Raw source `737fc735` browser measurements; no protected, production-latency or physical-device claim.                                                                                                   |
| Local 0e browser timing, normal motion             | QR 447 ms; claim 413 ms; send offer 192 ms; rendered ACK 457 ms                      | Historical local source `0e1074c1` measurements.                                                                                                                                                         |
| Current local timing, normal/reduced               | QR 469/271 ms; claim 408/409 ms; send offer 213/565 ms; accept/render ACK 464/444 ms | Source `7ebaa80e`; raw local/emulated observations, not production latency or physical-device evidence.                                                                                                  |
| Current local shared/revocation timing             | Offer 225 ms; rendered receipt 562 ms; revocation clear 5,964 ms                     | Source `7ebaa80e`; synthetic shared-screen recovery observations.                                                                                                                                        |
| Earlier 4b8c canonical capture                     | Failed; 81.581 s                                                                     | Source `4b8c953f`: six actual same-login sign-ins; diagnostic mobile recording remained on sign-in. Source limit is six attempts/login/15 minutes; no network 429 was captured.                          |
| Earlier 0c424 canonical capture                    | Failed; 47.572 s                                                                     | Source `0c424687`: published Lens contexts reached; subsequent PRIMARY setup assumed a first-opening dialog despite persisted canonical `hasOpened`.                                                     |
| Earlier f852 canonical capture                     | Failed; 5.282 s                                                                      | Source `f8527d39`: sign-in/Journal/Lens reached; duplicate active/background Voyage context. This blocker was resolved at `0c424687`; the failed run remains failed.                                     |
| Independent cycle 2 inspection                     | 45 PNG; six WebM; 92 sampled frames                                                  | Source `67ec3f0c`; one open accessibility finding. Final cycle 3 packets/acceptance pending.                                                                                                             |
| Baseline capture population                        | 15 numbered checkpoints; 16 PNG, eight WebM, two trace ZIP files                     | Actual local `artifacts/crossdeck/refit-baseline` inventory; checkpoint 11 has two retained PNG files.                                                                                                   |
| Refit rendered capture                             | Current local packet and 62 supplemental files present                               | Source `7ebaa80e`; supplemental 45 PNG / 14 WebM / three raw records, 25,113,141 bytes. Six principal declared recordings and eight ancillary; final protected packet/review pending.                    |
| Protected final check                              | Pending                                                                              | No refit protected qualification run is recorded.                                                                                                                                                        |

The work uses one owned worktree, the existing generic runtime/database guard
and the unchanged protected browser helper. The persisted seed supplies
synthetic account/edition/Voyage content; canonical sign-in and **Use this
device** controls perform account/device entry. Protected qualification retains
the existing runner's exact-source build and authority rules.
Historical failed runs and baseline defects remain classified as failures or
incomplete observations. No token, credit or elapsed-time savings are inferred.

The earlier measured source is `0c4246878bbd3b1d0c5f0d0db9dde20e2746eb80`,
tree `245d2522a4787e40b3b40f0ac2bb59136825cba1`, against accepted base
`81fa477c5099b259e0d3bd8e8e0e6e52a7dc02bb`. Its
[stage receipt](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/0c424687-local-stage-receipt.json)
and [log](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/0c424687-local-stage.log)
preserve the passed build/browser stages and failed canonical capture. Partial
capture evidence remains historical. Exactly two independent review cycles have
occurred; cycle 3 awaits the trusted final packet.

An earlier measured application build is `4b8c953f8578fdf87273e8d6c800cb191db7576f`,
tree `d7631ea3151af8ddaefc01239a6acc567d023c84`. Its
[stage receipt](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/4b8c953f-local-stage-receipt.json),
[log](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/4b8c953f-local-stage.log)
and [failed mobile still at 28.5 s](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/4b8c953f-failed-mobile-sign-in.png)
retain the failed five-contract attempt. The subsequent focused canonical capture used the unchanged `4b8c953f`
production binary with the corrected persisted synthetic fixture: primary email,
verified secondary email and profile username resolve to the same canonical
account/profile. The six selected contracts retain all 20 contexts, with 6/6/4
authenticated sign-ins across those identifiers and four anonymous auth-recovery
contexts. Security policy and the protected helper are unchanged.

The earlier focused diagnostic source is `c8c646488df978a33815fbb76e16935b731f314b`, tree
`6f127a5c239c59dcbba800654cdd390933a5e04a`. Its
[receipt](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/c8c64648-local-stage-receipt.json)
and [log](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/c8c64648-local-stage.log)
retain the failed 112.514-second diagnostic. The first 12 contexts passed: Lens
four, native connection four and anonymous recovery four. The actual
31.4-second recording's late frame showed the companion's native **Change
companion purpose** disclosure; the
[28.5-second checkpoint](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/c8c64648-purpose-disclosure.png)
is preserved. Homeport desktop setup failed its button-role lookup. A focused
DOM check found native `summary` `tabIndex` 0/button-role count 0; an explicit
button role yielded one match and native Enter still toggled the disclosure.
The semantic correction was implemented with 13 Companion tests passing before
the next fresh build. That local semantic proof does not establish independent
accessibility acceptance.

The earlier measured source is `737fc73596bc4b81fad775c46632bcd3b93b0fd4`, tree
`345b64f9c89d148eb956ac039605fbebd162ef60`. Its
[receipt](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/737fc735-local-stage-receipt.json)
and [log](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/737fc735-local-stage.log)
retain a fresh build PASS, three browser cases PASS and canonical capture FAIL
138.597 s. The first 16 contexts passed; the next companion context captured
Journal/Lens, then Chart waited for a menu intentionally closed by the prior
purpose change. The actual
[closed-menu checkpoint at 30.5 s](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/737fc735-closed-purpose-menu.png)
is preserved. The correction adds real **Change companion purpose** clicks
before Chart, before **More purposes**/Artifact and before Journal; all six
contracts, 20 contexts and outcomes remain. No production code, helper or policy
change is required. The subsequent local replay focused four companion contexts
using the unchanged `737fc735` binary; the other 16 passes remain historical
local observations.

The focused `fb7cc2a24c44f64d4442563655150c1e05f7836c` diagnostic failed in
5.731 s with zero contexts passed, on duplicate outer/inner **Voyage Chart**
accessible regions. Its [receipt](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/fb7cc2a2-focused-companion-receipt.raw.txt)
and [log](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/fb7cc2a2-focused-companion.log)
preserve verified reuse of the `737fc735` binary. Renaming the outer region
**Chart companion** preserved the canonical inner name. Realistic CHART/JOURNAL
composition checks passed within 15 Companion tests in 2.74 s; lint/format passed.

The earlier full-stage source is `0e1074c1cf3e7abbe7dd572c6cb828cf45419dc4`, tree
`8653a5047c0173d9b68db896047eaade88799e67`. Its
[receipt](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/0e1074c1-local-stage-receipt.json)
and [log](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/0e1074c1-local-stage.log)
record build PASS 51.385 s, three browser cases PASS 91.260 s and full canonical
capture FAIL 110.368 s after 16 passed contexts. The actual failed 9.24-second
recording's [desktop checkpoint at 8.5 s](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/0e1074c1-canonical-chart-objective.png)
shows the correct Chart and **Current objective: Secret Isle**. The contract
checked the objective inside the inner canonical region; actual Landfall places
it beside that region inside **Chart companion**. The correction checks the
outer objective and separately the canonical region/image, adding one assertion
per context while retaining all 20 contexts/outcomes. The mock was corrected to
that composition without changing the `0e1074c1` binary for that diagnostic. The subsequent
four-context diagnostic described below reused that verified unchanged binary,
with no new build pass claimed.

The focused companion diagnostic passed 4/4 desktop/mobile normal/reduced-motion
contexts in 37.966 s at source `001de655be19b91a16ea4732f00705145eedd7f1`, tree
`2db82a7260cf3c9ddd580febe9f1544139e57bf6`. Its
[receipt](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/001de655-focused-companion-receipt.raw.txt)
and [log](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/001de655-focused-companion.log)
verify reuse of the unchanged `0e1074c1` application binary. The selected four
contexts passed locally; the omitted 16 have qualification `NOT_CLAIMED`.
Historical 16-context passes are not added to this subset as full qualification.

This is a semantic capture-process pass, not technical accessibility acceptance.
Source-bound diagnostics confirmed two Artifact NORMAL contrast failures;
REDUCED contexts were clear in that packet. Another 72 AXE analyses of the partial
`0e1074c1` full capture found MOBILE NORMAL RETURNED onboarding and LIBRARY_READY
route fades, preserved in the [consumer trace diagnosis](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/0e1074c1-consumer-trace-diagnosis.raw.txt).
Scoped animation/opacity repairs are implemented and 35 existing consumer tests,
lint/format and CSS-module validation passed before the fresh full stage below.
Library consumer registration and appended Homeport contract IDs preserve
existing screen histories/maturity. Independent acceptance remains pending.

For the `001de655` receipt, the full requirement was six contract IDs and 20 contexts, bound to source
digest `f646bc0ed84c4032858989963d705e64f89fb39d79a3071c952618a0b9e64f68`
and required contract digest
`4c90c6ab9b4cb7f946454b6af2e13964b6ae89f149ee7098b71da319b3e42393`.
Those six IDs and 20 contexts remain required.
The next steps are one draft PR, trusted fresh full capture, independent cycle 3,
authenticated review submission, ordinary protected qualification, integration
and landed smoke. That subset established no new production build pass, debt
closure, feature acceptance or owner acceptance.

The fresh local full stage passed at source
`7ebaa80e223c93b430b8fbb36a1a9eec61a86c91`, tree
`1b0f4149fe6340fde355b66754ad87423dc041e4`, base
`81fa477c5099b259e0d3bd8e8e0e6e52a7dc02bb`. Its
[receipt](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/7ebaa80e-full-stage-receipt.raw.txt)
and [log](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/7ebaa80e-full-stage.log)
bind source digest `b532911336255218fb3120516680c4cecf1981ff1b88943cb262f5c927cbb8e6`
and contract digest `1607c063fedcf905c0adac3a8dc1d8f17a32648ad773f40cc6f0fac9352265b1`.
All 20 contexts across six contracts passed locally. Unchanged
`validateExperienceEvidence` with `automatedOnly` passed all 120 referenced byte
checks and keyboard/focus/continuity/role/return checks, with zero serious
AXE/overflow observations. The [trace analysis](../../Testing/Product_Experience/evidence/crossdeck-refit-history-20261012/7ebaa80e-full-contrast-trace-findings.raw.txt)
has 20 traces / 100 AXE analyses and zero serious/critical contexts.

The [canonical capture](../../Testing/Product_Experience/evidence/crossdeck-refit-b53291133625/capture.json)
and [two-device manifest](../../Testing/Product_Experience/evidence/crossdeck-refit-two-device-b53291133625/manifest.json)
preserve 45 PNGs, 14 WebM files (six principal declared recordings, eight ancillary)
and three original observation records: 62 files / 25,113,141 bytes. These are
local Chromium-emulated artifacts. Third independent review has not consumed
the packet; draft PR, protected trusted capture/review submission, ordinary
qualification, integration and landed smoke remain pending. No production,
hardware, independent or owner acceptance is inferred.

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
binds 34 selected original review observations, failure PNGs and build/local-stage
receipt/log files totaling 2,236,473 bytes. Historical review/raw IDs are not current protected
capture artifact identities. Final accepted source/base/tree, capture/packet digests,
separate cycle 3 reviewer result, protected run and landed smoke remain pending.
