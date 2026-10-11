---
title: Project Sextant Phase 4 implementation and qualification record
audience: product-engineering
status: in-development-not-accepted
canonical_for: sextant-phase4-implementation-record
last_reviewed: 2026-10-11
---

# Sextant Phase 4 — Take It Afield

This work starts at protected-main `f458bf2dc1176016c2d166180f038f0f15ac9f7c`.
Phase 3 product PR #701 and closeout PR #702 are merged. Phase 4 is in development;
this record grants no completion, formal acceptance, deployment or release.
The owning branch is `codex/sextant-phase4-take-it-afield` in an isolated checkout.
The owner's primary checkout, personal devices, accounts and shared runtime remain
untouched. No Phase 5 work is authorized.

## Existing lab activation

The existing shared Device Lab transport template and platform executors run on
the exact accepted base before new native implementation qualification.

| Platform   | Execution                                                                                                                                    | Actual result and boundary                                                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android D2 | [Run 38161588177](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38161588177), transport `4b0a134cdfe32e8ef2c4aa86891bac5683912ef5` | PASS: API 36 / Android 16, Pixel 7 profile, actual native instrumentation and motion-walk. Native receipt is EMULATOR_PROVEN, cleanup PASS. Twenty artifacts harvested.                                 |
| Apple D3   | [Run 38161592446](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38161592446), transport `5ac423f6445ceb6e8a069cbbd3a0bae51bc035a2` | PASS: hosted macOS, iOS Simulator 26.5 / iPhone 17e, native XCTest summary 20 passing / zero failing / one expected lab-driver skip; permission-denied-native also executes. 3,281 artifacts harvested. |

Both transports check out product SHA `f458bf2d`, not their synthetic workflow
commit. Original receipts and failed/unsupported historical evidence are preserved.
Harvest receipts bind the transport parent, artifact digests and cleanup; both
temporary remote branches were removed after successful harvest. Evidence resides
in the owned checkout under ignored `artifacts/landfall-device-lab/hosted-*`.
This is accepted-base environment activation, **not Phase 4 source qualification**.

The local Windows host has no configured Android SDK/AVD. Hosted Android supplies
a supported image, Gradle 8.11.1 and Temurin 21. Hosted Apple supplies Xcode and its
compatible simulator through the accepted executor. No personal Mac is required.

## Source under development

The first source candidate is `d53b3d8876fee85b20875071848fd1a5f0820b5a`,
tree `7858d59f08ce77402d580f9d880f51ca6bb33383`:

| Platform | Execution                                                                          | Result                                                                                                                                                                                                              |
| -------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android  | [38164052885](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38164052885) | PASS: actual API 36 instrumentation, new Sextant tests and motion-walk; 20 artifacts harvested; native/transport cleanup PASS.                                                                                      |
| iOS      | [38164057697](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38164057697) | FAIL: Swift builds; 24 passing tests, one failure and one expected skip. Home/background observation failed; permission-denied-native did not execute. 4,629 artifacts harvested; simulator/transport cleanup PASS. |

The failed Home transition now has one bounded SpringBoard activation fallback,
with screenshots/hierarchy before retry. It still requires observed background
or suspension and never uses termination to satisfy the assertion. Later source
changes require fresh native receipts.

Native `SextantPosition` now owns shared foreground LocationManager/Core Location
acquisition for canonical leases and the accepted navigation projection. WGS84
output has accuracy, uncertainty and bounded cadence. Android retains OS elapsed
capture time; iOS capture-clock alignment stays explicitly uncertain and LOW.
Position is context, not arrival proof. Landfall retains Worldspace/geofence policy.

Hardware, power, BLE/NFC and version-gated UWB/NI APIs delegate to single Sextant
owners through accepted compatibility APIs. Generic BLE GATT connection remains
UNKNOWN, not a GATT data service. iOS raw magnetic field is uncalibrated/LOW; a
separate OS bias estimate is UNSUPPORTED. Native haptic acknowledgements retain
rich/basic/NONE, bounded cadence/fatigue, preferences, timeout and cleanup gates.
No acknowledgement proves physical sensation.

The ordinary Devices page adds passive discovery, consented ten-second motion
preview, permission/status/pause/fallback controls and native-aware haptics.
Abort scopes release late acquisition when a page leaves. System reduced sensory
preference retains screen alternatives. Crossdeck receives categorical state,
without coordinates, raw streams or stable hardware identifiers.

