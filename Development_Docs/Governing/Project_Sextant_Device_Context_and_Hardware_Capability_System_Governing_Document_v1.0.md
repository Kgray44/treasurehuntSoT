---
title: "Project Sextant"
subtitle: "The Device Context and Hardware Capability System"
author: "Voyagewright Engineering"
date: "October 4, 2026"
version: "1.0"
status: "Governing Baseline"
document_id: "VW-SEXTANT-001"
repository: "Kgray44/treasurehuntSoT"
repository_baseline: "a0444352886828258c7d78daccfb4810b1e87a34"
---

> **Governing Principle**  
> Voyagewright must reason about what a device can sense and do without coupling Chronicle logic to raw hardware APIs, vendor-specific behavior, or invented certainty. Project Sextant converts heterogeneous web and native device capabilities into explicit, confidence-bearing, privacy-bounded semantic context and output contracts that other Voyagewright systems can safely consume.

Project Sextant is the canonical device-context and hardware-capability subsystem established by the Voyagewright Spatial Experience Architecture. It exists because device hardware is becoming part of the Chronicle experience itself: orientation, motion, magnetic fields, pressure and relative elevation, haptics, camera and microphone capability, Bluetooth, UWB/ranging, NFC, lifecycle state, power and thermal conditions, and future approved device signals.

Sextant does **not** own the story, the map, the AR scene, the visual recognition result, the Player identity, the device pairing relationship, or authoritative Chronicle progression.

It owns the instrument panel beneath them.

\newpage

# Document Control

- **Document ID:** `VW-SEXTANT-001`
- **Program:** Project Sextant
- **Subsystem:** The Device Context and Hardware Capability System
- **Version:** 1.0
- **Date:** October 4, 2026
- **Status:** Governing baseline
- **Repository:** `Kgray44/treasurehuntSoT`
- **Repository baseline reviewed:** `a0444352886828258c7d78daccfb4810b1e87a34`
- **Umbrella authority:** Voyagewright Spatial Experience Architecture v1.0
- **Primary consumers:** Landfall, Parallax, Watchglass, Storytide, Crossdeck, Lanternwake, future approved systems
- **Progression authority:** Project One Voyage
- **Software verification authority:** Project Sounding Line
- **Device Lab authority:** Project Sounding Line; Sextant registers scenarios but does not own the lab
- **Core implementation rule:** Consumers request semantic capabilities; only Sextant talks directly to generic device-hardware providers


## Normative language

The terms **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative. MUST-level requirements are release gates unless a later owner-approved governing amendment explicitly changes them.

A passing test does not silently waive a governing requirement. A platform API's existence does not make it safe or portable. A device reporting a number does not make that number truthful enough for the use the Chronicle wants to make of it. A browser permission already granted for one purpose does not authorize every future use. And, mercifully, `navigator` is not the platform architecture.

## Authority and precedence

For Project Sextant work, use this order:

1. Voyagewright Global Product Governance Standard for product coherence, human completion, accessibility, discoverability, and owner acceptance.
2. Voyagewright Spatial Experience Architecture v1.0 for cross-project ownership and spatial-experience boundaries.
3. This Project Sextant v1.0 governing document for device-context and hardware-capability semantics.
4. Accepted owner-project amendments that explicitly govern a consumer integration, such as the future Landfall boundary amendment or Parallax/Crossdeck governing documents.
5. Current protected repository source for existing implementation truth and compatibility constraints.
6. Current Sounding Line authority for testing and protected-main acceptance.
7. Task prompts for bounded execution only.

No implementation prompt may quietly move a Sextant capability into Landfall, Parallax, Watchglass, or another project merely because that consumer happens to be the first one that needs it.

\newpage

# Contents

1. Executive Summary  
2. Project Identity and Product Vision  
3. Current Repository Context and Migration Boundary  
4. Non-Negotiable Design Principles  
5. Scope and Non-Goals  
6. Canonical Ownership and System Boundaries  
7. Capability Taxonomy  
8. Canonical Architecture  
9. Capability Registry and Versioning  
10. Provider Architecture  
11. Capability Discovery and Runtime Availability  
12. Permission, Consent, and Purpose Binding  
13. Capability Leases and Multi-Consumer Arbitration  
14. Observation Envelope and Quality Model  
15. Time, Freshness, Ordering, and Clocks  
16. Coordinate Systems and Reference Frames  
17. Orientation and Attitude  
18. Heading and North Reference  
19. Acceleration, Gravity, and Linear Motion  
20. Angular Velocity and Rotation  
21. Stability, Dwell, and Gesture Semantics  
22. Magnetic Field and Anomaly Context  
23. Pressure, Relative Elevation, and Altitude Context  
24. Step, Pace, and Traveled-Distance Evidence  
25. Generic Position Observation Seam  
26. Environmental and Auxiliary Sensors  
27. Camera and Microphone Capability Declarations  
28. Haptics and Tactile Output  
29. Bluetooth Low Energy Capability  
30. UWB and General Ranging Capability  
31. NFC Capability  
32. Lifecycle, Foreground, Background, Lock, and Interruption  
33. Power, Thermal, Performance, and Sampling Quality  
34. Derived Semantic Context  
35. Evidence, Trust, Provenance, and Anti-Fiction Rules  
36. Privacy and Data Minimization  
37. Security and Threat Model  
38. Accessibility and Human Factors  
39. Web Provider Architecture  
40. Native iOS Provider Architecture  
41. Native Android Provider Architecture  
42. Cross-Project Integration Contracts  
43. Landfall Integration  
44. Parallax Integration  
45. Watchglass Integration  
46. Storytide and Lanternwake Integration  
47. Crossdeck Integration  
48. Drydock Validation Contract  
49. Voyagewright Device Lab Integration  
50. Telemetry, Diagnostics, and Operations  
51. Data Model and Service Contracts  
52. Creator/Chronicle Capability Requirements  
53. Failure and Fallback Behavior  
54. Testing and Acceptance Matrix  
55. Implementation Phases  
56. Final Acceptance Criteria  
57. Recommended Technical Baseline  
58. Governance and Change Control  
Appendix A. Canonical Capability Catalog  
Appendix B. Observation and Quality Schemas  
Appendix C. Permission and Consent Matrix  
Appendix D. Semantic Gesture Catalog  
Appendix E. Device Lab Scenario Catalog  
Appendix F. Threat and Privacy Checklist  
Appendix G. Consumer Integration Matrix  
Appendix H. Glossary  
References  
Final Governing Rule

\newpage

# 1. Executive Summary

Project Sextant establishes one platform-wide answer to a deceptively difficult question:

> **What can this device sense and do right now, how trustworthy is that information, what permission and user purpose allow it, and how may the rest of Voyagewright consume it without caring which platform API produced it?**

Voyagewright already has location-aware Chronicles, confidence-aware Landfall navigation, contextual heading/motion/elevation hints, Vision Waypoints, runtime progression, rich animation, and future spatial/multi-device architecture. The next generation of experiences goes much further:

- a Player turns toward a real bearing to reveal a clue;
- the phone recognizes three deliberate rotations without mistaking ordinary hand movement for a ritual;
- a magnet hidden in a physical prop makes a Chronicle compass react more strongly as the Player approaches;
- relative elevation supports a “climb to the upper gallery” experience without pretending a barometer knows an exact floor number by divine revelation;
- a phone produces spatial haptic feedback while Parallax or Landfall guides the Player;
- Bluetooth or UWB provides bounded proximity/ranging context when supported;
- NFC can be an optional deliberate interaction with a physical tag;
- the same device reports that its camera is available to Watchglass without Sextant becoming the image-recognition engine;
- Crossdeck can decide which paired surface is capable of acting as the Chronicle Lens;
- Device Lab can simulate, emulate, and finally qualify these behaviors on real hardware.

Without Sextant, every consumer project would be tempted to implement its own mixture of `DeviceMotionEvent`, Core Motion, Android sensors, permission checks, background lifecycle handling, sampling loops, calibration state, and fallbacks. That would quickly produce multiple interpretations of heading, multiple permission prompts, duplicate sensor listeners, contradictory battery policies, platform-specific branching throughout Chronicle logic, and device context that nobody can truthfully explain to the Player.

Sextant therefore defines a layered system:

```text
WEB / iOS / ANDROID / APPROVED ACCESSORIES
                │
                ▼
        Provider Adapters
                │
                ▼
     Capability Registry + Permission Broker
                │
                ▼
 Normalization + Reference Frames + Calibration
                │
                ▼
      Fusion + Semantic Derivation
                │
                ▼
     Device Context Observation Bus
                │
        ┌───────┼────────┬─────────┬─────────┐
        ▼       ▼        ▼         ▼         ▼
    Landfall  Parallax Watchglass Storytide Crossdeck
                │
                ▼
          One Voyage only
     for authoritative progression
```

The architecture is intentionally semantic. Consumers ask for capabilities such as:

```text
orientation.absolute
heading.estimate
motion.linear-acceleration
motion.rotation-rate
magnetic.anomaly
altitude.relative
haptics.semantic
nearby.ble
nearby.uwb-ranging
nearby.nfc
media.camera
```

They do **not** ask for `CMMotionManager`, `TYPE_ROTATION_VECTOR`, `DeviceOrientationEvent`, or whatever a future platform vendor renames next year while pretending developers requested the character-building exercise.

Project Sextant also makes capability absence a normal state. A Chronicle is not broken because a phone lacks a barometer, because a browser denies absolute orientation, because Web Bluetooth is unsupported, or because UWB exists only on certain hardware. Consumers declare preferred capabilities, minimum acceptable quality, alternate providers, and fallbacks. Drydock proves those paths. Sounding Line and Device Lab prove the actual software/device behavior.

The central outcome is simple:

> **Voyagewright gains powerful hardware-aware experiences without letting hardware variability leak into Chronicle logic or become a source of fake precision, privacy surprises, accessibility failures, and fragmented platform behavior.**

\newpage

# 2. Project Identity and Product Vision

## 2.1 Name

**Project Sextant** is the Device Context and Hardware Capability System.

The name is deliberate. A sextant does not decide where the ship is going or why the destination matters. It is an instrument that turns physical observations into a usable reading. That is precisely the role of this subsystem.

Landfall uses those readings to reason about place and navigation.

Parallax uses them to understand how the handheld device is oriented and what spatial capabilities are available.

Watchglass uses them to understand capture conditions and device context.

Storytide uses semantic interactions such as “held steady,” “rotated three times,” or “magnetic anomaly strong enough” as authored experiential inputs.

Crossdeck uses capability snapshots to decide which active surface can perform which role.

Sextant itself remains the instrument.

## 2.2 Product vision

Voyagewright should be able to make the Player's physical device part of the Chronicle without making the Player feel as though they are operating a laboratory instrument panel.

The Player experiences:

> **Turn toward the harbor.**

Underneath, Sextant may be combining:

- an OS-fused orientation estimate;
- a magnetic calibration state;
- a heading reference classification;
- screen orientation;
- recent motion stability;
- freshness;
- permission state;
- quality degradation;
- lifecycle state.

The Player experiences:

> **The compass pulls harder.**

Underneath, Sextant may be comparing the local magnetic-field magnitude against a recently sampled baseline while rejecting disturbed or stale data and deliberately avoiding the false claim that it has identified a particular metal object.

The Player experiences:

> **The map pulses beneath your hand.**

Underneath, Sextant may be executing a semantic haptic request through Core Haptics, Android haptics, a basic web vibration fallback, or no haptic at all with a visual substitute.

The sophistication belongs inside the platform. The experience belongs to the human.

## 2.3 Core product outcome

At completion:

- every supported device capability has one canonical semantic identity;
- capability discovery is centralized and truthful;
- permission prompts are contextual and purpose-bound;
- providers are replaceable and platform-specific logic is contained;
- high-rate raw streams remain local and ephemeral by default;
- observations carry quality, calibration, freshness, reference frame, and provenance;
- consumers can subscribe without creating duplicate OS listeners;
- device power and thermal cost are arbitrated centrally;
- unsupported or denied capabilities degrade through declared fallbacks;
- synthetic/test providers cannot masquerade as production hardware;
- Device Lab can exercise the same contracts from deterministic simulation through real hardware;
- Landfall, Parallax, Watchglass, Storytide, Crossdeck, and future systems consume Sextant rather than implementing device hardware independently.

\newpage

# 3. Current Repository Context and Migration Boundary

## 3.1 Current protected baseline

This document was prepared against protected `main` at:

```text
a0444352886828258c7d78daccfb4810b1e87a34
```

That baseline already contains:

- the Voyagewright Spatial Experience Architecture v1.0;
- Project Landfall v1.0 and its additive v1.1 Worldspaces amendment;
- accepted Landfall Phases 1 through 3;
- contextual physical heading, motion, and elevation hints in the current Landfall implementation;
- current Drydock provider/simulation architecture;
- Project Sounding Line v1.4 as repository-wide verification authority;
- current One Voyage progression authority.

## 3.2 Existing Landfall behavior must be preserved

