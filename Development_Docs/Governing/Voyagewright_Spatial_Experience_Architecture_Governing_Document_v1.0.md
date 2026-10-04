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
Do not collapse the entire model into an untyped `type + JSON` landfill. Extensible payloads may exist behind versioned typed schemas, but stable semantic fields and lifecycle relationships must remain explicit.

## 15.2 Spatial identity versus rendering instance

One logical Spatial Entity may have multiple per-device render instances. Those instances are projections of the same scene truth, not independent authoritative objects.

# 16. Coordinate Spaces and Anchor Families

Parallax must explicitly distinguish at least:

## 16.1 Earth / physical Worldspace

A place associated with real geography or a site-local coordinate frame.

## 16.2 Local environment space

A room/site-local frame discovered through AR tracking, such as desk, wall, floor, doorway, or room geometry.

## 16.3 Device space

An object intentionally attached to the device/handheld viewer, such as a handheld map or compass.

## 16.4 Virtual Worldspace

An authored or game-derived coordinate system such as a Sea of Thieves world/map.

## 16.5 Shared spatial session space

A crew-shared anchor frame in which multiple devices resolve the same logical spatial scene.

## 16.6 Coordinate-space transitions

A single artifact may change coordinate spaces without becoming a different story object.

Example:

```text
AR map discovered on floor
        ↓ PICK UP
Device-space handheld map
        ↓ PLACE
Local desk-space anchored map
        ↓ PICK UP
Device-space handheld map
```

The artifact identity persists while its spatial relationship changes.

# 17. Fixed Spatial Anchors

Fixed anchors are appropriate when the authored experience belongs to a specific real or virtual place.

Examples:

- writing on a particular memorial wall;
- an apparition beside a specific statue;
- a clue at one museum exhibit;
- an AR object aligned to a particular game-world landmark;
- a historical overlay attached to one building facade.

## 17.1 Fixed does not mean brittle

A fixed anchor still requires:

- relocalization tolerance;
- device capability fallback;
- confidence state;
- content-safe recovery if the environment changes;
- Creator maintenance when the physical site changes materially.

## 17.2 Direct on-site authoring

Creators MAY place or calibrate fixed content while physically present. This is one authoring path, not a requirement for all spatial content.

# 18. Adaptive Semantic Anchors

## 18.1 Adaptive is a first-class final state

An adaptive anchor may remain adaptive permanently.

It is not necessarily “untrained fixed placement.”

## 18.2 Example intent

> Place an old parchment map somewhere believable on the floor, preferably near furniture and not in the middle of the room.

Parallax can compile this to a structured intent:

```text
SpatialAnchorIntent
  preferredSurfaceClasses: [FLOOR]
  nearContext: [FURNITURE]
  avoidRegions: [DOORWAY, WALK_PATH]
  concealment: LOW_TO_MEDIUM
  visibilityRequirement: PARTIAL
  variationAllowed: HIGH
  fallback: GUIDED_2D_PLACEMENT
```

## 18.3 Best believable match

For remote adaptive authoring, success means the best believable match, not an impossible perfect recreation of the Creator's imagined room.

## 18.4 Portable spatial Chronicles

Adaptive anchors enable a Chronicle to require concepts rather than geometry:

- a room;
- a floor;
- a desk/table-like surface;
- a doorway;
- a wall.

The same authored Chronicle can then stage itself in many homes, hotel rooms, classrooms, or private spaces.

# 19. Adaptive Spatial Staging

Adaptive Spatial Staging arranges multiple entities together rather than solving every placement independently.

Example authored scene:

```text
map      → floor near furniture
journal  → table-like surface
ghost    → doorway
message  → wall
compass  → portable handheld
```

The staging system should consider:

- inter-object collisions;
- narrative order;
- sightlines;
- safe walking space;
- discovery difficulty;
- object concealment;
- surface availability;
- visual plausibility;
- accessibility;
- shared-anchor feasibility;
- performance budget.

The goal is not merely to find five surfaces. The goal is to produce a coherent authored scene in an unknown environment.

## 19.1 Story stability

Spatial staging variation must not silently change core narrative truth. If a note must be found before a key, the staging system may not accidentally reveal the key first merely because one shelf scored higher.

# 20. Placement Policies, Variation, and Deterministic Reproduction

Creators need simple placement consistency controls backed by precise runtime policies.

## 20.1 Canonical policies

### FIXED
Same physical/virtual location across runs where the site remains resolvable.

### CALIBRATED
Fixed or semi-fixed placement refined from Creator or field evidence.

### ADAPTIVE_STICKY
Resolve once for a Voyage or configured lifecycle and preserve that placement.

### ADAPTIVE_PER_CREW
Each crew may receive a different valid placement. Every Player in the crew shares it.

### ADAPTIVE_PER_RUN
Each new run may receive a different valid placement. Every Player in that run shares it.

### ADAPTIVE_VARIANT
Deliberately select among several plausible spatial solutions.

### PERSONAL
Only for explicitly individual effects such as personal accessibility cues or Player-specific secrets. It must never be used accidentally for a shared object.

## 20.2 Creator-friendly control

Creator Studio might expose:

- Exact
- Consistent
- Variable
- Playful

with advanced controls underneath.

## 20.3 Deterministic seed

Variable placement must be reproducible for debugging and Drydock simulation.

Conceptually:

```text
placement = f(environment, authoredIntent, runSeed, policy)
```

A run can record a placement seed and resolution receipt so support can reproduce the same decision where environment evidence permits.

## 20.4 Run stability

After placement resolution, the anchor is frozen for the run. Re-evaluation occurs only at authorized lifecycle boundaries.

# 21. Shared Spatial Reality

## 21.1 Hard invariant

> **For any Spatial Moment designated as shared, all Players participating in the same co-located Voyage run MUST resolve the same logical spatial entity to the same authoritative shared anchor.**

Adaptive placement may vary across crews, runs, environments, or explicit story transitions. It MUST NOT vary independently by Player within one shared scene.

## 21.2 SharedSpatialScene

Conceptual model:

```text
SharedSpatialScene
├─ voyageId
├─ chronicleVersionId
├─ spatialMomentId
├─ runId
├─ anchorResolutionId
├─ placementPolicy
├─ resolvedAnchor
├─ anchorVersion
├─ environmentSignature
├─ participatingSurfaceIds[]
├─ trackingConfidence
└─ lifecycleState
```

## 21.3 Resolution ownership

A device may propose a candidate placement, but no individual phone unilaterally owns shared spatial truth.

The runtime must converge on an authoritative anchor identity for the scene.

## 21.4 Placement versus discovery state

The anchor may be shared while discovery/interactions remain configurable:

- shared placement + shared discovery;
- shared placement + per-Player observation;
- shared placement + shared interaction state;
- shared placement + per-Player private notes.

This flexibility must be explicit, not inferred ad hoc.

# 22. Late Join, Relocalization, and Recovery

## 22.1 Late join

A late-joining Player or newly paired surface must inherit the existing anchor identity. It must not rerun adaptive placement from scratch.

Its job is:

> locate the already-existing shared anchor in my local coordinate frame.

## 22.2 Tracking loss

Tracking loss must attempt relocalization to the same anchor.

