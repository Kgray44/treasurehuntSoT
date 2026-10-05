---
title: "Project Watchglass Spatial Perception Integration Amendment"
subtitle: "Vision Waypoints, Spatial Relocalization, Scene Semantics, Privacy Screening, and Parallax Evidence Contracts"
author: "Voyagewright Engineering"
date: "October 5, 2026"
version: "1.0"
status: "Scope-Limited Governing Integration Amendment"
document_id: "VW-WATCHGLASS-SPATIAL-AMD-1.0"
repository: "Kgray44/treasurehuntSoT"
repository_baseline: "038356b754ea44ea0b4cc97bf63274780277df85"
---

# PROJECT WATCHGLASS

## Spatial Perception Integration Amendment v1.0

### Vision Waypoints, Spatial Relocalization, Scene Semantics, Privacy Screening, and Parallax Evidence Contracts

> **Governing Principle**  
> Watchglass may tell Voyagewright what the camera can responsibly recognize, localize, classify, or refuse to claim. It does not decide where an AR object exists, what a Worldspace means, which device presents the experience, or whether a Chronicle advances. In spatial experiences, perception is evidence, never spatial or progression sovereignty.

Current protected `main` still classifies general Watchglass capability as planned/not validated. Landfall contains limited authored-view appearance comparison that must remain accepted compatibility truth until Watchglass provides a certified replacement. This amendment therefore freezes the future spatial-perception boundary without falsely claiming Watchglass implementation.

The repository does not currently index the full historical Watchglass Part I/Part II governing PDFs. This document is a scope-limited integration amendment to the accepted Watchglass governing/design history and the Voyagewright Spatial Experience Architecture. It must be incorporated into any future canonical Watchglass governing publication.

---

# 1. Authority and Scope

This amendment is authoritative for:

- the relationship between Watchglass Vision Waypoints and the Parallax Spatial Library;
- visual relocalization and scene-semantic evidence used by Parallax;
- Watchglass evidence used by Landfall for contextual/place verification;
- Sextant device/camera context consumed by Watchglass;
- Crossdeck camera/gesture use where governed;
- privacy-screening evidence for Parallax field calibration;
- evidence confidence, abstention, freshness, pose uncertainty, and certification boundaries;
- Device Lab spatial-perception scenario obligations.

It is not a full Watchglass program roadmap and does not authorize general object-recognition implementation by itself.

---

# 2. Watchglass Fundamental Question

Watchglass answers:

> **What does the available visual evidence support, how strongly, from what viewpoint, and when should the system abstain?**

Examples:

- “This appears to be the old harbor statue with accepted confidence.”
- “This facade matches the Creator's locked reference within an accepted pose volume.”
- “A horizontal desk-like surface is visually present.”
- “A person is visible in the candidate calibration frame; automatic upload is forbidden.”
- “The image is too dark / occluded / out-of-distribution; abstain.”

Watchglass does not answer:

- “Place the note 40 cm to the right.” — Parallax.
- “The Player is inside the correct geofence.” — Landfall.
- “Use the phone instead of desktop.” — Crossdeck.
- “This completes Chapter 5.” — One Voyage after governed completion logic.

---

# 3. Vision Waypoint Library and Spatial Library Are Siblings

The Watchglass Vision Waypoint Library and Parallax Spatial Library MUST remain separate.

## 3.1 Vision Waypoint Library

Defines reusable recognition/evidence targets:

- landmark;
- object;
- facade;
- game-screen state;
- planar image/reference;
- region or visual condition;
- trained/specialized detector target;
- temporal visual state.

It answers:

> **What should Voyagewright recognize or verify?**

## 3.2 Spatial Library

Defines reusable spatial presentation/interactions:

- note;
- map;
- apparition;
- footprints;
- portal;
- hidden writing;
- adaptive room scene;
- interaction/placement recipe.

It answers:

> **What should Voyagewright place, reveal, animate, or let the Player interact with in space?**

## 3.3 Typed links

