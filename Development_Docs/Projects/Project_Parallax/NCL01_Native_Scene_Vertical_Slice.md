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
node ancestry, geometry orientation and deferred-stage cancellation.

The first hosted development run,
[38798660744](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38798660744),
failed before executing tests because a Swift transform dictionary and matrix
shared a local variable name. The narrow correction is commit
`e25c0ee59fc7331bd66648549d968ff98f99b02a`; fresh hosted run
[38800480310](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38800480310)
passed on an iOS 26.5 iPhone 17e Simulator: 24 tests passed, none failed and one
canonical-scenario UI test was expected to skip in companion-only scope. All four
new NCL methods individually succeeded, including actual GLTFKit2 geometry and
material loading. The permission-denied-native scenario passed with zero
progression events. Owned simulator/server and transport-branch cleanup passed.
[The source-bound receipt](evidence/ncl01-20261015/ios-hosted-38800480310.receipt.json)
links compact original proof; raw xcresult and logs remain in owned task storage.
The two separate presentation tests were excluded. The failed first result and
original diagnostics remain evidence; zero executed tests are not a passing test
result. Simulator geometry import does not establish rendered or physical AR.

Android's additional camera-free instrumentation fixture uses the production
Filament owner to load the original GLBs, validate native graph/material/bounds,
apply the entity transform, read real rendered pixels and verify clear/disposal.
The updated test APK compiled successfully; the production APK digest is unchanged.
[Its build receipt](evidence/ncl01-20261015/android-filament-build.json) binds
source checkpoint `adc0e2c87f07aca1fc136dbdf0114e2e575b12ec`.
[Hosted Android run 38802889231](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38802889231)
built both packages but failed after emulator boot. The emulator became
unreachable; the original collector retained no instrumentation output, so the
actual failing command and renderer execution are unknown. Emulator cleanup
failed, while exact-source binding and owned transport-branch cleanup passed.
[The failed receipt](evidence/ncl01-20261015/android-hosted-38802889231/receipt.json)
preserves that result without inferring an OOM or renderer cause.

A narrow collector repair retains stage-labelled failures, bounded original
stdout/stderr and fixed device/host observations before cleanup. Pass predicates,
thresholds and command timeouts are unchanged. Focused TypeScript, formatting,
the actual bounded-output probe and independent review passed. Fresh
[run 38804690428](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38804690428)
tests checkpoint `c282137ff0ff1343ec9fa71c06ee6aea32718c34`; it is pending.
Assertions in compiled code remain separate from GPU execution evidence.

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

The isolated laptop HTTPS preview now serves the actual app using a separate
synthetic database and released chest/compass scene. Trusted task-CA TLS 1.3
probes returned 200 for home/sign-in and the correct canonical sign-in redirect
for Player, including a spoofed-forwarding-header probe. Bootstrap allow/deny
checks passed. Browser trust and phone reachability remain separate checks.
Independent helper review found and confirmed repairs for Windows private-file
ACLs and Secure cookie attributes on the HTTPS relay. Test credentials and keys
remain outside Git; no system trust or firewall settings were changed.

An actual browser attempt found that early submission before hydration used a
native GET because the existing account form omitted its method. Only the
synthetic credential was used; it was rotated through the canonical reset path,
and affected private diagnostics were excluded from publication. The form now
declares POST. A JavaScript-disabled browser intercepted and aborted a native
POST with invented values, proving no credential query fields without mutating
the server. The hydrated canonical sign-in POST then returned 200. Existing
account lifecycle regression tests passed 12/12. Product feature/status and account
guidance review requires no capability promotion or new workflow for this bug fix.

Actual authenticated desktop and emulated-mobile Guided journeys passed for the
same released clue: both original assets were authorized and digest-verified,
stale revisions returned 404, and Inspect receipts matched persisted canonical
observations. Voyage sequence, active block, status, variables, inventory and
progression event identities remained unchanged. Close restored Journal focus;
reopen restored both objects. The captures use the actual loopback HTTP app:
default browser trust rejected the private test CA, so no browser TLS or physical
iPhone result is inferred from them.

Rendered review found Journal heading/paragraph styles overriding the parchment
card text. Scoped colors repaired heading/body contrast to at least 8.539:1 and
small-label contrast to at least 4.922:1 across both gradient endpoints. An
independent review then requested a persistent mobile Close control. The repaired
header remains visible and directly clickable at maximum dialog scroll on mobile
and compact desktop; a targeted actual check and independent re-review passed.
[The final Guided review](evidence/ncl01-20261015/guided-independent-review.final.json)
binds the full journey, original captures, sanitized traces and targeted repair
evidence. It is supporting rendered evidence, not formal Product Experience approval.

The owner confirmed no companion is installed, no Apple Developer setup exists,
and borrowing a Mac is undesirable. Hosted compilation continues independently;
native iPhone installation and physical testing remain pending. The
[owned preview operations](../../../.agents/ncl01-local-preview.md) preserve
the exact runtime setup and signing boundary.

The ordinary experience-plan command currently fails with
`PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity`.
This existing integration prerequisite is retained. Supporting source/build or
Guided browser evidence does not qualify protected integration. No final
Sounding Line authority or merge has been attempted for this partial candidate.

The first milestone is incomplete until the owner can test the same released
clue in both native companions with physical-device evidence. Feature Catalog
requires no capability promotion for this partial candidate.
