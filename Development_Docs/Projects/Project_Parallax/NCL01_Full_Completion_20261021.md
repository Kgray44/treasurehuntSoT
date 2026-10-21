---
title: NCL-01 full completion working ledger
audience: engineering
status: implementation-in-progress
canonical_for: ncl01-full-completion-20261021
last_reviewed: 2026-10-21
---

# NCL-01 full completion working ledger

This engineering record binds the October 21 unattended completion mission to
the original ten-item contract. It grants no product, physical or protected-main
acceptance. The owner is unavailable; independently attainable work continues.

## Reconciled source

| Source                                        | Exact identity and disposition                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Initial fetched protected main                | `e0056ff3bdc4cb8b69fb6aa66a6dba831e25cdab`                                                      |
| Reconciled protected main                     | `e1a86f98e56d68e8e87e3704d17439489ff1a170`, assembly `9abd26ba892f7715d32601e4d12058eae1acfb4e` |
| Original PR741, open draft                    | `76d1787e1340e396bc95747293d43e57130b00ed`                                                      |
| TestFlight branch                             | `6f4872a5946203b7f0fa4c1eab9546fff1a35646`                                                      |
| Latest approved artwork/TestFlight descendant | `cd597b1274bddad70118b77dd65b13969dd55a8d`                                                      |
| Coherent initial assembly                     | `a8d862680a`, main plus complete TestFlight descendant; no product source conflicts             |
| PR781, proposed governance                    | `182233e0f6d11a5dd5f74f35e01183b633b6ec8f`, open, not accepted                                  |
| Crossdeck PR721                               | `245e5128afa00e6c888818a698ebd37717d81a3d`, open draft, not accepted                            |
| Browser provider branch, unaccepted           | `8d00278d1fb8f2ff1cab051c3cf9a4329df9d499`                                                      |

The original brief's SHA256 is
`5fa3b9bacba83dea8137ca6b18826f8df5cd12c8fbeb17ae23e9d7ded496690e`.
The [native vertical-slice record](NCL01_Native_Scene_Vertical_Slice.md) and
[TestFlight record](NCL01_TestFlight_Deployment.md) retain original receipts.
This task does not rewrite the proposed NCL charter or its author's status record.

The original brief's section 10 defines the ten-item first-model vertical slice
and explicitly defers richer elements/effects/occlusion/scanning/shared anchors
and full presentation to separately validated increments afterward. This
mission implements that bounded contract and truthful capability fallback; it
does not claim that those richer software capabilities are implemented and
merely awaiting physical receipts. The original brief and current owner scope,
not unaccepted PR781, establish this boundary.

## Initial ten-item disposition

| #   | Requirement                      | Initial classification                                   | Existing proof and actual remaining work                                                                                                                                                        |
| --- | -------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Original authored 3D model       | Implemented; further integrated qualification            | Canonical v2 and original SC02 GLBs, native pixels; requalify joined current-source delivery.                                                                                                   |
| 2   | Correct identity and transforms  | Implemented; further qualification                       | Original checksums, hierarchy, metric pivot and native graph fixtures; exercise three entities, updates, hidden/editor-only dependencies and parser edge cases.                                 |
| 3   | iOS native rendering             | Implemented; further qualification                       | Simulator run 38841961822 at 9314c749: actual Metal raster/mesh, 24 passes and one expected driver skip; current joined input, placement guidance and lifecycle need work.                      |
| 4   | Android native rendering         | Implemented; further qualification                       | Run 38833266576 at c2357ffe: 16 passes, original pixels and GPU picks; source unchanged through latest beta. Strict parser, real input/control and joined outcome need work.                    |
| 5   | Physical anchoring               | Software implemented; physical qualification outstanding | Native ARKit/ARCore local/surface sessions. Owner reported iPhone original objects; no independently measured tracking/placement acceptance and no Android hardware.                            |
| 6   | Browser semantic consistency     | Incomplete; accepted-provider/Crossdeck dependency       | Same canonical Scene and Guided semantics exist; graph helper is not live browser provider. Accepted main lacks Scene transfer custody and PR721 remains unmerged.                              |
| 7   | Real native Inspect              | Incomplete                                               | Actual geometry mapper exists. Native content dialog precedes canonical acceptance, whose result is hidden. Join mesh input, authorized outcome, visible Player and same-Voyage return.         |
| 8   | Canonical authority              | Implemented; joined real-database qualification needed   | Existing Parallax observation endpoint owns validation/idempotency and cannot progress. Test stale/revoked/foreign requests and duplicates against disposable actual SQLite.                    |
| 9   | Lifecycle/recovery               | Implemented; additional qualification/repair needed      | Native staging cancellation and close cleanup exist; inspect pending interactions/revocation/background/network. Preserve unknown-cause Home failure 38840109053 and passing replay separately. |
| 10  | Reproducibility and owner review | Incomplete; owner/physical gates external                | Existing native/IPA source-bound receipts retained. Current-source tests/build/browser/security/docs/PR qualification and owner physical handoff remain.                                        |

