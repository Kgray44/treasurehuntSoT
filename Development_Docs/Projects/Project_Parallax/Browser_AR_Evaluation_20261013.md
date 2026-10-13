---
title: Browser-first Chronicle Lens tracking and licensing evaluation
audience: engineering
status: active
canonical_for: parallax-browser-ar-evaluation-20261013
last_reviewed: 2026-10-13
---

# Browser-first objective

Owner target is iPhone 17 Pro/Safari on the Windows computer's Wi-Fi, without a native companion. Browser camera plus genuine translation/orientation tracking, canonical entity rendering, room alignment, confidence/recovery/recalibration, Crossdeck pairing and trusted HTTPS remain required. Guided is an explicit fallback. Marker, image-target, orientation-only and GPS methods cannot discharge world tracking. Software/rendered proof is separate from physical anchoring and owner acceptance.

## Engine decision and licensing hold

No 8th Wall proprietary SLAM binary has been downloaded, installed, vendored, bundled, deployed or used. The [official engine distribution page](https://8thwall.org/docs/open-source) distinguishes its MIT framework (without SLAM) from its distributed binary. The [binary agreement](https://github.com/8thwall/engine/blob/main/LICENSE) grants original-form application distribution but imposes commercialization/substantial-dependence and competitive-product restrictions, prohibits modification/reverse engineering, requires attribution and permits termination. It remains NOT CLEARED for Voyagewright's current/future reusable Spatial Studio, AR authoring and community-distributed experiences. The exact unresolved questions are whether paid spatial authoring/experiences derive substantial value from the engine, whether reusable AR tooling is considered substantially similar/competitive, how platform/community redistribution is permitted, and what continuity exists after license termination. Only explicit owner authorization and appropriate clarification can lift this hold. No restricted source or binary is used to develop a tracking implementation.

## Permissive candidates first

- ReactVision `@reactvision/viro-web-renderer`1.0.1: published package declares MIT and its third-party notice explicitly says bundled tinyvio tracking is MIT, without third-party core code. Published tarball integrity was checked and unpacked only under ignored `tmp/browser-slam-evaluation`; no dependency is installed/adopted yet. Tracker sidecars are 42,383-byte JS and265,734-byte WASM. Evaluate the tracker independently of its separate renderer, retaining the existing Three.js/Parallax asset path. Public tinyvio repository currently returns404, so source availability, standalone version/provenance and future engine maintenance remain unresolved; a MIT label is not a device-performance qualification. Full vs rotation-only/no-scale confidence must remain truthful. The package documents single-threaded HTTPS camera/IMU capture, estimated intrinsics, unsupported lens distortion and calibration assumptions. Assess actual compiled behavior before adoption. [Publisher source](https://github.com/ReactVision/viro-web-renderer), [license](https://github.com/ReactVision/viro-web-renderer/blob/main/LICENSE), [notices](https://github.com/ReactVision/viro-web-renderer/blob/main/THIRD-PARTY-LICENSES.md).
- `kykt35/slam_wasm`, source treee4ebca91cc20c55bd625078311bf3fdde4fd0265: Apache-2.0 project using OpenCV, with public source and bundled WASM. NPM package name currently returns404. Source includes visual feature tracking, triangulated map points and PnP reprojection gating; pose input supplies orientation and acceleration fields are currently unused. Flow-only scale is heuristic, so declared SLAM cannot be assumed metrically calibrated VIO. Complete the source/build/transitive audit and actual pose tests before adoption. Its documented Docker-based build is not introduced for this local setup. [Source](https://github.com/kykt35/slam_wasm).
- AlvaAR is genuine browser visual SLAM but explicitly GPLv3, derived from GPLv3 OV2SLAM/ORB-SLAM2; it is not a permissive drop-in for Voyagewright. No dependency adopted. [Source/license](https://github.com/alanross/AlvaAR).
- stella_vslam's declared BSD license is accompanied by an upstream derivation/license dispute and native/server-hosted viewer design. Neither its declaration nor a WebGL viewer proves independently licensed browser SLAM. Hold while evaluating alternatives; no adoption. [Upstream issue](https://github.com/stella-cv/stella_vslam/issues/249).

## Integration boundaries

A replaceable browser tracking provider yields timestamped camera pose, tracking/confidence kind and sparse surfaces; it never owns authored entities, semantic anchors, room transforms, calibration records or Chronicle progression. The canonical Parallax runtime and evaluator still render released scene entities/animations and admit authored interactions. Camera/motion acquisition is user-initiated, cancelable and cleaned up; lost tracking must not masquerade as a anchored scene or silently substitute Guided. Room alignment stores a canonical transform/scale plus quality/provenance, not vendor map serialization. No camera frames or room photographs go into source fixtures or unrelated cloud services.

The license inventory retains source/version/notice obligations and holds separately from engine feasibility. Production adoption and actual iPhone fidelity remain pending. Continue photo reconstruction, synthetic Chronicle, HTTPS and pairing independently.

The first vendor-independent source seam is `browser-world-tracking.ts`:
ephemeral provider sessions, timestamped live camera poses, explicit tracking
methods/confidence, and canonical three-corner room alignment. Alignment needs
no real measurement, labels relative versus metric tracking scale, rejects
mirrored/inconsistent correspondence, and expires across a new session or
released scene checksum. Three deterministic tests verify the mathematics and
refusal paths. A local-only prototype now connects the seam to the existing camera broker, rear-camera video, motion permission, two-view corner alignment and the normal Lens runtime/Three entity rendering. It is disabled on ordinary servers, authenticated on the explicitly enabled isolated pilot, and never silently substitutes Guided after a browser AR attempt. TinyVIO sidecars stay ignored and are not part of the product distribution. Browser availability, physical fidelity and release acceptance are not established by this prototype.

## Owner source requirement and native Windows rebuild

The owner explicitly selected **prototype only; require rebuildable source for release** for TinyVIO. This supersedes any implication that its MIT package label alone permits product adoption. Its missing core source remains a release hold.

The public [slam_wasm source](https://github.com/kykt35/slam_wasm/tree/e4ebca91cc20c55bd625078311bf3fdde4fd0265) was rebuilt locally on Windows from its pinned source using OpenCV 4.11.0, Emscripten 3.1.74, CMake and Ninja. No Docker or additional runtime service was introduced. OpenCV uses a static, single-threaded SIMD build of core, imgproc, features2d, calib3d, video and its required flann module. Nonfree algorithms and optional external codecs, IPP, OpenCL, ITT, TBB, Eigen and LAPACK are disabled. The official [project license](https://github.com/kykt35/slam_wasm/blob/e4ebca91cc20c55bd625078311bf3fdde4fd0265/LICENSE), [OpenCV license](https://github.com/opencv/opencv/blob/4.11.0/LICENSE) and [Emscripten license](https://github.com/emscripten-core/emscripten/blob/3.1.74/LICENSE) were inspected. This is evaluation, not distribution clearance; linked runtime and header notices still require a complete redistribution audit.

The upstream rebuild produced no fresh mapped PnP pose in the slow-motion synthetic probe. General source experiments corrected map triangulation to use the committed camera baseline, added a bounded initial keyframe for cumulative parallax, and solved already mapped stationary frames. The modified evaluation produced 95 fresh mapped poses in 120 frames, but significant off-axis drift remains. A low reprojection error alone does not prove stable anchoring. These are compiled synthetic algorithm results, without camera acquisition, iPhone performance or physical validation. Translation scale is relative and heuristic; acceleration inputs are reserved and unused. It must not be labeled metric VIO.

The original rebuilt WASM digest is `8418ebd76e3bafd76f27887753b0f87cf71f1620559b861c041865095fcd4e9e`; the current modified experiment digest is `d7e3345662605ef78cdbfb36420c6643ba546558e8b553f6d2eaebf13e41fc75`. Sources, patches, toolchain, logs and artifacts remain outside the repository. No evaluated SLAM binary is bundled in a product release. Loss, blank/static input, rotation, reverse motion, general-scene accuracy, complete transitives and actual Safari testing remain required before adoption.

## Normal Chronicle and phone journey progress

The isolated photographed-room test uses normal Chronicle creation/save, immutable Parallax release/attachment, required Drydock verification, Chronicle publication and One Voyage launch services. The extra development launch controls were removed at owner direction. The ordinary journal opens the released spatial passage and records normal Lens interaction receipts. A loopback phone-sized browser test exercised a browser AR attempt, explicit permission/device failure, explicit Guided recovery and a recorded interaction without page errors. This is dirty development integration evidence, not protected qualification or physical camera proof.

A temporary trusted HTTPS tunnel separately passed normal authenticated Crossdeck registration and a second-browser Chronicle Lens pairing claim. The browser test used a task-local DNS override because Windows system resolution differed from public DNS. It does not establish ordinary iPhone DNS access. Trusted-certificate transport, phone-sized viewport behavior, camera permission, physical tracking, alignment usability and owner acceptance remain separate evidence. The task-owned server remains running where the execution host allows it.