```text
tracking lost
    ↓
reacquire environment / shared scene context
    ↓
resolve existing anchor version
    ↓
resume same spatial reality
```

## 22.3 Split-brain protection

Anchor versions must be reconcilable. A temporarily disconnected device may render bounded cached state, but must reconcile to the authoritative shared scene before committing new shared interactions.

## 22.4 Re-anchor

Re-anchoring a shared object is an explicit governed operation. It requires a reason such as:

- story-authored movement;
- unrecoverable environment change;
- authorized Captain/Creator recovery;
- anchor invalidation;
- accessibility fallback.

The system records why the anchor moved.

# 23. Remote Spatial Authoring

## 23.1 Three authoring paths

Parallax MUST support these conceptual paths:

1. **On-Site Placement** - Creator directly places an object while physically present.
2. **Remote Semantic Placement** - Creator describes the intended placement without visiting.
3. **Evidence-Calibrated Placement** - field evidence lets the Creator remotely refine a previously resolved placement.

All three create the same canonical spatial intent/entity model.

## 23.2 Natural-language authoring

Creators should be able to describe spatial intent in ordinary language, then see the interpreted structured form.

Examples:

- “On a horizontal desk or table near the far-left corner.”
- “On an old brick or stone wall around eye level.”
- “Partly hidden behind a large object near the entrance.”
- “On the ground beside the first large tree.”
- “Somewhere that feels like a believable place to hide a pirate bottle.”

The system should make ambiguity visible and allow correction without demanding spatial-computing expertise.

## 23.3 Remote authoring cannot require travel

A Creator MUST be able to produce useful spatial experiences for a place they have never visited, provided the Chronicle's intended confidence/fallback level permits adaptive or evidence-calibrated placement.

# 24. Field Calibration and Creator Review

## 24.1 Progressive spatial refinement

An anchor may mature through stages such as:

```text
SEMANTIC
Creator intent only
   ↓
OBSERVED
real-world placement resolved
   ↓
CREATOR_REVIEWED
Creator accepted field result
   ↓
CALIBRATED
Creator adjusted placement against evidence
   ↓
VERIFIED
multiple successful later resolutions
```

These stages are quality metadata, not a mandatory path for every adaptive anchor.

## 24.2 Creator review experience

Creator Studio should be able to show a privacy-safe contextual reference with the current resolved object overlay and controls such as:

- Keep Placement
- Adjust Placement
- Change semantic intent
- Disable field calibration
- Require another observation

## 24.3 Adjustment is spatial, not just 2D pixels

A Creator clicking a different point in evidence should modify a visual-spatial anchor recipe using available surface/depth/pose context rather than storing a fragile raw image pixel coordinate as the entire anchor definition.

## 24.4 Field performance feedback

The system may summarize discovery performance:

- mean discovery time;
- hint-stage usage;
- `Show Me` usage;
- tracking failures;
- anchor-confidence distribution;
- common wrong search sectors.

This feedback must be privacy-safe and should help Creators improve difficult placements.

# 25. Privacy-Safe Calibration Evidence

## 25.1 Hard person-free rule

Automatic calibration evidence may not upload a frame containing a detected person or face.

Preferred pipeline:

```text
candidate frame
    ↓
on-device person detection
    ↓
person suspected? → discard
    ↓
on-device face detection
    ↓
face suspected? → discard
    ↓
privacy crop/minimization
    ↓
explicit Player consent
    ↓
upload bounded calibration evidence
```

No “upload first and blur later” shortcut is acceptable for automatic calibration evidence.

## 25.2 Smallest useful crop

Whenever possible, calibration evidence should contain only the immediate spatial context necessary to understand the anchor rather than a wide room panorama.

## 25.3 Player disclosure

The Player must understand:

- what is being saved;
- why;
- who can see it;
- how long it is retained;
- whether it is optional;
- what happens if they decline.

Declining calibration evidence MUST NOT block ordinary Chronicle completion.

## 25.4 Separate Memory privacy domain

A Player intentionally taking a private Chronicle Memory photo is different from automatic calibration evidence. It may contain people if the Player intentionally captures them, subject to ordinary private media and sharing/consent rules.

# 26. Discovery Assistance Contract

## 26.1 Mandatory for required hidden spatial content

Every mandatory hidden Spatial Moment must define:

```text
DiscoveryAssistance
├─ meaningfulSearchWindow
├─ hintStages[]
├─ maximumUnguidedDuration
├─ exactRevealAvailable
├─ accessibilityModes
└─ alternateCompletion
```

## 26.2 Meaningful search time

The timer counts active search time only while the Player is reasonably able to search.

Pause or discount when:

- app is backgrounded;
- screen is locked;
- tracking is unavailable;
- Player leaves the relevant area;
- permissions disappear;
- Lens is not active;
- another Storytide moment legitimately owns attention.

## 26.3 Progressive help

A default escalation may include:

1. natural authored mystery;
2. gentle narrative nudge;
3. directional/context clue;
4. narrowed search region;
5. strong visual/haptic/audio cue;
6. explicit `Show Me` reveal.

Creators control the **style** of assistance. They do not get to remove the final recovery path from mandatory progression.

## 26.4 System-blame awareness

If anchor confidence is poor or repeated field evidence suggests the placement itself is failing, the system should relax/re-anchor or promote fallback instead of merely escalating hints as though the Player is incompetent.

## 26.5 Optional secrets

Optional Easter eggs may intentionally omit strong hints if the Creator clearly marks them non-required and Drydock verifies no mandatory completion depends on them.

# 27. Physical-Digital Artifacts

## 27.1 Artifact lifecycle

A spatial artifact may be:

- discovered;
- approached;
- inspected;
- picked up;
- carried;
- rotated;
- placed;
- pinned;
- manipulated;
- handed off to a different surface;
- archived as a Memory.

## 27.2 The desk-map canonical interaction

A representative Parallax experience:

1. A virtual map appears in the Player's room.
2. The Player finds it through the Chronicle Lens.
3. The Player “takes” it.
4. It transitions to a handheld device-space artifact.
5. The Player walks to a real desk.
6. Parallax resolves a horizontal placement surface.
7. The Player places the map.
8. The map becomes world-stable relative to the desk.
9. Rotating/moving the phone changes the viewing perspective; the map itself does not rotate with the phone.
10. Moving the phone closer provides natural physical inspection/zoom.
11. Pinch/drag gestures may additionally alter digital scale or viewport.
12. Crossdeck may synchronize selection/context back to the desktop Chronicle.

## 27.3 Artifact identity survives spatial transitions

Pick-up and placement alter relationship to space, not story identity.

# 28. Multi-Surface Desktop + Mobile Experiences

## 28.1 Canonical split

A common virtual Chronicle composition may be:

```text
Desktop surface
- main Storytide presentation
- Journal / large chart
- game companion context
- cinematic moments

Phone surface
- Chronicle Lens
- Parallax AR
- Sextant sensors
- compass / haptics
- handheld artifact
- quick spatial notes
```

## 28.2 Surface-specialized presentation

Storytide may request:

- “present cinematic on primary large surface”;
- “present compass on handheld orientation-capable surface”;
- “open Spatial Moment on Chronicle Lens”;
- “mirror crew status to shared display.”

