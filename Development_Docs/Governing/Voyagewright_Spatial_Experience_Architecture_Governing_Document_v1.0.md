---
title: "Voyagewright Spatial Experience Architecture"
subtitle: "Device Context, Multi-Surface Voyages, Spatial Computing, Augmented Reality, and Physical-Digital Chronicle Interaction"
author: "Voyagewright Engineering"
date: "October 4, 2026"
version: "1.0"
status: "Master Governing Baseline"
document_id: "VW-SPATIAL-001"
repository: "Kgray44/treasurehuntSoT"
repository_baseline: "c8ea696404ef4cc79fc009457589b1d66f4caa57"
---

> **Governing Principle**  
> A Chronicle may extend beyond a screen, but it must never fracture into competing truths. Creators author experience intent. Voyagewright resolves device capability, place, surface, spatial implementation, evidence, synchronization, accessibility, and fallback while One Voyage remains the sole authority for what actually happened.

This document is the umbrella architecture for Voyagewright's spatial-experience family. It captures the product intent, architectural boundaries, shared invariants, cross-project contracts, safety rules, Creator and Player experience principles, validation model, and implementation sequence for device context, multi-surface participation, augmented reality, adaptive spatial staging, physical-digital artifacts, and the platform-wide Device Lab.

It deliberately does **not** collapse all of those responsibilities into Project Landfall.

Landfall remains the Living World Navigation System. The new architecture introduces distinct ownership for device context, spatial/AR behavior, and multi-surface participation so future work can be built deeply without producing one project that owns maps, magnetometers, ARKit, session pairing, memory photography, and half the known universe.

# Document Control

**Identity and status**

- **Document ID:** `VW-SPATIAL-001`
- **Version:** 1.0
- **Date:** October 4, 2026
- **Status:** Master governing baseline
- **Repository:** `Kgray44/treasurehuntSoT`
- **Repository baseline reviewed:** `c8ea696404ef4cc79fc009457589b1d66f4caa57`
- **Primary scope:** Cross-project spatial experience architecture

**Canonical owners established by this document**

- **Progression authority:** Project One Voyage
- **Device capability:** Project Sextant
- **World/place/navigation:** Project Landfall
- **Spatial/AR:** Project Parallax
- **Multi-surface participation:** Project Crossdeck
- **Visual perception:** Project Watchglass
- **Narrative experience:** Project Storytide
- **Character/presence:** Project Figurehead
- **Personal memory/archive:** Project Wakebook
- **Chronicle verification:** Project Drydock
- **Software verification:** Project Sounding Line
- **Device Lab:** Project Sounding Line, shared platform facility
- **Community distribution:** Project Harborlight
- **Private asset/security:** Project Sealed Hold
- **Global product coherence:** Voyagewright Global Product Governance Standard

## Normative language

The terms **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative. MUST-level requirements are completion gates unless a later owner-approved amendment explicitly supersedes them. A passing test, an implementation shortcut, a platform limitation, a stale historical plan, or an attractive demo does not silently waive a governing rule.

## Authority and precedence

This document is authoritative for:

- cross-project ownership of spatial-experience capabilities;
- the separation between device context, world/place, spatial/AR, and multi-surface systems;
- shared spatial reality invariants;
- adaptive spatial staging semantics;
- remote spatial authoring and privacy-safe field calibration;
- Chronicle Lens experience principles;
- capability negotiation and fallback expectations;
- platform-wide Device Lab ownership and scope;
- cross-project event/evidence boundaries;
- the requirement that project-specific governing documents be derived before implementation begins.

It does **not** retroactively erase accepted historical project records. Existing accepted project governance remains authoritative within its domain unless this document explicitly establishes a new future boundary requiring a project amendment.

Precedence is:

1. The Voyagewright Global Product Governance Standard for product coherence, discoverability, visual quality, and human completion.
2. This Spatial Experience Architecture for the cross-project spatial capability family and ownership boundaries.
3. Accepted project-specific governing documents and approved amendments for implementation within each owner domain.
4. Current protected repository source for present implementation facts, names, paths, and actually integrated behavior.
5. Current design and implementation records for accepted technical decisions.
6. Task prompts for bounded execution only; a prompt may not weaken a higher authority.

Where a future project document conflicts with this master architecture, the conflict MUST be explicitly reconciled rather than silently implemented.

## Relationship to current Landfall

Project Landfall v1.0 remains the foundational physical navigation architecture. Its v1.1 Worldspaces amendment remains additive and establishes physical and virtual Worldspaces. Current protected main has Landfall Phases 1 through 3 and the physical/virtual v1.1 follow-up integrated and validated.

This master architecture does not rewrite that history. It establishes the future boundary required before sensor-heavy native work and spatial computing continue:

- generic hardware/device capability moves to **Project Sextant**;
- AR/spatial entity and anchor ownership moves to **Project Parallax**;
- one-person/many-surface participation moves to **Project Crossdeck**;
- Landfall consumes those capabilities for location, journey, route, Worldspace, region, elevation context, and navigation.

A dedicated Landfall boundary amendment MUST be created before later Landfall work adopts these new contracts.

# Contents

1. Executive Summary  
2. Product Vision and Why This Architecture Exists  
3. Non-Negotiable Design Principles  
4. Canonical Ownership Model  
5. Terminology and Core Concepts  
6. System Architecture  
7. Project Sextant - Device Context and Hardware Capability  
8. Project Landfall - World, Place, Journey, and Navigation  
9. Project Parallax - Spatial Chronicle and Augmented Reality  
10. Project Crossdeck - Multi-Surface Chronicle Experience  
11. Chronicle Lens  
12. Device Context Semantics and Sensor Fusion  
13. Magnetic Interaction and Physical Prop Detection  
14. Elevation, Motion, Traveled Distance, and Confidence  
15. Spatial Entity Model  
16. Coordinate Spaces and Anchor Families  
17. Fixed Spatial Anchors  
18. Adaptive Semantic Anchors  
19. Adaptive Spatial Staging  
20. Placement Policies, Variation, and Deterministic Reproduction  
21. Shared Spatial Reality  
22. Late Join, Relocalization, and Recovery  
23. Remote Spatial Authoring  
24. Field Calibration and Creator Review  
25. Privacy-Safe Calibration Evidence  
26. Discovery Assistance Contract  
27. Physical-Digital Artifacts  
28. Multi-Surface Desktop + Mobile Experiences  
29. Virtual Chronicle Use Cases  
30. Real-World Chronicle Use Cases  
31. Chronicle Memories and AR Photography  
32. Storytide Integration  
33. Watchglass Integration  
34. Figurehead Integration  
35. One Voyage Integration and Progression Authority  
36. Wakebook Integration  
37. Drydock Integration  
38. Harborlight, Sealed Hold, Wayfarer, Helm, and Other Adjacent Systems  
39. Creator Studio Authoring Experience  
40. Player Experience and Graceful Degradation  
41. Accessibility and Inclusive Spatial Design  
42. Privacy, Security, Safety, and Threat Model  
43. Offline, Reconnect, and Failure Recovery  
44. Performance, Battery, Thermal, and Quality Scaling  
45. Canonical Event and Evidence Vocabulary  
46. Data and Service Contracts  
47. Voyagewright Device Lab  
48. Device Lab Scenario Packs and Test Tiers  
49. Governance Registries and Machine-Readable Ownership  
50. Canonical Scenario Narratives  
51. Implementation and Documentation Sequence  
52. Derived Governing Documents Required  
53. Program Acceptance Criteria  
Appendix A. Ownership Matrix  
Appendix B. Spatial Placement Policy Catalog  
Appendix C. Discovery Assistance Profiles  
Appendix D. Device Capability Catalog  
Appendix E. Device Lab Scenario Catalog  
Appendix F. Threat and Privacy Checklist  
Appendix G. Glossary  
References  
Final Governing Rule

# 1. Executive Summary

Voyagewright is evolving from a screen-based Chronicle platform into a system capable of making the Player's physical device, physical surroundings, virtual game world, and multiple concurrent displays part of one coherent authored experience.

The initial design question was modest: can Landfall use more phone hardware - accelerometer, gyroscope, compass, magnetometer, elevation, and motion - to improve Chronicle interactions and navigation?

The answer exposed a much larger architectural opportunity.

A Player could face a real direction to reveal a clue. They could spin three times as an authored ritual. A magnetic object could disturb the Chronicle compass. A relative elevation change could matter to a tower or stair puzzle. A phone could act as a physical compass while a desktop presents the main Chronicle. A Sea of Thieves chart could be discovered in the Player's actual room, picked up, placed on a desk, and remain world-stable while the Player moves the phone around it. Ghostly footprints could exist only through the Chronicle Lens. A Creator who has never visited a place could describe a desired placement in ordinary language, allow the first consenting Player's device to resolve the best local match, and later refine that placement remotely from privacy-safe evidence. Different crews could receive different valid spatial staging while every Player in the same crew shares exactly one spatial reality. A Player could save a clean photograph of an AR artifact as if it truly existed in the room and attach it to the Chronicle Passport.

Those capabilities are too important and too technically distinct to live inside one Landfall amendment.

This architecture therefore establishes three new permanent subsystem identities:

