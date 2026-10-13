---
title: Public-source browser SLAM reproducibility reference
audience: engineering
status: active
canonical_for: parallax-public-source-slam-reference-20261013
last_reviewed: 2026-10-13
---

# Scope

These are engineering reference artifacts for an unadopted tracking candidate,
not a product engine or a physical-device qualification. No binary is included.
The source patch modifies the Apache-2.0 project
[`kykt35/slam_wasm`](https://github.com/kykt35/slam_wasm/tree/e4ebca91cc20c55bd625078311bf3fdde4fd0265)
at `e4ebca91cc20c55bd625078311bf3fdde4fd0265`. The modifications are Voyagewright
evaluation work dated 2026-10-13. Preserve upstream attribution, license and
applicable notices when reproducing or distributing derived source.
The upstream [Apache-2.0 license copy](slam_wasm.LICENSE) accompanies the patch.

## Rebuild

Use a separate checkout, without changing Voyagewright dependencies or starting
another service. Apply `slam_wasm-source-experiment.patch` to the pinned source.
Build with Emscripten 3.1.74, OpenCV 4.11.0
(`31b0eeea0b44b370fd0712312df4214d4ae1b158`), CMake and Ninja. The Windows
evaluation used emsdk source `8f685c26ee9f672081e61e22c6aa60fa972d00a9` and
Ninja package 1.11.1.4. Configure EM_CONFIG, EM_CACHE, PATH and temporary paths
for that process only; do not globally activate the SDK.

Build OpenCV using the Emscripten CMake toolchain, Release, static libraries,
`BUILD_LIST=core,imgproc,features2d,calib3d,video`,
`CMAKE_CXX_FLAGS=-DOPENCV_DISABLE_THREAD_SUPPORT -msimd128`,
`CMAKE_C_FLAGS=-msimd128`, empty CPU_BASELINE/CPU_DISPATCH, nonfree disabled,
and tests/performance tests/examples/apps/Java/Python bindings disabled.
Set WITH_IPP, WITH_OPENCL, WITH_ITT, WITH_TBB, WITH_PTHREADS_PF, WITH_LAPACK,
WITH_EIGEN, WITH_JPEG, WITH_PNG, WITH_TIFF, WITH_WEBP, WITH_OPENEXR,
WITH_PROTOBUF, WITH_ADE and WITH_QUIRC to OFF. Install the resulting libraries
into the isolated SDK directory. The resolved module set adds required FLANN;
the observed link command also includes zlib. Disabled build options alone
must not be interpreted as a complete linked-license inventory.

Configure the patched project's `core` CMake directory with the same toolchain
and compiler flags, OpenCV_DIR pointing to the isolated installed OpenCV CMake
configuration, Release, and the Ninja generator. Build normally. The recorded
experiment's WASM digest is
`36986c605c38e63e791c7f91cd721ced7cd749bfbd538663032d1f1dc2529e12`.
That is an artifact identity, not a promise that a different compiler host or
directory yields a byte-identical build.

## Synthetic probe

Run the repository's `scripts/parallax/probe-public-source-slam.mjs` with
`--dist <isolated compiled dist directory> --output <isolated evidence directory>`.
It loads the specified developer-supplied JS/WASM locally and generates nine
deterministic textured-plane sequences at 320 × 240. No photograph, network
request, API credential, true translation or true depth is supplied to the
tracker. Ground-truth orientation **is supplied**, so this does not verify
camera/sensor orientation acquisition or a standalone visual rotation solver.
The summary pins the actual WASM digest and preserves full frame traces in
the specified output directory.

The engine returns world-to-camera rotation and translation. Compare world
camera centers using `-Rᵀt`, never treat the translation column as camera world
position. Translation scale remains a relative heuristic. Best-fit trajectory
scale is an evaluation normalization; it does not establish metres or AR
alignment accuracy. Turn-only and blank sequences require zero admitted
mapped PnP frames. A returned finite pose or low reprojection error alone is
insufficient evidence.

## Findings and remaining limits

The source experiment carries map-point image correspondences through LK
instead of repeatedly assigning only the nearest projected corner. It also
removes rotation-predicted image flow before admitting translation/bootstrap
parallax, triangulates using the actually committed baseline, and solves
stationary mapped frames against current observations.

[`synthetic-scenarios-36986c60.json`](synthetic-scenarios-36986c60.json) records
the latest compiled run. Blank and turn-only sequences admitted zero mapped
poses; the loss sequence recovered after visual detail returned. The largest
best-fit trajectory RMS across translating scenarios was 0.0432 in arbitrary
synthetic scene units. This small suite does not prove general-scene stability.
The earlier correspondence experiment comparison is preserved separately;
its output hash differs from the latest rotation-compensated experiment.

No release tracker has been adopted. Actual browser execution, normal camera
and motion acquisition, portrait/intrinsics handling, varying light/textures,
larger motion, calibrated room alignment, memory/performance and actual Safari
testing remain open. The full linked/transitive redistribution audit is also
open; see the [inventory](../../evidence/browser-ar-license-inventory-20261013.json)
and [browser evaluation](../../Browser_AR_Evaluation_20261013.md).