A Parallax Spatial Definition may reference an exact immutable Vision Waypoint version:

```text
visionReference:
  waypointId: old-harbor-statue
  version: 2.1
  usage: VISUAL_RELOCALIZATION
```

The inverse UI may show:

> Used by 4 Spatial Experiences

but the libraries do not merge.

---

# 4. Visual Relocalization for Parallax

Parallax may ask Watchglass to help answer:

> Is the camera looking at the same real-world landmark/surface region that a calibrated spatial anchor expects?

Watchglass can return a bounded receipt:

```text
WatchglassRelocalizationEvidence
  visionWaypointVersion
  observedAt
  cameraPoseEstimate?
  poseUncertainty?
  featureMatchQuality
  classificationConfidence
  oodState
  accepted: true|false
  abstained: true|false
  evidenceExpiry
```

Parallax consumes this as evidence in its anchor-resolution process.

Watchglass does not create or persist the Parallax anchor.

## 4.1 Pose uncertainty is mandatory when pose matters

If a Spatial Entity must appear against a specific facade feature, recognition alone may be insufficient.

Where technically supported, Watchglass should distinguish:

- object identity confidence;
- camera pose confidence;
- local feature geometry confidence;
- accepted pose volume.

Parallax can then decide whether placement is stable enough.

---

# 5. Semantic Scene Evidence

Parallax adaptive staging may benefit from Watchglass scene semantics.

Candidate evidence classes:

- `SURFACE_DESK_LIKE`;
- `SURFACE_TABLE_LIKE`;
- `SURFACE_WALL_STONE`;
- `SURFACE_WALL_BRICK`;
- `REGION_DOORWAY`;
- `OBJECT_CHAIR`;
- `OBJECT_LARGE_FURNITURE`;
- `PERSON_PRESENT`;
- `FACE_PRESENT`;
- `MIRROR_OR_REFLECTION_RISK`;
- `VISUAL_LANDMARK_MATCH`.

These are evidence claims, not Parallax placement decisions.

## 5.1 Unknown is valid

Watchglass may return:

```text
surfaceClass: UNKNOWN
confidence: LOW
abstained: true
```

Parallax must have fallback behavior.

---

# 6. Privacy-Safe Calibration Screening

Parallax's automatic field-calibration evidence has a hard rule: a frame containing a detected person or face must not be uploaded.

Watchglass may provide the on-device screening capability.

## 6.1 Screening contract

Candidate frame pipeline:

```text
frame captured locally
     ↓
Watchglass person/face/privacy screening
     ↓
possible person/face?
   YES → discard locally
   NO  → continue minimization
     ↓
Parallax contextual crop
     ↓
explicit Player consent
     ↓
Sealed Hold protected upload
```

## 6.2 Fail closed

Uncertainty about whether a human is present should default to rejection for automatic calibration evidence.

The platform can wait for another frame. The Creator does not need a photograph containing a stranger merely because computer vision felt optimistic.

## 6.3 Screening is not identity recognition

The privacy check asks:

> Is a person/face potentially present?

It does not require identifying who that person is.

No face-recognition identity system is authorized by this amendment.

---

# 7. Player Memory Photography Is a Separate Domain

A Player intentionally capturing a private Chronicle Memory may include people because it is explicit user photography.

Watchglass may offer optional composition aids or safety checks, but the person-free automatic-calibration rule MUST NOT be misapplied to personal Memories.

Wakebook governs the archive.

Parallax governs AR composition.

Harborlight governs any later public projection/consent.

---

# 8. Landfall Context Fusion

Landfall may provide Watchglass contextual priors such as:

- expected region;
- expected landmark class;
- expected target bearing;
- safe approximate current place;
- virtual Worldspace context;
- authored visual reference eligibility.

This can narrow the perception problem.

Example:

```text
Landfall:
  Player is inside Lighthouse Overlook region
  expected facade bearing 309° ± 25°

Watchglass:
  facade reference recognized
  pose accepted

Landfall:
  combined evidence supports the authored place condition
```