- **Project Sextant - The Device Context and Hardware Capability System.** It answers: *What can this device sense and do?*
- **Project Parallax - The Spatial Chronicle and Augmented Reality System.** It answers: *What spatial Chronicle things exist around us, and where?*
- **Project Crossdeck - The Multi-Surface Chronicle Experience System.** It answers: *Which devices and surfaces are participating in this person's Voyage, and how are they synchronized?*

Project Landfall remains the Living World Navigation System. It answers: *Where are we in the physical or virtual world, where have we been, and where are we going?*

Other systems retain their authority:

- Watchglass owns visual perception and verification.
- Storytide owns the narrative experience and presentation meaning.
- Figurehead owns persistent visual character identity and presence.
- One Voyage owns authoritative progression and session truth.
- Wakebook owns personal Chronicle history, Memories, and archival presentation.
- Drydock proves authored Chronicle behavior before publication.
- Sounding Line proves the software and owns the shared Voyagewright Device Lab.
- Harborlight distributes governed community content.
- Sealed Hold protects private Chronicle content and protected media.
- Wayfarer owns canonical human identity.
- Helm owns Captain-facing Voyage operations where those operations intersect spatial or multi-surface experiences.

The architecture is capability-driven and fallback-first. A Chronicle may prefer world-tracked AR, a magnetometer, pressure sensor, or multiple devices, but mandatory progress MUST remain completable when those capabilities are unavailable unless the Chronicle explicitly declares a constrained hardware experience and Drydock accepts its distribution boundary.

The central product goal is paradoxical but intentional:

> **The engineering complexity may become enormous; the Creator and Player experience must become simpler.**

A Creator should be able to write:

> “Place a folded note partly hidden on a desk.”

rather than define a transform matrix and plane classification policy.

A Player should be told:

> “Use the Chronicle Lens.”

rather than “initialize the spatial tracking subsystem.”

The platform absorbs the machinery.

# 2. Product Vision and Why This Architecture Exists

## 2.1 The Chronicle is allowed to leave the browser rectangle

Voyagewright's existing architecture already treats Chronicles as durable, versioned, multi-person experiences rather than disposable web pages. Spatial computing extends that same philosophy into the physical and virtual environment.

A Chronicle may now conceptually occupy:

- a real town;
- a home or private room;
- a museum or public building;
- a hiking trail;
- a desk beside a computer;
- a fictional game map;
- a Sea of Thieves session;
- a shared room where several Players see the same impossible object;
- a future headset or wearable;
- multiple screens at once.

The experience must remain one Voyage.

## 2.2 The physical device becomes a Chronicle instrument

The phone is not merely a small browser.

Depending on capability, it may become:

- a compass;
- a magnetic diviner;
- a spatial map;
- an artifact scanner;
- a Chronicle Lens;
- a spyglass;
- a decoder;
- a handheld Journal;
- a camera for private Memories;
- a local sensor platform;
- a shared AR viewport;
- a haptic guide;
- a bridge between a virtual game and the Player's room.

These functions must be presented through Chronicle-native metaphors while preserving truthful capability and evidence semantics beneath them.

## 2.3 Spatial computing is not limited to virtual Chronicle companions

AR is equally valuable for physical-world Chronicles.

Examples include:

- footprints projected onto dirt or pavement;
- directional marks visible only through the Chronicle Lens;
- writing attached to a real wall;
- a folded note peeking from behind a real object;
- a virtual bottle resting on a table;
- a ghostly character occupying a bench;
- an alternate historical layer revealed over a building;
- a route marked by ephemeral symbols;
- a puzzle whose meaning changes with viewing angle;
- a shared chest seen by every crew member in the same physical place.

The platform must support both **site-specific spatial experiences** and **portable adaptive experiences** that can stage themselves inside an unknown room.

## 2.4 Variation is a feature, not an error

Adaptive placement does not exist only as a temporary substitute for a future fixed anchor.

A Creator may intentionally author:

> “Hide the map in a believable place on the floor.”

and permit Voyagewright to choose a different valid location per crew or per run.

The authored story remains stable. The staging may vary.

This is **procedural spatial staging**, not procedural narrative generation.

## 2.5 Shared reality is mandatory for shared experiences

Adaptive does not mean personal randomness.

When a crew participates in the same shared spatial scene, the scene has one authoritative spatial placement for that run. Every participating device must resolve that same logical anchor. The object may vary for another crew or another run, but it must not appear under the desk for one Player and beside the dresser for another.

The magic depends on a Player being able to point and say:

> “There.”

and everyone else actually seeing the same thing there.

# 3. Non-Negotiable Design Principles

## 3.1 One Voyage, one authoritative progression truth

Spatial systems may generate observations, evidence, presentation state, and interaction proposals. They MUST NOT independently mutate authoritative Chronicle progression.

The canonical flow is:

```text
physical/device/spatial interaction
        ↓
normalized evidence or interaction receipt
        ↓
completion provider / owning domain validation
        ↓
One Voyage authoritative transition
        ↓
canonical event/state
        ↓
Storytide / Parallax / Crossdeck presentation
```

No AR component, magnetometer callback, or secondary device may call a private equivalent of `chapter.complete()` as local side effect.

## 3.2 Creators author intent; the platform solves implementation

Creator Studio MUST prioritize semantic authoring over hardware primitives.

The preferred Creator statement is:

> “Place this note partly hidden on a horizontal surface near the entrance.”

not:

> “Create a plane anchor with a 17-degree yaw and persistence mode X.”

Advanced and Engineering controls MAY expose lower-level behavior, but the canonical stored model should remain meaningful at the experience level.

## 3.3 Capability-driven, not device-model-driven

Chronicle logic MUST request capabilities, not hard-code specific device models or platform APIs.

Examples:

- `HEADING_ESTIMATE`
- `RELATIVE_ELEVATION`
- `MAGNETIC_ANOMALY`
- `WORLD_TRACKED_AR_SURFACE`
- `HAPTIC_OUTPUT`
- `CAMERA_VIEW`
- `MULTI_SURFACE_COMPANION`

The system resolves the best provider available on the current device.

## 3.4 Confidence, not fiction

Every derived physical or spatial assertion must carry enough confidence/quality metadata to avoid false precision.

The platform must not claim:

- exact heading when magnetic calibration is poor;
- exact floor from noisy altitude evidence;
- exact traveled distance from raw accelerometer integration;
- exact object identity from an undifferentiated magnetic field anomaly;
- stable spatial localization when tracking quality is poor;
- shared-anchor convergence when devices have not actually resolved the same scene.

## 3.5 Shared Voyage equals shared spatial reality

For a shared Spatial Moment, placement variation is evaluated once at the configured sharing scope. Every Player in that scope must resolve the same logical object to the same authoritative anchor identity.

## 3.6 No mandatory indefinite searches

Every mandatory hidden spatial objective MUST define bounded discovery assistance.

A Player may be allowed to search naturally, but the system must eventually provide escalating, accessible help and an exact final recovery path.

## 3.7 Privacy by minimization

Raw sensor streams, camera frames, room imagery, precise spatial meshes, and location histories are not default durable Chronicle data.

Derived, bounded, purpose-specific state should be preferred.

## 3.8 Person-free automatic calibration evidence

Automatically captured calibration evidence MUST be screened on-device and MUST NOT upload a frame containing a detected person or face. A suspect frame is discarded before network transfer.

Player-authored Memory photography is a separate, explicitly initiated experience and follows its own privacy rules.

## 3.9 Adaptation must be stable within a run

Once an adaptive placement has been resolved for a run, it is frozen for that run unless an explicit story action, authorized re-anchor, recovery path, or lifecycle transition moves it.

Looking away and back must not cause the map to reconsider its career and teleport to a bookshelf.

## 3.10 Accessibility is part of the authored contract

Mandatory Chronicle progress may not depend exclusively on a spatial, camera, motion, audio, or haptic interaction without an accessible equivalent or an explicitly governed constrained-experience policy.

## 3.11 Multi-surface does not mean multi-identity

One human remains one Wayfarer identity. Adding a phone beside a desktop does not create a second Player.

## 3.12 Device Lab is platform infrastructure

The Voyagewright Device Lab is not a Landfall Phase 4 utility. It is a shared Sounding Line-governed verification facility that every current and future project may use.

# 4. Canonical Ownership Model

## 4.1 Fundamental questions

- **Project Sextant — _What can this device sense and do?_** Owns device capabilities, normalized device context, and sensor/provider lifecycle.
- **Project Landfall — _Where are we, where have we been, and where are we going?_** Owns Worldspaces, map/place semantics, routes, regions, waypoints, and journey context.
- **Project Parallax — _What spatial Chronicle things exist around us, and where?_** Owns AR/spatial entities, anchors, scenes, adaptive staging, and Chronicle Lens spatial rendering.
- **Project Crossdeck — _Which surfaces are participating in this person's Voyage?_** Owns pairing, surface roles, synchronization, handoff, and multi-device lifecycle.
- **Project Watchglass — _What is the Player actually seeing?_** Owns visual perception, recognition, verification, OOD/abstention, and visual evidence.
- **Project Storytide — _What is happening and why does it matter?_** Owns narrative experience, Spatial Moment meaning, and presentation choreography.
- **Project Figurehead — _Who is present?_** Owns character/identity representation, poses, expressions, and spatial character presence.
- **Project One Voyage — _What authoritatively happened?_** Owns session/progression truth, canonical events, idempotency, and authoritative transitions.
- **Project Wakebook — _What should the Player remember?_** Owns Memories, personal archive, and Keepsake/Chronicle Passport presentation.
- **Project Drydock — _Can the authored Chronicle be proven safe and coherent?_** Owns validation, simulation, linting, and provider/fallback readiness.
- **Project Sounding Line — _Does the software actually work?_** Owns test policy, Device Lab, software/device qualification, and protected release authority.

