---
title: Adaptive visual capture for Sextant, Watchglass and Reach
audience: product-engineering
status: in-development
canonical_for: sextant-reach-adaptive-visual-capture-20261017
last_reviewed: 2026-10-17
---

# Adaptive visual capture

The owner requests reliable pointing in good light and measured assistance when lighting, framing, motion or available processing deteriorates. Sextant owns discovery, access and delivery of available hardware. Watchglass owns image assessment and visual recognition. Reach owns the tracking diagnosis, interaction interpretation and choice of useful assistance. This extends the [existing camera boundary](../../Governing/Project_Sextant_Governing_Amendment_v1.1_Reach_Camera_and_Device_Gesture_Boundaries.md), without transferring device lifecycle or recognition ownership.

This is an implementation design and development record. It does not claim completed native Sextant Phase 4, protected qualification, native iPhone installation or physical pointing acceptance. Source starts from the owned Reach development branch; original RGB model assets and the existing camera/rendering path remain the baseline.

The regular-camera path is sufficient to enter and use Reach. Infrared, depth, illumination controls and native helpers are optional assistance. Discovery and policy must work from reported capabilities rather than device names, manufacturer IDs, an assumed resolution or an assumed operating system. Requested formats are negotiated with the provider, and delivered rates are measured. Tunable observation windows, trial budgets, recovery periods, quality thresholds and pairing limits belong to a versioned policy; the numbers below are initial development policy or measured evidence, not laptop-specific branches. Established accuracy and source-integrity ceilings remain enforced.

## Experience and ownership

The natural entry remains Reach Laboratory's camera action. A camera consent has an explicit purpose and allowed sensor scope; an administrative feature or frequency policy cannot override an operating-system denial or start capture in a hidden page. Discovery reads metadata without opening cameras. During a tracking session, an already authorized assistance mode may be selected automatically within the administrator's policy.

| Owner      | Responsibility                                                                                                                                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sextant    | Enumerate sources and source groups; distinguish detected, accessible and streaming states; own permission, lease, hardware controls, capture rates, foreground lifecycle, resource release, source clocks and geometry metadata; deliver local frame handles. |
| Watchglass | Assess image signal and model outputs; declare which input modes a recognition provider actually supports; preserve model identity, uncertainty and negative-gesture checks.                                                                                   |
| Reach      | Combine hardware and perception health, form qualified diagnostic hypotheses, request assistance, evaluate bounded trials, preserve stable interaction coordinates and enforce calibration/validation gates.                                                   |
| Admiralty  | Govern global availability, rate ceilings, assistance permissions and aggregate optimization metrics through the existing canonical configuration controls.                                                                                                    |

The interface explains tracking, gesture eligibility, an assistance trial and a genuine source invalidation separately. It shows the active mode, the reason for a change and whether the reason is measured or inferred. It does not announce a hardware cure from the fact that an extra camera exists. Good tracking remains on its current mode; a brief uncertain frame does not start a series of hardware changes.

## Hardware and data contract

Sextant's inventory describes color, infrared and depth sources separately, including supported formats, measured delivery, optional exposure controls and infrared illumination controls. Unknown, unsupported, denied, busy and temporarily unavailable remain distinct. Device names do not prove a source modality, an infrared emitter's controllability or a depth measurement. A driver-managed emitter is distinct from an application-controlled one.

Source identifiers are local, ephemeral handles. Raw device identifiers, video, landmarks, depth maps and calibration matrices do not enter automatic aggregate telemetry. Frames remain local and are delivered through an authorized existing camera lease, with explicit ownership and disposal; they are not serialized into generic sensor observations.

Every frame carries its provider, lease and generation, source and source-group identity, geometry version, dimensions, orientation, mirroring, sequence and capture clock. Sensor capture, software capture and receipt times are distinguished. Clock conversion records uncertainty instead of silently assigning a fresh timestamp. The existing maximum capture age remains **150 ms**.

Multiple sources may be useful in different ways:

- A supplementary source can help acquisition or confirm a condition while RGB remains the coordinate source.
- Combining coordinates requires a verified registration, comparable capture clocks and sufficiently close current frames. The initial pairing bound is **10 ms**, including clock uncertainty. An advertised source group does not establish calibrated timing or optical alignment.
- Depth is used as measured metric depth only when the provider supplies that measurement and its units. Infrared intensity alone is not depth.
- A source, geometry or provider change is visible and follows the existing calibration integrity rules. Old landmarks or transforms never become current evidence. Assistance should preserve the primary coordinate source where possible, avoiding unnecessary setup restarts.

## Tracking diagnosis and adaptation