Crossdeck selects appropriate active surfaces.

## 28.3 Surface handoff

An object may transition from desktop presentation to phone presentation without duplicating authoritative state.

Example:

> Desktop Journal reveals a mysterious sealed chart -> phone vibrates -> Chronicle Lens receives the artifact -> Player places it on desk -> desktop Journal reacts to the discovered island.

## 28.4 Disconnect

Losing the companion phone must not corrupt the Voyage. Crossdeck exposes loss of capability, Storytide chooses a fallback, and One Voyage remains authoritative.

# 29. Virtual Chronicle Use Cases

## 29.1 Sea of Thieves companion map

The Player discovers a map in their room through AR and places it beside the computer while playing Sea of Thieves.

The map may show:

- relevant virtual Worldspace region;
- discovered clues;
- Chronicle annotations;
- current narrative objective;
- authored virtual route or chart state.

Landfall owns the virtual Worldspace/navigation semantics. Parallax owns the room placement. Crossdeck synchronizes desktop and phone. Watchglass may observe game-screen evidence. Storytide decides why it matters.

## 29.2 Physical compass for a virtual world

The phone may behave like a Chronicle compass whose content relates to a virtual Worldspace. Physical phone rotation drives the instrument presentation, while the target/bearing may come from authored or observed virtual-world context.

## 29.3 Game + real room mixed reality

A Chronicle may intentionally blend the game and room:

- virtual clue discovered in game;
- physical AR artifact appears in room;
- Player manipulates it;
- result changes desktop story guidance;
- Player returns to game.

This is mixed-reality storytelling, but progression still flows through canonical One Voyage transitions.

# 30. Real-World Chronicle Use Cases

## 30.1 Town-wide expedition

The phone is the primary experience surface. Landfall guides the Player through the real world, while Parallax may reveal spatial clues such as footprints, writing, or artifacts.

## 30.2 Museum or historical site

Landfall establishes broad place/region context. Parallax attaches spatial content. Watchglass may verify the exhibit/landmark. Storytide reveals historical or fictional narrative layers.

## 30.3 Home/private-room Chronicle

Adaptive Spatial Staging makes the room itself a reusable stage:

- map on floor;
- letter under/near desk;
- apparition at doorway;
- message on wall;
- hidden magnetic prop in a chest.

Each crew may receive different staging while sharing one reality within that run.

## 30.4 Outdoor trail

Parallax may project footsteps or symbolic trail marks, but safety rules must prevent dangerous “eyes glued to phone” guidance. Landfall remains the safer navigation authority, with AR used as a narrative layer rather than a replacement for situational awareness.

# 31. Chronicle Memories and AR Photography

## 31.1 Clean capture

When a Player chooses `Remember this`, the saved image should combine:

```text
camera frame
+ intended AR entities/effects
- buttons
- crosshairs
- tracking diagnostics
- debug overlays
= Chronicle Memory image
```

The result should look like the impossible object was genuinely present.

## 31.2 Memory types

Possible categories:

- Private Note Photo
- Chronicle Memory
- Keepsake Candidate
- Crew Memory
- Creator Calibration Evidence (separate privacy domain)

## 31.3 Private by default

Player-authored Memories are private unless the Player explicitly shares them through existing governed sharing/consent systems.

## 31.4 Metadata

A Memory may retain bounded metadata such as:

- Chronicle version;
- Voyage/session identity;
- Spatial Moment identity;
- artifact identity;
- capture time;
- optional coarse location label where allowed;
- presentation state.

It should not automatically retain unnecessary raw room geometry or continuous sensor history.

## 31.5 Revisit Moment

Future Wakebook presentation MAY use retained semantic metadata to reconstruct a non-authoritative interactive artifact view. Historical archival pixels remain stable even if live spatial runtimes evolve.

# 32. Storytide Integration

Storytide owns the narrative meaning of spatial behavior.

It should define concepts such as:

- Spatial Moment story role;
- when the Chronicle Lens is invited;
- hint tone and escalation style;
- whether discovery is shared or personal;
- whether an artifact may be carried/placed;
- which surface gets the primary presentation;
- narrative fallback if spatial capability is unavailable;
- what transitions occur before/after completion.

Storytide must not own raw anchors, device APIs, or progression authority.

A future Storytide spatial/multi-surface amendment is required before implementation consumes these capabilities deeply.

# 33. Watchglass Integration

Watchglass owns visual understanding and verification.

Potential Parallax/Watchglass interactions include:

- classify candidate surfaces/objects for semantic placement;
- visually relocalize a previously calibrated fixed anchor;
- verify that the Player is looking at the intended landmark;
- reject out-of-distribution visual evidence;
- detect person/face presence for privacy screening;
- assist with object/scene recognition while abstaining safely when uncertain.

Parallax must not assume that Watchglass always exists or returns a positive result.

Watchglass evidence can strengthen spatial confidence but does not automatically become progression authority.

# 34. Figurehead Integration

Figurehead owns the persistent visual identity and character representation of people/characters.

Parallax may eventually render a Figurehead representation into spatial scenes.

Examples:

- a fictional sailor sitting on a real bench;
- a character appearing beside a doorway;
- a crew member's representation occupying a shared spatial scene;
- a historical appearance presented as a spatial apparition.

Figurehead owns appearance, pose, expression, character identity, and historical visual state. Parallax owns world placement, anchoring, and spatial rendering context.

# 35. One Voyage Integration and Progression Authority

## 35.1 Canonical rule

Spatial systems produce proposals/evidence. One Voyage commits authoritative progression.

## 35.2 Example event path

```text
SpatialEntity discovered
    ↓
Parallax interaction receipt
    ↓
Storytide completion provider
    ↓
One Voyage validates actor/session/version/sequence/idempotency
    ↓
TaleSessionEvent / canonical transition
    ↓
Crossdeck synchronizes new presentation
```

## 35.3 Replay

Presentation replay must not mutate progression. Replaying an AR reveal or revisiting a Memory is a presentation/archive action unless a specific governed mechanic says otherwise.

## 35.4 Captain intervention

Helm/Captain controls may help recover a broken spatial moment, but must use canonical One Voyage commands and leave audit evidence.

# 36. Wakebook Integration

Wakebook owns the personal archive experience.

Parallax supplies bounded capture/render metadata. Wakebook decides how it becomes:

- Chronicle Memory;
- private note attachment;
- Voyage archive media;
- Keepsake material;
- grouped shared-discovery photography.

Same shared discovery, different Player viewpoints is a desirable feature. Each Player may save their own photograph of the same shared object from their own camera angle.

Wakebook must not depend on the live AR runtime remaining available forever in order to display the historical record.

# 37. Drydock Integration

Drydock validates authored spatial experiences before publication.

It should eventually be able to detect defects such as:

- mandatory AR moment without fallback;
- magnetic interaction required but no alternate path;
- hidden object without Discovery Assistance Contract;
- shared object incorrectly marked `PERSONAL`;
- per-run adaptive placement with no deterministic simulation seed;
- unsupported surface requirement for intended audience;
- privacy calibration enabled without person-free screening/consent contract;
- remote semantic anchor with impossible surface requirements;
- late-join shared scene without anchor inheritance behavior;
- spatial object whose progression side effect bypasses One Voyage;
- scene requiring Watchglass without an abstention path;
- unsafe outdoor interaction encouraging prolonged screen fixation.

