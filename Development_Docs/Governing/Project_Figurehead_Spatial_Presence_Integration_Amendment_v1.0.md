---
title: "Project Figurehead Spatial Presence Integration Amendment"
subtitle: "Spatial Characters, Shared Presence, Parallax Placement, Crossdeck Projection, and Storytide Character Semantics"
author: "Voyagewright Engineering"
date: "October 5, 2026"
version: "1.0"
status: "Scope-Limited Governing Integration Amendment"
document_id: "VW-FIGUREHEAD-SPATIAL-AMD-1.0"
repository: "Kgray44/treasurehuntSoT"
repository_baseline: "038356b754ea44ea0b4cc97bf63274780277df85"
---

# PROJECT FIGUREHEAD

## Spatial Presence Integration Amendment v1.0

### Spatial Characters, Shared Presence, Parallax Placement, Crossdeck Projection, and Storytide Character Semantics

> **Governing Principle**  
> Figurehead owns who a represented character is and how that character is visually expressed. Parallax owns where that representation exists in space. Crossdeck owns which authorized surface displays it. Storytide owns why the character is there and what it means. No one project gets to turn “put the ghost on the bench” into a second identity, spatial, or progression engine.

Current protected `main` explicitly records that Figurehead is intentionally not implemented. Existing Helm/Muster work uses safe initials/profile placeholders and reserves future integration points. This amendment therefore freezes the future spatial-presence contract without claiming implementation or replacing the still-needed full Figurehead governing baseline.

---

# 1. Authority and Scope

This document is a scope-limited spatial integration authority derived from:

- Voyagewright Spatial Experience Architecture v1.0;
- Project Parallax v1.0;
- Project Crossdeck v1.0;
- accepted Figurehead design history describing persistent visual identity, SVG/Pixi rendering, poses, expressions, historical appearances, and crew presence;
- current Helm/Muster records that explicitly exclude Figurehead implementation.

It governs:

- the boundary between Figurehead character truth and Parallax spatial truth;
- how Storytide requests spatial character behavior;
- how Crossdeck projects character representation to different surfaces;
- how shared spatial character presence remains consistent across a crew;
- performance/accessibility fallbacks for spatial characters;
- privacy and identity constraints;
- future Device Lab and Drydock integration.

It does not define the complete Figurehead character-creation system, renderer implementation, customization catalog, or implementation phases.

---

# 2. Figurehead Fundamental Question

Figurehead answers:

> **Who is this represented character, and what canonical visual identity/state should represent them right now?**

A Figurehead state may include:

- canonical character/person reference;
- appearance version;
- body/proportion representation;
- clothing/outfit state;
- pose;
- expression;
- gaze intent;
- historical appearance;
- animation set;
- renderer compatibility tier;
- accessibility description.

Figurehead does not own:

- AR anchor;
- room position;
- geospatial location;
- device pose;
- surface pairing;
- story progression;
- real-person camera recognition.

---

# 3. Spatial Character Instance

Parallax needs a narrow Figurehead reference rather than copying Figurehead state into the spatial scene.

Representative contract:

```text
SpatialCharacterInstance
  instanceId
  figureheadCharacterId
  figureheadAppearanceVersion
  poseId
  expressionId
  animationSetId?
  narrativeStateRef?
  parallaxAnchorRef
  sharedSceneId?
  presentationTier
  accessibilityLabel
```

## 3.1 Figurehead payload

Figurehead owns:

- identity;
- appearance version;
- pose semantic;
- expression semantic;
- outfit/historical appearance;
- character animation definitions;
- canonical visual fallback.

## 3.2 Parallax payload

Parallax owns:

- anchor;
- transform/scale;
- world orientation;
- occlusion;
- collision/interaction volume;
- lighting integration;
- shared spatial scene identity;
- spatial audio source position;
- resolved gaze target position.

---

# 4. Storytide Character Semantics

Storytide may author:

> The old Captain is sitting on the bench, watching the lighthouse.

Storytide determines:

- character narrative role;
- appearance state requested by story;
- pose/expression intent;
- dialogue/subtitle/audio timing;
- gaze target meaning;
- reveal timing;
- disappearance/transition;
- completion consequences.

Figurehead resolves the requested character representation.

Parallax resolves where the character sits and how it occupies space.

One Voyage remains progression authority.

---

# 5. Shared Spatial Character Reality

If a Figurehead character is part of a shared Parallax scene, every crew member should perceive the same logical character at the same authoritative spatial anchor.

The following may vary per surface:

- rendering quality;
- LOD/detail;
- shadow complexity;
- animation interpolation;
- accessibility overlay;
- personal captions.

The following MUST NOT independently vary unless explicitly authored:

- character identity;
- shared anchor;
- canonical pose/expression state;
- narrative visibility;
- story-relevant gaze target;
- story-relevant interaction state.

One crew should not see the Captain seated while another phone renders him standing inside a wall because its renderer had ideas.

---

# 6. Crossdeck Projection

Crossdeck may choose which surface presents a Figurehead representation.

Examples:

- desktop renders full crew character scene;
- phone shows compact portrait or Chronicle Lens spatial character;
- shared display shows crew-safe representations;
- private phone displays a personal character reaction hidden from shared display.

Crossdeck owns surface placement/visibility transport.

Figurehead owns character appearance.

Parallax owns 3D spatial placement when the representation inhabits space.

---

# 7. Chronicle Lens Character Presence

A character seen through the Chronicle Lens may be:

- fully world-anchored;
- partially transparent apparition;
- doorway/bench/table presence;
- virtual guide;
- historical echo;
- environment-reactive character.

Parallax renders the spatial relationship.

Figurehead provides representation assets/state.

Storytide controls narrative timing.

Lanternwake may govern supporting transition/motion language outside the spatial renderer.

---

# 8. Gaze and Attention

Gaze is both character semantics and spatial resolution.

Storytide may request:

```text
FigureheadGazeIntent:
  target: LANDMARK lighthouse
```

Landfall may resolve the relevant world landmark.

Parallax resolves a spatial target vector/point.

Figurehead selects the visual gaze/head/body response.

This preserves ownership while enabling experiences like:

> The ghost looks toward the real wall containing the hidden clue.

---

# 9. Landfall Integration

Figurehead characters may be associated with Landfall place context, such as:

- appears only at Lighthouse Overlook;
- follows the Player's virtual-world route context;
- faces an authored physical landmark;
- appears at a discovered place.

Landfall supplies place/world context.

Parallax supplies the actual spatial anchor.

Figurehead does not create maps, geofences, or route state.

---

# 10. Sextant Integration

Figurehead should generally not consume raw device sensors.

Where device context affects character presentation:

- device orientation may support view-relative UI;
- thermal/performance state may select a lower rendering tier;
- haptics may accompany character interactions through Storytide/Parallax;
- lifecycle state may pause animation safely.

Sextant supplies semantic device context.

Figurehead owns only character-side adaptation.

---

# 11. Watchglass Boundary

This amendment does NOT authorize real-person face recognition to identify Figurehead characters or Players.

Watchglass may support:

- environmental occlusion/context;
- authored landmark confirmation near a spatial character;
- privacy screening for calibration frames;
- future non-biometric visual interaction evidence.

A camera seeing a human does not imply permission to map that human to a Figurehead identity.

---

# 12. Historical Appearances in Spatial Scenes

Figurehead design history includes historical appearance states.

Spatial experiences may therefore reference an exact historical appearance version.

Example:

```text
character: Captain Elias
appearanceVersion: "before-the-storm@1.2"
pose: seated
expression: warm
```

Published Chronicles must pin the appearance version so later customization does not rewrite history.

---

# 13. Crew Figureheads vs Narrative Characters

Figurehead may represent both:

- actual Voyage participants;
- authored fictional/historical characters.

The runtime must distinguish these categories because privacy and ownership differ.

## 13.1 Participant representation

Must respect:

- Wayfarer identity/privacy preferences;
- current allowed appearance version;
- crew visibility;
- sharing consent;
- personal customization boundaries.

