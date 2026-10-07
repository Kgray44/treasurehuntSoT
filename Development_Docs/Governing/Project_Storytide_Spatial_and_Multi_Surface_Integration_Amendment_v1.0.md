---
title: "Project Storytide Spatial and Multi-Surface Integration Amendment"
subtitle: "Spatial Moments, Chronicle Lens Choreography, Surface-Aware Narrative Presentation, and Fallback Semantics"
author: "Voyagewright Engineering"
date: "October 5, 2026"
version: "1.0"
status: "Scope-Limited Governing Integration Amendment"
document_id: "VW-STORYTIDE-SPATIAL-AMD-1.0"
repository: "Kgray44/treasurehuntSoT"
repository_baseline: "038356b754ea44ea0b4cc97bf63274780277df85"
---

# PROJECT STORYTIDE

## Spatial and Multi-Surface Integration Amendment v1.0

### Spatial Moments, Chronicle Lens Choreography, Surface-Aware Narrative Presentation, and Fallback Semantics

> **Governing Principle**  
> Storytide owns what a spatial or multi-surface interaction means in the Chronicle. It does not own the sensor, the map, the AR anchor, the camera inference, the paired device, or the progression engine. Storytide composes those capabilities into narrative moments and makes their fallbacks feel like part of the same story.

This is a **scope-limited governing integration amendment**. Current protected `main` contains Storytide concept/design authority but no canonical full Project Storytide governing document indexed in the repository. This amendment therefore freezes only Storytide's spatial and multi-surface integration contract. It does not pretend to be the complete Storytide constitution and does not, by itself, authorize Storytide implementation.

When a full Storytide governing baseline is created, it MUST absorb or explicitly supersede the requirements in this amendment.

---

# 1. Authority and Scope

This document is subordinate to:

1. Voyagewright Global Product Governance Standard.
2. Voyagewright Spatial Experience Architecture v1.0.
3. Project Sextant v1.0 for device context.
4. Project Parallax v1.0 for spatial/AR truth.
5. Project Crossdeck v1.0 for multi-surface truth.
6. Project Landfall v1.0/v1.1 plus v1.2 boundary amendment for world/navigation truth.
7. Project Watchglass governing/design authority for perception.
8. Project Figurehead governing/design authority for people/presence.
9. Project Wakebook authority for private archive/memory.
10. Project One Voyage for progression.
11. Project Drydock for Chronicle validation.
12. Project Sounding Line for software verification.

This amendment is authoritative for:

- the `Spatial Moment` narrative concept;
- Storytide-to-Parallax attachment semantics;
- Storytide-to-Crossdeck surface choreography;
- Chronicle Lens invocation language and narrative transitions;
- narrative use of Sextant, Landfall, Watchglass, and Figurehead context;
- shared versus private moment semantics;
- discovery-assistance narrative styling;
- spatial/multi-surface fallback choreography;
- One Voyage completion-proposal boundaries;
- Creator Studio lightweight spatial references inside the main Chronicle authoring flow.

---

# 2. Storytide's Fundamental Question

Storytide answers:

> **What is happening in the Chronicle, what should the Player experience next, and why does this interaction matter?**

Examples:

- Sextant knows the Player rotated three times.
- Storytide knows that rotation is the ritual that “awakens the compass.”

- Landfall knows the Player reached the lighthouse region.
- Storytide knows that arrival means the lost signal may now be revealed.

- Parallax knows a map is anchored on a real desk.
- Storytide knows the map is the Captain's chart and that inspecting a specific mark should move the narrative forward.

- Crossdeck knows phone and desktop are paired.
- Storytide knows the cinematic belongs on desktop while the compass interaction belongs on the phone.

- Watchglass recognizes the statue.
- Storytide knows the statue is the witness named in the clue.

This distinction is permanent.

---

# 3. Spatial Moment

A **Spatial Moment** is Storytide's narrative wrapper around one or more spatial/device/surface capabilities.

Representative model:

```text
StorytideSpatialMoment
  momentId
  storyBlockId / narrativeNodeId
  parallaxDefinitionVersion?
  landfallContextRequirement?
  sextantCapabilityRequirements[]
  watchglassEvidenceRequirement?
  crossdeckPresentationPolicy?
  figureheadPresenceReferences[]
  visibilityScope
  discoveryPolicy
  completionPolicy
  fallbackPolicy
  accessibilityPolicy
  replayPolicy
```

Storytide owns the relationship between the moment and the story.