Drydock simulates provider outcomes and scene logic. It does not implement production AR or device providers.

# 38. Harborlight, Sealed Hold, Wayfarer, Helm, and Other Adjacent Systems

## 38.1 Harborlight

Harborlight may eventually distribute:

- Spatial Moment presets;
- AR prop packs;
- adaptive room Chronicle templates;
- semantic anchor recipes;
- spatial effects packs;
- approved Creator templates;
- spatial Chronicle guides.

Published content must retain immutable versioning, licensing, moderation, and safe dependency rules.

## 38.2 Sealed Hold

Private spatial media, calibration reference assets, unpublished AR imagery, and protected Chronicle content remain subject to Sealed Hold storage/package rules. Spatial features do not create a new security loophole for private room imagery.

## 38.3 Wayfarer

Wayfarer remains canonical for the human identity behind multiple paired surfaces. Device association, consent preferences, account privacy, and guest claiming must integrate rather than create a second identity model.

## 38.4 Helm

Helm may expose Captain recovery and participant controls for spatial/multi-surface problems, such as re-issuing a Lens invitation or authorizing a governed fallback. Helm does not own anchors or device providers.

## 38.5 Lanternwake

Lanternwake remains motion/presentation authority for ordinary Voyagewright UI transitions and reduced-motion semantics. Spatial rendering has its own runtime requirements, but transitions between standard UI and Chronicle Lens/Spatial Moments should still honor the platform's motion/accessibility policy.

# 39. Creator Studio Authoring Experience

## 39.1 Three disclosure modes

### Guided

Creator selects an experience preset and supplies semantic intent.

Example:

> **Folded Note**  
> Place: “on a desk, partly hidden”  
> Variation: Variable  
> Required? Yes  
> Hint style: Compass pull

### Detailed

Expose:

- surface classes;
- relative placement;
- scale;
- concealment;
- visibility distance;
- interaction radius;
- placement consistency;
- hint stages;
- fallback chain;
- shared/personal discovery semantics;
- Memory eligibility.

### Engineering

Expose governed low-level behavior such as:

- anchor family;
- coordinate space;
- confidence thresholds;
- relocalization policy;
- occlusion policy;
- surface normal tolerance;
- sharing scope;
- provider constraints;
- spatial evidence requirements;
- fallback provider order.

## 39.2 Presets

High-value presets may include:

- Ghost Footprint Trail
- Hidden Wall Message
- Desk Map
- Buried Artifact
- Floating Compass
- Peeking Letter
- Doorway Apparition
- Magnetic Hunt
- Shared Treasure Chest
- Historical Reveal Layer

Presets must compile to the same canonical typed contracts used by advanced authoring.

## 39.3 Creator simulation

Creator Studio should eventually offer a synthetic room/environment preview so Creators can test spatial moments without repeatedly walking around a real room.

# 40. Player Experience and Graceful Degradation

## 40.1 Player does not manage providers

The Player should not need to know whether a capability came from a browser API, native sensor, visual inference, or fallback.

## 40.2 Capability ladder

A required moment may declare:

```text
Preferred: world-tracked shared AR
Fallback 1: simplified camera overlay
Fallback 2: 2D guided scene
Fallback 3: semantic clue/puzzle
Fallback 4: Captain confirmation / governed skip
```

## 40.3 Degradation preserves story language

Fallback should remain Chronicle-native.

Instead of:

> “ARCore unavailable.”

prefer:

> “The Chronicle cannot hold this object in place on this device. Open it in Guided View instead.”

## 40.4 No premium-device dead ends

Creators may intentionally target specialized hardware, but publication must clearly declare that audience. Ordinary general-purpose Chronicles must remain completable on their declared baseline capability tier.

# 41. Accessibility and Inclusive Spatial Design

Spatial experiences must support:

- reduced motion;
- non-camera alternatives where possible;
- text equivalents for haptic/audio cues;
- high-contrast spatial indicators;
- readable directional descriptions;
- one-handed use where practical;
- seated/reduced-mobility alternatives;
- no mandatory spinning or rapid rotation without an alternative;
- configurable motion/gesture tolerance;
- screen-reader descriptions for Spatial Moments;
- keyboard/standard UI alternative when a desktop surface participates;
- safe timeouts that do not punish slower physical interaction;
- color-independent guidance.

The Chronicle should not require somebody to physically spin three times merely because the Creator thought it was funny. The Creator may make that the preferred theatrical interaction; Drydock must require an accessible equivalent.

# 42. Privacy, Security, Safety, and Threat Model

## 42.1 Sensitive data classes

Spatial features may touch:

- precise location;
- device pose;
- room imagery;
- camera frames;
- inferred room/surface geometry;
- nearby-device signals;
- magnetic/environmental readings;
- shared crew presence;
- private Chronicle assets;
- personal Memories.

These data types require purpose limitation and minimization.

## 42.2 On-device-first processing

When feasible, surface detection, person screening, raw sensor fusion, and temporary scene understanding should remain on-device. Server state should prefer derived semantic facts.

## 42.3 Crossdeck pairing security

Secondary surfaces must use short-lived scoped credentials bound to:

- canonical person/guest identity;
- exact Voyage/session;
- exact surface capability;
- expiry;
- revocation;
- anti-replay nonce/challenge.

A QR code must not become a permanent bearer token for the Player's account.

## 42.4 Spatial spoofing

The platform must consider:

- replayed sensor evidence;
- manipulated location;
- spoofed camera/Watchglass receipts;
- stale anchor evidence;
- duplicate interaction receipts;
- synthetic magnetic signals;
- shared-anchor impersonation;
- unauthorized remote surface pairing.

Automatic progression requires owner-domain validation and appropriate anti-replay/freshness semantics.

## 42.5 Public/private place safety

Community-published spatial content must respect Harborlight location-safety rules. Creators must not accidentally publish precise private-home evidence, calibration photos, or reusable room signatures.

## 42.6 Physical safety

The experience must not encourage:

- staring at the phone while crossing roads;
- climbing unsafe structures for a clue;
- use of strong magnets against devices;
- dangerous rapid spinning;
- trespass;
- placement of AR objectives where the Player must enter hazardous zones;
- prolonged camera scanning in sensitive/private contexts.
Landfall/Storytide safety boundaries apply even when Parallax can technically render something there.

# 43. Offline, Reconnect, and Failure Recovery

## 43.1 Offline-capable local presentation

Where a spatial scene has already been safely prepared, Parallax may continue bounded local rendering during network interruption.

## 43.2 Authority during offline use

Local interaction may be recorded as pending evidence. It must reconcile with One Voyage before becoming authoritative progression if server confirmation is required.

## 43.3 Crossdeck disconnect

A companion device may disconnect without collapsing the primary surface. Storytide selects a fallback or pauses the specific spatial moment.

## 43.4 Shared-scene reconnect

Returning devices rejoin the existing shared scene and anchor version rather than creating new placement.

## 43.5 Failure UX

Failure states must distinguish:

- device capability unavailable;
- permission denied;
- tracking poor;
- anchor not found;
- network unavailable;
- paired surface lost;
- Watchglass abstained;
- server validation failed;
- scene changed physically.

The Player gets an actionable recovery path rather than a generic “Something went wrong.”

# 44. Performance, Battery, Thermal, and Quality Scaling

Spatial features can be expensive. The system must treat resource use as a governed part of experience quality.

## 44.1 Quality modes

Parallax/Sextant may expose internal quality profiles driven by:

- device thermal state;
- battery level;
- frame time;
- camera resolution;
- scene complexity;
- available GPU/AR support;
- network state.

## 44.2 Adaptive quality may reduce

- particle count;
- shadow complexity;
- post-processing;
- mesh detail;
- visual-effect density;
- update frequency for noncritical sensor streams;
- background analysis rate.

It may not silently weaken progression evidence below the configured confidence contract.

## 44.3 Background behavior

Sensor and camera use must stop or reduce appropriately when the Lens is no longer active, subject to explicit background-capability features governed by the relevant project.

## 44.4 Desktop/game coexistence

For virtual Chronicles running beside games such as Sea of Thieves, Watchglass/Parallax/Crossdeck must consider game performance impact. Companion features should not steal absurd GPU/CPU resources from the activity they are supposed to enhance.

# 45. Canonical Event and Evidence Vocabulary

The spatial family needs a normalized vocabulary. Candidate events include:

```text
DEVICE_CAPABILITY_CHANGED
DEVICE_PERMISSION_CHANGED
DEVICE_ORIENTATION_ALIGNED
DEVICE_GESTURE_COMPLETED
MAGNETIC_ANOMALY_OBSERVED
RELATIVE_ELEVATION_CHANGED
SURFACE_PAIRED
SURFACE_JOINED
SURFACE_LEFT
SURFACE_HANDOFF_COMPLETED
SPATIAL_SCENE_INITIALIZED
SPATIAL_ANCHOR_RESOLVED
SPATIAL_ANCHOR_RELOCALIZED
SPATIAL_ANCHOR_REANCHORED
SPATIAL_ENTITY_DISCOVERED
SPATIAL_ENTITY_PICKED_UP
SPATIAL_ENTITY_PLACED
SPATIAL_ENTITY_INSPECTED
SHARED_SCENE_SYNCHRONIZED
DISCOVERY_HINT_ESCALATED
DISCOVERY_EXACT_REVEAL_USED
CALIBRATION_EVIDENCE_OFFERED
CALIBRATION_EVIDENCE_APPROVED
CALIBRATION_EVIDENCE_REJECTED_PRIVACY
SPATIAL_MEMORY_CAPTURED
```

Every event/receipt must declare:

- owner;
- producer;
- consumer;
- whether it is evidence or authority;
- privacy class;
- replay semantics;
- idempotency/freshness requirements;
- retention expectation.

Only owner-approved authoritative transitions may mutate canonical Voyage truth.

# 46. Data and Service Contracts

This master document does not freeze final database schema, but future project documents must converge on narrow typed contracts.

Representative interfaces include:

```text
SextantCapabilitySnapshot
SextantObservationReceipt
LandfallWorldContext
SpatialEntityDefinition
SpatialAnchorIntent
SpatialAnchorResolution
SharedSpatialScene
SpatialInteractionReceipt
CrossdeckSurfaceSession
CrossdeckSurfaceCapability
DiscoveryAssistancePolicy
SpatialMemoryCapture
CalibrationEvidencePackage
```

## 46.1 Privacy-oriented storage rule

Durable records should generally contain semantic state and identity, not unrestricted raw streams.

## 46.2 Immutable Chronicle binding

Authored spatial definitions must bind to exact published Chronicle versions. Runtime scene instances bind to the exact session/version so future edits cannot silently move historical objects mid-Voyage.

## 46.3 Corrections and migrations

Spatial schema evolution must be versioned and Drydock-readable. Published historical versions must remain interpretable or explicitly unsupported with honest compatibility state.

# 47. Voyagewright Device Lab

## 47.1 Formal identity

**Voyagewright Device Lab** is a shared platform verification facility governed by Project Sounding Line.

It is not owned by Landfall.

It is not limited to geolocation.

It exists to let any Voyagewright project test device, sensor, lifecycle, spatial, network, surface, camera, and environmental behavior through governed reusable scenario infrastructure.

## 47.2 Ownership rule

Projects register scenarios and assertions. Device Lab provides execution and evidence. Sounding Line decides test policy and release authority.

Drydock may invoke simulated provider scenarios to validate Chronicle content, but it does not own the Device Lab.

## 47.3 Common capabilities

Device Lab should support scenario families for:

- device lifecycle;
- permissions;
- network transitions;
- battery/power;
- orientation/motion;
- magnetometer;
- pressure/elevation;
- GPS/location;
- camera capability;
- AR tracking;
- shared anchors;
- Bluetooth/UWB/NFC where simulatable;
- app background/foreground;
- lock/sleep/termination;
- multi-surface pairing/reconnect;
- performance/thermal conditions;
- accessibility settings.

## 47.4 One shared facility

No project should create a private device/emulator lab when the scenario can be represented through the shared Device Lab.

# 48. Device Lab Scenario Packs and Test Tiers

## 48.1 Scenario pack structure

Conceptually:

```text
DeviceLab
├─ core/
│  ├─ lifecycle
│  ├─ permissions
│  ├─ network
│  ├─ power
│  └─ device identity
├─ sextant/
│  ├─ heading
│  ├─ gyroscope
│  ├─ accelerometer
│  ├─ magnetometer
│  └─ barometer
├─ landfall/
│  ├─ GPS
│  ├─ routes
│  ├─ geofences
│  └─ offline
├─ parallax/
│  ├─ world tracking
│  ├─ anchors
│  ├─ relocalization
│  ├─ adaptive staging
│  └─ shared AR
├─ crossdeck/
│  ├─ pairing
│  ├─ disconnect
│  ├─ reconnect
│  ├─ handoff
│  └─ multi-surface concurrency
└─ watchglass/
   ├─ camera
   ├─ visual evidence
   └─ environment conditions
```

## 48.2 Test tiers

### Tier D0 - deterministic provider simulation

Fast, CI-friendly, no real OS sensor required.

### Tier D1 - browser/device API emulation

Permission and browser event behavior where supported.

### Tier D2 - Android Emulator

Location, pose/sensors where supported, lifecycle, Doze/background behavior, network, multi-device scenarios.

### Tier D3 - iOS Simulator / hosted macOS runner

Core Location/lifecycle/UI/native integration paths supported by the simulator and current platform toolchain.

### Tier D4 - controlled real hardware

Real iPhone/Android sensors, camera behavior, AR tracking, battery/thermal, Bluetooth/NFC/UWB where available.

### Tier D5 - real field qualification

Actual outdoor/indoor/shared Player scenarios in representative locations.

## 48.3 Evidence honesty

Simulator evidence cannot be relabeled as real-hardware proof. A test receipt must state its tier and limitations.

## 48.4 Example scenario names