## 13.2 Authored narrative character

May be packaged with the Chronicle/Sealed Hold/Harborlight according to licensing and content rules.

No actual person account is required.

---

# 14. Muster Integration

Current Helm Muster intentionally uses initials/profile placeholders.

Future Figurehead implementation may upgrade those slots.

The upgrade MUST preserve:

- existing Captain/self/readiness/presence semantics;
- keyboard/screen-reader labels;
- responsive layout;
- reduced-motion behavior;
- crew synchronization;
- privacy-safe display names;
- fallback to existing profile/initial representation.

Muster must remain useful if Figurehead rendering fails or is unsupported.

---

# 15. Rendering Tiers

Figurehead's earlier design intent includes authoritative SVG plus richer PixiJS-style rendering.

Spatial presence should preserve a tiered model.

Possible tiers:

## Tier F0 — semantic/text fallback

Character name, role, description.

## Tier F1 — static canonical SVG/2D representation

Low cost; suitable for constrained surfaces.

## Tier F2 — animated 2D/Pixi representation

Richer expression/pose.

## Tier F3 — spatial/3D or advanced composited presence

Where Project Figurehead later governs such implementation.

Parallax must not require the richest tier for story correctness unless a constrained-audience Chronicle explicitly declares it.

---

# 16. Spatial Scale and Representation

Parallax owns scene scale, but Figurehead should expose intended canonical body scale/representation constraints.

Examples:

- life-size apparition;
- miniature tabletop figure;
- portrait bust;
- stylized silhouette;
- floating face/portrait motif.

Storytide chooses the narrative form.

Figurehead provides compatible representation assets.

Parallax positions them safely.

---

# 17. Interaction

Spatial character interactions may include:

- approach;
- inspect;
- listen;
- choose dialogue response;
- hand over artifact;
- follow gaze;
- stand in a marked position;
- shared crew interaction.

Parallax owns spatial interaction geometry.

Storytide owns dialogue/narrative choice.

One Voyage owns canonical consequences.

Figurehead owns visible character reaction states.

---

# 18. Animation Ownership

Figurehead owns character animation semantics and assets.

Parallax owns spatial transforms required to keep a character anchored in the scene.

Lanternwake owns platform/cinematic transition language outside the character renderer.

Avoid double ownership such as:

- Parallax animating facial expression independently;
- Figurehead moving the world anchor to “walk” without spatial authority;
- Lanternwake mutating character state.

Character locomotion requires an explicit integration contract: Figurehead provides gait/animation; Parallax controls spatial path/anchor movement; Storytide determines why movement occurs.

---

# 19. Accessibility

Essential character information must not exist only through:

- facial expression;
- body pose;
- gaze;
- spatial position;
- audio dialogue.

Provide appropriate alternatives such as:

- captions;
- character state text;
- screen-reader descriptions;
- directional descriptions;
- reduced-motion alternatives;
- non-spatial interaction path.

Example:

> **Captain Elias looks toward the lighthouse.**

may be exposed textually when gaze is story-relevant.

---

# 20. Privacy

Participant Figureheads can be emotionally personal.

The system must respect:

- owner-only customization;
- crew/public visibility settings;
- historical appearance pinning;
- consent for archival/public sharing;
- no unauthorized export of participant representations;
- no inference of appearance from camera imagery without explicit future governance.

Private spatial scenes do not automatically become public Figurehead galleries because Harborlight exists.

---

# 21. Security

Threats include:

- substituting another person's Figurehead identity;
- tampering with appearance package/version;
- cross-Voyage character injection;
- malicious community character assets;
- shader/asset denial-of-service;
- leaking private participant appearance history;
- forged expression/pose state used as story evidence;
- stale character state on shared surfaces.

Published/imported character content must use existing Sealed Hold/Harborlight integrity boundaries.

---

# 22. Wakebook Integration

Wakebook may preserve memories containing Figurehead representations.

Historical Memory must identify enough semantic/version context to remain meaningful after the current Figurehead appearance changes.