## Product and security boundaries

Use existing Lens/Player styles and authority. Native Inspect sends an intent;
only a canonical accepted response can display accepted inspection. Pending and
error states must be visible, accessible and cancellable. A selected mesh does
not create progression. Late callbacks cannot revive a closed/revoked Scene.

The classroom reference remains private and unchanged: one middle-table chest
and two side-table compasses, original models, immutable Scene/Environment pin.
Use synthetic three-entity analogues. NCL-01 places the authored relative layout
at an explicit supported local/surface origin; automatic reconstructed-room
registration, semantic recognition and advanced calibration are excluded.

The official logo/AppIcon remains SHA256
`4fd7beec45947a02d40c99159e19ee87f7c4fea6db32bf18db9224b23a1a1f73`.
Beta 0.1.0 (7) is retained, with no repeated setup or unnecessary uploads.
Existing public HTTPS, private preview, databases, processes and Cloudflare
protections are preserved. Physical tests and new approvals remain external.

## Execution evidence

Implementation, exact candidate tests and final integration disposition will be
appended here as they occur. Initial reconciliation is not a completion claim.

### Native checkpoint 42a970b4

Checkpoint `42a970b40ec8c50fd828a2c9cf8977d64939ebcf` contains the joined
canonical Inspect UI, explicit simulated native test adapter, strict eligibility,
editor-only delivery projection, native loading/tracking guidance, retained
selection across redraws and cancellation/revocation handling. TypeScript passed;
the affected shared/Lens/Journal suite passed 452 tests across 33 files. Targeted
collector/security tests passed separately. This is development evidence.

Android compiled offline using C:-owned Gradle 8.11.1, AGP 8.9.2, SDK 36 and Java
21.0.10. Existing v1 JVM assertions passed 167; expanded v2 assertions passed 54.
Those native input and large-text layout fixtures had compiled but had not yet
executed at this checkpoint. The actual native GPU/input route remains separate.

The owned loopback/SQLite harness preflight passed: canonical released binding,
exact original chest byte count/checksum, actual bundled Lens, rejection of
SIMULATED evidence, zero observation/progression mutation and database/server
cleanup. It proves host preparation only, not UIKit touch or AR tracking.

