---
title: "Project Harborlight Governing Amendment v1.1"
subtitle: "Spatial Content Distribution, Spatial Library Packages, Compatibility, Remix Lineage, Privacy, and Safe Community Projection"
author: "Voyagewright Engineering"
date: "October 7, 2026"
version: "1.1"
status: "Governing Integration Amendment"
document_id: "VW-HARBORLIGHT-AMD-1.1-SPATIAL"
repository: "Kgray44/treasurehuntSoT"
repository_baseline: "2cdb32ec504a4396092e9a0237661ee365ce9caf"
amends: "Project Harborlight Community Harbor governing baseline and accepted Phase 1-4 records"
---

# PROJECT HARBORLIGHT v1.1 AMENDMENT

## Spatial Content Distribution, Spatial Library Packages, Compatibility, Remix Lineage, Privacy, and Safe Community Projection

> **Governing Principle**  
> Harborlight may distribute spatial creativity, but it must never distribute a Player's private environment. Community spatial content is immutable, versioned, typed, dependency-aware, safety-reviewed, compatibility-declared, and revalidated by Drydock when installed into a Chronicle. Calibration evidence, room scans, private anchors, and live crew spatial state are not Community assets.

Harborlight already owns Community releases, immutable package/version identity, discovery, installation, licensing, remix lineage, moderation, scanning gates, public projections, and privacy/spoiler boundaries. This amendment adds the **spatial-content contract** required by Project Parallax and the Voyagewright Spatial Experience Architecture.

It does not create a second spatial runtime and does not claim general availability of Parallax, Sextant, Crossdeck, Watchglass, or Figurehead before those owner projects are implemented and accepted.

---

# 1. Authority and Scope

This amendment is subordinate to:

1. Voyagewright Global Product Governance Standard.
2. Voyagewright Spatial Experience Architecture v1.0.
3. Project Harborlight governing baseline and accepted Phase 1-4 records.
4. Project Parallax v1.0.
5. Project Sextant v1.0.
6. Project Crossdeck v1.0.
7. Project Drydock v1.0 plus spatial/provider amendment.
8. Project Sealed Hold protected-content/media authority.
9. Project Watchglass, Landfall, Storytide, Figurehead, and Wakebook authorities within their domains.
10. Project Sounding Line and Device Lab for software/device qualification.
11. current protected repository source.

This amendment is authoritative for:

- Community taxonomy for spatial content;
- Spatial Library package/release identity;
- compatibility and capability metadata;
- installation and exact-version pinning;
- spatial dependency resolution;
- licensing and attribution;
- remix/fork lineage;
- public search/discovery projections;
- spatial safety/privacy moderation;
- private-location restrictions;
- Sealed Hold asset and scan integration;
- Drydock verification requirements;
- preservation of historical installs.

---

# 2. Fundamental Boundary

Harborlight answers:

> **How may reusable spatial content be safely published, discovered, installed, versioned, licensed, remixed, moderated, and updated across the Voyagewright community?**

Harborlight does not answer:

- where an AR object resolves in a room - Parallax;
- what the device can sense - Sextant;
- whether the Player is at a place - Landfall;
- what the camera recognizes - Watchglass;
- which device participates - Crossdeck;
- what story state means - Storytide;
- whether the authored Chronicle is valid - Drydock;
- whether the live Voyage advances - One Voyage.

---

# 3. Spatial Community Item Taxonomy

Harborlight MAY support first-class spatial content types such as:

## 3.1 Spatial Experience / Spatial Moment preset

A reusable Parallax spatial definition or scene package, for example:

- Desk Treasure Map;
- Ghost Footprint Trail;
- Hidden Wall Message;
- Doorway Apparition;
- Shared Treasure Chest;
- Magnetic Hunt presentation;
- Historical Reveal Layer.

## 3.2 Spatial Entity pack

Reusable entities and presentation assets, such as:

- parchment notes;
- bottles;
- compasses;
- portals;
- lanterns;
- map props;
- approved spatial effects.

## 3.3 Placement recipe

Reusable semantic placement behavior, such as:

- partly hidden on horizontal surface;
- ground near furniture;
- eye-level wall;
- doorway region;
- outdoor ground/trail placement.

## 3.4 Interaction preset

Reusable interaction semantics, such as:

- pick up / carry / place;
- inspect;
- align;
- reveal;
- follow trail;
- hand off to companion surface.

## 3.5 Spatial effect pack

Reusable rendering/effect definitions whose execution remains owned by Parallax/Lanternwake as applicable.

## 3.6 Portable spatial Chronicle/template

A Chronicle or template intentionally designed for semantic room/environment requirements rather than one fixed site.

Example:

```text
requires:
  room
  floor
  table-like surface
  doorway
  wall
```

Harborlight stores/distributes the authored package. Parallax stages it at runtime.

---

# 4. What Is Not a Community Spatial Item

The following MUST NOT be published as ordinary Harborlight spatial content:

- Player calibration photographs;
- private room imagery;
- raw room meshes;
- AR session maps from a Player home;
- exact private-home anchors;
- private device pose histories;
- raw sensor logs;
- nearby-device identifiers;
- live SharedSpatialScene state;
- per-run adaptive anchor results;
- Crossdeck paired-surface credentials;
- private Wakebook Spatial Memories unless separately and explicitly published through governed sharing;
- Sealed Hold storage identifiers/keys;
- unpublished Creator calibration evidence.

The fact that data is useful for improving a spatial experience does not make it reusable Community content.

---

# 5. Immutable Spatial Release Identity

Published spatial content follows Harborlight's existing immutable release architecture.

A release should identify at minimum:

```text
SpatialCommunityRelease
  listingId
  releaseId
  semanticVersion
  packageSchemaVersion
  parallaxSchemaVersion
  minimumVoyagewrightVersion
  manifestChecksum
  packageChecksum
  author/creator identity
  licensePolicy
  attributionRecords[]
  compatibilityProfile
  dependencies[]
  publishedAt
```

Published releases never mutate in place.

A Creator updates by publishing a new release.

---

# 6. Spatial Library Integration

The Parallax Spatial Library and Harborlight Community Harbor remain separate concepts.

Parallax Spatial Library can contain:

- Chronicle-local definitions;
- Creator-private reusable items;
- installed Harborlight items;
- forked/remixed items.

Harborlight owns distribution metadata and immutable package identity.

Parallax owns runtime/editor semantics.

## 6.1 Installation

Installing a Harborlight spatial item creates a local library reference to an exact release/version.

It MUST NOT grant Harborlight runtime authority over the Player's live spatial scene.

## 6.2 Update

An available newer release may be shown as:

> `Desk Map 2.1 -> 3.0 available`

A published Chronicle remains pinned to its old exact dependency until the Creator deliberately updates and Drydock revalidates.

---

# 7. Compatibility Profile

Every spatial release MUST declare compatibility metadata sufficient for truthful discovery and validation.

Representative fields:

```text
SpatialCompatibilityProfile
  requiredParallaxVersion
  requiredCapabilityFamilies[]
  optionalCapabilityFamilies[]
  requiredWatchglassDependencies[]
  worldspaceSupport[]
  requiredSurfaceRoles[]
  deviceTierFloor
  fallbackTier
  accessibilityModes[]
  offlineRequirements
  physicalHardwareRequirements[]
  DeviceLabQualificationSummary?
```

The profile is descriptive/contractual metadata, not permission to fake support.

---

# 8. Capability Requirements

Harborlight public metadata should express capability needs in semantic terms.

Examples:

- `WORLD_TRACKED_AR`;
- `HEADING_ESTIMATE`;
- `MAGNETIC_ANOMALY`;
- `CAMERA_VIEW`;
- `MULTI_SURFACE_COMPANION`;
- `WATCHGLASS_VISUAL_RELOCALIZATION`;
- `PHYSICAL_WORLDSPACE`;
- `VIRTUAL_WORLDSPACE`.

Do not use marketing copy such as:

> Works on all phones

unless the actual compatibility policy supports that claim.

---

# 9. Fallback and Audience Declaration

A spatial release should declare one of:

- **general compatible** - required core experience has governed fallback across declared baseline;
- **enhanced spatial** - core experience works broadly, richer spatial capability optional;
- **specialized hardware experience** - specific capability/hardware is intentionally required;
- **site-specific experience** - designed for one governed physical/virtual site;
- **portable adaptive experience** - designed to stage against unknown compatible environments.

This metadata helps Creators and Players understand whether an item is appropriate before installation.

