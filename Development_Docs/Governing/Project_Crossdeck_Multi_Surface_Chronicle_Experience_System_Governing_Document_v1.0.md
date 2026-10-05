---
title: "Project Crossdeck"
subtitle: "The Multi-Surface Chronicle Experience System"
author: "Voyagewright Engineering"
date: "October 4, 2026"
version: "1.0"
status: "Governing Baseline"
document_id: "VW-CROSSDECK-001"
repository: "Kgray44/treasurehuntSoT"
repository_baseline: "0215e27ce53961d0d65848ab6365e983ad3a5a5e"
---

> **Governing Principle**  
> A Voyage belongs to the person, not to the screen. Project Crossdeck must let one canonical Player move attention, presentation, tools, artifacts, maps, notes, and Chronicle interactions fluidly among authorized surfaces without creating duplicate identity, duplicate progression, competing state, or visible technical ceremony. The interaction may feel magical. The state underneath it must remain explicit, attributable, reversible where appropriate, and boringly correct.

Project Crossdeck is Voyagewright's canonical multi-surface participation, pairing, synchronization, handoff, surface-role, continuity, and device-to-device experience system.

It exists because Voyagewright has outgrown the assumption that one human participates through one browser window at a time.

A Player may have the Chronicle open on a desktop while a phone acts as Chronicle Lens. A tablet may become a chart. A television may become a shared crew display. A phone may hold a compass while the desktop presents the Journal. A spatial artifact discovered through Parallax may be picked up on the phone and placed beside the game, while the desktop immediately reacts. A map, note, clue, artifact, image, or other eligible Chronicle object may move from one authorized surface to another with a simple touch, drag, device selection, keyboard action, proximity action, or governed camera gesture.

The experience must never require the Player to understand session topology, message buses, synchronization cursors, gesture-confidence thresholds, target arbitration, or transfer receipts.

The platform must understand all of them.

# Document Control

- **Document ID:** `VW-CROSSDECK-001`
- **Program:** Project Crossdeck
- **Subsystem:** The Multi-Surface Chronicle Experience System
- **Version:** 1.0
- **Date:** October 4, 2026
- **Status:** Governing baseline
- **Repository:** `Kgray44/treasurehuntSoT`
- **Repository baseline reviewed:** `0215e27ce53961d0d65848ab6365e983ad3a5a5e`
- **Umbrella authority:** Voyagewright Spatial Experience Architecture v1.0
- **Device-context authority:** Project Sextant v1.0
- **Spatial/AR authority:** Project Parallax v1.0
- **World/place/navigation authority:** Project Landfall
- **Visual-perception authority:** Project Watchglass
- **Identity/account/session authority:** Project Wayfarer / canonical `AccountSession`
- **Progression authority:** Project One Voyage
- **Narrative-experience authority:** Project Storytide
- **Memory/archive authority:** Project Wakebook
- **Software verification authority:** Project Sounding Line
- **Device Lab authority:** Project Sounding Line; Crossdeck registers scenarios but does not own the lab
- **Core implementation rule:** one person may project one Voyage across many surfaces, but those surfaces never become competing identities or competing progression engines

## Normative language

The terms **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative. MUST-level requirements are completion gates unless explicitly superseded by a later accepted governing amendment.

A beautiful handoff animation does not prove that a transfer committed. A successful WebSocket message does not prove that the correct receiving surface accepted it. A device being on the same Wi-Fi network does not make it trusted. A camera seeing a fist does not mean the Player intended to send the currently visible artifact. A secondary phone displaying the same Chronicle does not become a second Player. A Player closing one surface does not end the Voyage. And a surface-specific cache may never become a shadow source of Chronicle truth merely because it was convenient during a network hiccup.

## Authority and precedence

For Project Crossdeck work, use this order:

1. Voyagewright Global Product Governance Standard for coherent product experience, discoverability, human completion, visual quality, accessibility, and owner acceptance.
2. Voyagewright Spatial Experience Architecture v1.0 for cross-project spatial and multi-surface ownership boundaries.
3. This Project Crossdeck v1.0 governing document for pairing, surface identity, synchronization, handoff, continuity, and multi-surface interaction semantics.
4. Project Sextant v1.0 for device capability and semantic hardware context.
5. Project Parallax v1.0 for spatial entities, Chronicle Lens spatial behavior, AR, anchors, and shared spatial reality.
6. Accepted Storytide, Watchglass, Landfall, Figurehead, Wakebook, Wayfarer, One Voyage, Drydock, Harborlight, Sealed Hold, and Lanternwake authorities within their domains.
7. Current protected repository source for existing implementation facts, paths, models, and compatibility seams.
8. Current Sounding Line authority for software verification and protected-main acceptance.
9. Task prompts for bounded execution only.

No implementation prompt may create a second account/session model, a private Crossdeck progression model, a second AR anchor model, or a hidden visual-recognition stack merely because Crossdeck needs information from those systems.

# Contents

1. Executive Summary  
2. Project Identity and Product Vision  
3. Current Repository Context  
4. Non-Negotiable Experience Principles  
5. Scope and Non-Goals  
6. Canonical Ownership and Boundaries  
7. Terminology  
8. Canonical Architecture  
9. Person, Device, Session, Surface, and Voyage Identity  
10. Surface Model and Surface Roles  
11. Surface Capability Projection  
12. Surface Discovery  
13. Pairing Experience  
14. Pairing Security and Trust  
15. Trusted Device Reuse and Revocation  
16. Surface Presence, Availability, and Liveness  
17. Multi-Surface Presentation State  
18. Focus, Custody, Mirroring, and Continuity  
19. Handoff Semantics  
20. Transferable Chronicle Object Taxonomy  
21. Transfer Modes  
22. Crossdeck Air Handoff  
23. Gesture Recognition Ownership and Provider Contract  
24. Air Handoff Gesture Grammar  
25. Air Handoff State Machine  
26. Sender Selection and Grab Semantics  
27. Receiver Discovery and Targeting  
28. Receiver Claim and Release  
29. Timing, Correlation, and Device Attribution  
30. False Positive Prevention and Ambiguity Resolution  
31. Manual Handoff Methods  
32. Touch, Drag, Keyboard, Controller, and Accessibility Paths  
33. Motion, Haptics, Audio, and Lanternwake Presentation  
34. Artifact, Map, Note, Clue, and Media Handoffs  
35. Parallax Physical-Digital Artifact Integration  
36. Chronicle Lens and Crossdeck  
37. Storytide Surface Choreography  
38. Watchglass Integration  
39. Sextant Integration  
40. Landfall Integration  
41. One Voyage Integration and Authority  
42. Wayfarer Identity and Session Integration  
43. Wakebook and Memory Integration  
44. Figurehead and Presence Integration  
45. Shared Crew Displays and Co-Located Experiences  
46. Cross-Person Transfers and Crew Handoffs  
47. Realtime Synchronization Architecture  
48. Ordering, Idempotency, and Conflict Resolution  
49. Offline, Weak Network, and Reconnect  
50. Background, Lock, Sleep, and App Lifecycle  
51. Privacy and Data Minimization  
52. Security and Threat Model  
53. Safety and Human Factors  
54. Accessibility and Inclusive Interaction  
55. Performance, Latency, Battery, and Thermal Budgets  
56. Creator Authoring Model  
57. Player Settings and Discoverability  
58. Data Model  
59. API and Service Contracts  
60. Canonical Events and Receipts  
61. Diagnostics, Telemetry, and Operations  
62. Voyagewright Device Lab Contract  
63. Testing and Acceptance Matrix  
64. Six-Phase Implementation Program  
65. Final Acceptance Criteria  
Appendix A. Surface Role Catalog  
Appendix B. Handoff Capability and Policy Matrix  
Appendix C. Air Handoff Interaction Timing  
Appendix D. Air Handoff Failure and Recovery Copy  
Appendix E. Security Checklist  
Appendix F. Canonical Scenario Narratives  
Appendix G. Event Vocabulary  
Appendix H. Glossary  
References  
Final Governing Rule

# 1. Executive Summary

Project Crossdeck turns Voyagewright from a product that happens to run on several devices into a platform in which several devices can cooperatively become one coherent Chronicle experience.

The central product promise is simple:

> **The Player should be able to pick up where they are already looking, move an experience to the surface that makes the most sense, and continue without thinking about device management.**

The engineering required to make that feel simple is not simple.

Crossdeck must distinguish one human from their devices, one authenticated account session from one active surface participation session, one canonical Voyage from its many surface projections, one authoritative interaction from its mirrored presentations, and one intended handoff from an accidental camera gesture.

The project establishes:

- secure surface pairing without a second identity system;
- active surface identities bound to the canonical Wayfarer person and Voyage;
- surface-role and capability negotiation;
- synchronized multi-surface presentation state;
- explicit concepts of focus, interaction custody, mirroring, companion presentation, and handoff;
- seamless manual send/receive methods;
- a camera-gesture interaction called **Crossdeck Air Handoff**, inspired by the intuitive physical grammar of grabbing something from one device and releasing it at another;
- a two-sided transfer protocol in which sender intent, receiver target, request time, object identity, acceptance, commit, and acknowledgment are all explicit beneath the animation;
- fluid movement of eligible artifacts, maps, notes, clues, media, spatial objects, and other Chronicle objects among surfaces;
- Parallax integration so a physical-digital artifact can move from AR space to handheld surface state, to desktop presentation, and back without becoming a duplicate story object;
- Storytide surface choreography so narrative moments can deliberately use the best surface rather than spraying the same UI everywhere;
- Watchglass integration for visual hand-pose recognition without Crossdeck secretly becoming a computer-vision subsystem;
- Sextant integration for camera availability, haptics, proximity/ranging, lifecycle, and device quality without Crossdeck implementing raw hardware providers;
- reconnect, lock, sleep, offline, stale-message, and target-loss behavior;
- accessibility paths that never require camera gesture use;
- Device Lab qualification across simulated, emulated, native, real-hardware, and field scenarios.

The core user experience must feel closer to physically moving a thing than operating a synchronization control panel.

A Player should be able to:

1. open the Captain's chart on the desktop;
2. hold an open hand near the desktop camera;
3. close the hand as the chart visually responds and appears to be “held”;
4. move that closed hand toward the paired phone;
5. see the phone recognize itself as the intended receiver;
6. open the hand;
7. watch the chart arrive on the phone;
8. immediately continue interacting with it there.

Underneath that interaction, Crossdeck records exactly:

- who initiated the handoff;
- which authenticated surface originated it;
- which object and immutable version/reference were selected;
- when the intent opened;
- which receiving surface claimed it;
- why that target won if several were eligible;
- when the release gesture occurred;
- whether the transfer semantics were move, mirror, continue, pin, or copy-view;
- whether the destination acknowledged the state;
- whether any authoritative One Voyage mutation was required;
- how recovery proceeds if either device disappears mid-flight.

The Player sees a map move through the air.

The software sees a carefully governed distributed transaction with opinions about sequence numbers.

This is exactly the arrangement we want.

# 2. Project Identity and Product Vision

## 2.1 Why Crossdeck exists

Voyagewright's experience architecture now deliberately spans several categories of computing surface:

- desktop/laptop;
- phone;
- tablet;
- shared display;
- television;
- Chronicle Lens handheld surface;
- future headset/XR surface;
- future wearable or small instrument surface;
- Captain/Creator auxiliary surface where appropriate.

A one-screen assumption would force every experience into the least convenient compromise.

The desktop is excellent for:

- cinematic story presentation;
- large Journal layouts;
- detailed charts;
- Creator/Player rich information;
- game companion use.

The phone is excellent for:

- orientation-aware compass behavior;
- Chronicle Lens;
- motion/haptics;
- location/navigation;
- spatial interaction;
- quick handheld artifacts;
- private viewing.

A tablet may be excellent for:

- a persistent chart;
- shared crew reference;
- a large handheld artifact;
- second-screen notes.

A shared display may be excellent for:

- crew-wide ceremony;
- a shared map;
- a countdown;
- ambient story state.

Crossdeck allows the Chronicle to use those strengths without fragmenting the Player's identity or story.

## 2.2 Product vision

The ideal Crossdeck experience feels like the Chronicle itself understands the room.

The Player does not think:

> “I need to synchronize the current artifact state to another client.”

They think:

> “I want this map on my phone.”

Then they grab it.

Or tap `Send to phone`.

Or drag it toward a device chip.

Or press a keyboard shortcut.

Or scan a pairing QR once and let Storytide automatically place the right instrument on the right surface later.

Crossdeck therefore treats transfer methods as several human interfaces over one canonical handoff model.

## 2.3 The system must disappear when it is working

Crossdeck UI should be visible when useful and nearly invisible otherwise.

A paired phone may be represented through a small, clear surface indicator. It should not permanently occupy a giant “device management” dashboard during a Chronicle.

The device management surface belongs in Personal Harbor / appropriate settings. The live Chronicle gets only the controls needed to understand and direct current behavior.

# 3. Current Repository Context

At repository baseline `0215e27ce53961d0d65848ab6365e983ad3a5a5e`:

- the master Voyagewright Spatial Experience Architecture is published;
- Project Sextant v1.0 governance is published and owns generic device capability and semantic hardware context;
- Project Parallax v1.0 governance is published and owns spatial entities, AR, Chronicle Lens spatial behavior, adaptive staging, and shared spatial truth;
- Crossdeck is named by those authorities but remains unimplemented;
- Wayfarer/Homeport already provide the canonical `AccountSession` and safe per-session device labeling/revocation behavior;
- One Voyage remains the authoritative progression/session fact owner;
- accepted Player runtime code already contains local presentation/device hints, but those are compatibility facts rather than a governed multi-surface system;
- Parallax explicitly requires Crossdeck governance before Parallax Phase 4 can claim canonical multi-surface pairing/synchronization behavior;
- Voyagewright Device Lab is already governed as Sounding Line-owned shared verification infrastructure.

This document therefore defines a **new canonical owner around existing identity/runtime seams**, not a replacement for Wayfarer, Homeport, One Voyage, Sextant, Parallax, or Watchglass.

## 3.1 Migration principle

Existing device hints and presentation IDs remain compatibility behavior until an accepted Crossdeck implementation phase migrates or wraps them.

Do not delete working existing behavior merely because Crossdeck now has a cleaner target architecture on paper.

# 4. Non-Negotiable Experience Principles

## 4.1 One person, many surfaces

A secondary device is another surface for the same person unless a genuinely different Wayfarer identity participates.

Crossdeck MUST NOT create a shadow Player for every paired device.

## 4.2 One Voyage, many projections

All participating surfaces observe or interact with the same canonical Voyage/session truth.

Crossdeck synchronization does not create a second progression engine.

## 4.3 Instant acknowledgment, truthful completion

Every deliberate input should receive immediate local visual/haptic acknowledgment where possible.

That acknowledgment may say:

> “I understood that you grabbed this.”

It must not falsely say:

> “The receiving device has it.”

before the receiving device actually commits/acknowledges.

## 4.4 The common path should need almost no configuration

After pairing, ordinary use should be nearly automatic.

The Player should not need to repeatedly select:

- account;
- Voyage;
- network;
- transport;
- sync mode;
- source session;
- target session.

Crossdeck already knows those things.

## 4.5 Ambiguity must become a tiny interaction, not a catastrophic guess

When only one receiving surface is plausible, Crossdeck may preselect it.

When several are plausible, show a compact target choice or require the receiving surface to explicitly claim the transfer.

Never silently throw a private note onto the family-room television because its Wi-Fi latency was attractive.

## 4.6 Handoff is not ownership

Moving an artifact's presentation between surfaces does not alter Wayfarer artifact ownership, One Voyage progression, or the artifact's canonical identity unless a separate governed story mechanic explicitly requires such a change.

## 4.7 Physical metaphors should behave physically

A grab should feel latched.

A release should feel like release.

A destination should visibly receive.

A failed handoff should return or settle gracefully, not vanish into software limbo.

## 4.8 Every gesture feature has a non-gesture path

Camera gestures are convenience and immersion, never mandatory accessibility gates.

## 4.9 Surfaces must not fight

Two surfaces must not simultaneously believe they have exclusive interaction custody unless the object/moment is explicitly multi-controller.

## 4.10 Crossdeck complexity stays under the deck

The product should feel simpler as the architecture becomes more capable.

# 5. Scope and Non-Goals

## 5.1 In scope

Crossdeck owns:

- active surface identities;
- surface pairing and unpairing;
- association of a surface with canonical Wayfarer identity/session and active Voyage participation;
- surface role assignment;
- per-surface capability projection;
- surface presence/liveness;
- synchronization transport and state coordination;
- surface focus and interaction custody;
- presentation mirroring;
- handoff requests and target selection;
- handoff commit/acknowledgment/recovery;
- manual and gesture-based send/receive UX;
- device-to-device continuity;
- offline/reconnect multi-surface behavior;
- shared display semantics;
- cross-surface diagnostics;
- Device Lab scenarios for pairing, sync, handoff, loss, reconnect, ambiguity, latency, gestures, and accessibility.

## 5.2 Explicit non-goals

Crossdeck does not own:

- canonical person/account identity;
- password/session authentication rules;
- raw camera analysis or object/hand recognition;
- raw sensor/device providers;
- AR anchors/spatial scene truth;
- world/map/navigation truth;
- artifact ownership;
- Chronicle progression;
- Storytide narrative meaning;
- permanent Memory/archive truth;
- public community distribution;
- private Chronicle media storage;
- final software verification authority.

# 6. Canonical Ownership and Boundaries

## 6.1 Wayfarer

Wayfarer owns the person/account and canonical authenticated sessions.

Crossdeck creates **surface participation**, not another login system.

## 6.2 Sextant

Sextant owns device capability and semantic hardware context.

Crossdeck consumes capability snapshots such as:

- camera available;
- haptics available;
- proximity/ranging available;
- foreground/background state;
- battery/thermal constraints;
- camera permission state.

