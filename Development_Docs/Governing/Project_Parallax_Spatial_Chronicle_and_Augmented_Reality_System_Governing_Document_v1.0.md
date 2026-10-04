---
title: "Project Parallax"
subtitle: "The Spatial Chronicle and Augmented Reality System"
author: "Voyagewright Engineering"
date: "October 4, 2026"
version: "1.0"
status: "Governing Baseline"
document_id: "VW-PARALLAX-001"
repository: "Kgray44/treasurehuntSoT"
repository_baseline: "4cb93c893ab57fa23bc14e4a81116c04212e1d0d"
---

> **Governing Principle**  
> Creators author spatial intent. Players experience a coherent world. Project Parallax resolves spatial implementation - anchoring, tracking, adaptive staging, shared spatial truth, rendering, interaction, recovery, and graceful fallback - without stealing device truth from Sextant, place truth from Landfall, perception from Watchglass, surface truth from Crossdeck, story meaning from Storytide, memory ownership from Wakebook, or authoritative progression from One Voyage.

Project Parallax is Voyagewright's canonical spatial Chronicle and augmented-reality subsystem. It turns the Player's surroundings, physical surfaces, virtual Worldspaces, handheld device, shared crew space, and future spatial-computing surfaces into a coherent authored stage for Chronicles.

Parallax is deliberately large. It is not a camera overlay feature, a map extension, a collection of AR components hidden in one Creator Studio sidebar, or a thin wrapper around ARKit/ARCore. It is the spatial substrate through which Voyagewright can place, reveal, animate, share, manipulate, remember, and safely recover authored Chronicle content in physical or virtual space.

Its central human promise is simple:

> **The Creator should be able to say what should happen in space without becoming an AR engineer, and the Player should experience the result without becoming a tracking technician.**

\newpage

# Document Control

- **Document ID:** `VW-PARALLAX-001`
- **Program:** Project Parallax
- **Subsystem:** The Spatial Chronicle and Augmented Reality System
- **Version:** 1.0
- **Date:** October 4, 2026
- **Status:** Governing baseline
- **Repository:** `Kgray44/treasurehuntSoT`
- **Repository baseline reviewed:** `4cb93c893ab57fa23bc14e4a81116c04212e1d0d`
- **Umbrella authority:** Voyagewright Spatial Experience Architecture v1.0
- **Device-context authority:** Project Sextant v1.0
- **World/place/navigation authority:** Project Landfall
- **Visual-perception authority:** Project Watchglass
- **Multi-surface authority:** Project Crossdeck (future governing document required)
- **Narrative-experience authority:** Project Storytide
- **Character/presence authority:** Project Figurehead
- **Memory/archive authority:** Project Wakebook
- **Progression authority:** Project One Voyage
- **Chronicle verification authority:** Project Drydock
- **Software verification authority:** Project Sounding Line
- **Device Lab authority:** Project Sounding Line; Parallax registers scenarios and consumes evidence
- **Community distribution authority:** Project Harborlight
- **Protected private spatial media authority:** Project Sealed Hold
- **Core implementation rule:** Parallax owns spatial truth and presentation; it does not become a second owner for hardware, maps, vision, identity, story progression, or personal archive truth.

## Normative language

The terms **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative. MUST-level requirements are release gates unless a later owner-approved governing amendment explicitly changes them.

A beautiful AR demo does not waive privacy. A stable local anchor does not become a shared crew truth without synchronization. A green test does not prove a Player can find the object. A plane detector returning a surface does not prove that surface is semantically appropriate. A generated image that resembles a room does not grant permission to upload a real room. And a cube remaining approximately on a table for ten seconds is not, by itself, Project Parallax complete.

## Authority and precedence

For Project Parallax work, use this order:

1. Voyagewright Global Product Governance Standard for one coherent product, human completion, accessibility, discoverability, visual quality, and owner acceptance.
2. Voyagewright Spatial Experience Architecture v1.0 for cross-project spatial ownership, shared invariants, Device Lab ownership, and program boundaries.
3. This Project Parallax v1.0 governing document for spatial Chronicle domain, authoring, runtime, AR, anchoring, adaptive staging, shared spatial reality, and Chronicle Lens spatial behavior.
4. Project Sextant v1.0 for device capability, pose/orientation context, haptics, power/thermal context, sensor/provider semantics, and generic hardware capability truth.
5. Accepted owner-project amendments for Landfall, Watchglass, Storytide, Figurehead, Wakebook, Crossdeck, Drydock, Harborlight, and Sealed Hold when those integrations are implemented.
6. Current protected repository source for actual implementation facts, current paths, compatibility seams, and accepted behavior.
7. Current Sounding Line authority for software verification and protected-main acceptance.
8. Task prompts for bounded execution only.

No task prompt may quietly move spatial truth into Landfall because a clue is location-aware, move vision intelligence into Parallax because a camera is open, or move device pairing into Parallax because two phones need the same anchor.

\newpage

# Contents

1. Executive Summary  
2. Project Identity and Product Vision  
3. Current Repository Context and Migration Boundary  
4. Why Parallax Is a First-Class Project  
5. Non-Negotiable Design Principles  
6. Scope and Explicit Non-Goals  
7. Canonical Ownership and Cross-Project Boundaries  
8. Product Surface Architecture  
9. Canonical Runtime Architecture  
10. Spatial Entity Domain  
11. Spatial Definition, Version, Instance, and Attachment Model  
12. Coordinate Spaces and Reference Frames  
13. Spatial Poses, Transforms, Scale, and Units  
14. Scene Tracking and Tracking Quality  
15. Scene Understanding and Surface Semantics  
16. Planes, Meshes, Depth, Occlusion, and Physics  
17. Raycasts, Hit Tests, Selection, and Placement  
18. Anchor Taxonomy  
19. Fixed Anchors  
20. Calibrated Anchors  
21. Adaptive Semantic Anchors  
22. Adaptive Spatial Staging  
23. Placement Policies and Sharing Scope  
24. Deterministic Variation and Reproduction  
25. Shared Spatial Reality  
26. SharedSpatialScene and Anchor Authority  
27. Late Join, Reconnect, Relocalization, and Re-Anchoring  
28. Cross-Platform Shared Anchors and Persistence  
29. Remote Spatial Authoring  
30. Field Calibration and Progressive Anchor Maturity  
31. Privacy-Safe Calibration Evidence  
32. Chronicle Lens Product Experience  
33. Chronicle Lens Tracking Guidance and Recovery  
34. Physical-Digital Artifact Model  
35. Pick Up, Carry, Place, Pin, Inspect, and Hand Off  
36. Canonical Desk-Map Experience  
37. Spatial Interaction Vocabulary  
38. Trails, Writing, Reveal Layers, Portals, and Apparitions  
39. Spatial Audio, Haptics, Lighting, Materials, and Effects  
40. Spatial Characters and Figurehead Presence  
41. Spatial Memory and AR Photography  
42. Discovery Assistance Contract  
43. Search-Time Semantics and Frustration Detection  
44. Spatial Library  
45. Spatial Library Item Taxonomy  
46. Immutable Library Versioning and Chronicle Attachments  
47. Vision Waypoint Library Relationship  
48. Parallax Spatial Studio  
49. Spatial Studio Information Architecture  
50. Spatial Canvas and Direct Manipulation  
51. Scene Graph and Layer Model  
52. Behavior Timeline and Interaction Flow  
53. Guided, Detailed, and Engineering Authoring  
54. AI-Assisted Spatial Authoring  
55. AI Critique, Safety, and Deterministic Materialization  
56. Simulation Environments and Multi-Environment Testing  
57. Preview Modes  
58. Chronicle Creator Integration and Lightweight Spatial Blocks  
59. Spatial Moment Presets and Reuse  
60. Assets, Materials, 3D Content, and Content Pipeline  
61. Native iOS Spatial Runtime  
62. Native Android Spatial Runtime  
63. Web Spatial Runtime and Graceful Capability Limits  
64. Project Sextant Integration  
65. Project Landfall Integration  
66. Project Watchglass Integration  
67. Project Crossdeck Integration  
68. Project Storytide Integration  
69. Project Figurehead Integration  
70. Project One Voyage Integration  
71. Project Wakebook Integration  
72. Project Drydock Integration  
73. Project Harborlight Integration  
74. Project Sealed Hold Integration  
75. Project Wayfarer, Helm, Lanternwake, and Homeport Integration  
76. Permissions, Privacy, and Data Minimization  
77. Security and Threat Model  
78. Physical Safety and Environmental Safety  
79. Accessibility and Inclusive Spatial Design  
80. Offline, Weak Network, and Reconciliation  
81. Performance, Battery, Thermal, and Quality Scaling  
82. Telemetry, Diagnostics, and Operations  
83. Data Model and Service Contracts  
84. Event, Receipt, and Evidence Vocabulary  
85. Creator Publishing and Compatibility Contracts  
86. Device Lab Integration  
87. Testing and Acceptance Matrix  
88. Implementation Phases  
89. Final Acceptance Criteria  
90. Recommended Technical Baseline  
91. Governance and Change Control  
Appendix A. Spatial Entity Schema  
Appendix B. Anchor and Placement Policy Catalog  
Appendix C. Spatial Moment Catalog  
Appendix D. Spatial Library Taxonomy  
Appendix E. Discovery Assistance Profiles  
Appendix F. Shared Spatial Reality Invariants  
Appendix G. Creator Studio / Spatial Studio UX Requirements  
Appendix H. Device Lab Scenario Catalog  
Appendix I. Threat and Privacy Checklist  
Appendix J. Accessibility Checklist  
Appendix K. Canonical Scenario Narratives  
Appendix L. Cross-Project Ownership Matrix  
Appendix M. Glossary  
References  
Final Governing Rule

\newpage

# 1. Executive Summary

Project Parallax establishes the spatial runtime and authoring system that allows a Chronicle to inhabit the Player's surroundings rather than merely describe them from a screen.

The system must support experiences such as:

- ghostly footprints that appear on a real trail only through the Chronicle Lens;
- hidden writing attached to a brick wall, tree, desk, stone, or virtual-world landmark;
- a folded note visibly peeking from behind a real object;
- a parchment map found in a Player's room, picked up, carried, and placed on a real desk;
- a map that remains rock-steady in world space while the Player walks the phone around it, so physical movement changes the viewing angle exactly as it would with real paper;
- an adaptive room Chronicle that asks for “a floor, a table, a doorway, and a wall” and stages itself differently in every compatible room;
- a Creator remotely authoring “place the clue on a believable stone wall near the entrance” without visiting the site;
- a first consenting Player producing person-free field evidence so that Creator can refine the placement remotely;
- a shared AR chest that every crew member sees in the same location;
- a late-joining Player resolving the already-existing shared anchor instead of independently spawning another chest in a lamp;
- a phone functioning as a Chronicle compass, scanner, decoder, spyglass, or map beside a desktop virtual Chronicle;
- a spatial artifact appearing in the Player's real room because of something discovered in a virtual world;
- clean AR photographs saved into personal Chronicle Memories as though the virtual object genuinely occupied the room;
- future Figurehead characters occupying real benches, doorways, tables, and shared spatial scenes;
- reusable Creator-made spatial experiences distributed through a governed Spatial Library and eventually Harborlight.

These experiences demand substantially more than a camera overlay. They require a coherent model of spatial identity, coordinate spaces, anchors, tracking quality, scene understanding, surface semantics, adaptive placement, shared truth, relocalization, privacy, content versioning, authoring usability, simulation, accessibility, and authoritative progression boundaries.

Parallax therefore defines a layered architecture:

```text
                 CREATOR INTENT
                      │
            ┌─────────┴─────────┐
            │                   │
   Parallax Spatial Studio   Spatial Library
            │                   │
            └─────────┬─────────┘
                      ▼
             Spatial Definition
                      │
        published/version-pinned attachment
                      │
                      ▼
                 Storytide Moment
                      │
                      ▼
              Parallax Runtime
      ┌───────────────┼─────────────────┐
      │               │                 │
      ▼               ▼                 ▼
   Sextant         Landfall         Watchglass
 device context   world/place      perception
      │               │                 │
      └───────────────┼─────────────────┘
                      ▼
          Spatial Resolution Engine
                      │
             Shared / Local Scene
                      │
                      ▼
                Chronicle Lens
                      │
                      ▼
             Player interaction
                      │
                      ▼
               typed evidence
                      │
                      ▼
                 One Voyage
            authoritative progression
```

The system is deliberately semantic. Creators work with concepts like:

```text
"partly hidden note near the entrance"
"trail of muddy footprints to the old tree"
"map somewhere believable on the floor"
"shared chest on a horizontal surface"
"apparition visible only from this direction"
```

rather than being forced to author transforms, anchor APIs, mesh constraints, reference frames, persistence identifiers, or recovery strategies.

At the same time, advanced Creators and engineers need access to the deeper controls. Parallax therefore adopts progressive disclosure:

- **Guided** authoring for ordinary intent-first creation;
- **Detailed** authoring for spatial behavior, placement, visibility, interaction, hints, and fallbacks;
- **Engineering** authoring for anchor policy, coordinate spaces, tracking thresholds, occlusion, relocalization, persistence, provider constraints, and evidence rules.

All three modes materialize the same canonical typed spatial definition. No “easy-mode runtime” and “advanced-mode runtime” divergence is permitted.

Parallax also establishes a crucial product architecture: **Spatial Studio and Spatial Library are first-class authoring surfaces, not an inspector sidebar bolted onto one Chronicle block.** Ordinary Creator Studio references spatial experiences through lightweight attachments and contextual overrides. Complex spatial authoring belongs in a workspace that looks, behaves, and feels spatial.

The central result is:

> **Voyagewright gains a full spatial storytelling engine without requiring Creators to become AR developers or Players to become tracking operators.**

\newpage

# 2. Project Identity and Product Vision

## 2.1 Name

**Project Parallax** is the Spatial Chronicle and Augmented Reality System.

The name is intentional. Parallax is the apparent change in position of an object as the observer's viewpoint changes. That relationship between observer, space, and perceived placement is the heart of the system.

A Player does not merely look at a virtual map.

They move around it.

A clue does not merely render over a camera feed.

It belongs somewhere.

A shared object does not merely exist in three private phone scenes.

It occupies one crew reality.

Parallax is the system that makes those statements true enough, stable enough, understandable enough, and recoverable enough for a Chronicle.

## 2.2 Product vision

The ultimate Parallax experience should make the Player think:

> **That thing is there.**

not:

> “The application is drawing a 3D model at approximately the right coordinates.”

The illusion may use sophisticated tracking, visual-inertial odometry, plane detection, depth, meshes, visual relocalization, cloud/shared anchors, device-context fusion, and synchronized surface state. None of that complexity should leak into the ordinary Player experience unless it is required to explain a recovery action.

Likewise, Creator Studio should make the Creator think:

> **I want a folded note partly hidden near the doorway.**

not:

> “I need a right-handed world transform and a vertical-plane anchor with a fallback raycast policy.”

## 2.3 The three product promises

Parallax is governed by three promises.

### Promise 1 - Spatial magic for Players

The Chronicle Lens should make spatial moments feel intentional, cinematic, stable, and recoverable.

### Promise 2 - Spatial authorship without AR engineering

A Creator can author spatial intent, build reusable scenes, test multiple environments, and publish robust fallbacks without understanding implementation APIs.

### Promise 3 - Truthful spatial engineering underneath

The platform never hides uncertainty by fabricating exact placement, silently diverging shared scenes, retaining room imagery unnecessarily, or allowing tracking failure to become Player blame.

## 2.4 Core product outcome

At completion:

- Voyagewright has one canonical spatial entity domain;
- Chronicle Lens is a coherent product surface;
- native iOS and Android AR runtimes share a common semantic contract;
- web receives a truthful reduced capability tier rather than pretending feature parity;
- fixed, calibrated, adaptive, and shared anchors are explicit policies;
- adaptive placement can intentionally vary by crew or run while remaining stable inside that scope;
- shared crews see one shared spatial reality;
- late join and reconnect preserve that reality;
- Creators can author remotely without visiting a physical location;
- field calibration is optional, person-free, and privacy-bounded;
- mandatory spatial searches include bounded discovery assistance;
- physical-digital artifacts can move between local-world and handheld states without losing story identity;
- Spatial Studio provides a proper modern spatial workspace;
- Spatial Library makes complex spatial content reusable and versionable;
- Watchglass Vision Waypoints remain a sibling perception library, not a merged conceptual landfill;
- AI can assist creation and critique but must materialize deterministic governed configuration;
- Drydock can prove spatial definitions and fallback paths before publication;
- Sounding Line and Device Lab can prove runtime behavior from deterministic simulation through real field qualification;
- One Voyage remains authoritative for progression.

\newpage

# 3. Current Repository Context and Migration Boundary

## 3.1 Current protected baseline

This document was prepared against protected `main` at:

```text
4cb93c893ab57fa23bc14e4a81116c04212e1d0d
```

That baseline includes:

- Voyagewright Spatial Experience Architecture v1.0;
- Project Sextant v1.0 governing baseline through merged PR #680;
- Project Landfall v1.0 and additive v1.1 Worldspaces amendment;
- accepted Landfall Phases 1 through 3 and the physical/virtual v1.1 follow-up;
- One Voyage authoritative progression;
- Drydock verification/simulation architecture;
- Sounding Line protected-main authority;
- current Creator Studio, Shipwright, Homeport, Wakebook, Wayfarer, Harborlight, Sealed Hold, Lanternwake, Helm, and other accepted platform foundations.

Project Parallax has **no accepted implementation yet**. This document creates governance, not product completion.

## 3.2 Existing spatial-like behavior must be classified, not stolen

The repository may already contain:

- Landfall map/location semantics;
- Watchglass preparation seams or declared-not-configured providers;
- Figurehead-ready UI slots;
- Lanternwake motion/rendering infrastructure;
- 3D artifact assets or renderers;
- Creator Studio media/library patterns;
- camera access for non-Parallax purposes;
- browser sensor/device-context behavior now assigned to Sextant;
- image/3D asset packages under Sealed Hold or Harborlight.

Parallax implementation must inventory and integrate those seams. It may not declare them “legacy” simply because a new project name exists.

## 3.3 No competing authoring or progression domain

Parallax must extend current canonical Chronicle authoring/publishing/versioning, not invent a second Chronicle package format or a second progression engine.

The canonical model remains:

```text
Creator draft
    ↓
validated/published immutable Chronicle version
    ↓
version-pinned Voyage / TaleSession
    ↓
One Voyage authoritative progression
```

Spatial definitions attach to that system.

## 3.4 Crossdeck is not yet governed

Crossdeck is established by the umbrella architecture but does not yet have its own v1.0 governing document. Parallax may define the contracts it requires from Crossdeck, but it must not implement Crossdeck's complete pairing/session/surface authority inside Parallax merely because shared AR needs it first.

Implementation that requires Crossdeck beyond a narrow accepted seam must wait for or explicitly coordinate with the Crossdeck governing baseline.

## 3.5 Watchglass status

Current accepted Landfall records explicitly treat Watchglass recognition as not configured. Parallax must therefore support operation without Watchglass and treat future vision integration as an additive capability, not a hidden prerequisite.

\newpage

# 4. Why Parallax Is a First-Class Project

Parallax is intentionally separated from Landfall, Sextant, Watchglass, and Storytide because spatial computing is large enough to deserve its own domain, authoring system, runtime, verification model, and lifecycle.

If Parallax were folded into Landfall, Landfall would become responsible for:

- maps;
- routes;
- geofences;
- virtual Worldspaces;
- AR rendering;
- world tracking;
- scene understanding;
- anchors;
- adaptive room staging;
- shared spatial scenes;
- 3D interaction;
- remote AR authoring;
- person-free calibration evidence;
- AR photography;
- reusable spatial libraries;
- AI spatial editing;
- multi-device anchor synchronization.

That is not a navigation subsystem. That is an empire pretending to be a map feature.

If Parallax were folded into Watchglass, perception and presentation would become inseparable. Watchglass asks **what is actually being seen and whether evidence is trustworthy**. Parallax asks **what authored spatial content should exist and where it should appear**. Those are complementary but different truths.

If Parallax were folded into Storytide, narrative orchestration would inherit rendering, anchor persistence, plane classification, tracking quality, and device-specific spatial recovery. Storytide should be able to ask for a Spatial Moment without becoming an AR framework.

If Parallax were folded into Sextant, hardware capability and spatial world state would become one subsystem. Sextant reports the instrument. Parallax owns the stage.

The separation therefore protects all four systems.

\newpage

# 5. Non-Negotiable Design Principles

## 5.1 Creators author spatial intent

The canonical authoring surface begins with meaning:

> “Put ghostly footprints from this area toward the old tree.”

not implementation.

## 5.2 Players experience one coherent spatial world

Shared content must not diverge casually between devices. Spatial movement, discovery, and recovery should preserve the illusion that the Chronicle changed the environment itself.

## 5.3 Adaptive is not inferior

An adaptive anchor may be the final intended artistic behavior. “Different valid hiding place every run” is a feature, not a calibration failure.

## 5.4 Stable within scope

Once an adaptive choice is made for its scope, it remains stable until an authorized transition. A Player looking away must not trigger a new hiding place because the ranking model experienced personal growth.

## 5.5 Shared placement is resolved once per sharing scope

`ADAPTIVE_PER_RUN` means once per run, not once per phone.

## 5.6 Tracking quality is visible to the runtime

Parallax must model tracking quality, scene understanding confidence, anchor quality, and relocalization state rather than flattening everything into `isARReady`.

## 5.7 Fallback is designed, not improvised

A spatial experience must declare what happens when world tracking, depth, visual localization, shared-anchor service, camera access, network, or required scene semantics are unavailable.

## 5.8 Mandatory search is bounded

No mandatory hidden spatial objective may strand a Player indefinitely.

## 5.9 Privacy-safe by construction

The system prefers derived spatial state and local processing. Automatic calibration evidence is person-free before upload. Private-room imagery never becomes casual telemetry.

## 5.10 Progression remains canonical

Parallax may produce interaction evidence. It does not authoritatively advance the Chronicle by local rendering side effect.

## 5.11 Accessibility is part of the spatial contract

Mandatory progress must not require motion, camera, hearing, precise vision, standing, walking, spinning, or fine motor control without governed alternatives.

## 5.12 Spatial Studio is not an inspector panel

Complex spatial experiences require a dedicated workspace. The ordinary Chronicle graph references the result; it does not absorb the full editor.

## 5.13 AI assists authorship; deterministic configuration runs the experience

AI may interpret intent, propose staging, generate helper configuration, critique scenes, or recommend fallbacks. Published runtime behavior must resolve from versioned governed definitions, not a live unconstrained model deciding where the clue feels like appearing today.

## 5.14 Real-world safety beats spectacle

No AR flourish is worth encouraging a Player to walk into traffic, trespass, stare continuously at the screen on a trail, climb unsafe structures, or physically interact with hazardous objects.

\newpage

# 6. Scope and Explicit Non-Goals

## 6.1 In scope

Parallax governs:

- Spatial Entity domain and identity;
- local, fixed, calibrated, adaptive, geospatial/Worldspace-referenced, visual, and shared anchor semantics;
- native AR runtime adapters;
- Chronicle Lens spatial presentation;
- scene tracking quality and recovery;
- surface/plane/mesh/depth context used for spatial placement;
- spatial interaction geometry;
- adaptive semantic placement;
- multi-object adaptive staging;
- shared spatial reality and anchor versioning;
- late join and relocalization;
- physical-digital artifact state transitions;
- spatial effects, trails, writing, portals, reveal layers, and apparitions;
- Spatial Library;
- Parallax Spatial Studio;
- spatial preview/simulation UX;
- remote authoring;
- field calibration;
- person-free calibration evidence package;
- Discovery Assistance Contract;
- clean AR Memory capture output;
- spatial authoring/publishing schemas;
- Drydock provider/validation seams;
- Device Lab scenarios;
- spatial runtime diagnostics.

## 6.2 Explicit non-goals

Parallax does not own:

- raw device sensor API abstraction (Sextant);
- geographic/virtual map truth and navigation (Landfall);
- computer vision recognition/certification (Watchglass);
- generic multi-device identity/pairing/session lifecycle (Crossdeck);
- Chronicle story meaning/sequencing (Storytide);
- character identity/appearance truth (Figurehead);
- personal archive truth (Wakebook);
- account identity (Wayfarer);
- Captain membership/progression authority (Helm/One Voyage);
- community publication infrastructure (Harborlight);
- private media security (Sealed Hold);
- software release authority or Device Lab ownership (Sounding Line);
- generalized 3D modeling software intended to replace Blender or CAD;
- unrestricted user-supplied executable shaders/scripts in published spatial content;
- facial recognition of random people as a Parallax feature;
- surveillance or continuous room recording;
- mandatory external infrastructure for the baseline spatial experience where a local equivalent is declared.

## 6.3 A spatial engine, not a general metaverse

Parallax exists to serve authored Voyagewright Chronicles. It is not permission to create an open-ended persistent public AR universe with arbitrary user-generated executable content, global public graffiti, or always-on spatial surveillance. Those would require separate governance and considerably more lawyers than pirates.

\newpage

# 7. Canonical Ownership and Cross-Project Boundaries

Project Parallax must be powerful without becoming an architectural sinkhole. The following ownership rules are mandatory.

## 7.1 Parallax owns spatial truth

Parallax owns the canonical answer to:

> **What authored spatial entities exist in this spatial scene, how are they anchored, what spatial relationships are stable, and what interaction state do they currently have?**

That includes the identity and lifecycle of shared anchors, spatial scene instances, adaptive placement resolutions, and physical-digital artifact pose/state.

## 7.2 Sextant owns device truth

Parallax may consume:

- pose-capable device-context capability declarations;
- orientation/heading context;
- motion/stability semantics;
- camera availability;
- haptics capability;
- power/thermal/performance context;
- lifecycle state;
- permission state.

Parallax does not implement generic motion, magnetometer, BLE, UWB, NFC, or haptic providers.

## 7.3 Landfall owns world and navigation truth

Landfall answers where the Player is in a physical or virtual Worldspace, which region/route/waypoint matters, what has been visited, and how location/journey confidence should be interpreted.

Parallax may anchor content to Landfall-provided Worldspace context, but must not create a competing map/route system.

## 7.4 Watchglass owns visual recognition

Parallax may request or consume typed Watchglass evidence such as:

- recognized landmark;
- matched known surface/object;
- visual relocalization result;
- privacy/person screening;
- scene classification;
- abstention/OOD state.

Parallax does not own recognition models, dataset certification, false-positive qualification, or visual evidence truth.

## 7.5 Crossdeck owns multi-surface participation

Parallax may publish and consume spatial scene synchronization messages through Crossdeck, but must not create a second account/device pairing system.

## 7.6 Storytide owns narrative meaning

Parallax knows that a `SpatialEntity` was discovered, placed, or aligned. Storytide knows whether that means “the ghost has awakened,” “the clue may be revealed,” or “the chapter should present the next narrative beat.”

## 7.7 One Voyage owns authoritative progression

Parallax produces typed interaction receipts and spatial evidence. One Voyage validates and records authoritative state transitions through the canonical progression path.

## 7.8 Wakebook owns personal memory truth

Parallax can create a clean composited capture and bounded metadata package. Wakebook decides how that becomes a personal Chronicle Memory, Keepsake candidate, private note attachment, or historical archive item.

## 7.9 Drydock owns authoring verification

Parallax defines what makes spatial content valid. Drydock orchestrates pre-publication verification using Parallax's schema/provider contract rather than duplicating the runtime.

## 7.10 Sounding Line owns software/device proof

Parallax registers test suites and Device Lab scenarios. It does not issue its own release decisions.

\newpage

# 8. Product Surface Architecture

Parallax is not one page. It is a family of coherent surfaces with distinct jobs.

## 8.1 Primary surfaces

### Parallax Spatial Studio

A full visual spatial authoring environment embedded inside Creator Studio's product shell but intentionally transformed into a dedicated spatial workspace.

### Spatial Library

A reusable, versioned library of Spatial Moments, Spatial Entities, placement recipes, interaction behaviors, effects, discovery profiles, and reusable scene compositions.

### Chronicle Lens

The Player-facing spatial runtime and camera/AR experience.

### Chronicle Graph / Story Block attachment

A lightweight ordinary Creator Studio attachment that references a prepared spatial definition and exposes only contextual overrides.

### Creator field-placement surface

A mobile authoring surface for direct on-site placement and calibration.

### Creator remote-calibration review

A desktop/mobile surface for reviewing optional privacy-safe field evidence and refining placement remotely.

### Drydock spatial verification view

A validation/simulation projection that explains capability needs, unsupported states, scene conflicts, discovery assistance, privacy requirements, and fallback coverage.

### Device Lab spatial station

Sounding Line-owned runtime verification of native tracking, shared anchors, lifecycle, performance, permission, and real-device behavior.

## 8.2 One product, not disconnected tools

A Creator must be able to move naturally among:

```text
Chronicle Graph
  → Spatial Moment reference
  → Edit in Parallax
  → Spatial Studio
  → Preview
  → Drydock issues
  → return to Chronicle
```

Opening Parallax must feel like entering a specialized room inside Creator Studio, not leaving Voyagewright for a separate engineering application.

## 8.3 Navigation and discoverability

Under global product governance:

- Spatial Experiences must have a visible Creator Studio destination;
- the Spatial Library must be directly reachable from Creator Studio Libraries;
- Spatial Moments referenced by a Chronicle must provide `Edit in Parallax` navigation;
- validation issues must deep-link to the exact affected spatial entity/behavior;
- mobile field-placement tools must have an obvious path from the corresponding spatial definition;
- no important Parallax surface may exist only as a secret URL.

\newpage

# 9. Canonical Runtime Architecture

The runtime should be layered so that platform-specific tracking can evolve without altering authored semantics.

```text
Spatial Definition / Version
            │
            ▼
     Parallax Scene Plan
            │
            ├──────── Storytide moment context
            ├──────── Landfall world context
            ├──────── Sextant device context
            ├──────── Watchglass evidence (optional)
            └──────── Crossdeck surface/shared-scene context
            │
            ▼
     Capability Negotiation
            │
            ▼
     Spatial Resolution Engine
            │
      ┌─────┴───────────────────────────┐
      ▼                                 ▼
Local/Adaptive Anchor           Fixed/Shared/Persistent Anchor
      │                                 │
      └──────────────┬──────────────────┘
                     ▼
                Scene Instance
                     │
             Render / Interaction
                     │
                     ▼
              Interaction Receipt
                     │
                     ▼
      Storytide completion provider
                     │
                     ▼
                 One Voyage
```

## 9.1 Scene plan

Before rendering, Parallax should materialize a scene plan that binds:

- exact spatial definition version;
- exact Chronicle version;
- current Storytide moment;
- placement policy;
- capability requirements;
- shared/personal scope;
- allowed fallbacks;
- discovery assistance;
- interaction contracts;
- privacy class;
- performance profile;
- accessibility alternatives.

## 9.2 Rendering adapters

Platform renderers implement a canonical semantic plan. They may differ in:

- tracking technology;
- scene reconstruction detail;
- depth support;
- occlusion quality;
- mesh availability;
- persistent-anchor mechanism;
- graphics API;
- shader/material implementation.

They may not silently change story semantics or sharing scope.

## 9.3 Runtime must remain inspectable

Every active Spatial Moment should be diagnosable through structured state such as:

```text
scene: ACTIVE
tracking: NORMAL
anchor: RESOLVED_SHARED
anchorVersion: 4
placementPolicy: ADAPTIVE_PER_RUN
confidence: HIGH
watchglass: NOT_REQUIRED
crossdeckPeers: 3
fallback: NONE
searchStage: 1
```

Ordinary Players do not see this diagnostic vocabulary. Bridgewatch/Admiralty/developer tools may consume sanitized forms later.

\newpage

# 10. Spatial Entity Domain

A `SpatialEntity` is the canonical authored thing that can exist in space.

It is not synonymous with a 3D model.

A Spatial Entity may represent:

- a 3D artifact;
- a 2D parchment attached to a surface;
- text written on a wall;
- a footprint trail;
- a portal;
- a reveal layer;
- a light source;
- an audio source;
- a particle field;
- a Figurehead character instance;
- an invisible interaction volume;
- a shared clue region;
- a world-space marker;
- a dynamic group of child entities.

## 10.1 Minimum canonical fields

A durable definition should include equivalent typed concepts for:

```text
SpatialEntityDefinition
  id
  version
  name
  entityKind
  contentBinding
  transformDefaults
  coordinateSpace
  anchorIntent
  placementPolicy
  sharingScope
  visibilityRules
  interactionRules
  renderingProfile
  accessibilityContract
  discoveryAssistance
  capabilityRequirements
  fallbackPolicy
  privacyClass
  persistencePolicy
  lifecycleRules
```

## 10.2 Entity identity is separate from anchor identity

The Captain's Map remains the Captain's Map if it moves from:

- floor anchor;
- handheld/device space;
- desk anchor;
- Memory viewer.

Its story identity does not change every time its transform changes.

## 10.3 Child entities

Entities may contain typed child relationships:

```text
CaptainMap
  ├─ parchment body
  ├─ ink markers
  ├─ compass rose
  ├─ active objective glow
  └─ interaction hotspot
```

Children may share one anchor unless their behavior requires independent anchoring.

## 10.4 Entity state and Chronicle state

Spatial state may include:

- hidden;
- revealed;
- discovered;
- picked up;
- placed;
- pinned;
- inspected;
- exhausted;
- archived.

These presentation/interaction states must map deliberately to Storytide/One Voyage state rather than creating a parallel progression model.

\newpage

# 11. Spatial Definition, Version, Instance, and Attachment Model

Parallax must preserve immutable publishing and reusable library behavior.

## 11.1 SpatialDefinition

A reusable Creator-owned draft identity.

## 11.2 SpatialDefinitionVersion

An immutable materialized version suitable for attachment to a published Chronicle version.

## 11.3 SpatialAttachment

A reference from a Chronicle/Storytide moment to a specific SpatialDefinitionVersion plus bounded contextual overrides.

## 11.4 SpatialInstance

A runtime instance bound to:

- exact Voyage/session;
- exact published Chronicle version;
- exact spatial definition version;
- exact run/crew/personal sharing scope;
- exact resolved anchor identity where applicable.

## 11.5 SpatialResolutionReceipt

Records why and how an adaptive/fixed/shared placement was resolved without retaining unnecessary raw room imagery.

## 11.6 Published stability

Publishing a Chronicle with `Desk Map v1.3` must not cause that Chronicle to silently use `Desk Map v2.0` later.

Creator Studio may offer:

> **Update attached spatial experience to v2.0**

but the update is explicit and changes the draft/published version checksum.

## 11.7 Library-to-Chronicle overrides

Overrides may alter bounded context such as:

- attached asset/content;
- text;
- target location binding;
- narrative hint copy;
- permitted color/material theme;
- discovery timing within allowed range.

Overrides must not mutate the underlying immutable library version.

\newpage

# 12. Coordinate Spaces and Reference Frames

Parallax must treat coordinate space as explicit domain state.

## 12.1 Supported conceptual spaces

### Device Space

Content follows the viewing device. Appropriate for handheld artifacts, reticles, immediate UI, or temporary acquisition states.

### Local Session World Space

A locally tracked room/site frame valid for one AR session or locally persisted experience.

### Shared Spatial Session Space

A crew-coordinated local frame associated with a shared anchor identity.

### Physical Worldspace Space
Spatial content related to Landfall's physical-world semantics, potentially including geospatial anchor providers.

### Virtual Worldspace Space

Spatial content related to an authored/game coordinate universe such as Sea of Thieves.

### Surface-Relative Space

Content attached to a detected plane/mesh/object surface.

### Entity-Relative Space

Child content positioned relative to another Spatial Entity.

## 12.2 Reference frame must be explicit

A transform without its coordinate space is incomplete.

## 12.3 Units

Canonical spatial distance should use SI meters internally. Authoring UI may display centimeters, feet, inches, or contextual measurements where useful, but serialized semantic contracts must remain unambiguous.

## 12.4 Orientation conventions

Platform adapters may use different handedness/axis conventions internally. Parallax must normalize them at the semantic boundary so authored rotations do not turn into cross-platform interpretive dance.

\newpage

# 13. Spatial Poses, Transforms, Scale, and Units

A `SpatialPose` must include or resolve equivalent semantics for:

- position;
- orientation;
- scale;
- coordinate-space identity;
- timestamp/freshness when derived dynamically;
- uncertainty where appropriate.

## 13.1 Avoid overexposing numbers

Guided Creator UX should offer relative placement language:

- near center;
- far-left edge;
- eye level;
- on surface;
- slightly above;
- partly behind;
- 0.5-1.5 m from doorway.

Engineering mode may expose precise values.

## 13.2 Scale realism

Physical artifacts should default to plausible real-world scale. A note should not silently become three meters wide because a model asset used arbitrary units.

Asset import validation must understand declared real-world scale or ask the Creator to calibrate it.

## 13.3 Transform hierarchy

Transforms should compose through explicit parent relationships. Grouping nearby entities under a shared anchor should be preferred where it improves stability/performance.

\newpage

# 14. Scene Tracking and Tracking Quality

Tracking is not binary.

Parallax must represent states equivalent to:

```text
INITIALIZING
MAPPING
NORMAL
LIMITED_LOW_LIGHT
LIMITED_EXCESSIVE_MOTION
LIMITED_FEATURES
RELOCALIZING
INTERRUPTED
LOST
UNSUPPORTED
```

Platform adapters map native states into the canonical model.

## 14.1 Player-facing guidance

The Chronicle Lens translates technical state into human instruction:

- “Look around slowly so the Chronicle can learn this place.”
- “Move a little closer to the desk.”
- “There isn't enough detail here. Try facing the room instead of the blank wall.”
- “The Chronicle lost this place. Look back toward where the map was.”

## 14.2 Tracking-quality hysteresis

Do not thrash the UI between good/bad states every frame. Use bounded dwell/hysteresis so transient quality dips do not produce a blinking panic machine.

## 14.3 Tracking does not equal anchor resolution

The camera may be tracking normally while a specific persisted/shared anchor remains unresolved. Those states must remain distinct.

\newpage

# 15. Scene Understanding and Surface Semantics

Scene understanding is the bridge between low-level geometry and Creator intent.

Parallax may consume provider outputs such as:

- horizontal plane;
- vertical plane;
- floor;
- wall;
- ceiling;
- table-like surface;
- seat;
- doorway/window evidence;
- mesh/geometry;
- depth;
- known image/object anchor;
- Watchglass scene/object classification.

## 15.1 Geometry and semantics are different

A horizontal plane is not automatically a desk.

