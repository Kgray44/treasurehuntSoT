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
Gradle 8.11.1, compileSdk 36 and pinned Filament 1.75.1. Those initial build
receipts establish compilation; hosted execution attempts are recorded below.
[The build receipt](evidence/ncl01-20261015/android-build.json),
[source manifest](evidence/ncl01-20261015/android-source-manifest.json) and
[original build log](evidence/ncl01-20261015/android-build.original.log) preserve
the exact inputs and package digests.

The complete project TypeScript check passed again at
`b328c49a69b7179c54b0dd0608aba65ded6c368d`.
[Its receipt](evidence/ncl01-20261015/software-checkpoint-b328c49.verification.json)
binds the original log and source manifest; shared delivery and asset sources
remain unchanged since the 125-test regression checkpoint.
The project check also passed after the graphics tooling checkpoint;
[its source-delta receipt](evidence/ncl01-20261015/software-checkpoint-d3c8d45.verification.json)
binds the original log and verifies native-source equality with the separate
iOS and Android hosted candidates.

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
[A separate raster-proof audit](evidence/ncl01-20261015/ios-raster-proof-audit.json)
found that SceneKit can provide a bounded offscreen fixture, but the standard
hosted runner has no recorded Metal-device or completed-target probe. GPU
availability remains unknown. No extra raster test or rendered-pixel claim was
added on the basis of successful graph import.

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
the actual bounded-output probe and independent review passed.
[run 38804690428](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38804690428)
tested checkpoint `c282137ff0ff1343ec9fa71c06ee6aea32718c34` and failed during
instrumentation with adb exit 255. Seven tests completed before the real Filament
test started; that test has no completion result. The emulator was offline and
its process was absent at failure collection. The observations do not establish
an OOM or graphics-driver cause. Emulator cleanup failed; owned transport cleanup
passed. [The original failure evidence](evidence/ncl01-20261015/android-hosted-38804690428/receipt.json)
retains the untruncated command output and bounded host/device observations.

Checkpoint `49cdd3abf9b8be0e3dc807437f07848de64a17f7` adds a bounded live phase
log around the existing Filament assertions and uses the documented `swiftshader`
backend in place of deprecated `swiftshader_indirect`. This environment correction
does not establish the previous failure's cause. Pass thresholds and deadlines
are unchanged. Fresh
[run 38807430763](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38807430763)
failed after completing the compass load and submitting its rendered frame and
pixel-readback request. The final phase was `READBACK_FLUSH_BEGIN`; no flush
completion or pixel callback was observed before the emulator disappeared.
Both instrumentation and its owned logger exited 255 without a timeout. Seven
earlier tests passed. This establishes model loading and narrows the interruption
to queued rendering/readback; rasterized pixels and disposal remain unproved.
[The source-bound receipt](evidence/ncl01-20261015/android-hosted-38807430763/receipt.json)
includes the original live phases, local build/probe proof and failure observations.
Assertions in compiled code remain separate from GPU execution evidence.

Independent review then identified an unbounded fixture wait: the no-argument
`Engine.flushAndWait()` blocks its UI owner before the callback deadline can run.
Checkpoint `46a20fc1940d7c1fd01275dd8e7163281a42e998` uses documented
asynchronous readback completion and normal frames, requiring the callback's
monotonic timestamp to fall within the existing single 10-second deadline.
Independent review and app/test APK compilation passed. This preserves all
pixel, clear and disposal assertions; fresh hosted
[run 38809404999](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38809404999)
also lost the emulator after queuing readback. Its last phase was
`READBACK_FRAME_ENDED`, with no callback or subsequent frame-pump phase. Both
instrumentation and its logger exited 255. The fixture correction does not
establish or resolve the emulator failure's cause; pixel and disposal proof
remain unavailable.
[The fourth receipt](evidence/ncl01-20261015/android-hosted-38809404999/receipt.json)
preserves original build, phase and failure evidence. Emulator cleanup failed;
owned logger closure and transport cleanup passed.
The production surface-release wait follows Filament's ordering requirement and
remains unchanged; stalled-GPU cleanup is not claimed.
Read-only local fallback checks found Windows Hypervisor Platform disabled and
no emulator/image in the task-owned SDK. No system feature, driver or reboot was
used to prepare a local emulator.

