---
title: Project Landfall Phase 4 Device Lab Governing Addendum
audience: product-engineering
status: governing
canonical_for: project-landfall-phase-4-device-lab-addendum
last_reviewed: 2026-10-03
---

# PROJECT LANDFALL

## Phase 4 Governing Addendum

# THE LANDFALL DEVICE LAB

### Cross-Platform Device Simulation, Native Lifecycle Verification, Provider Emulation, Cloud Apple Testing, Physical-Device Qualification, and Reproducible Field Evidence

**Addendum version:** 1.0\
**Applies to:** Project Landfall Phase 4 — _Hold the Bearing_\
**Authority type:** Additive Phase 4 governing amendment\
**Status:** Governing implementation requirement

---

# 1. Purpose

This addendum formally extends **Project Landfall Phase 4: Hold the Bearing** with a permanent cross-platform testing and evidence subsystem named:

# **The Landfall Device Lab**

The Device Lab exists because Landfall is not merely a browser feature.

By Phase 4, Landfall must operate across conditions involving:

- foreground and background execution;
- screen lock and unlock;
- operating-system suspension;
- application termination;
- application relaunch;
- mobile notifications;
- location permission changes;
- approximate versus precise location;
- native geofencing;
- offline map packages;
- intermittent connectivity;
- provider outages;
- battery-saving modes;
- native sensors;
- Bluetooth;
- BLE beacon evidence;
- Ultra Wideband;
- QR;
- NFC;
- camera-based evidence;
- virtual-world providers;
- notification return;
- background-to-foreground verification;
- multiple device classes;
- multiple operating systems;
- and eventual real physical hardware.

A conventional unit-test suite is insufficient to prove these behaviors.

Manual testing alone is also insufficient.

The Device Lab therefore establishes a reusable automation architecture that can subject Landfall to repeatable, deterministic, intentionally hostile device conditions.

Its governing purpose is:

> **Every Landfall behavior that can be simulated or virtualized must be reproducibly exercised before relying on physical-device or field validation. Every behavior that cannot be faithfully simulated must be explicitly identified and carried forward to real-hardware qualification rather than silently treated as proven.**

---

# 2. Relationship to Existing Landfall Authority

This addendum does not replace:

- Project Landfall governing document v1.0;
- the Worldspaces and Virtual Navigation v1.1 amendment;
- accepted Phase 1 through Phase 3 architecture;
- One Voyage progression authority;
- Drydock verification authority;
- Sounding Line testing and release authority;
- Project Trim context-management authority;
- Watchglass visual-intelligence ownership.

It adds mandatory Phase 4 implementation requirements for:

- device virtualization;
- host-platform coverage;
- provider simulation;
- scenario orchestration;
- evidence classification;
- cloud macOS execution;
- physical-device continuation;
- reusable regression infrastructure.

Where this addendum conflicts with an older assumption that Phase 4 device behavior will be proven only manually, this addendum supersedes that assumption.

It does not alter Landfall's fundamental zero-infrastructure product rule.

Optional hardware remains optional.

---

# 3. Governing Principle

The Device Lab shall follow this principle:

> **Simulate software aggressively. Prove physics honestly.**

Virtual environments should be used to test everything they can faithfully control:

- coordinates;
- routes;
- timing;
- permissions;
- application lifecycle;
- background transitions;
- network conditions;
- power state;
- provider availability;
- sensor input;
- notifications;
- QR payloads;
- multi-device interactions;
- offline behavior;
- restart and reconciliation.

Physical hardware remains required when actual hardware behavior is itself part of the claim:

- RF propagation;
- UWB ranging accuracy;
- NFC radio behavior;
- GPS multipath;
- magnetic interference;
- real battery consumption;
- thermal throttling;
- OEM background restrictions;
- physical camera performance;
- true operating-system suspension behavior;
- real-world accessibility workflows;
- environmental field behavior.

The Device Lab must never substitute simulator convenience for hardware truth.

---

# 4. Three-Layer Verification Architecture

The Device Lab must implement three distinct verification layers.

## Layer 1 — Deterministic Provider Simulation

Runs on ordinary development and CI hosts.

Provides pure or controlled adapters for:

- location;
- geofence events;
- heading;
- motion;
- barometer;
- BLE;
- UWB;
- NFC;
- QR;
- notification delivery;
- network state;
- battery state;
- offline package state;
- map provider health;
- routing provider health;
- elevation provider health;
- Watchglass receipts;
- virtual-world observations.

This layer is fastest and most deterministic.

It must support every governed provider contract even when a corresponding emulator or physical capability is unavailable.

---

## Layer 2 — Virtual Device / Operating-System Simulation

Runs real application code in virtualized platform environments where supported.

Includes:

- Android Emulator;
- iOS/iPadOS Simulator;
- macOS-hosted Apple tooling;
- Windows-hosted application/client behavior;
- Linux-hosted backend/provider behavior;
- cloud-hosted CI environments.

This layer proves integration with real platform APIs and application lifecycle behavior as far as virtualization permits.

---

## Layer 3 — Physical Hardware and Field Qualification

Runs the same scenario definitions, where applicable, against:

- physical Android devices;
- physical iPhones;
- physical iPads where relevant;
- real NFC tags;
- real BLE beacons;
- real UWB-capable devices;
- real sensors;
- real field navigation environments;
- actual battery/power conditions;
- real network conditions where useful.

This layer closes hardware-fidelity gates.

---

# 5. One Scenario Definition Across All Layers

The Device Lab must avoid separate handwritten test logic for:

- simulation;
- emulator;
- hosted CI;
- real device;
- field validation.

Instead, scenarios must be represented through one canonical scenario contract.

Conceptually:

```yaml
scenario:
  id: outdoor-background-arrival
  version: 1

targets:
  - provider-simulation
  - android-emulator
  - ios-simulator
  - real-android
  - real-ios

initial:
  appState: foreground
  network: online
  batteryPercent: 75
  locationPermission: precise

timeline:
  - at: 0s
    location: route-start

  - at: 20s
    action: follow-route

  - at: 35s
    appState: background

  - at: 40s
    screen: locked

  - at: 55s
    location: broad-geofence-target

  - at: 60s
    expect:
      canonicalCompletion: false

  - at: 75s
    screen: unlocked

  - at: 80s
    appState: foreground

  - at: 85s
    location:
      target: exact
      accuracyMeters: 8

expectedFinal:
  waypointConfirmed: true
  progressionEvents: 1
  duplicateEvents: 0
```

Different execution adapters may translate the same semantic action into:

- ADB;
- Android emulator console;
- XCTest/XCUITest;
- `simctl`;
- provider adapter calls;
- physical-device harness operations.

But the scenario meaning remains canonical.

---

# 6. Required Evidence Classes

Every Device Lab result must state what level of evidence it represents.

At minimum:

```text
UNIT_PROVEN
PROVIDER_SIMULATION_PROVEN
EMULATOR_PROVEN
SIMULATOR_PROVEN
HOSTED_WINDOWS_PROVEN
HOSTED_LINUX_PROVEN
HOSTED_MACOS_PROVEN
REAL_DEVICE_PROVEN
FIELD_PROVEN
REAL_DEVICE_REQUIRED
FIELD_REQUIRED
UNSUPPORTED_IN_CURRENT_LAB
NOT_CONFIGURED

```

A broader classification may be adopted if current repository conventions require it.

The key rule is:

> A lower-fidelity proof may never masquerade as a higher-fidelity proof.

For example:

- synthetic NFC token tests are not NFC radio proof;
- simulated UWB sessions are not physical ranging-accuracy proof;
- simulated GPS is not multipath field proof;
- iOS Simulator lifecycle testing is not proof of every real-device suspension behavior.

---

# 7. Device Lab Orchestrator

Create one canonical Device Lab execution interface.

Conceptually:

```bash
npm run landfall:device-lab -- \
  --platform android \
  --scenario outdoor-background-arrival

```

or:

```bash
npm run landfall:device-lab -- \
  --platform ios \
  --scenario offline-reconnect

```

The orchestrator must resolve:

- scenario definition;
- target environment;
- host capabilities;
- device profile;
- required provider adapters;
- required artifacts;
- execution backend;
- expected evidence class;
- unavailable capabilities;
- report destination.

Codex should not need to understand whether a particular scenario ran:

- on the local Aero X16;
- on GitHub Actions;
- on a future cloud Mac;
- on Linux CI;
- on a real device.