Reach evaluates a rolling history rather than reacting to one imperfect frame. Its diagnosis distinguishes measured facts from hypotheses. A missing hand result alone cannot identify bad lighting, occlusion or a difficult pose.

| Evidence                                                                        | Permitted diagnosis and response                                                                                                                                                           |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Old packets, long model times, measured processing duty or thermal restriction  | Capture/processing pressure is measured; reduce work within current caps and stop unnecessary secondary acquisition. Extra sensors are not presumed helpful.                               |
| Persistently poor image illumination or contrast together with lost recognition | Poor lighting is a hypothesis supported by image measurements; consider a supported exposure or qualified IR/depth assistance mode. Bright background pixels do not prove a well-lit hand. |
| Complete fresh index evidence with other hand parts clipped                     | Continue the established index path. Wrist or palm visibility is not added as a new eligibility requirement.                                                                               |
| Fresh optical continuity but absent neural acquisition                          | Distinguish model acquisition from capture failure; use only a bounded current-region recovery attempt or a qualified supplementary provider.                                              |
| Multiple incompatible hands, conflicting digits or ambiguous appearance         | Preserve the explicit uncertainty and gesture vetoes. Increasing raw detection counts cannot resolve identity.                                                                             |

Assistance uses a bounded trial with an explicit starting condition, measurable result, resource budget, timeout and rollback. Retain a mode only when its supported tracking evidence improves without new identity, freshness, gesture or validation failures. An unvalidated recognition mode is not selected merely because hardware capture succeeds. Repeated unhelpful trials back off; stable recovery requires sustained evidence before returning to the baseline mode. Hidden, stopped, revoked or globally disabled capture releases all owned readers and illumination controls.

Primary capture geometry is kept stable during calibration whenever possible. Model-analysis downsampling and camera-format changes are different operations. Actual camera changes cannot silently reuse a fit. Absolute and relative profiles remain separate, and the five independent held-out checks still require raw P95 error no greater than **3% of the testing plane's diagonal**.

## Current development findings

The branch now contains device-independent foundations, with focused development tests and an independent source review:

- Sextant's strict visual descriptor separates detection, access, permission, streaming, modality and control support. Local frame handles reject serialization and release superseded buffers. Authorization binds the exact provider, lease/generation, source, clock mapping and complete geometry/format. Registered pairs bind both complete source tuples; unregistered pairs cannot authorize coordinate fusion. The generic layer accepts a consumer freshness budget; Reach supplies its existing 150 ms ceiling. No discovery action opens a source.
- A read-only browser adapter queries only the existing broker's current authorized video track. It projects actual negotiated dimensions/rate and supported exposure metadata, and never uses labels or device identifiers to infer IR, depth or emitter control. Unknown is distinct from absent or unsupported. Camera-only use requires no source group or extra sensor.
- Watchglass's image-signal sampler reuses a supplied grayscale plane. Its initial versioned policy uses at most 256 stratified samples, configurable up to 4,096. Luminance, contrast, clipping and detail proxies describe only their explicit whole-frame or supplied-region scope; they do not identify a hand or establish lighting/blur as a cause.
- Reach's rolling health policy uses capture-time evidence with a 6-second window, at least 1.2 seconds of evidence and a bounded 1,800 samples. Gaps over 300 ms contribute no continuous evidence. The initial loss/recovery bands are 60% lost and 80% usable, with 2 seconds of sustained recovery. Display expiry alone cannot reset recovery. Distinct actual captures determine cadence; long gaps remain in its denominator. Late captures and fresh but rejected observations have separate denominators. Subject measurements support qualified hypotheses; dark backgrounds and no-hand results alone cannot establish bad hand lighting.
- Processing pressure is measured independently of the requested cap. Initial guards include capture-to-result delay at 80% of the unchanged 150 ms limit, more than 32 ms on the main thread, the existing adaptive duty budget and timer lateness. A steady adaptive rate below a nominal 60 Hz ceiling is not by itself hardware failure. A 5 Hz administrative cap cannot hide a 121 ms model delay.
- The assistance planner requires current authorized capabilities, a compatible perception profile and unchanged primary geometry. Its initial configurable trial policy has a 3-second request timeout, 8-second trial deadline, at least 2 seconds of trial evidence, at least 15 percentage points of usable-evidence improvement, 80% retained usable coverage and 80% retained actual capture cadence. Conflict, contrary-gesture, rejected-observation, stale and processing-pressure fractions cannot increase. These checks continue after promotion. Missing assisted evidence expires after 1.5 seconds; a late result cannot renew that deadline. A failed trial backs off for 30 seconds, with at most three trials per source context. Assisted tracking does not prove baseline recovery; returning requires separate sustained baseline evidence.
- A same-camera browser executor can trial reported exposure compensation or continuous exposure on the existing authorized live track. Compensation moves by at most 15% of its actual supported range and honors its actual step. It preserves unrelated constraints and exact negotiated geometry, verifies application, and restores original settings/constraints when the trial fails, ends or loses authorization. A failed restoration stops that session with a persistent explanation. It opens no extra camera and never controls an inferred IR emitter. Under pressure, a neutral same-camera adjustment is eligible only without worsening measured pressure; extra processing is excluded.