A vertical plane is not automatically the correct stone wall.

Semantic adaptive placement should combine available evidence rather than elevating one provider result into truth.

## 15.2 Scene candidate

A placement candidate should carry:

```text
candidateId
geometryType
semanticClasses
bounds
pose
visibilityEstimate
reachabilityEstimate
occlusionContext
trackingQuality
watchglassEvidence?
landfallContext?
creatorIntentScore
safetyFlags
```

## 15.3 Best believable placement

Remote/adaptive placement chooses the best believable valid candidate, not an impossible perfect match.

\newpage

# 16. Planes, Meshes, Depth, Occlusion, and Physics

## 16.1 Capability tiers

Parallax must distinguish spatial understanding quality tiers.

Example conceptual tiers:

### P0 - Overlay only

Camera/2D overlay with no stable world anchor.

### P1 - Basic world tracking and plane placement

Stable local anchors on detected surfaces.

### P2 - Depth-aware placement and occlusion

Depth or scene geometry improves hit testing and realism.

### P3 - Scene reconstruction/classification

Detailed mesh, classification, physics interaction, richer occlusion.

### P4 - Shared/persistent spatial localization

Multiple devices/times resolve the same scene identity through approved shared/persistent anchor providers.

These are Parallax spatial capability tiers, not replacement Sextant capability tiers.

## 16.2 Occlusion

When supported, real objects should correctly occlude virtual content when that improves the authored illusion.

Occlusion must degrade gracefully. A mandatory clue may not become literally impossible to see because an approximate depth mesh classified the entire room as furniture.

## 16.3 Physics

Physics may be used for:

- objects settling onto a surface;
- parchment responding to tilt/interaction;
- virtual items colliding with scene geometry;
- controlled particle behavior.

Physics must remain deterministic enough for the intended interaction contract. Do not make progression depend on chaotic simulation state that cannot be reproduced or tested.

## 16.4 Depth privacy

Depth/mesh data describes private environments. Persist only when explicitly necessary, bounded, consented, and protected. The default is ephemeral local use.

\newpage

# 17. Raycasts, Hit Tests, Selection, and Placement

Raycasts/hit tests are implementation tools for resolving authored intent.

## 17.1 Placement selection

Creator or Player placement may use:

- screen-center reticle;
- tap target;
- detected plane;
- depth point;
- known image/object anchor;
- semantic candidate list;
- predefined Worldspace reference.

## 17.2 Stable reticle behavior

During manual placement, the UI should communicate:

- surface found;
- valid/invalid placement;
- orientation;
- scale preview;
- shared/private behavior;
- whether placement will persist.

## 17.3 Placement confirmation

Do not finalize a high-impact shared/persistent placement on the first noisy hit. Require a reasonable tracking state and allow correction before commit.

## 17.4 Accessible placement

Manual 3D placement must have alternatives such as:

- semantic auto-place;
- list of candidate surfaces;
- “place on nearest table”; 
- guided 2D selection;
- Captain/Creator configured fallback.

\newpage

# 18. Anchor Taxonomy

Parallax defines semantic anchor families independent of vendor API names.

## 18.1 LOCAL_WORLD

Session/local-world anchor with no long-term/shared identity guarantee.

## 18.2 SURFACE_RELATIVE

Anchor attached relative to a detected surface/trackable.

## 18.3 FIXED_WORLDSPACE

Anchor tied to a known Landfall Worldspace/location/reference.

## 18.4 VISUAL_REFERENCE

Anchor resolved from a known image/object/visual landmark using a Parallax/Watchglass-approved contract.

## 18.5 CALIBRATED_SITE

Anchor refined from field evidence and Creator approval.

## 18.6 ADAPTIVE_SEMANTIC

Anchor resolved from Creator intent against the current environment.

## 18.7 SHARED_SESSION

Anchor with authoritative identity shared among current crew devices.

## 18.8 PERSISTENT_SHARED

Anchor that may be resolved across time/devices through an approved provider such as a cross-platform cloud/shared-anchor service.

## 18.9 GEOSPATIAL

Anchor whose coarse/precise physical-world placement derives from approved geospatial providers coordinated with Landfall.

## 18.10 DEVICE_RELATIVE

Entity follows the device/handheld surface.

An authored entity may transition between anchor families during its lifecycle.

\newpage

# 19. Fixed Anchors

Fixed anchors are for content intentionally associated with one known place.

Examples:

- inscription on a particular memorial wall;
- apparition beside a named statue;
- note on one museum exhibit;
- artifact aligned with one specific game-world landmark;
- historical overlay on one building facade.

## 19.1 Fixed anchor identity

A fixed anchor must have stable authored identity separate from the platform-specific resolution method.

## 19.2 Resolution may still vary by provider

A fixed site can resolve through:

- local feature map;
- image reference;
- geospatial anchor;
- Watchglass landmark recognition;
- Creator manual calibration;
- bounded approximate fallback.

The place is fixed even when the technical provider changes.

## 19.3 Maintenance

Creator Studio should surface fixed-anchor health such as:

- never field tested;
- last verified date;
- field resolution success rate;
- known site change warning;
- provider no longer available;
- recalibration recommended.

\newpage

# 20. Calibrated Anchors

A calibrated anchor is a spatial placement refined against real field evidence.

It may originate from:

- Creator on-site placement;
- remote semantic placement followed by Creator field review;
- repeated successful field observations;
- an approved visual/geospatial anchor provider.

## 20.1 Calibration does not automatically destroy adaptivity

A Creator may use field evidence to improve a semantic rule without turning it into one exact coordinate.

Example:

> “Prefer the right half of the stone wall near the window.”

rather than:

> “Always use these exact pixels forever.”

## 20.2 Calibration versioning

Changes to a published anchor recipe create a new spatial definition version unless the governing maintenance contract explicitly permits backward-compatible operational metadata updates.

\newpage

# 21. Adaptive Semantic Anchors

Adaptive semantic anchors are one of Parallax's defining capabilities.

They allow a Creator to author *where something belongs conceptually* rather than where it exists numerically.

## 21.1 Canonical intent fields

A semantic anchor recipe may express:

- preferred surface classes;
- preferred nearby context;
- relative location on/near the surface;
- orientation preference;
- height/elevation preference;
- concealment;
- visibility requirements;
- minimum free space;
- maximum Player reach distance;
- acceptable substitute surfaces;
- prohibited surfaces/context;
- safety constraints;
- variation preference;
- search region;
- confidence threshold;
- fallback behavior.

## 21.2 Example

Creator intent:

> “Place a folded pirate map somewhere believable on the floor, preferably close to furniture but not in the middle of the walkway.”

Materialized recipe:

```text
surface: FLOOR
near: FURNITURE
avoid: [DOORWAY, ACTIVE_WALK_PATH, STAIRS]
concealment: LOW
visibility: PARTIAL
variation: HIGH
searchRegion: CURRENT_ROOM
fallback: GUIDED_PLACEMENT
```

## 21.3 Semantic match confidence

The runtime should retain the difference between:

- high semantic match;
- acceptable substitute;
- low-confidence fallback;
- no valid placement.

This drives hints, Creator diagnostics, and recovery behavior.

\newpage

# 22. Adaptive Spatial Staging

Adaptive staging solves a whole scene rather than one object at a time.

## 22.1 Example scene

```text
Captain's Map     → floor near furniture
Journal           → table-like surface
Ghost             → doorway/opening
Hidden Message    → wall
Compass           → handheld/device space
```

## 22.2 Staging constraints

The resolver should consider:

- semantic fit;
- entity-to-entity relationships;
- narrative reveal order;
- minimum/maximum separation;
- sightlines;
- occlusion;
- safe walking paths;
- available surfaces;
- room scale;
- Player reachability;
- accessibility;
- shared-scene resolvability;
- rendering/performance budget;
- whether entities should be visible simultaneously;
- whether one placement spoils another.

## 22.3 Constraint solving must fail honestly

If a scene requires a doorway and no reliable doorway-like region exists, the runtime must follow fallback policy. It must not declare the nearest ceiling fan “doorway enough” because a score needed to win.

## 22.4 Authoring preview

Spatial Studio should show how a scene distributes itself across several simulated rooms and highlight placement conflicts.

\newpage

# 23. Placement Policies and Sharing Scope

Parallax adopts the umbrella placement policies as normative.

## 23.1 FIXED

One intended real/virtual placement.

## 23.2 CALIBRATED

Placement refined through approved evidence.

## 23.3 ADAPTIVE_STICKY

Choose a valid placement once for the configured lifecycle and retain it.

## 23.4 ADAPTIVE_PER_CREW

Each crew may receive a different valid placement. Every Player in that crew receives the same placement.

## 23.5 ADAPTIVE_PER_RUN

A new run may resolve a new valid placement. All participants in that run share it.

## 23.6 ADAPTIVE_VARIANT

Intentionally select among several good staging solutions to create replay variation.

## 23.7 PERSONAL

Per-person placement only when the experience explicitly requires personal/private behavior, such as an accessibility cue or secret individual effect.

`PERSONAL` MUST NOT be the accidental default for a shared object.

## 23.8 Sharing scope separate from interaction scope

Placement may be shared while discovery or interaction state is personal.

Example:

```text
placement: CREW_SHARED
visual discovery: PER_PLAYER
pickup completion: CREW_SHARED
private note: PER_PLAYER
```

\newpage

# 24. Deterministic Variation and Reproduction

Variation must not make bugs unreproducible.

## 24.1 Resolution seed

Adaptive resolution should accept a reproducible seed or equivalent deterministic decision identity.

Conceptually:

```text
placement = Resolve(environmentSnapshot, intentVersion, policy, runSeed)
```

## 24.2 Environment dependence

The same seed in a materially different room may not produce the same geometry. The receipt must distinguish deterministic selection within the same evidence from impossible cross-environment exact reproduction.

## 24.3 Resolution receipt

Record bounded facts such as:

- intent version;
- policy;
- run/crew identity;
- seed;
- selected candidate class;
- semantic score band;
- safety decisions;
- fallback use;
- anchor identity/version.

Do not retain the whole room scan merely to make a bug report more convenient.

\newpage

# 25. Shared Spatial Reality

Shared Spatial Reality is a hard product invariant.

> **Every Player participating in the same configured shared scene must resolve the same logical spatial entities to the same authoritative shared anchor identities.**

## 25.1 Shared means one reality

If the note is under the chair for one Player, it is under that chair for the crew.

## 25.2 Variation occurs outside the shared scope

Another crew or another run may get another valid location if the placement policy permits it.

## 25.3 Local renderer differences are allowed

Two devices may render:

- different shadow quality;
- different occlusion fidelity;
- different particle density;
- different anti-aliasing;

while still sharing the exact logical anchor and story entity.

## 25.4 Approximation must not split truth

If one low-capability device cannot resolve the anchor precisely, it should enter a guided/shared fallback, not create a second private placement and pretend nothing happened.

\newpage

# 26. SharedSpatialScene and Anchor Authority

Parallax defines a canonical runtime concept equivalent to:

```text
SharedSpatialScene
  id
  voyageId
  chronicleVersionId
  spatialMomentId
  runId
  sharingScope
  placementPolicy
  anchorResolutionId
  anchorVersion
  anchorProviderClass
  environmentSignatureRef?
  state
  trackingQuality
  participantSurfaceRefs[]
  createdAt
  updatedAt
```

## 26.1 Anchor authority

One scene anchor resolution becomes authoritative for the configured scope.

A device may propose a candidate. It does not independently publish crew spatial truth.

## 26.2 Versioned anchor changes

Authorized re-anchor increments anchor version and produces an explicit transition receipt.

## 26.3 Crossdeck seam

Crossdeck is expected to transport shared scene identities and synchronize participating surfaces. Parallax remains the owner of what those identities mean spatially.

\newpage

# 27. Late Join, Reconnect, Relocalization, and Re-Anchoring

## 27.1 Late join

A late device receives the existing scene identity and resolves that anchor locally.

It MUST NOT re-run `ADAPTIVE_PER_RUN` selection.

## 27.2 Reconnect

A reconnecting device reconciles to the current anchor version before committing new shared interactions.

## 27.3 Relocalization

When tracking is lost:

```text
LOCAL TRACK LOST
   ↓
keep logical shared scene identity
   ↓
attempt local environment relocalization
   ↓
resolve authoritative anchor version
   ↓
resume
```

## 27.4 Re-anchor

Re-anchor requires an authorized reason:

- scene physically changed;
- provider declared anchor unrecoverable;
- Creator/Captain-approved recovery;
- story-authored relocation;
- accessibility fallback.

Re-anchor is never “the device couldn't find it immediately, so spawn another.”

## 27.5 Stale device protection

A device with anchor version 4 must not overwrite a version 5 shared scene using stale local state.

\newpage

# 28. Cross-Platform Shared Anchors and Persistence

Parallax must keep the shared-anchor contract provider-neutral.

Current platforms support several possible mechanisms, including local shared feature maps, cloud-hosted anchors, geospatial localization, known image/object references, or Watchglass-assisted relocalization. Platform support and external service terms can change.

## 28.1 Cross-platform goal

Where practical, an iOS Player and Android Player in the same crew should be able to share one spatial scene through an approved common anchor mechanism.

## 28.2 Provider capability declaration

A shared-anchor provider must declare:

- supported platforms;
- persistence duration;
- Internet requirements;
- privacy/data upload behavior;
- environment-feature requirements;
- accuracy/quality state;
- host/resolve quotas;
- geographic limitations;
- retention/deletion controls.

## 28.3 Cloud/shared anchors are not baseline requirements

A local baseline experience must have a fallback when the external shared-anchor provider is unavailable, rate-limited, unsupported, or privacy-inappropriate.

## 28.4 Shared anchor data is sensitive

Feature maps/environment descriptors may characterize private spaces. Sealed Hold/privacy governance must apply if durable provider artifacts or app-managed environment signatures are stored.

\newpage

# 29. Remote Spatial Authoring

Remote authoring is a first-class Parallax feature.

Creators must not be required to visit a site merely to create a useful spatial experience.

## 29.1 Authoring modes

### On-Site Placement

Creator physically visits and places/calibrates content.

### Remote Semantic Placement

Creator writes or visually composes the intended spatial relationship without seeing the actual final environment.

### Evidence-Calibrated Placement

A real field encounter optionally supplies privacy-safe evidence for remote Creator refinement.

## 29.2 Natural-language intent

Creator Studio may interpret statements such as:

> “Put the clue on an old-looking stone wall near the entrance, around eye level.”

The system must show the resulting structured interpretation rather than silently hiding what the AI understood.

## 29.3 Remote authoring quality levels

Creator Studio should communicate whether an anchor is:

- semantic only;
- field observed;
- Creator reviewed;
- calibrated;
- repeatedly verified.

## 29.4 No mandatory field evidence

A Chronicle can remain intentionally adaptive forever. Field calibration improves confidence where desired; it does not define legitimacy.

\newpage

# 30. Field Calibration and Progressive Anchor Maturity

Parallax defines anchor maturity metadata such as:

```text
SEMANTIC
OBSERVED
CREATOR_REVIEWED
CALIBRATED
VERIFIED
```

## 30.1 SEMANTIC

Only Creator intent is known.

## 30.2 OBSERVED

At least one real environment successfully resolved placement.

## 30.3 CREATOR_REVIEWED

Creator reviewed bounded field evidence and approved the placement.

## 30.4 CALIBRATED

Creator adjusted placement/semantic relationship against field context.

## 30.5 VERIFIED

Multiple later encounters successfully resolve the intended placement within governed quality bounds.

## 30.6 Quality does not imply immutability

A verified adaptive experience can still choose a different location each run if that is the authored policy.

## 30.7 Creator-facing metrics

Useful summaries may include:

- successful resolution rate;
- mean time to discover;
- hint-stage distribution;
- exact-reveal use rate;
- tracking-recovery rate;
- unsupported-device fallback rate;
- anchor confidence distribution.

These metrics must remain privacy-safe and aggregate where appropriate.

\newpage

# 31. Privacy-Safe Calibration Evidence

Field calibration is useful precisely because the Creator may not know the place. It is also one of the easiest ways to accidentally turn a delightful Chronicle into an unsolicited room-surveillance product. The privacy boundary is therefore mandatory architecture.

## 31.1 Automatic calibration evidence is opt-in

The Player must receive a clear explanation before any field-calibration evidence is retained or uploaded.

The experience must state, in human language:

- what will be captured;
- why it helps;
- who may view it;
- how long it is retained;
- whether it is required;
- what happens if the Player declines.

Declining must not prevent ordinary Chronicle completion.

## 31.2 Person-free before upload

Automatic calibration evidence MUST use an on-device screening flow equivalent to:

```text
candidate camera frame
        ↓
person detector
        ↓
possible person? ───── YES → DISCARD LOCALLY
        │
        NO
        ↓
face detector
        ↓
possible face? ─────── YES → DISCARD LOCALLY
        │
        NO
        ↓
minimize / crop to useful spatial context
        ↓
show/obtain consent as required
        ↓
protected upload
```

A person-containing frame is not uploaded first and repaired later.

## 31.3 Conservative screening

When the classifier is unsure whether a human/reflection/portrait is present, automatic evidence should fail closed and wait for another candidate frame.

## 31.4 Context minimization

The preferred evidence is the smallest useful crop or bounded representation that lets the Creator understand:

- relevant surface;
- nearby fixed landmark/context;
- current anchor overlay;
- approximate relative geometry.

A full 4K room panorama is not the default simply because storage is cheap and privacy apparently needed another enemy.

## 31.5 Remove accidental metadata

Protected calibration evidence must strip or govern:

- EXIF GPS unless explicitly necessary and authorized;
- unrelated device identifiers;
- unnecessary timestamps beyond operational need;
- embedded thumbnails;
- faces/person detections;
- microphone/audio;
- background imagery outside the useful crop.

## 31.6 Calibration evidence is not a Memory

Calibration evidence belongs to the Creator/placement-quality workflow under strict retention.

A Player intentionally taking a Chronicle Memory is a separate user-authored act and may follow the user's intended framing and normal private-media consent policy.

\newpage

# 32. Chronicle Lens Product Experience

Chronicle Lens is the unified Player-facing spatial interface.

It is intentionally broader than “AR Camera.”

## 32.1 Lens responsibilities

The Lens may present:

- world-tracked AR entities;
- Watchglass scanning/verification guidance;
- directional context;
- surface acquisition;
- artifact interaction;
- adaptive placement discovery;
- spatial hints;
- clean Memory capture;
- local calibration assistance;
- cross-surface artifact handoff.

## 32.2 One metaphor, many providers

The Player should not have to choose:

- AR mode;
- scanner mode;
- vision mode;
- magnetometer mode;
- compass mode;
- spatial mode.

Storytide can say:

> **Use the Chronicle Lens.**

The runtime selects the appropriate capabilities.

## 32.3 Lens states

A useful canonical state machine may include:

```text
CLOSED
REQUESTING_PERMISSION
INITIALIZING
LEARNING_SPACE
READY
SEARCHING
TRACKING_ENTITY
INTERACTING
RELOCALIZING
DEGRADED
GUIDED_FALLBACK
CAPTURING_MEMORY
ERROR_RECOVERABLE
```

## 32.4 Lens controls

Controls should be minimal and context-sensitive:

- close/back;
- spatial hint;
- accessibility mode;
- Memory capture;
- optional flashlight/lighting assist where safe;
- placement confirm/cancel when needed;
- `Show Me` after governed discovery escalation;
- lightweight quality/help indicator.

