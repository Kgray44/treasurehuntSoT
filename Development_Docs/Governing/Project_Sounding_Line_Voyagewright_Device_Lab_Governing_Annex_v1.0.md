---
title: "Project Sounding Line Governing Annex"
subtitle: "Voyagewright Device Lab - Shared Device, Sensor, Lifecycle, Spatial, Network, and Multi-Surface Verification Facility"
author: "Voyagewright Engineering"
date: "October 7, 2026"
version: "1.0"
status: "Governing Annex"
document_id: "VW-SL-DEVICE-LAB-ANNEX-1.0"
repository: "Kgray44/treasurehuntSoT"
repository_baseline: "2cdb32ec504a4396092e9a0237661ee365ce9caf"
amends: "Project Sounding Line effective authority without changing release-decision semantics"
---

# PROJECT SOUNDING LINE

## Voyagewright Device Lab Governing Annex v1.0

### Shared Device, Sensor, Lifecycle, Spatial, Network, and Multi-Surface Verification Facility

> **Governing Principle**  
> The Device Lab is a shared verification facility, not a product subsystem and not a second release authority. Projects define what behavior must be proven. Device Lab supplies reproducible device/platform execution and fidelity-labelled evidence. Sounding Line decides what that evidence proves and whether it satisfies software acceptance.

This annex formally promotes the accepted **Landfall Device Lab** architecture into the platform-wide **Voyagewright Device Lab** required by the Voyagewright Spatial Experience Architecture.

The promotion is additive. It does **not** rewrite historical Landfall Phase 4 evidence, rename old receipts, create a new release decision, or reopen Project Landfall. Accepted Landfall scenarios and receipts remain exactly what they were when produced. Future projects may reuse the shared facility through their own registered scenario packs.

---

# 1. Authority, Purpose, and Current Truth

This annex is subordinate to:

1. Voyagewright Global Product Governance Standard.
2. Voyagewright Spatial Experience Architecture v1.0.
3. Current Project Sounding Line effective authority and `testing/sounding-line-authority.json`.
4. Current protected repository source.
5. Project-specific governing documents that define the behavior under test.

This annex is authoritative for:

- the identity and ownership of **Voyagewright Device Lab**;
- promotion of the historical Landfall Device Lab into a shared platform facility;
- scenario registration and namespacing;
- host/device execution tiers;
- evidence-fidelity semantics;
- device/profile catalogues;
- resource and cleanup expectations;
- project-owned scenario packs;
- hosted macOS/iOS and Android execution policy;
- physical-device and field qualification boundaries;
- privacy, artifact retention, cost, and security of Device Lab execution;
- the relationship between Device Lab, Sounding Line, Drydock, and product projects.

It does **not** alter:

- the protected required check `Sounding Line / Mainline Decision`;
- `RELEASE_GO` semantics;
- current Sounding Line v1.4 minimum-sufficient-evidence rules;
- ordinary versus release-candidate qualification;
- One Voyage progression authority;
- Drydock's authored-Chronicle validation authority;
- project ownership of product behavior.

## 1.1 Current accepted foundation

Landfall Phase 4 already established a reusable Device Lab with:

- deterministic provider simulation;
- Android Emulator execution;
- iOS/iPadOS Simulator execution on macOS;
- Windows/Linux/macOS host coverage;
- canonical scenario definitions translated by platform adapters;
- physical-device and field continuation gates;
- explicit evidence classes;
- provider/radio/lifecycle scenarios;
- cleanup and source-bound receipts;
- hosted macOS execution that does not depend on the owner's personal Mac.

That accepted source is the **seed implementation**, not a permanent Landfall ownership claim.

## 1.2 Promotion rule

Future code and documentation SHOULD use **Voyagewright Device Lab** for shared infrastructure while preserving `Landfall Device Lab` names inside historical Phase 4 receipts and artifacts where changing them would falsify history.

No migration may retroactively upgrade:

- `EMULATOR_PROVEN` to `REAL_DEVICE_PROVEN`;
- `SIMULATOR_PROVEN` to `FIELD_PROVEN`;
- old Landfall-only scenario coverage into project coverage that was never actually run.

