---
title: Project Sextant engineering home
audience: product-engineering
status: governing-baseline
canonical_for: project-sextant-engineering-home
last_reviewed: 2026-10-09
---

# Project Sextant

**The Device Context and Hardware Capability System**

Project Sextant is Voyagewright's canonical owner for generic device capability, sensor/provider lifecycle, normalized device context, and semantic hardware observations. It exists so Landfall, Parallax, Watchglass, Storytide, Crossdeck, Lanternwake, and future consumers can request meaningful capabilities without each implementing their own web/iOS/Android hardware stack.

## Governing authority

1. [Voyagewright Spatial Experience Architecture v1.0](../../Governing/Voyagewright_Spatial_Experience_Architecture_Governing_Document_v1.0.md) establishes the cross-project ownership boundary.
2. [Project Sextant Governing Document v1.0](../../Governing/Project_Sextant_Device_Context_and_Hardware_Capability_System_Governing_Document_v1.0.md) is the canonical Sextant product and engineering baseline.
3. Current protected repository source remains authoritative for existing implementation facts and compatibility seams.
4. [Sounding Line Effective Authority](../../Governing/Sounding_Line_Effective_Authority.md) remains the repository-wide software verification authority.

## Canonical boundary

Sextant owns:

- device capability discovery and support state;
- generic device permissions and capability leases;
- web/iOS/Android provider adapters;
- orientation, attitude, heading, acceleration, angular velocity, stability, gestures, magnetism, pressure/relative elevation, and bounded step context;
- generic camera/microphone capability declarations without perception;
- haptics;
- BLE, UWB/ranging, and NFC capability/provider lifecycle;
- foreground/background/lock/interruption context;
- power, thermal, sampling-quality, calibration, freshness, confidence, and provenance semantics.

Sextant does **not** own:

- physical or virtual place/navigation truth (Landfall);
- AR/spatial entities and anchors (Parallax);
- visual recognition (Watchglass);
- narrative meaning (Storytide);
- multi-surface pairing/synchronization (Crossdeck);
- character presence (Figurehead);
- authoritative Chronicle progression (One Voyage);
- software acceptance or the Device Lab itself (Sounding Line).

## Current implementation status

**Governance complete. Implementation not started.**

The current application already contains accepted Landfall Phase 3 browser/context seams for optional foreground position, heading, motion, and elevation hints. Those remain accepted compatibility behavior. Sextant v1.0 does not retroactively invalidate them.

Future implementation must migrate generic device acquisition toward Sextant through explicit compatibility work and the required Landfall boundary amendment. No existing accepted Landfall behavior may be casually deleted because a cleaner owner now exists on paper.

## Five-phase program

1. **Phase 1 — Set the Sextant**  
   Capability Registry, Provider Foundation, Permission Broker, Compatibility Boundary, and Core Semantics.
2. **Phase 2 — Hold the Horizon**  
   Orientation, Motion, Heading, Gestures, Stability, Haptics, and Web Device Context.
3. **Phase 3 — Read the Field**  
   Magnetism, Elevation, Nearby Hardware, and Rich Derived Context.
4. **Phase 4 — Take It Afield**  
   Native iOS/Android Providers, Lifecycle, Background Behavior, and Production Consumer Integration.
5. **Phase 5 — Trust the Reading**  
   Device Lab Qualification, Real Hardware, Privacy, Security, Performance, Field Proof, and Closure.

Each phase must be independently mainline-safe and may not assume the next phase exists.

## Device Lab rule

**Voyagewright Device Lab is shared platform verification infrastructure governed by Project Sounding Line.** Sextant registers device/sensor/provider scenarios and consumes evidence; it does not create a private Sextant-only lab or inherit the old Landfall-only Device Lab concept.

The governing test tiers remain D0 deterministic simulation through D5 real field qualification.

## Before implementation

Implementation must preserve the architecture sequence and boundaries in the master Spatial Experience Architecture. In particular, native Landfall Phase 4 work cannot simply continue the old generic-sensor ownership model; the Landfall/Sextant boundary must be reconciled deliberately.

Publishing this governing baseline does not authorize Parallax, Crossdeck, or later Sextant phases automatically.

## Reach-era effective integration

Read the preserved authority above with the [current Reach integration amendment](../../Governing/Project_Sextant_Governing_Amendment_v1.1_Reach_Camera_and_Device_Gesture_Boundaries.md). The [effective spatial authority index](../../Governing/Voyagewright_Spatial_Experience_Effective_Authority.md) resolves the complete additive chain. Reach owns calibrated target/gesture intent; this project retains its domain authority. The amendment is governance only and does not claim new implementation or reopen accepted closure.