Landfall Phase 3 already contains bounded foreground browser/device-context behavior. Accepted current source supports optional motion/orientation acquisition, heading/motion/elevation evidence categories, context fusion, lifecycle cleanup, privacy minimization, and fallback.

That behavior is **accepted product truth**. Sextant does not get to break it merely because ownership is being improved.

The migration rule is:

> **Adopt, normalize, and eventually relocate generic device acquisition into Sextant while preserving Landfall's accepted semantic behavior and progression boundaries.**

## 3.3 Landfall Phase 4 boundary correction

The original Landfall v1.0 governing document deferred to Phase 4:

- iOS and Android native location providers;
- background behavior and notifications;
- offline native map packages;
- native sensor fusion;
- UWB, beacon, NFC, and QR provider expansion;
- production monitoring, privacy, performance, and launch readiness.

The Spatial Experience Architecture now divides that future work correctly:

**Sextant owns:**

- generic hardware capabilities;
- device-context providers;
- motion/orientation/magnetism/barometer;
- generic nearby-hardware capability;
- generic lifecycle/power/thermal context;
- haptic capability;
- capability/permission state.

**Landfall retains:**

- geographic and virtual Worldspace meaning;
- place/navigation semantics;
- routes, regions, waypoints, maps;
- location confidence in geographic/navigation context;
- geofencing as a navigation behavior;
- offline map/content packages;
- arrival/progression completion policy.

A dedicated Landfall integration amendment remains required before later Landfall Phase 4 work adopts the new boundary. Sextant must not silently edit Landfall governance by implementation.

## 3.4 Current code is a compatibility input, not permanent architecture

Existing browser listeners and contextual evidence code may initially remain behind a compatibility adapter. Project Sextant Phase 1 must inventory current acquisition points and define a migration seam before later phases move provider ownership.

No consumer should be forced to migrate in one destructive cutover.

\newpage

# 4. Non-Negotiable Design Principles

## 4.1 Semantic capability over raw API

Consumers request meaning, not vendor APIs.

Good:

```text
heading.estimate
magnetic.anomaly
orientation.absolute
haptics.semantic
```

Bad:

```text
CLLocationManager.startUpdatingHeading()
Sensor.TYPE_MAGNETIC_FIELD
DeviceOrientationEvent.alpha
navigator.vibrate(...)
```

Provider-specific names belong inside provider adapters and diagnostics.

## 4.2 Capability detection over device-model assumptions

Never assume capability because a device model usually has it.

Never deny capability because an unfamiliar model is not in a hard-coded allowlist.

Use runtime capability discovery and qualification.

## 4.3 Quality is multidimensional

A capability can be supported but unusable right now.

A permission can be granted but the observation can be stale.

A sensor can be returning data but magnetically disturbed.

A provider can be healthy but not accurate enough for the requested use.

Sextant MUST represent support, availability, permission, calibration, quality, freshness, and lifecycle independently rather than flattening everything into one `available: true` boolean and congratulating itself.

## 4.4 Confidence, not fiction

Sextant MUST never invent precision.

Examples:

- magnetic field does not mean “this object is magnetic” without a governed inference policy;
- pressure change does not mean “third floor” without external context;
- accelerometer integration does not become authoritative traveled distance because the math produced a number;
- orientation without a known absolute reference does not become a compass bearing;
- UWB range does not become a geographic coordinate;
- a camera existing does not mean Watchglass successfully recognized anything.

## 4.5 Permission is contextual

Do not request every capability at first launch.

A permission request should appear when the user understands why that capability is useful.

The platform must provide a usable alternative when the user declines unless the experience has been explicitly published as a constrained hardware experience.

## 4.6 Raw streams are ephemeral by default

Continuous IMU, magnetic, nearby-device, camera, microphone, location, and environmental streams MUST NOT become routine server telemetry or durable Chronicle history.

Process locally, derive bounded semantic state, retain only what the owning feature actually needs.

## 4.7 One provider layer

No consumer may start its own duplicate raw listener for a capability Sextant already owns.

Multiple consumers share Sextant leases and receive consumer-appropriate observations.

## 4.8 Device context is evidence, not progression authority

Sextant emits observations and semantic events.

It cannot advance chapters, complete objectives, reveal artifacts, or mutate One Voyage directly.

## 4.9 Test providers are unmistakably test providers

Synthetic observations must never be accepted as production hardware evidence because an environment variable was forgotten.

Simulation identity is explicit in every observation and receipt.

## 4.10 Device Lab belongs to Sounding Line

Sextant provides scenarios, provider hooks, assertions, and real-device qualification requirements.

It does not create a private Device Lab fork.

## 4.11 Accessibility and safety outrank theatrical cleverness

No mandatory Chronicle interaction may require rapid spinning, precise hand steadiness, hearing a haptic/audio cue, standing, climbing, holding a heavy device for a long period, or another physical behavior without an accessible alternative.

## 4.12 User pause is real

When the Player pauses a capability or turns off device-context use, consumers MUST receive the change and degrade honestly.

The platform does not keep quietly sampling because the scene designer was excited.

\newpage

# 5. Scope and Non-Goals

## 5.1 In scope

Project Sextant governs:

- stable capability identifiers;
- capability discovery;
- provider selection;
- permission and app-level consent state;
- device-context subscription/lease lifecycle;
- accelerometer data;
- gravity and linear acceleration;
- gyroscope/angular velocity;
- orientation/attitude;
- heading;
- magnetometer and magnetic anomaly semantics;
- barometric pressure and relative elevation;
- optional step/pedometer evidence;
- generic position-observation capability seam;
- environmental sensors approved for product use;
- camera/microphone capability declarations and permission state;
- haptic output capability and bounded execution;
- BLE capability and generic session lifecycle;
- UWB/general ranging capability and generic session lifecycle;
- NFC capability and generic session lifecycle;
- foreground/background/lock/interruption lifecycle context;
- device power/thermal/performance context where platform APIs permit;
- sampling arbitration;
- observation normalization;
- quality, freshness, calibration, provenance, and reference-frame semantics;
- simulation/provider injection boundaries;
- Device Lab scenario definitions for Sextant;
- sanitized diagnostics.

## 5.2 Explicit non-goals

Project Sextant does **not** own:

- Worldspaces, routes, regions, waypoints, maps, or arrival semantics;
- AR world tracking, anchors, scene understanding, object placement, or rendering;
- visual object recognition, OCR, segmentation, or image-model inference;
- Chronicle story meaning;
- authoritative progression;
- Player identity or account/device registration truth;
- multi-surface pairing/session synchronization;
- arbitrary Bluetooth application protocols;
- general IoT automation;
- health-record integration or medical inference;
- biometric authentication;
- covert tracking;
- employee/workforce monitoring;
- security-grade anti-cheat proof;
- durable raw sensor logging;
- exact indoor localization from weak consumer sensors;
- unrestricted background surveillance;
- vendor-specific device fingerprinting.

## 5.3 External accessories

Sextant may support approved external accessories through typed capability providers, but a third-party device protocol does not automatically become core Sextant scope.

The generic hardware seam belongs to Sextant. The domain meaning of the accessory belongs to the appropriate consumer project.

\newpage

# 6. Canonical Ownership and System Boundaries

- **Wayfarer:** **Owns:** canonical person/account and registered device relationships; **Sextant relationship:** Sextant consumes identity/surface references; does not create people
- **Crossdeck:** **Owns:** active surfaces, pairing, synchronization, handoff; **Sextant relationship:** consumes Sextant capability snapshots per surface
- **Sextant:** **Owns:** device capability, device context, generic hardware input/output; **Sextant relationship:** canonical owner
- **Landfall:** **Owns:** place, route, Worldspace, navigation; **Sextant relationship:** consumes Sextant context
- **Parallax:** **Owns:** spatial entities, anchors, AR scenes; **Sextant relationship:** consumes Sextant pose/hardware capability
- **Watchglass:** **Owns:** visual perception and verification; **Sextant relationship:** consumes camera/capture/device context
- **Storytide:** **Owns:** story meaning and narrative interactions; **Sextant relationship:** consumes semantic device interactions
- **Lanternwake:** **Owns:** presentation motion language; **Sextant relationship:** may request semantic haptic cues; never raw vibrator access
- **One Voyage:** **Owns:** authoritative session/progression truth; **Sextant relationship:** receives completion proposals only through owning completion providers
- **Drydock:** **Owns:** authoring verification and simulation; **Sextant relationship:** validates capability/fallback contracts
- **Sounding Line:** **Owns:** software/device verification; **Sextant relationship:** owns Device Lab and acceptance authority


## 6.1 Consumer rule

A consumer may define **what a capability means in its domain**.

It may not redefine **what the capability is**.

Landfall may decide that heading alignment contributes to route guidance.

Parallax may decide that device attitude controls spatial camera interaction.

Storytide may decide that three deliberate rotations satisfy a ritual interaction.

But all three consume the same normalized orientation/motion truth.

\newpage

# 7. Capability Taxonomy

Sextant capabilities are grouped by function rather than platform.

## 7.1 Motion and orientation

- relative orientation;
- absolute orientation where qualified;
- attitude quaternion;
- gravity vector;
- linear acceleration;
- angular velocity;
- rotation delta;
- motion/stationary classification;
- step/pedometer capability;
- device stability;
- bounded gesture semantics.

## 7.2 Field and elevation

- magnetic-field vector;
- magnetic-field magnitude;
- magnetic calibration/disturbance;
- magnetic anomaly relative to local baseline;
- barometric pressure;
- relative elevation;
- absolute altitude source declaration where platform provides it.

## 7.3 Position seam

- generic location observation availability;
- horizontal/vertical accuracy if supplied;
- course/speed if supplied;
- source/freshness metadata.

Landfall remains the geographic interpreter.

## 7.4 Media capability

- camera availability;
- camera permission state;
- microphone availability;
- microphone permission state;
- media device enumeration capability;
- capture-quality capability classes.

Sextant does not own the frame/audio content pipeline.

## 7.5 Nearby hardware

- BLE scan/connect/advertise capability;
- UWB/ranging availability;
- NFC read/write/emulation capability where supported and approved;
- approved beacon/ranging provider capability;
- future nearby technologies behind new capability definitions.

## 7.6 Output capability

- basic haptic feedback;
- rich haptic patterns;
- vibration-only fallback;
- notification capability declaration where needed by consumers;
- output availability/user-disabled state.

## 7.7 Device and lifecycle context

- foreground/background;
- visible/hidden;
- screen/orientation state;
- app interruption;
- permission changes;
- system low-power state where available;
- thermal/performance state where available;
- current active capability leases.

\newpage

# 8. Canonical Architecture

```text
                     CONSUMER PROJECTS
  Landfall   Parallax   Watchglass   Storytide   Crossdeck   Lanternwake
     │          │           │            │           │            │
     └──────────┴───────────┴────────────┴───────────┴────────────┘
                                │
                                ▼
                     SEXTANT SEMANTIC API
             capability requests / observations / outputs
                                │
                     ┌──────────┴──────────┐
                     ▼                     ▼
              Capability Broker       Output Broker
                     │                     │
                     ▼                     ▼
           Permission + Lease Mgmt   Haptic execution
                     │
                     ▼
          Normalize / Calibrate / Fuse
                     │
                     ▼
            Provider Selection Layer
                     │
       ┌─────────────┼───────────────┐
       ▼             ▼               ▼
      Web          iOS Native     Android Native
       │             │               │
       └─────────────┼───────────────┘
                     ▼
               Physical Hardware

      Device Lab synthetic providers enter only at the provider boundary.
```

## 8.1 Core service boundaries

The implementation should converge on services equivalent to:

- `SextantCapabilityRegistry`;
- `SextantProviderRegistry`;
- `SextantPermissionBroker`;
- `SextantLeaseBroker`;
- `SextantObservationNormalizer`;
- `SextantFusionEngine`;
- `SextantGestureEngine`;
- `SextantHapticService`;
- `SextantNearbyService`;
- `SextantProjectionService`;
- `SextantDiagnosticsService`.

Names may differ, but ownership must remain equivalent.

## 8.2 No consumer-side provider selection

Consumers may express:

- desired capability;
- purpose;
- minimum quality;
- update class;
- foreground/background requirements;
- fallback preference.

They must not choose `CoreMotion` versus `DeviceMotionEvent` directly.

\newpage

# 9. Capability Registry and Versioning

## 9.1 Stable identifiers

Capability IDs are stable product contracts, for example:

```text
sextant.orientation.relative
sextant.orientation.absolute
sextant.heading.estimate
sextant.motion.linear-acceleration
sextant.motion.angular-velocity
sextant.motion.stability
sextant.gesture.rotation-count
sextant.magnetic.field
sextant.magnetic.anomaly
sextant.elevation.relative
sextant.position.observation
sextant.haptics.basic
sextant.haptics.rich
sextant.media.camera
sextant.media.microphone
sextant.nearby.ble.scan
sextant.nearby.ble.connect
sextant.nearby.uwb.range
sextant.nearby.nfc.read
sextant.lifecycle.background
sextant.system.thermal
sextant.system.power
```

## 9.2 Capability versions

A capability definition is versioned when its semantic contract changes.

Provider implementation changes do not automatically require a capability version change.