That is an execution concern owned by the Device Lab.

---

# 8. Host Operating-System Matrix

The Device Lab must treat host operating systems as first-class execution environments.

At minimum support:

# Windows

Primary uses:

- Android Emulator;
- ADB;
- Android Studio tooling;
- local provider simulation;
- Windows browser tests;
- Node/TypeScript scenario orchestration;
- mock services;
- multi-emulator Android tests;
- local rapid development.

Expected evidence:

```text
HOSTED_WINDOWS_PROVEN
EMULATOR_PROVEN

```

where applicable.

---

# 9. Linux

Linux must be supported for:

- deterministic provider simulation;
- backend integration;
- service/process lifecycle;
- containerized infrastructure;
- scenario orchestration;
- server-side Landfall behavior;
- offline package services;
- provider fault injection;
- CI;
- Android Emulator where supported and economically justified;
- observability;
- package integrity;
- database/storage behavior.

Linux should be considered the default environment for broad, inexpensive server-side and provider-simulation runs.

It must not be used to pretend iOS Simulator exists.

---

# 10. macOS

macOS is the required Apple-native host for:

- Xcode;
- iOS Simulator;
- iPadOS Simulator;
- XCTest;
- XCUITest;
- Core Location simulation;
- Apple notification/deep-link testing;
- Apple lifecycle tests;
- Nearby Interaction software-path testing;
- Apple accessibility testing;
- native Apple compilation.

macOS can be supplied by:

1. GitHub-hosted macOS runners;
2. larger GitHub macOS runners;
3. future persistent cloud Mac infrastructure;
4. self-hosted Mac hardware;
5. the owner's Mac when eventually available.

No test may assume the owner's personal Mac must be online.

---

# 11. Apple Lab Tier A — Ephemeral Hosted macOS

The default Apple testing system must use disposable hosted macOS environments where practical.

Preferred initial provider:

```text
GitHub Actions macOS runner

```

The Device Lab should automatically:

1. allocate hosted macOS;
2. select supported Xcode;
3. inspect installed runtimes;
4. select or create the required Simulator;
5. boot the Simulator;
6. build/install the Landfall-capable application;
7. configure test data;
8. execute scenario actions;
9. collect logs;
10. collect screenshots/video where useful;
11. collect test results;
12. generate Device Lab evidence;
13. upload artifacts;
14. destroy the ephemeral environment automatically.

Current implementation must discover actual runner and Xcode capabilities at runtime rather than hardcoding a fleeting CI image assumption.

---

# 12. Apple Lab Tier B — Larger Hosted macOS

If ordinary macOS runners prove insufficient for:

- multiple simultaneous Simulators;
- large Xcode builds;
- heavy scenario matrices;
- large caches;
- performance work;

the Device Lab may support larger macOS runners.

This should remain a capacity optimization.

Scenario semantics and evidence contracts must remain identical.

---

# 13. Apple Lab Tier C — Persistent Cloud Mac

Design, but do not require immediately, a persistent Apple-host tier.

Potential infrastructure may include:

- AWS EC2 Mac;
- other legitimate physical-Mac cloud infrastructure;
- future self-hosted hardware.

Use cases:

- long-running lifecycle tests;
- large simulator matrices;
- persistent Xcode caches;
- nightly qualification;
- heavy native build work;
- Apple performance testing;
- release preparation;
- workloads inefficient on disposable hosted runners.

The architecture must not depend on one cloud vendor.

---

# 14. Cloud Mac Cost Governance

Persistent Mac infrastructure can be expensive and may have minimum allocation periods.

Therefore Device Lab execution policy must prefer:

```text
Provider simulation
    ↓
local Android / inexpensive CI
    ↓
ephemeral macOS CI
    ↓
larger hosted macOS
    ↓
persistent cloud Mac
    ↓
real hardware

```

unless a scenario specifically requires a higher tier.

Do not rent a physical cloud Mac for a test that a four-second provider simulation can prove.

Financial combustion is not a validation strategy.

---

# 15. Android Lab

The Android Device Lab must be highly automated.

Codex must be able to:

- install/verify Android SDK components;
- detect emulator versions;
- create Android Virtual Devices;
- boot AVDs;
- wait for boot completion;
- install the application;
- reset device state;
- inject scenario state;
- collect logs;
- shut down cleanly.