Developer diagnostics are hidden outside developer tools.

## 32.5 Cinematic identity

Chronicle Lens should visually belong to Voyagewright and the active Chronicle. It may adapt materials, subtle overlays, typography, effects, compass treatment, and artifact styling while preserving readability and stable core interaction patterns.

\newpage

# 33. Chronicle Lens Tracking Guidance and Recovery

Tracking failure should feel like a recoverable environmental issue, not a software crash.

## 33.1 Guidance ladder

Examples:

- “Move the phone slowly.”
- “Look toward the desk again.”
- “This wall has too little detail. Try the stonework beside it.”
- “The room changed since this clue was placed. Re-anchor nearby?”
- “This device cannot hold the object in place reliably. Open Guided View.”

## 33.2 No blaming the Player

If the anchor confidence is low, do not merely increase hints that imply the Player cannot find an object that was badly placed.

The runtime should distinguish:

- Player has not searched the target region;
- Player passed near the target but did not discover it;
- anchor confidence is weak;
- tracking quality is weak;
- target surface moved;
- scene no longer resembles calibration;
- shared anchor failed to resolve;
- content is occluded by a runtime defect.

## 33.3 Relocalization UI
During shared/persistent relocalization, the Lens should keep the scene's identity clear:

> “Finding the Captain's Map again…”

rather than silently displaying nothing.

## 33.4 Guided fallback

Guided fallback may show:

- 2D directional cues;
- annotated camera view without stable 3D anchoring;
- broad target region;
- list/diagram instructions;
- Watchglass-assisted recognition;
- normal Storytide clue alternative.

Fallback remains part of the authored experience, not an error page.

\newpage

# 34. Physical-Digital Artifact Model

A physical-digital artifact is a Chronicle object whose spatial relationship can change while its identity remains stable.

## 34.1 Canonical states

Examples:

```text
WORLD_PLACED
DISCOVERED
HANDHELD
PINNED_TO_VIEW
PLACEMENT_PREVIEW
WORLD_PLACED_NEW_ANCHOR
SHARED_WORLD_PLACED
ARCHIVED_VIEW
```

## 34.2 Artifact is not the anchor

The artifact has story identity. The anchor describes one spatial relationship.

## 34.3 State transition ownership

Parallax owns the spatial transition. Storytide/One Voyage decide what the transition means to the Chronicle.

## 34.4 Realism versus usability

An artifact should behave plausibly but remain usable. A parchment may settle onto a table with a subtle physical response, but must not continuously slide off because the simulated table plane is 1.8 degrees imperfect.

## 34.5 Shared artifacts

When an artifact is crew-shared, one Player moving it may require:

- shared ownership/interaction lock;
- optimistic preview followed by authoritative scene update;
- conflict handling;
- explicit “Sera is placing the map…” presentation.

The exact transport belongs to Crossdeck; Parallax owns the spatial state transition.

\newpage

# 35. Pick Up, Carry, Place, Pin, Inspect, and Hand Off

## 35.1 Pick Up

Player selects an eligible world-placed entity and transitions it to handheld/device-relative space.

The UI should communicate the action spatially rather than abruptly removing and reopening the object in a modal.

## 35.2 Carry

Handheld state remains stable and readable while the Player walks/moves the device.

## 35.3 Place

Player chooses a valid surface/location. Parallax previews placement, validates constraints, and commits a new anchor.

## 35.4 Pin

Pinning keeps an artifact available as a stable interface object without pretending it is physically placed in the room.

This is useful when:

- the Player is seated;
- AR tracking is unavailable;
- the artifact is frequently referenced;
- accessibility mode prefers a stable screen-space view.

## 35.5 Inspect

Inspection may temporarily isolate or enlarge an object while preserving its world identity. Closing inspect returns it to the same placement.

## 35.6 Hand Off between surfaces

A Crossdeck-enabled experience may move presentation responsibility:

```text
Desktop Journal
   ↓ "Take the chart"
Phone Chronicle Lens
   ↓ place on desk
Desktop Journal reacts
```

The artifact is not duplicated into competing progression state.

\newpage

# 36. Canonical Desk-Map Experience

The desk-map scenario is a normative Parallax reference experience because it exercises nearly every important boundary.

## 36.1 Discovery

The map appears in the Player's real room through an adaptive or fixed spatial placement.

## 36.2 Pickup

Player selects/takes it. The map leaves its world anchor and becomes handheld.

## 36.3 Desk placement

The Player points at a horizontal surface. Parallax proposes a valid placement and confirms.

## 36.4 World stability

Once placed, the map remains fixed relative to the desk/world. Rotating the phone changes the camera viewpoint, not the map's own orientation.

## 36.5 Physical zoom

Moving the phone closer naturally reveals more detail. The scene respects perspective.

## 36.6 Digital zoom

Pinch/gesture MAY provide additional semantic map zoom where the artifact supports it.

Physical and digital zoom are distinct.

## 36.7 Virtual-world content

For a Sea of Thieves Chronicle, Landfall may supply a virtual Worldspace map and current journey context while Parallax supplies real-desk placement.

## 36.8 Desktop synchronization

Crossdeck may synchronize selected regions, discovered marks, or story interactions to the desktop Chronicle.

## 36.9 Memory capture

Player may capture the desk map as a clean Chronicle Memory.

## 36.10 Fallback

Without stable AR, the same artifact can become a pinned handheld map or ordinary full-screen interactive chart.

\newpage

# 37. Spatial Interaction Vocabulary

Parallax needs a reusable interaction vocabulary that Spatial Studio can compose.

Representative interactions include:

- discover;
- gaze/aim;
- approach;
- enter volume;
- exit volume;
- tap/select;
- inspect;
- pick up;
- place;
- pin;
- rotate;
- translate;
- scale;
- align;
- trace;
- wipe/reveal;
- assemble;
- attach;
- detach;
- open/close;
- drag;
- throw/drop only where safe and reproducible;
- follow trail;
- scan arc;
- look through portal;
- maintain viewpoint;
- maintain distance;
- hold steady;
- wait/dwell;
- collaborate with crew;
- confirm shared placement.

## 37.1 Interaction contracts

Each interaction defines:

- eligibility;
- input methods;
- accessible alternatives;
- completion evidence;
- timeouts;
- shared/personal state;
- cancellation;
- recovery;
- replay behavior.

## 37.2 Gesture ownership

Raw device gesture semantics such as “three full rotations” may come from Sextant. Parallax decides how that gesture affects spatial content. Storytide decides what it means narratively.

\newpage

# 38. Trails, Writing, Reveal Layers, Portals, and Apparitions

Parallax should support rich Spatial Moment primitives without forcing Creators to build every effect from raw entities.

## 38.1 Trails

A trail can represent:

- footprints;
- droplets;
- rope marks;
- glowing dust;
- spectral residue;
- compass traces;
- arrows/symbols.

Trails may follow:

- authored geometry;
- Landfall route geometry;
- adaptive pathfinding through a local scene;
- sequence of semantic anchor points.

## 38.2 Hidden Writing

Writing may attach to:

- wall;
- floor;
- object surface;
- virtual artifact;
- Worldspace landmark.

It may reveal based on:

- proximity;
- viewing angle;
- Watchglass confirmation;
- story state;
- wiping/tracing interaction.

## 38.3 Reveal Layers

An alternate spatial visual layer may show:

- historical version of a place;
- magical residue;
- hidden symbols;
- ghosted structures;
- annotated landmarks.

## 38.4 Portals and windows

Portals must clearly define whether they are:

- visual-only scene windows;
- navigable virtual spaces;
- transition surfaces into another Parallax scene;
- Storytide presentation devices.

## 38.5 Directional apparitions

Content may become visible only inside an authored viewing cone, but mandatory content must include discovery assistance and accessible alternatives.

## 38.6 Ground guidance

Footsteps/arrows can guide Players, but outdoor safety rules require the Player to look up and remain situationally aware. Ground AR does not replace Landfall's safe navigation model.

\newpage

# 39. Spatial Audio, Haptics, Lighting, Materials, and Effects

## 39.1 Spatial audio

Parallax may position audio sources relative to entities where platform capability and accessibility permit.

Storytide owns narrative audio meaning; Parallax owns spatial placement characteristics.

## 39.2 Haptics

Haptics are requested semantically through Sextant.

Examples:

- subtle pulse as compass alignment improves;
- impact when artifact settles;
- escalating pulse near hidden object;
- confirmation on successful placement.

Every essential haptic cue must have a visual/text alternative.

## 39.3 Lighting

Spatial entities should respond plausibly to real/virtual lighting where supported, but rendering fidelity must scale to device capability.

## 39.4 Materials

Parallax should support a governed material system suitable for:

- parchment;
- wood;
- metal;
- glass;
- spectral/translucent effects;
- ink;
- water-like effects;
- cloth;
- emissive magical materials.

## 39.5 Effects budget

Particles, fog, glow, distortion, post-processing, and dynamic shadows must respect thermal/performance quality profiles.

## 39.6 Lanternwake boundary

Lanternwake remains Voyagewright's broader presentation/motion authority. Parallax spatial motion may use its own renderer/runtime, but transitions into/out of Chronicle Lens and spatial reveals must respect platform reduced-motion and motion-language governance.

\newpage

# 40. Spatial Characters and Figurehead Presence

Parallax prepares the stage for Figurehead characters.

## 40.1 Ownership

Figurehead owns:

- character identity;
- visual appearance;
- historical appearance versions;
- expression;
- pose vocabulary;
- outfit/body representation.

Parallax owns:

- world placement;
- scale in scene;
- anchor;
- spatial orientation;
- visibility/occlusion;
- local interaction geometry;
- shared spatial presence.

## 40.2 Examples

- sailor seated on a real bench;
- ghost Captain standing in a doorway;
- character looking toward a physical landmark;
- crew Figurehead avatars occupying a shared virtual table;
- historical version of a character appearing at a fixed site.

## 40.3 Gaze and target relationships

Parallax may expose a world target to Figurehead:

```text
Figurehead pose: LOOK_TOWARD_TARGET
Parallax target: SpatialEntity: hidden-writing-17
```

The rendering/animation integration must not create duplicate character state.

## 40.4 Fallback

Without AR, the same Figurehead moment may render in Storytide cinematic presentation or a 2D Chronicle Lens composition.

\newpage

# 41. Spatial Memory and AR Photography

Spatial Memories let Players preserve the illusion as part of their personal Chronicle history.

## 41.1 Clean capture pipeline

```text
camera frame
+ authored AR entities
+ intended cinematic effects
- controls
- reticles
- tracking warnings
- developer diagnostics
= Memory image
```

## 41.2 Memory capture must be intentional

Do not automatically save room images simply because something important happened.

Storytide may offer a subtle:

> **Save this moment?**

for selected meaningful moments, but the Player decides.

## 41.3 Metadata handoff

Parallax may attach:

- Spatial Moment ID;
- Spatial Entity IDs;
- Chronicle/version;
- Voyage/session;
- capture orientation;
- bounded presentation state;
- optional coarse place label where permitted.

Wakebook owns the durable personal record.

## 41.4 Shared discovery, individual view

Several Players may photograph the same shared artifact from different angles. Those are distinct personal Memories linked to one shared Spatial Moment instance.

## 41.5 Annotation

Wakebook may later let Players annotate/caption/circle content. Parallax need only provide the clean original and semantic reference.

## 41.6 Revisit Moment

Future archive presentation may use retained semantic metadata to create a non-authoritative interactive artifact view. Historical pixels must remain stable even if the live runtime changes.

\newpage

# 42. Discovery Assistance Contract

Every mandatory hidden Spatial Moment must define bounded discovery help.

## 42.1 Required fields

Conceptually:

```text
DiscoveryAssistancePolicy
  expectedSearchTime
  maximumUnguidedSearchTime
  stages[]
  exactRevealAvailable
  accessibleDirectMode
  trackingFailureBehavior
  lowAnchorConfidenceBehavior
  alternateCompletion
```

## 42.2 Creator controls style, not abandonment

Creators may style assistance as:

- compass pull;
- whispers;
- ink hints;
- haptics;
- environmental shimmer;
- direct navigation;
- narrative clues.

They may not choose “no help ever” for mandatory progression.

## 42.3 Final recovery

Mandatory content requires a final exact recovery path such as:

- `Show Me`;
- direct highlight;
- guided camera turn;
- normal 2D clue;
- Captain-confirmed completion.

## 42.4 Optional secrets

Optional Easter eggs may intentionally omit strong help when Drydock proves no required progression depends on them.

\newpage

# 43. Search-Time Semantics and Frustration Detection

## 43.1 Meaningful search timer

Do not count:

- app background time;
- locked screen time;
- lost tracking;
- permission interruption;
- unrelated Storytide reading time;
- time outside relevant region;
- Lens closed time.

## 43.2 Search coverage

Where privacy-safe and technically appropriate, Parallax may track transient search coverage such as:

- angular sectors viewed;
- broad room regions observed;
- target proximity passes;
- repeated near misses.

This supports smart hints without durable room surveillance.

## 43.3 Example

If the target is inside the only unviewed 40-degree sector, a useful hint is:

> “You haven't looked behind you yet.”

not:

> “Try searching harder.”

## 43.4 System-blame detection

When low anchor confidence and prolonged failure coincide, Parallax should prefer:

- re-resolve;
- relax semantic constraints;
- guided fallback;
- Creator-quality telemetry;

rather than continuously blaming the Player.

## 43.5 Creator analytics

Aggregate field quality can identify bad placements:

> 18 encounters, 7 required Stage 3, 4 required exact reveal, median search 141 seconds.

Creator Studio may recommend adjustment.

\newpage

# 44. Spatial Library

Parallax requires its own reusable Spatial Library.

It must remain distinct from the Watchglass Vision Waypoint Library.

## 44.1 Why separate libraries

Vision Waypoint Library asks:

> **What should Voyagewright recognize or verify?**

Spatial Library asks:

> **What should Voyagewright place, reveal, animate, stage, or let the Player interact with in space?**

Combining them would blur evidence definitions with presentation definitions and eventually create a type system that appears to have been assembled during a storm.

## 44.2 Deep interoperability

Spatial Library items may reference Vision Waypoints for:

- visual relocalization;
- landmark confirmation;
- semantic surface/object verification;
- discovery verification.

Vision Waypoints may reference spatial context for expected viewpoint/region.

References are typed. Ownership remains separate.

## 44.3 My Spatial Library versus Chronicle-only

Creators need:

### Chronicle Spatial Items

Definitions private to one Chronicle/draft.

### My Spatial Library

Reusable items available across Chronicles.

Action:

> **Save to Spatial Library**

should intentionally promote a Chronicle-only item into a reusable library definition/version.

## 44.4 Search and organization

Library needs:

- search;
- tags;
- categories;
- favorites;
- recent;
- collections;
- owner-created versus installed;
- version status;
- compatibility/capability indicators;
- usage references;
- preview thumbnails/3D previews.

\newpage

# 45. Spatial Library Item Taxonomy

The exact persistence model may evolve, but Creator UX should recognize meaningful categories.

## 45.1 Spatial Moments

Complete reusable authored experiences.

Examples:

- Desk Treasure Map;
- Haunted Footprint Trail;
- Hidden Wall Message;
- Shared Treasure Chest;
- Doorway Apparition.

## 45.2 Spatial Entities

Individual reusable objects/effects.

Examples:

- parchment letter;
- bottle;
- key;
- compass;
- portal frame;
- ghost lantern.

## 45.3 Placement Recipes

Reusable anchor intents:

- partly hidden on horizontal surface;
- eye-level wall;
- floor beside furniture;
- near entrance;
- centered on known image target;
- shared desk placement.

## 45.4 Interaction Behaviors

Reusable interaction contracts:

- pick up and place;
- inspect and rotate;
- trace to reveal;
- wipe dust;
- assemble fragments;
- follow trail;
- align viewpoint.

## 45.5 Spatial Effects

- spectral glow;
- ink reveal;
- portal shimmer;
- fog apparition;
- dust trail;
- water-like distortion;
- magical residue.

## 45.6 Discovery Profiles

- obvious;
- lightly hidden;
- scavenger hunt;
- compass pull;
- atmospheric whispers;
- direct accessible.

## 45.7 Scene Templates

Multi-entity compositions such as:

- pirate study;
- haunted room;
- expedition trail;
- historical reveal station.

## 45.8 Avoid one `type + JSON` landfill

The underlying data model must preserve typed semantic distinctions so Drydock and Creator Studio can validate correctly.

\newpage

# 46. Immutable Library Versioning and Chronicle Attachments

## 46.1 Version identity

Reusable items must have immutable versions with:

- semantic version or platform version policy;
- schema version;
- content checksum;
- asset dependency checksums;
- minimum Parallax/runtime capability;
- optional Watchglass/Sextant/Landfall dependencies;
- compatibility notes.

## 46.2 Published Chronicle pinning

Published Chronicle attaches exact version identity.

## 46.3 Update flow

Creator draft may show:

> **Spatial Experience update available: 1.3 → 2.0**

with semantic differences and Drydock impact.

## 46.4 Fork/remix

A Creator may duplicate/fork a library item, creating a new lineage rather than mutating the original.

Harborlight later governs public distribution, licensing, attribution, and remix lineage.

## 46.5 Dependency compatibility

A scene version depending on `Portal Shimmer v3` must remain reproducible even after `Portal Shimmer v4` exists.

\newpage

# 47. Vision Waypoint Library Relationship

The two libraries are sibling systems with explicit bridge contracts.

## 47.1 Example - fixed statue letter

Spatial definition:

```text
Folded Letter on Statue
anchor: VISUAL_REFERENCE
visionReference: VisionWaypoint:old-harbor-statue@2.1
relativePose: right-side / 0.4m / eye-level
```

Watchglass says whether the statue is recognized within its evidence contract.

Parallax uses that typed evidence to resolve placement.

## 47.2 Example - room-adaptive note

No Vision Waypoint is required. Parallax resolves a horizontal surface semantically.

## 47.3 Example - discovery verification

Parallax knows Player is looking at the right AR region. Watchglass verifies the real object behind/near it.

## 47.4 Library UI cross-links

Spatial Studio should support:

> **Use Vision Waypoint…**

and Vision Waypoint detail may show:

> **Used by 4 Spatial Experiences**

without merging the two libraries.

## 47.5 Independent versioning

A Vision Waypoint update should not mutate a Spatial Library version. A new Chronicle draft may update the linked version after verification.

\newpage

# 48. Parallax Spatial Studio

Spatial Studio is a first-class specialized Creator workspace.

It remains inside Voyagewright Creator Studio's shell, identity, navigation, permissions, autosave, publishing, and design language, but the workspace itself must feel spatial.

## 48.1 Product rule

> **Center = spatial world, not configuration form.**

## 48.2 Core layout