## 9.3 Vendor identity remains diagnostic

Provider IDs may include platform names internally:

```text
web.device-orientation
web.generic-sensor.absolute-orientation
ios.core-motion.device-motion
android.rotation-vector
```

Those are implementation identities, not Chronicle authoring contracts.

## 9.4 Deprecation

A capability may be deprecated only with:

- replacement mapping;
- consumer inventory;
- migration path;
- Drydock compatibility handling;
- historical published-version support policy.

\newpage

# 10. Provider Architecture

## 10.1 Provider contract

Every provider declares:

```text
ProviderDefinition
├─ providerId
├─ platformFamily
├─ capabilities[]
├─ discoveryMethod
├─ permissionRequirements[]
├─ lifecycleConstraints
├─ qualityMetadata
├─ referenceFrames[]
├─ samplingBounds
├─ powerClass
├─ privacyClass
├─ simulationSupport
└─ providerVersion
```

## 10.2 Provider lifecycle

Providers implement a common lifecycle:

```text
DISCOVER
  ↓
QUALIFY
  ↓
REQUEST / AUTHORIZE
  ↓
START
  ↓
ACTIVE / DEGRADED
  ↓
PAUSE / BACKGROUND
  ↓
STOP
  ↓
RELEASE
```

## 10.3 Provider failure is isolated

One provider failing does not crash the capability broker.

If an alternate provider can satisfy the same semantic capability, Sextant may fail over when doing so does not violate the consumer's reference-frame or quality requirements.

## 10.4 Provider hot switching

Switching providers mid-interaction requires a discontinuity marker unless Sextant can prove frame/time continuity.

A compass puzzle should not silently jump 40 degrees because the provider changed and everyone decided not to mention it.

\newpage

# 11. Capability Discovery and Runtime Availability

## 11.1 Separate dimensions

Never represent capability state with one Boolean.

A capability snapshot should separate at least:

```text
support       = SUPPORTED | UNSUPPORTED | UNKNOWN
availability  = AVAILABLE | TEMPORARILY_UNAVAILABLE | BUSY | DEGRADED
permission    = NOT_REQUIRED | PROMPT | GRANTED | DENIED | RESTRICTED
calibration   = NOT_APPLICABLE | UNKNOWN | CALIBRATING | GOOD | DISTURBED
quality       = UNKNOWN | LOW | MEDIUM | HIGH
lifecycle     = ACTIVE_ALLOWED | FOREGROUND_ONLY | BACKGROUND_ALLOWED | SUSPENDED
```

## 11.2 Discovery timing

Cheap feature detection may occur early.

Permission-sensitive or fingerprint-sensitive discovery should occur only when needed.

## 11.3 No hardware inventory dump

Sextant must not expose a detailed list of low-level hardware characteristics to arbitrary Chronicle content. Capability projections are purpose-specific and minimized.

## 11.4 Dynamic changes

Availability may change while the app runs because of:

- permission changes;
- OS settings;
- background restrictions;
- accessory disconnect;
- thermal state;
- system resource pressure;
- camera/microphone contention;
- user pause;
- Bluetooth/NFC/UWB disabled state;
- provider error.

Consumers receive typed change events.

\newpage

# 12. Permission, Consent, and Purpose Binding

## 12.1 OS permission is not the whole policy

The platform may already possess an OS-level permission from an earlier feature. A new Chronicle interaction should still be understandable to the Player.

Sextant therefore distinguishes:

- OS permission;
- Voyagewright app-level capability enablement;
- current consumer purpose;
- current lease.

## 12.2 Capability purpose

Every permission-sensitive request includes a human-understandable purpose code, for example:

```text
NAVIGATION_HEADING
AR_DEVICE_POSE
MAGNETIC_CLUE
CAMERA_VISION_WAYPOINT
BLE_NEARBY_ACCESSORY
UWB_SHARED_PROP
NFC_CHRONICLE_TAG
HAPTIC_GUIDANCE
```

## 12.3 Contextual prompting

Prompt when the capability becomes relevant.

Bad:

> “Voyagewright wants access to Motion, Camera, Bluetooth, NFC, Nearby Devices, Location, Microphone, and Notifications.”

Good:

> “This clue uses the way you turn your phone. Allow motion and orientation for this moment?”

## 12.4 User pause

Voyagewright should provide a clear way to see and pause currently active device-context uses where practical.

Pausing cancels leases and tells consumers the capability is unavailable by user choice.

## 12.5 No coercive permission loop

After denial, do not repeatedly re-prompt. Provide fallback and a clear manually initiated retry path.

\newpage

# 13. Capability Leases and Multi-Consumer Arbitration

## 13.1 Why leases exist

Several systems may need the same hardware simultaneously.

Example:

- Landfall wants heading at modest frequency;
- Parallax wants high-rate attitude while the Chronicle Lens is active;
- Storytide wants only a stable “three rotations completed” semantic event.

Without central arbitration, three listeners run at different rates and each creates its own interpretation.

## 13.2 Lease model

Conceptually:

```text
SextantCapabilityLease
├─ leaseId
├─ surfaceId
├─ consumerId
├─ capabilityId
├─ purpose
├─ desiredUpdateClass
├─ minimumQuality
├─ foregroundRequirement
├─ backgroundRequirement
├─ retentionClass
├─ startTime
├─ expiry
└─ cancellationReason
```

## 13.3 Update classes

Use semantic update classes rather than consumer-selected arbitrary rates:

- `PASSIVE`;
- `LOW_RATE`;
- `INTERACTIVE`;
- `HIGH_FIDELITY_BURST`.

Provider-specific code translates these into safe rates within hardware/platform bounds.

## 13.4 Highest justified rate

If multiple leases share a provider, Sextant may run the provider at the highest justified rate and downsample for lower-rate consumers.

It must not automatically run every sensor at maximum frequency because one animation designer discovered the phrase “120 Hz.”

## 13.5 Automatic lease cleanup

Leases terminate on:

- consumer unmount;
- surface disconnect;
- Voyage end;
- sign-out;
- permission revocation;
- user pause;- expiration;
- hard provider failure;
- owner-specified lifecycle transition.

Leak-free lifecycle behavior is a release gate.

\newpage

# 14. Observation Envelope and Quality Model

Every semantic observation must carry enough metadata to prevent misuse.

```text
SextantObservation<T>
├─ observationId
├─ capabilityId
├─ semanticVersion
├─ value: T
├─ timestampMonotonic
├─ timestampWallOptional
├─ ageMs
├─ sourceClass
├─ providerIdDiagnostic
├─ referenceFrame
├─ confidence
├─ accuracy / uncertainty when meaningful
├─ calibrationState
├─ qualityClass
├─ provenanceRoot
├─ syntheticFlag
├─ lifecycleState
└─ warnings[]
```

## 14.1 Confidence is not accuracy

A provider may be highly confident that the device rotated 30 degrees while absolute heading accuracy remains poor.

Keep these concepts separate.

## 14.2 Quality reasons

Quality should be explainable:

```text
MAGNETIC_DISTURBANCE
ABSOLUTE_REFERENCE_UNAVAILABLE
STALE
BACKGROUND_RESTRICTED
LOW_SAMPLE_RATE
PROVIDER_RESTARTED
THERMAL_DEGRADED
DEVICE_UNSUPPORTED
USER_PAUSED
PERMISSION_DENIED
```

## 14.3 Sanitized consumer projection

Consumers receive only metadata relevant to their use.

A Storytide gesture need not receive the raw magnetic vector merely because the underlying orientation provider used it.

\newpage

# 15. Time, Freshness, Ordering, and Clocks

## 15.1 Monotonic time for motion

Sensor integration and freshness MUST use monotonic time where the platform provides it.

Wall-clock adjustments must not create impossible motion or negative durations.

## 15.2 Wall time for audit only

Wall time may be attached for logs or cross-system correlation, but it is not the primary clock for high-rate device motion.

## 15.3 Sequence and discontinuity

Observations should carry enough sequence/discontinuity information to detect:

- provider restart;
- background suspension;
- large timestamp gap;
- reorientation;
- surface switch;
- simulation seek.

## 15.4 Freshness policy belongs to the consumer contract

Sextant reports age and quality. Consumers declare what is too stale for their use.

Parallax may require very fresh attitude.

Storytide may accept a slower stability classification.

Landfall may use a heading estimate only as a soft directional hint.

\newpage

# 16. Coordinate Systems and Reference Frames

Reference-frame confusion is one of the easiest ways to produce confident nonsense.

## 16.1 Canonical device frame

Sextant MUST define one canonical right-handed device coordinate frame in its implementation design record and convert every provider into it before fusion.

The baseline recommendation is:

- +X toward screen-right;
- +Y toward the physical top of the device screen;
- +Z outward through the front/display side;
- orientation independent of current UI portrait/landscape rotation, with screen-orientation metadata provided separately.

If a provider differs, conversion occurs in the adapter.

## 16.2 World/reference frames

Observations explicitly label frames such as:

- `DEVICE`;
- `SCREEN_ADJUSTED`;
- `GRAVITY_ALIGNED`;
- `EARTH_MAGNETIC`;
- `EARTH_TRUE`;
- `LOCAL_ARBITRARY`;
- `WORLDSPACE_CONSUMER_DEFINED`.

## 16.3 Quaternion internally

Canonical attitude representation SHOULD use a normalized quaternion internally to avoid Euler-angle singularities and ambiguous rotation composition.

Yaw/pitch/roll may be exposed for UI and simple consumers as derived convenience values.

## 16.4 No unlabeled degrees

A value called `heading: 82` without north reference, accuracy, and freshness is not a complete Sextant observation.

\newpage

# 17. Orientation and Attitude

## 17.1 Relative orientation

Relative orientation answers:

> How has the device rotated from a local starting reference?

This can support:

- tilt puzzles;
- relative turns;
- “look behind you” interactions;
- handheld artifact manipulation;
- view alignment.

## 17.2 Absolute orientation

Absolute orientation requires a meaningful Earth or platform reference and usually relies on magnetometer-assisted fusion or an OS-provided reference.

If that reference is unavailable or disturbed, downgrade to relative orientation rather than pretending it remains absolute.

## 17.3 Screen rotation

UI orientation changes must not silently change physical device orientation semantics.

Sextant provides both device-frame orientation and screen-orientation metadata.

## 17.4 Calibration UX

When absolute orientation needs calibration, consuming UI may present a Chronicle-native prompt, but Sextant owns the machine state.

The prompt must not promise that a ritual figure-eight motion guarantees calibration on every platform.

\newpage

# 18. Heading and North Reference

## 18.1 Heading observation

```text
HeadingEstimate
├─ degreesClockwiseFromNorth
├─ northReference: TRUE | MAGNETIC | UNKNOWN
├─ accuracyDegrees
├─ confidence
├─ calibrationState
├─ freshness
└─ disturbanceWarning
```

## 18.2 True versus magnetic north

If the platform provides true heading, expose it with its source and quality.

If only magnetic heading exists, label it magnetic.

Do not silently apply home-grown declination conversion without an approved source and Landfall integration contract.

## 18.3 Heading is directional context, not position

A device facing east does not mean the Player is walking east.

Landfall combines heading with motion and route context as appropriate.

## 18.4 Heading-up maps

Sextant provides heading. Landfall owns whether a map rotates heading-up and how that affects navigation UX.

\newpage

# 19. Acceleration, Gravity, and Linear Motion

## 19.1 Canonical units

Use SI internally:

- acceleration: meters per second squared;
- timestamps: seconds or high-resolution monotonic units converted consistently.

## 19.2 Gravity-separated motion

Where available, prefer platform-fused linear acceleration separated from gravity for movement semantics.

If only acceleration including gravity exists, the provider must declare that distinction.

## 19.3 No unbounded position integration

Double-integrating consumer accelerometer data into position over ordinary Chronicle time is not authoritative dead reckoning.

Bias and noise create position error that grows rapidly.

Use inertial motion for:

- short continuity;
- motion classification;
- gesture recognition;
- impossible-jump rejection;
- route evidence;
- short local interactions.

Let Landfall/map constraints or Parallax tracking provide the appropriate external correction.

## 19.4 Stationary classification

Stationary/moving classification is probabilistic and time-windowed. It must include hysteresis so the system does not alternate between states every time a hand trembles.

\newpage

# 20. Angular Velocity and Rotation

Gyroscope/angular-velocity data supports:

- turn accumulation;
- smooth relative orientation;
- rapid-motion rejection;
- spin counting;
- anti-jitter filtering;
- gesture dynamics.

## 20.1 Canonical unit

Use radians per second internally where practical. Convert provider degrees/second at the adapter.

## 20.2 Accumulated rotation

For a “spin three times” interaction, count accumulated continuous rotation around the relevant gravity-aligned axis, not merely the difference between start and end orientation.

The algorithm must handle wrap-around and avoid incrementing count from small oscillations near ±180/360 boundaries.

## 20.3 Safety

The consuming interaction must provide an accessible alternative to physical spinning.

Sextant may expose the mechanic. Storytide/Drydock determine whether using it is fair.

\newpage

# 21. Stability, Dwell, and Gesture Semantics

