---
title: Project Parallax engineering home
audience: product-engineering
status: phase-1-implemented-owner-acceptance-pending
canonical_for: project-parallax-engineering-home
last_reviewed: 2026-10-10
---

# Project Parallax

**The Spatial Chronicle and Augmented Reality System**

Project Parallax is Voyagewright's canonical owner for spatial Chronicle entities, augmented-reality rendering, anchors, adaptive spatial staging, shared spatial reality, Chronicle Lens spatial behavior, remote spatial authoring, physical-digital artifacts, and the dedicated Parallax Spatial Studio and Spatial Library.

Its governing promise is simple even though the machinery behind it is emphatically not:

> **Creators author spatial intent. Parallax solves spatial implementation.**

## Governing authority

1. [Voyagewright Spatial Experience Architecture v1.0](../../Governing/Voyagewright_Spatial_Experience_Architecture_Governing_Document_v1.0.md) establishes the cross-project spatial ownership boundary.
2. [Project Parallax Governing Document v1.0](../../Governing/Project_Parallax_Spatial_Chronicle_and_Augmented_Reality_System_Governing_Document_v1.0.md) is the canonical Parallax product and engineering baseline.
3. [Project Sextant Governing Document v1.0](../../Governing/Project_Sextant_Device_Context_and_Hardware_Capability_System_Governing_Document_v1.0.md) owns generic device capability and semantic hardware context consumed by Parallax.
4. Current protected repository source remains authoritative for existing implementation facts and compatibility seams.
5. [Sounding Line Effective Authority](../../Governing/Sounding_Line_Effective_Authority.md) remains the repository-wide software verification authority and owner of Voyagewright Device Lab.

## Canonical boundary

Parallax owns:

- spatial entity definition/version/attachment/instance semantics;
- spatial coordinate-space and anchor semantics;
- fixed, calibrated, adaptive, shared, persistent, and device-relative spatial placement;
- adaptive spatial staging and deterministic placement policies;
- shared spatial scenes and shared-anchor truth;
- Chronicle Lens spatial rendering and interaction behavior;
- physical-digital artifacts that can be found, picked up, carried, placed, inspected, and photographed;
- remote semantic authoring and privacy-safe field calibration;
- Discovery Assistance for required hidden spatial content;
- clean AR Memory capture handoff to Wakebook;
- Parallax Spatial Studio, Spatial Library, scene graph, interaction timeline, simulation and preview surfaces;
- spatial runtime adapters for iOS, Android, and bounded web capability.

Parallax does **not** own:

- generic device sensors, haptics, nearby hardware, or permission/provider lifecycle (Sextant);
- physical/virtual Worldspace, place, route, map, waypoint, or navigation truth (Landfall);
- visual recognition, Vision Waypoint definitions, or vision certification (Watchglass);
- multi-device pairing, surface identity, synchronization transport, or handoff (Crossdeck);
- narrative meaning or canonical Storytide progression logic (Storytide);
- character appearance/identity/pose truth (Figurehead);
- authoritative Chronicle progression (One Voyage);
- private archive truth (Wakebook);
- verification/publishing authority (Drydock and Sounding Line).

## Current implementation status

**Phase 1 — Establish the Frame is implemented. Representative-device owner acceptance remains pending.**

The [Phase 1 implementation and verification record](Phase_1_Implementation.md) documents the published Spatial Moment contract, Chronicle Lens, foreground iOS/Android providers, fixed/local/surface anchors, Guided View, isolated interaction observations, Drydock integration, migrations, and eight executable D0 scenarios in the shared Voyagewright Device Lab.

Software integration does not certify real-world placement accuracy. D4 hardware qualification and the actual representative-device owner walkthrough remain explicit product acceptance gates. Phase 2–6 authoring, adaptive staging, persistence, shared anchors, Spatial Library, and rich artifacts remain future work.

Crossdeck Phase 1 can proceed independently: this implementation adds no pairing, surface-identity, shared-scene transport, or cross-device synchronization authority.

## Six-phase program

