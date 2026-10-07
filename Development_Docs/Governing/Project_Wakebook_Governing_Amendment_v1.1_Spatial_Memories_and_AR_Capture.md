---
title: "Project Wakebook Governing Amendment v1.1"
subtitle: "Spatial Memories, AR Capture, Crossdeck Handoff, and Spatial-History Preservation"
author: "Voyagewright Engineering"
date: "October 5, 2026"
version: "1.1"
status: "Post-Closeout Governing Amendment"
document_id: "VW-WAKEBOOK-AMD-1.1"
repository: "Kgray44/treasurehuntSoT"
repository_baseline: "038356b754ea44ea0b4cc97bf63274780277df85"
amends: "Project Wakebook Governing Document v1.0"
---

# PROJECT WAKEBOOK v1.1 AMENDMENT

## Spatial Memories, AR Capture, Crossdeck Handoff, and Spatial-History Preservation

> **Governing Principle**  
> Wakebook preserves what a person chooses to remember about a Voyage. Parallax may create a spatial moment, Crossdeck may move the capture workflow to another surface, Landfall may provide safe place context, and Figurehead may appear in the scene, but Wakebook alone owns the durable private Memory/archive projection. Spatial technology must enrich remembrance without turning a person's room, sensor history, or calibration evidence into permanent archive data by accident.

Project Wakebook is already closed through Phases 1–6 on protected `main`, with the independent Chronicle Passport A1 increment also accepted. This amendment does **not** reopen Wakebook's completed phase program. It adds a post-closeout integration contract for future Parallax, Crossdeck, Landfall, Storytide, and Figurehead capabilities.

---

# 1. Authority and Current State

Current Wakebook mainline truth includes:

- private chronological Journey Archive;
- rich version-pinned Voyage Detail;
- private Reflection and Memory curation;
- Sealed Hold-backed private Memory media;
- participant consent for Keepsake representation;
- Timeline, People, and Statistics;
- read-only replay handoff;
- private Voyage Atlas with truthful geographic unavailability when Landfall history is absent;
- private Voyage Book;
- first-class Chronicle Passport destination from A1.

This amendment preserves all of that.

It adds authority for:

- spatial/AR Memory capture;
- clean composited image intake from Parallax;
- Crossdeck capture handoff;
- safe Landfall place context;
- Figurehead references in Memories;
- optional spatial replay metadata;
- privacy/retention boundaries separating Memory from calibration evidence;
- future Atlas/Voyage Book presentation of spatial Memories.

---

# 2. Wakebook Fundamental Question

Wakebook answers:

> **What should this person be able to remember, revisit, annotate, and privately preserve about their Voyage?**

It does not answer:

- where an AR object is anchored — Parallax;
- what device captures it — Crossdeck;
- what location means — Landfall;
- who a character visually is — Figurehead;
- what the camera recognized — Watchglass;
- what actually happened canonically — One Voyage/Wayfarer source history.

---

# 3. Spatial Memory

A **Spatial Memory** is a Wakebook Memory whose media or semantic context includes an authored spatial experience.

Representative examples:

- photograph of the Captain's map apparently lying on the Player's real desk;
- photograph of ghostly writing on a wall;
- crew photo containing a shared AR artifact;
- screenshot/capture of a virtual Worldspace chart physically placed in a room;
- saved image of a Figurehead apparition occupying a real bench;
- annotated personal note referencing the spatial clue the Player found.

Spatial Memories remain private by default.

---

# 4. Clean AR Capture Contract

Parallax should provide Wakebook a clean composited capture rather than a raw application screenshot whenever the Player invokes a Memory capture.

Desired composition:

```text
camera frame
+ authored AR entities/effects
+ approved cinematic lighting/composition
- buttons
- crosshairs
- debug overlays
- tracking diagnostics
- permission prompts
= Spatial Memory image
```

The resulting image should look like the Chronicle object genuinely existed in the moment.

## 4.1 UI screenshot fallback

If clean composition is unavailable, Wakebook may accept an ordinary screenshot only if:

- the Player explicitly captured it;
- privacy rules allow it;
- the UI clearly labels the media as a screenshot rather than a clean Chronicle Memory if that distinction matters.

---

# 5. Capture Is Explicit

Wakebook does not continuously record Parallax sessions.

A Memory capture occurs through explicit Player action or a clearly offered prompt such as:

> **Save this moment?**

An offer is not consent to capture.

The Player decides.

---

# 6. Spatial Memory Metadata

A Spatial Memory may retain bounded semantic metadata:

```text
SpatialMemoryContext
  memoryId
  ownerPersonId
  voyageRecordId
  chronicleVersionId
  spatialMomentId?
  spatialEntityIds[]
  parallaxDefinitionVersions[]
  figureheadReferences[]?
  landfallPlaceReference?
  crossdeckCaptureSurfaceClass?
  capturedAt
  authoredCaption?
  ownerCaption?
  privacyClass
  replayMetadataVersion?
```

## 6.1 Metadata minimization

Do not automatically retain:

- full room mesh;
- raw AR session map;
- continuous device pose history;
- raw sensor streams;
- Bluetooth/UWB scans;
- exact private location when a coarse label is enough;
- calibration reference imagery;
- unrelated nearby-device identifiers.

The Memory is a human record, not a forensic dump of the Player's house.

---

# 7. Calibration Evidence Is Not a Memory

This boundary is hard.

Parallax field-calibration evidence exists to improve Creator placement.

Wakebook Memories exist because the Player deliberately wants to remember something.

They have different:

- purpose;
- consent;
- audience;
- retention;
- access controls;
- privacy rules.

Automatic calibration evidence MUST NOT silently appear in Chronicle Passport.

A Player may separately choose to capture a Memory from the same scene.

---

# 8. People in Spatial Memories

Unlike automatic calibration evidence, Player-authored Memories may intentionally contain people.

This is ordinary user photography and remains private by default.

If the Memory is later used in:

- a shared Crew Memory;
- Keepsake;
- Voyage Log;
- Harborlight/public content;

then the applicable participant/media consent rules must be enforced.

Do not destroy a private Memory because a person appears in it. Also do not publish somebody because the Player once saved a private image. Miraculously, both ideas can be true.

---

# 9. Crossdeck Capture Handoff

Crossdeck may route capture to the surface best suited to the task.

Example:

```text
Desktop Wakebook Voyage Detail
       ↓
"Open Memory capture on phone"
       ↓
Crossdeck routes capture intent
       ↓
Phone opens Chronicle Lens / Parallax composition
       ↓
Player captures image
       ↓
Wakebook stores Memory
```

Wakebook remains archive authority.

Crossdeck does not become a second Memory store.

## 9.1 Capture continuity

The capture flow must retain:

- exact Voyage/record context;
- owner identity;
- intended Memory draft ID or correlation ID;
- privacy class;
- Chronicle/spatial version references.

A phone reconnect must not attach the image to the wrong Voyage.

---

# 10. Parallax Integration

Parallax may provide:

- clean image composition;
- Spatial Moment/Entity references;
- spatial definition version;
- presentation state;
- artifact identity;
- optional non-sensitive anchor class;
- optional replay semantics;
- capture diagnostics.

Parallax MUST NOT decide:

- Memory retention duration;
- owner annotations;
- Passport organization;
- public sharing;
- Keepsake consent;
- historical record mutation.

---

# 11. Landfall Integration

Landfall may supply owner-safe place context when it was intentionally retained.

Examples:

- “Lighthouse Overlook”;
- virtual Worldspace island name;
- coarse town/site label;
- journey place reference.

## 11.1 No retroactive geography invention

Current Voyage Atlas intentionally reports Map View unavailable when Landfall has not supplied accepted owner-safe historical geography.

That honesty remains governing.

Spatial Memories do not authorize Wakebook or Landfall to reconstruct missing past routes from raw logs.

## 11.2 Exact coordinates

Exact private coordinates should generally not be attached to ordinary Memory metadata unless the user explicitly needs them and policy allows it.

A meaningful place label is often enough.

---

# 12. Figurehead Integration

A Spatial Memory may contain Figurehead-rendered people/characters.

Semantic references may include:

- character ID;
- appearance version;
- narrative role;
- pose/expression if meaningful.

The archived pixels remain historical truth even if the current Figurehead changes later.

Wakebook must not re-render old Memories automatically with a person's new outfit/appearance.

History is allowed to remain history.

---

# 13. Storytide Integration

Storytide may offer a Memory opportunity after meaningful moments.

Examples:

- first major spatial artifact;
- finale scene;
- assembled map;
- meaningful shared discovery;
- rare optional find.

Prompts should be restrained.

Voyagewright should help people notice moments, not interrupt every moment by demanding documentation of it.

Storytide cannot force capture as a progression requirement for a general Chronicle without explicit privacy/accessibility governance.

---

# 14. Watchglass Integration

Watchglass may optionally support:

- composition guidance;
- scene quality warnings;
- privacy cues;
- landmark labels.

