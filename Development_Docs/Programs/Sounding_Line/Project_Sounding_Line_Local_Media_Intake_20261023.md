---
title: Local verified media intake preparation
audience: engineering
status: inactive-local-draft
canonical_for: sounding-line-local-media-intake-20261023
last_reviewed: 2026-10-23
---

# Local verified media intake

This uninstalled maintenance draft extends the [capacity correction](Project_Sounding_Line_Capacity_Safety_Correction_20261023.md) in the owned b2 checkout. It prepares separate local transfer/extraction routes for authenticated successful captures and authenticated failed-run diagnostics. It grants no capture, upload, protected installation, qualification or product acceptance. The optional private-media prototype is unrelated to the approved #776 public disclosure.

## Source and completion boundary

The CLI is scripts/sounding-line/experience-local-media.mjs. Its expected plan must come from independently reconciled source. Before transport, the CLI hashes that plan, requires the checkout HEAD to equal its candidate, and recomputes the canonical plan/source/contract/policy/exception bindings. A plan found in the downloaded archive cannot establish its own authority.

The existing successful-run provenance validator remains intact. Artifact ID, exact expected run/attempt, repository, actor, workflow, artifact digest and expiry remain bound. Provider metadata is freshly checked after transfer and again after copying; following awaited intake cleanup, the frozen metadata is validated for provenance, expiry and cancellation. The default verifier retains its 120-second ceiling. The separate local trusted artifact session has a fixed 900-second ceiling. Final retained-set verification has a separate cooperative 900-second bound; preflight and publication are outside the session ceiling. These are not whole-process preemption or a hard 15-minute CLI limit.

The helper retains the exact complete archive as capture.original.zip, then extracts every manifest artifact and paired report/runtime/profile/case witness under members/ with original relative paths. Missing, ambiguous, aliased, unsafe or conflicting paths reject the whole selected set. Streaming CRC, SHA256 and declared expansion checks precede successful file completion. Same-handle rehashes and named-file identity checks follow writes. No hardlinks or convenient subsets are used.

The completion receipt binds the retained archive plus the allocation, manifest and inspection-index JSON pins. After provider checks and temporary-file cleanup, every retained archive/media/metadata byte is rehashed and the expected directory closure checked. Final cancellation and synchronous identity checks precede create-only terminal publication. A pending receipt or receipt-file existence alone is insufficient: preserve the successful process result and exact terminal receipt hash together. External filesystem writers are not excluded; this is an observed verification, not an operating-system filesystem lock.

Failure preserves retained originals and partial outputs. A create-only failure record is attempted only while reserve and cancellation permit; the thrown terminal object reports a failure-record error if even that write is denied. No retry converts a partial result into success. All index entries stay NOT_REVIEWED, including the successful extraction result.

## Local allocation

The existing output parent must be an owned real D: directory. The helper reads its actual allocation unit, runs the local ReserveGuard before each phase and at four-minute intervals, and checks live C:/D: free bytes before mediated writes. Both drives must remain strictly above 30 GiB (32,212,254,720 bytes) after remaining estimated allocation.

Admission counts temporary archive A plus retained archive A plus all selected allocation-unit-rounded expansion E plus directory/metadata allowance H, concurrently. H includes 64 MiB of metadata and at least one 64 KiB or actual allocation unit per file/directory and archive overhead. Existing retained bytes already reduce free space. Renderer/cache/temp allowances remain unknown and are never zero by assumption. The reserve monitor is an instruction-following check, not an OS quota; it cannot control external applications, cloud jobs or existing processes that did not load the rule.

A later authorized invocation supplies --workspace, --output-parent, --plan, --plan-sha256, --artifact, --run, --attempt and --reserve-guard. All must identify the same independently verified successful capture. Diagnostic mode additionally requires --mode diagnostic-only, --expected-bytes and --expected-digest. No real invocation or media download occurred in this preparation.

