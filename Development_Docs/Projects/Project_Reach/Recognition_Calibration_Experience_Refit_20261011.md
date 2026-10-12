---
title: Reach recognition, calibration and experience refit
audience: product-engineering
status: implemented-and-reviewed
canonical_for: reach-recognition-calibration-experience-refit
last_reviewed: 2026-10-11
---

# Reach recognition, calibration and experience refit

This owner-directed candidate starts from protected main `6d13c357be93514c94e7f36db1a8c930265e65e2` in isolated branch `codex/reach-experience-refit`. It replaces the Phase 1 laboratory's interpretation, acquisition and presentation while retaining camera/provider ownership, independent validation and later-phase boundaries. Protected integration and owner/product acceptance are separate. The earlier Phase 1 record remains historical evidence; this record describes the revised implementation.

## Confirmed failure mechanism

The previous collector required overall `USABLE`, reason `NONE`, exactly one hand and all twenty-one valid landmarks. Watchglass assigned `LOW` to multiple hands, pointing failure and near-edge visibility alike. Its strict frame margin treated every landmark as essential, and a simple index-distance heuristic conflated pointing posture with tracking quality. The adapter also replaced identity on brief loss/multiple-hand observations. Every rejected frame cleared the collection buffer. Fifteen samples spanning 600 ms, a 150 ms maximum gap and tight feature spreads therefore required uninterrupted evidence, without visible accumulation or actionable rejection feedback. Those source conditions explain how visibly tracked joints could coexist with no accepted first target. They do not establish the exact timing or camera conditions of the owner's reported session.

## Revised interpretation and acquisition

Watchglass observation version 1 remains compatible. Optional per-hand continuity and provider version 1.1.0 identify the revised adapter; the pinned MediaPipe runtime/model/digest stay unchanged. Missing public presence/tracking confidence remains null. Landmark validity, required-feature visibility, framing, geometry and scale-normalized three-dimensional finger-chain straightness are distinct assessments. Only wrist, index chain and palm-width anchors are essential to pointing; invalid nonessential tips do not erase hand detection. Open palms and collapsed/curled index geometry abstain.

Spatial/temporal palm matching retains local tracks across short loss and ordinary result-array reorder. A second hand can coexist with the selected hand. Ambiguous crossings, competing matches, large jumps and changed provider/camera contexts suspend eligibility and force fresh identity/setup. Handedness is a hint. No biometric identity or two-hand manipulation is introduced.

Reach's bounded sample window retains at most thirty real samples over five seconds, accumulates stable evidence, pauses for safe interruptions up to 300 ms, rejects isolated feature spikes, reacquires after repeated outliers and expires only the current hold after sustained loss. Slower cameras can supply the same fifteen required samples without weakening spread, freshness or identity checks. A twenty-second unsuccessful target hold pauses with rest/retry guidance. Completed targets remain intact. Bindings, finite values and monotonic timestamps remain strict. Stability still requires fifteen samples spanning at least 600 ms and bounded feature spread. Target transitions settle for 700 ms. These configured limits are not claims of physical ergonomic qualification.

## Two separately checked modes

Absolute pointing retains the five-feature regularized empirical model and distributed nine-target layout. The fit additionally rejects insufficient observed variation. A single RGB camera lacks calibrated camera/display extrinsics and metric depth; synthetic fits cannot prove natural pointing observability. Absolute mode is visibly experimental and cannot make a universal physical ray-intersection claim.

Relative movement maps a comfortable palm reference and four measured directional positions to cursor displacement, with a distinct model, five-target setup, instructions and result labels. Both modes run five distinct held-out targets in randomized order without refitting. The governing raw held-out p95 error gate remains 3% of the actual CSS area's diagonal. Fit success remains `VALIDATION_REQUIRED`; failed checks remain unavailable. Raw held-out jitter and empirical error radius are separately reported. Coverage stays inside the central 80% and sampled feature domain; filtering, snapping or demo input cannot improve the reported raw check.

## Experience, lifecycle and ownership

One workspace stages preparation, acquisition, independent check, results and practice. The camera image and canvas skeleton share the same contain/letterbox and mirroring transform. Selected and incidental hands remain distinguishable. A separate animation-frame canvas renders current observations and pointer feedback; explanatory React updates are bounded, with guidance hysteresis that never delays eligibility checks. Mobile calibration keeps instructions and acquisition progress beside the target, with controls immediately below. Diagnostics are closed deliberately. Lanternwake owns target motion and reduced-motion policy.

The guided demo waits for its visible hand-placement action at each target before feeding the same bounded acquisition window. Reading, pausing and inspecting the demonstration cannot silently advance a sequence of unchanged simulated holds. Demo pacing remains separate from actual camera acquisition and physical qualification.

Starting may open a waiting target through the existing 300 ms short-loss grace when a recently recognized point remains framed. Sample collection still requires fresh eligible observations within 150 ms. This separates the user's start action from a transient freshness race without accepting stale samples. Diagnostics remain beside the active workspace so ordinary inspection can preserve its pointing-area position; consented exports include measured raw hold jitter.

