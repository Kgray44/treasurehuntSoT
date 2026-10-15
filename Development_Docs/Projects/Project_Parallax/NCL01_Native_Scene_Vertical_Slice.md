---
title: NCL-01 native Scene vertical slice
audience: engineering
status: implementation-in-progress
canonical_for: parallax-ncl01-native-scene-evidence
last_reviewed: 2026-10-15
---

# NCL-01 native Scene vertical slice

NCL-01 extends the existing Landfall companions with one canonical Parallax
Scene delivery and original SC02 3D assets. This record is engineering evidence;
it does not grant protected integration, physical qualification or owner acceptance.

Protected source baseline is `73ed4b380c764c32ee35f40e4dad7dfddbbb7e58`.
The owned implementation branch is `codex/parallax-ncl01`.

## Source identity and compatibility

Catalog and element schemas, manifest, licenses and original GLBs are reused
byte-for-byte from SC02 `73db990b554e2236df7bbda4286f5b8023a3636f`.
The immutable Environment pin uses SC07A
`df5b7fcb8e8c8ea13fc569fa5a95d609fbeeacb0`'s exact reference schema.
The larger active SC01/SC02/browser/Crossdeck candidates are not absorbed or
qualified by this source reuse.

| Original model |  Bytes | SHA-256                                                            | Authored width |
| -------------- | -----: | ------------------------------------------------------------------ | -------------: |
| Treasure chest | 630120 | `2e31b5eed11242e583cfc99a5491ff2e4b10dec0d4fed5d90dffe1ccab122e6f` |          0.8 m |
| Brass compass  | 313396 | `5af1158b1a7f2b3339c159fbdca8b9d3d29020eaa06d41848bf5c04c0a682ccb` |         0.16 m |

Both original GLBs use meters, +Y up, +Z front and a bottom-center pivot.
The outer entity scale is `resolved.scale * widthMeters / sourceWidthMeters`;
the embedded node transforms and glTF metallic/roughness materials are retained.
Neither recentering nor a second authored model is introduced.

The bounded chunk transport retains its v1 protocol and 16 KiB message bound.
Negotiated delivery v2 carries Scene and optional Environment revision identity,
hierarchy, authored and resolved transforms, interaction and visibility state,
canonical SC02 elements and existing Studio behavior/asset descriptors, supported
capability requirements and the authored Guided fallback. Model bytes travel
through a separate authenticated GET. A commit waits for asset staging/activation,
with a separate bounded activation timeout.

## Asset and authority boundary

The Player asset endpoint uses the current account/membership and immutable
released passage, validates the requested Scene checksum and authored model,
and verifies allowlisted repository bytes before delivery. Redirects and external
GLB resources are refused by native loaders. Foreground sessions reauthorize;
private session caches and pending loaders are torn down when the Lens closes.
Original built-in catalog files remain public static assets, as on the source
SC02 branch. The route protects released-passage association; it does not make
the original catalog confidential.

Native selection must hit the actual model graph and respect entity interaction
and visibility. The existing `ParallaxLensRuntime.interact` and Player receipt
endpoint retain observation authority. A tap or successful load does not advance
One Voyage or create a second account/session.

## Verification and remaining acceptance

The final focused TypeScript regression run passed 125 tests across 11 files,
including shared v1/v2 transport, asset authorization, actual compass GLTF graph
loading, PBR/pivot/scale, mesh picking, delayed behavior catch-up, serialized
rendering and close/reopen isolation. Native Android JVM checks passed 167 v1
and 45 v2 assertions. The Android app and instrumentation APKs compiled with
Gradle 8.11.1, compileSdk 36 and pinned Filament 1.75.1. Instrumentation was
compiled, not executed on a device. [The build receipt](evidence/ncl01-20261015/android-build.json),
[source manifest](evidence/ncl01-20261015/android-source-manifest.json) and
[original build log](evidence/ncl01-20261015/android-build.original.log) preserve
the exact inputs and package digests.

Independent source review identified and confirmed repairs for strict Android
discovery fields, shared surface-frame orientation and staged activation aborts.
Only legacy quad geometry receives the v2 surface correction; Scene and model
frames remain canonical. A matching staged abort terminates its owned provider;
stale aborts and late callbacks cannot revive a canceled scene. HIGHLIGHT remains
an explicit unsupported requirement. Source review reported no remaining
actionable finding; it does not establish rendered or physical acceptance.

iOS uses pinned GLTFKit2 revision
`e69e354c4f31ea07b7816b8cbe2ddb28e897d073` and retains SceneKit. Four added
XCTest methods cover original model loading, shared boundary fixtures, actual
node ancestry, geometry orientation and deferred-stage cancellation. Hosted
macOS compilation and XCTest are pending.

The browser graph presenter consumes v2 and the same verified GLB, attaching
to an existing renderer/camera. Integration with the active browser provider
candidate remains a separate source-bound step; a parsed graph is not browser AR.

Physical ARKit/ARCore world anchoring, actual tracking recovery, frame/memory/
thermal/battery measurements, registration error/drift and resource release on
real devices remain pending. Unsupported effects, imported media, nonzero
articulation and element playback require Guided View. Depth occlusion,
RoomPlan/reconstruction ingestion, shared spatial anchors and production signed
distribution are later validated increments. Existing semantic Environment
construction remains the room-data authority.

The owner confirmed that the test server will run on the laptop, an iPhone 17 Pro
is available, and no physical Android device is available. Prepare an isolated
HTTPS laptop runtime and a signed native iPhone installation path before physical
review. Android physical acceptance is unavailable until a device is supplied;
compilation and virtualization cannot close that gate. The default Android test
APK deliberately has no origin configured; an owner build requires
`-PlandfallOrigin=https://<authorized-laptop-origin>`.

The first milestone is incomplete until the owner can test the same released
clue in both native companions with physical-device evidence. Feature Catalog
requires no capability promotion for this partial candidate.
