---
title: SC-01 Environment and Scene Manager implementation and integration contract
audience: product-engineering
status: implementation-in-validation
canonical_for: parallax-sc-01-implementation
last_reviewed: 2026-10-15
---

# Reusable Environments and independent Scenes

SC-01 extends the canonical Spatial Studio and reusable authoring store. An Environment owns shared room dimensions, architecture, furniture, semantic features, constraints and base lighting. A Scene retains its existing SpatialDraft identity and owns its objects, transforms, visibility, media, declarative behaviors and interactions.

This candidate is under focused and browser validation. It does not yet claim protected integration, visual completion, physical-device qualification or owner acceptance.

## Data and ownership

Environment records use the existing reusableAuthoringItem and reusableAuthoringItemVersion tables with kind PARALLAX_ENVIRONMENT. Every save claims the exact owner and revision, then appends an immutable checksummed version. Built-in references are immutable; editing creates a new owned copy. Reviewed reconstruction metadata can be imported through the same geometry schema without private images or credentials.

Scenes remain PARALLAX_STUDIO records. Optional version-content fields are environment, sceneDescription, environmentPlacements and scenePresentation. The last provides an independent INHERIT/NORMAL/LOW Studio preview lighting override; it does not control physical room illumination. Historical content omitting these fields retains its existing serialized material and checksums. Scene saves validate access to the exact Environment version. Neither saving a Scene nor saving an Environment rewrites sibling Scenes or released envelopes.

The Environment pin contains environmentId, versionId, revision and checksum. A Scene keeps that pin until the Creator explicitly reviews an update. Review reports changed room bounds, furniture, lighting and explicit semantic features, and rejects missing or unsafe references and invalid placement geometry. Updating is an ordinary undoable draft replacement; calibration claims are invalidated for re-review. Published Scene versions retain their original pins.

## Creator workflow

The context strip identifies the shared Environment, active Scene, editing scope and saved state. Manage Scenes opens one gallery with content-derived schematic thumbnails, names, descriptions and immutable-version counts. It supports baseline creation, existing-Scene duplication, rename, archive, switching, save, preview and information inspection. Existing Library publication and Chronicle attachment controls retain their authority.

The Environment editor clearly marks shared edits, supports its own Undo/Redo, and saves a new revision independently. The impact view offers a controlled per-Scene update. Archiving removes a working Scene from listings while preserving released versions and existing Chronicle pins.

Scene comparison uses Tideglass's stable-identity matcher and the canonical JSON utility as a bounded spatial projection. It distinguishes added/removed objects, transforms, visibility, content, behavior timing, interactions, media/effect dependencies and Environment/semantic-reference differences. Optional SC-02 element fields can be compared when that capability is integrated; this candidate does not invent renderer support.

## Future Chronicle Scene reference

The stable contract is exported from src/parallax/scene-reference.ts as SceneReference, sceneReferenceSchema, sceneReference and validateSceneReference. A reference requires:

- schemaVersion equal to 1;
- sceneDefinitionId, sceneVersionId and sceneChecksum bound to a validated immutable SpatialMoment;
- the exact Environment pin from that Scene version;
- behaviorIds from the same immutable Scene version;
- a transition intent of CUT or PRESERVE_ENVIRONMENT.

A publisher must retain all pins rather than substituting latest revisions. Validation rejects a mismatched Scene checksum, Environment pin or behavior set. PRESERVE_ENVIRONMENT is a future transition declaration; no transition runtime or SC-03 Story Block integration is implemented here. One Voyage continues to own progression, and existing Chronicle snapshots remain the immutable publication authority.

## Validation and demonstration

Thirty-four focused tests pass across Environment authoring, owner-scoped append-only persistence, existing Library persistence, authenticated API operations and Scene Manager concurrency. Another 85 existing authoring, publication, assets, native, transfer and Studio component regression tests pass. They cover the three independent Haunted Bedroom Scenes, supported timed reveal/highlight behavior, duplication, comparison, reference validation, conflicts, immutable pins and Undo/Redo. Initial worker-start failures and a subsequently fixed optional-field comparison defect were development findings, not qualification receipts.

The dedicated browser test authors The Haunted Bedroom, Ordinary Room, The Haunting and The Hidden Letter through visible Studio controls. It also exercises save/reload, switching, duplication, rename, behavior editing, comparison, Environment impact/update, keyboard entry and mobile accessibility. The production-browser journey passes, including mobile serious/critical axe checks, keyboard focus restoration, natural Library return, invalid-geometry recovery, stale-save rejection and immutable-envelope readback. The actual captures and independent supporting review are linked below. Protected experience capture and ordinary qualification remain blocked as described below.

The renderer uses saved fixture geometry and semantic surfaces for pinned Environments, retaining the existing reference-room furniture for unbound previews. The context strip exposes both the pinned revision and any newer revision. Inactive Scene updates fetch current content before applying a pin; a focused concurrency test proves that a stale gallery snapshot cannot overwrite a newer edit. Comparison includes anchor-frame changes as well as object-local transforms.

Checked-in built-in envelopes have fixed pre-release numeric precision so production JSON serialization preserves their digests. An initial production capture found this serialization defect; the repair retained checksum verification and subsequent production builds and journeys passed. Earlier failed captures remain failed.

## Evidence and integration state

The [local supporting evidence](evidence/sc-01/20261015-local/review-packet.json) binds the production source, screenshots, focused checks and review scope. It is not a protected capture/review artifact and grants no product acceptance.

The protected planner selects crossdeck.phase2.continuity through shared Parallax consumers and fails with PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED. Protected main at 4baa39af has only that contract's experienceIntent. The Crossdeck owner located the complete owning design in unmerged draft [PR #721](https://github.com/Kgray44/treasurehuntSoT/pull/721), checkpoint a98dad37, and confirmed it has no accepted rendered evidence. That separately owned refit still requires authorized capture. SC-01 preserves this obligation, does not adopt its unmerged implementation, and does not claim protected integration, visual completion or a landed-tree smoke test.

Feature Catalog: no fragment change while the branch remains unaccepted. The Environment/Scene capability is meaningful and becomes catalog-eligible only after its local acceptance and integration requirements pass.

All local source, dependencies, databases, temporary files and evidence reside on the task-owned D: worktree. The shared C: checkout, parallel Parallax worktrees and inspection runtimes are preserved.