## 4.2 Supporting owners

- **Wayfarer** retains canonical identity, sessions, devices associated with an account, privacy preferences, and participant identity.
- **Helm** retains Captain operational controls and governed participant/Voyage interventions.
- **Harborlight** retains community distribution, install/update/remix lineage, and safe public metadata for spatial content.
- **Sealed Hold** retains protected private Chronicle content, media storage, package security, and protected asset delivery.
- **Lanternwake** retains animation/motion presentation authority where spatial experiences transition through ordinary Voyagewright UI or require governed reduced-motion behavior.
- **Homeport / Global Product Governance** retain navigation/discoverability/product-coherence rules.

## 4.3 Ownership anti-patterns explicitly forbidden

The following future shortcuts are forbidden unless governance is amended:

- Landfall implementing raw gyroscope drivers directly.
- Parallax becoming the authoritative Chronicle progression engine.
- Crossdeck creating shadow Player identities for secondary devices.
- Watchglass rendering the AR scene it verifies.
- Storytide owning spatial anchor persistence.
- Wakebook becoming a live AR runtime.
- Drydock implementing production sensor providers.
- Device Lab being copied separately into Landfall, Watchglass, Parallax, and Crossdeck.
- Creator Studio storing untyped opaque blobs simply because several projects need configuration.

# 5. Terminology and Core Concepts

## 5.1 Device Context

A normalized semantic representation of current device capability and observation state. It may include heading, attitude, acceleration, motion state, magnetic anomaly, relative elevation, environmental signals, haptic capability, camera availability, power/thermal state, permission state, and provider confidence.

## 5.2 Surface

A participating presentation/interaction endpoint in a Player's active experience, such as desktop browser, mobile browser, native phone companion, tablet, shared display, or future headset.

## 5.3 Spatial Moment

An authored Storytide moment that requires or prefers spatial behavior: discovering, viewing, placing, carrying, aligning, scanning, following, manipulating, or sharing a Spatial Entity.

## 5.4 Chronicle Lens

The Player-facing spatial interface through which Voyagewright reveals hidden spatial layers, scans surroundings, presents AR entities, and coordinates context-sensitive device interactions.

It is a product concept, not merely “camera mode.”

## 5.5 Spatial Entity

A canonical authored or runtime Chronicle object with spatial identity, presentation, interaction, visibility, anchoring, persistence, capability, privacy, and fallback contracts.

## 5.6 Spatial Anchor Intent

A semantic description of where an entity should exist, especially when the Creator has not directly chosen a real-world transform.

## 5.7 Fixed Anchor

A placement intended to resolve to a specific real or virtual place.

## 5.8 Adaptive Anchor

A placement intentionally resolved against the current environment using semantic intent. It may remain adaptive forever.

## 5.9 Adaptive Spatial Staging

The process of arranging multiple authored Spatial Entities coherently inside an unknown or variable environment while preserving authored relationships and story order.

## 5.10 Shared Spatial Scene

The authoritative run-scoped spatial reality for one co-located group or configured sharing scope.

## 5.11 Field Calibration

The optional process by which a real Player encounter generates privacy-safe evidence that lets a Creator remotely approve or refine a spatial placement.

## 5.12 Discovery Assistance Contract

The mandatory anti-frustration policy for required spatial searches, defining meaningful search time, hint escalation, final reveal, and alternate completion.

## 5.13 Spatial Memory

A Player-authored or system-offered private archival capture that combines real imagery and the intended AR presentation, optionally with bounded metadata linking the image to a Chronicle moment.

## 5.14 Placement Scope

The lifecycle boundary at which adaptive placement may vary: fixed, per crew, per run, sticky per Voyage, variant, or explicitly personal.

## 5.15 Semantic Evidence

A derived fact or observation that expresses meaning rather than raw sensor values, such as `MAGNETIC_ANOMALY_STRONG` or `HEADING_ALIGNED`.

# 6. System Architecture

```text
                           ONE VOYAGE
                      authoritative state
                              │
              ┌───────────────┼────────────────┐
              │               │                │
              ▼               ▼                ▼
          STORYTIDE        LANDFALL        WATCHGLASS
         story meaning     world/place       perception
              │               │                │
              └───────┬───────┴───────┬────────┘
                      │               │
                      ▼               ▼
                  PARALLAX         SEXTANT
                spatial reality   device context
                      │               │
                      └───────┬───────┘
                              ▼
                          CROSSDECK
                 multi-surface participation
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
       Desktop              Phone              Tablet/XR
     Story surface      Chronicle Lens        future surface

                WAKEBOOK ← spatial memories
                FIGUREHEAD ← spatial people
                DRYDOCK ← authored validation
                SOUNDING LINE ← Device Lab/software proof
```

