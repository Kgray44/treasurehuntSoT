---
title: Project Crossdeck engineering home
audience: product-engineering
status: governing-baseline
canonical_for: project-crossdeck-engineering-home
last_reviewed: 2026-10-09
---

# Project Crossdeck

**The Multi-Surface Chronicle Experience System**

Project Crossdeck is Voyagewright's canonical owner for one-person/multi-surface Chronicle participation: secure pairing, surface identity and roles, synchronized presentation, focus and interaction custody, manual and gesture-driven handoff, disconnect/reconnect, and fluid movement of Chronicle experiences between a person's authorized devices.

Its governing promise is:

> **A Voyage belongs to the Player, not to a screen.**

The Player should feel as though they are moving a map, artifact, note, Journal view, Chronicle Lens, or other Chronicle experience from one place to another. Crossdeck absorbs the distributed-systems machinery required to make that interaction trustworthy.

## Governing authority

1. [Voyagewright Spatial Experience Architecture v1.0](../../Governing/Voyagewright_Spatial_Experience_Architecture_Governing_Document_v1.0.md) establishes the cross-project multi-surface ownership boundary.
2. [Project Crossdeck Governing Document v1.0](../../Governing/Project_Crossdeck_Multi_Surface_Chronicle_Experience_System_Governing_Document_v1.0.md) is the canonical Crossdeck product and engineering baseline.
3. [Project Sextant Governing Document v1.0](../../Governing/Project_Sextant_Device_Context_and_Hardware_Capability_System_Governing_Document_v1.0.md) owns generic device capability and semantic hardware context consumed by Crossdeck.
4. [Project Parallax Governing Document v1.0](../../Governing/Project_Parallax_Spatial_Chronicle_and_Augmented_Reality_System_Governing_Document_v1.0.md) owns spatial entities and AR behavior that may be projected across Crossdeck surfaces.
5. Current protected repository source remains authoritative for existing implementation facts and compatibility seams.
6. [Sounding Line Effective Authority](../../Governing/Sounding_Line_Effective_Authority.md) remains the repository-wide software verification authority and owner of Voyagewright Device Lab.

## Canonical boundary

Crossdeck owns:

- one-person/multi-surface active participation;
- Voyage surface identity and lifecycle;
- surface roles and capability projection;
- secure pairing and revocation;
- primary, companion, instrument, Chronicle Lens, chart, Journal, artifact-viewer, shared-display, and future surface roles;
- presence, liveness, focus, interaction custody, mirroring, and continuity;
- synchronization transport and surface-state convergence;
- manual handoff and destination selection;
- camera-gesture **Air Handoff** orchestration;
- sender intent, receiver claim, release, commit, acknowledgement, timeout, and recovery semantics;
- late join, reconnect, offline queueing, and bounded cached presentation;
- surface-specific privacy, accessibility, performance, and safety;
- multi-device Player UX that remains fluid even when the internals are decidedly less romantic.

Crossdeck does **not** own:

- canonical person/account/session identity or registered-device relationships (Wayfarer/Homeport);
- generic sensors, haptics, camera capability, BLE/UWB/NFC provider lifecycle, or device-context truth (Sextant);
- AR/spatial entities, anchors, adaptive staging, or Chronicle Lens spatial rendering (Parallax);
- physical/virtual Worldspace, place, route, or navigation truth (Landfall);
- visual recognition and hand-pose evidence semantics (Watchglass);
- narrative meaning and presentation choreography (Storytide);
- character identity/presence truth (Figurehead);
- authoritative Chronicle progression (One Voyage);
- private archive truth (Wakebook);
- Chronicle validation/publishing authority (Drydock);
- software/release authority or Device Lab ownership (Sounding Line).

## Air Handoff rule

Crossdeck defines a first-class camera-gesture handoff modeled around a simple human metaphor:

**show hand → grab → move toward receiving device → release**

The interaction may feel playful and nearly instantaneous, but the runtime is explicit:

1. the sending surface opens a typed handoff intent;
2. source object/view and source surface are latched;
3. the exact request/grab time is recorded;
4. eligible receiver surfaces are known;
5. one receiver claims the transfer;
6. ambiguity is resolved before commit;
7. release confirms the destination;
8. Crossdeck commits the surface/custody transition;
9. the destination acknowledges presentation;
10. failure, timeout, cancellation, or disconnect leaves recoverable truth.