Device profiles should include at least:

- current mainstream Pixel-style phone;
- latest API level appropriate to the project;
- previous supported Android version;
- low-resource profile;
- large-screen/tablet profile where relevant;
- an API/environment capable of newer BLE/UWB simulation when available.

---

# 16. Android Location Simulation

Automate:

- fixed coordinates;
- route replay;
- GPX/KML where useful;
- speed;
- altitude;
- bearing;
- accuracy/noise where emulator APIs permit;
- large jumps;
- stale observations;
- route deviations.

Required scenarios include:

```text
gps-perfect-walk
gps-noisy-walk
gps-stale
gps-lost
gps-impossible-jump
gps-route-deviation
gps-approximate-only
gps-urban-canyon-synthetic
permission-revoked-mid-route

```

The Device Lab must distinguish physically simulated GPS behavior from mathematically injected provider observations.

---

# 17. Android Lifecycle Simulation

Automate:

- foreground;
- background;
- screen off;
- screen lock;
- screen unlock;
- home navigation;
- app standby;
- Doze;
- force stop;
- process kill;
- relaunch;
- activity recreation;
- simulated reboot where practical;
- package reinstall/reset where required.

Scenario examples:

```text
screen-lock
background-5min
background-30min
force-close
process-killed
resume
notification-return
doze-geofence-wake

```

---

# 18. Android Power Simulation

Automate where supported:

- battery percentage;
- charging state;
- battery saver;
- Doze;
- low-power behavior;
- charger connected/disconnected;
- background throttling.

Scenario examples:

```text
battery-100
battery-15
battery-saver
doze
charger-connected
background-low-power

```

Real battery-consumption and thermal validation remain physical-device evidence.

---

# 19. Android Network Simulation

Automate:

- good Wi-Fi;
- poor Wi-Fi where practical;
- cellular-like conditions;
- high latency;
- packet-loss/degraded network;
- no network;
- reconnect;
- provider-specific outage;
- server outage;
- network flapping.

Required use cases:

```text
5g-good
lte-poor
high-latency
offline
offline-then-reconnect
provider-only-outage
network-flapping

```

---

# 20. Android Sensor Simulation

Where Android Emulator supports it, automate:

- accelerometer;
- orientation;
- magnetometer;
- heading;
- pressure/barometer;
- stationary versus moving state;
- device pose.

Create scenario classes such as:

```text
heading-turn
heading-drift
accelerometer-walk
device-stationary
barometer-upstairs
barometer-noise
sensor-conflict
sensor-unavailable

```

Sensor simulation must feed canonical Landfall provider adapters rather than bypassing them.

---

# 21. Android Multi-Device Lab

When emulator/networking support permits, the Device Lab should be able to launch multiple Android virtual devices.

Example:

```text
DEVICE A
Player

DEVICE B
Nearby peer / beacon / UWB participant

```

Support scenarios such as:

```text
A approaches B
B disappears
A goes background
B returns
A reconnects
session resumes

```

Multi-device orchestration must have:

- deterministic naming;
- isolated ports;
- cleanup;
- failure recovery;
- artifact association;
- per-device logs.

---

# 22. Android UWB

Where current Emulator/API support permits, implement automated UWB software-path scenarios.

At minimum:

```text
uwb-approach
uwb-retreat
uwb-direction-change
uwb-disconnect
uwb-reconnect
uwb-peer-loss
uwb-unsupported

```

The Device Lab may prove:

- provider wiring;
- session lifecycle;
- evidence transformation;
- disconnect/reconnect;
- fallback behavior;
- unsupported-device handling.

It may not claim emulator-ranging results prove real RF accuracy.

---

# 23. Android Bluetooth and BLE

Where supported by installed emulator versions, test:

- BLE discovery;
- connection;
- disconnection;
- RSSI change;
- proximity bands;
- multiple peers/beacons;
- stale signal;
- reappearance;
- Bluetooth disabled;
- permission denied.

Representative scenarios:

```text
beacon-strong
beacon-weak
beacon-multipath-synthetic
beacon-loss
beacon-reappear
multiple-beacons
bluetooth-disabled

```

The test contract must preserve the rule that RSSI is probabilistic proximity evidence, not exact position.

---

# 24. QR Camera Testing