## 6.1 Runtime principle

Each owner contributes a narrow contract. No downstream surface is permitted to infer authority it does not own.

Example: a Player rotates their phone to face 247 degrees.

1. Sextant produces a confidence-scored heading observation.
2. Landfall may interpret that observation relative to a Worldspace objective.
3. Storytide knows the current story beat is “face the lighthouse.”
4. Parallax may render the visual reveal as alignment improves.
5. If the completion condition is satisfied, a typed proposal reaches One Voyage.
6. One Voyage validates sequence/idempotency and records canonical progression.
7. Crossdeck synchronizes the resulting presentation across active surfaces.

The UI feels immediate; authority remains disciplined.

# 7. Project Sextant - Device Context and Hardware Capability System

## 7.1 Mission

Project Sextant provides one normalized, capability-oriented device context layer for Voyagewright. It abstracts platform APIs, sensor availability, permission state, quality, calibration, lifecycle, and derived semantic signals so product projects do not depend directly on raw OS or browser events.

## 7.2 Sextant owns

- capability discovery;
- permission state for generic device capabilities;
- raw provider adapters for supported web/native platforms;
- normalized heading/orientation/attitude;
- acceleration, rotation rate, motion state, stability, and gesture evidence;
- magnetic-field/anomaly context;
- pressure/relative-elevation context;
- generic position observations where appropriate, while Landfall remains the place/navigation owner;
- haptic capability and bounded output contracts;
- BLE/UWB/NFC capability declarations and generic provider lifecycle;
- camera capability declarations, not visual interpretation;
- foreground/background/lock/sleep lifecycle context;
- battery, thermal, and device-performance capability signals;
- confidence, calibration, freshness, and provider quality metadata;
- privacy-safe observation summaries for consumers.

## 7.3 Sextant does not own

- map routes;
- Worldspace semantics;
- AR rendering;
- visual object recognition;
- Chronicle progression;
- story meaning;
- spatial entity placement;
- device pairing as a Voyage surface;
- Player history.

## 7.4 Semantic output examples

```text
HeadingEstimate
  degrees: 83
  accuracyDegrees: 6
  confidence: HIGH
  calibration: ACCEPTABLE
  freshnessMs: 130
```

```text
MagneticAnomaly
  baselineMicrotesla: <internal>
  deltaClass: STRONG
  trend: INCREASING
  confidence: MEDIUM
  rawRetention: NONE
```

```text
RelativeElevation
  deltaMeters: +6.4
  confidence: MEDIUM
  sourceClass: PRESSURE_FUSED
  absoluteAltitudeClaim: NONE
```

## 7.5 Capability negotiation

Consumers ask for semantic capabilities. Sextant selects from available providers using declared quality and policy.

A Chronicle MUST NOT assume that all phones expose a magnetometer, pressure sensor, or high-fidelity motion API.

## 7.6 Permission UX

Permission requests should be contextual and story-aware. Voyagewright should request motion/camera/location access at the moment it becomes understandable why the capability is useful, with a concise explanation and a working fallback path.

# 8. Project Landfall - World, Place, Journey, and Navigation

## 8.1 Mission after this architecture

Landfall remains the canonical system for Worldspaces, place, route, region, map, journey, location confidence, and navigation across physical and virtual worlds.

## 8.2 Landfall consumes Sextant

Examples:

- heading for route/target alignment;
- motion state to distinguish actual travel from GPS jitter;
- relative elevation as contextual evidence;
- short-term motion continuity for gaps;
- device capability quality when deciding which navigation interaction is appropriate.

Landfall SHOULD NOT own generic sensor drivers.

## 8.3 Landfall supplies Parallax

Landfall can tell Parallax:

- which Worldspace is active;
- relevant region/site/floor context;
- nearby waypoint/route context;
- broad geographic eligibility;
- expected target bearing;
- virtual-world map position;
- journey history and discovered places;
- privacy-safe context required to select spatial content.

Parallax then handles the spatial entity and rendering problem.

## 8.4 Worldspace remains broader than GPS

Physical and virtual Worldspaces remain first-class. A Sea of Thieves map and a town map may have different coordinate systems, but Storytide can consume the same higher-level journey concepts.

## 8.5 Landfall must not become AR ownership by accident

A location-aware clue may use Parallax, but the fact that it is location-aware does not make Parallax part of Landfall's internal renderer.

# 9. Project Parallax - Spatial Chronicle and Augmented Reality System

## 9.1 Mission

