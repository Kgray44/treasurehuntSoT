---
title: Reach Phase 1 implementation and validation record
audience: product-engineering
status: implementation-pending-qualification
canonical_for: reach-phase1-implementation-validation
last_reviewed: 2026-10-11
---

# Reach Phase 1 — Find the Hand

This owner-directed implementation uses Reach v1.0 Sections 6–11, 19, 24, 26–30, the additive spatial architecture v1.1, Watchglass hand-provider v1.1, Sextant camera/lifecycle v1.1, Sealed Hold calibration/evidence v1.1 and the current Wave 4 manifest. The isolated branch is `feat/reach-phase-1-find-the-hand`, based on `2e367c372a6d44e4e6a68bb38266196954f8d486`. Phase 2 has not begun. This is an implementation/qualification record, not a completion receipt.

## Launch and source binding

Native implementation task `01a12883-5c57-77bd-8a5d-8dd5a9c7103b` was verified as a Codex task with the delivered complete contract. Reconciliation marker: `ld-Sentinel_6845783f9a2481918bfde3e76cc12eca-reach-p1`. The native readback returned projectId null; association with the requested VoyageWright project `fd21b701-3215-417a-a413-0a17e02badbb` could not be confirmed, and the available move operation could not bind this execution host. No native Goal persistence capability was exposed. Prompt delivery is verified separately from those unsupported metadata operations. No duplicate task was dispatched.