Use virtual-camera/test imagery where supported.

Generate controlled QR payload fixtures for:

- valid Chronicle;
- expired token;
- wrong Chronicle;
- wrong published version;
- duplicate scan;
- tampered payload;
- malformed payload;
- unrelated QR;
- replay attack.

Exercise the real scanner pipeline where possible.

Avoid testing only the QR parser in isolation when the emulator can test camera-to-parser integration.

---

# 25. NFC Strategy

NFC support must use layered proof.

## Simulation layer

Provide deterministic synthetic NFC events for:

- valid tag;
- malformed tag;
- unsigned tag;
- invalid signature;
- replay;
- wrong Chronicle;
- wrong version;
- duplicate scan;
- stale tag.

## Real-device layer

Require later physical validation for:

- radio behavior;
- tag detection;
- physical range;
- lock-screen behavior;
- platform restrictions;
- true device capability.

Synthetic NFC is not physical NFC proof.

---

# 26. iOS/iPadOS Simulator Lab

The Apple Device Lab must automate supported Simulator behavior through:

- Xcode;
- XCTest;
- XCUITest;
- `simctl` or accepted equivalent tools;
- test plans;
- GPX;
- controlled simulator state.

The system must automatically discover available runtimes and devices.

Do not hardcode one iPhone generation permanently.

---

# 27. Apple Simulated Location

Support:

- fixed coordinates;
- controlled UI-test location;
- GPX journey replay;
- elevation;
- velocity;
- route movement.

Representative scenarios:

```text
ios-static-location
ios-route-walk
ios-route-deviation
ios-background-geofence-approach
ios-offline-arrival
ios-permission-change

```

The same canonical Device Lab scenario should be reusable across Android and iOS when semantics match.

---

# 28. Apple Lifecycle Tests

Automate as much as Simulator/Xcode can faithfully provide:

- foreground;
- background;
- lock;
- unlock;
- terminate;
- relaunch;
- notification return;
- deep link;
- state restoration;
- permission dialogs;
- orientation;
- appearance;
- text size;
- simulator reset.

The evidence system must explicitly record when Simulator cannot faithfully reproduce physical-device suspension or OS scheduling behavior.

Those scenarios become:

```text
REAL_DEVICE_REQUIRED

```

rather than quietly passing.

---

# 29. Apple Nearby Interaction / UWB Software Path

Where Apple Simulator supports the relevant Nearby Interaction software flow, implement multi-simulator scenarios.

Potential proof includes:

- session creation;
- peer token exchange;
- peer discovery;
- provider initialization;
- lifecycle;
- disconnect/reconnect;
- unsupported capability;
- permission handling.

Physical UWB qualification remains required for:

- RF behavior;
- actual range accuracy;
- obstruction;
- direction accuracy;
- environment sensitivity.

---

# 30. Apple Notification Tests

Automate where platform tooling permits:

- permission granted;
- permission denied;
- local notification;
- remote/push abstraction where infrastructure permits;
- notification while backgrounded;
- notification after termination where simulatable;
- notification tap;
- deep-link return;
- stale notification;
- revoked session;
- completed Chronicle.

Notifications must resolve current server truth rather than trusting payload state.

---

# 31. Apple Accessibility Environment

Use Simulator configuration and UI tests to exercise:

- dynamic text size;
- appearance modes;
- reduced motion;
- relevant accessibility settings where simulatable;
- orientation;
- different device sizes.

Real VoiceOver/assistive-tech and physical-device validation should remain explicit external evidence where simulation is insufficient.

---

# 32. Windows Device-Lab Role

Windows must be treated as more than merely “the developer laptop.”

It should serve as a supported Device Lab host for:

- Android Emulator;
- ADB;
- provider simulation;
- web/native-adjacent tests;
- scenario orchestration;
- evidence aggregation;
- cross-platform client behavior;
- Windows browser matrices;
- local mocked infrastructure.

Scripts must work without assuming UNIX shell behavior unless they are scoped to another platform.

Use repository-supported cross-platform tooling wherever practical.

---

# 33. Linux Device-Lab Role

Linux must provide:

- inexpensive provider simulation;
- backend service testing;
- storage/offline package testing;
- fault injection;
- CI orchestration;
- containerized integration environments;
- database/service lifecycle;
- network-proxy simulation;
- observability testing;
- evidence aggregation.

