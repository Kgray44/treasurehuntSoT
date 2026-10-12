---
title: Spatial Studio functional and experience overhaul
audience: product-engineering
status: implementation-in-progress
canonical_for: parallax-studio-overhaul-20261012
last_reviewed: 2026-10-12
---

# Objective and focused source audit

Preserve the owner's accepted spatial workstation while completing its real
authoring workflow: reconstruct an editable room, resolve semantic placement,
find the placed object, animate and simulate it, then save and reuse the scene.
The scope and acceptance A–P are bound in the [owned task contract](../../../.agents/parallax-studio-overhaul.md).
This record distinguishes source findings from later rendered proof.

Baseline is protected `602f83ef`; owned reconciliation `211fe9ed` contains the
previous room/surface correction and preserves current protected contracts.
The running owner preview and all sibling worktrees are preserved.

| Area             | Verified source cause or existing authority                                                                                                                                                 | Required correction / proof                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI visibility    | Canvas consumes proposal entities, but READY only proves initialization; renderer supplies no per-entity visibility acknowledgment. Fixed selected-object framing uses a constant distance. | Bind instantiated geometry, bounds, clipping/occlusion diagnostics and recovery to the actual rendered entity; prove A/E.                          |
| Reconstruction   | Rooms currently come from synthetic preset geometry; no editable environment or photo import/analyze/refine workflow exists.                                                                | Extend normal scene data and governed protected image/perception seams; prove H and final demonstration.                                           |
| Timeline         | Behavior schema only supports SHOW/HIDE/HIGHLIGHT; track UI edits delays. No transform/material keyframes exist. Playback increments a 100 ms interval independent of elapsed time.         | Extend canonical declarative spatial behavior, one scene clock and actual renderer properties; prove F/O.                                          |
| Simulation       | Existing pure behavior evaluator responds to SCENE_ENTER/TIMER/INSPECT/PICK/PLACE; controls append inputs. With no matching authored event nothing changes; activity reports inputs only.   | Add observable evaluated conditions, targeted scene mutations and renderer acknowledgment; retain isolated state and Drydock ownership; prove G/O. |
| Saved library    | Owned CAS/versioned persistence exists. Saved UI mixes drafts/categories, and reusable asset-versus-instance flows and thumbnails are absent.                                               | Build real definition/instance/scene workflows on existing persistence; prove I.                                                                   |
| Navigation       | Left icon rail and adjacent Library/Hierarchy/Saved tabs switch the same leftTab.                                                                                                           | Retain the rail, contextual heading and keyboard semantics without redundant section tabs.                                                         |
| Input            | OrbitControls uses default middle dolly while Ctrl+left invokes pan; canvas pointer-up selection does not guard modifier-camera gestures.                                                   | Bind both to the same pan implementation, robust cancellation and no accidental editing; prove J.                                                  |
| Assets           | Props are planes, torus/cone compass and flattened spheres; most furnishings are boxes. Existing asset schema rejects unqualified imported media.                                           | Authored believable reusable geometry/materials with budgets/provenance; distinguish browser and native support; prove N.                          |
| Selection        | One BoxHelper identifies selected bounds, but no hover distinction, visibility reason or reveal/isolate recovery exists.                                                                    | Stable exact-entity feedback and synchronized inspection/framing; prove E.                                                                         |
| Fallback         | Adaptive resolution may switch directly to Guided; WebGL failure reports generic UNAVAILABLE and has no retry effect dependency.                                                            | Explain policy/capability/runtime reasons, preserve draft and retry the viewport; prove K/P.                                                       |
| Clamping         | Shared geometry/normal fitting now exists and rejects occupied supports. Snap is combined with grid stepping; explicit automatic-surface setting and drag acceptance remain needed.         | Maintain one geometry query path, independent intuitive toggle and rendered drag proof D.                                                          |
| Semantics        | Candidate surface/context enums exist; windows/furniture geometry lacks canonical object classification/confidence/relationships editable by Creator.                                       | Canonical authored feature registry and relation resolution with ambiguity/missing-target behavior; prove B/C/L.                                   |
| Assistant motion | Existing state/policy-driven motion is available, but renderer acknowledgment and spatial planning feedback are not execution states.                                                       | Extend truthful phases and scene-linked feedback through Lanternwake; prove M/P.                                                                   |