---

# 2. Fundamental Ownership Model

The Device Lab answers:

> **Can this software behavior be reproduced on the declared device/platform/environment under the declared scenario, and what fidelity level was actually demonstrated?**

It does not answer:

- whether a Chronicle is semantically publishable - Drydock;
- whether a spatial object belongs at a specific anchor - Parallax;
- whether a device capability means a particular semantic observation - Sextant;
- whether a route/location condition is satisfied - Landfall;
- whether a visual target was recognized correctly - Watchglass;
- whether a companion surface is authorized/synchronized - Crossdeck;
- whether the story should advance - One Voyage through the owning completion path.

## 2.1 Project responsibilities

Each project that uses Device Lab MUST own:

- its scenario intent;
- assertions about product behavior;
- synthetic fixtures and safe test data;
- required capability declarations;
- expected evidence tier;
- any project-specific oracle used to decide pass/fail;
- its physical/field gates where virtualization is insufficient.

Device Lab owns:

- scenario execution plumbing;
- host/platform adapters;
- virtual device lifecycle;
- common provider injection;
- artifact collection;
- cleanup;
- common receipt structure;
- evidence-fidelity labelling;
- resource allocation hooks consumed by Sounding Line.

Sounding Line owns:

- test registration policy;
- impact selection;
- execution authority;
- isolation/resource governance;
- evidence validity;
- final software acceptance.

---

# 3. Core Verification Philosophy

The governing rule inherited from Landfall is retained:

> **Simulate software aggressively. Prove physics honestly.**

The Device Lab SHOULD virtualize or simulate anything that can be controlled deterministically, including:

- device orientation;
- location fixes and routes;
- lifecycle transitions;
- background/foreground changes;
- network conditions;
- provider availability;
- permission state;
- notification/deep-link flows;
- power-state approximations;
- sensor values;
- Crossdeck pairing/session conditions;
- AR tracking failure/recovery fixtures;
- synthetic Watchglass evidence;
- offline/reconnect behavior.

Real hardware remains required where the claim depends on real physics or vendor behavior that simulation cannot faithfully establish, including:

- RF propagation;
- UWB ranging accuracy;
- BLE/NFC radio behavior;
- GPS multipath;
- magnetometer interference;
- camera quality under real lighting;
- battery drain;
- thermal throttling;
- OEM background restrictions;
- real assistive-technology interaction;
- actual physical walking/field behavior.

---

# 4. Verification Tiers

Voyagewright Device Lab standardizes six tiers.

## D0 - Deterministic provider simulation

Runs pure or controlled provider adapters without a virtual operating system.

Typical use:

- semantic sensor/device provider contracts;
- failure injection;
- virtual time;
- network/provider unavailability;
- deterministic spatial/provider receipts;
- fast CI.

Evidence examples:

- `UNIT_PROVEN`;
- `PROVIDER_SIMULATION_PROVEN`.

## D1 - Browser/device API emulation

Exercises browser APIs and web permission/lifecycle behavior where reliable.

Typical use:

- browser location/device-orientation contracts;
- permission prompts through controlled browser fixtures;
- responsive camera/Lens UI;
- degraded browser capability paths.

Evidence must state which browser/API behavior was actually exercised.

## D2 - Android virtual device

Uses Android Emulator/ADB/emulator-console and real Android application/platform APIs where supported.

Typical use:

- location injection;
- sensor values;
- app standby/Doze;
- screen lock/unlock;
- activity lifecycle;
- notifications;
- intents/deep links;
- network transitions;
- multi-emulator interaction;
- device-profile compatibility.

Evidence: `EMULATOR_PROVEN` plus host/profile metadata.

## D3 - Apple virtual device / hosted macOS

Uses Xcode, iOS/iPadOS Simulator, `simctl`, XCTest/XCUITest, and supported Apple simulation facilities.

Typical use:

- Core Location simulation;
- Apple permission/lifecycle flows;
- notification/deep-link handoff;
- UI/accessibility behavior;
- native companion build/install;
- Crossdeck/Parallax/Sextant Apple software paths.