Hosted iOS Device Lab run
[39554652785](https://github.com/Kgray44/treasurehuntSoT/actions/runs/39554652785)
binds that candidate through transport
`17842aaa7ea06fe35516ab6b1c16c4a8477b4fec`. It failed: 27 tests passed, two new
viewport fixtures failed, and one driver-only test was intentionally skipped.
The separate joined original-mesh/Inspect/canonical-rejection/return journey
passed. Both results and the original failed receipt remain separate. No new beta,
external tester, signing identity or protected-main change was made.

The exact-checkpoint web production build compiled on Windows, but focused
runtime preparation failed closed at `DEVELOPMENT_BUILD_LINK_OUTSIDE_DEPENDENCIES`.
Its original private failure is retained; no runner guard was weakened. The
existing protected-source Linux focused workflow
[39555492351](https://github.com/Kgray44/treasurehuntSoT/actions/runs/39555492351)
failed while running the D1 native-bridge/real-auth/real-SQLite Player journeys.
Encrypted original diagnostics remain preserved; their retention reports missing
video and decryption is unavailable. D1 emulation is not a native mesh or physical
touch receipt.

### Frozen implementation checkpoint 26da4135

The [affected software receipt](evidence/ncl01-full-completion-20261021/software.json)
binds 39 files / 493 passing tests to clean commit
`26da4135d851ee67a0c685a0726486739612d1e2`, tree
`ad5d8c03f683b68ed89d2f263e182f5878bed070`, with identical before/after
source fingerprints. TypeScript, focused lint and formatting passed. The
[preservation receipt](evidence/ncl01-full-completion-20261021/preservation-and-source-equivalence.json)
verifies 658 original evidence/artwork Git blobs and original GLB/logo hashes.
The current-main assembly leaves that runtime/native/test source unchanged.

The [Linux focused review](evidence/ncl01-full-completion-20261021/browser-focused.json)
binds successful run 39607851877 to that exact candidate and protected workflow
source `e1a86f98`. It verifies real application authentication/SQLite, pending
Inspect, canonical response, denial/idempotency/revocation and same-Voyage return
assertions. Source declares two platform cases; exact executed counts and report
digest were not retained publicly. Cleanup passed. This is development proof.

The [unsigned iOS archive review](evidence/ncl01-full-completion-20261021/ios-unsigned-archive.json)
records successful run 39608114180 using Xcode 26.6 / SDK 26.5, the existing
bundle/origin, version 0.1.0 and archive-only build metadata 8. App Store upload
was skipped; no Apple build number was consumed and beta 7 remains unchanged.
The actual Release archive metadata was validated on the Mac. Its binary was
not published, so independent compiled-icon/Release-binary scans are unavailable.

The [Android checkpoint receipt](evidence/ncl01-full-completion-20261021/android-39607861703.json)
retains run 39607861703: all 16 native instrumentation methods passed with
original chest/compass pixels, actual mesh picks, OS pointer input, large-text
escape and disposal. The later joined Player harness failed to locate an
on-screen control; no last UI hierarchy had been retained, so its exact missing
or ambiguous control remains unknown. The following permission scenario did not
execute. Native and joined cleanup passed. This is an aggregate failure.

iOS run 39607854995 passed 28 tests, failed one later graph-replacement hit
assertion and intentionally skipped one driver-only case. Initial attached-view
mesh selection and the production-controller Inspect/redraw test passed. The
independent joined original-mesh/canonical-rejection/return journey passed with
zero observations/progression and full cleanup. Its aggregate failure is retained.
A per-mutation render-readiness fixture correction is being investigated within
one shared original five-second setup budget; the original raster budget remains
unchanged. The old Home/background failure remains unexplained.

The [matched Android lint comparison](evidence/ncl01-full-completion-20261021/android-lint-baseline.json)
reproduces all eight full-lint errors on exact protected-main native source.
Full lint remains FAIL; it is not relabeled a pass. Release lintVital and builds
pass separately. Candidate warning differences are retained.

Current repairs add a standard accessible center-selection button through each
real native mesh picker and use the established Device Lab WebView driver for
HTML controls, retaining OS input for native Scene/Inspect. Joined failures now
preserve bounded stage/control/hash diagnostics before cleanup. None of these
fixtures may claim physical tracking, authorized physical Inspect or progression.

### Confirmed protected integration boundary

Read-only experience planning from exact checkpoint `42a970b4` against fetched
main `e0056ff3` fails with
`PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity:Crossdeck and Parallax experience integration`.
The required accepted design is unavailable on protected main. PR721 remains
its owner's unmerged work. This task neither copies that candidate nor consumes
its finite capture/review allowance. Ordinary mainline qualification and merge
cannot be claimed through this boundary; independent NCL implementation and
development verification continue. Planning on current-main assembly `9abd26ba`
against protected `e1a86f98` reproduces the same exact required-design gate.
Crossdeck's R24 infrastructure adoption grants this task no consumer allowance.
Protected integration also remains held while the Crossdeck owner completes its
own recovery/qualification; this task does not advance main.

### Current implementation checkpoint a86c3636

Frozen implementation `a86c3636c3bf823f7776ce0fc904fd2e6329c4b3`, tree
`982f254e7e54ac28e08aac93a75db427496a4d90`, contains the accessible center
selection controls on both native platforms, strict native input diagnostics,
creation-bound late Android connection cleanup and current iOS viewport fixtures.
The [current software receipt](evidence/ncl01-full-completion-20261021/software-a86c3636.json)
records 495 passing tests across 39 files, clean identical before/after source
fingerprints, successful TypeScript and focused ESLint checks. The
[source comparison](evidence/ncl01-full-completion-20261021/a86c3636-source-equivalence.json)
binds reuse of Linux production-build/D1 evidence to byte-identical browser,
canonical service, fixture, lock, Prisma and public source. It does not reuse old
native evidence for changed native code.

Android run [39613042290](https://github.com/Kgray44/treasurehuntSoT/actions/runs/39613042290)
passed all 16 native instrumentation methods in 106.343 seconds, then the actual
native mesh-to-Player/SQLite journey and permission-denied scenario. Independent
revalidation checked the original manifest, four decoded raster/clear PNGs,
both original GLBs' real accessibility operations and three joined screenshots.
The joined camera-free input was correctly marked SIMULATED: canonical handling
rejected it, the native overlay disappeared, the Player showed the rejection,
the same Voyage returned and no observation/progression row was created.
Worker, native, owned Android connection and database cleanup passed. This proves
the software join, not accepted physical Inspect or Android tracking.

The [current unsigned iOS archive](evidence/ncl01-full-completion-20261021/ios-unsigned-archive-a86c3636.json)
passed on Xcode 26.6 / SDK 26.5 in run 39612997940. The actual Release archive
validated bundle, origin, permissions, privacy metadata and version. Upload was
skipped and Apple processing never started. Beta 0.1.0 (7) is unchanged; archive
build metadata 8 is not a new distributed build. Independent compiled-icon
pixels and binary scans are unavailable because the executable was not retained
as a downloadable artifact.

The [current readiness review](evidence/ncl01-full-completion-20261021/integration-readiness-a86c3636.json)
refreshes main and PR721/781 and reproduces the same required Crossdeck design
gate at the frozen implementation. No ordinary mainline decision or landed
verification exists. Duplicate delayed transport jobs were cancelled before
runner allocation; they provide no test evidence and do not establish an
authentication root cause.

The [a86 iOS failure review](evidence/ncl01-full-completion-20261021/ios-39613376449.json)
preserves run 39613376449: 28 passed, one failed and one driver-only case was
intentionally skipped. All seven current viewport phases and the actual
production mesh/accessibility and atomic graph assertions passed within the
same five-second setup deadline. Original compass/chest raster proof passed
with 8,301/2,509 populated pixels, zero empty/removed pixels and the unchanged
20-second raster bound. The sole failure was the real fixed Return button's
large-text title clipping: height 64.6667 versus required 83.3333. A required
vertical compression priority makes the scrolling panel yield before that exit;
the existing containment, minimum-target and actual title-height assertions stay
unchanged. This correction still needs fresh native validation.

That run's separate joined journey also failed. The app launched and quiesced,
but the host observed no web-client-ready marker or completed action before its
original readiness deadline. The default stage label did not distinguish iOS
phases, and the old `/lab/os/ready` handler did not record receipt; driver
OS-readiness is therefore unknown. The incomplete result bundle and raw logs
remain private. Both cleanups passed. Added fixed-route counters, separate OS
readiness observation, granular iOS stages and private bounded tool-output
retention discriminate driver startup from page/bundle/Scene/JavaScript startup
without changing any timeout or acceptance gate. Retention failure cannot skip
independent resource cleanup.

### Frozen iOS repair a523b828

Commit `a523b8287231b44c3cc30c5ebb6fba6954e6d95a`, tree
`6e845da363d51dbae3ce79a7503d9b504e82b7eb`, freezes that minimal Return
layout correction and the reviewed iOS diagnostics. TypeScript, targeted ESLint
and 14 native-input/collector regression tests passed before freezing; the
[pre-freeze check](evidence/ncl01-full-completion-20261021/ios-repair-preflight.json)
retains the exact checked Git blobs. The
[source comparison](evidence/ncl01-full-completion-20261021/a523b828-source-equivalence.json)
verifies their equality to this commit, unchanged Android native/collector and
canonical/browser source, and all 658 original evidence/artwork blobs. Fresh iOS
Device Lab and unsigned archive runs are required; no Android graphics rerun or
new distributed beta is justified by unchanged Android source.

The [a523 unsigned archive review](evidence/ncl01-full-completion-20261021/ios-unsigned-archive-a523b828.json)
records successful run 39619394225, Xcode 26.6 / iOS SDK 26.5, with actual Release
executable SHA256 `9aa73770560f7f5ef5ccf5fefa5559fa7bb1b01fd10cefeb295845ef08e7f15b`.
Bundle/origin/version/permission/privacy assertions and signing-state cleanup
passed. Upload was skipped, Apple processing did not start, and beta 7 remains
unchanged. Actual binary/compiled-icon pixels were not retained for independent
inspection; their availability limit is explicit in that review.

The first a523 Device Lab job, run 39619309485, did not execute. GitHub's
annotation states that the hosted runner was not acquired after multiple
attempts, with macOS arm64 capacity notices. Its primary job had zero steps and
zero artifacts. The [scheduler receipt](evidence/ncl01-full-completion-20261021/ios-39619309485.scheduler-review.json)
preserves that external acquisition failure separately from application tests;
it proves neither a repaired layout nor a failed assertion. A supported runner
alternative is being checked against the existing shared Device Lab.

The reviewed dispatcher now permits an explicit allowlisted iOS-only runner
selection without changing defaults or any selected test/job/timeout. The
[retained preflight](evidence/ncl01-full-completion-20261021/ios-runner-preflight.json)
records 14 passing guard tests and successful focused ESLint/format checks;
TypeScript also passed. The supported `macos-26-intel` label uses a different
architecture/pool from the reported arm64 acquisition constraint; availability
is not presumed. Its documented Xcode/Simulator support does not substitute
for an executed build, graph, geometry or graphics assertion. One fresh selected
run includes primary companion/joined tests and the existing independent full
presentation suite. The permission scenario verifies location denial, not
camera permission or camera-loss recovery.

### Preserved laptop preview recovery

The stable public origin remains `https://ncl01.absoluterelativesystems.com`.
Its preserved web source is `47ff42e4cb8b67e5fa2bfbc481a34d3d33490a18`,
not this new native/canonical candidate. The old Next process stopped responding;
the [recovery receipt](evidence/ncl01-full-completion-20261021/preserved-preview-recovery.json)
records replacement of only that creation-bound owned worker. The build,
database, edge, Cloudflare service, normal TLS/host/origin guards and unrelated
listeners were preserved. Earlier unsuccessful diagnostic/restart receipts are
retained; the original hang's cause was not established.

The [independent restored health check](evidence/ncl01-full-completion-20261021/preserved-preview-health.restored.json)
verified normal certificate/hostname validation, HTTP 200 for the sign-in page
and all 25 referenced assets with their expected CSS/JavaScript content types.
No account credentials, cookies or private database were inspected by that
check. It does not establish private-account integrity, native candidate
deployment, or a new iPhone/cellular result.

D: had no free space. The [bounded cache relocation](evidence/ncl01-full-completion-20261021/preserved-preview-cache-relocation.json)
verified all 8,466 files / 405,298,183 bytes of one inactive task-owned derived
Gradle transforms cache before and after copying to C:. The original D: cache
path remains a junction to those identical bytes; deleting only the verified
retained duplicate recovered 410,316,800 bytes. Private databases, room media,
source, dependency installations, original evidence and unrelated files were
not relocation targets. Active operations belong in the
[preview automation packet](../../../.agents/ncl01-local-preview.md).

The [current procedure verification](evidence/ncl01-full-completion-20261021/preserved-preview-current-readiness.json)
binds the seven private helper hashes. Its one reviewed current-live-only call
verified both known listeners/process/console creations twice with zero starts,
archives, signals or restarts and unchanged protected neighbors. Automatic
post-reboot stale-record handling and start order are prepared and reviewed,
not exercised against the healthy services. Account/data integrity is not
inferred from process ownership or anonymous reachability.

## Original ten requirements: current disposition

This matrix describes the bounded original-model milestone at frozen repair
`a523b828`. Fresh iOS qualification is pending. It does not promote the milestone
to physical, owner or protected-main acceptance.

| #   | Implemented behavior                                                                                                                                                                                                             | Software evidence                                                                                                                                                                                                                                                           | Physical evidence and remaining limitation                                                                                                                              | Acceptance disposition                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Published canonical Scene delivers original SC02 chest and compass; authenticated, checksum-verified GLBs retain their identity and license.                                                                                     | Shared v1/v2, schema, authorization and corruption assertions; original native raster/geometry receipts.                                                                                                                                                                    | Earlier owner-reported iPhone display is not acceptance of this source. Browser/Crossdeck end-to-end release remains gated.                                             | Implemented; integrated acceptance open.                       |
| 2   | Canonical parent/resolved transforms and entity IDs, embedded glTF hierarchy/materials, metric width, rotation and bottom pivot; strict visibility, eligibility and Scene replacement.                                           | Three-entity/hierarchy/update fixtures; native model bounds, root transforms, distinct geometry selection and hidden/occluding-mesh negatives.                                                                                                                              | Actual scale/alignment/drift unmeasured. Relative layout uses a chosen surface origin; it does not recognize the classroom.                                             | Software verified; physical fidelity open.                     |
| 3   | Existing ARKit/SceneKit app loads original GLBs, stages graphs atomically, picks actual meshes, clears/cancels and offers accessible exit/Guided fallback.                                                                       | a86 original raster and mesh tests pass; its Return-clipping failure is retained. a523 repairs compression; unsigned Release archive 39619394225 passes; fresh Simulator pending.                                                                                           | No current-source physical test receipt.                                                                                                                                | Implemented; current qualification pending.                    |
| 4   | Existing ARCore/Filament app uses the same contract and original models, actual GPU picks, surface/local placement, input guards and disposal.                                                                                   | Android 39613042290: 16 methods, both original GLBs, MotionEvent and accessibility actions, four decoded frames; joined journey and permission scenario pass. Native source unchanged in a523.                                                                              | No physical Android available. Full lint remains FAIL with eight matched baseline errors; Release lintVital/builds pass separately.                                     | Software verified; physical acceptance open.                   |
| 5   | Capability-checked world-tracking sessions, horizontal/vertical surface placement where available, provider-frame anchors, explicit failure/limited-tracking feedback and recovery handling.                                     | Provider-frame/placement/state/cancellation tests and compiled native implementations.                                                                                                                                                                                      | Real anchoring, interruption, relocalization and drift require both platforms' hardware. No automatic reconstructed-room registration.                                  | Software implemented; physical acceptance open.                |
| 6   | Browser/native share immutable Scene/edition, eligibility, transforms and authored fallback; bounded adapter reuses admitted tracking/camera custody without inventing plane support or metric scale.                            | Adapter/capability/lifecycle tests and canonical Guided/D1 journeys; browser runtime source unchanged from successful Linux run 39607851877.                                                                                                                                | No accepted live metric browser provider; Crossdeck PR721 design/participation contract is unmerged. Ordinary browser remains Guided.                                   | Independent adapter implemented; integration blocked.          |
| 7   | Actual native mesh selection emits canonical Inspect intent; pending/error/accepted Player handling and same-Voyage return replace premature local success. Standard center-selection and Guided alternatives remain accessible. | Android actual input → real SQLite SIMULATION_REJECTED → visible Player error/return passes. iOS a86 actual selection passes, but its joined readiness fails. Positive authorized canonical response/selected content is separately verified by real-app D1 mock transport. | A camera-free rejection and mocked native transport are not an accepted physical native Inspect. New iOS join and physical positive paths remain open.                  | Implemented; qualification/physical acceptance open.           |
| 8   | One account/Player/Voyage/edition/Scene authority, current membership/CSRF/checksum checks, eligibility, scoped idempotency and stale/revoked rejection. Native input never progresses the Chronicle independently.              | Real SQLite D1 positive/duplicate/foreign/stale/revocation scenarios: one authorized observation, no progression event/sequence change. Native simulation: zero observations/events.                                                                                        | Real-device joined positive observation remains unqualified.                                                                                                            | Canonical software verified; integrated physical proof open.   |
| 9   | Close/reopen, pending escape, cancellation during staging, epoch/session supersession, late-response rejection, revoked Lens teardown, network failure and native resource cleanup.                                              | Host/Lens/controller assertions; Android native/joined/permission cleanup; iOS graph/state/ordinary Home tests and cleanup retain their own source identities.                                                                                                              | Active-camera backgrounding, camera permission changes and tracking recovery require hardware. Historical Home failure 38840109053 remains unexplained.                 | Software implemented; current iOS/physical qualification open. |
| 10  | Source/tree identities, reproducible locked builds, original artifact hashes, privacy checks, declared unsupported profile and original failed receipts; existing PR741 is reusable by normal fast-forward.                      | 495 tests/39 files at a86; a523 matches retained scopes; new pre-freeze TSC/lint/14 tests; Android builds/237 JVM assertions and current hosted pass; unsigned iOS archives retain exact identities.                                                                        | Fresh a523 Simulator run pending; unsigned Release archive 39619394225 passes. No ordinary Mainline Decision, merge, landed smoke, new signed beta or owner acceptance. | Development evidence available; integration/owner gates open.  |

## Supported profile and product/security result

The supported native slice is the canonical original catalog models and bounded
Scene transforms/visibility/Inspect/local placement. Imported generic assets,
rich timelines/effects/articulation, depth occlusion, reconstruction ingestion,
persistent/shared anchors and automatic semantic room registration are not
advertised. Essential unsupported content receives capability negotiation and
the authored Guided fallback. NCL-02/03 work was not started; PR781 remains a
proposal, including its future registration/fidelity and semantics assignments.

The private classroom record was not overwritten or used as a mutable test
database. Its original immutable Scene/Environment reference and one middle-table
chest/two side-table compasses are retained. Software uses synthetic analogues.
Signing identities/secrets, private certificates, account credentials, Cloudflare
policy and unrelated services are preserved. Public Git receipts contain only
sanitized source/result/hash metadata; raw system logs, transient device IDs and
synthetic database/driver artifacts remain in owned private storage. Repository
and staged privacy scans pass at their recorded checkpoints.

The browser provider seam is not an admitted live browser implementation. Exact
Crossdeck source `245e5128afa00e6c888818a698ebd37717d81a3d` is an open draft,
and source `8d00278d1fb8f2ff1cab051c3cf9a4329df9d499` is unaccepted provider
work. No Crossdeck implementation or finite qualification authority was absorbed;
the proposed provider is not treated as an accepted production dependency.
POSITION_NO_SCALE is never treated as metres; plane capability remains false
where unavailable. Required accepted design/participation and a genuinely
supported origin-authorized provider must precede final integrated qualification.

## Proposed physical acceptance handoff

These are reproducible review steps and suggested evidence, not an amendment to
the accepted contract or newly ratified repetition/recording requirements.

Use a future signed internal build bound to the final qualified implementation
commit, paired with its coherent web source. Beta **0.1.0 (7)** and unsigned
archive metadata **8** do not identify that new installation. This task does not
request a reinstall or perform additional Apple enrollment, App ID creation,
tester invitations or external distribution.

| Test                         | Exact future operation                                                                                                                                                                                                                                                                                          | Expected result and evidence                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source and Scene identity    | On iPhone 17 Pro and a supported physical Android device, record app version/build/source; open the same isolated released Voyage/edition and three-entity classroom analogue. Record Scene checksum, instance and original asset checksums privately.                                                          | Both companions bind the same immutable edition and Scene. Original chest `2e31b5ee…22e6f` and compasses `5af1158b…82ccb`; no placeholder. Record exact build/source, not merely a camera screenshot.                                                                                                                           |
| Local placement and identity | Open Chronicle Lens; grant camera access; slowly scan a textured horizontal surface and select the intended surface origin. Look around/walk around the three-object layout. Repeat supported vertical placement separately; if unavailable, verify explicit fallback.                                          | Useful preparing/search/ready/limited states; one chest and two compasses with their authored relative offsets, metric scale/orientation and bottom pivots. Record a private video and measured apparent scale/drift; no automatic match to classroom tables is promised.                                                       |
| Positive native Inspect      | Tap the visible chest mesh, Inspect, return to the same Voyage; repeat for each compass. Test a background miss and the standard accessible center-selection control. With an isolated authorized diagnostic query, compare canonical observation/event counts before/after and repeat the same action receipt. | Selected entity/content match exactly; accepted result appears only after canonical authorization. Same account/Voyage/edition/Scene on return; idempotent observation and zero independent progression. Collect actual touch/assistive evidence and a sanitized canonical receipt; recording is one suggested evidence format. |
| Lifecycle and failure        | As a repeatable review procedure, close/reopen Lens three times; background/foreground with active camera; interrupt tracking by obscuring the camera, then uncover; interrupt network during load/Inspect; revoke camera permission in system settings and reopen.                                             | Explicit limited/error/Guided recovery; visible usable exit; no stale object, response, callback or closed Scene revival. Record timings/status transitions and actual camera/session behavior privately. Historical Home failure is not presumed explained.                                                                    |
| Accessibility and quality    | Exercise largest text in portrait/landscape and VoiceOver/TalkBack selection/Inspect/return; measure first-model latency, sustained frame behavior, memory/thermal/battery and tracking stability on actual devices.                                                                                            | Unclipped reachable controls, consistent selected identity, usable authored fallback, no unexpected capture/upload. Preserve measured results and limitations without inventing unratified fidelity thresholds.                                                                                                                 |

External gates are the accepted Crossdeck/provider integration and protected
review, owner iPhone testing and physical Android hardware. Signing/export and
matching web deployment remain task-owned distribution work when the coherent
candidate is ready; no missing Apple enrollment/access is asserted. Native
screenshots/raster frames, an uploaded IPA or
Guided View cannot close those rows. The final candidate/source and integration
disposition must be recorded after current software qualification completes.