The audit does not establish runtime acceptance. Existing pure behavior and
library engines are retained; no replacement progression/simulation authority
is introduced. No new capability is complete until its state and actual
rendered journey have been verified. Physical AR and owner acceptance remain
separate. The photo workflow is now explicitly in scope, superseding the
earlier existing-room-only correction boundary for this new overhaul.

## Foundation implementation checkpoint

The owned candidate now adds optional bounded entity animation tracks (position,
normalized quaternion rotation, uniform scale and visibility). Old documents
retain their exact optional-field shape. One pure scene evaluator feeds Studio
preview and Lens transforms, preserves parent/anchor composition and resolves
visibility events chronologically with keyframes. Authoring exposes explicit
keyframe recording, numeric values, timing, interpolation, enabled tracks,
deletion, draggable markers, zoom, scrub, pause, restart and stop. History,
duplication, deletion and normal CAS persistence retain tracks.

The viewport emits actual post-render instance transforms/bounds and coarse
frustum, size and raycast visibility diagnostics. These are renderer-side
geometric diagnostics, not proof of pixel-perfect GPU occlusion. Framing uses
selected bounds; isolation removes the room for recovery; reveal returns to
editing. Middle-drag uses the same OrbitControls PAN operation as Ctrl-drag,
with transform/selection guards. Surface clamping and grid snapping are
separate controls. Explicit WebGL retry creates a fresh renderer and retains
the draft. The sole primary left navigation is the existing icon rail.

This foundation is implementation in progress. Photo reconstruction, asset quality, material/light/effect
animation, comprehensive simulation diagnostics, Assistant render-confirmed
execution phases and A–P acceptance remain open. Do not treat this checkpoint
as full overhaul or native/physical qualification.

## Editable semantic rooms and reusable definitions

The candidate stores optional editable room features in the ordinary scene:
classification, name, position, dimensions, yaw, provenance/confidence and
normalized primitive geometry. All ten presets preserve their distinct geometry
when converted to editable rooms. Rendering and whole-face discovery consume
the same primitives. Room edits retain surface identities; bound clues resolve
their current support frame. Shell resizing moves feature positions
proportionally while furniture keeps its explicit dimensions.

The bounded production-browser room journey and independent review at
`35823d95704cbd15d7760b2dc119e51d371c6093` verify name/classification edits,
desk translation/rotation, bound-clue correspondence, dimension-error recovery,
desktop save/reload and a saved phone edit. Camera persistence, photo analysis
and complete natural-language targeting remain unverified. Domain room-target
resolution distinguishes missing/ambiguous features and uses the shared surface
engine; the OpenAI adapter supplies a bounded semantic feature projection and
strict ROOM_PLACEMENT operations for fixed authored rooms.

Reusable object/assembly definitions now use the existing owner-scoped library
records and immutable spatial versions. Export copies only the selected subtree,
remaps identities and retains internal behavior/keyframes in a local frame. It
rejects external behavior and protected-media/perception dependencies. Insertion
copies a pinned owned release, retains origin metadata and installs through
ordinary editor history/autosave after a generation check. Instances are
independent; later definition edits and archive do not mutate their stored data.
The Saved panel distinguishes complete scenes, objects, assemblies, templates,
reconstructed rooms and scenes with imported models; thumbnails are explicitly
schematic, derived from entity poses. Scene copies preserve full authored data.
Imported model rendering and photo reconstruction remain unavailable. Manual
placement is required for reusable object/assembly export and insertion.

414 focused Parallax tests, changed ESLint and typecheck support this candidate.
The new reusable-library production-browser journey and independent rendered
acceptance are pending; no full library or overhaul acceptance is claimed here.