Tooling checkpoint `d3c8d457aee9edad3e485fdee737ca6c7a1a8d63` enables one explicit
development-only `swangle` comparison against the same native candidate
`46a20fc1940d7c1fd01275dd8e7163281a42e998`. Normal defaults and all 16 native
test assertions remain unchanged. The diagnostic is restricted to Android's
primary-phone profile, carries `authoritative: false`, and binds the generated
workflow digest at dispatch and harvest. Protected tiers cannot select it.
Ten focused tests, strict focused TypeScript, lint, formatting and independent
source review passed. The
[comparison run](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38812890616)
passed all 16 instrumentation tests. Actual startup observations confirm emulator
37.2.12 with GLES `swangle` and ANGLE over Vulkan SwiftShader. The compass rendered
4,386 nontransparent pixels and the chest 10,976; each cleared frame contained
zero model pixels. Original bounds, bottom pivot and entity transform checks
passed, and both assets and the engine were disposed. The separate canonical
permission-denied scenario recorded zero progression events; all owned cleanup
passed. [The diagnostic receipt](evidence/ncl01-20261015/android-hosted-38812890616/receipt.json)
retains its non-authoritative scope and original evidence. This does not establish
a cause for earlier emulator exits or grant protected qualification.

The narrow default correction is checkpoint
`53f5bb19262c1b2e0547396f6a7b696c8e0a6442`: only the main Android job changes
to the demonstrated `swangle` backend; other jobs, native code and budgets retain
their existing behavior. Tests preserve the historical direct-SwiftShader
comparison and current ordinary omission semantics. Independent review, ten
focused tests, lint, formatting and full project TypeScript passed. Fresh ordinary
[development run 38814461791](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38814461791)
passed all 16 instrumentation tests in 69.657 seconds, using no override or
`graphicsProbe` metadata. Actual startup observations confirm the main job's
SWANGLE backend. The compass rendered 4,386 model pixels and the chest 10,976;
both cleared frames contained zero model pixels. Original pivot/bounds and
entity transforms passed, and assets and the engine were disposed. The separate
five-step canonical permission-denied scenario passed with zero progression
events. All owned native, scenario/server and transport cleanup passed.
[The ordinary development receipt](evidence/ncl01-20261015/android-hosted-38814461791/receipt.json)
binds source, generated workflow, actual per-run APK digests and original proof.
Three emulated two-second sensor samples recorded CPU time of 11/7/6 ms and PSS
of 93,739/93,650/93,433 KiB; these are emulator observations, not physical-device
performance or thermal qualification. Candidate/closure matrices and physical
devices still require their separate governed qualification.
[The final software-checkpoint receipt](evidence/ncl01-20261015/software-checkpoint-53f5bb1.verification.json)
binds the original TypeScript log, the two changed tooling files and native/shared
source equality with the separate hosted candidates.

The browser graph presenter consumes v2 and the same verified GLB, attaching
to an existing renderer/camera. Integration with the active browser provider
candidate remains a separate source-bound step; a parsed graph is not browser AR.
[Read-only integration review](evidence/ncl01-20261015/browser-integration-audit.json)
located that provider at
`8d00278d1fb8f2ff1cab051c3cf9a4329df9d499`, outside this worktree's baseline.
It brings browser receipt semantics, camera reservations, SDK authorization and
room registration. Its registration-based placement does not advertise plane
placement, while the current v2 surface-anchor contract requires that capability.
Integration must resolve this distinction and use the provider's existing scene,
camera, tracking and pointer ownership. Copying its adapter alone is insufficient.

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

[A live HTTPS asset probe](evidence/ncl01-20261015/local-https-assets.json)
passed 11 checks using explicit task-CA trust and ordinary hostname validation.
Both original model bodies matched their exact lengths and SHA-256 digests;
unauthenticated requests returned 401 and stale revisions returned 404. The
Scene checksum was unchanged before and after. The probe signed out only its
new synthetic session and verified that the revoked cookie then returned 401.
No auth bodies or headers were published. This is Node TLS 1.3 transport proof,
separate from phone, WebKit and native downloader validation.

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