Seventeen Phase 4 D0 scenarios join the existing 36 shared-runner scenarios:
coherent rotation/field and acceleration/position/pressure, fault refusal,
receding disturbance, threshold chatter, transient spikes, persistent interference,
restart recovery, authenticated simulated ranging reconnect and capability
negotiation. These do not measure RF or replace Crossdeck synchronization.

`src/device-lab/coordinated-sensors.ts` adds shared seeded time-series inputs:
ENU world coordinates, portrait device coordinates, unit quaternions mapping
device to world, metres/seconds, radians/second, microtesla and hPa. Position and
velocity derive from one acceleration trajectory; gravity and world magnetic
field transform coherently into device coordinates. Pressure follows the same
elevation. Noise is bounded after transformation. Twenty scheduled fault classes
retain explicit lifecycle, permission, availability, capture time and generation.
Fixtures are deterministic input, never a production sensor or physical proof.

`src/sextant/native-provider.ts` implements the semantic transport boundary with
short owner-specific native leases, origin-bound transport requirements, capture
time, generation, ordering, quality, calibration and cleanup. Native and JavaScript
monotonic clocks align through a bounded handshake; wall time is audit metadata.
Injected input is refused by a production provider. Device Lab providers retain
synthetic identity and cannot register in a production provider registry.

The native Android and Swift acquisition owners now delegate to `SextantSensors`;
accepted Landfall sensor messages remain compatibility projections from the same
subscription owner. Native source and native tests are still being qualified.
Local transport doubles and native injected tests are separate evidence classes.

The production surface runtime selects native providers inside the companion,
through the existing exact-origin Landfall transport. Browser motion listeners
are not started alongside native acquisition. Discovery does not acquire sensors.
Permissions use capability-specific OS replies and explicit purpose consent.
Native rich/basic haptic output is bounded and never claims physical sensation.
iOS receipt-time heading and pedometer samples remain low quality with an explicit
capture-uncertainty warning. Reliable capture-time qualification is still required
before those samples can satisfy quality-sensitive interactions.

Focused local checks now pass 273 tests in 19 Sextant/shared Device Lab,
native-location and Crossdeck UI files. TypeScript checking passes. Registered
ordinary desktop/mobile browser and actual owned Android WebView capability-control
journeys await execution. This does not prove native compilation, OS motion
on a simulator, physical sensor accuracy, tactile output, RF behavior or energy.

## Remote physical qualification investigation

Second source candidate `e4b2bee38ee91d122c10cad576e71ba1f7f5ac37`, tree
`b3c3d18b2904e75bc2d67d36dd1b0f76f27b347c`, passed all 53 source-bound
D0/D1 CLI scenarios and changed-file lint with zero warnings. Local feedback used
Node24.18.0/npm11.9.0; formal hosted qualification uses pinned Node24.19.0.
Android run [38168555364](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38168555364)
failed at Java compilation because the UWB owner migration referenced the absent
`SextantUwbParameters`. No emulator scenario executed and no artifacts were
produced; the exact source-bound log is retained and transport cleanup passed.
The correction moves the existing strict shape/integer boundary into Sextant and
keeps the accepted Landfall validator as a delegate. Fresh qualification is required.
Ordinary run [38168614879](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38168614879)
passed its selected unit, format/lint/type/privacy, registration and migration
checks, then failed the first desktop UI assertion: the test assumed every page
bridge call was Sextant discovery, overlooking accepted shell operations. The
correction checks all Sextant operations are discovery and independently rejects
any acquisition, permission prompt, scan or haptic operation before consent.
The immutable failed decision and log are retained. The mobile journey did not
run; the actual native Journal journey was skipped in this browser-only job and
requires its separate owned emulator harness. No UI PASS is inferred.