## 6.3 Parallax

Parallax owns spatial object identity, anchors, placement, and Chronicle Lens spatial rendering.

Crossdeck owns which surface participates and how Parallax state is synchronized/presented across those surfaces.

## 6.4 Watchglass

Watchglass owns visual perception.

Crossdeck Air Handoff may consume a semantic hand-pose/gesture evidence stream. Crossdeck does not independently become a hand-tracking computer-vision engine.

## 6.5 Storytide

Storytide decides why a surface is used and what the handoff means narratively.

Crossdeck executes the surface choreography.

## 6.6 One Voyage

One Voyage owns authoritative progression and session facts.

Crossdeck may emit typed proposals/receipts when a surface interaction satisfies an authored condition. Crossdeck may never commit story progression itself.

## 6.7 Wakebook

Wakebook owns durable personal Memories. Crossdeck may move a Memory-capture view between surfaces but does not become the archive.

# 7. Terminology

**Person**: canonical Wayfarer human identity.

**Device**: physical or virtual computing endpoint known to the platform.

**Account Session**: Wayfarer/Homeport-authenticated session authority.

**Surface**: one active Crossdeck presentation/interaction endpoint participating in a person's current experience.

**Surface Session**: short-lived Crossdeck participation state binding a surface to person, Voyage, role, capabilities, and transport identity.

**Surface Role**: declared purpose such as `PRIMARY_STORY`, `CHRONICLE_LENS`, `CHART`, `SHARED_DISPLAY`, or `AMBIENT`.

**Surface Focus**: which surface is currently preferred for a presentation family.

**Interaction Custody**: which surface may authoritatively drive a specific interactive object at a moment in time.

**Mirror**: additional presentation of the same state without moving exclusive interaction custody.

**Handoff**: explicit transition of focus/custody/presentation from source to destination surface.

**Air Handoff**: Crossdeck camera-gesture UX for grab/carry/release transfer.

**Handoff Intent**: pre-commit request identifying object, sender, operation, allowed targets, and timing.

**Receiver Claim**: destination surface's explicit or policy-approved assertion that it is the target.

**Handoff Commit**: authoritative Crossdeck transfer of surface focus/custody after source intent and receiver acceptance are reconciled.

**Handoff Receipt**: durable or bounded audit/evidence record describing the transfer result.

# 8. Canonical Architecture

```text
                           WAYFARER
                    canonical person/session
                             │
                             ▼
                         CROSSDECK
                 surface session coordinator
                             │
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
       ▼                     ▼                     ▼
   Desktop Surface       Phone Surface        Tablet / XR
   PRIMARY_STORY         CHRONICLE_LENS       CHART / OTHER
       │                     │                     │
       └──────────────┬──────┴──────────────┬──────┘
                      │                     │
                      ▼                     ▼
                  Storytide              Parallax
                 presentation         spatial experience
                      │                     │
                      ├──────────┬──────────┤
                      ▼          ▼          ▼
                   Landfall   Watchglass  Sextant
                    place     perception   device context
                      │          │          │
                      └──────────┼──────────┘
                                 ▼
                            One Voyage
                       authoritative story truth
```

Crossdeck is a coordinator, not a replacement owner.

# 9. Person, Device, Session, Surface, and Voyage Identity

Crossdeck must keep five identities separate:

1. `personId` - canonical Wayfarer identity;
2. `accountSessionId` - authenticated session used to prove the person/device context;
3. `surfaceId` - Crossdeck active endpoint identity;
4. `taleSessionId` / Voyage session identity - One Voyage runtime scope;
5. `surfaceSessionId` - binding between the surface and this person's participation in this specific Voyage experience.

A single device may host several browser tabs. A single account session may host several surfaces. A single person may have several account sessions across several devices. A single Voyage may include several people, each with several surfaces.

Those cardinalities must be deliberate.

## 9.1 Surface identity is not permanent person identity

Surface IDs may be ephemeral or periodically rotated.

Permanent trusted-device relationships remain Wayfarer-owned.

## 9.2 No device fingerprinting theater

Crossdeck must not invent invasive fingerprinting to avoid asking the person to pair again. Use authenticated sessions, approved device metadata, explicit pairing, and bounded trust.

# 10. Surface Model and Surface Roles

Canonical initial roles:

- `PRIMARY_STORY`
- `CHRONICLE_LENS`
- `CHART`
- `JOURNAL`
- `ARTIFACT_VIEWER`
- `SHARED_CREW_DISPLAY`
- `AMBIENT`
- `CAPTAIN_AUXILIARY`
- `CREATOR_PREVIEW`
- `ACCESSIBILITY_COMPANION`

A surface may support several roles but SHOULD have one current dominant role for clear UI behavior.

## 10.1 Role is presentation intent, not permission

Role assignment does not grant account capabilities.

A phone labeled `CAPTAIN_AUXILIARY` does not make an ordinary Player Captain.

# 11. Surface Capability Projection

Crossdeck consumes Sextant and platform/browser capability to build a privacy-safe surface capability snapshot.

Representative fields:

```text
SurfaceCapabilitySnapshot
  surfaceId
  formFactor
  viewportClass
  inputMethods
  cameraAvailable
  microphoneAvailable
  hapticsAvailable
  orientationAvailable
  spatialRuntimeAvailable
  nearbyRangingAvailable
  lifecycleClass
  backgroundLimitations
  batteryClass
  thermalClass
  bandwidthClass
  latencyClass
  accessibilityPreferences
  supportedPresentationFamilies[]
```

The snapshot helps Storytide/Parallax choose surfaces. It must not expose unnecessary hardware-identifying detail to Chronicle content.

# 12. Surface Discovery

Crossdeck may discover candidate surfaces through:

- same-account active session registry;
- a pairing QR/link;
- user-entered one-time code;
- already-trusted device association;
- bounded nearby discovery using Sextant BLE/UWB where available and consented;
- same-Voyage shared display invitation;
- explicit `Add a device` flow.

Network adjacency alone is not trust.

# 13. Pairing Experience

## 13.1 Desktop-to-phone default flow

Preferred common path:

1. Desktop offers `Use your phone` / `Open Chronicle Lens`.
2. Desktop shows QR and optional short code.
3. Player scans with phone.
4. If the phone already has a valid Wayfarer session for the same person, confirmation is one small step.
5. If not, normal Wayfarer sign-in/guest claiming occurs without Crossdeck inventing a second login.
6. Both surfaces display a concise matching confirmation.
7. Crossdeck creates the surface-session binding.
8. Phone opens directly into the requested role, not a generic device dashboard.

Target experience: first-time pairing should feel like joining a call, not provisioning enterprise hardware.

## 13.2 Confirmation language

Desktop:

> **Phone connected**  
> Chronicle Lens is ready.

Phone:

> **Joined this Voyage**  
> Your desktop remains the main story surface.

No IP addresses. No port numbers. No transport terminology.

# 14. Pairing Security and Trust

Pairing credentials must be:

- one-time or short-lived;
- exact-person or explicit guest-context bound;
- exact-Voyage bound where appropriate;
- scope-bound to surface participation;
- revocable;
- replay-resistant;
- non-transferable to unrelated sessions;
- safe if photographed after expiry.

## 14.1 QR contents

Prefer opaque challenge identifiers or signed deep links containing no secret Chronicle content.

## 14.2 Mutual confirmation

For sensitive surface roles, Crossdeck may show a short visual phrase/code on both devices.

Example:

> `BRASS COMPASS`

The Player confirms the same phrase on the destination device.

# 15. Trusted Device Reuse and Revocation

A person may mark a device as convenient/trusted through Wayfarer-controlled policy.

Crossdeck may then offer:

> **Your phone is nearby. Use it as Chronicle Lens?**

but should not automatically activate its camera or join a Voyage without a meaningful user action.

Wayfarer session revocation must immediately invalidate Crossdeck surface participation derived from that session.

# 16. Surface Presence, Availability, and Liveness

Crossdeck tracks states such as:

```text
DISCOVERED
PAIRING
AVAILABLE
ACTIVE
BACKGROUND
LOCKED
SLEEPING
DEGRADED
DISCONNECTED
RECONNECTING
REVOKED
EXPIRED
```

Presence is time-bounded. A phone last seen 40 minutes ago is not a safe current handoff target merely because it remains in a registry.

# 17. Multi-Surface Presentation State

Crossdeck must separate:

- canonical Chronicle state;
- surface presentation state;
- surface-local ephemeral UI state;
- synchronized interaction state;
- optional mirrored view state.

Example:

The canonical artifact is `map-ancient-isles`.

Desktop surface state:

```text
presentation: JOURNAL_INLINE
interactive: false
```

Phone surface state:

```text
presentation: HANDHELD_ARTIFACT
interactive: true
```

The artifact is still one object.

# 18. Focus, Custody, Mirroring, and Continuity

Crossdeck defines four independent concepts.

## 18.1 Presentation focus

Preferred surface for new presentation events of a class.

## 18.2 Interaction custody

Surface currently allowed to issue interactive commands for an object/control family.

## 18.3 Mirror