Evidence: `SIMULATOR_PROVEN` and `HOSTED_MACOS_PROVEN` where applicable.

## D4 - Controlled physical hardware

Runs governed scenario slices on real devices and real hardware accessories.

Typical use:

- iPhone/Android sensor behavior;
- actual camera/AR tracking;
- real NFC/BLE/UWB;
- thermal and battery behavior;
- physical accessibility tooling;
- OEM background restrictions.

Evidence: `REAL_DEVICE_PROVEN`.

## D5 - Real field qualification

Runs the governed experience in representative physical/virtual real-use environments.

Typical use:

- outdoor navigation;
- indoor multipath;
- shared crew AR;
- real-room adaptive staging;
- physical search/frustration behavior;
- mixed-device group use;
- field accessibility;
- real game + companion performance.

Evidence: `FIELD_PROVEN`.

## 4.1 Fidelity is monotonic, not interchangeable

A higher tier may satisfy a lower-tier requirement only when the project contract explicitly permits it and the scenario assertions are equivalent.

A lower tier MUST NEVER satisfy a higher-tier physical claim merely because its tests passed.

---

# 5. Canonical Scenario Contract

All Device Lab executions SHOULD use a common versioned scenario definition rather than creating unrelated scripts for every host.

Representative shape:

```yaml
scenario:
  id: parallax.shared-anchor-late-join
  version: 1
  owner: project-parallax
  tags: [spatial, shared-scene, reconnect]

requirements:
  capabilityProfile: spatial-ar-standard
  minimumTier: D2
  preferredTiers: [D3, D4, D5]

initial:
  network: online
  batteryClass: normal
  primarySurface: phone-a
  secondarySurface: phone-b

steps:
  - at: 0s
    action: open-spatial-scene
  - at: 3s
    expect: shared-anchor-resolved
  - at: 10s
    action: join-surface
    surface: phone-b
  - at: 15s
    expect: same-anchor-identity

expectedFinal:
  splitBrainAnchors: 0
  duplicateProgressionEvents: 0
```

Platform adapters translate semantic actions into environment-specific operations.

The scenario contract MUST be stable enough that the same semantic case can be re-run through D0-D5 without rewriting the story of what is being tested.

---

# 6. Scenario Registry and Namespaces

Device Lab MUST maintain a machine-readable scenario registry.

Every registered scenario requires at least:

- stable `scenarioId`;
- schema/version;
- owning project;
- description;
- protected contracts;
- required capabilities;
- eligible tiers;
- preferred device profiles;
- required fixtures;
- privacy classification;
- timeout/budget;
- cleanup requirements;
- expected artifacts;
- assertion/oracle owner;
- physical/field continuation status;
- Sounding Line suite/test registration references.

Recommended namespacing:

```text
core.lifecycle.*
sextant.*
landfall.*
parallax.*
crossdeck.*
watchglass.*
storytide.*
wakebook.*
```

Other projects MAY register scenarios when device/platform behavior is genuinely relevant.

---

# 7. Scenario Packs

## 7.1 Core pack

Shared platform scenarios include:

- permission granted/denied/revoked;
- foreground/background;
- screen lock/unlock;
- process termination/relaunch;
- network loss/recovery;
- battery/thermal quality change;
- orientation change;
- notification return;
- application upgrade/restart;
- cleanup after interruption.

## 7.2 Sextant pack

Examples:

- heading turn and calibration degradation;
- three-spin gesture including partial/false rotations;
- accelerometer walking/stationary transitions;
- gyroscope rotation;
- magnetic anomaly baseline and noise;
- barometer relative-elevation change;
- capability unavailable/permission denied;
- provider-quality degradation.

## 7.3 Landfall pack

Examples:

- route traversal;
- geofence approach/arrival;
- degraded GPS then recovery;
- offline route/map behavior;
- background arrival;
- physical vs virtual Worldspace acquisition;
- elevation/context fusion;
- provider failover.

Accepted historical Landfall scenarios remain valid Landfall evidence; future shared execution uses the platform registry.

## 7.4 Parallax pack

Examples:

- plane/surface discovery;
- fixed anchor recovery;
- adaptive placement;
- adaptive per-run variation with deterministic seed;
- shared anchor resolution;
- late join;
- tracking loss/relocalization;
- re-anchor authorization;
- privacy-safe calibration capture;
- person-in-frame rejection;
- Discovery Assistance escalation;
- low-power quality degradation.

## 7.5 Crossdeck pack

Examples:

- desktop/phone pairing;
- companion surface loss;
- late surface join;
- surface handoff;
- stale/revoked surface credential;
- reconnect to same Player/Voyage;
- private/shared surface routing;
- simultaneous interaction conflict.

## 7.6 Watchglass pack

Examples:

- camera unavailable;
- low-light/occlusion;
- visual relocalization match/no-match/abstain;
- person/face privacy screening;
- pose uncertainty;
- thermal quality reduction;
- spatial evidence expiry.

---

# 8. Device and Host Profile Catalog

Device Lab MUST separate **scenario semantics** from **device profile**.

A device profile may describe:

- OS/platform;
- OS version;
- virtual/physical status;
- screen dimensions/density;
- browser/webview/native shell;
- sensor capability classes;
- camera/AR capability;
- BLE/NFC/UWB capability;
- memory/CPU/GPU class;
- battery/thermal class;
- accessibility settings;
- motion-reduction settings;
- locale/timezone where relevant.

The same scenario may run against several profiles.

Profile names MUST NOT imply unavailable hardware. For example, an iOS Simulator profile that models a UWB software path cannot be labelled as physical UWB ranging proof.

---

# 9. Host Matrix

## 9.1 Windows

Primary uses:

- Android Emulator;
- ADB/emulator console;
- provider simulation;
- Windows browser/native-host behavior;
- local fast iteration;
- multi-emulator Android scenarios.

## 9.2 Linux

Primary uses:

- D0 provider simulation;
- backend/provider integration;
- service/network fault injection;
- CI orchestration;
- artifact validation;
- databases/storage;
- Android virtualization where supported and cost-effective.

Linux MUST NOT pretend to provide iOS Simulator evidence.

## 9.3 macOS

Required for:

- Xcode;
- iOS/iPadOS Simulator;
- XCTest/XCUITest;
- Core Location simulation;
- Apple native build/install;
- Apple-specific lifecycle and accessibility paths.

macOS may come from GitHub-hosted runners, larger hosted runners, persistent cloud Macs, or self-hosted hardware.

The owner's personal Mac MUST NOT be a mandatory CI dependency.

---

# 10. Hosted Apple Laboratory

The default Apple path SHOULD begin with ephemeral hosted macOS runners where the required simulator/runtime exists.

A hosted execution should:

1. select/record Xcode and runtime;
2. boot the declared Simulator profile;
3. build/install the candidate application;
4. apply scenario configuration;
5. execute actions/assertions;
6. collect structured logs/screenshots/video where useful;
7. emit a source-bound Device Lab receipt;
8. clean up Simulator/process state;
9. upload bounded artifacts;
10. terminate the ephemeral environment.

Persistent cloud Mac capacity MAY be added for heavy matrices and caching, but scenario semantics and evidence classes remain identical.

---

# 11. Android Laboratory

Android execution may use:

- emulator console location injection;
- GPX/KML/route playback;
- ADB lifecycle commands;
- Doze/App Standby controls;
- network shaping;
- sensor injection where supported;
- multiple emulator instances;
- deep links/notifications;
- screenshots/screen recording;
- accessibility automation.

Device Lab SHOULD expose semantic actions so project scenarios do not hard-code ADB shell commands throughout product test files.

---

# 12. Real Hardware Harness

D4 execution should support a controlled inventory of real devices without requiring every contributor to own every device.

A physical device record should include:

- opaque lab device ID;
- platform/model family;
- OS version;
- capability classes;
- lab ownership/availability;
- calibration/known limitations;
- last qualification time;
- installed app/build identity;
- physical accessory requirements;
- privacy wipe/cleanup policy.

No receipt should expose unnecessary personal device identifiers.

---

# 13. Field Qualification

D5 is intentionally expensive and selective.