---

# 10. Fixed-Site Versus Adaptive Content

Harborlight MUST distinguish:

## Fixed-site spatial content

Bound to a public/safe governed site or virtual Worldspace.

May include:

- public landmark references;
- generalized location metadata;
- immutable visual reference packages where licensing/privacy permits.

## Adaptive portable content

Defines semantic environment requirements and placement intent without shipping a real Player environment.

Example:

> `Doorway Apparition` needs one doorway-like region and an accessible non-AR fallback.

This is the preferred model for reusable home/private-room Chronicles.

---

# 11. Location Privacy

Existing Harborlight privacy/location policy remains authoritative.

Spatial content MUST NOT expose precise private real-world locations.

Rules include:

- `PRIVATE_REAL_WORLD` has no public projection;
- private-home exact coordinates/anchors are forbidden in Community metadata;
- approximate public location must be generalized according to existing policy;
- site-specific public content must use safe public location classification;
- search/Open Graph projections use the same allowlisted public projection service;
- raw Landfall paths/routes are not automatically Community metadata.

---

# 12. Room and Environment Privacy

Public packages MUST NOT include:

- Player room photos;
- inferred room layout from a Player session;
- environment signatures derived from private calibration;
- persistent anchor maps from private spaces;
- private camera frames used for Creator calibration.

A Creator-authored synthetic/sample room asset may be published if it is owned/licensed and contains no private Player evidence.

A demo bedroom is content. A Player's bedroom is private data. Stunningly, these are not the same thing.

---

# 13. Asset Pipeline and Sealed Hold

Spatial binary/media assets MUST flow through accepted protected/community asset systems.

Harborlight may distribute safe immutable release assets only when:

- scanner/integrity requirements are satisfied;
- media/3D format validation passes;
- package hashes match;
- licensing/attribution is complete;
- unsafe/private source material is excluded;
- public derivatives contain no protected storage keys or source paths.

Sealed Hold remains protected private-media authority.

Harborlight never bypasses Sealed Hold by copying a private calibration image into a Community release directory.

---

# 14. 3D and Spatial Asset Safety

Spatial content may include 3D assets where supported.

Harborlight validation should cover applicable:

- file type allowlist;
- byte size;
- geometry complexity;
- material/texture bounds;
- embedded external reference prohibition;
- script/executable prohibition;
- texture/media scanning;
- decompression/resource abuse;
- attribution/license metadata;
- safe preview generation.

No arbitrary executable code may be shipped inside a spatial package.

---

# 15. Parallax Dependency Model

A Harborlight spatial release may depend on:

- Parallax runtime/schema version;
- other immutable spatial definitions;
- Spatial Entity packs;
- placement/interaction/effect packs;
- Watchglass Vision Waypoint releases where public/licensed;
- safe Landfall map/location packs;
- Figurehead content packages where governed;
- audio/media dependencies.

Dependencies must be explicit, versioned, compatible, and cycle-checked.

---

# 16. Vision Waypoint Dependencies

Harborlight may distribute governed Vision Waypoint packages separately from Parallax Spatial Library items.

A spatial release may reference an exact Watchglass release/version.

The two libraries MUST NOT merge into one generic “smart object” format.

Drydock validates the dependency and abstention/fallback behavior when the spatial item is used in a Chronicle.

---

# 17. Remix and Fork Lineage

Existing Harborlight remix lineage rules apply to spatial content.

A fork/remix must preserve:

- source listing/release identity;
- attribution;
- license compatibility;
- dependency lineage;
- modified/unchanged asset identity where practical;
- semantic version of the fork;
- new Drydock verification before publication.

Remixing `Ghost Footprints` into `Glowing Hoofprints` does not transfer ownership of the original Creator's 3D model or let the remix quietly drop attribution because the hooves are now purple.

---

# 18. Creator Customization and Overrides

A Harborlight Spatial Moment may expose safe parameters such as:

- style;
- asset selection;
- material variants;
- placement preference bounds;
- concealment range;
- Discovery Assistance style;
- narrative labels;
- interaction options.

Parameter schemas must be typed and bounded.

A preset must not expose internal raw platform secrets/provider settings or arbitrary executable expressions.

---

# 19. Drydock Publication Gate

