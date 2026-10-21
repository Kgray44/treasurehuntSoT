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