A field qualification plan should define:

- place/environment class;
- safety conditions;
- required devices;
- required crew size;
- accessibility conditions;
- network conditions;
- expected route/search duration;
- exact project assertions;
- observation recording policy;
- privacy boundaries;
- whether owner acceptance is also required.

Field evidence must remain clearly distinct from ordinary CI.

---

# 14. Sounding Line Integration

Device Lab scenarios are ordinary governed tests only after registration through Sounding Line's current test/suite/contract machinery.

Sounding Line decides:

- whether a scenario is selected for a candidate;
- which tier is required;
- whether previous evidence remains semantically valid;
- which resources may run concurrently;
- whether an external/hardware gate is mandatory now or pending;
- whether the evidence contributes to `RELEASE_GO`.

Device Lab MUST NOT create a separate `DEVICE_LAB_GO` release authority.

## 14.1 Ordinary mainline

Ordinary candidates should run the **minimum sufficient affected Device Lab scenarios** plus required safety sentinels selected by current Sounding Line policy.

## 14.2 Release candidate

An exhaustive release or project closure may require a wider device/profile matrix according to the governing project.

## 14.3 Record-only documentation

Documentation-only Device Lab governance changes must not trigger real-device or emulator matrices merely because the words “iPhone” and “Android” appear in Markdown.

---

# 15. Resource Isolation and Concurrency

Device Lab MUST integrate with Sounding Line resource governance rather than create parallel ad-hoc locks.

Potential resource families include:

- Android emulator slot;
- iOS Simulator slot;
- macOS runner class;
- physical-device lease;
- device-farm lease;
- application port;
- local API server;
- database clone/schema;
- storage root;
- camera/media fixture root;
- BLE/UWB/NFC accessory lease;
- network-shaping namespace;
- evidence-artifact directory;
- field test reservation.

Every mutable resource requires ownership, cleanup, and stale-owner recovery semantics.

---

# 16. Evidence Receipt

A canonical Device Lab receipt should record at minimum:

```text
DeviceLabReceipt
  receiptId
  scenarioId
  scenarioVersion
  owningProject
  candidateCommitSha
  candidateTreeSha
  baseSha
  platformTier
  hostOs
  hostImage/runtime
  deviceProfile
  physicalOrVirtual
  capabilitySnapshot
  startedAt
  completedAt
  assertions[]
  evidenceClass
  unsupportedCapabilities[]
  requiredFutureGates[]
  artifacts[]
  privacyClassification
  cleanupReceipt
  passFailDisposition
  failureClassification?
```

The receipt MUST bind to exact source and scenario identity.

Artifacts may support the receipt but do not replace structured evidence.

---

# 17. Failure Semantics

Device Lab results distinguish at least:

- product assertion failure;
- scenario definition invalid;
- host unavailable;
- device unavailable;
- capability unsupported;
- simulator/emulator infrastructure failure;
- application install/build failure;
- provider setup failure;
- timeout;
- cleanup failure;
- privacy-screening refusal;
- external physical/field gate required.

A host failure MUST NOT appear as 30 independent product failures merely because 30 assertions depended on the host. Sounding Line root/cascade classification remains applicable.

---

# 18. Cleanup and Reproducibility

Each execution MUST clean task-owned mutable state, including where applicable:

- emulator/simulator processes;
- installed test application state;
- task-owned databases;
- storage roots;
- temporary certificates/tokens;
- ports;
- background workers;
- network shaping;
- screenshots/video containing protected fixture content;
- device pairing sessions.

Cleanup failure is evidence and may fail the scenario or acceptance lane according to policy.

A scenario advertised as deterministic SHOULD reproduce the same semantic result under the same source, profile, policy, and declared seeded inputs.

---

# 19. Privacy and Test Data

Device Lab uses synthetic or explicitly authorized data by default.

It MUST NOT casually retain:

- real room imagery;
- personal location histories;
- private Chronicle content;
- account credentials;
- raw biometric data;
- unrelated nearby-device identifiers;
- production storage keys;
- real user notifications/messages.

Scenario fixtures must be purpose-bounded and attributable.