The native downloader now declares its local-network purpose and waits for
connectivity within a 45-second resource deadline, inside the existing 55-second
activation limit. Normal TLS validation, origin checks and cancellation remain
in force. These changes are checkpoint
`b328c49a69b7179c54b0dd0608aba65ded6c368d`; fresh hosted iOS
[run 38807972598](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38807972598)
failed at simulator boot, before compilation or XCTest. Its 420-second boot
deadline expired while CoreLocationMigrator remained in data migration;
`XCRESULT_NOT_CREATED` is retained. Simulator and owned transport cleanup passed.
[The failed receipt](evidence/ncl01-20261015/ios-hosted-38807972598.receipt.json)
binds all original setup, error and cleanup artifacts with no executed-test claim.
The unchanged-candidate
[retry](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38810163899)
passed 24 XCTest methods with zero failures and one documented expected skip.
All four NCL methods succeeded, including the extended local-network
configuration assertions. The separate permission-denied-native scenario passed
against real canonical SQLite with zero progression events or block completions.
Simulator, scenario/server and owned transport cleanup passed with no remaining
resources. [The fresh receipt](evidence/ncl01-20261015/ios-hosted-38810163899.receipt.json)
binds the nine compact originals and source identity. Simulator success cannot
validate the physical local-network prompt.
The owner deferred the phone reachability check; the isolated preview remains
available without claiming that the iPhone can reach or trust it.

## Bounded iOS raster follow-up

Checkpoint `2b89eda7d03c991ada9e2000d9a73c0ed3f580e3` expands the existing
camera-free catalog test with actual Simulator Metal preflight and asynchronous
SceneKit target readback. The production clone/sanitize, width normalization and
relative entity-root calculations are extracted without changing their expressions.
The fixture supplies a nonidentity rigid frame, camera and lighting; it does not
exercise `activate`, create an ARSession or establish physical anchoring.

The original 27 declarations, companion-only 24-pass requirement, expected
canonical-driver skip and single 20-second fixture deadline remain unchanged.
Exact model bytes, child matrices/material objects, authored bounds/bottom pivot,
relative transforms, shaded pixels and empty/removed frames are asserted. PNG
and JSON attachments are retained on success or failure. Publication is sealed
against late callbacks; in-flight owners survive until GPU completion. Independent
source review passed. Ordinary
[development run 38817044787](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38817044787)
compiled and executed XCTest: 23 passed, one failed and one expected skip. The
catalog method failed because its removed-model frame retained pixels. Actual
Simulator Metal preflight passed, including expected readable BGRA clear bytes.
The chest's empty/populated/removed frames contained 0/8,301/8,301 nontransparent
pixels; the latter two PNGs are byte-identical. GPU callbacks and sealed proof
were within 3.711 seconds. There are no compass frames and the canonical scenario
was skipped after the build/test step failed. This is partial raster evidence;
the complete catalog/clear proof remains unaccepted.
[The failed receipt](evidence/ncl01-20261015/ios-hosted-38817044787.receipt.json)
preserves original frames, report, test results and cleanup.
The historical raster feasibility audit is unchanged. This follow-up can observe
Simulator Metal directly; a separate host Metal probe has not been performed.