Landfall context is a prior, not permission for Watchglass to hallucinate a match.

---

# 9. Current Landfall Visual Compatibility Seam

Current Landfall Phase 3 includes limited region-gated authored-view appearance comparison and independent exact-object observation.

That behavior is accepted source truth.

Until Watchglass implementation reaches accepted mainline capability:

- current Landfall visual evidence may remain;
- Parallax MUST NOT assume general Watchglass availability;
- Drydock should treat Watchglass dependencies as unavailable/not configured unless explicitly satisfied;
- the future migration should compare Watchglass evidence with accepted Landfall behavior before retirement.

No “Watchglass owns vision now, delete old code” cleanup is authorized without parity proof.

---

# 10. Sextant Integration

Watchglass consumes Sextant capability/context, including:

- camera availability;
- camera lifecycle;
- device orientation where relevant;
- thermal/power degradation;
- foreground/background/lock state;
- motion stability if useful for capture guidance;
- haptic availability for scan feedback.

Watchglass does not duplicate generic device capability detection.

## 10.1 Capture quality

Sextant may tell Watchglass:

> device thermal state high; preferred camera processing tier reduced.

Watchglass decides how to adjust its perception pipeline while preserving certification limits.

---

# 11. Parallax Integration

Watchglass may contribute:

- visual-anchor recognition;
- scene semantic classification;
- visual relocalization;
- privacy screening;
- object discovery verification;
- expected-view alignment;
- pose estimate/uncertainty;
- occlusion/visibility hints where governed.

Parallax owns:

- spatial anchor identity;
- world/local transforms;
- placement;
- adaptive staging;
- shared spatial scene;
- rendering;
- interaction geometry;
- relocalization decision;
- spatial recovery.

## 11.1 No render-by-recognition

A Watchglass match does not automatically spawn an object.

It supplies evidence to a Parallax resolution contract.

---

# 12. Crossdeck Integration

Watchglass may support camera-mediated Crossdeck interaction such as:

- palm/fist/release gesture evidence;
- hand-track continuity;
- QR/pairing recognition;
- receiver framing;
- camera scene confidence.

Crossdeck owns handoff state, pairing, target claims, and synchronization.

Watchglass may abstain.

Manual/touch/keyboard handoff must remain available where required.

---

# 13. Storytide Integration

Storytide may author a requirement such as:

> Look through the Lens until the old crest is found.

Watchglass provides the evidence.

Storytide determines:

- narrative copy;
- retry guidance;
- hint tone;
- alternative clue;
- whether evidence is mandatory;
- what happens after One Voyage confirms completion.

Watchglass must not embed story progression rules in the detector.

---

# 14. Figurehead Integration

Figurehead characters may appear in spatial scenes, but Watchglass MUST NOT automatically identify real people as Figurehead identities unless a separate explicit privacy/security architecture ever authorizes such behavior.

Potential safe uses:

- verify a Figurehead-rendered virtual character is framed in a composed screenshot;
- support scene occlusion/placement around spatial characters;
- track authored non-person visual markers.

Real-person biometric identification is outside this amendment.

---

# 15. Evidence Envelope

Spatial consumers need a normalized evidence contract.

Representative fields:

```text
WatchglassEvidenceReceipt
  receiptId
  sourceType
  visionWaypointVersion?
  observationType
  observedAt
  expiresAt
  confidence
  calibrationProfile
  oodState
  poseEstimate?
  poseUncertainty?
  viewpointClass?
  evidenceClass
  abstained
  reasonCode?
  privacyClass
  providerBuildId
  idempotencyKey
```

## 15.1 Evidence expiry

Visual evidence used for live spatial placement/completion must expire according to the interaction's risk and expected scene stability.

A frame matched 20 minutes ago is not proof that the Player is still looking at the statue.

---

# 16. Abstention Contract

Watchglass must retain the governing principle:

> **Never confidently and silently wrong.**

Spatial consumers MUST support:

- `ACCEPTED`;
- `REJECTED`;
- `ABSTAINED_UNCERTAIN`;
- `OUT_OF_DISTRIBUTION`;
- `INSUFFICIENT_VIEW`;
- `CAPTURE_UNAVAILABLE`;
- `PROVIDER_NOT_CONFIGURED`;
- `EXPIRED`.

Do not squeeze every state into Boolean `recognized`.

---

# 17. Shared Spatial Reality and Watchglass

In a shared Parallax scene, individual devices may observe different camera views.

Those observations can help resolve or corroborate the same shared anchor.

Watchglass must not independently create per-device spatial truth.

Example:

```text
Player A: strong visual landmark match
Player B: weak/occluded match
Shared anchor authority: Parallax
```

Player B may use the already-authoritative shared scene and local relocalization policy without inventing a second object location.

---

# 18. Remote Authoring and Field Calibration

Watchglass supports remote authoring primarily by helping classify the real environment after a Player arrives.

Potential evidence:

- wall/table/doorway class;
- landmark reference;
- feature/pose geometry;
- person-free candidate frame;
- visual quality score.

The Creator's adjustment remains Parallax spatial calibration, not Watchglass model training unless the Vision Waypoint workflow explicitly calls for new evidence/versioning.

---

# 19. Vision Waypoint Versioning

Spatial definitions must pin exact Vision Waypoint versions when perception behavior matters.

Published Chronicle:

```text
SpatialDefinition 4.2
  uses VisionWaypoint lighthouse-facade 3.1
```

Updating the Vision Waypoint to 3.2 does not mutate the already-published Spatial Definition/Chronicle.

A draft may adopt the new version after revalidation.

---

# 20. AI-Assisted Parallax Authoring

Parallax AI may suggest:

> This spatial anchor could use an existing Vision Waypoint for stronger relocalization.

It may search compatible Creator-owned Vision Waypoints and propose a typed link.

It MUST NOT silently train/modify a Watchglass model as a side effect of spatial authoring.

Model/evidence changes follow Watchglass authoring/versioning rules.

---

# 21. Performance and Thermal Coordination

Watchglass can be computationally expensive.

Sextant thermal/power context and Parallax frame budget should inform processing tiers.

Possible policy:

- full visual localization during initial anchor acquisition;
- reduced-frequency verification after stable anchor;
- pause heavy recognition while screen is not actively scanning;
- degrade effects before degrading evidence below certification threshold;
- fall back rather than silently run uncertified low-quality inference.

---

# 22. Accessibility

Visual recognition cannot be the only mandatory path for a general-audience Chronicle unless an accessible alternative is explicitly provided.

Alternatives may include:

- Landfall location evidence;
- text clue;
- manual selection;
- Captain confirmation;
- non-camera interaction;
- exact reveal after bounded assistance.

Watchglass scanning guidance must support screen-reader-compatible status, non-color feedback, and reasonable physical-motion requirements.

---

# 23. Security Threats

Spatial Watchglass integrations must consider:

- replayed old camera evidence;
- synthetic/generated image attacks;
- screen replay attacks for game-screen recognition;
- cross-Voyage evidence reuse;
- malicious Vision Waypoint package;
- model/package tampering;
- privacy frame exfiltration;
- false person-negative used to upload calibration evidence;
- forged provider/test evidence;
- untrusted community recognition assets;
- pose-spoofing or printed-target attacks where risk matters.

Higher-risk automatic progression may require stronger evidence or human/Captain review.

---

# 24. Drydock Integration

Drydock should validate:

- referenced Vision Waypoint version exists;
- provider/certification supports intended use;
- general-audience mandatory step has fallback;
- abstention path exists;
- evidence freshness is configured;
- spatial definition does not confuse recognition with anchor ownership;
- privacy calibration uses person-screening policy;
- target environment assumptions are declared;
- community dependency is version-pinned.

Drydock simulations may inject Watchglass outcomes without pretending they are real inference qualification.

---

# 25. Voyagewright Device Lab