## 21.1 Semantic gesture layer

Sextant may derive bounded reusable gesture/context signals such as:

- `DEVICE_STABLE`;
- `TURNED_RELATIVE_ANGLE`;
- `ROTATION_COUNT_REACHED`;
- `TILT_BAND_ENTERED`;
- `SLOW_SWEEP_COVERAGE`;
- `SHAKE_DETECTED`;
- `RAISED_DEVICE`;
- `LOWERED_DEVICE`;
- `MOTION_STARTED`;
- `MOTION_STOPPED`.

## 21.2 Gesture recognizers are deterministic contracts

For governed Chronicle mechanics, recognizers need:

- thresholds;
- hysteresis;
- minimum/maximum duration;
- false-positive tests;
- accessibility fallback;
- reference frame;
- device-lab scenarios.

## 21.3 Consumer-specific semantics

Sextant can provide a generic rotation-count event.

Storytide decides whether that event means “the compass awakens.”

## 21.4 Avoid accidental triggers

A phone jostling in a hand while walking must not satisfy a ritual requiring three deliberate turns.

Use motion structure, continuity, dwell, and reset rules.

\newpage

# 22. Magnetic Field and Anomaly Context

## 22.1 Raw magnetic field

Canonical raw magnetic observations use microteslas and a labeled device reference frame where available.

```text
MagneticFieldObservation
├─ xMicrotesla
├─ yMicrotesla
├─ zMicrotesla
├─ magnitudeMicrotesla
├─ calibrationState
├─ disturbanceState
└─ freshness
```

Magnitude:

```math
B = \sqrt{B_x^2 + B_y^2 + B_z^2}
```

## 22.2 Magnetic anomaly

For treasure-hunt interactions, a useful semantic signal is change relative to a local baseline:

```math
\Delta B = |B - B_0|
```

The implementation may use vector, magnitude, filtered trend, and calibration metadata rather than this simple scalar alone, but the baseline concept must remain understandable.

## 22.3 Not a metal detector

The magnetometer reports local magnetic field.

It does not directly identify “magnetic objects,” “metal,” or a specific prop.

Creator-designed reliable magnetic interactions SHOULD use a known safe magnet or validated prop and a field-tested recipe.

## 22.4 Environmental interference

Nearby speakers, cases, magnets, steel structures, electronics, vehicles, and local magnetic distortion may affect readings.

Sextant must support:

- baseline sampling;
- disturbance detection;
- trend rather than single-sample decisions;
- quality downgrade;
- fallback.

## 22.5 Magnetic safety

Voyagewright must not encourage Creators to place strong magnets directly against device cameras or sensitive hardware.

Creator guidance and Drydock rules should enforce conservative safe interaction patterns.

\newpage

# 23. Pressure, Relative Elevation, and Altitude Context

## 23.1 Relative pressure/elevation

Barometric sensors are most useful for bounded relative change.

Sextant should expose:

```text
RelativeElevationObservation
├─ deltaMeters
├─ pressureHpaOptional
├─ baselineAge
├─ quality
├─ confidence
└─ environmentalWarning
```

## 23.2 Weather drift

Atmospheric pressure changes with weather and building systems.

Long-lived relative-elevation baselines require revalidation.

## 23.3 Absolute altitude

If the platform provides absolute altitude through another fused service, expose source class and uncertainty separately.

Do not merge barometric relative altitude and geographic absolute altitude into one unlabeled number.

## 23.4 Floor inference belongs elsewhere

Sextant may say:

> relative elevation increased approximately 6.2 m.

Landfall may combine that with a known stair route and floor map.

Sextant does not say:

> You are definitely on floor 3.

\newpage

# 24. Step, Pace, and Traveled-Distance Evidence

## 24.1 Step capability

Where platform APIs provide step/pedometer evidence, Sextant may expose:

- step delta;
- cadence class;
- source class;
- freshness;
- permission/availability.

## 24.2 “Twenty paces” interactions

A Chronicle can use step evidence as a theatrical mechanic, but authored tolerances must recognize different stride lengths, mobility patterns, and devices.

Accessible alternatives are mandatory.

## 24.3 Traveled distance

Sextant may expose bounded movement evidence, but Landfall owns route/distance interpretation.

A derived distance estimate must identify its method and uncertainty.

## 24.4 No fake precision

Do not display `97.342 meters walked` because a sensor fusion algorithm produced three decimals.

Product UI should usually use approximate language appropriate to evidence quality.

\newpage

# 25. Generic Position Observation Seam

## 25.1 Why Sextant exposes it

Geographic location is physically produced by device/platform providers. A unified device capability layer benefits from a generic observation seam.

## 25.2 Why Landfall still owns location meaning

Landfall owns:

- Worldspace coordinates;
- map matching;
- route/region interpretation;
- arrival confidence;
- waypoint completion policy;
- location privacy in Chronicle context;
- navigation history.

Sextant may expose a normalized device position observation such as:

```text
PositionObservation
├─ coordinateProviderPayload
├─ horizontalAccuracy
├─ verticalAccuracy
├─ speedOptional
├─ courseOptional
├─ sourceInformationOptional
├─ freshness
└─ providerQuality
```

Landfall translates that into Worldspace/navigation truth.

## 25.3 Migration

The future Landfall boundary amendment decides whether current web geolocation acquisition moves physically into Sextant or remains a specialized Landfall provider behind a Sextant capability facade.

This document does not force a premature code move.

\newpage

# 26. Environmental and Auxiliary Sensors

Sextant may support additional signals when there is a real Voyagewright use case and platform support, such as:

- ambient light;
- proximity;
- humidity/temperature where meaningful and actually available;
- external accessory state;
- headphone motion;
- screen orientation;
- device posture/fold state.

## 26.1 Admission rule

A new auxiliary capability requires:

- defined semantic value;
- privacy classification;
- consumer owner;
- fallback behavior;
- test strategy;
- provider support evidence;
- Device Lab plan.

Do not add sensors merely because an API exists and somebody enjoys collecting nouns.

\newpage

# 27. Camera and Microphone Capability Declarations

## 27.1 Sextant owns capability state, not perception

Sextant may tell Watchglass or Parallax:

- camera available;
- permission granted/denied;
- front/rear capability class;
- basic capture constraints;
- microphone available;
- current contention/error state.

It does not analyze frames or audio.

## 27.2 Media streams remain with the consumer

When Watchglass acquires a camera stream, the bytes remain inside Watchglass's governed capture pipeline. Sextant does not create a second recording path.

## 27.3 Privacy

Camera/microphone leases require explicit purpose and visible consumer state.

Sextant diagnostics may record capability state and failure codes, never ordinary raw media.

## 27.4 Secure contexts on web

Web camera/microphone access requires secure contexts and explicit browser permission. Sextant must surface denial and browser-policy failure honestly.

\newpage

# 28. Haptics and Tactile Output

## 28.1 Output abstraction

Consumers request semantic haptic cues, not platform vibration APIs.

Canonical patterns may include:

- `TICK`;
- `CONFIRM`;
- `WARNING`;
- `DISCOVERY`;
- `DIRECTIONAL_PULSE`;
- `PROXIMITY_RAMP`;
- `HEARTBEAT`;
- bounded custom authored pattern.

## 28.2 Capability tiers

- basic on/off vibration;
- standard system haptic feedback;
- rich transient/continuous haptics;
- advanced waveform capability.

## 28.3 Respect user settings

System-level haptic disablement, reduced sensory preferences, silent/DND behavior where applicable, and platform accessibility settings must be respected.

## 28.4 Fallback

Every important haptic cue has a visual/text/audio-independent equivalent.

## 28.5 Safety and fatigue

No infinite vibration.

No high-intensity continuous haptic pattern as default.

Repeated haptic guidance must use rate and duration limits.

## 28.6 Lanternwake relationship

Lanternwake/Storytide may own experiential choreography and timing. Sextant owns capability translation and safe execution.

\newpage

# 29. Bluetooth Low Energy Capability

## 29.1 Scope

Sextant may expose generic BLE capabilities:

- availability;
- permission;
- scan;
- connect/disconnect;
- GATT service/characteristic discovery primitives;
- advertising where approved;
- bounded signal-strength context;
- session lifecycle.

## 29.2 Domain ownership

BLE does not inherently mean location.

Landfall may consume a beacon-style provider.

Crossdeck may consume BLE as an out-of-band pairing transport.

Parallax may consume an approved accessory.

The application-specific protocol belongs to the consumer/domain project.

## 29.3 Privacy

Nearby-device scanning can reveal information about the physical environment.

Scanning requires contextual permission/purpose and must not be continuously logged.

## 29.4 RSSI

BLE RSSI is noisy and environment-dependent. Do not treat it as exact distance without an explicitly qualified model and uncertainty.

## 29.5 Security

Sensitive accessory data requires application-layer security even when the transport is BLE.

\newpage

# 30. UWB and General Ranging Capability

## 30.1 Semantic capability

Sextant should model ranging generically enough to support approved technologies while preserving technology-specific security and quality.

```text
RangingObservation
├─ peerSessionId
├─ distanceMeters
├─ directionOptional
├─ uncertainty
├─ technologyClass
├─ foreground/backgroundState
├─ freshness
└─ securityMode
```

## 30.2 UWB

UWB can provide precise relative ranging on supported hardware. It does not provide global position by itself.

## 30.3 Secure out-of-band setup

Peer ranging often requires an out-of-band exchange such as BLE or another authenticated channel.

Sextant owns the generic session capability; Crossdeck or the owning feature controls who the peer is and why the session exists.

## 30.4 Relay/replay security

Where platform APIs expose secure ranging/session-key modes, prefer them. Static or weak configurations must not be advertised as strong presence proof.

## 30.5 Background limitations

Background ranging behavior varies significantly by platform/version/device. Sextant capability state must reflect current restrictions rather than assume foreground behavior continues in the background.

\newpage

# 31. NFC Capability

## 31.1 Intentional short-range interaction

NFC is useful precisely because it normally requires deliberate close-range action.

Potential Chronicle use cases include:

- optional physical artifact tag;
- museum/exhibit tag;
- Creator-provided prop;
- accessory setup;
- offline encoded clue package.

## 31.2 Sextant scope

Sextant owns:

- support/availability;
- permission/entitlement state;
- session lifecycle;
- generic NDEF/tag result envelope;
- write capability declaration where approved.

The consumer owns the payload schema and validation.

## 31.3 Tag data is untrusted input

Never execute arbitrary code or trust URLs/commands from a tag merely because it was physically scanned.

Parse through strict consumer schemas.

## 31.4 Optional provider only

Physical tags remain optional infrastructure in ordinary Landfall experiences unless a Chronicle is explicitly published as requiring them.

\newpage

# 32. Lifecycle, Foreground, Background, Lock, and Interruption

## 32.1 Canonical lifecycle context

Sextant should expose normalized lifecycle events such as:

```text
SURFACE_FOREGROUND
SURFACE_BACKGROUND
SURFACE_HIDDEN
SURFACE_VISIBLE
SCREEN_LOCKED_OR_SUSPENDED
INTERRUPTION_STARTED
INTERRUPTION_ENDED
OS_PERMISSION_CHANGED
PROVIDER_SUSPENDED
PROVIDER_RESUMED
```

Not every platform exposes every state directly. Unknown remains valid.

## 32.2 Foreground-first safety

High-rate sensor access should default to the foreground unless the feature has an explicit background contract and platform support.

## 32.3 Background provider rules

Background access is capability-specific and platform-specific.

Sextant must not simulate continuity by repeating the last foreground value as if the sensor remained live.

## 32.4 Resume discontinuity

On resume after a meaningful gap:

- mark discontinuity;
- requalify permissions;
- recheck calibration/availability;
- reset gesture integrators that cannot safely bridge the gap;
- notify consumers.

## 32.5 Sign-out and access revocation

All owned sensor/accessory leases terminate immediately on sign-out or revoked surface access.

\newpage

# 33. Power, Thermal, Performance, and Sampling Quality

## 33.1 Device cost is a first-class constraint

Persistent high-rate sensors, camera, Bluetooth scans, UWB, and haptics consume power and can increase thermal load.

Sextant must arbitrate quality rather than assume the highest rate is always correct.

## 33.2 Quality adaptation

Provider quality may adapt based on:

- current consumer need;
- foreground/background state;
- thermal pressure;
- low-power state;
- battery policy where available;
- frame/render load;
- hardware support.

## 33.3 Consumer notifications

If quality degrades below a lease's minimum requirement, the consumer receives a typed degradation instead of silently receiving worse data.

## 33.4 No false battery portability

Web battery/thermal APIs are inconsistent. Sextant may expose `UNKNOWN` rather than invent cross-platform parity.

## 33.5 Resource budgets

Each provider class should have documented expected cost profiles used by Device Lab and performance tests.

\newpage

# 34. Derived Semantic Context

Sextant may derive reusable context from raw/normalized observations.

Examples:

- device stable for N milliseconds;
- approximate turn angle;
- deliberate rotation count;
- motion likely walking;
- motion likely stationary;
- magnetic anomaly increasing/decreasing;
- relative elevation rising/falling/stable;
- device pointed roughly downward/upward;
- sweep coverage over a bounded arc;
- nearby peer range trend;
- haptic capability grade.