A canonical desktop composition may include:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ PARALLAX / Spatial Studio                 Preview ▾  Drydock  Save      │
├──────────────────┬──────────────────────────────────┬───────────────────┤
│ SPATIAL LIBRARY  │                                  │ INSPECTOR         │
│                  │          SPATIAL CANVAS          │                   │
│ Moments          │                                  │ Placement         │
│ Entities         │        [simulated room]          │ Interaction       │
│ Trails           │                                  │ Visibility        │
│ Effects          │        [selected map]            │ Sharing           │
│ Presets          │                                  │ Fallback          │
│                  │                                  │ Accessibility     │
├──────────────────┴──────────────────────────────────┴───────────────────┤
│ SCENE GRAPH / BEHAVIOR TIMELINE / VALIDATION                           │
└────────────────────────────────────────────────────────────────────────┘
```

## 48.3 Modern and AI-native, not generic neon chatbot

The interface may feel advanced through:

- real-time semantic suggestions;
- scene understanding visualizations;
- intelligent command palette;
- natural-language intent entry;
- AI critique surfaced contextually;
- animated spatial selection and material previews;
- subtle depth/lighting;
- responsive direct manipulation;
- confidence/compatibility visualization.

It should not become “purple gradient + chat bubble = AI.”

## 48.4 Voyagewright visual coherence

Spatial Studio can be more technical and spatial than ordinary Studio, but still uses Voyagewright's typography, navigation, color system, surfaces, accessibility, motion rules, and interaction quality.

\newpage

# 49. Spatial Studio Information Architecture

Recommended major areas:

## 49.1 Scene

Canvas, hierarchy, environment, anchors, entities.

## 49.2 Library

Reusable Spatial Library content.

## 49.3 Placement

Intent, surfaces, anchor policy, variation, sharing.

## 49.4 Interaction

Player inputs, artifact actions, triggers, state.

## 49.5 Appearance

Assets, materials, lighting, effects, audio, animation.

## 49.6 Discovery

Visibility, concealment, hint stages, exact recovery.

## 49.7 Capability and Fallback

Required/preferred capabilities, graceful degradation, accessibility.

## 49.8 Shared Scene

Sharing scope, crew synchronization, late join, conflict behavior.

## 49.9 Calibration

Remote evidence, site health, field quality, anchor maturity.

## 49.10 Validation

Drydock findings, performance estimates, privacy/safety warnings.

## 49.11 History/Versions

Definition versions, usages, update comparison, published attachments.

\newpage

# 50. Spatial Canvas and Direct Manipulation

## 50.1 Canvas types

Spatial Studio should support:

- free 3D editor camera;
- simulated room/environment;
- imported safe reference environment where permitted;
- live device mirroring for on-site authoring;
- abstract virtual Worldspace scene;
- map/geospatial context integration.

## 50.2 Direct manipulation

Creators can:

- drag from library;
- move;
- rotate;
- scale;
- snap to surfaces;
- group;
- duplicate;
- hide/show;
- lock;
- reorder layers;
- parent/attach;
- switch anchor strategy;
- preview visibility.

## 50.3 Semantic handles

Guided mode may show handles like:

> Near doorway

> On desk

> Eye level

rather than only X/Y/Z gizmos.

## 50.4 Engineering gizmos

Engineering mode may expose axes, transforms, normals, bounding volumes, anchor origin, occlusion mesh, tracking/debug overlays, and provider diagnostics.

## 50.5 Undo/redo

Spatial editing requires reliable undo/redo across:

- transforms;
- semantic placement changes;
- hierarchy;
- behavior;
- library attachments;
- AI-generated changes.

AI changes must appear as normal reversible edits, not mystical irreversible gifts from the machine.

\newpage

# 51. Scene Graph and Layer Model

Spatial scenes can become complex enough that a flat list will fail.

## 51.1 Hierarchy example

```text
CAPTAIN'S STUDY
  Environment
  ├─ Desk Map
  │   ├─ Ink Markers
  │   ├─ Compass Rose
  │   └─ Objective Glow
  ├─ Ghost Captain
  │   ├─ Figurehead Instance
  │   ├─ Gaze Target
  │   └─ Spatial Voice Source
  ├─ Footprint Trail
  └─ Hidden Wall Writing
```

## 51.2 Layer states

- visible/hidden;
- locked/unlocked;
- selectable/nonselectable;
- editor-only;
- runtime-only;
- shared/personal;
- conditional visibility.

## 51.3 Group constraints

Groups may carry:

- shared anchor;
- adaptive staging relationship;
- relative spacing;
- reveal sequence;
- performance budget.

## 51.4 Search/filter

Large scenes need search by:

- name;
- type;
- tag;
- anchor;
- interaction;
- issue;- visibility;
- capability dependency.

\newpage

# 52. Behavior Timeline and Interaction Flow

Parallax needs a visual way to understand spatial behavior without pretending to replace Storytide's full narrative graph.

## 52.1 Timeline purpose

The Parallax timeline describes *spatial state changes and interactions*.

Example:

```text
MOMENT START
  ↓
Footprints visible
  ↓ Player reaches end
Desk map revealed
  ↓ Player takes map
Map handheld
  ↓ Player places on desk
Ghost appears at doorway
  ↓ Player inspects mark