Linux is especially suitable for large parallel server-side scenario matrices.

---

# 34. Cross-Platform Scenario Portability

Every canonical scenario should declare which environments can execute it.

Example:

```yaml
support:
  providerSimulation: REQUIRED
  androidEmulator: SUPPORTED
  iosSimulator: SUPPORTED
  windowsHost: SUPPORTED
  linuxHost: SUPPORTED
  realAndroid: REQUIRED_FOR_FINAL
  realIos: REQUIRED_FOR_FINAL
```

Unsupported targets must be explicit.

---

# 35. Scenario Catalog

The Phase 4 Device Lab must ship with a meaningful permanent scenario corpus.

At minimum include families for:

## Location

```text
gps-perfect-walk
gps-noisy-walk
gps-stale
gps-lost
gps-impossible-jump
approximate-location
permission-revoked-mid-route
route-deviation

```

## Lifecycle

```text
screen-lock
background
long-background
force-close
process-kill
resume
relaunch
notification-return

```

## Power

```text
battery-normal
battery-low
battery-saver
doze
charger-change
low-power-mode

```

## Network

```text
good-network
poor-network
high-latency
offline
reconnect
flapping
provider-outage

```

## Sensor

```text
heading-turn
heading-drift
motion-walk
stationary
barometer-floor-change
sensor-conflict
sensor-missing

```

## UWB

```text
uwb-approach
uwb-retreat
uwb-direction-change
uwb-disconnect
uwb-reconnect
uwb-peer-loss
uwb-unsupported

```

## BLE

```text
ble-strong
ble-weak
ble-loss
ble-reappear
ble-multiple
bluetooth-disabled

```

## QR

```text
qr-valid
qr-expired
qr-duplicate
qr-wrong-chronicle
qr-wrong-version
qr-tampered
qr-malformed

```

## NFC

```text
nfc-valid-synthetic
nfc-expired
nfc-replay
nfc-malformed
nfc-wrong-version

```

## Offline

```text
package-download-complete
package-download-interrupted
package-corrupt
storage-low
package-stale
offline-arrival
offline-app-kill
offline-reconnect
reconcile-conflict

```

---

# 36. Compound Chaos Scenarios

Individual features are not enough.

The Device Lab must include compound scenarios where failures overlap.

Example:

```text
start route
↓
GPS becomes noisy
↓
network drops
↓
app backgrounds
↓
screen locks
↓
battery saver activates
↓
broad geofence fires
↓
device wakes
↓
app resumes
↓
network remains offline
↓
exact foreground observation succeeds
↓
completion queued locally
↓
app terminates
↓
network returns
↓
app restarts
↓
outbox reconciles
↓
exactly one canonical progression event

```

These are especially valuable because real failures rarely arrive politely one at a time.

---

# 37. Determinism

Every virtual/synthetic scenario must be deterministic where technically possible.

Record:

- scenario version;
- seed;
- provider versions;
- emulator/simulator version;
- OS runtime;
- device profile;
- app build;
- repository SHA;
- published Chronicle version;
- configuration;
- timing mode.

Where operating-system scheduling introduces nondeterminism, record tolerances explicitly.

Do not make tests “pass if it probably happened eventually.”

---

# 38. Timing Model

Device scenarios need controlled timing.

The system should support:

- logical/virtual time for provider-level simulation;
- accelerated time where platform tooling permits;
- real wall-clock timing when OS behavior requires it.

Do not unnecessarily sleep for thirty real minutes if the same contract can be proven deterministically through provider simulation.

Reserve long-running tests for genuine lifecycle behavior.

---

# 39. Evidence Receipt

Every Device Lab run must produce a machine-readable receipt.

Conceptual fields:

```text
scenarioId
scenarioVersion
sourceSha
sourceTree
platform
hostPlatform
environment
deviceProfile
osVersion
runtimeVersion
providerVersions
startTime
endTime
evidenceClass
stepsExecuted
stepsPassed
stepsFailed
observedEvents
canonicalProgressionEvents
screenshots
logs
artifacts
externalRequirements
cleanupResult

```

Exact schema should follow repository conventions.

---

# 40. Artifact Collection

Where useful, collect:

- screenshots;
- screen recordings;
- logs;
- test result bundles;
- application logs;
- provider events;
- canonical Landfall events;
- network traces where safe;
- crash diagnostics;
- offline-package metadata;
- notification evidence;
- timing metrics.

Artifacts must follow existing privacy redaction rules.

Never archive raw private location data merely because a test runner can.

---

# 41. Sounding Line Integration

The Device Lab is an execution/evidence subsystem.

Sounding Line remains the verification and acceptance authority.

Register Device Lab suites through current Sounding Line mechanisms.

Examples may conceptually include:

```text
landfall.device.provider
landfall.device.android
landfall.device.ios
landfall.device.offline
landfall.device.lifecycle
landfall.device.nearby

```

Do not hardcode these IDs if current suite-registration conventions differ.

Ordinary phase changes should run impact-selected scenarios.

Full Landfall closure should run the governed final matrix.

---

# 42. Drydock Integration

Drydock should understand Device Lab evidence as external/provider/device evidence.

It may reference:

- scenario ID;
- scenario result;
- evidence class;
- provider capability;
- device class;
- source checksum.

It must not duplicate Device Lab execution.

---

# 43. Project Trim Integration

Device Lab automation must avoid forcing Codex to repeatedly rediscover:

- simulator commands;
- AVD configuration;
- Xcode runtime state;
- runner capabilities;
- scenario mappings;
- device profiles.

Generate compact machine-readable capability inventories and reuse them where source-bound/current.

Do not make every new Codex chat research the Android Emulator from scratch.

---

# 44. Capability Discovery

Before running scenarios, detect actual available capabilities.

For example:

```text
Host:
Windows 11

Android Emulator:
36.x

Available:
location
battery
network
sensors
BLE
UWB

Unavailable:
NFC physical radio

Apple:
hosted macOS configured
Xcode version ...
iOS runtimes ...

```

Use detected capability rather than optimistic assumption.

If documentation and runtime disagree, runtime truth wins for that execution.

---

# 45. Test Tier Selection

Use a tiered matrix.

## Development tier

Fast:

- provider simulation;
- one primary Android emulator;
- selected browser/integration tests.

## Candidate tier

Broader:

- provider simulation;
- Android primary + compatibility profile;
- iOS primary simulator;
- key lifecycle/offline scenarios;
- provider-specific affected scenarios.

## Project closure tier

Broad:

- Android matrix;
- iOS matrix;
- Windows/Linux server/host validation;
- multi-device scenarios;
- offline;
- accessibility;
- provider failures;
- all mandatory scenario families;
- external-gate reconciliation.

## Production release tier

Add selected real-device/field evidence once infrastructure exists.

---

# 46. Physical Device Continuation

The Device Lab architecture must be deliberately designed so physical devices can later execute the same scenario definitions.

Potential execution adapters may include:

```text
RealAndroidExecutor
RealIosExecutor

```

or repository-equivalent abstractions.

Do not create unrelated manual test plans when the existing scenario semantics can be reused.

---

# 47. Real-Hardware Requirements

The following classes require or strongly benefit from physical-device evidence before production claims are made:

- actual battery consumption;
- thermal behavior;
- GPS multipath;
- antenna/RF behavior;
- BLE ranging fidelity;
- UWB distance/direction fidelity;
- NFC radio behavior;
- actual camera/scanner performance;
- true background suspension;
- OEM Android process-management quirks;
- physical accessibility hardware;
- outdoor route behavior;
- sunlight/readability;
- real motion/barometer drift.

Simulator evidence still remains valuable.

It simply carries a lower evidence class.

---

# 48. Field Validation

Later physical field runs should use Device Lab scenario definitions wherever practical.

A field-run receipt should record:

- device;
- OS;
- app build;
- scenario;
- approximate environment category;
- expected behavior;
- observed result;
- failures;
- redacted evidence.

Raw continuous location trails must remain governed by Landfall privacy policy.

---

# 49. Failure Injection

The Device Lab must make failure easy to request.

Examples:

```text
provider unavailable
provider slow
provider rate limited
sensor missing
sensor conflict
network lost
permission denied
permission revoked
package corrupt
storage full
background wake delayed
notification duplicated
location stale
location impossible
peer disappeared

```

Do not bury failure injection inside one-off bespoke scripts.

---