Another surface may display synchronized state without controlling it.

## 18.4 Continuity

The destination resumes at the meaningful semantic point rather than opening at a generic home page.

If a map is zoomed to Thieves' Haven when handed off, the phone should open to Thieves' Haven unless the target role intentionally uses a different composition.

# 19. Handoff Semantics

A handoff moves some combination of:

- presentation focus;
- interaction custody;
- viewport/context;
- tool mode;
- local transient interaction state.

It does not inherently move canonical ownership or progression.

Every handoff declares an operation type and policy.

# 20. Transferable Chronicle Object Taxonomy

Initial eligible families:

- maps/charts;
- notes;
- clue cards;
- artifact viewers;
- physical-digital Parallax artifacts;
- Journal excerpts;
- images/illustrations;
- puzzle interfaces;
- compass/instrument interfaces;
- selected media playback state;
- creator-defined surface-capable Spatial Moments;
- bounded Captain/crew presentation where policy permits.

Not everything should be transferable.

Secret Captain controls, credentials, private Creator notes, and other protected data remain owner-policy constrained.

# 21. Transfer Modes

## 21.1 MOVE_FOCUS

Destination becomes primary presentation/interaction surface; source settles to summary or closed state.

## 21.2 MOVE_CUSTODY

Interaction custody moves while source may remain visibly mirrored.

## 21.3 MIRROR

Destination receives synchronized view without removing source interaction.

## 21.4 OPEN_COMPANION

Destination receives a complementary representation rather than the same UI.

Example: desktop Journal -> phone compass.

## 21.5 PIN_TO_SURFACE

Destination keeps a persistent auxiliary presentation while source continues.

## 21.6 SEND_VIEW

A non-authoritative snapshot/read-only view is shared.

## 21.7 STORY_HANDOFF

Storytide-authored transition whose completion may participate in progression through One Voyage.

# 22. Crossdeck Air Handoff

Crossdeck Air Handoff is the first-class camera-gesture method for moving eligible Chronicle objects between paired surfaces.

The interaction intentionally uses a physical metaphor:

```text
OPEN PALM
    ↓
recognized near source
    ↓
CLOSE FIST
    ↓
GRAB object
    ↓
move toward receiver
    ↓
receiver recognizes pending handoff
    ↓
OPEN PALM
    ↓
RELEASE to destination
```

This interaction grammar is inspired by real multi-device gesture-transfer precedents, including Huawei's HarmonyOS air-transfer flow. Crossdeck does not depend on Huawei technology, protocols, or APIs.

## 22.1 Air Handoff is optional

It is never the only transfer path.

## 22.2 Air Handoff may be enabled per surface

Camera use requires clear permission and purpose.

## 22.3 The Chronicle object must be eligible

Crossdeck must not grab arbitrary page content merely because a fist appeared.

# 23. Gesture Recognition Ownership and Provider Contract

Visual gesture recognition is a perception problem.

Crossdeck consumes semantic evidence such as:

```text
HandGestureEvidence
  surfaceId
  actorPersonId
  handTrackId
  gesture
  phase
  confidence
  stableDurationMs
  cameraTimestamp
  evidenceFreshnessMs
  boundingRegion
  handednessHint
  providerCertification
```

Gesture values may include:

```text
PALM_OPEN
FIST_CLOSED
PALM_RELEASE
HAND_ENTERED
HAND_LEFT
UNKNOWN
```

The canonical provider should be Watchglass or another Watchglass-governed visual-perception adapter.

Sextant provides camera capability and lifecycle context. It does not classify hand shapes.

Crossdeck owns the handoff state machine built from those semantic observations.

## 23.1 Safe absence

Crossdeck implementation must be useful before certified camera gesture recognition exists.

Manual transfer ships independently.

# 24. Air Handoff Gesture Grammar

The default grammar should prioritize intent clarity over circus tricks.

## 24.1 Arm

Open palm appears within the sender camera's usable region for a short stable dwell.

The eligible object subtly responds.

## 24.2 Grab

The hand closes into a fist within the gesture window.

The object visibly compresses/lifts/latches toward the grab state.

## 24.3 Carry

Crossdeck opens a short-lived Handoff Intent. The source object remains latched to the pending transfer presentation.

## 24.4 Receiver acquire

An eligible paired receiver observes either:

- the same recent handoff context plus a receiving gesture;
- proximity/ranging evidence;
- explicit receiver readiness;
- user-selected target.

## 24.5 Release

The receiving surface observes the open-palm release or explicit receive action.

## 24.6 Commit

Crossdeck atomically commits surface custody/focus according to the transfer mode.

## 24.7 Acknowledge

Destination renders accepted state. Source completes departure animation only when appropriate acknowledgment arrives.

# 25. Air Handoff State Machine

Canonical state machine:

```text
IDLE
 ↓
ARMED
 ↓
GRAB_DETECTED
 ↓
SOURCE_LATCHED
 ↓
INTENT_OPEN
 ↓
TARGET_SEARCH
 ├─ no candidate → HOLDING
 ├─ ambiguous → TARGET_CHOICE
 └─ candidate → TARGET_CANDIDATE
 ↓
TARGET_CLAIMED ↓
RELEASE_DETECTED
 ↓
COMMIT_PENDING
 ├─ failure → RETURN_TO_SOURCE
 └─ success → COMMITTED
 ↓
DESTINATION_ACK
 ↓
COMPLETE
```

Abort paths include:

```text
CANCELLED
EXPIRED
SOURCE_LOST
TARGET_LOST
GESTURE_LOST
UNAUTHORIZED
OBJECT_CHANGED
CONFLICT
NETWORK_DEGRADED
```

# 26. Sender Selection and Grab Semantics

## 26.1 Active object selection

If one eligible foreground object dominates the current surface, Crossdeck may infer it as the grab candidate.

Examples:

- full-screen map;
- open artifact viewer;
- selected note;
- actively held Parallax artifact.

## 26.2 Multiple eligible objects

If several objects are present, require one of:

- recent explicit selection;
- pointer/focus selection;
- a pre-handoff highlight cycle;
- target tap;
- story-authored single eligible object.

The camera hand alone should not decide which of six notes the Player intended to send.

## 26.3 Source visual latch

On recognized grab:

- object slightly lifts or contracts toward the hand direction;
- nearby irrelevant controls de-emphasize;
- target-surface affordance appears;
- a subtle haptic pulse fires if available;
- no success sound plays yet.

# 27. Receiver Discovery and Targeting

Potential receiver ranking signals:

1. same person;
2. same active Voyage;
3. compatible role/capability;
4. foreground/awake state;
5. receiver gesture readiness;
6. proximity/ranging if available;
7. recent surface activity;
8. creator/story preferred surface;
9. privacy policy;
10. explicit Player target choice.

Network latency is not a sufficient reason to choose a target.

## 27.1 Single obvious receiver

If exactly one eligible paired receiver exists, it may pre-arm and show:

> **Ready to receive**

## 27.2 Several receivers

The source may show compact device chips:

`Phone` `Tablet` `Desk display`

or wait for one receiver to claim through gesture.

# 28. Receiver Claim and Release

A destination surface does not become the receiver merely because it is nearby.

It claims the transfer through one of:

- open-palm receiving gesture following the recent source grab;
- explicit `Receive` control;
- Storytide-authored auto-accept on a designated personal surface;
- trusted personal handoff policy for low-sensitivity content;
- accessibility equivalent.

The receiver claim includes exact `surfaceId`, `handoffIntentId`, timestamp, and confidence/provenance.

# 29. Timing, Correlation, and Device Attribution

The user's requirement that every device know **when sending was requested and which device was intended to receive it** is a hard protocol requirement.

Every Handoff Intent MUST record:

```text
handoffIntentId
personId
voyageId
sourceSurfaceId
sourceAccountSessionId
objectRef
objectVersionRef
operation
intentOpenedAt
sourceGrabObservedAt
allowedReceiverSurfaceIds[]
preferredReceiverSurfaceId?
receiverClaimedSurfaceId?
receiverClaimedAt?
releaseObservedAt?
commitRequestedAt?
committedAt?
destinationAcknowledgedAt?
expiredAt?
status
```

## 29.1 Clock handling

Server ordering uses authoritative server sequence/time where available.

Device-local camera timestamps may be preserved for latency analysis but must not independently order canonical conflicting operations.

## 29.2 Correlation window

Gesture correlation windows must be short enough to prevent an unrelated later fist from claiming an old transfer, but long enough for a human to physically move their hand between devices.

Defaults should be empirically tuned in Device Lab and real field trials rather than frozen from vibes.

# 30. False Positive Prevention and Ambiguity Resolution

Air Handoff must fail safe.

## 30.1 Do not arm from arbitrary hand movement

Require stable open-palm evidence before accepting a grab sequence.

## 30.2 Require object eligibility

No eligible object means no grab intent.

## 30.3 Require sequence

A random fist without prior palm/arming state does not start a send.

## 30.4 Require temporal continuity

Stale gesture evidence cannot complete a handoff.

## 30.5 Require destination claim

A source fist moving past two devices cannot cause both to receive.