Camera/spatial tests should prefer synthetic scenes, controlled test rooms, or explicitly authorized field evidence.

---

# 20. Security

Threats include:

- forged evidence receipts;
- using simulated providers while claiming physical proof;
- stale device profiles;
- poisoned fixtures;
- leaking test credentials;
- cross-run device state contamination;
- unauthorized physical-device access;
- malicious scenario actions;
- artifact tampering;
- source mismatch between scenario and application build.

Controls MUST include source binding, scenario versioning, least-privilege credentials, isolated resources, checksummed artifacts where required, bounded commands, and fail-closed tier classification.

---

# 21. Cost and Capacity Governance

Device Lab should use the cheapest tier that proves the required claim.

Preferred progression:

```text
D0 provider simulation
   ↓
D1 browser/device emulation
   ↓
D2 Android emulator / inexpensive virtual hosts
   ↓
D3 hosted macOS/iOS Simulator
   ↓
D4 controlled hardware
   ↓
D5 field qualification
```

Do not rent persistent Mac hardware for a four-second deterministic provider contract.

Cost optimization may change transport, caching, or scheduling; it may not relabel evidence or weaken required fidelity.

---

# 22. Drydock Relationship

Drydock may require that a Chronicle or provider capability possess a particular class of device evidence before publication.

Example:

```text
Drydock:
  Spatial Moment requires WORLD_TRACKED_AR
  publication policy requires at least D2 software proof
  public recommended compatibility requires declared D4 qualification status
```

Drydock may reference Device Lab receipts/qualification states.

Drydock does not become Device Lab scheduler or global test authority.

Device Lab does not interpret Chronicle graph semantics.

---

# 23. Project Registration Contract

A project joining Device Lab must provide:

1. governing authority for the behavior;
2. stable contracts/assertions;
3. scenario pack definition;
4. device/capability matrix;
5. tier/fidelity requirements;
6. privacy classification;
7. required fixtures;
8. cleanup rules;
9. expected failure classes;
10. Sounding Line test/suite registration.

A project may start with D0 scenarios and add higher tiers later, provided its claims remain honest.

---

# 24. Migration from Landfall Device Lab

The promotion path is:

```text
historical Landfall Device Lab
        ↓ preserve old records
shared execution primitives generalized
        ↓
Voyagewright Device Lab
        ↓
Landfall becomes one registered scenario owner
```

Rules:

- historical paths/receipts remain stable unless ordinary documentation links are updated;
- future shared scripts SHOULD live under a neutral platform/test namespace rather than Landfall-only naming;
- migration should be incremental and compatibility-preserving;
- no accepted Landfall Phase 4 evidence is invalidated merely because code is later moved/generalized;
- semantic changes to evidence handling require new tests and Sounding Line acceptance.

---

# 25. Machine-Readable Registries

The Spatial Experience program should eventually maintain or generate:

- `device-lab-scenario-registry.json`;
- `device-capability-registry.json`;
- device profile registry;
- scenario-to-Sounding-Line test mapping;
- evidence-tier vocabulary;
- project scenario ownership map.

Generated registries are acceleration and governance artifacts, not alternate sources of product truth.

---

# 26. Example Scenario Families

## 26.1 `sextant.magnetic-hidden-object`

D0: deterministic field anomaly/noise.

D2/D3: platform sensor API path where virtual hardware permits.

D4: real phone + safe known magnet.

D5: optional representative Creator prop search.

## 26.2 `parallax.shared-ar-late-join`

D0: shared scene state machine.

D2/D3: two virtual clients where supported.

D4: two real devices in same room.

D5: crew field qualification.

## 26.3 `crossdeck.phone-disconnect`

D0: transport/session model.

D1: browser pair simulation.

D2/D3: mobile companion loss/rejoin.

D4: real desktop + phone.

## 26.4 `watchglass.person-in-frame-calibration-rejection`

D0: deterministic classifier receipt.

D1/D2/D3: camera pipeline with synthetic person/no-person fixtures.

D4: controlled real camera scene.

No calibration upload may occur when person/face presence is positive or uncertain under the governing privacy contract.