The fixture was mutating its graph on a private serial queue without a run loop
and rendering every frame at timestamp zero. Apple documents that
[automatic transactions need an explicit flush without a run loop](<https://developer.apple.com/documentation/scenekit/scntransaction/flush()>)
and that [the renderer updates its presentation hierarchy at the supplied system timestamp](<https://developer.apple.com/documentation/scenekit/scnrenderer/render(attime:viewport:commandbuffer:passdescriptor:)>).
The bounded fixture correction flushes that transaction before each frame, uses
actual monotonic system time and records the render time. It adds no frames,
waits, deadline allowance or weakened assertion. The stale-frame explanation was
an inference; production rendering and ARKit ownership are unchanged.

Fresh [run 38819289805](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38819289805)
from `aecbf27d63aa6c2bf287fc840e679b92600d4ff8` passed 24 tests with zero
failures and the single expected canonical-driver skip. The existing catalog
method succeeded. Six original 256-pixel-square PNGs show chest empty/model/removed
alpha counts of 0/8,301/0 and compass counts of 0/2,509/0. Original geometry,
materials, bounds, bottom pivot, normalization and relative transforms passed.
All six renders record explicit transaction flushes and strictly increasing
system time; GPU callbacks, encoding, completion and sealing finished within
2.258 seconds of the unchanged 20-second deadline. The actual Simulator Metal
preflight passed. CPU scene and fixture owners were released; driver memory
release, host Metal availability and physical AR were not measured.
[The successful receipt](evidence/ncl01-20261015/ios-hosted-38819289805.receipt.json)
binds 22 originals. Independent review verified every digest, decoded all frames
and viewed both populated models; its [source-bound review](evidence/ncl01-20261015/ios-raster-independent-review.final.json)
is preserved. The canonical permission-denied scenario and
all owned cleanup passed with zero progression. The preceding failed receipt
and its identical populated/removed images remain unchanged. Current Android-only
source changes do not alter the tested iOS tree.

## Android production picking follow-up

Checkpoint `2b8809980e3c8d448a9de4739779cd6f5849d39a` extends the existing
camera-free catalog fixture with production GPU picking for distinct authored
entity identities, real background and cleared-scene misses, and four original
RGBA PNG exports checked by the standard decoder. App and test APKs compiled;
the original sixteen instrumentation identities and per-frame ten-second budget
are unchanged. Ordinary
[run 38820573449](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38820573449)
executed all sixteen tests: fifteen passed and the catalog method failed while
selecting a background point outside the union bounds of every nonzero-alpha
pixel. It stopped before any GPU pick or PNG export. The ADB device remained
online and native cleanup passed; the canonical scenario did not execute.
[The failed receipt](evidence/ncl01-20261015/android-hosted-38820573449/receipt.json)
preserves the native assertion and original diagnostics. The raw alpha
distribution was not retained, so its precise cause remains unknown.

Independent review accepted a bounded fixture/collector correction: select a
real 7-by-7 fully transparent background neighborhood and still require the
production GPU callback to return null, without the union-bounds proxy. Opaque
interior hits must still return the exact authored entity. Pixel metrics,
callback counts, clear/disposal checks, native identities, backend and deadlines
are preserved. A new standard-decoded synthetic case spans the full image with
opaque pixels while leaving a valid transparent corner; opaque or alpha-one
contamination at the miss neighborhood is rejected. Fresh hosted execution is
still required for this correction.
[The local verification](evidence/ncl01-20261015/android-background-selection-local-verification.final.json)
binds the exact three reviewed source-file digests, nine passing focused tests,
zero lint findings, full-project TypeScript and both passing APK builds under
the existing bounded D: build configuration.
[Independent source review](evidence/ncl01-20261015/android-background-selection-independent-review.final.json)
accepted the exact correction. These local results do not prove hosted GPU picks.

## Laptop preview physical checkout relocation

The complete stopped checkout was copied to
`D:\CodexWorktrees\parallax-ncl01-physical-20261015\Codex_TreasureHunt`.
All 45,817 regular files (2,877,352,915 bytes), 5,534 directories and the existing
D: artifact-junction topology matched before the registered C: path became an
alias. HEAD, branch, working tree, index and Git administrative paths were
byte-identical across the switch. Shared Git objects, private fixture state and
credentials were preserved. Five restored preview checks passed, including
ordinary certificate/hostname validation over TLS 1.3. The URLs are unchanged;
phone reachability is still owner-deferred.
[The relocation receipt](evidence/ncl01-20261015/checkout-relocation-20261015/receipt.json)
binds original copy logs, manifest hashes, Git snapshots and restored transport.
Automatic approval review blocked removal of the verified original C: duplicate
before execution. That backup remains intact; no disk-space recovery is claimed.

The ordinary experience-plan command currently fails with
`PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity`.
This existing integration prerequisite is retained. Supporting source/build or
Guided browser evidence does not qualify protected integration. No final
Sounding Line authority or merge has been attempted for this partial candidate.

[A current dependency refresh](evidence/ncl01-20261015/crossdeck-design-dependency.current.json)
verified that the existing Crossdeck owner's draft PR721 already defines the
required experience at `19687c12e20ef69e6519903b14e56a145df2d7e7`, including
same-Voyage and same-edition continuity. The immutable registry bytes match Git
blob `eb8324379b3348cacf9e2ecbd592c5899ee5a63b`. That design is outside this
candidate's baseline and remains unmerged. Current consumer authority reserves
its source and bounded qualification to that owner. NCL does not create a parallel
contract, modify that candidate or consume its protected preparation.

The first milestone is incomplete until the owner can test the same released
clue in both native companions with physical-device evidence. Feature Catalog
requires no capability promotion for this partial candidate.