It does not embed Parallax's full scene definition.

## 3.1 Lightweight reference, deep editor elsewhere

The main Chronicle editor should show a compact reference such as:

```text
Spatial Moment
Experience: Captain's Lost Map v2.1
When: Chapter 4 / after Journal reveal
Sharing: Crew shared
Preferred surface: Chronicle Lens
Completion: Map inspected
Fallback: Guided map clue

[Open in Parallax Spatial Studio]
```

The giant Parallax configuration does **not** belong in the ordinary Storytide block inspector.

That is a deliberate usability rule.

---

# 4. Spatial Definition Pinning

Published Storytide content MUST reference an exact immutable Parallax spatial-definition version.

A published Chronicle cannot silently change because a reusable Spatial Library item was later edited.

Draft flow may offer:

> Spatial Experience update available `2.1 → 3.0`

The Creator deliberately accepts the update and Drydock revalidates the affected narrative graph.

---

# 5. Chronicle Lens as Narrative Instrument

Storytide owns **when and why** the Player is invited to use the Chronicle Lens.

Parallax owns the spatial Lens runtime.

Crossdeck owns which surface fulfills the Lens role.

A Storytide beat might present:

> **Use the Chronicle Lens.**  
> Something crossed this path before you.

rather than:

> Open AR mode.

The narrative layer should preserve the fiction while remaining clear enough that the Player knows what physical action is expected.

## 5.1 Lens entry

Storytide may define:

- invitation copy;
- transition tone;
- urgency;
- whether entry is automatic or explicit;
- whether the Lens is required or optional;
- the fallback presented when Lens capability is unavailable.

Lanternwake may own the transition animation language where applicable.

## 5.2 Lens exit

The Chronicle should return the Player to a coherent Storytide state after the spatial moment.

No “close camera and somehow land on a random tab” behavior.

---

# 6. Multi-Surface Narrative Choreography

Storytide expresses **surface intent**, not device identity.

Examples:

```text
Main cinematic     -> PRIMARY_STORY
Compass ritual     -> CHRONICLE_LENS
Large shared chart -> SHARED_CREW_DISPLAY preferred
Private reflection -> PERSONAL_HANDHELD preferred
Fallback           -> SAME_SURFACE
```

Crossdeck resolves the actual available surfaces.

Storytide MUST NOT author:

- `iPhone 17 Pro`;
- `second monitor`;
- `Chrome tab 2`;
- hard-coded local network device IDs.

## 6.1 Surface response contract

Crossdeck should return something equivalent to:

```text
SurfaceResolution
  preferredRoleSatisfied
  selectedSurfaceId?
  fallbackRole?
  reason
  capabilities
  privacyClass
```

Storytide then selects the correct narrative presentation.

---

# 7. One Player, One Narrative, Many Surfaces

The Player should not experience separate copies of the Chronicle.

Storytide state remains one narrative state projected across several surfaces.

Example:

```text
Desktop Journal reveals a sealed chart
       ↓
Phone receives Chronicle Lens invitation
       ↓
Player finds AR map
       ↓
Desktop Journal updates after canonical progression
```

The phone is not running an independent Chapter 4.

---

# 8. Sextant Integration

Storytide may reference semantic device interactions such as:

- face a bearing;
- hold steady;
- rotate N turns;
- tilt downward;
- magnetic anomaly rises;
- relative elevation changed;
- device moved through a configured gesture arc.

Storytide MUST NOT directly consume raw sensor streams.

It should consume typed semantic evidence through a governed completion/provider contract.

## 8.1 Example: spin ritual

```text
Sextant
  ROTATION_ACCUMULATED: 1087°
  gesture: THREE_FULL_TURNS
  confidence: HIGH
        ↓
Storytide
  ritual condition satisfied
        ↓
One Voyage
  commit canonical transition
```

The dramatic compass animation belongs to Storytide/Parallax/Lanternwake presentation, not the sensor provider.

---

# 9. Landfall Integration

Storytide may use Landfall context for:

- entering/leaving a region;
- following a route;
- discovering a place;
- reaching broad or exact location context;
- expected bearing;
- safe physical/virtual Worldspace context;
- Chart state changes;
- location-aware narrative pacing.

Storytide does not calculate geofence geometry or route matching.

## 9.1 Physical and virtual symmetry

The story should be able to say:

> Reach the old lighthouse.

whether “lighthouse” belongs to:

- a real town Worldspace;
- a virtual Sea of Thieves Worldspace.

Landfall handles the coordinate universe.