But private Player Memory capture does not require Watchglass certification unless the authored experience explicitly depends on visual verification.

Watchglass person-free calibration rules do not apply to explicit private Memory photography.

---

# 15. Spatial Replay Metadata

Wakebook may retain bounded metadata that allows a future **Revisit Moment** experience.

This is optional.

The archived image is the durable baseline.

Possible replay context:

```text
SpatialMemoryReplayContext
  parallaxDefinitionVersion
  entityStateSnapshot
  figureheadAppearanceVersions[]
  landfallWorldspaceReference?
  presentationSeed?
```

## 15.1 Not progression replay

Revisit Moment is presentation/archive behavior.

It MUST NOT:

- re-run original completion;
- grant artifacts again;
- alter TaleSession state;
- rewrite the historical Voyage record;
- claim the physical environment still matches the original room.

---

# 16. Missing Assets and Historical Stability

Wakebook must remain usable when:

- Parallax runtime version changes;
- Spatial Library item is removed from current Creator library;
- current Figurehead appearance changes;
- Watchglass package is unavailable;
- Landfall provider is offline;
- Crossdeck is not paired.

The archived Memory image and safe historical metadata should remain readable.

If an optional interactive revisit cannot run, show the Memory normally.

---

# 17. Spatial Memory Annotation

Wakebook may allow owner annotations such as:

- caption;
- note;
- arrow/circle markup;
- favorite;
- associated Reflection;
- private tags.

Prefer preserving the original capture and storing annotation separately or as a reversible derivative.

A scribbled arrow should not destroy the original image because humans occasionally regret their graphic-design decisions.

---

# 18. Shared Discovery, Personal Photographs

A shared Parallax scene may produce many personal Memories.

Example:

- Kato and Sera discover the same shared map on the same desk;
- Kato photographs it from one side;
- Sera photographs it from another;
- both Memories link to the same `SpatialMomentInstance`/shared discovery context;
- each image remains owned privately by its photographer unless shared.

Same event. Different human memory.

That is a desired feature.

---

# 19. Crew Memory

A future shared Crew Memory may aggregate multiple participants' approved media around one shared moment.

Minimum requirements:

- explicit participant/media consent;
- individual source ownership retained;
- no automatic publication;
- revocation/degradation semantics;
- no exposure of private notes/captions unless separately shared.

Wakebook owns the archive composition; Harborlight owns public projection if later published.

---

# 20. Voyage Book Integration

The private Voyage Book may include Spatial Memories when:

- the owner selects them;
- media remains available/authorized;
- print layout can represent them honestly.

If interactive/spatial semantics cannot exist on paper, captions may explain the context:

> *The Captain's chart, found through the Chronicle Lens and placed on the desk.*

The book should not attempt to print a QR code that secretly exposes private spatial media without explicit secure design.

---

# 21. Voyage Atlas Integration

Future accepted Landfall history projection may allow the private Voyage Atlas to associate Spatial Memories with safe place context.

Examples:

- physical journey place;
- virtual island/region;
- chapter location.

The current truthful `Map View unavailable` behavior remains until such projection exists and is accepted.

---

# 22. Storage and Sealed Hold

Spatial Memory media uses existing protected media architecture.

Sealed Hold governs:

- encrypted/protected storage;
- scan/integrity state;
- availability;
- withdrawal/revocation;
- private delivery.

Wakebook owns archive semantics on top of that storage.

Parallax does not invent an `ar-photos-public/` folder because the moment looked cool.

---

# 23. Public Sharing and Harborlight

This amendment does not add public sharing.

If Spatial Memories later become public Voyage Logs/Keepsakes:

- Harborlight public projection rules apply;
- EXIF/location data must be stripped/generalized;
- participant consent applies;
- private room context must be reviewed/minimized;
- spoiler rules apply;
- Creator sharing restrictions apply.

A private bedroom image deserves more caution than a generic screenshot of a menu. Revolutionary stuff.

---

# 24. Accessibility

Memory capture/edit/revisit must support:

- keyboard operation where applicable;
- screen-reader labels;
- text captions/descriptions;
- non-camera alternative for required archival interactions;
- reduced-motion revisit mode;
- zoom/reflow;
- touch targets;
- no color-only annotation meaning.

Saving a Memory should never be required to complete a Chronicle unless an accessible privacy-respecting alternate is provided.

---

# 25. Privacy and Data Minimization

Spatial Memories may reveal private environments.

The system should make privacy visible without making the experience terrifying.

Recommended defaults:

- private owner-only;
- no exact location in exported image metadata;
- no raw spatial mesh attached;
- no automatic upload until capture confirmed;
- optional crop/edit before later sharing;
- clear distinction between private Memory and public/shareable derivative.

---

# 26. Security Threats

Consider:

- another account fetching private Memory media;
- capture correlation attached to wrong owner/Voyage;
- stale Crossdeck session receiving a private capture;
- forged Parallax metadata;
- malicious image payload;
- leaked exact location metadata;
- public projection bypassing consent;
- revoked Sealed Hold asset remaining accessible;
- replay metadata loading untrusted/changed spatial assets.

Owner authorization must be checked on delivery, not merely at creation.

---

# 27. Drydock Validation

Drydock should validate authored Memory opportunities for:

- capture optional versus required;
- privacy class;
- public-share intent absent by default;
- spatial definition/version references;
- Crossdeck preferred surface fallback;
- participant consent requirements;
- accessibility alternative;
- no calibration-evidence confusion;
- no replay progression mutation.

Wakebook runtime itself remains product/archive code; Drydock validates Chronicle authoring that invokes it.

---

# 28. Device Lab Scenarios

Relevant shared Device Lab scenarios include:

- phone capture launched from desktop Wakebook;
- phone disconnect before capture;
- capture succeeds then acknowledgment lost;
- duplicate upload retry idempotency;
- private Memory remains owner-only;
- Parallax unavailable -> normal photo/note fallback;
- low battery/thermal quality reduction;
- orientation changes during capture;
- reduced-motion revisit;
- two crew members capture same shared Spatial Moment;
- Sealed Hold media unavailable/revoked.

Sounding Line owns execution/evidence tier.

---

# 29. Post-Closeout Change Model

This amendment does not create Wakebook Phase 7.

Future spatial integration should arrive as:

- narrow integration increments;
- compatibility additions;
- Parallax/Crossdeck implementation consuming Wakebook services;
- targeted Wakebook changes only where archive behavior genuinely needs extension.

The completed Phase 1–6 program remains closed.

---

# 30. Acceptance Criteria

Wakebook spatial-memory integration is accepted when:

1. Parallax can provide clean composited Memory captures.
2. capture is explicit and private by default.
3. calibration evidence never silently becomes a Memory.
4. Crossdeck can move capture workflow without creating duplicate archive truth.
5. Landfall place context is bounded and never reconstructed when absent.
6. Figurehead references preserve historical appearance/version semantics.
7. people may appear in explicit private Memories, with consent enforced for sharing.
8. archive remains readable without current Parallax/Watchglass/Crossdeck availability.
9. optional Revisit Moment cannot mutate canonical progression.
10. raw room mesh/sensor/device data is not retained by default.
11. Sealed Hold remains protected-media authority.
12. Harborlight remains public-sharing authority.
13. Voyage Book/Atlas consume only accepted owner-safe projections.
14. accessibility alternatives exist.
15. Wakebook's completed program status remains truthful and closed.

---

# Appendix A. Memory vs Calibration Matrix

| Property | Spatial Memory | Calibration Evidence |
|---|---|---|
| purpose | personal remembrance | improve Creator placement |
| initiated by | Player explicit capture | optional calibration flow |
| people allowed | yes, private capture | no automatic upload |
| archive owner | Wakebook | Parallax/Sealed Hold bounded evidence |
| default retention | durable until owner removes/archive policy | bounded/minimized |
| default visibility | owner-private | Creator-authorized calibration review only |
| public sharing | separate Harborlight flow | no |

---

# Appendix B. Canonical Capture Example

A Player finds a map through Parallax:

1. shared map is anchored on the desk;
2. Player taps **Remember this**;
3. Crossdeck selects the phone camera surface;
4. Parallax composes real camera + AR map without UI/debug overlays;
5. Player reviews and confirms capture;
6. optional Landfall safe place label is attached if allowed;
7. Figurehead references are recorded if a spatial character appears;
8. media is stored through Sealed Hold;
9. Wakebook creates the private Memory linked to the exact Voyage record;
10. another crew member may independently save their own viewpoint;
11. no public post exists unless a later explicit sharing flow is invoked.

---

# Final Governing Rule

> **The room is not the archive. The moment is.**  
> Wakebook preserves the image, meaning, and owner-safe context a person deliberately chooses to keep. Spatial meshes, raw sensor streams, calibration evidence, and cross-device machinery remain outside the Memory unless there is a clear human reason and explicit governing permission to retain them.

**End of Project Wakebook Governing Amendment v1.1**