## 34.1 Derivation versioning

Derived semantics are versioned because changes to thresholds can change Chronicle behavior.

## 34.2 Explainability

A semantic observation should be able to report why it exists in sanitized form.

Example:

> “Rotation count reached: three continuous clockwise turns; two brief reversals ignored below reset threshold.”

## 34.3 Consumer thresholds

Sextant can provide a reusable base semantic. Consumers may declare additional policy thresholds through typed configuration, but must not bypass the underlying quality/freshness contract.

\newpage

# 35. Evidence, Trust, Provenance, and Anti-Fiction Rules

## 35.1 Trust classes

Device observations should carry trust classes such as:

- `LOCAL_HARDWARE_OBSERVATION`;
- `OS_FUSED_OBSERVATION`;
- `ACCESSORY_OBSERVATION`;
- `CLIENT_DERIVED_SEMANTIC`;
- `SIMULATED`;
- `REPLAYED_TEST_FIXTURE`.

## 35.2 Consumer devices are not security hardware

A client phone can be modified, spoofed, emulated, or instrumented.

Sextant evidence may support narrative fairness. It is not automatically identity proof, anti-cheat proof, or authorization proof.

## 35.3 Provenance roots

Independent evidence policies must distinguish truly independent sources from multiple derived values sharing one underlying provider.

Example: heading and absolute orientation derived from one fused rotation provider do not automatically count as two independent confirmations.

## 35.4 Freshness and anti-replay

Completion-relevant receipts should bind appropriate context such as:

- actor/session;
- surface;
- Chronicle version;
- consumer moment;
- observation sequence;
- timestamp/expiry;
- capability version;
- provenance root.

The exact receipt authority belongs to the consuming completion provider and One Voyage.

## 35.5 Contradiction

Contradictory device evidence should degrade confidence. Do not average contradictory categorical facts until the disagreement disappears aesthetically.

\newpage

# 36. Privacy and Data Minimization

## 36.1 Default retention

Raw high-rate sensor streams: **no durable retention**.

Raw nearby-device inventories: **no durable retention** by default.

Camera/microphone bytes: governed by consumer; Sextant retains none.

Device hardware serials: **never ordinary Sextant data**.

## 36.2 Durable state

Durable Sextant records should generally be limited to:

- capability preference/consent state where appropriate;
- provider compatibility facts that do not fingerprint the user unnecessarily;
- sanitized error/health aggregates;
- versioned semantic configuration;
- accepted completion evidence references owned by consumers;
- Device Lab evidence from synthetic or explicitly consented qualification devices.

## 36.3 Sensor fingerprinting

Fine-grained sensor bias/calibration characteristics can contribute to fingerprinting. Do not expose or persist raw calibration fingerprints to Chronicle content, Community content, ordinary analytics, or unrelated consumers.

## 36.4 Nearby privacy

BLE/NFC/UWB interactions can reveal nearby devices or physical co-presence. Access is purpose-bound and minimized.

## 36.5 Location privacy

Generic position observations remain subject to Landfall/Wayfarer/Sealed Hold location privacy policies. Sextant does not create a second location-history database.

## 36.6 Diagnostic logs

Allowed:

```text
capability=orientation.absolute
state=DEGRADED
reason=MAGNETIC_DISTURBANCE
```

Not allowed by default:

```text
raw magnetometer stream for 14 minutes
exact GPS trail
nearby BLE MAC/device inventory
camera frames
microphone audio
```

\newpage

# 37. Security and Threat Model

## 37.1 Threats

Project Sextant must consider:

- spoofed client sensor data;
- replayed observations;
- malicious Chronicle configurations requesting excessive permissions;
- sensor side channels/fingerprinting;
- malicious NFC payloads;
- BLE impersonation;
- UWB relay/replay and insecure out-of-band exchange;
- accessory protocol injection;
- synthetic providers enabled in production;
- stale permission state;
- provider substitution;
- raw media leakage;
- background overcollection;
- denial-of-service through excessive subscriptions;
- haptic abuse;
- malformed provider values including NaN/infinity/out-of-range.

## 37.2 Input validation

All provider values are validated before normalization.

Reject impossible/non-finite values rather than letting `NaN` navigate the ship.

## 37.3 Rate limits

Consumer capability requests and expensive operations such as BLE scans or haptic bursts need bounded rate policy.

## 37.4 Test/prod separation

Production builds reject unsigned/unapproved synthetic provider injection.

## 37.5 Privileged capabilities

Capabilities with strong privacy or radio implications may require additional app entitlements, manifest declarations, platform review, or user action. Their absence is not a runtime error; it is capability state.

\newpage

# 38. Accessibility and Human Factors

## 38.1 Every physical gesture needs another path when required

Examples:

- spin ritual -> button/alternative puzzle;
- tilt puzzle -> touch control;
- steady hold -> explicit confirm or longer tolerance;
- magnetic hunt -> visual/semantic search fallback;
- haptic direction -> visual/text direction;
- audio/microphone interaction -> non-audio alternative;- walking/paces -> map or Captain fallback.

## 38.2 Motion sensitivity

Physical device movement can trigger dizziness or discomfort. Reduced-motion preferences should influence authored interactions and prompts.

## 38.3 Motor accessibility

Do not require precision hand steadiness beyond realistic tolerance.

## 38.4 Cognitive clarity

When calibration or permission is needed, explain the action in plain language and do not overload the Player with sensor jargon.

## 38.5 No punishment for slower interaction

Timers for gestures and search interactions should accommodate accessibility settings and authored alternatives.

\newpage

# 39. Web Provider Architecture

## 39.1 Web strategy

Web is a valuable baseline because it avoids forcing a native install for ordinary Chronicles.

However, web capability varies widely by API and browser.

Sextant's web layer must be aggressively feature-detected and fallback-oriented.

## 39.2 Device orientation and motion

Current mobile web can broadly expose device orientation and motion, with secure-context requirements and permission differences across browsers. Some environments require transient user activation for `requestPermission()`.

Sextant should prefer the widely supported Device Orientation/Motion event family for broad compatibility when it satisfies the semantic need.

## 39.3 Generic Sensor API

The Generic Sensor API can provide cleaner lower-level primitives in supporting environments, but it is not universally implemented across browser engines. Treat it as an optional provider, not the sole web architecture.

## 39.4 Web Bluetooth

Web Bluetooth is limited/experimental across major browsers. It may provide an enhanced-web provider, never a universal baseline.

## 39.5 Web NFC

Web NFC is limited/experimental and primarily NDEF-oriented. It is an optional provider only.

## 39.6 Web vibration

The Vibration API is limited and may be disabled by device/browser settings. It is a basic fallback, not rich haptic parity.

## 39.7 Camera/microphone

`getUserMedia()` is broadly available in secure contexts and always requires permission. Watchglass/other consumers own capture streams.

## 39.8 No fake parity

Web capability grades may be lower than native. The UI should say “this device/browser supports a simplified experience” rather than emulate unavailable hardware semantics badly.

\newpage

# 40. Native iOS Provider Architecture

## 40.1 Core Motion

The iOS provider family can use Core Motion for:

- accelerometer;
- gyroscope;
- processed device motion;
- attitude;
- rotation rate;
- user acceleration;
- magnetic field;
- pedometer where supported;
- barometric altitude where supported.

## 40.2 Core Location

Core Location may provide:

- location observation;
- heading;
- altitude/location accuracy;
- region-related capability consumed by Landfall;
- beacon-related capability where governed.

Sextant owns generic capability state; Landfall owns navigation semantics.

## 40.3 Core Haptics

Use capability checks before rich haptic patterns. Not all Apple devices support the same haptic features.

## 40.4 Core NFC

Core NFC provider support is conditional on compatible hardware, entitlement/capability configuration, and user flow.

## 40.5 Nearby Interaction

Nearby Interaction can provide UWB-based relative distance and direction on supported devices/accessories. Background behavior is platform/version restricted and must be discovered rather than assumed.

## 40.6 Native background behavior

Provider activation must obey Apple background modes, authorization state, and energy constraints. Native capability does not mean perpetual access.

## 40.7 Privacy strings and entitlements

Every permission-sensitive native capability requires current platform-compliant usage descriptions and entitlements. Missing declarations are build/configuration defects, not reasons to bypass the OS.

\newpage

# 41. Native Android Provider Architecture

## 41.1 Android Sensor framework

Android provider families may use:

- accelerometer;
- linear acceleration;
- gravity;
- gyroscope;
- rotation vector;
- geomagnetic rotation vector;
- magnetic field;
- step detector/counter;
- pressure;
- other approved sensors.

## 41.2 Sensor availability

Android devices vary significantly. Query actual sensors/capabilities at runtime.

## 41.3 Bluetooth

Modern Android requires specific Nearby Device runtime permissions for scan/connect/advertise behavior. Sextant must expose the permission state without asking every consumer to understand API-level history.

## 41.4 NFC

Android supports reader/writer and related NFC modes on capable devices. Runtime hardware availability is checked rather than assumed.

## 41.5 UWB and ranging

Android supports UWB on compatible hardware and newer unified ranging APIs on newer platform versions. Sextant should model semantic ranging capability and select the best available native provider.

## 41.6 Haptics

Android haptic capability varies from basic vibration to richer effects. Use support-aware semantic patterns and respect system settings.

## 41.7 Background restrictions

Doze, App Standby, foreground-service requirements, permission state, and platform version materially affect sensor/radio behavior. Sextant reports real availability rather than assuming foreground semantics in the background.

\newpage

# 42. Cross-Project Integration Contracts

Project Sextant must provide narrow, typed consumer contracts.

## 42.1 Consumer request

```text
CapabilityRequest
├─ consumerId
├─ surfaceId
├─ capabilityId
├─ purpose
├─ minimumQuality
├─ updateClass
├─ foreground/background needs
├─ privacyRetentionClass
└─ fallbackExpectation
```

## 42.2 Capability snapshot

```text
CapabilitySnapshot
├─ capabilityId
├─ support
├─ availability
├─ permission
├─ calibration
├─ quality
├─ lifecycle
├─ providerClass
└─ lastChangedAt
```

## 42.3 Observation subscription

Consumers receive typed streams/events. They do not access provider objects.

## 42.4 Output request

```text
HapticRequest
├─ semanticPattern
├─ intensityClass
├─ durationBudget
├─ priority
├─ cancelKey
└─ accessibilityFallbackDeclared
```

\newpage

# 43. Landfall Integration

Landfall consumes Sextant to improve world/navigation context.

Examples:

- heading for directional cues;
- motion for route continuity;
- relative elevation for vertical-transition evidence;
- step/motion evidence for approximate pace mechanics;
- generic position observations;
- BLE/beacon/UWB proximity as optional providers;
- lifecycle/background capability state.

## 43.1 Landfall remains confidence owner in navigation context

Sextant may say:

> `relative elevation +5.8 m, medium quality`.

Landfall decides whether this contributes to:

> `likely changed level`.

## 43.2 Existing Phase 3 compatibility

The future Landfall boundary amendment must define migration from accepted foreground sensor hints to Sextant providers without changing accepted semantics by accident.

## 43.3 No route completion from Sextant directly

All Landfall progression remains through Landfall completion providers and One Voyage.

\newpage

# 44. Parallax Integration

Parallax consumes Sextant for device context and hardware availability, including:

- device attitude;
- gravity;
- angular velocity;
- motion stability;
- haptic capability;
- camera capability;
- UWB/ranging capability;
- lifecycle state;
- power/thermal quality hints.

## 44.1 Parallax owns spatial tracking

Sextant orientation is not a replacement for AR world tracking.

Parallax owns:

- world anchors;
- plane/surface understanding;
- scene coordinate frames;
- relocalization;
- shared spatial reality.

## 44.2 Device pose versus world pose

Sextant supplies device-frame observations.

Parallax may fuse them into its spatial runtime, but the resulting world-space pose belongs to Parallax.

\newpage

# 45. Watchglass Integration

Watchglass consumes:

- camera availability/permission;
- device orientation/motion context when useful;
- lifecycle state;
- power/thermal degradation;
- optionally stability/sweep coverage.

Watchglass owns:

- image acquisition pipeline after lease handoff;
- frame analysis;
- recognition;
- OCR;
- segmentation;
- evidence confidence;
- safe abstention.

Sextant must never produce `OBJECT_RECOGNIZED` merely because a camera exists.

\newpage

# 46. Storytide and Lanternwake Integration

## 46.1 Storytide

Storytide may use semantic interactions:

- face a bearing;
- rotate N times;
- tilt into a band;
- hold steady;
- detect a magnetic anomaly;
- climb approximately a relative elevation;
- tap an NFC tag;
- approach a ranged accessory.

Storytide owns why the interaction matters.

## 46.2 Lanternwake

Lanternwake may coordinate device-context presentation and haptic choreography.

It cannot bypass Sextant's output broker or run arbitrary raw vibration loops.

## 46.3 Completion

Storytide completion policy converts accepted semantic evidence into a One Voyage proposal through the canonical runtime.

