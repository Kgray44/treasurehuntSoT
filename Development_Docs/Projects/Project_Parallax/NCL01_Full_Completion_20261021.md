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

## Initial source reconciliation

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
same five-second setup deadline. Original chest/compass raster proof passed
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
TypeScript also passed. The documented `macos-26-intel` label selects Intel
architecture to test the arm64 acquisition-constraint hypothesis; availability
and usable Metal are not presumed. See the [runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
and [official image manifest](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md).
Its documented Xcode/Simulator support does not substitute
for an executed build, graph, geometry or graphics assertion. One fresh selected
run includes primary companion/joined tests and the existing independent full
presentation suite. The permission scenario verifies location denial, not
camera permission or camera-loss recovery.

That single Intel transport registered as
[39625033481](https://github.com/Kgray44/treasurehuntSoT/actions/runs/39625033481),
bound to candidate 79df8c58 and transport
`ba95a2c4ab5a352bf71861b25e8611acfdb131ed`. Primary and presentation are
the only enabled jobs; registration and in-progress timestamps do not establish
executed assertions or a passing environment. Final results are still pending.

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

### Current protected-baseline assembly

The next frozen transport checkpoint is
`79df8c58ef2db16ba236af139e88d5726c508012`, tree
`bfced317377ec1571a15a77fc1e79def1e3438a4`. Its native/application source is
unchanged from a523; the added dispatcher guard and seven new tests make the
supported alternate runner explicit and reproducible.

The final preparation refresh fetched protected main
`185f5fd368ec16a77cb5fe92e7813d7ca4ac6418`, accepted R25 infrastructure PR783.
It was merged normally into owned assembly
`539206b304a0f125e09f882323ea7d31837fd366`, tree
`9278efd2a440384cda473e2294db01fd107de39b`. Native, application, Device Lab,
fixture, dependency, schema and public bytes are identical to 79df; protected
Sounding Line code, policy and workflows are identical to 185f. No mainline
decision or consumer allowance is borrowed from the infrastructure change.

The [independent scoped reuse review](evidence/ncl01-full-completion-20261021/source-reuse-review-539206b3.json)
verifies 45 nonempty positive path scopes and three matched exclusions before
six exact source comparisons, all 39 original software test files, the
658 historical mode/blob/path entries and original model/artwork hashes. The
495-test baseline and 14 focused dispatcher checks overlap in seven existing
guard cases; they are distinct receipts, not a new aggregate of 509 fresh tests.
The new Intel execution remains a separate obligation. This review cannot grant
ordinary Sounding Line acceptance or physical proof.
Its first private review included one nonexistent path in an otherwise matching
authority scope; that vacuous path check was corrected in v2, with the original
private review preserved and explicitly superseded. The public review contains
the corrected actual authority/workflow scope and no inferred missing-file pass.

At that refresh PR721 remained **OPEN**, now non-draft, at
`8dd97d7a63989cc7ee0fde7e8e178b515e2d8a94`; PR781 remained open at
`182233e0f6d11a5dd5f74f35e01183b633b6ec8f`. A strictly read-only
`--plan true` experience check of 539206b3 against 185f5fd3 exited 1 with the
same required `crossdeck.phase2.continuity` experience-design gate. R25 grants
only its named Crossdeck consumer a finite recovery; it does not accept
Crossdeck product behavior, authorize this NCL capture/review or waive design.
The task does not advance protected main or consume that consumer's allowance.

The earlier completed a86 iOS and a523 Lab/archive temporary transport refs were
removed only after completion/artifact review with exact expected-SHA leases
and remote-absence verification. Historical implementation/TestFlight branches,
worktrees and failed receipts remain; the current Intel transport is untouched.

### Intel execution and bounded lab repairs

Run [39625033481](https://github.com/Kgray44/treasurehuntSoT/actions/runs/39625033481)
executed frozen `79df8c58` on standard `macos-26-intel`: actual x64, macOS
26.6.1, Darwin kernel 25.6.0, Xcode 26.6 and iOS 26.5. The
[independently harvested receipt](evidence/ncl01-full-completion-20261021/ios-39625033481.json)
retains the failed whole outcome. Primary native XCTest passed **29/0/1 expected
skip**. Real Metal/GLTF raster passed in 2,918.7 ms under the original 20-second
bound: chest 8,301 pixels and compass 2,509, with empty/removed zero. All seven
graph frame barriers, real mesh selection, accessible center input and the
repaired XXXL Return layout passed. Native Simulator cleanup passed.

The joined journey failed earlier, at `IOS_BOOT_DEVICE`, before xcodebuild or
any client/OS request/action. Its first-match inventory policy selected iOS
26.2 while the companion build had selected the latest supported 26.5. The
repair shares that existing source-deployment-floor/latest-supported policy;
it does not raise the original 180-second joined boot bound or claim that
26.2 itself is defective. The failed database/server/Simulator cleanup passed.

The independent presentation first bundle passed **30/0/1**, including actual
XXXL portrait/landscape readability. The separate Reduced Motion bundle failed
**0/1/0**, `LANDFALL_REDUCED_MOTION_FALLBACK_UNREADABLE`. Its actual PNG is blank
and AX has no Window. A later job timeout/artifact-service retry did not erase
that concrete failure. All owned presentation resources were removed. The
original direct Settings-to-app cold-launch cause remains unexplained.

The bounded fixture correction changes that entry to one ordinary Home-screen
launch after the real Settings toggle. It retains the same ten-second readable
shell requirement, adds foreground/window/hierarchy diagnostics, and never
relaunches after failure. A separate definite collector bug still expected only
25 native passes; collection now strictly requires the actual 30 plus one
independent Reduced Motion pass, zero failures/expected failures, valid totals
and no unexpected skips. Focused negative regressions cover partial and failed
components. An independent reviewer inspected the actual presentation images
and these repairs; fresh execution is required. Neither correction changes
shipping native/app source, existing beta, model bytes, timeouts or TLS policy.

### Release artifact proof preparation

The existing unsigned archives validated metadata and recorded the executable
hash, but did not retain actual compiled-icon pixels or scan the Release
executable's debug-only enablement. The existing TestFlight runner now performs
a bounded proof before cleanup: the approved official/prepared source hash and
catalog filename mapping must match; the known camera-free launch switch must
be absent in UTF-8/UTF-16LE/UTF-16BE; actual 120/152-pixel compiled icons are
decoded losslessly and retained with pixel hashes and viewing copies. This is
not an assertion that every fixture-related protocol label is absent, or an
automatic cross-resolution artwork comparison. Independent visual review of
the actual compiled icons remains required. The proof exports no archive,
executable or signing material; existing upload behavior is otherwise unchanged.

The [focused verifier preflight](evidence/ncl01-full-completion-20261021/ios-release-proof-preflight.json)
records 16 passing host tests (nine new, seven existing signing boundaries),
exact Git blobs and byte hashes, malformed-image/entrypoint/catalog negatives,
and an independent source review. Native shipping source, signing, cleanup,
retention, upload policy and beta 7 are unchanged. A fresh unsigned Mac archive
must execute this new proof; archive-only metadata 8 consumes no Apple build
number. It cannot be substituted for a signed installation or physical AR.

### Repaired Lab source: Intel result and independent investigation

Run [39631967141](https://github.com/Kgray44/treasurehuntSoT/actions/runs/39631967141)
tested frozen Lab repair `b4cea94abc64fc6e02dfa5f241242eda3888d4b3`, tree
`2f93d21e056a6143b0b9dfd26f2f6ede91eb7d69`, on actual Intel x64/macOS
26.6.1/Xcode 26.6. Its
[independently reviewed originals](evidence/ncl01-full-completion-20261021/ios-39631967141.json)
retain 29 passing native tests, zero failures and one expected driver skip.
All seven attached-window frame phases passed their original shared five-second
bound. Actual Metal rendering completed in 3,379.64 ms within the original
20-second bound; recognizable original chest/compass frames contain 8,301/2,509
populated pixels, with zero for empty/removed frames. Native cleanup passed.

Joined execution selected the intended latest-supported iOS 26.5 runtime but
still failed at `IOS_BOOT_DEVICE` before the driver started: every known route
count and completed-action count is zero. Its actual database/server/Simulator
cleanup passed. The retained wrapper error does not establish child exit code,
signal, killed state, duration, stderr or underlying boot cause. The location
permission step was skipped; camera permission is not proven. Presentation hit
the unchanged 30-minute job limit, then failed artifact upload with an absent
xcresult staging file. No current assertion, final 31-test result, window state
or presentation cleanup is claimed. The whole run remains unsuccessful.

A separate read-only
[scene-configuration investigation](evidence/ncl01-full-completion-20261021/ios-scene-configuration-investigation.json)
checked the actual earlier compiled Info.plists, 15 retained originals and nine
unchanged source blobs. Missing explicit UIKit Scene manifest is not a demonstrated
cause: the same compiled SwiftUI configuration created a foreground UIWindowScene
and passed attached-window and Home/return checks. No speculative production
manifest or initializer change was made. This does not explain the earlier blank
Reduced Motion launch.

One unchanged-source comparison, run
[39637797267](https://github.com/Kgray44/treasurehuntSoT/actions/runs/39637797267),
uses the existing standard `macos-26` Apple Silicon runner with the same b4 source,
all selected suites, original assertions and original time limits. That explicit
runner label successfully acquired the fresh Release archive host; it is distinct
from the earlier unacquired `macos-latest` alias. Selection is not execution or
acceptance; its result remains pending until original evidence is retained.

That comparison's presentation job subsequently failed to acquire a hosted
machine and executed zero steps; its primary companion step completed successfully
and joined execution remains independently observed. No full-31 result follows
from this split outcome.

An additive focused diagnostic uses the same shared Device Lab and the same two
existing UI methods: actual XXXL portrait/landscape and the real Settings/Home
Reduced Motion route. It preserves their assertions, actions, time limits and
the existing 30-minute job envelope. Only the explicit development/primary-phone
target enables it; the default full-31 and companion-29 paths remain unchanged.
It does not repeat native graphics, publish an app-success pointer or write a
successful generic summary. A strict one-pass/no-failure/no-skip result is needed
for each selected component, and the two-test diagnostic is emitted only after
owned Simulator deletion is verified. Its result cannot satisfy the full-31
gate or be combined synthetically with another run. Independent review found
and repaired a failure-retention ambiguity before execution: a passing last
component after a later export failure now remains nested under an explicit
diagnostic failure, rather than a generic success summary. No native app or
test-method source changed. Fresh focused execution is still required.
The [preflight record](evidence/ncl01-full-completion-20261021/ios-presentation-diagnostic-preflight.json)
binds 25 passing host guards (eight new diagnostic, ten strict-combiner and seven
existing runner tests), focused TypeScript/lint/format checks, exact source blobs
and preserved original diagnostics. These are not native test counts or a
synthetic addition to the retained 495-test suite.

### Fresh Release artifact and artwork verification

Unsigned Mac run
[39633902301](https://github.com/Kgray44/treasurehuntSoT/actions/runs/39633902301)
passed at candidate `2f8aa894959f8e363759b39f745e055ca899a9bf`, tree
`cadc8fd0815190f2d3c59b99b017a70d431e4bff`. The
[archive receipt](evidence/ncl01-full-completion-20261021/ios-unsigned-archive-2f8aa894.json)
records all 20 source/archive/cleanup/proof assertions passing with actual
Xcode 26.6 and iPhoneOS SDK 26.5. The Release executable is 503,056 bytes,
SHA256 `9aa73770560f7f5ef5ccf5fefa5559fa7bb1b01fd10cefeb295845ef08e7f15b`,
identical to the earlier a523 archive. The known DEBUG camera-free enablement
switch is absent in the three declared encodings; this is not a claim that all
fixture code or protocol strings are absent. The actual binary was checked by
the source-bound Mac verifier and is not a public artifact or a second local
byte scan.

The actual 120/152-pixel compiled icons and lossless viewing copies are retained.
Independent decoding and
[visual review](evidence/ncl01-full-completion-20261021/compiled-icon-review-39633902301.json)
passed: both original compiled resources are byte-identical to approved beta 7,
and the gold compass ring, needle, upper-right star and folded page remain
contained with the approved composition. All 22 private originals were rehashed
independently. Cleanup passed. This archive used metadata 0.1.0 (8) only; upload
did not start, no Apple build number was consumed and internal beta 7 is unchanged.

The [independent source-reuse review](evidence/ncl01-full-completion-20261021/source-reuse-review-2f8aa894.json)
positively verifies six declared source scopes, the new b4 Lab helper closure,
all 39 retained host test blobs, 658 preserved historical evidence/artwork blobs
and the original model/logo hashes. It binds exactly to main `185f5fd3`, not a
future main or a new CI result. Hosted native qualification remains separate.

Three completed task-only temporary workflow refs were removed with exact
expected-SHA leases after their original evidence was retained and verified;
the [cleanup receipt](evidence/ncl01-full-completion-20261021/completed-transports-through-2f8-cleanup.json)
confirms remote absence. The active ARM run, implementation branch, all historical
development/TestFlight branches, worktrees, failed receipts and live owner
services were preserved.

### Publication-time preview checks

The later [live ownership check](evidence/ncl01-full-completion-20261021/preview-publication-live-check.json)
again verified both known preview components and unchanged neighboring process
creations at 17:01 UTC. It started or archived nothing, sent zero signals and
changed no legacy metadata or Cloudflared service. Its source remains
`47ff42e4cb8b67e5fa2bfbc481a34d3d33490a18`, not the completion candidate.

One normal-TLS Python urllib request returned
[HTTP 403](evidence/ncl01-full-completion-20261021/preview-publication-urllib-403.json);
it was not retried and fetched no assets. A distinct actual
[fresh default Chromium session](evidence/ncl01-full-completion-20261021/preview-publication-browser.json)
reached a complete sign-in document with HTTP 200, no observed interstitial and
24 successful correctly typed CSS/JS responses: 22 of 23 declared references and
two dynamic chunks. One polyfill reference was unrequested, with its reason
unestablished; complete reference coverage is not claimed. The initial strict
coverage failure and Python 403 remain preserved. A client-path difference was
observed, without proving its cause. Fixed read-only scope blocked off-origin
analytics and a same-origin Cloudflare telemetry POST; no challenge interaction,
login, supplied authentication/cookies, header spoofing, TLS/proxy changes or
service/database action occurred. Browser cleanup observed child exit zero.
These checks do not qualify private-account writes, a new deployment or iPhone AR.

## Original ten requirements: current disposition

This matrix describes the bounded original-model milestone at frozen repair
`a523b828`, with Intel native proof at `79df8c58`. Fresh joined/Reduced Motion qualification remains pending. It does not promote the milestone
to physical, owner or protected-main acceptance.

| #   | Implemented behavior                                                                                                                                                                                                             | Software evidence                                                                                                                                                                                                                                                                         | Physical evidence and remaining limitation                                                                                                                                                              | Acceptance disposition                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Published canonical Scene delivers original SC02 chest and compass; authenticated, checksum-verified GLBs retain their identity and license.                                                                                     | Shared v1/v2, schema, authorization and corruption assertions; original native raster/geometry receipts.                                                                                                                                                                                  | Earlier owner-reported iPhone display is not acceptance of this source. Browser/Crossdeck end-to-end release remains gated.                                                                             | Implemented; integrated acceptance open.                       |
| 2   | Canonical parent/resolved transforms and entity IDs, embedded glTF hierarchy/materials, metric width, rotation and bottom pivot; strict visibility, eligibility and Scene replacement.                                           | Three-entity/hierarchy/update fixtures; native model bounds, root transforms, distinct geometry selection and hidden/occluding-mesh negatives.                                                                                                                                            | Actual scale/alignment/drift unmeasured. Relative layout uses a chosen surface origin; it does not recognize the classroom.                                                                             | Software verified; physical fidelity open.                     |
| 3   | Existing ARKit/SceneKit app loads original GLBs, stages graphs atomically, picks actual meshes, clears/cancels and offers accessible exit/Guided fallback.                                                                       | Intel 39625033481 passes 29 native tests, original raster/mesh/frame barriers and corrected XXXL Return. Presentation first bundle passes 30; separate Motion and joined boot fail and are retained. Unsigned Release archive 39619394225 passes.                                         | No current-source physical test receipt.                                                                                                                                                                | Implemented; current qualification pending.                    |
| 4   | Existing ARCore/Filament app uses the same contract and original models, actual GPU picks, surface/local placement, input guards and disposal.                                                                                   | Android 39613042290: 16 methods, both original GLBs, MotionEvent and accessibility actions, four decoded frames; joined journey and permission scenario pass. Native source unchanged in a523.                                                                                            | No physical Android available. Full lint remains FAIL with eight matched baseline errors; Release lintVital/builds pass separately.                                                                     | Software verified; physical acceptance open.                   |
| 5   | Capability-checked world-tracking sessions, horizontal/vertical surface placement where available, provider-frame anchors, explicit failure/limited-tracking feedback and recovery handling.                                     | Provider-frame/placement/state/cancellation tests and compiled native implementations.                                                                                                                                                                                                    | Real anchoring, interruption, relocalization and drift require both platforms' hardware. No automatic reconstructed-room registration.                                                                  | Software implemented; physical acceptance open.                |
| 6   | Browser/native share immutable Scene/edition, eligibility, transforms and authored fallback; bounded adapter reuses admitted tracking/camera custody without inventing plane support or metric scale.                            | Adapter/capability/lifecycle tests and canonical Guided/D1 journeys; browser runtime source unchanged from successful Linux run 39607851877.                                                                                                                                              | No accepted live metric browser provider; Crossdeck PR721 design/participation contract is unmerged. Ordinary browser remains Guided.                                                                   | Independent adapter implemented; integration blocked.          |
| 7   | Actual native mesh selection emits canonical Inspect intent; pending/error/accepted Player handling and same-Voyage return replace premature local success. Standard center-selection and Guided alternatives remain accessible. | Android actual input → real SQLite SIMULATION_REJECTED → visible Player error/return passes. iOS Intel actual selection passes; its joined run fails before driver startup. Positive authorized canonical response/selected content is separately verified by real-app D1 mock transport. | A camera-free rejection and mocked native transport are not an accepted physical native Inspect. New iOS join and physical positive paths remain open.                                                  | Implemented; qualification/physical acceptance open.           |
| 8   | One account/Player/Voyage/edition/Scene authority, current membership/CSRF/checksum checks, eligibility, scoped idempotency and stale/revoked rejection. Native input never progresses the Chronicle independently.              | Real SQLite D1 positive/duplicate/foreign/stale/revocation scenarios: one authorized observation, no progression event/sequence change. Native simulation: zero observations/events.                                                                                                      | Real-device joined positive observation remains unqualified.                                                                                                                                            | Canonical software verified; integrated physical proof open.   |
| 9   | Close/reopen, pending escape, cancellation during staging, epoch/session supersession, late-response rejection, revoked Lens teardown, network failure and native resource cleanup.                                              | Host/Lens/controller assertions; Android native/joined/permission cleanup; iOS graph/state/ordinary Home tests and cleanup retain their own source identities.                                                                                                                            | Active-camera backgrounding, camera permission changes and tracking recovery require hardware. Historical Home failure 38840109053 remains unexplained.                                                 | Software implemented; current iOS/physical qualification open. |
| 10  | Source/tree identities, reproducible locked builds, original artifact hashes, privacy checks, declared unsupported profile and original failed receipts; existing PR741 is reusable by normal fast-forward.                      | 495 tests/39 files at a86; a523 matches retained scopes; new pre-freeze TSC/lint/14 tests; Android builds/237 JVM assertions and current hosted pass; unsigned iOS archives retain exact identities.                                                                                      | Intel native pass is retained; fresh joined/Motion proof pending. Unsigned Release archive 39619394225 passes. No ordinary Mainline Decision, merge, landed smoke, new signed beta or owner acceptance. | Development evidence available; integration/owner gates open.  |

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

The browser provider seam is not an admitted live browser implementation. The
earlier Crossdeck source `245e5128afa00e6c888818a698ebd37717d81a3d` was an
open draft; the latest refresh above records its still-open successor. Provider
checkpoint `8d00278d1fb8f2ff1cab051c3cf9a4329df9d499` is unaccepted work.
No Crossdeck implementation or finite qualification authority was absorbed;
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