Storytide handles the meaning.

---

# 10. Parallax Integration

Storytide determines:

- why the spatial scene appears;
- which scene version is attached;
- which story state activates it;
- which story state hides/changes it;
- whether discovery is required;
- whether interaction counts toward completion;
- narrative copy before/after;
- hint tone;
- fallback narrative.

Parallax determines:

- where the object actually appears;
- anchor resolution;
- adaptive staging;
- rendering;
- tracking;
- shared spatial reality;
- interaction geometry;
- relocalization/recovery.

## 10.1 Story-authorized movement

If a spatial object intentionally moves because the story changes, Storytide may issue a new spatial-state command/definition state.

Parallax performs the actual spatial transition.

The object must not move simply because one device reconsidered its anchor.

---

# 11. Watchglass Integration

Storytide may author a visual requirement such as:

> Verify that the Player is looking at the old harbor statue.

Watchglass owns recognition and uncertainty.

Storytide owns the narrative response to:

- recognized;
- not recognized;
- abstained/uncertain;
- unavailable camera;
- timeout;
- Player choosing fallback.

## 11.1 Abstention is a story state, not an error page

A safe narrative response might be:

> The Lens cannot make out the mark from here. Move closer, or use the written clue.

not:

> Vision provider returned confidence 0.42.

---

# 12. Figurehead Integration

Storytide owns character role and narrative behavior.

Figurehead owns character visual identity/state.

Parallax owns where that character is spatially presented.

Example:

```text
Storytide:
  Captain's ghost waits at the doorway
  expression: solemn
  gaze target: lighthouse

Figurehead:
  appearance version + expression/pose semantics

Parallax:
  doorway anchor + scale + occlusion + spatial audio position
```

Storytide must not hard-code mesh/renderer details.

---

# 13. Shared vs Personal Narrative State

Spatial placement, discovery, interaction, and progression are separate axes.

A Storytide moment MUST explicitly define the intended scope.

Examples:

## Shared placement + shared discovery

Once one crew member finds the chest, it is revealed to the crew.

## Shared placement + personal observation

Every Player sees the same chest location, but each must personally inspect a symbol.

## Shared placement + personal hint

The object is shared, but accessibility or anti-frustration hints are individualized.

## Personal spatial effect

A private reflection or secret Player-specific apparition may be `PERSONAL` if authored intentionally.

Storytide does not let placement scope default accidentally from UI state.

---

# 14. Discovery Assistance Narrative Styling

Parallax owns the mandatory Discovery Assistance mechanism.

Storytide owns how help fits the fiction.

The same escalation may be styled as:

- compass pull;
- whispered voice;
- spreading ink;
- lantern flicker;
- Journal marginalia;
- direct accessible direction.

The Creator may choose style and pacing within governed bounds.

The Creator may not remove the final recovery path from required progression.

## 14.1 Storytide must not punish the Player for tracking failure

If Parallax reports low anchor confidence or scene failure, Storytide should move to a recovery/fallback narrative rather than implying the Player “searched wrong.”

---

# 15. Physical-Digital Artifact Narrative Semantics

A Parallax artifact may transition among:

- world-placed;
- handheld;
- pinned UI;
- another Crossdeck surface;
- archived Memory.

Storytide owns the narrative significance of those states.

Example:

> Take the Captain's Chart.

may map to a Parallax `PICK_UP` interaction.

> Lay it where you can study it.

may enable a `PLACE_ON_HORIZONTAL_SURFACE` interaction.

> Mark Crook's Hollow.

may create a story-relevant inspection/selection condition.

One Voyage records only the authored canonical consequences.

---

# 16. Narrative Fallback Architecture

Every capability-dependent moment needs a fallback that preserves narrative continuity.

Representative ladder:

```text
Preferred: world-tracked AR search
   ↓
Fallback: simplified camera overlay
   ↓
Fallback: 2D guided illustration/map
   ↓
Fallback: written/logic clue
   ↓
Governed Captain confirmation / exact reveal
```

Storytide owns the transition copy and pacing between these modes.

Fallback must not feel like the Chronicle crashed and exposed an engineering console.

---

# 17. Accessibility

Storytide MUST treat accessible alternatives as first-class authored experiences.

Examples:

- “spin three times” has a button/gesture-free alternative;
- directional haptics also have text/visual direction;
- spatial audio clues have visible equivalents;
- hidden writing has readable text alternative after governed reveal;
- camera-dependent moments have non-camera fallback where the Chronicle audience is general;
- reduced-motion mode does not require rapid viewpoint movement;
- timing windows accommodate slower physical interaction.