Project Parallax owns the spatial Chronicle substrate: spatial entities, AR rendering, anchors, adaptive placement, shared spatial scenes, relocalization, remote spatial authoring, field calibration, Chronicle Lens spatial behavior, and physical-digital artifact interactions.

## 9.2 Core governing rule

> **Creators author spatial intent. Parallax solves spatial implementation.**

## 9.3 Parallax owns

- `SpatialEntity` domain;
- world/local/device/virtual/shared coordinate-space handling;
- fixed and adaptive anchors;
- surface and plane eligibility;
- spatial object pose and placement;
- shared anchor identities;
- adaptive staging;
- spatial persistence within a run;
- relocalization;
- interaction geometry;
- object pick-up/carry/place transitions;
- Chronicle Lens rendering behavior;
- spatial visibility/discovery state;
- spatial effects and overlays;
- clean AR capture composition;
- privacy-safe field calibration packages;
- spatial confidence and tracking state;
- platform rendering adapters.

## 9.4 Parallax does not own

- raw sensor provider logic;
- general place/navigation truth;
- visual recognition models;
- authoritative story progression;
- user account identity;
- personal archive truth;
- multi-device surface pairing.

## 9.5 Spatial Moments

Creator Studio should expose semantic Spatial Moment families such as:

- **Trail:** footprints, arrows, rope marks, dust, droplets, or spectral traces.
- **Hidden Writing:** text, symbols, or marks attached to a physical surface.
- **Placed Object:** parchment, bottle, key, chest, compass, or artifact.
- **Peeking Object:** an object partly concealed behind or beneath real context.
- **Reveal Layer:** an alternate visual layer visible through the Chronicle Lens.
- **Portal / Window:** a spatial opening into another scene or authored view.
- **Directional Apparition:** content visible only from an intended viewing direction.
- **Ground Guidance:** Chronicle-native route assistance projected onto the ground.
- **Surface Puzzle:** align, assemble, uncover, trace, or manipulate spatial content.
- **Spatial Audio Source:** sound localized to an authored spatial entity.
- **Shared Object:** the same spatial entity visible to multiple crew members.

These families are Creator-facing experience primitives, not separate progression engines.

# 10. Project Crossdeck - Multi-Surface Chronicle Experience System

## 10.1 Mission

Project Crossdeck allows one canonical Player/Voyage participation to project simultaneously onto multiple authorized surfaces.

The governing rule is:

> **A Voyage belongs to the Player, not to a screen.**

## 10.2 Crossdeck owns

- surface pairing;
- surface registration;
- surface role/capability declarations;
- ephemeral pairing credentials;
- one-person/multi-device association;
- active primary/companion/shared-display roles;
- synchronized presentation state;
- surface handoff;
- device disconnect/reconnect;
- late-joining personal surfaces;
- per-surface content suitability;
- multi-surface message transport and consistency;
- bounded surface-specific cache;
- privacy and revocation for paired surfaces.

## 10.3 Crossdeck does not own

- Player identity itself;
- Chronicle progression;
- AR placement;
- sensor semantics;
- map semantics;
- visual recognition.

## 10.4 Representative pairing flow

```text
Desktop Chronicle
    ↓
"Use your phone as a Chronicle Lens"
    ↓
QR / short pairing challenge
    ↓
Wayfarer-authenticated Player proves identity
or invitation-bound guest proves scoped participation
    ↓
Crossdeck creates short-lived surface capability
    ↓
Mobile joins same PlayerExperienceSession
    ↓
Desktop = primary story surface
Phone = Chronicle Lens / device-context surface
```

The mobile surface is not a second Player and does not receive broader authorization merely because it is paired.

## 10.5 Future surface types

The architecture must remain open to:

- phone;
- tablet;
- desktop/laptop;
- shared TV/display;
- wearable;
- headset/XR;
- Captain display;
- accessibility companion device.

# 11. Chronicle Lens

## 11.1 Product identity

Chronicle Lens is the unified Player-facing spatial/perceptual instrument. It prevents the product from exposing separate “AR mode,” “scanner mode,” “camera verification mode,” and “magnetometer mode” as unrelated technical features.

The story may simply say:

> **Use the Chronicle Lens.**

## 11.2 The Lens may combine

- Parallax spatial rendering;
- Watchglass visual verification;
- Landfall place/bearing context;
- Sextant motion/orientation/magnetic context;
- Crossdeck surface synchronization;
- Storytide presentation;
- accessible hint overlays;
- Player-authored Memory capture.

## 11.3 The Lens must remain truthful

The Lens should surface understandable states such as:

- “Look around slowly so the Chronicle can learn this space.”
- “Got it.”
- “The Chronicle is having trouble holding onto this place. Look back toward the desk.”
- “This clue can also be viewed in Guided Mode.”