Spatial interaction complete
```

Storytide owns the broader chapter/narrative sequencing.

## 52.2 Event nodes

Parallax timeline may respond to typed inputs such as:

- scene enter;
- entity discovered;
- interaction complete;
- Storytide signal;
- Landfall region active;
- Watchglass matched;
- Sextant gesture observed;
- One Voyage canonical event;
- timer/dwell;
- shared Player interaction.

## 52.3 No freeform executable code

Creators use governed nodes/expressions, not arbitrary JavaScript scripts embedded in community spatial content.

## 52.4 Animation choreography

Parallax spatial animation can be authored here while respecting Lanternwake/reduced-motion governance.

\newpage

# 53. Guided, Detailed, and Engineering Authoring

Parallax adopts the established three-level authoring philosophy as a core design requirement.

## 53.1 Guided

Questions in human terms:

> Where should this appear?

> How hidden should it be?

> Can it move between runs?

> Can the Player pick it up?

> Is it shared with the crew?

> What happens if AR is unavailable?

## 53.2 Detailed

Expose:

- preferred surface classes;
- height/distance;
- concealment;
- variation;
- interaction radius;
- visibility conditions;
- discovery assistance;
- sharing scope;
- performance tier;
- persistence;
- fallbacks.

## 53.3 Engineering

Expose:

- coordinate space;
- anchor family;
- provider constraints;
- transform;
- surface normals;
- relocalization thresholds;
- tracking confidence;
- occlusion/depth policy;
- persistence provider;
- interaction volumes;
- evidence contract;
- fallback priority;
- diagnostics.

## 53.4 One model underneath

Changing authoring mode alters disclosure, not stored truth.

## 53.5 Mode persistence

Creator preference can persist per user/workspace, but a shared project must open safely even if another Creator used Engineering mode.

\newpage

# 54. AI-Assisted Spatial Authoring

Parallax should be AI-native in usefulness, not merely styling.

## 54.1 Intent interpretation

Creator can write:

> “Put a folded pirate letter partly hidden somewhere near the entrance, ideally on a table or shelf.”

AI proposes a structured recipe and highlights:

- entrance-region preference;
- horizontal surface;
- desk/table/shelf preference;
- partial concealment;
- adaptive placement.

Creator reviews before acceptance.

## 54.2 Scene generation assistance

Commands may include:

- “Create muddy footprints from the doorway to this chest.”
- “Make the ghost appear slowly when the Player gets within two meters.”
- “Make this scene eerie but easy to discover.”
- “Create three adaptive placements that work in a small dorm room.”

## 54.3 Asset assistance

AI may help:

- classify imported assets;
- estimate real-world scale;
- suggest collision bounds;
- propose thumbnail/preview framing;
- generate draft textures/effects subject to asset governance;
- draft accessible descriptions.

## 54.4 AI must show its work at the configuration level

The resulting deterministic spatial configuration must be visible and editable.

Do not store “AI prompt: make it spooky” as the only runtime contract.

## 54.5 Provenance

AI-generated assets/configuration must carry provenance and licensing metadata appropriate to Harborlight/publishing policy.

\newpage

# 55. AI Critique, Safety, and Deterministic Materialization

AI is especially valuable as a spatial design reviewer.

## 55.1 Critique examples

> **Discovery risk:** This mandatory object is heavily concealed and exact reveal does not become available for eight minutes.

> **Compatibility:** The preferred experience requires world-tracked AR; several target capability profiles will use fallback.

> **Sharing conflict:** Placement is PERSONAL while completion is CREW_SHARED.

> **Privacy:** Field calibration is enabled but the definition lacks person-free evidence/consent policy.

> **Physical safety:** The current placement allows content to resolve inside a stair path.

> **Performance:** This scene exceeds the target mid-tier particle/shadow budget.

## 55.2 AI does not waive Drydock

AI critique is advisory authoring assistance. Drydock is the governed verification authority.

## 55.3 No runtime unconstrained placement model by default

Published runtime uses versioned intent rules and deterministic resolver behavior.

If future AI runtime inference is introduced, it requires separate governance, reproducibility, privacy, latency, safety, fallback, and evaluation contracts.

## 55.4 Prompt injection resistance

Imported asset names, public Harborlight metadata, room text recognized by Watchglass, and Chronicle content must not be able to inject instructions into authoring/critique models. Treat external content as data.

\newpage

# 56. Simulation Environments and Multi-Environment Testing

Creators cannot physically test every target environment.

Spatial Studio therefore needs simulation environments.

## 56.1 Built-in environment families

Examples:

- bedroom;
- living room;
- dorm;
- office;
- classroom;
- museum/gallery;
- outdoor trail;
- plaza/street;
- empty room;
- small cluttered room;
- large sparse room.

## 56.2 Test N environments

Creator may run:

> **Test in 10 environments**

and receive results such as:

```text
8 valid placements
1 acceptable fallback
1 no safe surface
```

with visual examples.

## 56.3 Synthetic environments are not field proof

Simulation helps authoring. It does not replace Device Lab D4/D5 evidence for real tracking quality and physical scenes.

## 56.4 Import/reference environments

Future Creator workflows may allow a privacy-safe environment scan/reference import. Such functionality requires strict Sealed Hold/private-media governance and is not necessary for baseline remote semantic authoring.

## 56.5 Environment randomization

Drydock/Studio simulation should vary:

- room dimensions;
- furniture placement;
- surface availability;
- lighting quality;
- occlusion;
- tracking feature richness;
- supported capabilities;
- device class.

This helps detect brittle spatial definitions before publication.

\newpage

# 57. Preview Modes

Spatial Studio should provide several previews because “looks right from free camera” is not enough.

## 57.1 Editor View

Free 3D camera with guides/diagnostics.

## 57.2 Phone Preview

Portrait/landscape mobile framing with real UI chrome assumptions.

## 57.3 Chronicle Lens Preview

Simulated Player camera view with tracking/search guidance.

## 57.4 Shared Crew Preview

Two or more simulated viewpoints resolving the same shared scene.

## 57.5 Low-Capability Preview

Shows reduced tracking/occlusion/material capability.

## 57.6 Fallback Preview

Shows Guided/2D alternative when AR is unsupported.

## 57.7 Accessibility Preview

Tests reduced motion, high contrast, direct hint mode, seated mode, sound-off, haptics-off, screen reader descriptions.

## 57.8 Performance Preview

Estimates scene complexity and target quality tier. It must clearly distinguish estimates from real-device evidence.

## 57.9 Remote-placement preview

Shows several plausible semantic resolutions rather than one falsely authoritative imaginary room.

\newpage

# 58. Chronicle Creator Integration and Lightweight Spatial Blocks

Ordinary Chronicle authoring should reference Parallax, not embed it.

## 58.1 Spatial Moment block/attachment

A lightweight configuration may include:

```text
Experience: Captain's Lost Map v2
Trigger: chapter 4 begins
Completion: map discovered
Sharing: crew shared
Preferred surface: Chronicle Lens
Overrides: none
```

and:

> **Edit in Parallax →**

## 58.2 Contextual overrides only

The sidebar may expose a small number of high-value overrides, not the entire spatial engine.

## 58.3 Deep linking

Clicking a spatial entity reference in Storytide/graph/Drydock opens the correct definition, entity, and inspector selection in Spatial Studio.

## 58.4 Prevent inspector catastrophe

The Creator block inspector MUST NOT become the place where:

- anchor provider;
- coordinate system;
- room simulation;
- spatial effect timeline;
- discovery profiles;
- occlusion policy;
- shared scene behavior;
- remote calibration;
- AI authoring

are all stuffed into one 900-pixel sidebar.

That is precisely why Spatial Studio exists.

\newpage

# 59. Spatial Moment Presets and Reuse

High-value presets should make sophisticated spatial behavior immediately approachable.

Possible first-party presets:

- Desk Map;
- Hidden Wall Message;
- Ghost Footprint Trail;
- Peeking Letter;
- Doorway Apparition;
- Floating Compass;
- Buried Artifact;
- Shared Chest;
- Historical Reveal Window;
- Portal;
- Spatial Audio Whisper;
- Viewpoint Alignment Puzzle;
- Adaptive Room Scavenger Hunt.

## 59.1 Presets are editable instances

Applying a preset creates a normal spatial definition or instance that can be customized and later saved to the Creator's library.

## 59.2 Preset quality

First-party presets must include:

- fallback;
- accessibility;
- discovery assistance where required;
- performance profile;
- validation fixtures;
- Device Lab expectations where relevant.

## 59.3 Community later

Harborlight may distribute approved presets/packs after its spatial-content amendment exists.

\newpage

# 60. Assets, Materials, 3D Content, and Content Pipeline

Parallax needs a robust but safe content pipeline.

## 60.1 Supported content classes

Potential content includes:

- 3D models;
- 2D planes/sprites;
- textures;
- materials;
- animation clips;
- particle/effect definitions;
- audio;
- environment/reference assets;
- Figurehead representations;
- procedural trail/effect parameters.

## 60.2 Prefer open/portable formats where practical

The runtime should favor portable asset formats and platform conversion pipelines rather than Creator-authored proprietary runtime code.

## 60.3 Asset validation

Validate:

- dimensions/scale;
- triangle/mesh complexity;
- textures/resolution;
- material compatibility;
- animation length;
- missing resources;
- malware/file safety through existing content pipeline;
- licensing/provenance;
- accessibility description;
- performance tier.

## 60.4 No arbitrary executable code in community assets

Spatial packs may contain declarative behaviors. Arbitrary uploaded JavaScript/native code/shaders are not accepted merely because they make a portal look impressive.

## 60.5 Runtime conversion

Platform-specific conversion may occur during build/package preparation, but published semantic asset identity remains stable.

## 60.6 Asset privacy

Private Chronicle assets remain protected through Sealed Hold. Public/community assets use Harborlight release/projection rules.

\newpage

# 61. Native iOS Spatial Runtime

Parallax's iOS runtime should use current Apple spatial frameworks appropriate to the target device generation while preserving the canonical Parallax contract.

## 61.1 Expected capability families

Depending on current platform support and hardware, the iOS adapter may use:

- world tracking;
- plane detection;
- anchors;
- raycasts;
- scene depth;
- scene reconstruction;
- object/image tracking;
- person occlusion;
- RealityKit rendering and physics;
- native camera and lighting estimates;
- persistent/local world mapping mechanisms where approved.

## 61.2 Sextant boundary

Parallax does not directly own general Core Motion sensor streams for its semantic domain. It may consume Sextant device context and use AR framework pose/tracking data inside the spatial adapter as required by the platform runtime.

## 61.3 Feature detection

The adapter must check support at runtime. LiDAR/scene reconstruction/depth are enhancements, not universal assumptions.

## 61.4 Tracking quality

Native tracking states must map into canonical Parallax quality/recovery semantics.

## 61.5 Person occlusion versus person-free evidence

Runtime people occlusion can improve visuals. It does not replace the stricter person/face rejection rule for automatic calibration evidence.

## 61.6 Simulator limitations

Some AR features require real hardware and are not faithfully provable in simulator. Device Lab must label simulator evidence honestly and require D4/D5 proof for relevant release claims.

\newpage

# 62. Native Android Spatial Runtime

Parallax's Android runtime should use current ARCore/platform spatial capabilities where supported while preserving the same semantic domain.

## 62.1 Expected capability families

Potential capabilities include:

- motion tracking;
- plane detection;
- local anchors;
- Depth API;
- hit tests;
- cloud/shared anchors;
- geospatial anchors;
- lighting/environment estimation;
- image tracking/augmented images;
- platform rendering through an approved engine/framework.

## 62.2 Shared anchors

Cloud/shared anchor providers may support room-scale multi-user experiences across Android and iOS. Parallax must wrap those providers in its own shared-anchor lifecycle, privacy, versioning, and fallback contract rather than exposing provider IDs as product identity.

## 62.3 Depth

Depth improves:

- hit testing;
- occlusion;
- placement on non-planar surfaces;
- interaction realism.

Depth support must be detected at runtime and is not required for every compatible device.

## 62.4 Geospatial providers

Geospatial anchors can complement Landfall for fixed real-world spatial content. Landfall remains owner of physical place/navigation meaning; Parallax owns the spatial entity anchored there.

## 62.5 Emulator and real hardware

Android Emulator can support substantial Device Lab scenario control, but camera/world-tracking fidelity for AR still requires real-device qualification where relevant.

\newpage

# 63. Web Spatial Runtime and Graceful Capability Limits

The web remains important for broad access, but Parallax must be honest about browser capability fragmentation.

## 63.1 Web tiers

A web implementation may offer:

- camera-assisted overlays;
- device orientation/motion through Sextant where supported;
- 2D/3D WebGL presentation;
- WebXR immersive AR where supported;
- hit-test/anchor features where available;
- guided semantic placement;
- Watchglass-assisted camera recognition;
- pinned handheld artifacts.

## 63.2 No fake parity

If stable world-tracked AR is unavailable in a browser/platform, the UI must not pretend the same experience exists by letting an object drift around the screen and calling it anchored.

## 63.3 Secure context

Camera/WebXR/device features generally require secure contexts and permissions. Creator publishing must know that deployment requirements exist.

## 63.4 Web as fallback and bridge

The web can provide excellent Guided View and camera-assisted experiences even when native-grade AR is unavailable.

## 63.5 Progressive native enhancement

A Chronicle can remain accessible through the web while offering richer native Parallax behavior on supported devices.

\newpage

# 64. Project Sextant Integration

Sextant is Parallax's canonical provider of general device context and capabilities.

## 64.1 Parallax consumes

- device orientation/heading semantic observations where relevant;
- device stability/motion state;
- haptics;
- camera capability declaration;
- lifecycle/background/lock state;
- thermal/power/performance context;
- permission state;
- optional nearby/ranging context for future spatial behaviors.

## 64.2 Parallax owns spatial pose from AR runtime

AR framework camera pose/world tracking is part of spatial runtime implementation. Sextant still owns generic device context. The boundary should be documented to prevent duplicate listeners and contradictory reference frames.

## 64.3 Capability negotiation

Parallax asks Sextant for semantic requirements such as:

```text
media.camera
orientation.absolute (optional)
haptics.semantic (preferred)
device.performance-class
```

and combines that with Parallax-native spatial provider availability such as world tracking/depth/shared anchor support.

## 64.4 Sampling coordination

When both Parallax and Landfall/Watchglass need device context, Sextant arbitrates subscriptions and sampling rather than each consumer opening independent high-rate sensor loops.

\newpage

# 65. Project Landfall Integration

Landfall and Parallax are complementary.

## 65.1 Landfall provides

- active Worldspace;
- broad physical/virtual position;
- route/region/waypoint context;
- expected target bearing;
- visited/discovered location state;
- map/chart semantics;
- privacy-safe place context.

## 65.2 Parallax uses world context

Examples:

- only activate a fixed AR clue inside the appropriate region;
- attach a virtual-world artifact to the correct Sea of Thieves island context;
- render a ground trail aligned with a Landfall route;
- select the correct site-local spatial definition after Landfall establishes broad place.

## 65.3 No competing navigation

Chronicle Lens may show a directional spatial cue, but persistent journey/navigation state remains Landfall.

## 65.4 Safety handoff

Outdoor AR should defer to Landfall's physical safety/navigation policy rather than encouraging continuous camera fixation.

## 65.5 Geospatial anchors

Where geospatial spatial providers are used, Landfall owns geographic meaning and Parallax owns the spatial anchor/entity. The integration receipt should preserve both provenance classes.

\newpage

# 66. Project Watchglass Integration

Watchglass gives Parallax eyes without becoming the spatial renderer.

## 66.1 Possible Watchglass contributions

- surface/object semantic classification;
- fixed landmark recognition;
- visual relocalization evidence;
- known image/object detection;
- privacy person/face screening;
- scene quality/OOD assessment;
- object verification for a spatial interaction.

## 66.2 Safe abstention

Watchglass may abstain. Parallax must have a declared behavior for `UNCERTAIN` or `NOT_CONFIGURED`.

## 66.3 Evidence versus placement

Watchglass can say:

> “This appears to be the Old Harbor Statue with high confidence.”

Parallax says:

> “Resolve the letter 0.4 m to the right of the statue reference.”

## 66.4 Visual localization package

Parallax must consume typed, versioned Watchglass receipts rather than retaining opaque model internals.

## 66.5 Vision Waypoint Library bridge

Spatial Studio may browse/reference Vision Waypoints but does not duplicate Watchglass authoring/training controls.

\newpage

# 67. Project Crossdeck Integration

Crossdeck is the future multi-surface owner required for the full desktop + phone and crew experience.

## 67.1 Parallax requires from Crossdeck

- active surface identities;
- same-person surface association;
- surface capability declarations;
- scoped pairing/authentication;
- synchronization transport;
- reconnect/late join;
- surface revocation;
- shared-display semantics.

## 67.2 Parallax provides to Crossdeck

- shared scene identity;
- anchor identity/version;
- entity state updates;
- placement transition messages;
- scene capability needs;
- rendering/presentation payloads appropriate to the surface.

## 67.3 One Player, many surfaces

A phone paired to a desktop does not become a second Wayfarer identity or second Chronicle participant.

## 67.4 Crew shared AR

Crossdeck may coordinate multiple people's surfaces. Parallax owns the one shared spatial scene those surfaces render.

## 67.5 Crossdeck dependency rule

Parallax phases must not silently implement a broad temporary pairing architecture that later becomes impossible to migrate. If a phase needs a Crossdeck feature not yet governed, the project should define the required interface and coordinate governance before landing permanent architecture.

\newpage

# 68. Project Storytide Integration

Storytide is the narrative brain; Parallax is the spatial stage.

## 68.1 Storytide defines

- why the Spatial Moment happens;
- when it begins/ends;
- narrative copy;
- how discovery affects story flow;
- hint tone;
- which surface gets which narrative presentation;
- fallback story treatment.

## 68.2 Parallax defines

- spatial scene;
- anchor;
- placement;
- rendering;
- spatial interaction;
- discovery assistance mechanics;
- physical-digital state.

## 68.3 Example

Storytide:

> The Captain hid a letter in the room. Find it.

Parallax:

> Resolve `Peeking Letter v3` using `ADAPTIVE_PER_RUN`, crew-shared placement, moderate concealment, 90-second unguided limit.

One Voyage:

> Records discovery completion after canonical validation.

## 68.4 Narrative fallback

When Parallax falls back to Guided View, Storytide may adapt the prose so the experience feels intentional rather than apologetic.

\newpage

# 69. Project Figurehead Integration

Figurehead and Parallax must preserve independent identity and spatial ownership.

## 69.1 Figurehead payload

A spatial character instance may reference:

- Figurehead appearance version;
- pose;
- expression;
- outfit/history state;
- animation set.

## 69.2 Parallax payload

- anchor;
- scale;
- scene orientation;
- occlusion;
- collision/interaction volume;
- shared scene identity;
- spatial audio location;
- gaze target.

## 69.3 Performance tiers

Lower-capability devices may render simplified Figurehead representations while preserving identity.

## 69.4 Accessibility

Character-spatial cues must also be available through text/audio/other alternatives where essential.

\newpage

# 70. Project One Voyage Integration

One Voyage remains the only authoritative progression path.

## 70.1 Spatial interaction receipt

A receipt may contain:

```text
interactionId
spatialInstanceId
entityId
actorId
sessionId
chronicleVersionId
interactionType
observedAt
anchorVersion
sharedSceneId?
quality/confidence
provider provenance
idempotency key
```

## 70.2 Completion provider

Storytide/Drydock-governed completion logic evaluates receipts and proposes a canonical transition.

## 70.3 Idempotency

Network retries, device reconnect, repeated taps, or shared-scene synchronization must not duplicate completion.

## 70.4 Replay

Replaying a spatial reveal or revisiting a Memory is presentation-only unless a separately governed replay mechanic exists.

## 70.5 Captain override

Helm/Captain may use canonical commands to recover a broken Spatial Moment, but Parallax itself does not grant progression by hidden local switch.

\newpage

# 71. Project Wakebook Integration

Wakebook receives the human record of spatial experiences.

## 71.1 Memory handoff

Parallax supplies:

- clean composited image;
- Chronicle/version/session identity;
- Spatial Moment/Entity references;
- bounded presentation metadata;
- optional caption suggestion;
- consent/share class.

## 71.2 Archive independence

Wakebook must remain able to show the Memory after Parallax runtime versions/assets evolve.

## 71.3 Spatial replay metadata

Optional semantic metadata may support future interactive revisit, but historical truth remains the archived Memory and canonical Voyage record.

## 71.4 Privacy

Private room imagery remains private by default. Public sharing requires explicit Wakebook/Harborlight projection and consent rules.

\newpage

# 72. Project Drydock Integration

Drydock must be able to prove a spatial Chronicle before Players suffer through it.

## 72.1 Static validations

Examples:

- missing spatial definition version;
- invalid anchor policy;
- impossible sharing scope;
- mandatory hidden entity lacks Discovery Assistance;
- no fallback for required unsupported capability;
- `PERSONAL` placement with crew-shared completion;
- remote calibration enabled without privacy contract;
- unsafe placement constraints;
- spatial entity dependency missing;
- invalid asset scale/performance;
- mutable/unpinned library dependency.

## 72.2 Deterministic simulation

Drydock should execute Parallax provider simulations for:

- candidate surfaces;
- tracking loss;
- anchor resolution success/failure;
- shared late join;
- low-quality scene;
- unsupported depth;
- no Watchglass;
- permission denial;
- timeout/hint escalation;
- exact reveal;
- fallback.

## 72.3 Runtime fidelity

Drydock uses Parallax's actual canonical resolution/interaction contracts or approved deterministic adapters, not a simplified second engine.

## 72.4 Publish gate

A Creator cannot publish a general-audience Chronicle that requires a capability with no declared fallback and no constrained-audience declaration.

\newpage

# 73. Project Harborlight Integration

Harborlight may eventually make Parallax an ecosystem.

## 73.1 Shareable content

- Spatial Moments;
- Spatial Entities;
- placement recipes;
- interactions;
- effect packs;
- scene templates;
- AR prop packs;
- adaptive room Chronicles.

## 73.2 Public metadata

Listings should expose safe compatibility information such as:

- required Parallax version;
- required capability tier;
- optional Watchglass/Sextant needs;
- accessibility/fallback summary;
- target environment assumptions;
- asset sizes/performance tier.

## 73.3 No calibration evidence in public package

Creator field evidence, room reference imagery, environment signatures, and private site diagnostics must not be included in Community releases unless explicitly sanitized and intended.

## 73.4 Immutable release identity

Installed spatial content is version-pinned and lineage-aware.

\newpage

# 74. Project Sealed Hold Integration

Sealed Hold protects private spatial content and calibration evidence.

## 74.1 Protected content examples

- unpublished 3D artifacts;
- private room calibration imagery;
- site reference photos;
- private Chronicle spatial scenes;
- location-sensitive asset bundles;
- environment signatures if durably stored;
- private sound/image/media used by spatial moments.

## 74.2 Encryption and storage

Use existing protected asset/storage mechanisms rather than building an AR-specific secret folder and trusting `.gitignore` to defend the kingdom.

## 74.3 Export/import

Spatial definition dependencies must remain protected and integrity-verified through Chronicle package workflows.

## 74.4 Retention

Calibration evidence should have explicit bounded retention and deletion semantics independent of permanent Player Memories.

\newpage

# 75. Project Wayfarer, Helm, Lanternwake, and Homeport Integration

## 75.1 Wayfarer

Wayfarer provides canonical person identity and preferences relevant to:

- accessibility;
- privacy;
- device association through Crossdeck;
- Memory ownership;
- Creator library ownership.

Parallax does not create spatial-user accounts.

## 75.2 Helm
Captain tools may show:

- crew spatial readiness;
- which Players resolved the shared scene;
- recovery options;
- governed skip/confirm;
- re-anchor requests where authorized.

Helm remains Captain operation owner.

## 75.3 Lanternwake

Lanternwake governs broad UI motion and transition language. Parallax integrates for:

- entering Chronicle Lens;
- spatial reveal transitions;
- reduced-motion alternative;
- artifact handoff between normal UI and spatial scene.

## 75.4 Homeport / navigation

All Parallax human-facing authoring/library/settings routes must be discoverable through product navigation and route inventories. No “type `/studio/parallax/scene/17` manually because that's where the good editor lives.”

\newpage

# 76. Permissions, Privacy, and Data Minimization

Parallax touches some of the most intimate possible device data: camera view, physical rooms, spatial geometry, location context, and shared presence.

## 76.1 Purpose-bound permission requests

Ask for camera/spatial permissions when the Player or Creator understands the feature.

## 76.2 Avoid permission bundling

Do not request microphone, location, camera, nearby devices, and motion all together merely because Parallax might use one later.

## 76.3 Data classification

At minimum distinguish:

- raw camera frame;
- raw/depth frame;
- local scene mesh;
- local anchor map;
- visual feature/environment signature;
- geospatial anchor identity;
- shared anchor provider ID;
- semantic surface classification;
- derived spatial interaction receipt;
- calibration evidence;
- Player Memory image.

## 76.4 Local-first

Prefer on-device/local processing for:

- scene mapping;
- surface candidate ranking;
- anchor tracking;
- person screening;
- rendering;
- transient search coverage.

## 76.5 Server storage

Persist only what is needed for:

- shared scene identity;
- published definition;
- bounded calibration;
- authoritative interaction receipts;
- explicit Memory;
- diagnostics/audit.

## 76.6 No continuous room recording

Parallax is not an always-on room camera service.

\newpage

# 77. Security and Threat Model

Spatial systems create new attack surfaces.

## 77.1 Threat classes

- spoofed anchor resolution;
- replayed interaction receipt;
- fake shared-scene participant;
- stale anchor version overwrite;
- malicious community asset;
- malformed 3D asset denial-of-service;
- shader/material abuse;
- prompt injection through AI authoring inputs;
- malicious QR/deep link into spatial content;
- fake Watchglass evidence;
- fake Sextant provider/test provider in production;
- geospatial spoofing;
- unauthorized calibration evidence access;
- shared-anchor provider ID leakage;
- cross-Voyage anchor collision;
- memory capture exfiltration;
- path traversal/package abuse.

## 77.2 Scene identity binding

Shared scene/anchor IDs must bind to the correct:

- Voyage/session;
- Chronicle version;
- Spatial Moment version;
- sharing scope;
- authorized participant surfaces.

## 77.3 Receipt freshness and idempotency

Spatial completion receipts must include freshness/idempotency data sufficient for One Voyage to reject stale replay.

## 77.4 Test providers cannot certify production

D0/D1 synthetic providers are visibly classified. A mocked anchor success cannot accidentally become a production field certification.

## 77.5 Asset sandboxing

Imported models/materials/animations must be parsed/validated safely and must not execute arbitrary code.

## 77.6 Provider secrets

Cloud/shared-anchor API credentials belong in deployment secrets, not Creator definitions or browser-visible config unless the provider's public-client design explicitly requires a safe public identifier.

\newpage

# 78. Physical Safety and Environmental Safety

## 78.1 Outdoor attention

A Player walking outdoors should not need continuous camera fixation. Use short Lens moments, haptics, Landfall cues, and deliberate stop-and-look interactions.

## 78.2 Roads and hazards

Do not place mandatory spatial objectives:

- in roadways;
- on railroad tracks;
- across unsafe crossings;
- beyond barriers;
- near cliffs/drop-offs without explicit safety design;
- inside private/restricted spaces;
- on fragile/unsafe objects.

## 78.3 Spinning/physical gestures

A “spin three times” interaction must have an alternative. Do not require rapid rotation near hazards or for Players with vestibular/mobility limitations.

## 78.4 Magnets and hardware

Parallax/Sextant Creator guidance must discourage strong magnets near sensitive device hardware.

## 78.5 Social/privacy environment

Do not encourage scanning strangers or sensitive private areas to resolve ordinary spatial content.

## 78.6 Safe adaptive placement

Adaptive staging should avoid:

- stairs;
- active door swings;
- walk paths;
- high unreachable shelves;
- hot surfaces;
- water/edge hazards;
- fragile clutter where identified.

When safety confidence is insufficient, choose a safer fallback.

\newpage

# 79. Accessibility and Inclusive Spatial Design

Parallax accessibility is foundational, not a final “add text alternative” pass.

## 79.1 Mobility

Mandatory progress must support Players who:

- are seated;
- cannot walk around an object;
- cannot crouch/reach high/low;
- cannot rotate rapidly;
- have limited one-handed dexterity.

## 79.2 Visual

Provide:

- text descriptions;
- high-contrast outlines;
- scalable labels;
- screen-reader spatial summaries;
- non-color-only cues;
- direct reveal path;
- alternative 2D view.

## 79.3 Hearing

Spatial audio clues require visual/text/haptic equivalents.

## 79.4 Haptics

Haptic clues require visual/text equivalents.

## 79.5 Motion sensitivity

Reduced-motion mode must provide stable alternatives to:

- portals;
- fast camera effects;
- spinning objects;
- dramatic parallax;
- screen-space shake;
- sudden depth transitions.

## 79.6 Cognitive accessibility

Tracking guidance should be simple and task-oriented. Avoid simultaneous technical warnings, story copy, and interaction instructions fighting for attention.

## 79.7 Accessible authoring validation

Drydock should flag mandatory interactions lacking declared equivalents.

\newpage

# 80. Offline, Weak Network, and Reconciliation

## 80.1 Local AR can continue where safe

A locally resolved scene may continue rendering through temporary network loss.

## 80.2 Shared scene behavior

If synchronization disappears:

- preserve last authoritative shared scene locally;
- mark shared updates pending;
- prevent unsafe conflicting authoritative actions where necessary;
- reconcile when network returns.

## 80.3 Cloud anchor dependency

A provider requiring network cannot resolve new anchors offline. The authored fallback must be used.

## 80.4 Interaction evidence

Offline interaction receipts may queue locally with idempotency/freshness metadata and reconcile through One Voyage when allowed.

## 80.5 Published assets

Required spatial assets should be cacheable/offline according to Sealed Hold/Chronicle package policy where the experience declares offline support.

## 80.6 Never invent server confirmation

The Lens may show:

> “Found locally - syncing…”

when appropriate, but must not claim canonical completion until One Voyage has accepted it if server confirmation is required.

\newpage

# 81. Performance, Battery, Thermal, and Quality Scaling

Spatial computing can melt batteries with impressive efficiency.

## 81.1 Quality profiles

Define semantic quality levels such as:

- PERFORMANCE;
- BALANCED;
- CINEMATIC;
- AUTO.

## 81.2 Dynamic scaling

Based on Sextant/device/runtime context, Parallax may reduce:

- particles;
- shadow resolution;
- mesh detail;
- post-processing;
- reflection quality;
- animation density;
- scene reconstruction usage;
- vision assist frequency;
- background update rate.

## 81.3 Never scale away correctness

Quality scaling must not silently disable the only collision/occlusion logic needed to make a mandatory interaction valid.

## 81.4 Scene budgets

Spatial Studio/Drydock should estimate:

- entity count;
- triangles;
- texture memory;
- draw calls/material complexity;
- active lights/shadows;
- particle count;
- audio sources;
- tracking/provider costs.

## 81.5 Desktop + game coexistence

For companion virtual Chronicles, phone-based Parallax is preferable to consuming the game's desktop GPU for unnecessary AR work. Any desktop spatial preview/runtime must consider game impact.

## 81.6 Thermal recovery

When the device is thermally constrained, the Lens should degrade gracefully or offer a stable 2D mode rather than crashing or cooking the Player's battery into a commemorative tile.

\newpage

# 82. Telemetry, Diagnostics, and Operations

Parallax needs operational truth without collecting private rooms.

## 82.1 Safe telemetry examples

- spatial runtime version;
- provider class;
- tracking state transitions;
- anchor resolution success/failure class;
- relocalization count;
- fallback class;
- scene performance timings;
- memory pressure;
- device capability tier;
- hint-stage aggregate use;
- exact-reveal aggregate rate;
- crash/error code.

## 82.2 Do not log

- raw camera frames;
- room meshes;
- precise private geometry;
- raw visual feature maps;
- unrestricted location trails;
- secret anchor provider credentials.

## 82.3 Creator quality diagnostics

Creator Studio may show aggregated field quality with privacy-safe counts and classifications.

## 82.4 Bridgewatch future integration

Bridgewatch may later display Parallax runtime health and field quality through a read-only safe projection. It must not require raw private scene data.

## 82.5 Sentry/Grafana future operations

Errors/performance may integrate with platform observability while respecting privacy classification and sampling.

\newpage

# 83. Data Model and Service Contracts

Final schema belongs to implementation design, but this governing document freezes semantic entities.

Representative durable concepts:

```text
SpatialDefinition
SpatialDefinitionVersion
SpatialAttachment
SpatialAssetDependency
SpatialEntityDefinition
SpatialBehaviorDefinition
SpatialPlacementPolicy
SpatialAnchorIntent
SpatialInstance
SpatialResolutionReceipt
SharedSpatialScene
SharedSpatialAnchor
SpatialInteractionReceipt
DiscoveryAssistancePolicy
SpatialCalibrationRecord
CalibrationEvidenceReference
SpatialFieldQualitySummary
SpatialMemoryCaptureReference
```

## 83.1 Avoid raw blobs as canonical model

Versioned payload fields may exist for extensibility, but stable identities, ownership, versioning, sharing, privacy, and lifecycle should remain queryable/typed.

## 83.2 Public/private projections

Creator-private calibration data must never leak through public Chronicle/Harborlight projections.

## 83.3 Historical stability

A published Chronicle version must be able to interpret its pinned spatial definitions even after current Creator drafts advance.

## 83.4 Migration policy

Schema evolution requires:

- versioned readers/upcasters;
- historical fixtures;
- Drydock compatibility proof;
- no silent mutation of published definitions.

\newpage

# 84. Event, Receipt, and Evidence Vocabulary

Canonical candidate event/receipt vocabulary includes:

```text
SPATIAL_SCENE_REQUESTED
SPATIAL_SCENE_INITIALIZING
SPATIAL_SCENE_READY
SPATIAL_SCENE_DEGRADED
SPATIAL_SCENE_FAILED
SPATIAL_ANCHOR_CANDIDATE_FOUND
SPATIAL_ANCHOR_RESOLVED
SPATIAL_ANCHOR_SHARED
SPATIAL_ANCHOR_RELOCALIZED
SPATIAL_ANCHOR_REANCHORED
SPATIAL_ENTITY_REVEALED
SPATIAL_ENTITY_DISCOVERED
SPATIAL_ENTITY_PICKED_UP
SPATIAL_ENTITY_PLACED
SPATIAL_ENTITY_PINNED
SPATIAL_ENTITY_INSPECTED
SPATIAL_INTERACTION_COMPLETED
DISCOVERY_HINT_ESCALATED
DISCOVERY_EXACT_REVEAL_USED
CALIBRATION_EVIDENCE_OFFERED
CALIBRATION_EVIDENCE_CAPTURE_REJECTED_PRIVACY
CALIBRATION_EVIDENCE_APPROVED
CALIBRATION_REVIEW_APPLIED
SPATIAL_MEMORY_CAPTURED
```

Each must define:

- owner;
- authoritative versus observational status;
- privacy class;
- idempotency;
- replay semantics;
- retention;
- allowed consumers.

Events used only for presentation must not be mistaken for progression events.

\newpage

# 85. Creator Publishing and Compatibility Contracts

## 85.1 Publish declaration

Every Spatial Moment should materialize compatibility metadata:

- preferred capability tier;
- minimum capability tier;
- fallback;
- native required?;
- Internet required?;
- shared anchor provider required?;
- Watchglass required/preferred?;
- Landfall context required?;
- accessibility alternatives;
- target environment assumptions;
- expected room/site scale;
- performance class.

## 85.2 Audience constraints

A Creator may intentionally publish a specialized experience requiring specific hardware, but that constraint must be visible before installation/play and validated by Drydock.

## 85.3 General Chronicle baseline

General-audience Chronicles should preserve a non-premium-device completion path.

## 85.4 Historical compatibility

If a provider is deprecated, older Chronicles should either:

- migrate through an approved compatibility layer;
- use fallback;
- clearly report unsupported historical behavior.

Do not silently reinterpret an old anchor definition through materially different semantics.

\newpage

# 86. Device Lab Integration

Parallax is one of the heaviest future users of the shared Voyagewright Device Lab.

## 86.1 Device Lab remains Sounding Line-owned

Parallax registers scenarios; Sounding Line governs execution/evidence/release authority.

## 86.2 Parallax scenario families

- local plane placement;
- depth placement;
- occlusion;
- tracking initialization;
- low light;
- excessive motion;
- feature-poor wall;
- interruption;
- background/foreground;
- camera permission denial;
- AR unsupported;
- anchor relocalization;
- adaptive room placement;
- no valid semantic surface;
- deterministic placement seed;
- shared two-device anchor;
- cross-platform shared anchor;
- late join;
- stale anchor version;
- device disconnect/reconnect;
- low battery/thermal degradation;
- performance-tier downgrade;
- person enters calibration frame;
- privacy frame rejection;
- calibration decline;
- discovery timeout/hint escalation;
- exact reveal;
- Memory capture;
- reduced motion;
- seated accessibility;
- Watchglass abstention;
- Landfall region handoff.

## 86.3 Tier requirements

### D0 deterministic simulation

Spatial resolver, anchor policies, sharing state, hints, fallbacks, seeded staging.

### D1 API/browser emulation

Web permissions/camera/orientation/WebXR behavior where available.

### D2 Android Emulator

Lifecycle/device conditions and supported spatial integration plumbing.

### D3 iOS Simulator/macOS

UI/lifecycle/native integration where simulator supports it; not full AR hardware proof.

### D4 controlled real hardware

Real ARKit/ARCore world tracking, depth, camera, thermal, shared anchor behavior.

### D5 field qualification

Actual room/outdoor/shared-player experiences and Creator workflows.

## 86.4 Evidence labels

No D0/D1 simulation result may be relabeled as “real shared AR tested.”

\newpage

# 87. Testing and Acceptance Matrix

Parallax requires layered verification across domain, UI, runtime, real devices, and human experience.

## 87.1 Unit/domain

Must cover:

- definition parsing/versioning;
- placement policy;
- semantic scoring;
- deterministic seed;
- shared scene state machine;
- anchor versioning;
- discovery assistance timer;
- privacy rules;
- capability/fallback selection;
- interaction receipts;
- update/fork semantics.

## 87.2 Property/adversarial tests

- same input/seed -> same candidate decision;
- random candidate order does not change deterministic result;
- unsafe surfaces never selected;
- shared scope never produces per-device independent resolution;
- stale anchor version cannot overwrite current;
- mandatory objective always reaches a terminal recovery path;
- private calibration data cannot enter public projection;
- unsupported capability broadens to fallback rather than false success.

## 87.3 Component/UI

Spatial Studio:

- library browsing;
- drag/drop;
- scene graph;
- inspectors;
- mode switching;
- AI materialization review;
- undo/redo;
- validation deep links;
- responsive behavior.

Chronicle Lens:

- permissions;
- initialization;
- tracking guidance;
- search assistance;
- fallback;
- Memory capture;
- accessibility.

## 87.4 Browser/native integration

- published definition loads correctly;
- exact version pinned;
- interaction receipt reaches canonical completion path;
- replay does not mutate progression;
- offline queues reconcile idempotently;
- Crossdeck shared scene handoff where available.

## 87.5 Device Lab

D4/D5 must qualify representative:

- current iPhone class;
- current Android class;
- mid-tier hardware;
- depth-capable and non-depth devices;
- different lighting/room scales;
- two/three-device shared crew;
- thermal/battery conditions.

## 87.6 Visual quality

Owner review must judge:

- stability;
- realism;
- material response;
- occlusion;
- scale;
- transition quality;
- hint subtlety;
- Spatial Studio feel;
- Chronicle Lens feel;
- cross-platform continuity.

## 87.7 Privacy/security

Independent review must prove:

- person-free automatic calibration upload;
- no private room data in logs/public packages;
- shared anchor authorization;
- replay/idempotency;
- asset safety;
- scoped provider credentials;
- AI prompt-injection boundaries.

## 87.8 Accessibility

Real walkthroughs with:

- reduced motion;
- sound off;
- haptics off;
- high contrast;
- screen reader/voice description where practical;
- seated mode;
- direct discovery assistance;
- one-handed interaction.

\newpage

# 88. Implementation Phases

Project Parallax is a six-phase program. Each phase must be independently acceptable into protected `main` and must leave a coherent product plateau if the next phase never occurs.

## Phase 1 - **Establish the Frame**
### Spatial Domain, Runtime Foundation, Chronicle Lens Core, Fixed Anchors, and Local Placement

Build:

- canonical SpatialDefinition/Version/Attachment/Instance model;
- entity/anchor/coordinate-space contracts;
- capability negotiation seams with Sextant/Landfall;
- local native spatial runtime abstraction;
- Chronicle Lens core shell;
- basic world tracking/plane placement on supported native platforms;
- fixed/local/surface-relative anchors;
- local pick/inspect placement primitives;
- typed interaction receipts;
- One Voyage nonauthoritative evidence seam;
- baseline Guided fallback;
- Drydock schemas/provider simulation;
- Device Lab D0 foundations;
- initial privacy/security/accessibility contracts.

**Mainline gate:** a published synthetic Chronicle can invoke a version-pinned Spatial Moment, resolve a local/fixed anchor on supported runtime or truthful fallback, interact, and produce a typed nonauthoritative receipt without creating competing progression truth.

## Phase 2 - **Open the Spatial Studio**
### Full Spatial Authoring Workspace, Spatial Library, Progressive Disclosure, AI-Assisted Authoring, and Chronicle Integration

Build:

- Parallax Spatial Studio;
- spatial canvas;
- scene graph;
- behavior timeline;
- Guided/Detailed/Engineering modes;
- My Spatial Library and Chronicle-only items;
- immutable library versions;
- presets;
- drag/drop/direct manipulation;
- simulation environments;
- preview modes;
- AI intent interpretation;
- AI critique;
- deterministic materialization and undo/redo;
- Vision Waypoint sibling-library references;
- lightweight Chronicle Spatial Moment attachment/block;
- Drydock deep links and validation UI;
- asset validation/scale/performance previews.

**Mainline gate:** an ordinary Creator can build, preview, validate, save to library, version, attach, publish, and reopen a useful spatial experience without using engineering controls or stuffing configuration into the Chronicle block sidebar.

## Phase 3 - **Let the World Adapt**
### Semantic Anchors, Adaptive Spatial Staging, Remote Authoring, Field Calibration, and Discovery Assistance

Build:

- `ADAPTIVE_STICKY`, `ADAPTIVE_PER_CREW`, `ADAPTIVE_PER_RUN`, `ADAPTIVE_VARIANT`, `CALIBRATED`;
- semantic candidate ranking;
- multi-entity staging;
- deterministic seeds/resolution receipts;
- remote natural-language placement;
- first field observation;
- privacy-safe person-free evidence pipeline;
- Creator remote review/adjustment;
- anchor maturity/quality;
- Discovery Assistance Contract;
- meaningful search time;
- smart hint escalation;
- low-confidence anchor recovery;
- field quality aggregates;
- portable room Chronicle simulation.

**Mainline gate:** a Creator who has never visited a target environment can publish an adaptive spatial experience that successfully stages in multiple real/simulated environments, remains replay-variable by policy, cannot strand a Player indefinitely, and can optionally be improved through consented person-free field calibration.

## Phase 4 - **Share the Reality**
### Crew-Shared Spatial Scenes, Crossdeck Integration, Persistent/Shared Anchors, Late Join, Reconnect, and Cross-Platform Resolution

Prerequisite: sufficient Crossdeck governance/implementation exists for required multi-surface/participant semantics.

Build:

- `SharedSpatialScene` runtime;
- authoritative shared anchor identity/versioning;
- crew synchronization;
- two/three-device scene resolution;
- late join;
- reconnect;
- relocalization;
- stale-version rejection;
- re-anchor authorization;
- cross-platform shared-anchor provider abstraction;
- optional cloud/persistent anchor integration;
- shared interaction conflict handling;
- personal versus shared discovery/interaction state;
- Device Lab D4 shared-device qualification.

**Mainline gate:** multiple Players in one Voyage can independently point their devices at the same environment and see the same logical object in the same authoritative place, including late join and recovery, without per-device reroll.

## Phase 5 - **Make the World Respond**
### Physical-Digital Artifacts, Rich Spatial Effects, Figurehead/Watchglass Integration, Spatial Memories, and High-Fidelity Presentation

Build:

- pick up/carry/place/pin/inspect lifecycle;
- canonical desk-map experience;
- trails;
- hidden writing;
- reveal layers;
- portals;
- apparitions;
- spatial audio;
- advanced haptic choreography through Sextant;
- depth/occlusion/physics quality tiers;
- Watchglass visual relocalization/object/scene assistance;
- Figurehead spatial character presence where Figurehead is ready;
- clean AR Memory capture;
- Wakebook handoff;
- cross-surface artifact handoff with Crossdeck;
- Lanternwake transitions/reduced motion integration;
- richer materials/effects/performance scaling.

**Mainline gate:** Parallax can deliver the flagship physical-digital artifact and real/virtual blended experiences - including the desk-map reference scenario - with truthful fallback, archive capture, and no ownership duplication.

## Phase 6 - **Prove the Illusion**
### Privacy, Security, Accessibility, Performance, Device Lab, Field Qualification, Operations, and Program Closure

Complete:

- full threat model closure;
- calibration privacy verification;
- security review;
- accessibility matrix;
- reduced-motion alternatives;
- performance/thermal/battery budgets;
- iOS/Android real-device matrix;
- shared crew field testing;
- outdoor field testing;
- remote Creator authoring pilots;
- adaptive-room pilots;
- virtual Chronicle companion pilot;
- provider outage/fallback qualification;
- historical compatibility;
- Harborlight/Sealed Hold readiness where applicable;
- monitoring/diagnostics;
- documentation/runbooks;
- final owner walkthrough.

**Program gate:** Parallax may close only when the flagship experiences work on real representative hardware and real shared environments, Creator authoring is genuinely usable, mandatory fallbacks are proven, privacy/security/accessibility gates pass, and owner acceptance confirms the spatial experience feels magical rather than merely technically present.

\newpage

# 89. Final Acceptance Criteria

Project Parallax is complete only when all applicable requirements below are satisfied.

## Architecture

- one canonical spatial domain exists;
- no competing anchor/scene truth exists in Landfall, Watchglass, Storytide, or Crossdeck;
- Sextant owns generic device hardware context;
- One Voyage owns progression;
- published spatial definitions are immutable/version-pinned;
- shared scenes have one authoritative anchor identity.

## Creator experience

- Spatial Studio is a first-class discoverable Creator surface;
- Spatial Library is a distinct reusable library;
- Vision Waypoint Library remains a sibling, not merged;
- Guided mode can author useful experiences without transform/API knowledge;
- Detailed and Engineering expose deeper control without separate runtime models;
- AI authoring produces visible deterministic configuration;
- AI changes are reversible;
- simulation can test multiple environments;
- ordinary Chronicle blocks remain lightweight.

## Adaptive/remote authoring

- adaptive placement is a valid permanent behavior;
- per-run/per-crew variation works and freezes within scope;
- deterministic resolution receipts exist;
- remote semantic authoring does not require Creator travel;
- field calibration is optional;
- automatic calibration frames containing people/faces are discarded before upload;
- Creator can review/refine safe field evidence;
- bad anchors surface quality warnings.

## Shared reality

- same crew/run sees the same shared anchor;
- late join inherits existing anchor;
- tracking loss relocalizes instead of rerolling;
- stale devices cannot overwrite newer anchor versions;
- shared/personal discovery semantics are explicit;
- cross-platform shared provider failure has a fallback.

## Player experience

- Chronicle Lens is coherent, beautiful, and understandable;
- tracking guidance is human-facing;
- mandatory hidden content cannot trap Players;
- exact recovery exists;
- fallback preserves story language;
- physical-digital artifacts retain identity while moving between spaces;
- desk-map scenario works on representative hardware;
- clean AR Memory capture works and archives through Wakebook.

## Privacy/security

- raw camera/mesh/room data is minimized;
- calibration evidence is purpose-bound/retention-bound;
- public packages cannot leak private spatial evidence;
- shared-anchor IDs are scoped;
- interaction receipts are fresh/idempotent;
- test providers cannot masquerade as production;
- community assets cannot execute arbitrary code;
- provider credentials are protected.

## Accessibility/safety

- seated/reduced-mobility alternatives exist for mandatory interactions;
- reduced motion is complete;
- sound/haptics have alternatives;
- direct discovery assistance is available;
- dangerous outdoor placement is prevented/flagged;
- camera-dependent mandatory content has fallback where required by audience policy.

## Verification

- Drydock can validate spatial definitions and fallback coverage;
- Device Lab D0-D5 classifications are honest;
- representative iOS/Android real devices pass;
- two/three-device shared crew passes;
- field pilots pass;
- production build/runtime passes;
- Sounding Line issues the protected-main decisions;
- owner walkthrough accepts the actual running experience.

\newpage

# 90. Recommended Technical Baseline

This section is deliberately implementation-guiding, not a permanent API promise. Platform capability must be reverified at each implementation phase.

## 90.1 iOS

Current Apple platform capabilities support the architectural direction through ARKit/RealityKit concepts including world tracking, plane detection, anchors, raycasting, scene depth/reconstruction on supported hardware, scene understanding, occlusion, physics, image/object tracking, and world anchors.

Recommended approach:

- native Swift/SwiftUI shell where appropriate;
- RealityKit for modern rendering/spatial scene integration;
- ARKit/SpatialTrackingSession APIs as current platform dictates;
- canonical Parallax adapter around native types;
- Sextant for generic device context/haptics/lifecycle seams;
- Device Lab real-hardware qualification.

## 90.2 Android

Current ARCore capabilities support local anchors, planes, Depth API, hit tests, Cloud Anchors, Geospatial anchors, image tracking, and cross-platform shared-anchor patterns.

Recommended approach:

- native Kotlin/approved rendering stack;
- ARCore semantic adapter;
- Depth enabled only after support check;
- provider-neutral shared-anchor abstraction;
- Sextant for generic sensor/device context;
- real hardware qualification.

## 90.3 Shared/cross-platform

ARCore Cloud Anchors or future approved provider can be one implementation for shared persistent room-scale anchors. Parallax must retain provider neutrality because quotas, terms, privacy, and platform support evolve.

## 90.4 Web

Use WebGL/WebXR where supported, but treat immersive AR/DOM overlay/anchors as capability-limited and fragmented. Provide excellent Guided View and camera-assisted fallback instead of promising native parity.

## 90.5 3D/assets

Prefer portable scene/model formats and controlled runtime conversion. Validate scale/performance/provenance. Avoid arbitrary executable content.

## 90.6 AI authoring

Use current approved platform AI services behind a deterministic materialization contract. AI must not be required for runtime replay of an already-published spatial definition.

## 90.7 Persistence

Use canonical database/service architecture for definitions, versions, attachments, scene identities, and receipts. Private binary/media/calibration assets use Sealed Hold-compatible protected storage.

\newpage

# 91. Governance and Change Control

Parallax will evolve as spatial platforms evolve. Governance must prevent implementation drift while allowing provider change.

## 91.1 Stable semantic contract, replaceable providers

ARKit/ARCore/WebXR API details may change. The Parallax domain should remain stable where product meaning has not changed.

## 91.2 Changes requiring governing amendment

Examples:
- redefining Parallax ownership boundaries;
- making AI runtime inference authoritative;
- adding persistent public world-scale AR content;
- changing automatic calibration privacy rules;
- allowing arbitrary community executable spatial code;
- weakening shared spatial reality invariant;
- removing mandatory discovery assistance;
- changing One Voyage progression boundary;
- changing Device Lab ownership;
- introducing biometric/person recognition as a Chronicle feature.

## 91.3 Changes not necessarily requiring governing amendment

Examples:

- adding a new native provider that satisfies existing semantics;
- new material/effect preset;
- new safe Spatial Library category;
- performance optimizations;
- additional Device Lab scenarios;
- new first-party simulation environment;
- UI refinement that preserves governing behavior.

## 91.4 Phase-level mainline integration

Each Parallax phase lands independently through the normal Voyagewright development and Sounding Line acceptance path.

No phase may leave `main` dependent on the next phase.

## 91.5 Owner acceptance

Because Parallax's success is experiential, automated acceptance is not the final product gate. Major phases require owner walkthrough on actual representative devices before product acceptance language is used.

\newpage

# Appendix A. Spatial Entity Schema

A representative semantic schema:

```text
SpatialDefinition
  id
  ownerPersonId
  title
  description
  draftState
  currentDraftVersion
  libraryScope
  tags[]