---

# 27. Accessibility

Device Lab SHOULD include scenarios for:

- reduced motion;
- screen reader where automatable;
- zoom/text size;
- keyboard and switch-like alternatives;
- orientation changes;
- high contrast where supported;
- haptic/audio absence;
- one-handed layouts;
- non-camera fallback.

Simulator accessibility evidence remains distinct from physical assistive-technology field acceptance when the latter is required.

---

# 28. Operational Diagnostics

A failed Device Lab run should answer:

- which scenario and step failed;
- which host/device profile ran;
- whether the app launched;
- whether injection succeeded;
- which assertion failed;
- what tier was being attempted;
- which artifacts/logs exist;
- whether cleanup succeeded;
- whether the failure is product, lab infrastructure, unsupported capability, or external gate.

“Mobile test failed” is not a diagnostic category fit for grown software.

---

# 29. Versioning and Change Control

Changes to the shared Device Lab contract require review when they alter:

- scenario schema;
- evidence tier semantics;
- receipt fields used for acceptance;
- project ownership;
- resource/isolation behavior;
- privacy handling;
- trusted execution/adapters;
- physical/field gate interpretation.

Ordinary addition of a project-owned scenario may follow the declarative registration path if it does not change platform policy.

---

# 30. Acceptance Criteria

Voyagewright Device Lab governance is accepted when:

1. the facility is explicitly owned by Sounding Line rather than Landfall;2. historical Landfall Device Lab evidence remains truthful and intact;
3. D0-D5 tiers are consistently defined;
4. scenario definitions are reusable across execution adapters;
5. projects register scenario packs rather than fork private lab implementations;
6. evidence receipts bind exact source, scenario, profile, tier, and cleanup;
7. lower-fidelity proof cannot masquerade as higher-fidelity proof;
8. Sounding Line remains the only software release/merge authority;
9. Drydock may consume qualification state without owning execution;
10. Windows/Linux/macOS responsibilities are explicit;
11. hosted iOS Simulator execution does not depend on the owner's Mac;
12. physical-device and field gates remain explicit where required;
13. privacy-safe synthetic data and artifact handling are mandatory;
14. resource isolation integrates with Sounding Line rather than inventing a rival lock system;
15. future projects can join through the same registration model.

---

# Appendix A. Standard Evidence Vocabulary

Recommended normalized values:

```text
UNIT_PROVEN
PROVIDER_SIMULATION_PROVEN
BROWSER_EMULATION_PROVEN
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

Project-specific policies may require combinations, but may not weaken the meaning of these classes.

---

# Appendix B. Initial Shared Scenario Catalog

- `core.permission-denied`
- `core.permission-revoked-mid-session`
- `core.background-foreground`
- `core.lock-unlock`
- `core.process-restart`
- `core.network-loss-recovery`
- `core.low-power-quality-degrade`
- `sextant.heading-turn`
- `sextant.spin-three-times`
- `sextant.magnetic-hidden-object`
- `sextant.relative-elevation-stairs`
- `landfall.degraded-gps-route-recovery`
- `landfall.background-arrival`
- `landfall.virtual-world-observation-loss`
- `parallax.adaptive-floor-map`
- `parallax.shared-ar-late-join`
- `parallax.anchor-relocalization`
- `parallax.person-free-calibration`
- `parallax.discovery-hint-escalation`
- `crossdeck.desktop-phone-pair`
- `crossdeck.phone-disconnect`
- `crossdeck.surface-handoff`
- `watchglass.visual-relocalization-abstain`
- `watchglass.person-in-frame-calibration-rejection`
- `wakebook.spatial-memory-crossdeck-capture`

---

# Final Governing Rule

> **Device Lab proves devices and environments without becoming the product they test.**  
> Product projects own their behavior. Drydock owns authored-Chronicle validity. Sounding Line owns software verification and protected acceptance. Device Lab exists so those owners can obtain repeatable, fidelity-honest evidence across simulated, virtual, physical, and field conditions without rebuilding a private laboratory for every new subsystem.

**End of Project Sounding Line Voyagewright Device Lab Governing Annex v1.0**