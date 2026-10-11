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

This branch owns generic native acquisition, native companion lifecycle/power,
semantic transport/provider integration, shared coordinated sensor fixtures,
native instrumentation and the Sextant phase record. Studio/Lens placement and
editor visuals remain with their owning work. No editor redesign, Assistant
model/provider integration or shared authoring/progression rewrite is included.
Native capability seams are additive to the accepted transport.

Full-suite and E2E execution have **not started locally** and remain deferred
pending the coordinator's isolated cloud capacity handoff. Focused checks here
are implementation feedback, not duplicate full-suite qualification. Native
Android/iOS source compilation and instrumentation require fresh candidate-bound
hosted execution; the accepted-base runs above do not qualify this source.

Next: new candidate-bound native runs, compatibility/low-resource/tablet profiles,
actual capability UI screenshots, clean ordinary Sounding Line, and full isolated
unit regression on coordinator-assigned capacity. D0/D1 CLI receipts bind the
frozen candidate/tree/fingerprint. Physical haptics, RF/magnetics, energy/thermal
performance, physical accessibility and required D4 core bring-up remain separate.

Document classification: this record and the project/engineering homes are current
product-engineering; current status is product status; feature status is reference;
features and Player guide are human product guidance; changelog is product/engineering
history. Active execution material belongs in `.agents/sextant-phase4.md`. Scenario
and contract JSON is machine-readable registration. The completed Feature Catalog
stays unchanged while this phase is under qualification and unaccepted.