## 30.6 Ambiguous target UX

If two receivers claim simultaneously:

> **Which device should receive this?**

Show two compact choices. Preserve the latched object until selection or timeout.

## 30.7 Private/sensitive content

Sensitive notes, Creator-private content, or personal data may require explicit target confirmation even when one receiver appears obvious.

# 31. Manual Handoff Methods

Air Handoff is only one input method.

Crossdeck must support at least:

- `Send to...` menu;
- destination device chips;
- drag toward a surface target affordance;
- keyboard command / command palette;
- context-menu action;
- touch long-press then destination;
- Storytide automatic surface choreography;
- Parallax pick-up/place transition where the target surface is part of the authored interaction.

Future optional methods may include:

- NFC tap;
- UWB-directed target selection;
- controller/remote actions;
- voice-assisted destination selection where privacy policy allows.

# 32. Touch, Drag, Keyboard, Controller, and Accessibility Paths

Every meaningful transfer must be possible without camera gestures.

## 32.1 Keyboard example

`Shift + Alt + D` could open the destination chooser for the focused transferable object, subject to platform conventions and conflict review.

## 32.2 Screen reader

Transfer controls expose:

- object name;
- available destinations;
- current source;
- operation type;
- transfer status;
- cancel/retry.

## 32.3 Reduced motion

Reduced-motion mode replaces flying-object choreography with a short focus/opacity/material transition while preserving clear source/destination acknowledgment.

# 33. Motion, Haptics, Audio, and Lanternwake Presentation

Crossdeck owns semantic transfer states. Lanternwake owns the platform's presentation/motion language where ordinary Voyagewright UI is involved.

## 33.1 Recommended physical metaphor

Grab:

- 120-220 ms tactile latch;
- slight object depth lift;
- brief low haptic.

Carry:

- object remains visually “held”; destination candidates breathe subtly.

Release:

- destination surface receives with material settle;
- source releases only after commit/ack when strict move semantics apply.

Failure:

- object elastically/softly returns to source;
- no destructive error flash;
- concise recovery copy.

## 33.2 Audio

Audio is optional and never the only success signal.

# 34. Artifact, Map, Note, Clue, and Media Handoffs

## 34.1 Maps

Preserve semantic viewport:

- Worldspace;
- region;
- selected marker;
- zoom class;
- annotation context;
- active route.

Desktop and phone need not use identical pixel geometry.

## 34.2 Notes

Preserve:

- note identity/version;
- reading position where sensible;
- private/crew visibility policy;
- annotation draft ownership.

## 34.3 Artifacts

Crossdeck moves presentation/interaction custody.

Wayfarer/One Voyage remain artifact ownership/progression authorities.

## 34.4 Media

A media handoff may preserve:

- playback position;
- current chapter/segment;
- volume preference where appropriate;
- subtitle state;
- presentation role.

Do not assume every media provider can resume seamlessly; truthful capability/fallback applies.

# 35. Parallax Physical-Digital Artifact Integration

Parallax and Crossdeck meet most visibly when a spatial artifact crosses a surface boundary.

Example:

```text
Parallax map on desk
   ↓ player picks up
DEVICE_SPACE artifact on phone
   ↓ Crossdeck handoff
Desktop receives MAP_VIEW representation
   ↓ player sends back
Phone resumes handheld artifact
```

Parallax owns spatial transform/anchor state.

Crossdeck owns surface transfer state.

The artifact identity remains stable.

# 36. Chronicle Lens and Crossdeck

Chronicle Lens is commonly a Crossdeck surface role.

Pairing flow may be launched from desktop:

> **Open Chronicle Lens on phone**

Crossdeck handles pairing; Parallax handles Lens spatial runtime; Sextant supplies device context; Watchglass may supply perception.

# 37. Storytide Surface Choreography

Storytide can author preferred surface behavior such as:

```text
Main cinematic -> PRIMARY_STORY
Compass interaction -> CHRONICLE_LENS
Large shared map -> SHARED_CREW_DISPLAY preferred
Private clue -> personal handheld surface only
```

Crossdeck resolves the available surfaces and returns a clear result/fallback.

Storytide must not hard-code `iPhone` or `second monitor` as story semantics.

# 38. Watchglass Integration

Watchglass may provide:

- palm/fist/release gesture evidence;
- hand track continuity;
- device-camera visual target confirmation;
- QR/pairing recognition where approved;
- camera scene confidence.

Watchglass may abstain.

If it abstains, Crossdeck falls back to manual transfer.

# 39. Sextant Integration

Sextant supplies:

- camera capability/lifecycle;
- haptics;
- BLE/UWB/ranging where available;
- foreground/background/lock state;
- power/thermal state;
- possibly orientation context useful to gesture UX.

Crossdeck consumes semantic capability. It does not call OS hardware APIs directly unless explicitly defined as a Crossdeck-owned transport primitive by a later amendment.

# 40. Landfall Integration

Landfall supplies world context that may travel with map/chart handoffs.

Crossdeck never creates an alternate Worldspace or route model.

A chart sent to another surface carries a Landfall-safe view reference, not an independently editable map clone unless the experience explicitly uses collaborative annotations.

# 41. One Voyage Integration and Authority

Crossdeck must distinguish **surface transfer** from **story action**.

Ordinary surface move:

```text
Map moved desktop -> phone
One Voyage progression: unchanged
```

Story-authored transfer challenge:

```text
Player hands sealed letter to designated crew surface/person
Crossdeck evidence
   ↓
Storytide completion provider
   ↓
One Voyage validates and commits
```

Crossdeck never directly marks a chapter complete.

# 42. Wayfarer Identity and Session Integration

Wayfarer/Homeport `AccountSession` remains the canonical ordinary authenticated session authority.

Crossdeck should consume:

- person/account identity;
- safe device/session label;
- session validity;
- revocation;
- role/capability projection where appropriate.

Crossdeck must not store password credentials, OAuth credentials, or raw session tokens in handoff records.

## 42.1 Revocation

If an `AccountSession` is revoked:

- derived surface sessions become invalid;
- active Crossdeck transport closes or degrades immediately;
- sensitive presentation is removed;
- pending handoffs involving the surface fail closed.

# 43. Wakebook and Memory Integration

Crossdeck may move a Memory capture workflow to the surface with the best camera or editing composition.

Wakebook remains durable archive authority.

Example:

> Desktop shows Voyage detail -> `Open this Memory on phone` -> phone opens camera/AR Memory composition -> capture -> Wakebook stores through its governed service.

# 44. Figurehead and Presence Integration

Figurehead may expose presence/identity representations suitable for surfaces.

Crossdeck may choose where a Figurehead presentation appears, but Figurehead owns character appearance/pose semantics.

Future shared-display experiences may show crew Figureheads while phones remain private interaction devices.

# 45. Shared Crew Displays and Co-Located Experiences

A shared display is a surface, not a person.

It must have:

- a sponsoring authorized person/session;
- explicit Voyage binding;
- restricted visibility projection;
- no private-person content unless the story intentionally makes it crew-visible;
- clear control/custody rules.

Shared displays should usually be `read-mostly` unless explicit controls are authored.

# 46. Cross-Person Transfers and Crew Handoffs

Crossdeck's foundational promise is one person, many surfaces.

Cross-person transfers are a later but anticipated capability.

They require explicit additional rules because transferring presentation to **another person's device** can imply disclosure or story action.

## 46.1 Minimum requirements

- recipient identity known;
- recipient surface authorized in same Voyage;
- content visibility allows recipient;
- explicit receive/consent unless Storytide rules clearly govern shared crew visibility;
- no private notes or personal Memories leak;
- transfer does not silently change artifact ownership;
- if ownership/progression changes, One Voyage/Wayfarer owning services commit it.

## 46.2 Gesture case

A Player may eventually physically “hand” an eligible shared artifact to another Player's phone.

Crossdeck handles the transfer choreography; One Voyage handles any actual story consequence.

# 47. Realtime Synchronization Architecture

Crossdeck should use a transport-neutral synchronization layer.

Potential transport classes:

- server WebSocket;
- server-sent events for read-oriented surfaces;
- WebRTC/data channel where approved for low-latency personal-device paths;
- native realtime service;
- local-network optimization layered beneath the canonical service.

No transport becomes the authority by itself.

## 47.1 Canonical message envelope

```text
CrossdeckMessage
  messageId
  surfaceSessionId
  voyageId
  personId
  sequence
  type
  payloadSchemaVersion
  emittedAt
  expiresAt?
  correlationId?
  causationId?
  signature/authContext
```

# 48. Ordering, Idempotency, and Conflict Resolution

## 48.1 Per-surface ordering

Use monotonic sequence/cursor semantics appropriate to the transport.

## 48.2 Duplicate messages

Duplicate handoff commit or acknowledgment must be idempotent.

## 48.3 Competing custody

If two surfaces request exclusive custody simultaneously:

- deterministic policy resolves or asks the user;
- One Voyage progression is unaffected unless story semantics require it;
- losing surface returns to mirrored/read-only state gracefully.

## 48.4 Stale object version