```text
magnetic-hidden-object
shared-ar-late-join
adaptive-floor-map-per-run
remote-anchor-first-player-calibration
person-in-frame-calibration-rejection
crossdeck-phone-disconnect
parallax-anchor-relocalization
landfall-relative-elevation-stairs
watchglass-landfall-bearing-fusion
low-battery-spatial-quality-degrade
reduced-motion-spatial-reveal
```

# 49. Governance Registries and Machine-Readable Ownership

The architecture should be made difficult to misinterpret months later.

Future implementation MUST create machine-readable registries equivalent to:

```text
Development_Docs/Spatial_Experience/
  spatial-capability-ownership.json
  spatial-event-registry.json
  surface-capability-registry.json
  device-capability-registry.json
  spatial-provider-registry.json
  device-lab-scenario-registry.json
```

These registries should answer questions such as:

```text
device.magnetic-field
owner: SEXTANT
consumers: [PARALLAX, LANDFALL, STORYTIDE]
```

```text
spatial.shared-anchor
owner: PARALLAX
transport: CROSSDECK
consumers: [STORYTIDE, WATCHGLASS]
authority: NON_PROGRESSION_SPATIAL_TRUTH
```

```text
progression.spatial-object-discovered
producer: PARALLAX
validator: STORYTIDE_COMPLETION_PROVIDER
canonical_authority: ONE_VOYAGE
```

The registry does not replace project governance. It prevents ownership drift and gives Project Trim, Drydock, Sounding Line, Deepwater, and future tooling a compact machine-readable map.

# 50. Canonical Scenario Narratives

The following scenarios are normative product-intent examples. Future project docs may refine implementation, but should preserve the experience and ownership boundaries unless explicitly amended.

## Scenario A - Adaptive bedroom map

Creator authors:

> “Place a pirate map somewhere believable on the floor, preferably near furniture.”

Runtime:

1. Player opens Chronicle Lens.
2. Sextant/Parallax establish eligible device/spatial capability.
3. Parallax scans the room locally.
4. Candidate floor placements are ranked against semantic intent and safety.
5. One placement is selected for the shared run.
6. Every Player in the crew resolves the same anchor.
7. Player finds and picks up the map.
8. Map becomes handheld.
9. Player places it on a desk.
10. Map remains stable while phone perspective changes.
11. Player captures a clean Chronicle Memory.
12. Wakebook stores the private Memory.

A different crew or later run may receive another valid hiding place if policy permits.

## Scenario B - Remote museum clue

Creator has never visited the museum.

Creator authors:

> “Hide a folded parchment around eye level on a stone wall near the entrance.”

First Player:

1. Landfall establishes correct site/region.
2. Parallax identifies candidate surfaces.
3. Best believable placement is chosen.
4. Player completes the clue.
5. Player is optionally asked to help improve placement.
6. Device screens candidate calibration frames locally.
7. Any frame with a person/face is discarded.
8. Consenting Player uploads a minimized person-free reference.
9. Creator reviews the real placement remotely.
10. Creator adjusts the spatial target in context.
11. Future Players use the calibrated recipe.

## Scenario C - Shared crew AR artifact

Three Players share a room.

1. Parallax resolves one SharedSpatialScene anchor.
2. Player A sees the chest.
3. Player B sees the same chest at the same physical position.
4. Player C joins late and resolves the existing anchor.
5. Discovery may be configured as shared or per-Player.
6. Tracking loss on Player B's phone relocalizes the same anchor instead of moving the chest.

## Scenario D - Magnetic treasure object

1. Creator places a safe known magnetic prop among decoys.
2. Sextant establishes baseline and detects anomaly trend.
3. Storytide presents a compass needle that grows more agitated.
4. Player moves closer to correct object.
5. Semantic anomaly evidence crosses configured threshold/dwell.
6. One Voyage receives a typed completion proposal.
7. If magnetometer unavailable, Storytide follows declared fallback.

## Scenario E - Sea of Thieves desktop + phone

1. Desktop runs main Storytide experience beside the game.
2. Phone pairs through Crossdeck as Chronicle Lens.
3. Story reveals that a chart was left “closer to home.”
4. Player searches real room through Parallax.
5. Map is discovered and placed on real desk.
6. Landfall supplies virtual Worldspace chart context.
7. Player inspects map physically and digitally.
8. Watchglass may verify game-screen state.
9. Desktop Journal reacts to phone interaction.
10. Player returns to game with phone still acting as a physical Chronicle instrument.

## Scenario F - Portable community room Chronicle

Creator authors requirements:

- one room;
- one floor;
- one table-like surface;
- one doorway;
- one wall.

Parallax adapts the scene:

- map on floor;
- journal on table;
- ghost at doorway;
- hidden writing on wall.

Different environments receive different staging. Same crew receives one shared reality.

# 51. Implementation and Documentation Sequence

This document is the first step. It freezes intent and ownership before code.

## 51.1 Program-level sequence

```text
MASTER SPATIAL ARCHITECTURE  ← this document
        ↓
DEVICE LAB shared foundation / annex
        ↓
PROJECT SEXTANT governing + implementation
        ↓
PROJECT CROSSDECK governing + implementation
        ↓
PROJECT PARALLAX governing + foundation
        ↓
PARALLAX adaptive/shared spatial behavior
        ↓
Creator spatial authoring + calibration
        ↓
Landfall / Watchglass integration
        ↓
Storytide integration
        ↓
Wakebook spatial memories
        ↓
Figurehead spatial people
        ↓
full field qualification
```

This is a dependency guide, not permission to run every stage automatically.

## 51.2 Why Sextant before Parallax

Parallax should consume a stable capability/device-context contract rather than implement device APIs itself.

## 51.3 Why Crossdeck before advanced shared AR

Shared AR and desktop+phone experiences need a real multi-surface identity/session model before Parallax is asked to synchronize spatial scenes across devices.

## 51.4 Why Parallax before deep Storytide integration

Storytide should consume a governed spatial experience substrate rather than invent anchors and AR state inside story components.

## 51.5 Mainline-safe phases

Each derived project must preserve the existing phase-level integration doctrine:

> Finish a coherent phase -> focused validation -> ordinary Sounding Line final check -> protected integration -> next phase starts from new main.

No project may leave main in a state that assumes its next phase exists.

# 52. Derived Governing Documents Required

Before the corresponding implementation begins, create these documents or approved equivalent amendments.

## 52.1 Project Sextant v1.0

**The Device Context and Hardware Capability System**

Must define:

- provider architecture;
- semantic observations;
- permission model;
- capability tiers;
- sensor fusion;
- device lifecycle;
- privacy;
- performance;
- Device Lab scenario obligations;
- implementation phases and acceptance gates.

## 52.2 Project Parallax v1.0

**The Spatial Chronicle and Augmented Reality System**

Must be the largest derived document and define:

- SpatialEntity;
- Chronicle Lens;
- anchor families;
- adaptive staging;
- shared spatial reality;
- remote authoring;
- field calibration;
- discovery assistance;
- AR capture;
- rendering adapters;
- Creator UX;
- privacy/security;
- implementation phases.

## 52.3 Project Crossdeck v1.0

**The Multi-Surface Chronicle Experience System**

Must define:

- surface pairing;
- same-person/multi-device semantics;
- surface roles;
- synchronization;
- handoff;
- disconnect/reconnect;
- security;
- surface capability negotiation;
- implementation phases.