The story may preserve atmosphere while changing interaction mechanics.

---

# 18. Offline and Reconnect

Storytide must distinguish:

- presentation can continue locally;
- evidence pending canonical reconciliation;
- progression confirmed;
- progression not yet confirmed.

If a phone performs a spatial interaction offline, Storytide may show a bounded pending state but must not fabricate authoritative progression.

Crossdeck and Parallax handle their own reconnect mechanics; One Voyage resolves canonical state.

---

# 19. Replay

Replaying a Spatial Moment is presentation-only unless the authored Chronicle explicitly defines a replayable interactive mechanic.

A Player revisiting an AR reveal from Wakebook must not accidentally re-trigger Chapter completion.

Storytide replay contracts must include:

- canonical state source;
- progression-mutation prohibition;
- privacy-safe content visibility;
- current capability fallback.

---

# 20. Creator Studio Main-Graph Experience

The Storytide/Creator graph should remain readable.

Recommended block behavior:

```text
[Spatial Moment]
Name: The Captain's Lost Map
Experience: Desk Map v2.1
Surface: Chronicle Lens preferred
Activation: after clue 4
Completion: inspect ink mark
Fallback: Guided Chart
```

Button:

> **Edit spatial experience in Parallax →**

Do not put:

- anchor matrices;
- surface normals;
- occlusion policy;
- scene hierarchy;
- AR lighting;
- 3D material controls;
- device provider diagnostics;

inside the normal Storytide settings sidebar.

The main graph should show story semantics, not an entire game engine folded into 340 pixels.

---

# 21. Spatial Library Reuse from Storytide

Storytide may attach:

- Chronicle-only spatial definitions;
- reusable My Spatial Library definitions;
- installed Harborlight spatial content.

The Storytide block records exact version identity.

Creators should be able to duplicate/fork a reusable moment into a Chronicle-specific variant without mutating the library original.

---

# 22. Surface Choreography Examples

## 22.1 Virtual game Chronicle

```text
Desktop:
  chapter text + game companion + cinematic

Phone:
  Chronicle Lens map/compass

Story beat:
  Player discovers map in room
  ↓
  marks island
  ↓
  desktop Journal turns page
```

## 22.2 Outdoor expedition

```text
Phone:
  primary Storytide presentation
  Living Chart
  Chronicle Lens

Desktop:
  not required
```

The same Chronicle architecture can choose different presentation profiles.

## 22.3 Shared room

```text
TV/tablet:
  shared crew display

Phones:
  personal Lens/hints

Shared AR object:
  one Parallax anchor
```

Storytide defines which information is private versus crew-visible.

---

# 23. Presentation Profiles

Storytide SHOULD support high-level presentation profiles such as:

- `MOBILE_EXPEDITION`;
- `DESKTOP_IMMERSIVE`;
- `MULTI_SURFACE_IMMERSIVE`;
- `RESPONSIVE_GENERAL`;
- future `XR_IMMERSIVE`.

These are presentation strategies, not separate Chronicle engines.

The same canonical story state survives across them.

---

# 24. Privacy

Storytide should know enough to avoid revealing private content on the wrong surface.

Examples:

- private Player clue -> personal surface only;
- crew clue -> shared display permitted;
- Reflection -> never mirrored to shared display by default;
- spatial calibration evidence -> never story content;
- private Memory image -> Wakebook owner-private unless explicitly shared.

Crossdeck enforces surface authorization; Storytide declares narrative visibility intent.

---

# 25. Security

Storytide spatial integration must guard against:

- forged spatial interaction receipts;
- stale scene versions;
- wrong-Voyage scene evidence;
- cross-person private clue leakage;
- replaying completion evidence;
- surface spoofing;
- capability downgrade used to bypass a challenge without governed fallback;
- unsafe Creator-authored custom scripts.

Storytide must remain data/configuration-driven and must not introduce arbitrary executable code in spatial definitions.

---

# 26. Drydock Validation Requirements

Drydock must eventually validate Storytide spatial/multi-surface authoring for:

- pinned Parallax version exists;
- activation state is reachable;
- required capability has fallback;
- preferred Crossdeck role has fallback;
- visibility scope is compatible with surface policy;
- shared/personal discovery semantics are explicit;
- mandatory search has Discovery Assistance;
- accessible alternative exists;
- replay cannot mutate progression;
- completion receipt type matches provider contract;
- Watchglass abstention path exists;
- virtual/physical Worldspace requirements are coherent;
- private Memory/calibration state is not exposed as story content.