## Verification and inspection disposition

Core02 freezes 18 source/test inputs (manifest SHA256 79cd2b2ddf89771707b8661f448e7c1e035f6d4299b3136219224d3dacdc9370). Earlier focused regressions passed 39/39 and the subsequent helper suite 11/11 on their recorded source bytes. The final retained-set correction passed 3/3 focused cases on Core02: stored/deflated success, final cancellation, and six late archive/media/JSON/closure mutations. Every execution retained immutable source claims, stdout/stderr and owned-process cleanup receipts. Those earlier counts do not qualify later changed bytes; the final packet records the exact bridge and current checks.

The existing Playwright FFmpeg build1011 is 3,490,816 bytes, SHA256 5b8f3f59ba61685828939ff3c833109748adbdea2fff4b4ae570c9fc0fc1ff4d, version n7.0.1-playwright-build-1011, with an accompanying LGPLv2.1 license. Its advertised VP8/libvpx decoder completed a synthetic three-frame 32x24 sequence to EOF through a PNG pipe: 583 encoded bytes, all three decoded PNGs, 341 decoded bytes. No decoder download or global installation was required. The fixture had command/output bounds and owned cleanup, but no native RSS limit.

For actual inspection, proceed sequentially only after observing the actual codec, dimensions, duration/timebase, frame count/timestamps and any audio obligation. Bound every additional per-drive frame/temp/log/copy allocation and mediate output before writes. The existing VP8 route is usable only when the actual codec and review criteria fit it. FFmpeg [max_alloc](https://www.ffmpeg.org/ffmpeg.html) limits an individual allocation, not total RSS. Native decoder memory/private temp at real dimensions remain unqualified. No production decoder/viewer adapter is delivered by this draft.

The index distinguishes recordings from TRACE_ONLY_DECODE_REQUIRED and absent temporal sources. Planned 118 contexts is not observed coverage. An index, extraction, synthetic sequence or fixed frame samples cannot establish meaningful motion/timing review. Required trace-only contexts still need a bounded trace-decoding/viewer route; browser profile/cache/temp and resource-decoding allocations remain unmeasured. Preserve all recordings/traces and the original review criteria; do not silently omit them.

## Reported failed capture

At closeout the coordinator reported run39961561143/1 failed waiting for the desktop Creator sc02-assets-and-reusable-composition control Open contextual Inspector. It reported failure artifact12507491132 at25,664,828 bytes, encrypted raw artifact12506264590 at3,917,980 bytes, lifecycle152,746 bytes and progress7,954 bytes. These are coordinator-reported facts, not independently fetched media in this lane.

A separate diagnostic-only adapter, scripts/sounding-line/experience-diagnostic-artifact.mjs, now authenticates an exact completed failed run, provider artifact ID/name/size/digest, expected run/attempt, protected base/repository/actor/workflow, and an archive plan.json exactly equal to the independently expected plan including candidate/source/contract. It freshly rechecks provider identity after transfer and copying, then validates the snapshot after cleanup. This adapter is not used by successful attestation and cannot produce successful-capture provenance.

The separate diagnostic factory alone exposes a copy method that computes each member SHA from the authenticated complete archive while enforcing CRC and expansion checks. The default member method still requires its expected SHA. Every outer archive member is retained, including unindexed partial media, plan, journals and auxiliary/encrypted files. Original paths remain under members/. A diagnostic manifest records observed journal paths; missing journals or completed context coverage are never invented. Nested traces remain original ZIP bytes; their separate decoding/expansion is not included in this extraction admission.

The terminal status is COMPLETE_DIAGNOSTIC_EXTRACTION_NOT_REVIEWED_NOT_ACCEPTANCE, with diagnosticOnly true, original failed conclusion, qualification false and productAccepted false. Identified completed contexts remain null with an empty context list. This means verified extraction of the diagnostic package, not complete capture or meaningful review.

For the reported selected artifact, A is25,664,828 bytes and its expected provider SHA256 is9aa00554f16c056f84f6a8ceed17d2d082e9ca80f4bef2747d0e419bc016443c. The helper's download admission adds its 64 MiB metadata allowance to the reader's A+64 MiB estimate: A+128 MiB =159,882,556 bytes of remaining-write allowance initially. This is a conservative admission amount, not measured allocation. Concurrent archive copies alone total51,329,656 bytes. After authenticated ZIP catalog inspection, compute actual allocation-unit-rounded outer member E and H before extraction; admit 2A+E+H without cleanup credit. The overall staged admission envelope is the larger of A+128 MiB and 2A+E+H; the archive-copy phase also admits its own remaining bytes before writing. This reported A/digest must still match live authenticated metadata. Unknown render/trace/temp allocations remain a separate held phase, not zero.

The diagnostic CLI uses the same independently reconciled candidate checkout and plan flags as capture mode, with these additional exact arguments:

```text
--mode diagnostic-only --artifact 12507491132 --run 39961561143 --attempt 1
--expected-bytes 25664828
--expected-digest sha256:9aa00554f16c056f84f6a8ceed17d2d082e9ca80f4bef2747d0e419bc016443c
```

Core03 freezes19 source/test pins, SHA2563ae09c6558fc02a962bd14a75ff51a15f91c5ab632d9bab400f12241b2593bc8. The complete focused helper/capacity/attestation regression run passed45/45 with owned cleanup PASS. It covers both ZIP methods, ten diagnostic provider/source mismatch variants, authenticated-archive bad CRC, case alias and late provider changes, and confirms the success loader rejects failed runs. A fresh forced publication-phase reserve observation follows final retained-set verification and precedes synchronous terminal checks/write. Core04 adds only one final publication-reserve regression and freezes the current19 pins, SHA256e67f1180fd950c66f275858dc86cde331874bb7900f5ef2be2ec5cf3f4f9eb4c. That separate1/1 execution proves either local drive declining after the pending receipt prevents COMPLETE and preserves the archive; it is not a single46-test execution. Core03 received a scoped independent static review with no remaining material finding. The final packet records the exact current-source review disposition and receipt hashes. This candidate remains uninstalled.

The failed capture remains failed and preserved; no duplicate capture or real media intake was started here.

## Final diagnostic layout correction

Core05 supersedes Core04 for execution. Its19-source manifest SHA256 isf10275bc068ce953ed8043b14216f7e3e0af1763cd1606893b372d6d47b29d53. Only the diagnostic adapter and its test differ from Core04. The successful attestation reader is unchanged.

The failure upload combines paths with a shared ancestor. GitHub documents that [multiple upload paths use their least common ancestor as the archive root](https://github.com/actions/upload-artifact#upload-using-multiple-paths-and-exclusions). The actual archive remains uninspected here; the common-root compatibility defect was established from workflow source and documented upload behavior. Diagnostic plan lookup now permits exactly one of four explicit paths: plan.json, product-experience-submission/plan.json, artifacts/sounding-line/product-experience-submission/plan.json, or candidate/artifacts/sounding-line/product-experience-submission/plan.json. It rejects duplicate permitted paths and requires1..8MiB before allocating a fixed buffer. The existing diagnostic member stream enforces declared expansion and CRC before JSON parsing and comparison to the independently expected plan. No arbitrary basename search or success-loader fallback is used.

The layout regression passed2/2, including stored/deflated known prefixes and duplicate, empty, oversized and invalid-JSON rejection. The complete current helper suite then passed19/19 with zero skips/failures and owned cleanup PASS2ms. The earlier45-case and separate1-case receipts remain independently bound historical results; no combined count is substituted for an actual execution. Current lint passed. Final source/doc raw copies and the independent source verdict are bound in the closing decision packet. No actual media was downloaded, extracted, decoded or reviewed.