Every installed/remixed spatial release used in a publishable Chronicle MUST pass Drydock in the receiving Chronicle context.

Harborlight package validation alone cannot prove:

- narrative reachability;
- fallback completeness;
- shared placement coherence;
- accessibility;
- capability compatibility;
- Discovery Assistance;
- privacy of the assembled Chronicle.

Harborlight validates the package.

Drydock validates the authored Chronicle using the package.

---

# 20. Device Lab Qualification Metadata

Harborlight MAY show bounded compatibility evidence such as:

- provider simulation qualified;
- Android emulator qualified;
- iOS Simulator qualified;
- real-device qualification available;
- field qualification available.

This information must come from trusted Device Lab/Sounding Line evidence and MUST state its tier honestly.

No Community badge called `FIELD TESTED` may be derived from an emulator run because branding departments are not allowed to redefine physics.

---

# 21. Search and Discovery

Safe public discovery metadata may include:

- title;
- short description;
- item type;
- visual theme;
- portable vs site-specific;
- supported Worldspaces;
- compatibility class;
- required capability families;
- fallback availability;
- accessibility features;
- Creator;
- license;
- safe tags;
- safe approximate public location for eligible site-specific content;
- verified qualification badges.

It MUST NOT include private room/environment data, secret Chronicle details, or precise private location.

---

# 22. Preview Experience

Community previews should communicate spatial content without pretending the viewer's environment already exists.

Possible preview forms:

- synthetic room preview;
- recorded Creator-owned demo scene;
- 3D turntable;
- interaction diagram;
- fallback preview;
- compatibility summary.

A preview must not embed another Player's private calibration image.

---

# 23. Moderation and Safety

Spatial content creates additional moderation/safety classes, including:

- dangerous physical placement;
- encouraging trespass;
- unsafe roadside/screen fixation;
- strong-magnet misuse;
- requiring unsafe spinning/motion;
- placement intended to frighten or mislead in harmful contexts;
- private-address exposure;
- discriminatory/harassing spatial content;
- malicious oversized 3D/media assets;
- packages attempting script execution.

Harborlight moderation may quarantine/remove a release without mutating historical Chronicle truth.

---

# 24. Magnet and Physical-Prop Guidance

A Community magnetic-hunt preset MUST carry safe Creator guidance.

It must not recommend:

- pressing powerful magnets directly against device cameras;
- unsafe magnet strengths/proximity;
- magnetic props near medical/sensitive equipment;
- relying on arbitrary household metal as guaranteed detection.

The spatial preset may provide the experience logic; creators remain responsible for safe physical setup within governed instructions.

---

# 25. Accessibility Metadata

Spatial releases should declare available alternatives such as:

- non-camera fallback;
- non-motion fallback;
- text equivalent;
- haptic-free mode;
- audio-free mode;
- keyboard/touch alternative;
- reduced-motion rendering;
- high-contrast mode;
- seated/reduced-mobility compatibility.

Drydock verifies the final Chronicle's required accessibility paths.

---

# 26. Installation and Historical Stability

Installing a release records exact immutable release identity.

If a listing is later:

- updated;
- quarantined;
- archived;
- removed;

historical installed/published Chronicle versions retain auditable dependency identity according to existing Harborlight policy.

Unsafe/quarantined content may become unavailable for new installs or runtime delivery according to security policy without rewriting historical records.

---

# 27. Updates

A spatial update may change:

- assets;
- placement behavior;
- interactions;
- fallback;
- compatibility;
- safety metadata;
- accessibility;
- dependencies.

Therefore updates are never silently applied to published Chronicles.

Creator drafts may evaluate/accept the update and must re-run Drydock.

---

# 28. Public Spatial Memories Are Separate

A Wakebook Spatial Memory may eventually be intentionally shared through a Voyage Log/Keepsake/public flow.

That is **not** the same as publishing a reusable Spatial Library item.

Public Memory sharing requires:

- owner intent;
- participant/media consent where applicable;
- EXIF/location stripping/generalization;
- spoiler policy;
- private-room review/minimization;
- Sealed Hold derivative/delivery rules;
- Harborlight public projection.

The public photo does not become a placement recipe.

---

# 29. Creator Calibration Evidence Is Never Harborlight Content

This is a hard invariant.

Calibration evidence may be visible to an authorized Creator through Parallax/Sealed Hold for placement refinement.