## 52.4 Project Landfall boundary amendment

Must move generic hardware capability ownership to Sextant, clarify Parallax spatial integration, preserve Worldspace/navigation authority, and reconcile any original Phase 4 native-sensor language before further implementation.

## 52.5 Storytide spatial/multi-surface amendment

Must define Spatial Moments, surface presentation selection, narrative hint language, and spatial fallback orchestration.

## 52.6 Watchglass spatial-perception amendment

Must define visual relocalization, surface/context classification, privacy screening, and evidence handoff to Parallax without stealing AR ownership.

## 52.7 Figurehead spatial-presence amendment

Must define how Figurehead characters can inhabit Parallax scenes while keeping character identity/render assets under Figurehead ownership.

## 52.8 Wakebook spatial-memory amendment

Must define clean AR Memory capture, archive metadata, crew sharing consent, and historical stability.

## 52.9 Sounding Line Device Lab annex

Must formally make Device Lab a repository-wide shared verification facility and define test tiers, scenario registration, evidence classification, real-device proof, and CI/runtime resource policy.

## 52.10 Drydock spatial/provider amendment or integration record

Must add validation semantics for capability/fallback/spatial scenes without creating a parallel runtime.

## 52.11 Harborlight spatial-content amendment

Required before public distribution of spatial presets, AR packs, or portable room Chronicles.

## 52.12 Sealed Hold spatial-media integration record

Required before persistent private calibration/media assets are stored or packaged through new spatial workflows.

# 53. Program Acceptance Criteria

This master architecture is considered successfully realized only when all applicable criteria are satisfied through the derived projects.

## Architecture and ownership

- Sextant, Landfall, Parallax, and Crossdeck have non-overlapping canonical ownership.
- No project has recreated another project's provider/runtime/state model.
- One Voyage remains authoritative progression truth.
- Machine-readable capability/event ownership exists and passes validation.

## Creator experience

- An ordinary Creator can author useful spatial content without understanding transforms, quaternions, or platform APIs.
- Guided, Detailed, and Engineering modes converge on one canonical contract.
- Remote semantic placement is genuinely usable without Creator travel.
- Adaptive placement variation is controllable and reproducible.
- Mandatory hidden content always has Discovery Assistance.

## Player experience

- Chronicle Lens is coherent and understandable.
- Required experiences degrade gracefully on unsupported devices.
- Shared crews see one shared spatial reality.
- Late join/reconnect preserves that reality.
- Multi-surface pairing feels like one Player using several surfaces, not several accounts.
- AR artifacts can move between handheld and placed states without identity loss.

## Privacy and safety

- automatic calibration uploads never contain detected people/faces;
- raw sensor/camera/location data is minimized;
- secondary surfaces use scoped revocable credentials;
- public/community content cannot leak private-room evidence;
- accessibility alternatives exist for mandatory interactions;
- physical-safety rules are enforced in authoring and validation.

## Memories

- clean AR Memory captures can be saved privately;
- archive display remains useful even if live AR technology evolves;
- shared discoveries can produce different personal viewpoint photos without duplicating scene truth.

## Verification

- Device Lab is platform-wide and Sounding Line-governed;
- deterministic simulation, emulator/simulator, real-device, and field evidence remain distinctly labeled;
- Drydock can identify impossible/unsafe spatial Chronicle configurations;
- release decisions remain Sounding Line authority.

## Product acceptance

Automated proof is not sufficient for final experiential acceptance. Major Parallax/Crossdeck/Chronicle Lens milestones require owner walkthroughs on representative real devices and actual shared spatial scenarios before being described as product-accepted.

# Appendix A. Ownership Matrix

**Ownership summary by capability**

- **Raw device sensor providers:** Sextant owns; Landfall, Parallax, and Watchglass consume; Sounding Line verifies.
- **Normalized heading and motion:** Sextant owns; Landfall, Parallax, Watchglass, and Storytide consume.
- **Worldspace/place context:** Landfall owns; Sextant contributes device context; Parallax, Watchglass, and Storytide consume.
- **Routes, waypoints, and journey state:** Landfall owns; Storytide, One Voyage, and Wakebook consume appropriate projections.
- **Spatial entity definition and AR rendering:** Parallax owns; Storytide and Crossdeck consume/transport; Sounding Line verifies.
- **Visual recognition:** Watchglass owns; Landfall and Parallax consume verified evidence.
- **Surface pairing:** Crossdeck owns; Storytide/Parallax consume paired-surface availability.
- **Shared spatial anchors:** Parallax owns spatial truth; Crossdeck transports/synchronizes it; Watchglass/Landfall may contribute context.
- **Story meaning:** Storytide owns; all experiential systems contribute context.
- **Progression mutation:** One Voyage alone owns authoritative transition.
- **Spatial Memory archive:** Wakebook owns archive truth; Parallax supplies capture; Storytide/One Voyage provide context.
- **Device/software qualification:** Sounding Line owns verification; each project supplies scenarios and assertions.


# Appendix B. Spatial Placement Policy Catalog

- **FIXED:** resolves during authoring/calibration and remains stable for all applicable runs; use for a specific landmark or site.
- **CALIBRATED:** resolves through field/Creator review and remains stable until recalibrated; use for remote sites refined from evidence.
- **ADAPTIVE_STICKY:** resolves at first eligible encounter and remains stable for the configured Voyage/crew lifecycle; use for reusable room staging that should not move every run.
- **ADAPTIVE_PER_CREW:** resolves when the crew begins the scene and remains stable for that crew; use when different crews may receive different staging.
- **ADAPTIVE_PER_RUN:** resolves each run and remains stable for that run; use for replay variation.
- **ADAPTIVE_VARIANT:** resolves at a configured variation boundary and intentionally selects among several plausible solutions.
- **PERSONAL:** resolves per person and remains personal; use only for accessibility/private effects, never accidentally for shared objects.

## Safety constraints common to adaptive policies

- do not place in detected hazards or blocked walk paths;
- do not require unreachable surfaces;
- do not place mandatory content outside declared search region;
- do not vary independently across Players in a shared scene;
- freeze after resolution for the applicable scope;
- record enough decision identity to reproduce/debug.

# Appendix C. Discovery Assistance Profiles

## Gentle Mystery

- Stage 0: no extra cue
- Stage 1: narrative hint
- Stage 2: contextual direction
- Stage 3: broad region shimmer
- Stage 4: object-specific signal
- Stage 5: exact reveal

## Compass Pull

- weak needle motion
- stronger directional pull
- haptic pulse near target
- broad target arc
- exact compass lock/reveal

## Whisper / Atmospheric

- spatial audio increases
- visual environment subtly reacts
- nearby surfaces respond
- exact apparition cue

## Accessible Direct

- optional immediate directional text
- high-contrast arrow/region
- haptic equivalent
- `Show Me` always available

Creators can style these profiles but mandatory content retains a bounded final recovery.

# Appendix D. Device Capability Catalog

Representative capability families include:

- position observation;
- heading estimate;
- full orientation/attitude;
- accelerometer;
- gyroscope;
- rotation vector / fused pose;
- magnetic field;
- relative pressure/elevation;
- proximity/light/environment where appropriate;
- haptics;
- camera;
- microphone only when separately governed by an authored experience;
- Bluetooth/BLE;
- UWB;
- NFC;
- notification capability;
- background execution capability;
- thermal/power state;
- secure local storage;
- AR world tracking;
- plane/surface understanding;
- depth/occlusion where available.

Each capability definition should eventually specify:

- semantic name;
- provider classes;
- permission requirements;
- confidence/quality metadata;
- privacy class;
- background policy;
- simulation support;
- real-device qualification requirement;
- default fallback expectations.

# Appendix E. Device Lab Scenario Catalog

Initial high-value scenarios include:

1. physical route with degraded GPS then recovery;
2. virtual Worldspace observation handoff;
3. heading alignment with calibration drift;
4. three-spin gesture with false partial rotations;
5. barometer relative-elevation climb;
6. magnetic target with noisy baseline;
7. magnetometer unavailable fallback;
8. adaptive desk-map placement;
9. adaptive per-run variation with deterministic seed;
10. shared anchor across two devices;
11. late third device join;
12. tracking loss and relocalization;
13. conflicting device observations;
14. Crossdeck phone disconnect while desktop continues;
15. permission denial mid-Spatial Moment;
16. low battery / thermal quality degradation;
17. person entering calibration frame -> discard;
18. calibration consent declined -> Chronicle continues;
19. hidden object timeout -> hint escalation;
20. exact `Show Me` final recovery;
21. reduced-motion spatial reveal;
22. one-handed accessibility alternative;
23. offline interaction pending reconciliation;
24. shared discovery + separate personal Memory captures;
25. Watchglass abstention with spatial fallback.

# Appendix F. Threat and Privacy Checklist

Before any spatial feature is accepted, verify:

- [ ] raw camera frames are not durably retained by default;
- [ ] calibration frames are screened before upload;
- [ ] automatic calibration rejects people/faces;
- [ ] location precision is no broader than required;
- [ ] pairing tokens are scoped, short-lived, and revocable;
- [ ] shared scene identities cannot be guessed/replayed across Voyages;
- [ ] spatial interaction receipts are fresh/idempotent;
- [ ] unsupported sensors fail safely;
- [ ] spoofed/mocked providers cannot accidentally appear production-certified;
- [ ] private room imagery cannot enter Harborlight public projections;
- [ ] screenshots/Memories have explicit sharing rules;
- [ ] logs avoid raw sensor streams and room imagery;
- [ ] accessibility fallbacks do not leak hidden/spoiler content prematurely;
- [ ] Creator previews cannot access unrelated Player calibration evidence;
- [ ] field-calibration retention is bounded;
- [ ] Player can decline calibration without losing Chronicle progress;
- [ ] dangerous physical-placement patterns are rejected;
- [ ] AR guidance does not override Landfall safety navigation;
- [ ] Device Lab evidence clearly states simulation tier.

# Appendix G. Glossary

**Adaptive Anchor** - Semantic spatial placement resolved against the current environment.

**Adaptive Spatial Staging** - Coordinated placement of multiple entities within an unknown or variable environment.

**Calibration Evidence** - Optional privacy-safe field evidence used to improve placement quality.

**Chronicle Lens** - Unified Player-facing spatial/perceptual interface.

**Crossdeck Surface** - One device/display participating in a person's active Voyage experience.

**Device Context** - Normalized capability and observation state produced by Sextant.

**Device Lab** - Sounding Line-governed shared facility for device/sensor/spatial lifecycle verification.

**Discovery Assistance Contract** - Required bounded hint/recovery policy for mandatory hidden spatial content.

**Fixed Anchor** - Placement intended to resolve to one specific real/virtual location.

**Parallax** - Project owning spatial entities, AR, anchors, adaptive staging, and Chronicle Lens spatial behavior.

**Placement Scope** - Lifecycle boundary at which adaptive placement may change.

**Sextant** - Project owning device capabilities and normalized hardware context.

**Shared Spatial Reality** - One authoritative spatial placement for all Players in the same configured shared scene.

**Spatial Entity** - Canonical Chronicle object with spatial identity, placement, interaction, visibility, and fallback contracts.

**Spatial Memory** - Private archival image/record of a spatial Chronicle moment.

**Spatial Moment** - Storytide-authored narrative moment that uses spatial interaction/presentation.

**Worldspace** - Landfall coordinate universe for physical or virtual place/navigation.

# References and Governing Sources

This document was derived from and must remain compatible with the following accepted/current Voyagewright authorities and design sources:

1. **Voyagewright Global Product Governance Standard v1.0** - product coherence, route reachability, visual quality, journey acceptance, owner walkthrough requirements.
2. **Project Landfall Governing Document v1.0** - physical navigation, confidence, privacy, safety, zero-infrastructure principle, progression boundaries.
3. **Project Landfall Governing Amendment v1.1: Worldspaces and Virtual Navigation** - physical and virtual Worldspaces and virtual journey semantics.
4. **Current accepted Project Landfall Phase 1-3 records and v1.1 follow-up** - current implementation truth and integration seams at repository baseline.
5. **Project Drydock Governing Architecture** - typed authoring, simulation, provider validation, publishing gates, cross-project adapters.
6. **Project One Voyage** - canonical progression/session authority and one authoritative runtime path.
7. **Project Watchglass governing architecture** - visual evidence, safe abstention, capture-source boundaries, runtime verification and certification.
8. **Project Sounding Line effective authority and machine-readable authority index** - repository-wide software verification and protected-main authority.
9. **Project Wayfarer** - one canonical person/account/profile and persistent personal history.
10. **Project Harborlight** - community distribution, immutable releases, privacy-safe public projection, location safety.
11. **Project Sealed Hold** - protected private Chronicle content and media boundaries.
12. **Project Wakebook** - private human archive and Chronicle Passport experience.
13. **Project Helm** - Captain/Voyage operational controls and participant lifecycle boundaries.
14. **Project Figurehead design records** - persistent character representation planned but not yet implemented.
15. **Project Storytide concept records** - Living Chronicle experience, narrative continuity, and future integration ownership.
16. The October 4, 2026 spatial-experience design conversation that introduced and reconciled device context, magnetic interactions, multi-surface Voyages, Chronicle Lens, AR artifacts, adaptive anchors, remote calibration, shared spatial reality, Discovery Assistance, AR Memories, and platform-wide Device Lab ownership.

Platform-specific API support changes over time. Project Sextant, Parallax, Crossdeck, Watchglass, and Device Lab implementation documents MUST verify current browser/native platform capabilities at implementation time rather than treating historical API availability as permanent governance.

# Final Governing Rule

> **Voyagewright may make a Chronicle feel as though it inhabits the Player's world, but the illusion must be built on disciplined truth.**
>
> Device observations remain evidence. Landfall remains world and journey truth. Parallax remains spatial truth. Crossdeck remains surface truth. Watchglass remains perception. Storytide remains meaning. Figurehead remains identity and presence. Wakebook remains memory. One Voyage remains authoritative progression. Drydock proves the authored experience. Sounding Line and Device Lab prove the software and hardware behavior.
>
> **Creators author intent. Players experience magic. The architecture absorbs the machinery.**

---

**End of Voyagewright Spatial Experience Architecture v1.0**