Watchglass registers spatial-perception scenario families with the Sounding Line-governed Device Lab.

Required examples:

- bright/dim lighting;
- occlusion;
- motion blur;
- incorrect viewing angle;
- expected landmark present/absent;
- OOD scene;
- person enters calibration frame;
- face appears in reflection;
- camera denied;
- thermal degradation;
- shared scene with one strong and one weak viewpoint;
- Parallax relocalization after tracking loss;
- Crossdeck handoff gesture with ambiguous hand state.

Device Lab execution proves software integration at the applicable tier. Watchglass certification requires its own locked corpora/real-device/field evidence as governed.

---

# 26. Diagnostics

Diagnostics should answer:

- What Vision Waypoint/version was requested?
- Which provider/model build ran?
- Was the input in-distribution?
- What confidence/pose uncertainty applied?
- Did Watchglass accept, reject, or abstain?
- Was evidence expired?
- Was privacy screening applied?
- Which consumer used the receipt?
- Did Parallax use it for anchor resolution?
- Did Landfall use it for place context?
- Did One Voyage receive any completion proposal?

Do not log raw frames by default.

---

# 27. Current-Status Honesty

Until accepted Watchglass implementation exists on `main`:

- Watchglass remains `PLANNED / NOT_CONFIGURED` for general use;
- Parallax definitions requiring Watchglass must be treated as future/constrained;
- Landfall's accepted limited visual seam remains separate;
- no feature catalog entry may claim general recognition because this amendment exists;
- simulation of Watchglass receipts is not production capability.

Documentation is not a neural network. Regrettably.

---

# 28. Acceptance Criteria

Spatial-perception integration is accepted when:

1. Vision Waypoint Library and Spatial Library remain separate.
2. typed immutable references connect them.
3. Parallax can consume visual relocalization/scene-semantic evidence without ceding anchor ownership.
4. Landfall can consume perception evidence without ceding world/navigation ownership.
5. Watchglass can abstain at every spatial consumer boundary.
6. privacy calibration screening fails closed on person/face uncertainty.
7. Player Memory photography remains a separate explicit domain.
8. Sextant supplies generic device/camera lifecycle context.
9. Crossdeck gesture use has manual fallback.
10. evidence receipts carry freshness, confidence, OOD, provenance, and pose uncertainty where relevant.
11. published dependencies are version-pinned.
12. Drydock validates spatial-perception dependencies/fallbacks.
13. Device Lab has spatial-perception scenario packs.
14. no current Landfall accepted behavior is removed before Watchglass parity proof.
15. no amendment claim is treated as implemented Watchglass capability.

---

# Appendix A. Sibling Library Contract

```text
VISION WAYPOINT LIBRARY
"What should be recognized?"
          │
          │ exact version reference
          ▼
PARALLAX SPATIAL LIBRARY
"What should exist in space?"
```

A Creator can connect them. Neither becomes the other.

---

# Appendix B. Canonical Relocalization Example

A Creator remotely calibrates a note on a museum stone wall:

1. Parallax stores the calibrated spatial recipe.
2. The recipe references `VisionWaypoint:entrance-stonework@1.4`.
3. A later Player arrives.
4. Landfall says the Player is within the museum entrance region.
5. Sextant reports camera active and device stable.
6. Watchglass evaluates the camera image.
7. Watchglass either returns accepted pose-aware visual evidence or abstains.
8. Parallax resolves the note anchor from the evidence plus its spatial recipe.
9. If Watchglass abstains, Parallax uses a lower-confidence semantic/fallback placement or Storytide guided mode.
10. One Voyage remains untouched until the actual authored completion condition is satisfied.

---

# Final Governing Rule

> **Watchglass sees; Parallax places.**  
> Watchglass may strengthen spatial experiences with recognition, scene semantics, pose evidence, and privacy screening, but uncertainty must remain visible and ownership must remain clean. A camera match is evidence about the world, not permission to invent spatial or Chronicle truth.

**End of Project Watchglass Spatial Perception Integration Amendment v1.0**