1. **Phase 1 — Establish the Frame**  
   Spatial Domain, Runtime Foundation, Chronicle Lens Core, Fixed Anchors, and Local Placement.
2. **Phase 2 — Open the Spatial Studio**  
   Full Spatial Authoring Workspace, Spatial Library, Progressive Disclosure, AI-Assisted Authoring, and Chronicle Integration.
3. **Phase 3 — Let the World Adapt**  
   Semantic Anchors, Adaptive Spatial Staging, Remote Authoring, Field Calibration, and Discovery Assistance.
4. **Phase 4 — Share the Reality**  
   Crew-Shared Spatial Scenes, Crossdeck Integration, Persistent/Shared Anchors, Late Join, Reconnect, and Cross-Platform Resolution.
5. **Phase 5 — Make the World Respond**  
   Physical-Digital Artifacts, Rich Spatial Effects, Figurehead/Watchglass Integration, Spatial Memories, and High-Fidelity Presentation.
6. **Phase 6 — Prove the Illusion**  
   Privacy, Security, Accessibility, Performance, Device Lab, Field Qualification, Operations, and Program Closure.

Each phase must be independently mainline-safe and may not assume the next phase exists.

## Spatial Studio and Spatial Library rule

Parallax is too large to be reduced to an ordinary Chronicle-block inspector.

The normal Creator graph stores a lightweight reference to a versioned Spatial Moment and exposes only safe contextual overrides. Full spatial authoring belongs in **Parallax Spatial Studio**, a dedicated first-class Creator Studio workspace centered on a spatial canvas, scene graph, interaction timeline, simulation, previews, validation, and the reusable **Spatial Library**.

The Spatial Library is a sibling of the Watchglass Vision Waypoint Library, not a merged mega-library:

- Vision Waypoints define what Voyagewright should recognize or verify.
- Spatial Library items define what Voyagewright should place, reveal, animate, or let the Player interact with in space.
- The two libraries may reference one another through explicit immutable/versioned contracts.

## Shared Spatial Reality rule

For a shared Spatial Moment, one Voyage run has one authoritative shared anchor identity. Adaptive staging may vary between crews or runs, but it may not independently choose a different location for each Player in the same shared scene.

Late join, reconnect, tracking loss, and cross-platform resolution must all return to the same shared spatial truth unless an explicit governed re-anchor or story transition changes it.

## Device Lab rule

**Voyagewright Device Lab is shared platform verification infrastructure governed by Project Sounding Line.** Parallax registers spatial/tracking/anchor/privacy/device scenarios and consumes evidence; it does not create a private Parallax-only device lab.

The governing evidence tiers remain D0 deterministic simulation through D5 real field qualification. Simulator/emulator proof must never be relabeled as real-device AR proof.

See the [post-mainline correction receipt](../../Engineering/Device_Lab/Sextant_Parallax_Correction_Receipt.md) for bounded scene transfer, resolved geometry limits, native session lifetimes and termination proof. Older companions remain Guided-only until they advertise the matching transport contract.

## Continuing implementation

- Project Sextant governance is already published and should be consumed rather than duplicated.
- Project Crossdeck governance is required before Phase 4 can claim canonical multi-surface pairing/synchronization behavior.
- Watchglass integration must remain optional/abstaining until Watchglass has accepted implementation and certification.
- Storytide, Figurehead, Wakebook, Landfall, Drydock, Harborlight, Sealed Hold, and Sounding Line integrations must preserve their owner-domain authority.
- The six implementation phases must follow ordinary Voyagewright phase-level development, focused verification, Sounding Line final acceptance, and protected-main integration.

Later phases require their own explicit implementation scope; Phase 1 does not silently start them.

## Reach-era effective integration

Read the preserved authority above with the [current Reach integration amendment](../../Governing/Project_Parallax_Governing_Amendment_v1.1_Reach_Manipulation_Intent.md). The [effective spatial authority index](../../Governing/Voyagewright_Spatial_Experience_Effective_Authority.md) resolves the complete additive chain. Reach owns calibrated target/gesture intent; this project retains its domain authority. The amendment is governance only and does not claim new implementation or reopen accepted closure.