\newpage

# 47. Crossdeck Integration

Crossdeck owns the relationship between one person and multiple active surfaces.

Sextant provides per-surface capability snapshots.

Example:

```text
Desktop
- camera: available
- motion: unsupported
- haptics: unsupported

Phone
- orientation: high
- magnetic anomaly: available
- rich haptics: available
- camera: available
- UWB: unavailable
```

Crossdeck may then select the phone as the Chronicle Lens surface.

Sextant does not pair the phone to the desktop or own session synchronization.

\newpage

# 48. Drydock Validation Contract

Every Chronicle/device-capability requirement should be statically and dynamically verifiable.

Drydock eventually needs to understand:

- capability IDs and versions;
- required/preferred classification;
- minimum quality;
- permission requirement;
- fallback chain;
- accessibility equivalent;
- restricted-hardware publication classification;
- simulated outcomes;
- provider failure modes;
- lifecycle/background restrictions.

## 48.1 Typical Drydock findings

- mandatory magnetometer interaction with no fallback;
- native-only capability used in a general web Chronicle;
- haptic-only guidance with no visual/text equivalent;
- UWB required but target audience is unrestricted;
- camera/microphone requested without purpose copy;
- background behavior assumed where provider is foreground-only;
- exact progression based on low-confidence client motion alone;
- capability ID deprecated or unknown.

## 48.2 Simulation outcomes

Drydock can simulate semantic Sextant outcomes. Device Lab proves actual provider behavior.

Do not confuse those roles.

\newpage

# 49. Voyagewright Device Lab Integration

## 49.1 Ownership

Device Lab is a shared Sounding Line facility.

Sextant contributes:

- provider simulation interfaces;
- virtual sensor hooks;
- scenario definitions;
- assertions;
- representative device matrices;
- qualification requirements.

## 49.2 Tiers

### D0 - Deterministic provider simulation

Typed synthetic observations, exact sequences, fast CI.

### D1 - Browser/device API emulation

Browser permission behavior, orientation/motion events, virtual sensors where supported.

### D2 - Android Emulator

Sensor injection, location, pose, lifecycle, Doze/background, network, permission scenarios where supported.

### D3 - iOS Simulator / hosted macOS

Build/lifecycle/location/UI integration supported by Apple simulator environment. Simulator limitations remain explicit.

### D4 - Controlled real devices

Actual phone hardware, real sensor noise, haptics, camera, BLE, NFC, UWB where available, battery/thermal.

### D5 - Field qualification

Actual walking, indoor/outdoor environments, magnetic props, multi-device interactions, interference conditions.

## 49.3 Evidence honesty

A simulated magnetometer pass is not real magnetic-field qualification.

An iOS Simulator pass is not proof of a real iPhone barometer.

A real-device pass in one clean office is not proof of every museum, steel ship, or magnet-infested kitchen.

Every receipt states tier and limitations.

\newpage

# 50. Telemetry, Diagnostics, and Operations

## 50.1 Sanitized diagnostics

Useful metrics include:

- capability support rates by broad platform family;
- permission-denial rate by purpose;
- provider start failures;
- calibration-disturbance rate;
- lifecycle suspend/resume count;
- thermal quality downgrade count;
- lease duration distributions;
- fallback frequency;
- synthetic/real test coverage.

## 50.2 No raw sensor telemetry by default

Do not ship continuous sensor values to Grafana/Sentry/analytics.

## 50.3 Player-facing device context status

Consumers should be able to present a human-readable status such as:

> Motion is being used for this clue.  
> Camera is off.  
> Bluetooth is not being used.  
> You can pause motion access.

## 50.4 Creator diagnostics

Creator field testing may show sanitized capability and quality information necessary to understand why an authored interaction is failing.

## 50.5 Operations

Provider regressions should be diagnosable by capability/provider version and platform family without collecting device fingerprints.

\newpage

# 51. Data Model and Service Contracts

This governing document does not freeze exact database names, but it freezes semantic relationships.

## 51.1 Mostly runtime state

Most Sextant observations belong in memory/runtime state, not the database.

## 51.2 Durable configuration candidates

Durable records may include concepts equivalent to:

```text
SextantCapabilityDefinition
SextantProviderDefinition
SextantSemanticDerivationDefinition
SextantHapticPatternDefinition
SextantCapabilityPolicy
SextantDeviceCompatibilityNote
```

Only if runtime/source-code registries are insufficient and persistence adds real value.

## 51.3 Preference/consent

Wayfarer or another canonical privacy/settings owner may store user preferences such as app-level device-context pause/allow choices. Sextant consumes them.

Do not create a competing account-settings domain.

## 51.4 Evidence

Completion evidence belongs to the consumer/One Voyage domain. Sextant may supply a bounded observation receipt object, but it should not build a second Chronicle event ledger.

\newpage

# 52. Creator/Chronicle Capability Requirements

Creators should not configure raw hardware APIs.

A capability-aware authored interaction should compile to something like:

```text
CapabilityRequirement
├─ capabilityId
├─ semanticVersionRange
├─ importance: PREFERRED | REQUIRED_RESTRICTED
├─ minimumQuality
├─ fallbackIds[]
├─ accessibilityAlternative
├─ userPurposeCopy
└─ DrydockScenarioRequirements
```

## 52.1 Preferred by default

Ordinary Chronicles should prefer capabilities with meaningful fallbacks.

## 52.2 Restricted experiences

A Creator may intentionally publish an experience that requires special hardware only if:

- requirement is explicit before play/install;
- Harborlight/distribution surfaces label it;
- Drydock validates it;
- no ordinary baseline audience is misled;
- accessibility implications are clear.

## 52.3 Capability preview

Creator Studio should eventually show capability profiles such as:

- Web baseline;
- Enhanced web;
- Native standard;
- Native advanced;
- Accessory required.

These are product-support profiles, not promises about every individual device.

\newpage

# 53. Failure and Fallback Behavior

Canonical failure reasons include:

```text
CAPABILITY_UNSUPPORTED
CAPABILITY_UNKNOWN
PERMISSION_REQUIRED
PERMISSION_DENIED
PERMISSION_RESTRICTED
PROVIDER_UNAVAILABLE
PROVIDER_FAILED
CALIBRATION_REQUIRED
QUALITY_TOO_LOW
MAGNETIC_DISTURBANCE
BACKGROUND_RESTRICTED
THERMAL_DEGRADED
USER_PAUSED
LEASE_EXPIRED
ACCESSORY_DISCONNECTED
RANGING_SESSION_FAILED
NFC_READ_FAILED
SIMULATION_ONLY
```

## 53.1 Every failure is actionable

Consumer UX should answer:

- what happened;
- whether retry helps;
- whether permission/settings help;
- whether another device/surface can take over;
- what fallback exists.

## 53.2 No infinite calibration loops

If a capability cannot qualify after bounded attempts, degrade to fallback.

## 53.3 Crossdeck handoff

If another paired surface can satisfy the capability, Crossdeck may offer a handoff rather than failing the Chronicle.

Example:

> “This laptop cannot use device motion. Continue this clue on your phone.”

\newpage

# 54. Testing and Acceptance Matrix

## 54.1 Unit and contract tests

Required coverage includes:

- capability registry uniqueness/versioning;
- provider selection;
- state dimensions;
- permission broker;
- lease arbitration;
- cleanup;
- coordinate conversion;
- quaternion normalization;
- heading wrap-around;
- stale/discontinuity behavior;
- unit conversion;
- magnetic baseline/anomaly filtering;
- gesture thresholds and false positives;
- elevation drift handling;
- haptic fallback;
- provider failure/failover;
- synthetic-provider rejection in production.

## 54.2 Property/adversarial tests

Examples:

- arbitrary heading wrap sequences;
- random orientation discontinuities;
- NaN/infinite sensor values;
- very high/low timestamp deltas;
- provider restart mid-gesture;
- repeated permission state changes;
- multiple consumers with conflicting rate requirements;
- out-of-order observations;
- magnetic spikes;
- background/resume gaps;
- accessory disconnect/reconnect.

## 54.3 Browser tests

Test representative web capabilities under:

- permission granted;
- denied;
- method absent;
- secure/insecure-context behavior where testable;
- orientation changes;
- hidden/background page lifecycle;
- device-event simulation where supported;
- fallback UI.

## 54.4 Native tests

Native unit/integration/UI tests cover provider lifecycles and permissions, but simulator limitations must be recorded.

## 54.5 Real device matrix

Final closure requires representative real hardware across:

- recent iPhone class with Core Motion/barometer/haptics;
- iPhone/iPad class lacking some rich haptics or optional capability;
- recent Pixel/Samsung-class Android;
- Android device lacking UWB;
- at least one device with meaningful magnetometer disturbance case;
- BLE/NFC/UWB hardware where those providers are declared production-ready.

Exact models may change. Capability classes matter more than brand collecting.

## 54.6 Field conditions

Test:

- indoor steel/concrete environment;
- ordinary home room;
- outdoor open sky;
- moving/walking;
- screen lock/background transitions;
- low-power/thermal degradation where reproducible;
- magnetic prop interaction;
- noisy magnetic environment;
- denied permissions;
- accessibility fallbacks.

\newpage

# 55. Implementation Phases

Project Sextant is a five-phase program. Every phase is a mainline-safe plateau. No phase may leave accepted `main` depending on the next phase's existence.

## 55.1 Phase 1 - **Set the Sextant**
### Capability Registry, Provider Foundation, Permission Broker, and Compatibility Boundary

### Mission

Create the canonical Sextant domain without changing the meaning of accepted Chronicle experiences.

### Required work

- canonical capability IDs and versions;
- provider registry and base interfaces;
- support/availability/permission/calibration/quality state model;
- observation envelope;
- canonical units/time/reference-frame contracts;
- permission broker foundation;
- capability leases and cleanup;
- synthetic-provider identity;
- current Landfall device-context inventory;
- compatibility adapter around accepted Landfall Phase 3 foreground sensor behavior;
- Drydock-readable capability definitions;
- initial Device Lab D0 scenario hooks;
- documentation and ownership registry entries.

### Non-goals

- no major new Player-facing sensor mechanic;
- no native app;
- no UWB/BLE/NFC feature implementation;
- no Parallax/Crossdeck implementation;
- no destructive Landfall provider removal.

### Release gate

All current consumers can remain behaviorally unchanged while the new capability/provider foundation exists, current Landfall behavior is covered by compatibility tests, and no consumer requires direct new raw-hardware code.

---

## 55.2 Phase 2 - **Hold the Horizon**
### Web Orientation, Motion, Gestures, Stability, and Haptic Output

### Mission

Make ordinary web/mobile device motion a first-class semantic capability layer.

### Required work

- Device Orientation/Motion web providers;
- optional Generic Sensor providers where useful and supported;
- relative/absolute orientation;
- quaternion/reference-frame normalization;
- heading semantic observation;
- acceleration/gravity/linear motion;
- angular velocity;
- stability/motion classification;
- governed gesture engine;
- semantic haptic output with web/native-compatible contract foundation;
- contextual permission UX contracts;
- user pause/status projection;
- battery-conscious lease arbitration;
- Landfall compatibility migration where the approved boundary allows;
- Device Lab D0/D1 scenarios;
- accessibility alternatives for all example gestures.

### Release gate

Web device-context behavior is centralized, lifecycle-safe, permission-aware, reference-frame tested, and consumer projects can request orientation/motion semantics without directly touching browser sensor APIs.

---

## 55.3 Phase 3 - **Read the Field**
### Magnetism, Elevation, Nearby Hardware, and Rich Derived Context

### Mission

Add advanced physical-context capabilities while preserving fallback-first design.

### Required work

- magnetic-field provider semantics;
- calibration/disturbance/baseline/anomaly model;
- pressure/relative-elevation model;
- step/pedometer seam where supported;
- camera/microphone capability declarations;
- BLE generic capability/session architecture;
- NFC generic capability/session architecture;
- UWB/general ranging architecture;
- secure peer/out-of-band session contracts;
- magnetic-hunt reference mechanic and safety guidance;
- Creator/Drydock capability requirement schemas;
- Web Bluetooth/Web NFC provider support only where platform capability exists;
- Device Lab scenarios through D2 where available;
- privacy and nearby-device threat tests.

### Release gate

Advanced capabilities are optional, capability-detected, and unable to strand ordinary Chronicles. Magnetic and elevation semantics are honest, nearby sessions are bounded and secure by contract, and unsupported hardware produces explicit fallback state.

---

## 55.4 Phase 4 - **Take It Afield**
### Native iOS/Android Providers, Lifecycle, Background Capability, and Consumer Integration

### Mission

Realize Sextant as the shared native-capability layer and move the deferred generic hardware responsibilities out of Landfall cleanly.

### Required work

- iOS Core Motion provider family;
- iOS Core Location capability seam where appropriate;
- Core Haptics;
- Core NFC;
- Nearby Interaction/UWB capability;
- Android sensor provider family;
- Android haptics;
- Android BLE/NFC/UWB/ranging providers;
- native permission/entitlement/manifest policy;
- foreground/background/lock lifecycle;
- power/thermal quality adaptation;
- surface/device capability projection for Crossdeck;
- approved integration contracts for Landfall, Watchglass, Storytide/Lanternwake, and Parallax seams;
- notification/lifecycle capability where required by consumer integration;
- Device Lab D2/D3 scenario execution;
- real-device D4 bring-up for core capabilities.