Watchglass or a Watchglass-governed recognition provider supplies semantic hand-pose evidence; Sextant supplies camera/device capability, haptics, lifecycle, and optional proximity evidence. Crossdeck owns the transfer state machine and destination arbitration.

Air Handoff is a preferred high-delight interaction, never the only interaction. Every transferable Chronicle object or view must retain an accessible non-camera path such as **Send to…**, device chips, keyboard selection, drag/touch transfer, or another governed interaction.

## Current implementation status

**Governance complete. Implementation not started.**

Publishing this document does not claim that Crossdeck pairing, synchronized surfaces, manual handoff, Air Handoff, shared-display behavior, Parallax surface synchronization, or cross-device Chronicle continuity are implemented.

The current repository already contains canonical Wayfarer/Homeport account sessions with safe device labels and revocation. Crossdeck must consume those foundations rather than create a competing login or device-authentication system.

## Six-phase program

1. **Phase 1 — Lay the Gangway**  
   Surface Identity, Secure Pairing, Roles, Capability Projection, and Presence.
2. **Phase 2 — Keep One Deck**  
   Synchronization, Focus, Interaction Custody, Reconnect, and Manual Handoff.
3. **Phase 3 — Pass the Chart**  
   Air Handoff, Fluid Transfer UX, Gesture Evidence, Haptics, Receiver Arbitration, and Accessibility.
4. **Phase 4 — Work the Whole Deck**  
   Parallax, Storytide, Chronicle Lens, Crew Displays, Rich Artifact/View Choreography, and Shared Experience.
5. **Phase 5 — Weather the Passage**  
   Offline Behavior, Lifecycle Recovery, Security, Privacy, Operations, and Scale.
6. **Phase 6 — Make the Crossing Invisible**  
   Device Lab, Real-Device Qualification, Cross-Platform UX Polish, Accessibility, Performance, and Program Closure.

Each phase must be independently mainline-safe and may not assume the next phase exists.

## User-experience rule

Crossdeck must optimize for **minimum ceremony**.

Ordinary Player flows should favor:

- visible nearby/paired destinations;
- immediate acknowledgement;
- progressive disclosure;
- one clear primary action;
- reversible or safely recoverable transfers;
- no duplicate-login ceremony;
- no device-management jargon during ordinary play;
- no requirement to understand source/receiver/session internals;
- no fake success before the receiving surface has actually accepted the handoff.

When a transfer is ambiguous, the system asks the smallest useful question. When a device disappears, it recovers without losing canonical Voyage truth. When a gesture is unavailable, a simple manual path remains.

## Device Lab rule

**Voyagewright Device Lab is shared platform verification infrastructure governed by Project Sounding Line.** Crossdeck registers pairing, synchronization, handoff, disconnect, latency, gesture, multi-device, lifecycle, accessibility, and real-hardware scenarios; it does not create a private Crossdeck-only test lab.

The governing evidence tiers remain D0 deterministic simulation through D5 real field qualification. Camera-gesture success in a synthetic provider is not proof of real-world recognition quality.

## Before implementation

- Consume canonical Wayfarer/Homeport account/session truth rather than creating Crossdeck identities.
- Consume Sextant surface/device capability snapshots rather than raw hardware APIs.
- Consume Parallax spatial contracts rather than duplicating spatial entity or anchor truth.
- Keep Watchglass recognition optional and safely abstaining until its implementation/certification exists.
- Preserve One Voyage as authoritative Chronicle progression.
- Keep manual and accessible transfer paths available even when Air Handoff is supported.
- Follow ordinary Voyagewright phase-level development, focused verification, Sounding Line final acceptance, and protected-main integration.

Publishing this governed baseline does not automatically authorize Crossdeck Phase 1 or any later Spatial Experience implementation phase.

## Reach-era effective integration

Read the preserved authority above with the [current Reach integration amendment](../../Governing/Project_Crossdeck_Governing_Amendment_v1.1_Reach_Air_Handoff_Intent.md). The [effective spatial authority index](../../Governing/Voyagewright_Spatial_Experience_Effective_Authority.md) resolves the complete additive chain. Reach owns calibrated target/gesture intent; this project retains its domain authority. The amendment is governance only and does not claim new implementation or reopen accepted closure.