If the source attempts to hand off a stale object representation, Crossdeck must refresh/reconcile rather than deliver old secret or progression state.

# 49. Offline, Weak Network, and Reconnect

Crossdeck should degrade without producing false continuity.

## 49.1 Temporary network loss

A currently rendered local object may remain visible if privacy allows.

New exclusive handoffs requiring cross-device commit should pause or fail clearly.

## 49.2 Source disconnect during handoff

Before commit: cancel and restore source when possible.

After commit but before source acknowledgment: destination remains authoritative for custody if server commit succeeded; source reconciles on reconnect.

## 49.3 Destination disconnect

Before commit: transfer remains uncommitted.

After commit: policy may retain destination custody if the object is recoverable, but another surface must be able to reclaim through explicit recovery.

# 50. Background, Lock, Sleep, and App Lifecycle

Surface eligibility depends on lifecycle.

A locked phone should not silently receive a sensitive private note onto its lock screen.

Crossdeck may:

- queue low-risk handoff invitation;
- ask user to unlock;
- defer activation;
- fall back to another target.

Sextant/native lifecycle context informs this decision.

# 51. Privacy and Data Minimization

Crossdeck records only what is necessary to coordinate surfaces and diagnose failures.

Do not retain raw camera frames for Air Handoff merely to prove a fist existed.

Prefer semantic gesture evidence receipts.

Do not expose another surface's:

- raw IP;
- hardware serial;
- sensor stream;
- unnecessary device fingerprint;
- unrelated active application;
- private notification content.

# 52. Security and Threat Model

Threats include:

- stolen pairing QR;
- replayed pairing challenge;
- attacker surface claiming a handoff;
- session revocation not propagating;
- stale surface receiving secret content;
- forged gesture evidence;
- cross-person content disclosure;
- handoff replay;
- message reordering;
- duplicate commit;
- malicious shared display;
- downgrade to insecure transport;
- surface enumeration;
- shoulder-surfed target names;
- compromised browser extension/client;
- cross-Voyage target confusion.

## 52.1 Defensive rules

- pairing challenges expire;
- handoffs bind exact source/object/Voyage/person;
- target claims bind exact surface;
- commit requires authorized destination;
- sensitive content rechecks visibility at commit time;
- session revocation fails closed;
- stale message TTL enforced;
- all commits idempotent;
- audit receipts omit raw secrets;
- manual confirmation available for sensitive transfers.

# 53. Safety and Human Factors

Camera gesture features must not encourage unsafe movement around the room while staring at screens.

Do not require a Player to hold a phone while gesturing toward another device if that configuration is awkward or unsafe.

Air Handoff is most appropriate for stationary/slow contexts.

Outdoor mobile Chronicles should prefer explicit touch/haptic methods while walking.

# 54. Accessibility and Inclusive Interaction

Crossdeck accessibility requirements include:

- full non-camera transfer path;
- keyboard equivalents;
- screen-reader announcements;
- high-contrast target indicators;
- reduced-motion transfer presentation;
- no color-only target identity;
- adjustable/forgiving gesture dwell where gesture use is chosen;
- one-handed manual path;
- switch-control compatible target selection where platform allows;
- clear error recovery;
- no timing window so short that motor impairments make transfer impossible;
- no forced bilateral gestures;
- no mandatory speech/audio cues.

# 55. Performance, Latency, Battery, and Thermal Budgets

Crossdeck should feel instant even when the network is merely fast, not magical.

## 55.1 UX response budgets

Targets to qualify empirically:

- local control/gesture acknowledgment: preferably <= 100 ms from accepted semantic input;
- destination-ready indicator after valid target evidence: preferably <= 250 ms on healthy local/network conditions;
- ordinary personal-device handoff perceived completion: target sub-second under healthy conditions;
- animation may cover network latency but may not falsely complete before commit;
- reconnection should progressively restore surfaces rather than block the whole Voyage behind one device.

These are product targets, not permission to fabricate success when networks exceed them.

## 55.2 Camera recognition duty cycle

Air Handoff should not run heavy hand-pose inference continuously across every screen.

Use contextual arming:

- transferable object visible/selected;
- Air Handoff enabled;
- camera permission active;
- surface foreground;
- thermal/power budget acceptable.

# 56. Creator Authoring Model

Creators should not manually wire device IDs.

Storytide/Creator Studio should express intent such as:

- `Prefer handheld surface`;
- `Open this map on the Player's Chronicle Lens`;
- `Allow Player to hand this artifact between personal surfaces`;
- `Require recipient crew member`;
- `Shared display optional`;
- `Fallback to same-screen interaction`.

## 56.1 Surface requirements

A block/moment may declare:

```text
preferredRole: CHRONICLE_LENS
requiredCapabilities: []
optionalCapabilities: [CAMERA_GESTURE_HANDOFF]
fallback: SAME_SURFACE
```

Creators should not see transport implementation.

# 57. Player Settings and Discoverability

Personal Harbor should eventually expose Crossdeck controls under a coherent device/sessions area:

- paired/trusted devices;
- active surfaces;
- Air Handoff on/off;
- camera gesture preference;
- auto-accept low-risk personal handoffs;
- shared-display privacy;
- remembered surface roles;
- remove/revoke device.

During a Chronicle, keep controls compact:

> **Devices** `Desktop · Phone`

with a simple surface sheet.

# 58. Data Model

Representative future models:

```text
CrossdeckSurface
CrossdeckSurfaceSession
CrossdeckPairingChallenge
CrossdeckSurfaceCapabilitySnapshot
CrossdeckPresentationPreference
CrossdeckInteractionCustody
CrossdeckHandoffIntent
CrossdeckHandoffTargetClaim
CrossdeckHandoffReceipt
CrossdeckSurfaceEvent
CrossdeckSharedDisplayGrant
```

## 58.1 CrossdeckSurface

Stores bounded surface identity and association metadata, not credentials.

## 58.2 CrossdeckSurfaceSession

Binds surface to person, AccountSession, Voyage/TaleSession, role, transport, capability snapshot, and lifecycle.

## 58.3 Handoff intent

Stores request state and timing.

## 58.4 Handoff receipt

Stores result/provenance suitable for diagnostics, Drydock/Device Lab evidence, or One Voyage proposal linkage.

# 59. API and Service Contracts

Representative services:

```text
SurfacePairingService
SurfacePresenceService
SurfaceCapabilityService
SurfaceSyncService
PresentationRoutingService
InteractionCustodyService
HandoffService
AirHandoffCoordinator
SharedDisplayService
CrossdeckRecoveryService
```

Representative API families:

```text
POST /api/crossdeck/pairing/challenge
POST /api/crossdeck/pairing/claim
POST /api/crossdeck/pairing/confirm
GET  /api/crossdeck/surfaces
POST /api/crossdeck/surfaces/:id/role
POST /api/crossdeck/handoffs
POST /api/crossdeck/handoffs/:id/claim
POST /api/crossdeck/handoffs/:id/release
POST /api/crossdeck/handoffs/:id/cancel
GET  /api/crossdeck/handoffs/:id
```

Exact routes are implementation decisions; typed contracts are required.

# 60. Canonical Events and Receipts

Candidate event vocabulary:

```text
CROSSDECK_SURFACE_DISCOVERED
CROSSDECK_PAIRING_STARTED
CROSSDECK_SURFACE_PAIRED
CROSSDECK_SURFACE_ACTIVE
CROSSDECK_SURFACE_BACKGROUND
CROSSDECK_SURFACE_DISCONNECTED
CROSSDECK_SURFACE_RECONNECTED
CROSSDECK_SURFACE_REVOKED
CROSSDECK_ROLE_CHANGED
CROSSDECK_FOCUS_CHANGED
CROSSDECK_CUSTODY_ACQUIRED
CROSSDECK_CUSTODY_RELEASED
CROSSDECK_HANDOFF_ARMED
CROSSDECK_HANDOFF_GRABBED
CROSSDECK_HANDOFF_INTENT_OPENED
CROSSDECK_HANDOFF_TARGET_CLAIMED
CROSSDECK_HANDOFF_RELEASE_DETECTED
CROSSDECK_HANDOFF_COMMITTED
CROSSDECK_HANDOFF_ACKNOWLEDGED
CROSSDECK_HANDOFF_CANCELLED
CROSSDECK_HANDOFF_EXPIRED
CROSSDECK_HANDOFF_FAILED
```

These are Crossdeck events, not automatic TaleSession progression events.

# 61. Diagnostics, Telemetry, and Operations

Crossdeck diagnostics should answer:

- Which surfaces are active?
- Which person/session/Voyage are they bound to?
- What role/capabilities do they have?
- Is transport healthy?
- What is current focus/custody?
- Which handoffs are pending?
- What failed and at which phase?
- Was target selection ambiguous?
- Did source/destination clocks differ materially?
- Did a revocation race occur?
- Was Watchglass gesture evidence unavailable?
- Was fallback used?

Telemetry must remain privacy-minimized.

# 62. Voyagewright Device Lab Contract

Crossdeck registers scenarios with the shared Sounding Line-governed Voyagewright Device Lab.