Draft [PR #697](https://github.com/Kgray44/treasurehuntSoT/pull/697) contains the implementation and lifecycle corrections. Remote readback confirmed implementation head `b5a1065fc0aeb617b85441583d9753fb9d91868c` before this record update. The native PR attachment was attempted, but the Codex app connection returned `Transport closed`; attachment is unconfirmed. The PR remains draft and has not been qualified or merged.

Project Trim was applied through current isolated-source authority, a Phase 1 contract and explicit scope/evidence limits. No token-savings figure is asserted. The shared source checkout and unmerged sibling source were not consumed or edited.

## Scope and boundaries

`/devices/reach` hosts the browser laboratory, reachable from Device connections. The broker in `src/sextant/camera.ts` exclusively owns acquisition, tracks and generation boundaries. Watchglass owns the schema in `src/watchglass/hand-observation.ts` and the adapter in `src/watchglass/hand-provider.ts`; the live provider uses the governed `watchglass.hand-observation` identity. Reach consumes that contract, validates freshness/bindings, derives declared index-axis features, fits calibration and presents diagnostic estimates. There are no selection, activation, manipulation, handoff or progression writers.

Model inference runs in a same-origin classic worker. MediaPipe Tasks Vision 0.10.32 uses the CPU/WASM backend and the version-1 float16 hand model. Runtime/model assets are checked into `public/reach/vendor`; the asset manifest binds bytes, SHA-256, source URLs and license. The model digest is checked before initialization. No CDN dependency exists at run time. Browser caching is ordinary HTTP caching; offline availability is not promised.

The provider exposes at most two hands and accepts only one usable pointing candidate. Missing/occluded/multiple hands abstain. Presence and tracking scores are unavailable in the public result and remain null; handedness scores never become intent probabilities. World landmarks are omitted rather than relabeled as metric camera/display coordinates. Conservative continuity may require recalibration after hand loss or a large jump. Gloves, occlusion, motion blur, poor illumination and camera movement remain limitations.

## Frozen protocol v1

The automated browser configuration is Windows, Playwright 1.56.1 Chromium 141.0.7390.37, CPU/WASM, 640×480 emulated camera input, and a 1280×1400 CSS viewport for calibration. This is D1 software evidence, not a supported physical accuracy configuration. WebGPU, other browser engines, mobile and a native companion are unqualified.

The physical reference matrix is **not yet qualified**. A default-browser camera probe without fake-camera flags enumerated one input but acquisition failed with `ERROR`, zero active video tracks and detached preview after stop. Its physical provenance is unverified. No participant, hand geometry, camera-placement or viewing-distance result is fabricated. A usable consented camera and independent participant trials are required before closing Phase 1's physical gate.

Calibration layout v1 has nine distributed training targets at normalized 0.1/0.5/0.9 coordinates and five distinct held-out targets in randomized order. Each target requires at least fifteen observations spanning 600 ms, no gap above 150 ms, bounded feature spread and unchanged bindings. The current collector uses a 30-sample window and a 1.5 s settling interval between dots. These are configured values, not measured ergonomic achievements. The affine index-axis fit uses ridge regularization 0.001; unstable groups are rejected before fitting. A failed held-out p95 above the governing 3% diagonal gate remains unavailable. Error uses actual CSS plane width and height divided by that plane's diagonal. Empirical uncertainty is reported in CSS pixels, not as a statistical intent probability. Coverage is restricted to the sampled 0.1–0.9 region and bounded feature domain; no confident extrapolation or snapping hides failed fits.

Calibration is session-local, expires after 30 minutes and is invalidated by camera/model/provider/hand/mirror/orientation/viewport changes. Camera pose drift that cannot be observed requires the visible recalibration control. Scrolling or zooming during calibration conservatively invalidates it. There is no persistence, synchronization, recording or footage export. Optional aggregate export requires separate consent and excludes landmarks, coefficients, camera identifiers and hand identifiers.

Filtering uses a velocity-adaptive low-pass cutoff of 2 Hz plus gain 12, with velocity capped at 3 normalized units/s. Jumps above 0.35 are rejected before filtering; gaps above 150 ms reset it. Settling, lag, jitter and physical accuracy remain unmeasured. Render/worker times alone will not be substituted for exposure-to-visible latency. Section 27 thresholds remain unchanged, including 120 ms p95 latency, 1% diagonal p95 jitter, and later-phase 600 no-action opportunities.

## Requirement-to-evidence mapping

| Requirement                            | Implementation and focused proof                                                                                             | Acceptance limit                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Permission, lease and teardown         | Camera broker; permission/lease and privacy oracles; emulated worker/browser cleanup                                         | Real camera acquisition failed; physical cleanup trials pending         |
| Versioned observations and quality     | Strict finite-value schema, binding/freshness/sequence gate, conservative Watchglass adapter                                 | Observation fidelity and lighting/occlusion trials pending              |
| Coordinates and epochs                 | Explicit unmirrored image frame, preview-only mirror, CSS-space transform, viewport invalidation oracle                      | Physical display geometry not inferred; laboratory plane only           |
| Calibration and independent validation | Nine-target regularized fit, distinct held-out set, repeated stability window; leakage/failure/expiry/drift tests            | D0/D1 results cannot qualify human pointing                             |
| Bounded browser runtime                | One transferred frame in flight, no backlog, provider generations, startup/inference timeouts, hide/freeze/pagehide teardown | Other backends/browsers and physical throughput pending                 |
| Laboratory/accessibility/privacy       | Conventional buttons/sliders, visible synthetic mode, delete/stop, consented aggregate export, reduced-motion CSS            | Physical assistive/ergonomic trials pending; no site-wide actions       |
| Governed Device Lab                    | Reach owner extension, 17 declarations preserving 55 prior entries, seven executable D0 owner oracles and shared CLI         | Ten later-phase declarations remain non-executable; no fake D4 receipts |

Focused development initially found an invalid orientation schema and corrected it; those failures remain failures. A synthetic browser attempt failed held-out validation at 5.02% p95; the gate rejected it. Subsequent corrections fixed the synthetic input fixture and CSS aspect-ratio metric without changing the 3% gate. Worker trials identified the pinned runtime's classic-loader requirement and missing initialization dispatch; those were corrected before the emulated model-inference trial passed. The original browser attempt also exposed a pre-existing Node-only audit import in Next instrumentation. The runtime-specific dynamic import follows the installed Next.js guide, retains the audit safety check for Node, and restores the route. The shared Device Lab source-identity test now uses a file URL for the Windows ESM loader; it retains its original provenance assertions.

Exact candidate, final focused results, required Sounding Line status, PR identity and integration outcome are recorded below after qualification. No protected merge or landed smoke is claimed until it actually occurs.

## Qualification status

Development evidence: 24 focused Reach/asset/shared Device Lab tests passed before the final startup correction, and both reproduced startup race tests passed after correction. Four Chromium journeys passed before that correction: synthetic fit/held-out validation and export/delete; actual pinned model inference on an emulated stream with suspension/restart cleanup; model unavailability; permission denial/fallback. Final browser confirmation on the frozen candidate remains pending.

Documentation and Feature Catalog validation passed. A light source comparison confirmed all 55 pre-Reach scenario records and all existing suite/contract definitions are unchanged. Private-content staged-diff scanning passed before final light corrections. The ordinary Sounding Line regression had 57 passes and one infrastructure failure when Windows could not start `git init`; this is not recorded as a passing aggregate check. The computer restart interrupted other verification. In-progress typecheck/lint were deliberately stopped to release the parent's shared heavy-testing slot. Source is preserved and only light review/candidate preparation continues until Reach is granted that slot after Sextant, Parallax and Crossdeck.

Light lifecycle review added generation isolation for a late denial and regression cases for stale `ended` callbacks/old lease releases, failed lease construction and a source ending during listener registration. Listener registration cleanup rejects that source without retaining a track or listener. These new tests are pending execution; the five focused files currently declare 30 tests, not 30 verified passes. No interrupted or newly added check is treated as passed. Owner-present physical hand calibration is pending and will not start while the owner is gaming.

Pending final frozen-candidate qualification, source-bound CLI receipts and ordinary protected-main decision. Physical webcam/held-out calibration and owner acceptance remain open. Feature Catalog is unchanged because Phase 1 acceptance is incomplete.

## Technical basis

The [official Web guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js) documents the blocking inference API and worker approach. The [official model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20%28Lite_Full%29%20with%20Fairness%20Oct%202021.pdf) identifies Apache-2.0 licensing and important occlusion/environment limitations. These establish provider semantics and licensing, not Voyagewright accuracy.