---

# 27. Canonical Event Boundary

Storytide may consume events/receipts such as:

```text
LANDFALL_REGION_ENTERED
PARALLAX_ENTITY_DISCOVERED
PARALLAX_ENTITY_INSPECTED
SEXTANT_GESTURE_COMPLETED
WATCHGLASS_EVIDENCE_ACCEPTED
CROSSDECK_SURFACE_AVAILABLE
CROSSDECK_HANDOFF_COMMITTED
```

Storytide may emit a completion proposal.

Only One Voyage commits authoritative progression.

---

# 28. Diagnostics

Creator/player diagnostics should distinguish:

- story activation problem;
- Parallax spatial problem;
- Crossdeck surface problem;
- Sextant capability problem;
- Landfall world-context problem;
- Watchglass perception uncertainty;
- One Voyage progression rejection.

Do not report everything as `Spatial Moment failed`.

---

# 29. Implementation Boundary

This amendment does not authorize a Storytide implementation branch by itself.

Before Storytide implementation begins, a full Project Storytide governing baseline must freeze:

- complete Living Chronicle experience architecture;
- chapter/narrative flow;
- Journal relationship;
- artifacts/notes/clues integration;
- Captain interaction;
- mobile/desktop composition;
- transition/presentation system;
- phase roadmap.

That baseline MUST include this amendment rather than rediscover spatial integration from scratch.

---

# 30. Acceptance Criteria

Storytide spatial/multi-surface integration is acceptable when:

1. Spatial Moments are first-class narrative constructs.
2. Parallax definitions are immutable/version-pinned.
3. main Creator graph uses lightweight references, not the full AR inspector.
4. Crossdeck receives surface intent, not hard-coded device identity.
5. Sextant evidence is semantic and confidence-aware.
6. Landfall world context is consumed without duplicating map logic.
7. Watchglass uncertainty/abstention is handled narratively and safely.
8. Figurehead identity/presence remains separately owned.
9. shared versus personal placement/discovery/interaction semantics are explicit.
10. Discovery Assistance can be styled but not disabled for mandatory progress.
11. accessibility alternatives are story-coherent.
12. fallback preserves narrative continuity.
13. replay does not mutate progression.
14. One Voyage remains sole authoritative progression writer.
15. Drydock can validate the complete cross-project dependency chain.

---

# Appendix A. Storytide Ownership Matrix

| Concern | Owner | Storytide responsibility |
|---|---|---|
| narrative meaning | Storytide | owner |
| spatial entity/anchor | Parallax | attach/use |
| device context | Sextant | request semantic capability/evidence |
| world/navigation | Landfall | request context |
| perception | Watchglass | request evidence, handle abstention |
| surface pairing/routing | Crossdeck | declare preferred roles |
| character appearance | Figurehead | declare narrative pose/expression intent |
| archive | Wakebook | offer Memory opportunity/context |
| progression | One Voyage | propose completion only |
| validation | Drydock | expose typed definitions |

---

# Appendix B. Canonical Example: The Captain's Chart

1. Storytide activates `SpatialMoment: captain-chart` after a desktop Journal reveal.
2. Crossdeck sees a paired phone capable of `CHRONICLE_LENS`.
3. Storytide presents “Use the Chronicle Lens.”
4. Parallax resolves the pinned `Desk Map` scene in the room.
5. Sextant provides device pose/lifecycle context.
6. Landfall provides the relevant virtual Sea of Thieves chart context.
7. Player finds the map, picks it up, and places it on a desk.
8. Storytide instructs the Player to inspect the ink mark.
9. Parallax emits `ENTITY_INSPECTED` with pinned scene/anchor identity.
10. Storytide's completion provider validates the authored condition.
11. One Voyage commits progression.
12. Desktop Journal updates.
13. Player optionally saves a Memory; Wakebook archives it privately.

The Player experiences one adventure. The architecture quietly refuses to become soup.

---

# Final Governing Rule

> **Storytide tells the story.**  
> It may ask the world, the device, the camera, the room, and the Player's other surfaces to participate, but it never steals their truth. Spatial and multi-surface technology must deepen the Chronicle's meaning while remaining replaceable, fallible, accessible, and subordinate to one authoritative Voyage.

**End of Project Storytide Spatial and Multi-Surface Integration Amendment v1.0**