SpatialDefinitionVersion
  id
  definitionId
  semanticVersion
  schemaVersion
  checksum
  entityGraph
  behaviorGraph
  capabilityRequirements
  fallbackPolicy
  accessibilityContract
  privacyClass
  createdAt
  publishedAt?

SpatialEntityDefinition
  id
  versionId
  name
  kind
  assetBindings[]
  parentEntityId?
  coordinateSpace
  anchorIntent
  transformDefaults
  renderingProfile
  interactionProfile
  visibilityProfile
  discoveryProfile
  sharingScope

SpatialAttachment
  chronicleDraftOrVersionId
  storyMomentId
  spatialDefinitionVersionId
  boundedOverrides

SpatialInstance
  voyageId
  chronicleVersionId
  spatialAttachmentId
  runId
  sharingScope
  state

SpatialResolutionReceipt
  instanceId
  placementPolicy
  seed
  anchorClass
  anchorVersion
  confidenceBand
  fallbackUsed
  privacySafeDiagnostics
```

The implementation may use different names, but these semantic distinctions must survive.

\newpage

# Appendix B. Anchor and Placement Policy Catalog

## Anchor families

- `LOCAL_WORLD`
- `SURFACE_RELATIVE`
- `FIXED_WORLDSPACE`
- `VISUAL_REFERENCE`
- `CALIBRATED_SITE`
- `ADAPTIVE_SEMANTIC`
- `SHARED_SESSION`
- `PERSISTENT_SHARED`
- `GEOSPATIAL`
- `DEVICE_RELATIVE`

## Placement policies

- `FIXED`
- `CALIBRATED`
- `ADAPTIVE_STICKY`
- `ADAPTIVE_PER_CREW`
- `ADAPTIVE_PER_RUN`
- `ADAPTIVE_VARIANT`
- `PERSONAL`

## Required policy questions

For every policy:

- when does it resolve?;
- for whom is it shared?;
- how long is it stable?;
- what evidence is required?;
- may it re-anchor?;
- what is fallback?;
- what is recorded?;
- what is private?;
- what can Drydock simulate?;
- what real-device evidence is required?

\newpage

# Appendix C. Spatial Moment Catalog

Representative first-party Spatial Moment families:

1. Placed Object
2. Peeking Object
3. Hidden Writing
4. Footprint/Trace Trail
5. Ground Guidance
6. Reveal Layer
7. Portal / Spatial Window
8. Directional Apparition
9. Floating Marker
10. Spatial Audio Source
11. Shared Object
12. Viewpoint Alignment Puzzle
13. Surface Interaction Puzzle
14. Physical-Digital Artifact
15. Desk Map
16. Buried/Hidden Artifact
17. Room-Scale Scavenger Hunt
18. Historical Overlay
19. Figurehead Presence
20. Shared Crew Table/Scene

Each family must define default accessibility/fallback and whether it is safe for mandatory progression.

\newpage

# Appendix D. Spatial Library Taxonomy

## Top-level creator views

- My Spatial Experiences
- Chronicle Spatial Items
- Installed / Community (future)
- Favorites
- Recent
- Collections

## Item classes

- Spatial Moments
- Entities
- Placement Recipes
- Interactions
- Effects
- Discovery Profiles
- Scene Templates
- Materials
- Environment Templates

## Metadata

- owner;
- version;
- compatibility;
- required capability;
- fallback quality;
- accessibility coverage;
- usage count;
- update status;
- license/lineage where applicable;
- performance class;
- preview.

\newpage

# Appendix E. Discovery Assistance Profiles

## Gentle Mystery

1. natural search;
2. story nudge;
3. context clue;
4. broad region highlight;
5. object shimmer;
6. exact reveal.

## Compass Pull

1. faint directional response;
2. stronger response;
3. haptic cadence;
4. target sector;
5. compass lock;
6. exact reveal.

## Whisper

1. subtle spatial audio;
2. louder/clearer source;
3. environment visual reaction;
4. directional cue;
5. apparition outline;
6. exact reveal.

## Accessible Direct

- optional immediate text direction;
- high-contrast pointer;
- direct target region;
- exact reveal always available;
- no forced physical scanning.

## Outdoor Safe

- brief Lens checks;
- strong non-camera navigation;
- haptic/text cue;
- stop-to-view prompt;
- no continuous screen following.

\newpage

# Appendix F. Shared Spatial Reality Invariants

1. Shared placement resolves once per configured scope.
2. All participants reference one shared scene identity.
3. Local renderer quality may differ; logical anchor may not.
4. Late join resolves existing anchor.
5. Reconnect reconciles anchor version.
6. Tracking loss does not reroll placement.
7. Re-anchor is explicit and audited.
8. Stale device cannot overwrite newer anchor.
9. Shared placement and personal discovery state are independent dimensions.
10. Shared-anchor provider failure must follow governed fallback.
11. Personal accessibility effects may differ without changing shared object location.
12. One Voyage progression remains canonical.

\newpage

# Appendix G. Creator Studio / Spatial Studio UX Requirements

Spatial Studio final UX must satisfy:

- visible Creator navigation entry;
- full-size spatial canvas;
- Spatial Library panel;
- direct manipulation;
- scene graph;
- behavior timeline;
- inspector with progressive disclosure;
- Guided/Detailed/Engineering modes;
- semantic placement language;
- version history;
- simulation environments;
- phone/Lens/shared/fallback/accessibility previews;
- AI intent command surface;
- AI critique panel integrated into issues, not a chat-only silo;
- Drydock issue navigation;
- undo/redo for AI/manual edits;
- autosave/draft safety;
- keyboard operation where possible;
- accessible alternative to precision mouse manipulation;
- responsive design;
- meaningful empty/loading/error states;
- product-quality visuals that feel modern/spatial while remaining Voyagewright.

Ordinary Chronicle inspector must remain lightweight and provide `Edit in Parallax`.

\newpage

# Appendix H. Device Lab Scenario Catalog

High-value scenarios:

1. local floor anchor success;
2. local wall anchor success;
3. low-light tracking degradation;
4. blank wall feature-poor degradation;
5. excessive motion;
6. camera permission denial;
7. native AR unsupported;
8. Depth unavailable;
9. depth/occlusion success;
10. anchor relocalization;
11. room furniture moves between sessions;
12. adaptive map floor placement;
13. adaptive per-run seed change;
14. adaptive sticky reuse;
15. no valid safe surface;
16. multi-entity scene constraint conflict;
17. remote semantic placement first field run;
18. person enters calibration frame;
19. face poster/reflection privacy edge case;
20. calibration decline;
21. Creator calibration adjustment;
22. discovery Stage 0→5 escalation;
23. low-confidence system-blame fallback;
24. two-device shared anchor;
25. iOS + Android shared anchor;
26. late third device join;
27. tracking loss on one crew device;
28. stale anchor version conflict;
29. authorized re-anchor;
30. phone disconnect/reconnect through Crossdeck;
31. world artifact → handheld → desk placement;
32. map physical zoom;
33. Memory capture;
34. reduced motion;
35. seated mode;
36. screen-reader direct alternative;
37. Watchglass `UNCERTAIN`;
38. Watchglass `NOT_CONFIGURED`;
39. Landfall region activation;
40. virtual Worldspace desk map;
41. weak network shared scene;
42. offline queued interaction;
43. thermal quality downgrade;
44. low battery;
45. oversized scene performance rejection;
46. malicious asset rejection;
47. interaction receipt replay rejection;
48. shared scene cross-Voyage ID rejection;
49. provider quota/rate limit fallback;
50. historical definition compatibility.

\newpage

# Appendix I. Threat and Privacy Checklist

- [ ] camera permission is contextual;
- [ ] calibration upload is opt-in;
- [ ] automatic calibration rejects people/faces before upload;
- [ ] raw room mesh is not durably stored by default;
- [ ] raw search coverage is ephemeral;
- [ ] shared anchor IDs are Voyage/session scoped;
- [ ] provider credentials are protected;
- [ ] stale interaction receipts are rejected;
- [ ] shared anchor version conflicts are handled;
- [ ] test providers cannot appear production-certified;
- [ ] AI authoring treats external content as data;
- [ ] community assets contain no arbitrary executable code;
- [ ] public packages exclude calibration evidence;
- [ ] private Chronicle spatial assets use protected storage;
- [ ] location/Worldspace data uses Landfall privacy rules;
- [ ] Watchglass evidence obeys Watchglass retention;
- [ ] Memories are private by default;
- [ ] calibration retention/deletion is explicit;
- [ ] logs exclude raw frames/meshes/private geometry;
- [ ] outdoor objectives pass safety checks;
- [ ] physical gesture alternatives exist;
- [ ] strong-magnet misuse is not encouraged;
- [ ] provider outage cannot trap mandatory progress.

\newpage

# Appendix J. Accessibility Checklist

- [ ] mandatory spatial moment has non-AR or guided alternative where required;
- [ ] reduced motion is implemented;
- [ ] sound-independent completion path exists;
- [ ] haptic-independent completion path exists;
- [ ] color-independent cues exist;
- [ ] direct discovery mode exists;
- [ ] seated/reduced-mobility mode exists;
- [ ] no mandatory rapid spin;
- [ ] no mandatory crouch/reach beyond accessible range without alternative;
- [ ] screen-reader summary exists for essential scene state;
- [ ] focus/keyboard access exists for Studio controls;
- [ ] precision drag has numeric/semantic alternative;
- [ ] timeout does not punish slower interaction;
- [ ] accessibility fallback preserves story rather than skipping explanation;
- [ ] shared crew can include Players using different accessibility presentations without splitting scene truth.

\newpage

# Appendix K. Canonical Scenario Narratives

## K1. Adaptive bedroom map

Creator authors:

> Place a pirate map somewhere believable on the floor near furniture.

Parallax stages it for the room, shares one placement with the crew, freezes it for the run, lets the Player pick it up, place it on a desk, inspect it, and save a Memory. Another run may use another valid place.

## K2. Remote museum clue

Creator has never visited. They author a folded parchment on a stone wall near the entrance. First Player receives a semantic placement. If the Player opts in, person-free field evidence lets Creator refine the placement later.

## K3. Shared crew chest

Three Players see one chest at one anchor. A fourth joins late and resolves that anchor. One phone loses tracking and later relocalizes without moving the chest for anyone else.

## K4. Sea of Thieves desk chart

Desktop Storytide/game context pairs with phone through Crossdeck. Player finds a virtual chart in the real room, carries it, places it beside the keyboard, physically leans over it, selects an island, and desktop Journal reacts. Landfall supplies virtual Worldspace meaning. Parallax supplies real-room spatial truth.

## K5. Portable haunted room

Creator requires one floor, one table-like surface, one doorway, one wall. Parallax stages map, journal, ghost, and writing across any compatible room. Different groups receive different staging. Same group shares one reality.

## K6. Ghost footprints outdoors

Landfall brings Player to a safe trail region. Chronicle Lens briefly reveals footprints across the ground. Player follows them using Landfall-safe navigation and periodic Lens checks rather than staring continuously at the camera.

## K7. Figurehead sailor on bench

Watchglass/Landfall establish the intended bench/site. Parallax anchors Figurehead character. Character looks toward a real landmark. Player follows gaze to hidden writing. Figurehead owns appearance; Parallax owns spatial presence.

## K8. Calibration failure recovery

A remote clue resolves poorly. Anchor confidence remains low and Player search time exceeds threshold. System re-evaluates rather than blaming Player, offers Guided View, logs privacy-safe quality, and later recommends Creator review.

\newpage

# Appendix L. Cross-Project Ownership Matrix

## Parallax owns

- Spatial Entity identity/version/instance;
- spatial scene runtime;
- anchors and anchor versions;
- adaptive semantic placement;
- adaptive multi-object staging;
- shared spatial reality;
- Chronicle Lens spatial rendering;
- physical-digital artifact spatial state;
- spatial interaction geometry;
- spatial authoring/library/studio;
- calibration workflow and spatial-quality metadata;
- Discovery Assistance mechanics;
- clean AR capture generation.

## Sextant owns

- generic device capability and context;
- motion/orientation/magnetism/elevation semantics;
- haptics capability;
- lifecycle/power/thermal;
- generic hardware permissions/providers.

## Landfall owns

- physical/virtual Worldspaces;
- place/navigation;
- routes/regions/waypoints;
- journey/map truth.

## Watchglass owns

- recognition/perception;
- Vision Waypoint Library;
- evidence certification;
- OOD/abstention;
- visual localization evidence.

## Crossdeck owns

- same-person/multi-surface pairing;
- surface roles;
- synchronization transport;
- reconnect/revocation.

## Storytide owns

- narrative meaning;
- Spatial Moment story orchestration;
- hint tone;
- narrative fallback.

## Figurehead owns

- character appearance/identity/pose/expression.

## One Voyage owns

- authoritative progression and canonical session transitions.

## Wakebook owns

- personal Memory/archive truth.

## Drydock owns

- pre-publication validation/simulation/publishing proof.

## Sounding Line owns

- software/device verification and Device Lab authority.

## Harborlight owns

- community distribution/licensing/remix/public projection.

## Sealed Hold owns

- protected private spatial media/content storage/package boundaries.

\newpage

# Appendix M. Glossary

**Adaptive Anchor** - Spatial anchor resolved semantically against the current environment.

**Adaptive Spatial Staging** - Coordinated environment-aware placement of multiple authored entities.

**Anchor Version** - Monotonic identity for an authoritative shared/fixed anchor state after re-anchor changes.

**Calibrated Anchor** - Anchor refined using approved field/Creator evidence.

**Chronicle Lens** - Unified Player-facing spatial/perceptual interface.

**Discovery Assistance Contract** - Mandatory bounded hint/recovery model for required hidden spatial content.

**Field Calibration** - Optional real-world observation workflow that improves remote placement.

**Fixed Anchor** - Authored placement intended for a specific real/virtual location.

**Guided View** - Non/full-AR fallback that preserves access and story meaning.

**Parallax Spatial Studio** - Dedicated Creator workspace for spatial authoring.

**Personal Placement** - Intentionally individual spatial presentation not shared as crew spatial truth.

**Placement Policy** - Rule defining when/how spatial placement resolves and how long it remains stable.

**Shared Spatial Reality** - One authoritative spatial scene/anchor truth for all participants in the configured shared scope.

**SharedSpatialScene** - Runtime identity representing a crew-shared spatial scene.

**Spatial Attachment** - Version-pinned Chronicle reference to a spatial definition.

**Spatial Definition** - Creator-owned reusable authoring identity.

**Spatial Definition Version** - Immutable materialized spatial authoring version.

**Spatial Entity** - Canonical authored object/effect/region capable of spatial placement and interaction.

**Spatial Instance** - Voyage/run-bound runtime instantiation of a spatial attachment.

**Spatial Library** - Reusable Creator library for Parallax content, distinct from Watchglass Vision Waypoints.

**Spatial Memory** - Wakebook-owned archival Memory created from a Parallax clean capture.

**Spatial Moment** - Storytide-authored narrative moment using Parallax spatial behavior.

**Spatial Resolution Receipt** - Privacy-bounded record explaining an anchor/placement resolution decision.

**Visual Reference Anchor** - Anchor whose placement uses typed recognized image/object/landmark evidence.

\newpage

# References and Governing Sources

## Voyagewright governing authorities

1. **Voyagewright Spatial Experience Architecture v1.0**, October 4, 2026. Master cross-project ownership for Sextant, Landfall, Parallax, Crossdeck, Chronicle Lens, adaptive staging, shared spatial reality, remote calibration, memories, and Device Lab.
2. **Project Sextant v1.0 - The Device Context and Hardware Capability System**, October 4, 2026. Device capability, provider, observation, permission, quality, haptic, lifecycle, power/thermal, and hardware-context authority.
3. **Project Landfall Governing Document v1.0 - The Living World Navigation System**. World/place/navigation, privacy, confidence, zero-infrastructure baseline.
4. **Project Landfall Governing Amendment v1.1 - Worldspaces and Virtual Navigation**. Physical and virtual Worldspace authority.
5. **Accepted Project Landfall Phase 1-3 and v1.1 follow-up records**. Current accepted place/context behavior and explicit Watchglass-not-configured boundary.
6. **Project Drydock Governing Document v1.0 - The Chronicle Verification and Simulation System**. Typed authoring, provider validation, deterministic simulation, publishing evidence.
7. **Project One Voyage** accepted consolidation and runtime records. Sole authoritative progression/session transition model.
8. **Project Sounding Line Effective Authority** and `testing/sounding-line-authority.json`. Repository-wide verification/protected-main authority.
9. **Voyagewright Global Product Governance Standard**. One coherent product, discoverability, visual quality, user-journey acceptance, owner walkthrough.
10. **Project Watchglass governing architecture and design history**. Vision Waypoint Library, recognition/evidence ownership, safe abstention, visual localization concepts.
11. **Project Figurehead governing/design history**. Persistent character identity/appearance, SVG/Pixi rendering, poses/expressions, spatial-ready integration points.
12. **Project Wakebook governing/design history**. Private human archive, Memories, Keepsakes, Chronicle Passport.
13. **Project Harborlight governing architecture**. Immutable community releases, libraries/content distribution, safety, privacy, licensing/remix lineage.
14. **Project Sealed Hold governing architecture**. Protected private Chronicle content/media storage, encrypted packages, safe import/export.
15. **Project Lanternwake governing architecture**. Motion/presentation truth, reduced-motion authority, cinematic quality.
16. **Project Shipwright / Creator Studio accepted authoring architecture**. Progressive authoring disclosure, typed Creator experience, reusable library/product patterns.
17. **October 4, 2026 Parallax/Spatial Experience design conversation**. Adaptive anchors, remote placement, shared spatial reality, desk-map interaction, multi-surface companion concepts, Chronicle Lens, calibration privacy, Discovery Assistance, AR Memories, Spatial Studio, Spatial Library, AI authoring, and Watchglass sibling-library separation.

## Current external technical references reviewed October 4, 2026

18. Apple Developer Documentation - **Understanding World Tracking**. Visual-inertial world tracking, raycasting, plane detection, tracking-quality caveats, environmental-feature dependence.
19. Apple Developer Documentation - **ARAnchor / ARPlaneAnchor**. World and plane anchor semantics.
20. Apple Developer Documentation - **Scene Reconstruction** and **RealityKit Scene Understanding**. Mesh reconstruction, plane refinement, occlusion, physics, surface/object classification on supported hardware.
21. Apple Developer Documentation - **ARKit in visionOS / SpatialTrackingSession**. Plane/world tracking, world anchors, scene understanding, object/image tracking concepts applicable to future spatial surfaces.
22. Google ARCore Documentation - **Working with Anchors**. Local/world-space anchor behavior, anchor reuse/performance, local/cloud/geospatial categories.
23. Google ARCore Documentation - **Cloud Anchors**. Shared/persistent room-scale AR across multiple users/devices, hosting/resolution, feature-map/environment requirements, cross-platform iOS/Android support.
24. Google ARCore Documentation - **Depth API**. Depth-from-motion/hardware fusion, occlusion, hit testing, scene realism, runtime support detection.
25. Google ARCore Documentation - **Geospatial API and Geospatial Anchors**. Global physical placement using geodetic/VPS context, useful as an implementation option coordinated with Landfall.
26. MDN Web Docs / WebXR - **immersive-ar, DOM Overlay, and related APIs**. Limited/experimental browser availability, secure-context requirements, capability-driven web fallback need.

External platform references are implementation evidence, not permanent product promises. Parallax exists specifically to preserve stable Chronicle semantics while spatial APIs, hardware, quotas, and provider services evolve.

\newpage

# Final Governing Rule

> **Project Parallax exists to make authored Chronicle content feel as though it truly occupies the Player's world - without allowing the illusion to replace architectural truth.**
>
> Creators author spatial intent. Parallax resolves spatial truth. Sextant supplies device truth. Landfall supplies world/place truth. Watchglass supplies perception. Crossdeck supplies surface participation. Storytide supplies meaning. Figurehead supplies people. Wakebook preserves memories. Drydock proves authored behavior. Sounding Line and Device Lab prove implementation. One Voyage alone records what actually happened.
>
> **The space may adapt. The story may surprise. The shared reality must not lie.**

---

**End of Project Parallax v1.0 Governing Document**