Web/native conformance review used the W3C Device Orientation/Motion convention
and current WebKit source (`f95488e1a6e09798b86f2252bde2aff33256337e`).
[WebCoreMotionManager](https://github.com/WebKit/WebKit/blob/f95488e1a6e09798b86f2252bde2aff33256337e/Source/WebCore/platform/ios/WebCoreMotionManager.mm)
forwards Core Motion signs and x/y/z gyro rates into
[DeviceMotionClientIOS](https://github.com/WebKit/WebKit/blob/f95488e1a6e09798b86f2252bde2aff33256337e/Source/WebCore/platform/ios/DeviceMotionClientIOS.mm)
without the canonical proper-acceleration sign or W3C alpha/beta/gamma mapping.
The browser provider now explicitly normalizes identified iOS WebKit sources,
with an overridable source convention for qualified alternative engines. Source
identification is ephemeral and never stored as device identity. Matched Android/
W3C, iPhone WebKit and desktop-mode iPad fixtures prove the software conversion,
and the Swift conversion is exercised by native tests. These are source/fixture
conformance checks, not measured physical sensor accuracy. D4 remains required.
The focused conformance/native-provider boundary passes 69 tests in four files.
The iOS run [38168558978](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38168558978)
completed successfully: native Swift/XCTest/XCUITest and the actual simulator
permission-denied scenario executed. Its source fingerprint is
`c14adb70a81e5f2a2bbf252b347465410225695b66210efb7206a15317db5f22`.
Retained native receipts show 29 passed tests, zero failures and one expected
canonical-driver skip on iPhone 17e / iOS Simulator 26.5 (23F77). The nine named
Sextant sensor/position tests and Home/background lifecycle test passed. All 4775
artifact files are harvested and checksummed; transport cleanup passed. The
receipt's Core Location main-thread availability warning is retained and does not
establish real-device responsiveness. This success qualifies only `e4b2bee3`.
The later conversion/kernel, Android validator and accepted-main reconciliation
require fresh native execution.

Accepted Crossdeck PR #706 and synthetic Pilot PR #707, plus Crossdeck evidence
PR #708, were reconciled additively from protected main
`efa689f2` into the owned branch. The seven documentation conflicts retain Sextant
candidate statements and accepted mainline status; transport, pairing, narrative
and authoring ownership remain intact. Post-reconciliation focused checks passed
284 tests in 23 files, including Crossdeck controls and Pilot story/authorization.
Candidate `a54cabc334a3574cbef55e4f9718175c286fbccf` passed all 53 D0/D1 CLI
scenarios and launched full primary Android/iOS scenario sets (runs 38169456020
and 38169460273). Ordinary run38169432378 failed its format preflight because
the additive changelog merge retained an extra blank line. Its failed decision is
preserved; formatting is corrected before fresh ordinary qualification. This
documentation-only correction does not change native lab fingerprint inputs,
but the original native receipt SHA is retained without relabelling it as a
later documentation candidate.

Firebase Test Lab supports Android instrumentation and iOS XCTest on hosted real
devices. Its current [quota documentation](https://firebase.google.com/docs/test-lab/usage-quotas-pricing)
describes a no-cost Spark physical-device quota. A billing plan's alerts do not cap
charges; no paid plan is enabled by this work. The
[iOS XCTest preparation requirements](https://firebase.google.com/docs/test-lab/ios/run-xctest)
require signed device test artifacts before upload; unsigned simulator products
cannot be substituted.

Read-only inspection found no installed gcloud/Firebase/AWS CLI, local configured
cloud credential marker, repository Test Lab/device-farm integration or repository
Actions secrets available for this route. Exact current blocker: no authorized
remote-device project/provider access and signing configuration. No service
account, billing or personal Apple/Google account is created or requested.
Physical magnetic, BLE/NFC/UWB accessory and field interactions also require
supported real interactions, not remotely injected values.

Required D4 core bring-up remains open. The Phase 4 candidate must finish every
independently attainable engineering and virtual qualification requirement and
remain reviewable without being labelled formally accepted or merged as a fully
qualified Phase 4. Sounding Line and owner/product gates remain independent.

## Coordination boundary

### Follow-up execution and prerequisite correction

Candidate `e03ffe37a45cc12dad7598c7b8c878f0cd466811`, tree
`f566397a7998a05c9063df8e5ac5dc2cb901a396`, passed exact-head ordinary
[38171494446](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38171494446)
with all ten obligations satisfied. Its corrected desktop/mobile browser journeys
also passed and retained reviewed screenshots. Actual native consumer run
[38171499881](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38171499881)
passed with ten OS motion observations, passive discovery, scoped stop and fallback,
zero progression events and successful cleanup. Its boundary JSON is now retained
as a file, alongside the reviewed native screenshots; 51 files were checksummed.
These receipts qualify their original source, not later lab corrections.

Additional Android OS lifecycle run
[38171250062](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38171250062)
passed all four screen-lock, process-kill, activity-recreation and resume scenarios
at `0f8ac197`, with 59 checksummed artifacts and successful cleanup.
Radio run [38170875594](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38170875594)
passed primary BLE3 and low-resource radio4 cases, but failed primary UWB preparation:
the second emulator's native API returned `CAPABILITIES_ABSENT`. This strict refusal
and its 42 files remain retained. A narrow fresh primary UWB run
[38171814218](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38171814218)
passed at `e03ffe37`; 12 files were checksummed and cleanup passed. This does not
erase the earlier platform-capability failure or qualify physical ranging accuracy.

Apple presentation run
[38170965786](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38170965786)
passed 31 tests with zero failures and one expected canonical-driver skip at
`0f8ac197`. The iPhone17e/iOS26.5 simulator exercised the nine native Sextant
sensor/position tests, actual Home transition, UIKit unconfigured-shell large-text/
rotation fallback and a separately observed OS Reduce Motion setting. Its 4732
files and simulator/transport cleanup are retained. The shell screenshot does not
prove normal Devices-page Apple UX or actual unavailable sensor/haptic/RF hardware.
The later terminal assessments below retain primary and compatibility/tablet failures.

Android signed background-return run
[38170904429](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38170904429)
failed at first-party region registration: Google geofencing reported `NOT_AVAILABLE`.
Signed server registration succeeded, but there was no notice, reboot or return proof.
Its settings inspection saw Location services, then stopped after two snapshots
without observing the Location Accuracy entry. The existing owned public-settings
probe now waits up to twenty seconds for that named entry; it still requires an
observed unique switch and verified enabled state. It neither guesses coordinates
nor changes undocumented settings. Two focused race/absence tests and the existing
bounded location/lifecycle tests pass (nine total), and TypeScript/lint pass.
The later source-bound run 38173731438 passed the corrected prerequisite and full
return path, as recorded below. All four failed artifacts and cleanup are retained.
Google's [geofence status reference](https://developers.google.com/android/reference/com/google/android/gms/location/GeofenceStatusCodes)
and [geofencing guide](https://developer.android.com/develop/sensors-and-location/location/geofencing)
support checking service/location prerequisites; their existence does not prove
that a simulator service is available or that this correction has passed natively.

### Historical hosted checkpoint before the follow-up

The [machine-readable virtual evidence](phase4-virtual-evidence-20261011.json)
preserves original source identities, scenario totals, native instrumentation and
sensor performance receipts, screenshot checksums and cleanup results. It is
engineering evidence, not a completed-feature declaration.

Review source `0f8ac1974da20b2c6f5e6b2f1556d2005ff35e68`, tree
`4902cf7164cd00e1c49d5c10f00b2fae25bfa073`, passed ordinary Sounding Line
[38169764018](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38169764018)
against accepted base `efa689f20d2a9dead852135302dd6961c9f0f0d2`.
All ten required obligations were satisfied; 316 unit files and the registered
browser boundary were selected. The native Journal case is qualified separately.

The isolated, unfiltered Vitest root run
[38170318327](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38170318327)
passed 3205 tests in 526 files, with zero failures, skips or pending tests.
Its retained JSON, complete log, exact SHA/tree, lock checksum and clean final
tracked-source state bind this result to `0f8ac197`. Observed hosted toolchain:
Node24.19.0/npm11.17.0. A unique synthetic SQLite database and task-owned runner
were used. The same transport retained passing desktop1280/mobile390 screenshots
from the existing isolated generic browser wrapper. These are browser/transport-
double permission and accessibility journeys, not native hardware evidence.
All 14 artifact files were checksummed and the temporary transport branch removed.

Android primary run
[38169456020](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38169456020)
passed all 20 registered scenarios and native instrumentation on Android16/API36.
It binds the original native source `a54cabc334a3574cbef55e4f9718175c286fbccf`,
tree `79b1c0b70feb01ae888b75d90cef81f82d660a76` and fingerprint
`c591f5ae3b07d2c10c94bd6063793b6d1aa973e7c0d23aa358ca0abdfe900f45`.
The original receipt is not relabelled as the later documentation candidate.
Three two-second native sensor instrumentation samples used 18/12/16ms process
CPU, observed 48 callbacks each and verified stop. Process PSS stayed below the
preliminary 256MiB budget. These short emulator samples do not establish physical
energy consumption, thermal behavior or long-duration leak freedom.
All 269 artifact files and successful app/transport cleanup are retained.

Android profile run
[38169916074](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38169916074)
passed native instrumentation plus all 20 scenarios on each compatibility phone
(Android15/API35), low-resource phone (Android16/API36, 1536MiB) and tablet
(Android16/API36). These receipts bind `0f8ac197` and the same unchanged lab
fingerprint. All 807 artifact files were checksummed; transport cleanup passed.

Actual native Journal/Devices run
[38169900062](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38169900062)
passed on two owned Android16/API36 emulators. The optimized application used its
real WebView/native bridge and synthetic One Voyage SQLite authority. The added
Devices journey asserted passive discovery, explicitly consented OS motion,
scoped stop, pause and screen-control fallback. It retained actual native viewport
and full-page screenshots. The enclosing native receipt records zero canonical
progression events and successful cleanup; 49 artifact files were checksummed.
The pairing result explicitly preserves unknown proximity, no completion authority
and the external RF requirement. No RF physics is inferred from this PASS.

Visual review found crowded preferences and missing panel spacing in those
screenshots. The follow-up uses scoped CSS with the existing Harbor panel,
responsive capability cards, 44px controls and spaced preferences. It supplies
actionable calibration/interference/stale explanations, periodic display refresh
without acquisition, and truthful paused copy instead of a previous ready message.
Eight focused control tests pass. The native boundary JSON now persists as a file
so its OS observation count is retained even without an inline-attachment reporter.
These UI/evidence changes require fresh ordinary/browser and native consumer
qualification. Prior receipts retain their original source identities; no fresh
PASS is claimed from this local feedback.

At this earlier checkpoint, remaining task-owned checks were primary iOS38169460273, Android radio
38170875594, Android signed background-return38170904429, Apple compatibility/
tablet38170962062 and Apple accessibility/presentation38170965786. Each dispatch
records its exact immutable source and transport. Pending jobs are not passing
evidence. Required D4 access/signing remains the external formal-acceptance gate.

This branch owns generic native acquisition, native companion lifecycle/power,
semantic transport/provider integration, shared coordinated sensor fixtures,
native instrumentation and the Sextant phase record. Studio/Lens placement and
editor visuals remain with their owning work. No editor redesign, Assistant
model/provider integration or shared authoring/progression rewrite is included.
Native capability seams are additive to the accepted transport.

Full-root regression and browser qualification executed on the owned hosted lab;
the former unclaimed cloud contract is consumed and must not be dispatched again.
Focused local checks remain implementation feedback. Native Android and iOS proof
retains the exact source and tested input scope of each receipt; accepted-base runs
never qualify later source merely because the same scenario names were used.

The follow-up above supersedes those pending classifications. D0/D1 CLI receipts
retain their frozen candidate/tree/fingerprint. Physical haptics, RF/magnetics,
energy/thermal performance, physical accessibility and required D4 core bring-up
remain separate.

### Accepted-main reconciliation and deliverable assessment

The owned merge `6130b7a7539697425f06965ab005c14dae97ab5c` reconciles accepted
Parallax Phase 3 product PR #711 and records-only PR #713 from protected main
`af867c011eb0c3c4d39cfe0d0bfef7c596fdbbbf`, tree
`2456cb6cf7091048d17d5e5d52b865b97ded9d6e`. Both status paragraphs and all
125 shared registry declarations are preserved: 57 Sextant, 34 Parallax and
17 Reach declarations. No accepted native source changed. Accepted package,
Prisma and shared spatial inputs did change; the newly combined source needs
fresh software qualification rather than relabelling earlier fingerprints.
The accepted workstation, field-calibration tables, logical scene policies and
catalog entry remain intact. No sibling worktree or owner-review runtime changed.

| Required deliverable        | Implemented/proven scope and remaining gate                                                                                                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Android native providers | Real SensorManager/LocationManager, hardware, power, haptic and supported nearby APIs; native D2 tests and four profiles executed. Core physical qualification remains open.                                                                                      |
| 2. Apple native providers   | Core Motion/Location/Haptics, NFC and Nearby Interaction seams build; real XCTest and injected-native conformance pass. Broader canonical simulator journeys remain in execution.                                                                                 |
| 3. Semantic conformance     | Shared contracts, coordinate/time/quality interpretation, malformed input, permission and lease/refusal tests; no injected production authority.                                                                                                                  |
| 4. Shared lab adapters      | Existing Android/iOS executors, hosted profiles and lifecycle/UI controls extended; receipt tiers and source identities retained.                                                                                                                                 |
| 5. Coordinated sensors      | Deterministic ENU trajectory and coupled transforms/noise; independent oracle and 53 total D0/D1 scenarios pass at their recorded sources.                                                                                                                        |
| 6. Faults/lifecycle         | Dropout, stale/time/bias, permission, background/restart, power/thermal and concurrent consumers; actual Android OS lock/kill/recreation/resume pass. Corrected Android signed return/reboot/revoked return passed with zero progression.                         |
| 7. Nearby/fallback          | Native capability/refusal tests, BLE lifecycle and supported Android UWB emulation; failed primary capability preparation retained alongside narrow passing rerun. Unimplemented BLE GATT connection stays unknown; RF/NFC/UWB hardware accuracy is not inferred. |
| 8. D2 receipts              | Four Android profiles, native instrumentation, actual WebView consumer/OS controls and cleanup retained with immutable source/checksums.                                                                                                                          |
| 9. D3 receipts              | Native Apple tests, Home transition and OS Reduce Motion executed; hardware-absent injection is labelled. Canonical Apple failures are assessed below; actual normal Devices UX remains unproven.                                                                 |
| 10. Remote D4               | Services investigated; no authorized configured provider/project access or signing configuration found. No billing, account or personal-device dependency introduced. Required core bring-up remains blocked externally.                                          |
| 11. Consumers               | Canonical Landfall/Parallax/Crossdeck/Watchglass/Reach/Storytide/Drydock/One Voyage boundaries retained; combined accepted-main regression and ordinary qualification required.                                                                                   |
| 12. Product experience      | Ordinary Devices consent, paused/quality/calibration/refusal and screen fallback controls; reviewed desktop/mobile and actual Android native screenshots. Apple shell accessibility captures do not prove normal Devices-page Apple UX.                           |
| 13. Performance/privacy     | Bounded native leases, cancellation/stop/concurrency, transient raw samples, provenance and no progression tests; short actual Android CPU/PSS observations. Long-duration physical energy/thermal/leak and assistive qualification are not established.          |
| 14. Records                 | This current engineering record, machine-readable virtual receipts, preserved failures, hashes and owned cleanup/checkpoints.                                                                                                                                     |
| 15. Status/catalog          | Current status, feature status, guides and changelog reviewed; accepted Parallax catalog preserved. No completed Sextant Phase 4 fragment is promoted while acceptance is open.                                                                                   |
| 16. Reviewable PR           | Draft PR #709 contains owned implementation and exact evidence; refreshed combined software/native-prerequisite checks remain to finish.                                                                                                                          |
| 17. Protected acceptance    | No merge or formal Phase 4 acceptance without required core D4 bring-up. No Phase 5 work.                                                                                                                                                                         |

The fresh qualification checkpoint records exact source/tree/base/lock, command
results and the distinct new root/background/ordinary run ownership. The earlier
unfiltered root contract remains consumed. Historical passes qualify their original
inputs; historical failures remain failures.

Document classification: this record and the project/engineering homes are current
product-engineering; current status is product status; feature status is reference;
features and Player guide are human product guidance; changelog is product/engineering
history. Active execution material belongs in `.agents/sextant-phase4.md`. Scenario
and contract JSON is machine-readable registration. The completed Feature Catalog
stays unchanged while this phase is under qualification and unaccepted.

### Combined software proof and terminal native follow-up

At candidate `c21c8cd9ce58e01c4aa74681c25d65f4f2061eff`, tree
`7cdd23d0847e47ee00ea01de576ca5d1bef650a6`, accepted base `af867c01`, the
[combined root/browser run 38173786484](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38173786484)
passed 3268 tests/533 files, with zero failing, skipped, pending or todo tests;
desktop/mobile journeys and owned runtime/database cleanup passed. Its execution
contract is consumed. The [ordinary run 38173726401](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38173726401)
passed all ten obligations, 2163 selected tests/318 files and two browser journeys.
These receipts retain their original candidate and do not qualify subsequent changes.

[Android background return 38173731438](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38173731438)
at that candidate passed actual signed first-party registration, documented mock
location delivered through the emulator's fused provider, a real OS notification
tap and active return. An actual guest reboot preserved registration and delivered
another notice; revoked return was refused. The public Location Accuracy switch
was observed disabled, enabled through its actual UI and verified enabled. Canonical
progression stayed zero; native, emulator and transport cleanup passed. Four
checksummed files preserve the receipt. Android 16/API36 emulator behavior is not
physical GPS, OEM suspension, battery or radio evidence.

[Apple compatibility/tablet 38170962062](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38170962062)
at `0f8ac197` produced 14964 files. Both compiled and passed 29 native tests with
one expected canonical-driver skip. Compatibility passed eight/nine scenarios;
tablet passed seven/nine. Both geofence cases failed the foreground WebView
acknowledgement (`LANDFALL_NATIVE_CLIENT_TIMEOUT`) after XCTest proved actual OS
return. Tablet's lost-response case timed out during OS location input. All 18
scenario cleanup receipts and transport cleanup passed; the failures stay failures.

[Narrow Apple 38174199753](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38174199753)
at `c21c8cd9` retained 6115 files and two failed scenarios with cleanup. Actual OS
location delivery now passed for lost response, but the real authority rejected
submission as `LANDFALL_EVIDENCE_STALE`; no canonical progression was invented.
Geofence return again passed XCTest and timed out waiting for the WebView client.
The shared published synthetic fixture now gives lost-response retries the same
explicit ten-minute evidence window as restart acceptance. This tests durable
retry with original timestamps through slow native transport. Scenario version 3
names published fixture `landfall-device-lab-lost-response-v2`. Product defaults,
unrelated scenarios and explicit stale-evidence tests keep their existing policy;
the extended fixture still rejects evidence after its authored window.

The next candidate reconciles accepted phone sign-in/local-HTTP correction PR #712,
main `678dd1156d39537d288ba3c2e5ce5c6efc2259d0`, through owned merge `18f3515c`.
It adds a separate actual iOS normal Devices journey: normal account sign-in,
Personal Harbor navigation, native hardware refusal, screen fallback, XXXL text,
rotation, background/return, screenshots, zero progression and owned cleanup.
It uses the existing debug loopback companion and generic first-party browser
runtime. Baseline native tests explicitly exclude this independent journey; only
its actual XCTest receipt can prove it. Apple product UX remains unproven until
that journey passes. Bounded categorical native lifecycle-delivery counters and
client stages distinguish queued/delivered/failed events from stalled control;
they are debug-loopback diagnostics and cannot change any scenario outcome.

Task-owned native artifacts moved to a dedicated D: store after C: filled. The
original worktree path is a junction; all 40154 pre-transfer files were retained,
and 21 historical hosted receipts/39882 artifact hashes verified. New harvested
receipts preserve their original source identities. This storage recovery is not
native qualification. Required D4 access/signing and formal acceptance remain open.

### Apple product-test compiler correction

[Run 38177781664](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38177781664),
candidate `4f3e3a424bd931b43e2182a8544f1892de13e49c`, tree
`d20cdf38033f4d6036bb0033f55692dd39b3754c`, failed while compiling the added
product UI test. Its label subscript returned one `XCUIElement`; the assertion
incorrectly requested a query's `count`. The correction selects the first matching
real static-text element and waits for its existence. The native test plan,
canonical scenarios and product journey did not execute; this run supplies no
native qualification. Its 3164 artifact files are preserved; native simulator
cleanup and transport cleanup both passed. Use a distinct corrected-source
contract for the same bounded primary Mac scope.

[Ordinary check 38177846432](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38177846432)
completed PASS for the original `4f3e3a42` candidate against accepted base
`678dd1156d39537d288ba3c2e5ce5c6efc2259d0`: all ten finalizer obligations closed,
2173 tests across 322 selected files passed, and both desktop/mobile D1 product
cases passed. Two opt-in native cases were skipped. This receipt does not prove
Swift compilation or execution, and is not relabeled for the corrected source.