### Dependency gate

Before Phase 4 closes:

- the Landfall device-boundary amendment must be accepted;
- Sounding Line Device Lab governance must formally recognize the shared facility semantics needed for Sextant qualification;
- current consumer ownership must remain consistent with the master Spatial Experience Architecture.

### Release gate

Native providers produce the same semantic capability contracts as web providers, accepted Landfall behavior remains correct, background behavior is truthful, and capability differences are visible rather than papered over.

---

## 55.5 Phase 5 - **Trust the Reading**
### Device Lab Qualification, Real Hardware, Security, Privacy, Performance, and Program Closure

### Mission

Prove Sextant under actual device variability and close the program at production quality.

### Required work

- complete D0-D5 Device Lab matrix for production capabilities;
- representative iOS/Android real-hardware qualification;
- magnetic prop/environment field program;
- pressure/elevation field validation;
- haptic fallback and accessibility acceptance;
- BLE/NFC/UWB qualification where production-enabled;
- background/lifecycle interruption testing;
- battery and thermal measurement;
- provider drift/compatibility monitoring;
- privacy review;
- security review;
- performance budgets;
- sanitized operational diagnostics;
- full Drydock capability/fallback integration proof;
- final Landfall/Parallax/Watchglass/Crossdeck integration conformance where those consumers are available;
- final governing documentation and completion receipt.

### Release gate

Every production capability has truthful support boundaries, platform/provider qualification, documented fallback, accessible alternatives, security/privacy review, real-device evidence where hardware fidelity matters, and no unresolved ownership duplication.

\newpage

# 56. Final Acceptance Criteria

Project Sextant is complete only when all applicable gates pass.

- **Ownership:** Consumers no longer need parallel generic hardware architectures.
- **Capability truth:** Support, availability, permission, calibration, quality, freshness, and lifecycle are distinct and truthful.
- **Provider independence:** Web/iOS/Android providers implement common semantic contracts.
- **Permission UX:** Requests are contextual, purpose-bound, retryable, and fallback-safe.
- **Lifecycle:** Providers start/stop/pause/resume without leaks or stale continuity claims.
- **Reference frames:** Orientation/motion conversions are explicit, tested, and provider-independent.
- **Magnetism:** Magnetic interactions use disturbance-aware baseline/trend semantics and never claim object identity without evidence.
- **Elevation:** Relative elevation is separated from absolute altitude and floor inference.
- **Distance honesty:** Raw inertial integration is never mislabeled as precise route distance.
- **Nearby hardware:** BLE/UWB/NFC behavior is capability-detected, privacy-bounded, and security-reviewed.
- **Haptics:** Rich/basic/no-haptic outcomes all remain understandable and accessible.
- **Privacy:** Raw streams are not durably retained by default; diagnostic output is minimized.
- **Security:** Synthetic providers cannot become production evidence; malformed/spoofed inputs fail safely.
- **Accessibility:** Required physical interactions have alternatives and respect motion/motor/sensory needs.
- **Device Lab:** D0-D5 evidence exists at the appropriate tier for each production capability.
- **Real hardware:** Hardware-dependent capabilities have representative real-device proof.
- **Consumer boundaries:** Landfall, Parallax, Watchglass, Storytide, Crossdeck, and One Voyage retain their canonical ownership.
- **Operations:** Provider regressions can be diagnosed without invasive device fingerprinting.
- **Product acceptance:** Representative real-device walkthroughs demonstrate understandable permission/fallback behavior.


A thousand passing simulated sensor tests do not prove a real phone behaves properly in a steel building beside a speaker and a magnetic purse clasp. Real-world hardware gets a vote.

\newpage

# 57. Recommended Technical Baseline

This baseline describes current platform direction as of October 4, 2026. It is **not permanent governance**. Implementation work must re-verify current platform APIs and support before coding.

## 57.1 Web

- **Orientation/motion:** Device Orientation and Motion events for broad mobile support; feature-detect permission methods.
- **Generic sensors:** Optional Generic Sensor providers in supporting browsers; never sole baseline.
- **Camera/microphone:** `MediaDevices` / `getUserMedia()` through secure-context, permission-aware consumer pipelines.
- **Bluetooth:** Web Bluetooth only as enhanced optional provider where supported.
- **NFC:** Web NFC only as enhanced optional NDEF provider where supported.
- **Haptics:** Vibration API only as basic optional fallback; never rich-haptic parity assumption.
- **Lifecycle:** Page Visibility, platform events, and consumer/app lifecycle abstractions.
- **Testing:** WebDriver/browser sensor virtualization where supported plus deterministic D0 providers.


## 57.2 iOS

- **Motion/orientation:** Core Motion processed device motion plus raw sensors where genuinely needed.
- **Heading/location:** Core Location through Sextant/Landfall boundary.
- **Elevation:** Core Motion altimeter where available; absolute and relative semantics separated.
- **Haptics:** Core Haptics with capability checks and simpler fallback.
- **NFC:** Core NFC behind capability/entitlement checks.
- **UWB/ranging:** Nearby Interaction on supported devices, secure session setup, foreground/background rules respected.
- **Lifecycle:** Native app scene/background modes and permission state.


## 57.3 Android

- **Motion/orientation:** Android Sensor framework, favoring fused rotation-vector/gravity/linear-acceleration semantics where appropriate.
- **Magnetism:** Magnetic-field providers with accuracy/calibration metadata.
- **Elevation:** Pressure sensor where present plus platform location inputs where appropriate.
- **Haptics:** Action-based haptic feedback for ordinary interactions; richer effects when supported.
- **BLE:** Android Bluetooth/BLE with modern Nearby Device runtime permissions.
- **NFC:** Android NFC reader/writer/tag APIs on capable devices.
- **UWB/ranging:** Jetpack/platform ranging APIs according to supported Android version/device.
- **Lifecycle:** Foreground/background/Doze/App Standby constraints explicitly modeled.


## 57.4 Data/math

- SI units internally;
- monotonic clocks for motion;
- normalized quaternion attitude internally;
- typed reference frames;
- calibrated/freshness-aware observation envelopes;
- bounded deterministic filters with versioned configuration;
- no hidden machine-learning dependency for basic motion semantics.

\newpage

# 58. Governance and Change Control

## 58.1 New capability admission

A new Sextant capability requires:

1. stable semantic definition;
2. owner/consumer identified;
3. provider inventory;
4. permission/privacy classification;
5. security considerations;
6. fallback policy;
7. accessibility equivalent where required;
8. Drydock validation rule;
9. Device Lab scenarios;
10. versioning/migration strategy.

## 58.2 Provider addition

A new provider may be added without changing consumer contracts when it satisfies an existing capability version.

## 58.3 Semantic change

Changing units, reference frames, quality meaning, gesture thresholds, or completion-relevant semantics may require a capability/derivation version bump.

## 58.4 Historical Chronicle stability

Published Chronicles bind to versioned capability requirements and semantic configuration. A future Sextant update may improve implementation but must not silently reinterpret historical authored mechanics in a way that changes completion behavior without compatibility handling.

## 58.5 Platform drift

Apple, Google, W3C, browser engines, and device manufacturers will change APIs and restrictions. Project Sextant absorbs that drift behind providers whenever semantic meaning remains stable.

That is one of the main reasons this project exists.

\newpage

# Appendix A. Canonical Capability Catalog

Initial catalog candidates:
- **`sextant.orientation.relative`:** **Semantic meaning:** device attitude relative to local start/reference; **Typical consumers:** Parallax, Storytide
- **`sextant.orientation.absolute`:** **Semantic meaning:** attitude tied to qualified Earth/platform reference; **Typical consumers:** Parallax, Storytide
- **`sextant.heading.estimate`:** **Semantic meaning:** clockwise heading with labeled north reference; **Typical consumers:** Landfall, Storytide
- **`sextant.motion.linear-acceleration`:** **Semantic meaning:** gravity-separated acceleration where available; **Typical consumers:** Landfall, Storytide
- **`sextant.motion.angular-velocity`:** **Semantic meaning:** device rotation rate; **Typical consumers:** Parallax, Storytide
- **`sextant.motion.stability`:** **Semantic meaning:** stable/moving semantic classification; **Typical consumers:** Watchglass, Parallax, Storytide
- **`sextant.gesture.rotation-count`:** **Semantic meaning:** deliberate accumulated rotation event; **Typical consumers:** Storytide
- **`sextant.gesture.tilt-band`:** **Semantic meaning:** device enters configured tilt range; **Typical consumers:** Storytide, Parallax
- **`sextant.gesture.sweep-coverage`:** **Semantic meaning:** deliberate bounded scan arc coverage; **Typical consumers:** Watchglass, Parallax
- **`sextant.magnetic.field`:** **Semantic meaning:** calibrated/local magnetic-field observation; **Typical consumers:** advanced consumers
- **`sextant.magnetic.anomaly`:** **Semantic meaning:** field deviation/trend relative to baseline; **Typical consumers:** Storytide, Parallax
- **`sextant.elevation.relative`:** **Semantic meaning:** relative vertical change with quality; **Typical consumers:** Landfall, Storytide
- **`sextant.step.delta`:** **Semantic meaning:** bounded step evidence; **Typical consumers:** Storytide, Landfall
- **`sextant.position.observation`:** **Semantic meaning:** generic device geographic position observation; **Typical consumers:** Landfall
- **`sextant.media.camera`:** **Semantic meaning:** camera capability/permission state; **Typical consumers:** Watchglass, Parallax
- **`sextant.media.microphone`:** **Semantic meaning:** microphone capability/permission state; **Typical consumers:** future approved consumer
- **`sextant.haptics.basic`:** **Semantic meaning:** basic tactile feedback; **Typical consumers:** Storytide, Lanternwake, Parallax
- **`sextant.haptics.rich`:** **Semantic meaning:** rich parameterized haptics; **Typical consumers:** Storytide, Lanternwake, Parallax
- **`sextant.nearby.ble.scan`:** **Semantic meaning:** BLE discovery capability; **Typical consumers:** Landfall, Crossdeck, accessories
- **`sextant.nearby.ble.connect`:** **Semantic meaning:** BLE connection/session capability; **Typical consumers:** Crossdeck, accessories
- **`sextant.nearby.uwb.range`:** **Semantic meaning:** qualified relative peer/accessory ranging; **Typical consumers:** Parallax, Landfall, Crossdeck
- **`sextant.nearby.nfc.read`:** **Semantic meaning:** deliberate NFC read session; **Typical consumers:** Storytide, Landfall
- **`sextant.nearby.nfc.write`:** **Semantic meaning:** governed NFC write capability; **Typical consumers:** Creator/accessory workflow
- **`sextant.lifecycle.background`:** **Semantic meaning:** current surface/app background capability state; **Typical consumers:** all consumers
- **`sextant.system.power`:** **Semantic meaning:** power/low-power class where available; **Typical consumers:** broker/consumers
- **`sextant.system.thermal`:** **Semantic meaning:** thermal performance class where available; **Typical consumers:** broker/Parallax/Watchglass


This catalog is a starting authority, not permission for Phase 1 to implement every row at once.

\newpage

# Appendix B. Observation and Quality Schemas

## B.1 Capability state

```text
CapabilityState
{
  capabilityId
  semanticVersion
  support
  availability
  permission
  calibration
  quality
  lifecycle
  providerClass
  reasonCodes[]
  lastChangedMonotonic
}
```

## B.2 Observation

```text
Observation<T>
{
  observationId
  capabilityId
  semanticVersion
  value
  monotonicTimestamp
  ageMs
  quality
  confidence
  uncertainty
  calibration
  referenceFrame
  provenanceRoot
  sourceClass
  synthetic
  warnings[]
}
```

## B.3 Discontinuity

```text
ObservationDiscontinuity
{
  capabilityId
  previousSequence
  nextSequence
  reason
  gapDuration
  providerChanged
  referenceFrameChanged
  requiresConsumerReset
}
```

## B.4 Quality rule

A consumer must never reconstruct missing quality metadata from provider name or platform model.

\newpage

# Appendix C. Permission and Consent Matrix