It MUST NOT:

- appear in Community search;
- be packaged in a Community release;
- become a listing preview;
- be reused as a public screenshot without a separate explicit human-authored publishing flow;
- be exposed to remixers.

---

# 30. Provider and Runtime Availability

Harborlight can publish metadata for content before every advanced runtime exists, but it must classify it truthfully.

Examples:

- `REQUIRES_PARALLAX_NOT_INSTALLED`;
- `WATCHGLASS_OPTIONAL`;
- `DEVICE_LAB_D3_QUALIFIED`;
- `FIELD_PROOF_PENDING`;
- `FALLBACK_AVAILABLE`.

The Community UI must not present planned capability as implemented merely because a governing document exists.

---

# 31. Operations and External Gates

Current Harborlight Phase 4 still retains external gates for configured live scanner/storage/MySQL/alert/deployment environments.

Spatial distribution inherits those boundaries.

A future spatial release path cannot mark binary assets clean if the configured scanner is unavailable.

`NOT_CONFIGURED` remains more trustworthy than “probably fine.”

---

# 32. Implementation Model

This amendment does not create Harborlight Phase 5.

Spatial support should arrive as ordinary mainline-safe additions to:

- item taxonomy;
- package manifests;
- compatibility metadata;
- install/update/remix services;
- search/public projections;
- moderation;
- Drydock/Sealed Hold adapters;
- Spatial Library UI integration.

All changes remain subject to current Harborlight privacy/public projection rules.

---

# 33. Acceptance Criteria

Harborlight spatial-content integration is accepted when:

1. spatial reusable content has explicit typed Community item classes;
2. immutable releases/version pinning apply;
3. Parallax Spatial Library remains separate from Harborlight distribution;
4. Vision Waypoint Library remains a sibling, not merged into spatial content;
5. private room/calibration/session data is impossible to publish through ordinary package paths;
6. compatibility/capability/fallback metadata is truthful;
7. portable adaptive and fixed-site content are distinguished;
8. private real-world locations remain excluded from public projection;
9. spatial binary/3D assets use accepted scanning/integrity/security paths;
10. licensing, attribution, dependencies, forks, and remix lineage are preserved;
11. installed/remixed content revalidates through Drydock;
12. Device Lab qualification badges preserve evidence tier;
13. spatial safety/moderation categories exist;
14. public Spatial Memories remain a separate consent/projection workflow;
15. Harborlight does not become runtime spatial authority;
16. existing external-provider gates remain honestly pending until proven.

---

# Appendix A. Spatial Community Package Sketch

```json
{
  "type": "SPATIAL_MOMENT_PRESET",
  "release": "3.0.0",
  "parallaxSchema": "1",
  "title": "Desk Treasure Map",
  "compatibility": {
    "required": ["WORLD_TRACKED_AR"],
    "fallback": "GUIDED_2D_MAP",
    "worldspaces": ["PHYSICAL", "VIRTUAL_COMPANION"],
    "sharing": ["CREW_SHARED"]
  },
  "dependencies": [],
  "assets": [],
  "license": "...",
  "attribution": []
}
```

This is illustrative. The implementation schema must be versioned and validated through the accepted Harborlight package architecture.

---

# Appendix B. Example Listing Copy

> **Desk Treasure Map**  
> Place an interactive Chronicle map on a real horizontal surface. Supports shared crew placement, pick-up/replace interaction, and Guided Map fallback.  
>
> **Compatibility:** Enhanced Spatial  
> **Requires:** Chronicle Lens / world-tracked AR for full experience  
> **Fallback:** Guided 2D Map  
> **Qualified:** Android Emulator, iOS Simulator  
> **Real-device field qualification:** not yet published

This communicates useful truth without forcing somebody to read a compatibility JSON file before date night.

---

# Final Governing Rule

> **Harborlight distributes authored spatial possibility, never a Player's private space.**  
> Reusable spatial content may be shared widely because its releases are typed, immutable, dependency-aware, privacy-safe, compatibility-declared, and revalidated in the Chronicle that consumes them. The Community can exchange the map, the ghost, the footprints, and the placement recipe; it does not exchange somebody's bedroom merely because the map once appeared there.

**End of Project Harborlight Governing Amendment v1.1**