Required scenario families include:

- first-time desktop/phone pairing;
- same-account trusted-device rejoin;
- wrong-account pairing denial;
- expired pairing QR;
- replayed pairing challenge;
- source session revoked;
- destination session revoked;
- surface background/lock/unlock;
- network loss during pairing;
- network loss before/after handoff commit;
- duplicate handoff release;
- stale handoff intent;
- one obvious receiver;
- several eligible receivers;
- two simultaneous receiver claims;
- Air Handoff palm/fist/release happy path;
- fist without arm state;
- palm misclassification;
- gesture confidence loss;
- receiver camera unavailable;
- Watchglass abstention;
- manual fallback;
- reduced-motion path;
- keyboard path;
- screen-reader path;
- shared display privacy;
- Parallax artifact handoff;
- map viewport continuity;
- late/reconnecting surface;
- battery/thermal degradation;
- iOS/Android/native/web combinations;
- D4 real-device camera/gesture qualification;
- D5 real co-located multi-device field trial.

# 63. Testing and Acceptance Matrix

## 63.1 Unit/domain

- surface identity/cardinality;
- role assignment;
- capability projection;
- handoff state machine;
- timing/expiry;
- idempotency;
- conflict arbitration;
- privacy filtering;
- revocation propagation.

## 63.2 Service/integration

- Wayfarer `AccountSession` integration;
- One Voyage no-mutation for ordinary handoff;
- Storytide proposal path;
- Parallax object identity preservation;
- Sextant capability projection;
- Watchglass abstention/manual fallback;
- Wakebook handoff boundaries.

## 63.3 Browser/native

- desktop -> mobile;
- mobile -> desktop;
- tablet combinations;
- resize/orientation;
- lock/background;
- accessibility;
- real camera permissions;
- reconnection.

## 63.4 Security

- token replay;
- cross-account claim;
- wrong-Voyage target;
- stale target;
- privilege/content leakage;
- forged gesture evidence;
- duplicate commit;
- session revocation race.

## 63.5 Performance

- latency distributions;
- camera inference cost;
- bandwidth;
- reconnect time;
- multi-surface fanout;
- battery/thermal.

# 64. Six-Phase Implementation Program

Each phase is independently mainline-safe and may not assume later phases exist.

## Phase 1 - **Lay the Gangway**
### Surface Identity, Secure Pairing, Roles, Capability Projection, and Presence

Build:

- Crossdeck domain foundation;
- surface identity/session model;
- Wayfarer AccountSession binding;
- pairing QR/short-code protocol;
- secure one-time challenges;
- active surface registry;
- surface roles;
- Sextant capability projection seam;
- presence/lifecycle;
- simple devices UI;
- revocation propagation;
- Device Lab D0/D1 pairing scenarios.

**Gate:** one person can securely pair desktop and phone into the same Voyage without duplicate identity or progression; removing/revoking the surface works.

## Phase 2 - **Keep One Deck**
### Synchronization, Focus, Interaction Custody, Reconnect, and Manual Handoff

Build:

- realtime sync transport abstraction;
- presentation routing;
- focus/custody model;
- mirror/companion modes;
- manual `Send to...`;
- object continuity;
- map/note/artifact baseline handoffs;
- idempotency/order/conflict handling;
- reconnect and stale-surface recovery;
- shared display baseline;
- D0-D2 scenarios.

**Gate:** manual cross-surface handoff is reliable, fast, understandable, and does not mutate story truth unless explicitly routed through One Voyage.

## Phase 3 - **Pass the Chart**
### Air Handoff, Fluid Transfer UX, Gesture Evidence, Haptics, and Accessibility

Build:

- Watchglass gesture evidence contract/adapters where available;
- Air Handoff state machine;
- open-palm/fist/release grammar;
- source object latch;
- receiver claim;
- multi-target ambiguity UX;
- exact send-time/receiver attribution;
- Lanternwake transfer presentation;
- Sextant haptics/proximity integration;
- manual and keyboard parity;- false-positive qualification;
- D2-D4 real camera/device tests.

If Watchglass production gesture recognition is not ready, Phase 3 may ship the protocol/UI with a governed provider/simulator plus manual production path; it may not falsely claim camera-gesture production support.

**Gate:** real-device Air Handoff works on certified configurations, manual paths are equal citizens, and no accidental gesture can silently move sensitive content.

## Phase 4 - **Work the Whole Deck**
### Parallax, Storytide, Chronicle Lens, Crew Displays, and Rich Surface Choreography

Build:

- Parallax physical-digital artifact handoff;
- Chronicle Lens role orchestration;
- Storytide preferred-surface authoring;
- Landfall chart continuity;
- Watchglass richer integration;
- Figurehead presence projections where available;
- shared crew-display patterns;
- cross-person handoff foundations with explicit consent/policy;
- surface-aware fallback authoring;
- Drydock validation contracts.

**Gate:** a complete authored Chronicle moment can fluidly use desktop + phone + spatial artifact without duplicating truth or trapping the Player when a surface disappears.

## Phase 5 - **Weather the Passage**
### Offline, Lifecycle, Security, Privacy, Operations, and Scale

Build/harden:

- weak-network behavior;
- offline/reconnect reconciliation;
- background/lock/sleep;
- transport failover;
- abuse/rate control;
- sensitive-content policies;
- operational diagnostics;
- surface fanout/scalability;
- privacy retention;
- security review;
- thermal/battery adaptation;
- cross-platform compatibility.

**Gate:** Crossdeck survives real interruptions, revocation, stale devices, and hostile/ambiguous conditions without split-brain state or privacy leakage.

## Phase 6 - **Make the Crossing Invisible**
### Device Lab, Field Qualification, UX Polish, Accessibility, Performance, and Program Closure

Complete:

- D0-D5 Device Lab matrix;
- real iOS/Android/desktop combinations;
- real Air Handoff field trials;
- surface pairing owner walkthrough;
- latency/performance tuning;
- motion/haptic polish;
- reduced-motion/accessibility acceptance;
- security/privacy final review;
- documentation/operations;
- closure receipt.

**Gate:** ordinary Players can pair, move, receive, recover, and continue without needing explanation; owner walkthrough confirms that the system feels fluid rather than “multi-device software.”

# 65. Final Acceptance Criteria

Project Crossdeck is complete only when all applicable criteria are satisfied.

## Identity and security

- One person remains one Wayfarer identity across surfaces.
- Crossdeck does not create a second account/session authority.
- Pairing is scoped, expiring, replay-resistant, and revocable.
- Wayfarer session revocation propagates promptly.
- Cross-account and cross-Voyage claims fail closed.

## Surface experience

- Desktop + phone pairing is understandable without documentation.
- Surface roles are visible enough to explain behavior but do not clutter the Chronicle.
- The Player can move eligible content through at least one obvious manual method.
- Focus/custody/mirror semantics remain coherent.
- A disconnected secondary surface never blocks the entire Voyage indefinitely.

## Air Handoff

- Grab/release interaction is physically understandable.
- Gesture recognition is provider-governed and confidence-bearing.
- Handoff records exact source, target, object, request time, target claim, release, commit, and acknowledgment.
- Ambiguous receivers do not silently win.
- False-positive rates meet field qualification thresholds.
- Manual/accessibility paths are always available.
- Sensitive content gets stronger confirmation policy where appropriate.

## Integration

- Parallax object identity survives surface handoff.
- Landfall chart context survives surface handoff.
- Storytide can choreograph surfaces without hard-coded devices.
- Watchglass may abstain without breaking transfer.
- Sextant provides device capability without Crossdeck duplicating hardware providers.
- One Voyage remains the only progression authority.
- Wakebook remains the archive authority.

## Failure and recovery

- network loss before/after commit behaves deterministically;
- duplicate messages are idempotent;
- source/destination loss has defined recovery;
- lock/background/sleep are safe;
- stale devices are not targeted;
- revocation races fail safe;
- no split-brain exclusive custody remains unresolved.

## Accessibility

- all mandatory transfer experiences work without camera gestures;
- keyboard/screen-reader/reduced-motion paths pass;
- timing windows are human-tolerant;
- visual/haptic/audio cues have equivalents.

## Verification

- Device Lab D0-D5 evidence is distinctly classified;
- real gesture claims require real-device proof;
- browser/native matrix is current;
- security/privacy testing passes;
- performance/latency budgets are measured, not guessed;
- ordinary phase acceptance runs through Sounding Line and protected main;
- final owner walkthrough confirms the system feels **fluid, intuitive, and effortless**.

# Appendix A. Surface Role Catalog

## PRIMARY_STORY

Large/main narrative surface. Usually desktop/laptop but not hard-coded.

## CHRONICLE_LENS

Handheld spatial/perceptual surface. Commonly phone.

## CHART

Persistent map/chart surface.

## JOURNAL

Reading-focused narrative surface.

## ARTIFACT_VIEWER

High-detail interactive artifact presentation.

## SHARED_CREW_DISPLAY

Crew-visible read-mostly shared surface.

## AMBIENT

Atmospheric/passive presentation.