It should not expose internal terms such as plane anchors, pose tracking, or provider IDs to ordinary Players.

## 11.4 The Lens is not automatic continuous recording

Opening the Lens does not grant the platform unrestricted durable camera capture. Calibration evidence and Player Memory capture have distinct, explicit rules.

# 12. Device Context Semantics and Sensor Fusion

## 12.1 Raw values are implementation details

Raw sensor values may be necessary internally, but downstream Chronicle logic should consume semantic observations whenever possible.

Examples:

- `HEADING_ALIGNED`
- `DEVICE_STABLE`
- `ROTATION_ACCUMULATED`
- `MAGNETIC_ANOMALY`
- `RELATIVE_ELEVATION_CHANGED`
- `WALKING_LIKELY`
- `DEVICE_TILTED_TOWARD_GROUND`

## 12.2 Sensor fusion must be bounded and explainable

Fusion may combine:

- OS-native fused orientation;
- accelerometer;
- gyroscope;
- magnetometer;
- barometer;
- GPS/location provider;
- map/route constraints;
- visual motion/Watchglass context where explicitly governed.

The output must include confidence and freshness.

## 12.3 Gesture interactions

Potential authored interactions include:

- face a bearing;
- rotate approximately 180 degrees;
- spin a configured number of full turns;
- scan a horizon arc;
- tilt upward/downward;
- hold steady;
- perform a slow sweep;
- walk a bounded number of paces;
- align the phone with a visual or virtual object.

Drydock MUST validate that required interactions have accessible fallbacks and realistic tolerances.

# 13. Magnetic Interaction and Physical Prop Detection

## 13.1 Intended experience

A magnetic Chronicle interaction can make the phone behave like a divining compass or anomaly detector.

Example:

```text
Player searches a chest of objects
        ↓
Sextant establishes local magnetic baseline
        ↓
Player moves phone across candidates
        ↓
field anomaly trend rises
        ↓
Storytide presents stronger compass response
        ↓
configured threshold + dwell satisfied
        ↓
completion evidence proposed
```

## 13.2 Important semantic distinction

A magnetometer detects magnetic field, not a magical Boolean property called `isMagnetic`.

Creators SHOULD use known safe props when a reliable magnetic hunt is required. A deliberately embedded small magnet may be much more reliable than hoping an arbitrary metal object produces a distinctive field disturbance.

## 13.3 Safety

Creator guidance MUST prohibit unsafe strong-magnet placement near sensitive phone components and MUST define conservative interaction distances. The experience must never encourage Players to press powerful magnets directly against cameras or other device hardware.

## 13.4 Fallback

If magnetic sensing is unavailable or untrustworthy, a mandatory interaction must degrade to another clue or verification path, such as visual search, NFC/QR if explicitly provided, Captain confirmation, or a semantic puzzle.

# 14. Elevation, Motion, Traveled Distance, and Confidence

## 14.1 Relative elevation versus absolute altitude

The platform must distinguish:

- absolute altitude estimate;
- relative elevation change;
- inferred level/floor context.

A pressure sensor may be useful for short-term relative changes even when absolute altitude is uncertain. The UI should not turn a relative 6-meter climb into an unsupported claim that the Player is “exactly on floor 3.”

## 14.2 Traveled distance

Raw accelerometer double integration MUST NOT be treated as authoritative distance over ordinary Chronicle timescales. Small sensor bias can create rapidly growing position error.

Distance estimation should instead fuse appropriate evidence such as:

- location fixes;
- map/route constraints;
- step/motion evidence;
- known stationary periods;
- short-term inertial continuity;
- route matching.

The IMU is valuable for continuity and motion truth, not as an excuse to fabricate survey-grade dead reckoning.

## 14.3 Motion evidence

Motion context can help distinguish:

- walking versus stationary;
- real movement versus GPS jitter;
- a deliberate device rotation versus noise;
- a short GPS outage versus teleportation;
- whether a Player actually performed an authored physical gesture.

All such observations remain confidence-scored evidence.

# 15. Spatial Entity Model

A canonical Spatial Entity should be representable conceptually as:

```text
SpatialEntity
├─ identity
├─ ChronicleVersionBinding
├─ StorytideMomentBinding
├─ entityType
├─ coordinateSpace
├─ anchorPolicy
├─ placementIntent
├─ resolvedAnchorIdentity
├─ transform / presentation scale
├─ geometry / surface requirements
├─ render asset / material / animation
├─ lighting / occlusion policy
├─ interaction contract
├─ visibility conditions
├─ discovery state
├─ sharing scope
├─ persistence policy
├─ capability requirements
├─ fallback chain
├─ accessibility equivalent
├─ privacy classification
└─ evidence / audit references
```

## 15.1 Data-model rule