# 50. Cleanup

Every run must clean up:

- emulator processes;
- Simulator processes where appropriate;
- temporary files;
- temporary databases;
- temporary accounts;
- test packages;
- ports;
- downloaded fixtures;
- background jobs;
- test notifications;
- disposable storage.

Produce cleanup evidence.

Do not leave twenty Pixel emulators wandering around the machine because a test assertion failed.

---

# 51. Security

Device Lab infrastructure itself must be secured.

Requirements:

- no production credentials in scenario files;
- synthetic identities by default;
- no secrets in uploaded CI artifacts;
- no private Chronicle content in broad test fixtures;
- no untrusted scenario command execution;
- strict scenario schema;
- trusted execution backends;
- bounded host operations;
- provider secrets through current secret infrastructure;
- logs sanitized before publication.

---

# 52. Cost Governance

Device testing can become expensive.

The Device Lab must therefore optimize by evidence need.

Rules:

- do not launch macOS if provider simulation proves the current change;
- do not launch five iOS Simulators for an unrelated text change;
- do not provision persistent cloud Macs unless justified;
- reuse caches where safe;
- retain deterministic results when current Sounding Line evidence rules allow reuse;
- use impact selection.

Correctness remains more important than cost.

But repeatedly renting an Apple kingdom to test one TypeScript enum remains frowned upon.

---

# 53. Hosted Apple Evidence

GitHub-hosted macOS should be treated as the default remote Apple evidence tier.

The CI workflow must leave behind enough evidence to establish:

- exact source;
- runner identity/class;
- Xcode version;
- Simulator device/runtime;
- scenario;
- test result;
- relevant artifacts.

Do not merely trust a green Actions badge without source-bound evidence.

---

# 54. Persistent Cloud Mac Future Seam

Document a future execution backend for persistent cloud Mac.

The backend should be replaceable.

Potential responsibilities:

- runner provisioning;
- health check;
- Xcode/toolchain state;
- simulator pool;
- secure SSH/runner access;
- cache;
- cleanup;
- shutdown;
- cost tracking.

Phase 4 need not deploy a paid persistent host unless current testing actually requires it.

The seam must exist so the architecture does not need redesign later.

---

# 55. Completion Gate

The Landfall Device Lab portion of Phase 4 is complete only when:

1. a canonical scenario schema exists;
2. provider simulation exists;
3. Android automation exists;
4. Android location simulation exists;
5. Android lifecycle simulation exists;
6. Android power/network simulation exists where supported;
7. Android sensor simulation exists where supported;
8. BLE/UWB emulator integration is implemented when supported by the installed toolchain;
9. QR camera-path testing exists where practical;
10. NFC synthetic simulation exists;
11. iOS/macOS hosted-lab automation exists;
12. iOS location simulation exists;
13. iOS lifecycle testing exists to Simulator-supported fidelity;
14. Apple Nearby Interaction software-path testing exists where supported;
15. hosted macOS evidence runs successfully;
16. Windows host validation exists;
17. Linux host validation exists;
18. multi-device orchestration exists where supported;
19. scenario receipts exist;
20. evidence classifications are enforced;
21. real-device-required cases are explicit;
22. Sounding Line consumes Device Lab evidence;
23. Drydock can reference appropriate Device Lab evidence;
24. cleanup is proven;
25. provider/device capability detection is truthful;
26. Phase 4 closure includes the Device Lab matrix.

---

# 56. Final Governing Rule

The Landfall Device Lab exists so that Phase 4 does not depend on wishful manual testing.

Its purpose is not to eliminate real-device validation.

Its purpose is to make real-device validation the **last fidelity layer**, rather than the first time the application encounters anything resembling an actual phone.

The governing rule is:

> **If Landfall can experience a condition in production, the Device Lab should reproduce that condition automatically whenever technically possible. If it cannot reproduce it faithfully, the system must say so and preserve an explicit real-device or field gate.**

A fake phone may prove software.

A real phone must eventually prove hardware.

Both are required for truthful confidence.

The Device Lab must ensure that when a Player eventually walks through a real town, locks their phone, loses reception, enters a building, wakes the device, receives a notification, reconnects, crosses a route boundary, or uses an optional physical provider, the first entity to discover whether Landfall survives that sequence is **not the Player**.