## CAPTAIN_AUXILIARY

Captain-specific secondary control/presentation surface where authorized.

## ACCESSIBILITY_COMPANION

Surface used to provide alternate input/output without changing person identity.

# Appendix B. Handoff Capability and Policy Matrix

| Object family | Default personal handoff | Mirror allowed | Cross-person allowed | Strong confirmation |
|---|---|---|---|---|
| Map/chart | Yes | Yes | Story policy | No |
| Public/crew note | Yes | Yes | Yes with visibility | Sometimes |
| Private note | Yes | Personal only | No by default | Yes |
| Artifact viewer | Yes | Yes | Story policy | No |
| Artifact ownership | Not a Crossdeck action | N/A | Owner service only | Yes |
| Chronicle Lens spatial artifact | Yes via Parallax | Contextual | Story policy | Contextual |
| Captain control | Restricted | No | No | Yes |
| Memory capture | Personal | Preview only | Explicit sharing only | Yes |

# Appendix C. Air Handoff Interaction Timing

These values are starting qualification ranges, not immutable truths.

- arm/palm stability: approximately 250-600 ms;
- grab confirmation: approximately 150-400 ms after stable fist classification;
- Handoff Intent TTL: likely several seconds, tuned through field trial;
- receiver claim must occur before intent expiry;
- local visual acknowledgment target: <= 100 ms from accepted semantic gesture;
- target-ready indicator target: <= 250 ms healthy conditions;
- ordinary perceived completion target: sub-second healthy conditions;
- network-delayed commit must retain an honest pending state rather than fake completion.

# Appendix D. Air Handoff Failure and Recovery Copy

**No receiver found**

> **Still holding it**  
> Bring your hand near a paired device, or choose a device below.

**Several devices available**

> **Where should this go?**

**Receiver went away**

> **That device disappeared**  
> The item stayed here.

**Network delay**

> **Passing it over...**

**Transfer failed**

> **It came back**  
> Try again or choose a device manually.

**Gesture unavailable**

> **Air Handoff isn't available here**  
> Use `Send to...` instead.

**Private-content confirmation**

> **Send this private note to your phone?**

# Appendix E. Security Checklist

- [ ] Pairing challenge short-lived.
- [ ] Pairing challenge single-use.
- [ ] Person/account verified through Wayfarer.
- [ ] Exact Voyage binding where required.
- [ ] Surface session cannot outlive source AccountSession authority.
- [ ] Surface enumeration restricted.
- [ ] Handoff intent binds exact object/version.
- [ ] Receiver claim binds exact surface.
- [ ] Commit rechecks current visibility/authorization.
- [ ] Handoff replay rejected/idempotent.
- [ ] Stale gesture evidence rejected.
- [ ] Raw camera frames not retained by default.
- [ ] Session revocation closes sensitive surface state.
- [ ] Shared display uses sanitized projection.
- [ ] Private notes cannot auto-route to shared display.
- [ ] Cross-person transfer requires explicit visibility/consent policy.
- [ ] Diagnostics omit credentials/tokens/raw secrets.

# Appendix F. Canonical Scenario Narratives

## F1. Desktop Journal -> phone map

Player reads clue on desktop. Storytide suggests opening chart on phone. Crossdeck discovers paired phone, offers one-tap handoff. Phone opens same Landfall map context. Desktop Journal stays open. No progression change.

## F2. Air Handoff map

Map is active on desktop. Open palm arms. Fist grabs. Object visually latches. Player moves hand toward phone. Phone claims pending handoff. Player opens palm. Crossdeck commits `MOVE_CUSTODY`; phone receives map. Source settles to compact `Map on phone` state.

## F3. Parallax desk artifact -> desktop

Player finds AR chart on phone and places it on desk. They choose `Open on desktop`. Crossdeck mirrors content context onto desktop while Parallax remains spatial truth for the desk instance. Both representations share artifact identity.

## F4. Two possible receivers

Player has phone and tablet paired. Both are active. Fist grab occurs. Crossdeck cannot safely infer target. Both display a subtle ready indicator; source shows two target chips. Player releases near phone; phone claims first and wins. Tablet clears readiness.

## F5. Receiver disconnects after claim

Phone claims handoff, then loses network before release. Crossdeck detects target loss; source object remains latched for a short recovery window, then returns to source with `That device disappeared` copy. No object vanishes.

## F6. Cross-person crew pass

A shared crew clue is eligible for transfer to another Player. Recipient phone is identified and explicitly accepts. Crossdeck moves interaction presentation. If Storytide defines the pass as a completion condition, One Voyage validates the evidence separately.

## F7. Gesture unavailable

Watchglass abstains or camera permission denied. `Air Handoff` affordance disappears/clarifies unavailability. `Send to...` remains fully functional. Chronicle completion is unaffected.

## F8. Session revoked

Phone session is revoked from Personal Harbor while paired. Crossdeck invalidates surface session, removes private content, cancels pending handoffs, and desktop receives a quiet `Phone disconnected` state.

# Appendix G. Event Vocabulary

Canonical Crossdeck event families should remain semantically stable across transport implementations.

## Surface lifecycle

`SURFACE_DISCOVERED`  
`SURFACE_PAIRING_STARTED`  
`SURFACE_PAIRED`  
`SURFACE_ROLE_CHANGED`  
`SURFACE_ACTIVE`  
`SURFACE_BACKGROUND`  
`SURFACE_LOCKED`  
`SURFACE_DISCONNECTED`  
`SURFACE_RECONNECTED`  
`SURFACE_REVOKED`

## Focus/custody

`PRESENTATION_FOCUS_CHANGED`  
`INTERACTION_CUSTODY_REQUESTED`  
`INTERACTION_CUSTODY_GRANTED`  
`INTERACTION_CUSTODY_RELEASED`  
`MIRROR_STARTED`  
`MIRROR_STOPPED`

## Handoff

`HANDOFF_ARMED`  
`HANDOFF_GRAB_DETECTED`  
`HANDOFF_INTENT_OPENED`  
`HANDOFF_TARGET_CANDIDATE`  
`HANDOFF_TARGET_CLAIMED`  
`HANDOFF_RELEASE_DETECTED`  
`HANDOFF_COMMIT_REQUESTED`  
`HANDOFF_COMMITTED`  
`HANDOFF_DESTINATION_ACKNOWLEDGED`  
`HANDOFF_CANCELLED`  
`HANDOFF_EXPIRED`  
`HANDOFF_FAILED`

# Appendix H. Glossary

**Air Handoff** - Crossdeck's optional grab/carry/release camera-gesture transfer experience.

**Custody** - right of one surface to drive a specific interactive representation; not artifact/person ownership.

**Handoff** - governed transfer of focus, custody, presentation, or context between surfaces.

**Mirror** - additional synchronized view without moving exclusive control.

**Pairing** - secure creation of a surface participation relationship, using Wayfarer identity rather than a new Crossdeck account.

**Surface** - active endpoint participating in a person's Voyage experience.

**Surface Session** - short-lived binding between a surface, person, account session, Voyage, capabilities, role, and transport.

**Surface Role** - intended presentation/interaction purpose of a surface.

# References

This governing baseline is derived from and must remain compatible with:

1. Voyagewright Spatial Experience Architecture v1.0.
2. Project Sextant v1.0 - Device Context and Hardware Capability System.
3. Project Parallax v1.0 - Spatial Chronicle and Augmented Reality System.
4. Project Wayfarer / Homeport canonical account and `AccountSession` architecture.
5. Project One Voyage canonical progression/session authority.
6. Project Watchglass visual-perception ownership and safe-abstention architecture.
7. Project Storytide narrative-experience architecture as it is formalized.
8. Project Landfall physical/virtual Worldspace and Living Chart architecture.
9. Project Wakebook personal archive and Chronicle Passport architecture.
10. Project Sounding Line current repository-wide verification authority and Voyagewright Device Lab ownership.
11. Huawei Support, HarmonyOS 5 gesture file transfer: sender presents open palm, closes fist to grab, moves toward receiver, and opens palm to release. This is an interaction precedent only; Crossdeck has no Huawei technical dependency.
12. Huawei Device+ / Super Device multi-device collaboration guidance as a precedent for simple device discovery and task continuation, not as a protocol dependency.

Platform APIs and gesture-recognition libraries change over time. Crossdeck implementation must verify current supported web/native capabilities at implementation time rather than treating vendor behavior observed in 2026 as permanent truth.

# Final Governing Rule

> **Crossdeck succeeds when the Player stops thinking about devices.**
>
> One person may use many surfaces. Those surfaces may specialize, synchronize, mirror, receive, and hand experiences to one another. The Player may tap a device, drag toward it, choose it from a list, or literally grab a Chronicle object with their hand and release it at another screen.
>
> Underneath that ease, Crossdeck must know exactly who acted, what moved, when the request began, which surface was the intended receiver, what authority was required, whether the transfer committed, and how to recover if reality behaved like reality.
>
> **The interaction should feel like passing an object. The architecture should behave like a disciplined distributed system.**

---

**End of Project Crossdeck v1.0**