These defaults are versioned policy inputs, not device-name branches or required sensor formats. The health and planner modules never authorize a pointer, mutate a calibration, acquire hardware or weaken held-out validation. The branch runtime now integrates the bounded same-camera exposure trial and local diagnostics; supplementary native provider execution remains development work. Global feature/rate controls still apply. A cold acquisition failure without a trusted subject region supplies only whole-frame measurements and cannot establish a dark hand; the system therefore does not blindly alter exposure from an unknown loss. Exposure support alone does not repair neural acquisition.

The owner's clean 74.001-second RGB recording contained 1,093 empty results among 1,467 raw packets, including an approximately 49.6-second absence. Packet-age P95 was 37.5 ms and maximum 52.9 ms at the saved receive clock. This is evidence of recognition loss rather than justification for weakening freshness.

Direct taps of the unchanged pinned MediaPipe graph found no palm proposal on four selected cold pointing images. Lower thresholds, orientation changes, image crops and a separate holistic model did not establish a reliable fix. Grayscale acquisition increased raw coverage but introduced sampled wrong-digit outputs and is rejected as an automatic rule.

A private source-equivalent graph exactly matches the original public API's 21 image and world coordinates across 12 public control frames. Retaining an actual previous hand region for at most **250 ms** recovered fresh model outputs after one blank frame on two reviewed stills, while blank and expired inputs remained rejected. This retains an inference region, never old landmarks or action eligibility. Continuous motion, source/identity consistency and full-scene acquisition priority remain separate development requirements.

The laptop's native Windows provider probe demonstrated actual simultaneous delivery of RGB **640×480 Bgra8** and IR **640×360 Gray8**. A short observation delivered 13 unique frames from each reader, with roughly **13 Hz** measured source-timestamp rates despite advertised 30 Hz formats. Paired timestamp differences were approximately **7–9.3 ms**. These measurements establish delivery, not calibrated synchronization, optical registration or hand recognition accuracy. No camera intrinsics, coordinate system or depth source was supplied in these probe frames. Infrared torch control reported unsupported in the probed SharedReadOnly context, including the per-source IR controller; no illumination writes were performed. All readers were released and no pixels, audio or device identifiers were persisted.

This is a private native harness result. Ordinary Edge does not yet have the product's native frame bridge installed or integrated. SharedReadOnly processing/delivery caps do not change the sensor's physical format rate. A separate bounded ExclusiveControl query on the IR source also returned unsupported standard torch control after startup, without setting writes; this does not establish that every vendor-specific control is absent. Production transport must preserve exact-origin authorization, local frame privacy, resource ownership and the browser's real local-network permission requirements.

On iPhone, native AVFoundation can supply synchronized TrueDepth color and depth. The current Safari preview does not provide that native capture path. Native installation/signing and physical testing remain required before claiming iPhone assistance works.

## Verification and delivery boundaries

Focused development must cover denied/busy/unknown hardware, current and stale frames, source and clock mismatches, registration absence, sensor removal, restart generations, late callbacks, hidden-page release, unsupported illumination, trial failure and recovery without repeated setup loss. Perception proof must include good lighting, poor lighting, clipped hands, camera-facing fingers, motion, duplicate hypotheses, open palms and wrong-digit negatives. A fixture pass and a native frame-arrival count do not establish physical pointer accuracy.

The working previews remain isolated from Crossdeck, Sounding Line repairs and the NCL worktree. No full or protected qualification is authorized for this development. Completed implementation, controlled browser proof, physical hardware findings and owner acceptance will be recorded separately in the final comparison with main.

## Primary implementation references

- [Windows media frame sources and readers](https://learn.microsoft.com/en-us/windows/apps/develop/camera/process-media-frames-with-mediaframereader)
- [Windows infrared torch controls](https://learn.microsoft.com/en-us/uwp/api/windows.media.devices.infraredtorchcontrol)
- [MediaPipe v0.10.32 hand acquisition graph](https://github.com/google-ai-edge/mediapipe/blob/v0.10.32/mediapipe/tasks/cc/vision/hand_landmarker/hand_landmarker_graph.cc)
- [Apple TrueDepth streaming example](https://developer.apple.com/documentation/avfoundation/streaming-depth-data-from-the-truedepth-camera)