Example metadata:

```text
figureheadReferences:
  - characterId
    appearanceVersion
    narrativeRole
```

Wakebook owns archive retention.

Figurehead does not rewrite historical Memory images.

---

# 23. Harborlight Integration

Future shareable Figurehead content may include:

- outfit packs;
- pose/expression packs;
- authored fictional characters;
- animation sets;
- spatial-character scene presets.

Harborlight governs publication/licensing/moderation.

Wayfarer-owned personal appearances require stricter privacy and may not be distributed as generic content without explicit consent.

---

# 24. Sealed Hold Integration

Protected character assets may include:

- private personalized appearance components;
- unpublished narrative characters;
- licensed/private textures;
- historical private appearances;
- Creator-only character variants.

Use Sealed Hold rather than placing sensitive assets in public static directories.

---

# 25. Drydock Validation

Drydock should eventually validate:

- Figurehead character/version reference exists;
- requested pose/expression exists;
- Parallax spatial character has valid anchor/fallback;
- shared character state uses crew-shared scene correctly;
- private participant representation is not routed to public/shared surface incorrectly;
- accessibility description exists for essential pose/gaze information;
- rendering tier has fallback;
- character dependencies are version-pinned;
- story completion does not rely on unverified client-only expression state.

---

# 26. Device Lab Scenarios

Figurehead/Parallax/Crossdeck scenario families should include:

- same shared character on two phones;
- different rendering quality tiers with same semantic state;
- late-joining surface sees current character state;
- device reconnect restores same spatial anchor/pose;
- low-performance fallback to SVG/2D;
- reduced-motion character presentation;
- shared display excludes private participant representation;
- Figurehead unavailable -> safe placeholder remains;
- character gaze target derived from Landfall/Parallax context;
- spatial audio/dialogue fallback.

Sounding Line Device Lab owns execution/evidence classification.

---

# 27. Implementation Honesty

At the date of this amendment:

> **Figurehead is not implemented.**

Current placeholders are not deficiencies merely because this amendment now exists.

Future Feature Catalog status must remain planned/unimplemented until actual accepted Figurehead source lands.

This document prevents future ownership confusion; it does not summon a character renderer by paperwork.

---

# 28. Acceptance Criteria

Figurehead spatial-presence integration is acceptable when:

1. Figurehead owns canonical character identity/appearance/state.
2. Parallax owns spatial placement and shared anchor.
3. Storytide owns narrative intent.
4. Crossdeck owns surface projection.
5. Landfall can provide place/gaze context without owning character state.
6. Watchglass does not become a biometric identity system by accident.
7. shared crew character state is consistent across surfaces.
8. lower-capability rendering preserves semantic identity.
9. current Helm/Muster placeholder path remains a valid fallback.
10. historical appearance versions are immutable/pinned.
11. accessibility exposes story-relevant pose/expression/gaze alternatives.
12. private participant representations respect Wayfarer/Wakebook/Harborlight consent boundaries.
13. Drydock can validate references/fallbacks/privacy.
14. Device Lab can prove multi-surface spatial-presence behavior.
15. no documentation claims implementation before accepted source exists.

---

# Appendix A. Ownership Example

A ghost Captain sits on a real bench:

```text
Storytide
  "Captain Elias waits here and watches the lighthouse"
       ↓
Figurehead
  appearance v3.1 / seated pose / solemn expression
       ↓
Landfall
  lighthouse place reference
       ↓
Parallax
  bench anchor / scale / gaze vector / occlusion
       ↓
Crossdeck
  phone surfaces render same shared presence
       ↓
One Voyage
  only commits progression after authored interaction
```

---

# Final Governing Rule

> **Figurehead is the person in the scene, not the scene itself.**  
> Character identity, appearance, expression, pose, and historical representation remain Figurehead truth. Spatial location remains Parallax truth. Surface placement remains Crossdeck truth. Narrative meaning remains Storytide truth. Progression remains One Voyage truth.

**End of Project Figurehead Spatial Presence Integration Amendment v1.0**