An independent check can open while the user rests or reaches for its control. Its acquisition is bound immediately to the fitted hand, camera and view; only fresh eligible observations with that same binding can contribute. The check's start control no longer depends on sustaining a pointing posture while clicking it. Opening the target does not accept a sample or validate the fit.

Sextant retains explicit consent, camera leases and teardown; the unchanged worker remains one frame in flight. Stale observations hide the pointer. Camera/hand/model/frame/orientation/mirror/view changes invalidate setup, and live absolute screen-position changes invalidate it as well. Stop, background and navigation release camera/worker/render/session timers. No raw-frame retention, upload, hidden calibration persistence, progression writer, Parallax mutation, Phase 2 selection, Phase 3 manipulation or Air Handoff exists.

## Evidence and independent review

Focused tests cover official landmark geometry across reflection/rotation, posture alternatives, nonessential visibility, two-hand continuity/crossings, clock and context failures, outliers/dropouts, fit coverage, separate relative validation and letterbox transforms. Existing Reach-owned Device Lab D0 oracles additionally exercise acquisition recovery, incidental-hand continuity and relative check failure. Later-phase declarations retain their non-executable status.

Production Chromium journeys cover laptop 1280×800 and mobile 390×844, both modes, pause/retry, held-out checks, practice, privacy export/deletion, camera failure and owned resource cleanup. Official photographic test assets travel through canvas video and the actual pinned worker, including noise, motion, partial occlusion and two hands. This is controlled D1 replay, not live-person D4 evidence. Asset origins, bytes and digests are recorded in `tests/e2e/fixtures/reach/provenance.json`.

The full photographic-worker journey collects nine actual-landmark absolute holds and five independent checks, asserting either the unchanged accuracy gate or an honest refusal. It then collects the separate relative setup and independent cursor check. Smooth image translation and pixel noise feed model inference rather than injected landmarks. Its consented aggregate output records the actual fixture error, jitter, acquisition and software timing boundaries.

The executable experience contract on `reach.phase1.foundation` preserves protected `PE-DEBT-REACH-STAGES` history while requiring visibly separate detection, posture and eligibility, desktop/mobile, normal/reduced motion, adverse recovery and natural entry/return. Independent rendered review, bounded repairs and authenticated capture/review artifacts are recorded in [candidate-review.json](../../Testing/Product_Experience/candidate-review.json).

All ten production-browser journeys passed at clean product candidate `632e1895a6fcd8ba4c82f1752f6b671131598a33` in two focused runs. The photographic journey completed all twenty-four training/check holds across both modes, with raw held-out error p95 of 0.53% for absolute and 0.56% for relative; physical qualification remains unclaimed. Its [supplementary manifest](../../Testing/Product_Experience/evidence/reach-d1-632e1895/manifest.json) preserves screenshots, measurements, browser logs and exact source identity separately from the trusted capture manifest.

[Protected capture 38198691260](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38198691260) passed twelve desktop/mobile, normal/reduced-motion journeys and issued immutable artifact `11724538509`. Its product source digest is `c64ecc9728c26d2532a0c26ee23d511a65e91255d710219398f79c7d16398874`; all 108 referenced artifacts were hash verified. The separate rendered-first reviewer accepted all seventeen dimensions, with the six initial findings resolved and no unresolved blocking finding. Ordinary qualification, the final qualified head and protected integration are traced on [PR 716](https://github.com/Kgray44/treasurehuntSoT/pull/716); capture and review preparation do not issue that mainline decision. Neither software qualification nor this implementation record grants real-person D4 or owner acceptance.

## Owner walkthrough and remaining physical proof

Before numerical physical trials, freeze and record source identity, webcam/resolution, display geometry and scale, browser/backend, provider/model, mirroring, viewing distance and camera placement. This refit has not qualified a physical reference configuration.

1. Open Devices → Reach on an ordinary laptop and phone/tablet. Confirm that purpose, explicit permission, tracking guidance, mode choice, target progress and return are understandable without this document.
2. Enable a real camera; try relaxed left and right pointing hands at representative distances and rotations, near edges, in ordinary/dim/bright lighting, with modest flexion and partial nonessential occlusion. Detection must remain visible when eligibility abstains.
3. Complete relative center/directions and five held-out cursor targets. Separately complete absolute nine-target training and five raw held-out pointing targets on supported reference camera/display placements. Repeat setups and retain consented aggregate trial evidence, including failures. Required physical absolute p95 error is ≤3% of the area diagonal and raw hold jitter p95 ≤1%; software simulation cannot close these gates.
4. Introduce an incidental hand, ambiguous crossings, brief and sustained loss, camera movement, mirror/view/zoom changes, backgrounding and reconnection. Confirm safe suspension, useful recovery, no bridged hand swap and actual camera light/track shutdown.
5. Measure exposure-to-visible p95 response against the governing ≤120 ms boundary using an independent physical method. Software capture-to-inference/canvas measurements omit exposure and scanout and cannot substitute for it.
6. Assess target readability, natural hold duration, fatigue, keyboard/touch/reduced-motion use and privacy/return on representative hardware. Only the owner can grant `PRODUCT_ACCEPTED`. No later-phase no-action or selection/manipulation gate is claimed by this Phase 1 refit.