- **Orientation/motion:** **Typical OS/browser permission:** browser/platform dependent; **Voyagewright contextual purpose required:** Yes when first meaningful use requires prompt; **Durable raw data default:** No
- **Location:** **Typical OS/browser permission:** location permission; **Voyagewright contextual purpose required:** Yes; **Durable raw data default:** No raw trail
- **Camera:** **Typical OS/browser permission:** camera permission; **Voyagewright contextual purpose required:** Yes; **Durable raw data default:** Consumer-governed
- **Microphone:** **Typical OS/browser permission:** microphone permission; **Voyagewright contextual purpose required:** Yes; **Durable raw data default:** Consumer-governed
- **BLE:** **Typical OS/browser permission:** nearby/Bluetooth permission on native; browser chooser on supported web; **Voyagewright contextual purpose required:** Yes; **Durable raw data default:** No nearby inventory
- **UWB/ranging:** **Typical OS/browser permission:** platform nearby/ranging permission/capability; **Voyagewright contextual purpose required:** Yes; **Durable raw data default:** No raw peer history by default
- **NFC:** **Typical OS/browser permission:** session/entitlement/platform flow; **Voyagewright contextual purpose required:** Yes in authored interaction; **Durable raw data default:** Only validated payload if consumer needs it
- **Haptics:** **Typical OS/browser permission:** usually no direct prompt; system settings apply; **Voyagewright contextual purpose required:** No separate OS prompt, but semantic accessibility/fallback required; **Durable raw data default:** No
- **Barometer:** **Typical OS/browser permission:** platform-dependent sensor access; **Voyagewright contextual purpose required:** Purpose shown as part of interaction; **Durable raw data default:** No raw stream


Permission wording belongs to the product moment, but the broker enforces the capability request.

\newpage

# Appendix D. Semantic Gesture Catalog

## D.1 Turn to bearing

Inputs:

- qualified heading or orientation;
- target bearing;
- tolerance;
- dwell;
- stability.

Outputs:

- `ALIGNING`;
- `ALIGNED`;
- `UNAVAILABLE`;
- `DEGRADED`.

## D.2 Relative turn

Inputs:

- local orientation reference;
- desired relative angle;
- direction optional;
- tolerance/dwell.

## D.3 Rotation count

Inputs:

- gravity-aligned angular accumulation;
- minimum continuous rotation;
- reversal tolerance;
- timeout;
- count target.

## D.4 Tilt band

Inputs:

- device attitude;
- permitted axis band;
- dwell.

## D.5 Hold steady

Inputs:

- angular velocity threshold;
- linear acceleration threshold;
- dwell;
- interruption reset policy.

## D.6 Sweep coverage

Inputs:

- heading/orientation arc;
- minimum coverage;
- maximum speed;
- continuity;
- missing-sector reporting.

Every gesture used for mandatory progress requires an alternate path.

\newpage

# Appendix E. Device Lab Scenario Catalog

Initial Sextant scenario set:

1. orientation-relative clean rotation;
2. absolute orientation unavailable -> relative fallback;
3. orientation permission denied;
4. heading wrap 359 -> 1 degrees;
5. magnetometer disturbed mid-alignment;
6. three deliberate turns with small reversals;
7. false spin rejection while walking;
8. stable-hold with hand jitter;
9. screen rotates portrait/landscape during gesture;
10. provider restarts mid-gesture;
11. background/screen-lock gap then resume;
12. linear acceleration without gravity;
13. motion including gravity fallback;
14. barometer +6 m relative climb;
15. pressure weather drift over long baseline;
16. step evidence with pause/restart;
17. magnetic local baseline and approach trend;
18. strong magnetic disturbance -> unusable;
19. haptics rich -> basic fallback;
20. haptics disabled by user/system;
21. BLE permission denied;
22. BLE accessory disconnect/reconnect;
23. UWB unsupported;
24. UWB ranging dropout;
25. NFC tag read success;
26. malformed NFC payload;
27. camera capability available but permission denied;
28. low-power quality reduction;
29. thermal degradation during high-rate orientation;
30. two consumers request different sampling classes;
31. one consumer unmounts while another remains;
32. sign-out releases all leases;
33. synthetic provider rejected in production;
34. web API missing despite device hardware;
35. Crossdeck selects phone over desktop for motion capability;
36. Landfall retains navigation fallback when device context paused;
37. Watchglass loses camera while motion remains;
38. accessible alternative selected instead of physical gesture;
39. Android Emulator injected sensor sequence;
40. real-device magnetic treasure field trial.

\newpage

# Appendix F. Threat and Privacy Checklist

Before a Sextant capability ships:

- [ ] capability ID and semantics are stable;
- [ ] raw platform API is isolated in provider adapter;
- [ ] permission is contextual and purpose-bound;
- [ ] denial produces a fallback;
- [ ] user pause stops the lease;
- [ ] raw streams are not durably retained by default;
- [ ] reference frame is explicit;
- [ ] units are normalized;
- [ ] non-finite values are rejected;
- [ ] freshness/quality/calibration metadata exists;
- [ ] provider restart creates discontinuity;
- [ ] synthetic/test identity cannot pass as production;
- [ ] nearby-device information is minimized;
- [ ] hardware identifiers are not exposed unnecessarily;
- [ ] haptic output is bounded and cancellable;
- [ ] background behavior is explicitly qualified;
- [ ] accessibility alternative exists for required interactions;
- [ ] Drydock can simulate unavailable/denied/degraded outcomes;
- [ ] Device Lab scenario exists at the appropriate tier;
- [ ] real hardware evidence exists where emulator fidelity is insufficient;
- [ ] consumer cannot mutate One Voyage directly;
- [ ] logs contain no raw sensor/media/location stream;
- [ ] platform drift monitoring/requalification plan exists.

\newpage

# Appendix G. Consumer Integration Matrix

- **Relative orientation:** **Landfall:** Context; **Parallax:** Primary input; **Watchglass:** Optional; **Storytide:** Gesture; **Crossdeck:** Capability select; **Lanternwake:** -
- **Absolute orientation:** **Landfall:** Navigation hint; **Parallax:** Primary input; **Watchglass:** Optional; **Storytide:** Gesture; **Crossdeck:** Capability select; **Lanternwake:** -
- **Heading:** **Landfall:** Primary consumer; **Parallax:** Optional; **Watchglass:** Optional; **Storytide:** Bearing interaction; **Crossdeck:** Capability select; **Lanternwake:** -
- **Linear motion:** **Landfall:** Route continuity; **Parallax:** Stabilization/context; **Watchglass:** Capture guidance; **Storytide:** Gesture; **Crossdeck:** -; **Lanternwake:** -
- **Angular velocity:** **Landfall:** -; **Parallax:** Spatial interaction; **Watchglass:** Sweep guidance; **Storytide:** Gesture; **Crossdeck:** -; **Lanternwake:** -
- **Stability:** **Landfall:** -; **Parallax:** Placement/interaction; **Watchglass:** Capture quality; **Storytide:** Hold steady; **Crossdeck:** -; **Lanternwake:** -
- **Magnetic anomaly:** **Landfall:** Optional clue provider; **Parallax:** Spatial clue; **Watchglass:** -; **Storytide:** Narrative mechanic; **Crossdeck:** -; **Lanternwake:** Haptic presentation
- **Relative elevation:** **Landfall:** Primary contextual consumer; **Parallax:** Optional; **Watchglass:** -; **Storytide:** Narrative mechanic; **Crossdeck:** -; **Lanternwake:** -
- **Position observation:** **Landfall:** Primary consumer; **Parallax:** Context only; **Watchglass:** Context only; **Storytide:** -; **Crossdeck:** -; **Lanternwake:** -
- **Camera capability:** **Landfall:** -; **Parallax:** AR/camera need; **Watchglass:** Primary consumer; **Storytide:** -; **Crossdeck:** Surface select; **Lanternwake:** -
- **Haptics:** **Landfall:** Directional cue; **Parallax:** Spatial cue; **Watchglass:** Scan cue; **Storytide:** Story cue; **Crossdeck:** Surface select; **Lanternwake:** Choreography
- **BLE/UWB/NFC:** **Landfall:** Optional provider; **Parallax:** Accessory/spatial; **Watchglass:** -; **Storytide:** Authored interaction; **Crossdeck:** Pairing/role transport where approved; **Lanternwake:** -
- **Lifecycle:** **Landfall:** Background navigation; **Parallax:** AR suspend/relocalize; **Watchglass:** Capture suspend; **Storytide:** Interaction fallback; **Crossdeck:** Surface lifecycle; **Lanternwake:** Presentation cancellation
- **Power/thermal:** **Landfall:** Quality policy; **Parallax:** Render quality; **Watchglass:** Capture quality; **Storytide:** -; **Crossdeck:** Surface selection; **Lanternwake:** Effect quality


“Primary consumer” does not transfer ownership.

\newpage

# Appendix H. Glossary

**Capability** - Stable semantic statement that a device/surface may provide an input or output behavior.

**Capability Lease** - Time-bounded consumer request for a capability with purpose, quality, update class, and lifecycle rules.

**Calibration State** - Whether a provider's observation currently meets its own calibration/disturbance requirements.

**Device Context** - Semantic, quality-bearing information about the device and its immediate physical/lifecycle state.

**Discontinuity** - A break in observation continuity requiring consumers to reset or requalify state.

**Observation** - A time-bound semantic reading with quality, provenance, reference frame, and freshness.

**Provider** - Platform-specific implementation that supplies one or more capabilities.

**Provenance Root** - Identity indicating which underlying physical/platform source produced related evidence.

**Reference Frame** - Coordinate basis in which a spatial observation is meaningful.

**Semantic Gesture** - Deterministic derived device interaction such as relative turn, rotation count, tilt band, or steady hold.

**Sextant** - Voyagewright's canonical device-context and generic hardware-capability subsystem.

**Synthetic Provider** - Explicit non-production provider used by Device Lab or tests.

\newpage

# References and Governing Sources

## Voyagewright authorities

1. **Voyagewright Spatial Experience Architecture v1.0**, October 4, 2026. Master ownership architecture establishing Sextant, Parallax, Crossdeck, Device Lab ownership, semantic capability/fallback rules, and cross-project boundaries.
2. **Project Landfall Governing Document v1.0**, July 24, 2026. Physical navigation, confidence, privacy, provider independence, contextual motion/heading/elevation, native Phase 4 direction.
3. **Project Landfall Governing Amendment v1.1: Worldspaces and Virtual Navigation**. Additive physical/virtual Worldspace authority.
4. **Project Landfall Phase 3 Accepted Capsule** and v1.1 follow-up. Current accepted contextual motion/heading/elevation behavior and explicit Phase 4 deferment.
5. **Project Drydock Governing Document v1.0**. Typed provider, simulator outcome, fault-injection, fallback, accessibility, and publishing-verification architecture.
6. **Project Sounding Line Effective Authority** and `testing/sounding-line-authority.json`. Repository-wide verification and protected-main acceptance.
7. **Project One Voyage** accepted architecture. Sole authoritative progression/session transition ownership.

## Current platform references reviewed October 4, 2026

8. Apple Developer Documentation - **Core Motion**: accelerometer, gyroscope, processed device motion, magnetometer, pedometer, and barometer/altitude capabilities.
9. Apple Developer Documentation - **Core Location**: geographic location, heading, region monitoring, beacon/ranging-related location services, authorization.
10. Apple Developer Documentation - **Core Haptics**: custom haptic capability and hardware-support checks.
11. Apple Developer Documentation - **Core NFC**: NFC tag read/write sessions and capability checks.
12. Apple Developer Documentation - **Nearby Interaction**: UWB-based distance/direction on supported hardware and background constraints.
13. Android Developers - **Motion sensors**: accelerometer, gravity, linear acceleration, gyroscope, rotation vector, step sensors.
14. Android Developers - **Position sensors**: magnetic field and geomagnetic/game rotation vectors.
15. Android Developers - **Bluetooth Low Energy and Bluetooth permissions**: BLE operations and Nearby Device runtime permission model.
16. Android Developers - **Ultra-wideband / Ranging**: precise relative ranging, capability discovery, OOB setup, and background limitations.
17. Android Developers - **NFC overview and basics**: reader/writer/tag behavior and runtime hardware checks.
18. Android Developers - **Haptics APIs and design guidance**: action-based and richer vibration/haptic capability classes.
19. MDN Web Docs - **Device orientation events**, `DeviceOrientationEvent`, and `DeviceMotionEvent`: mobile web orientation/motion, secure context, and permission differences.
20. W3C - **Generic Sensor API**, Candidate Recommendation Draft, May 14, 2026: common sensor abstraction and WebDriver virtual sensor testing, with acknowledged cross-engine implementation concerns.
21. MDN Web Docs - **Web Bluetooth API**: limited/experimental cross-browser availability and permission/security model.
22. MDN Web Docs - **Web NFC API**: limited/experimental NDEF-oriented capability.
23. MDN Web Docs - **Vibration API**: limited cross-browser device vibration capability.
24. MDN Web Docs - **MediaDevices / getUserMedia**: secure-context camera/microphone acquisition with explicit permission.

Platform references are **technical baseline evidence, not permanent product promises**. Project Sextant exists specifically so provider/API drift can be absorbed without rewriting Chronicle semantics.

\newpage

# Final Governing Rule

> **Project Sextant exists so Voyagewright can use the physical device deeply without becoming dependent on any one device, platform API, sensor, or convenient lie.**
>
> Raw hardware becomes normalized device context. Device context becomes semantic evidence. Semantic evidence remains confidence-bearing, privacy-bounded, capability-detected, lifecycle-safe, and accessible. Consumers use that evidence inside their own domains. One Voyage remains the only authority for what happened in the Chronicle.
>
> **The instrument may be sophisticated. The reading must be honest.**

---

**End of Project Sextant v1.0 Governing Document**
