---
title: SC-00 Spatial Studio integration handoff
audience: product-engineering
status: implementation-in-validation
canonical_for: parallax-sc-00-integration-handoff-20261015
last_reviewed: 2026-10-15
---

# Continuation and ownership

Continue `codex/parallax-studio-overhaul` in the owned `px-surface` worktree and
existing draft [PR #722](https://github.com/Kgray44/treasurehuntSoT/pull/722).
Continuation baseline is `a5eeb5b42561042cea7e799a3b0d54c1b03c1006`;
protected main was refreshed to `4baa39af82b78b50a46f590bc2acc2ff0b7597aa`.
Do not reset the owner checkout, its unrelated AGENTS/tsconfig changes, private
evidence, inspection app, phone pairing or test databases.

SC-00 retains geometry, reconstruction, Assistant, scene editing, timeline,
simulation and validation. SC-00B owns the right Inspector and vertical tool-rail
redesign; SC-00C owns the left Library redesign; SC-07A owns direct Spatial
Community publishing through Harborlight. Their complete UI/publication scopes
are not implemented or accepted by this handoff. SC-00A Chronicle creation
remains in its separately owned PR #726. SC-01 and SC-02 remain separately owned.

## Shared contracts to preserve

| Boundary | Canonical source and constraint |
| --- | --- |
| Scene identity and mutations | `src/parallax/authoring.ts`: `SpatialDraft`, `Edit`, `History`, `editSpatialDraft`, Undo/Redo. Preserve normal history, serialized autosave and revision checks. |
| Entity properties | `src/parallax/contracts.ts` and `studio-contracts.ts`: finite transforms, normalized quaternion rotation, anchors/parent frames, content/interactions, layers, animation tracks, groups and pins. Optional new fields must not change historical serialized/checksum material. |
| Inspector and selection | Inspector is currently inline in `SpatialStudio.tsx`, with `RoomEnvironmentEditor`, `GroupSelectionInspector` and `StudioTextField`. Retain `selected`, `selectedRoomFeature`, `selectedGroupId`, typed `selectionItems` and derived `selectionMembers`; use shared `edit`/`replace` commands. Clicking a grouped member selects that member; group-wide editing starts in Groups. Room-feature mutation requires environment edit mode. |
| Library surfaces | `SpatialLibrary.tsx`, `SpatialAssetBrowser.tsx`, `EnvironmentLibrary.tsx`, `SavedSpatialLibrary.tsx`, `EnvironmentCreateDialog.tsx`, `EnvironmentDefinitionWorkspace.tsx`. Discovery and panel state must not mutate authored data. Preserve explicit save, stable working identity, named copies and recoverable archive. |
| Shared UI files | `SpatialStudio.tsx`, `SpatialStudio.module.css`, `workspace-layout.ts`, `useWorkspaceLayout.ts` are integration hotspots for SC-00B/00C. Coordinate bounded sections instead of replacing the whole workstation. Preserve Assistant overlay, selection, timeline clock, recovery and narrow/reduced-motion behavior. |
| Environment geometry | `environment-contracts.ts`, `room-geometry.ts`, `construction-verification.ts`, `room-placement.ts`, `surface-placement.ts` are shared by presets, photo rooms, direct placement and Assistant queries. Exclusions and physical clearance remain enforced. |
| Timeline/simulation | `animation-authoring.ts`, `behavior.ts`, `AnimationEditor.tsx`, `BehaviorTracks.tsx`, `SpatialSimulation.tsx`. Preview, scrub, playback and simulated triggers use the same evaluator and scene clock. Simulation never writes One Voyage progression. |
| Rendering | `SpatialCanvas.tsx` and `spatial-workstation` own actual editor instances, transforms, materials, picking and renderer receipts. Runtime adapters consume canonical Parallax entities; SC-02 must preserve shared evaluation and Lanternwake motion policy. |

## Persistence and SC-01 reconciliation

The current overhaul uses existing owner-scoped `ReusableAuthoringItem` and
`ReusableAuthoringItemVersion` storage. Mutable version zero is the working
envelope; positive versions are immutable. `currentVersionNumber` is a CAS
revision, not the immutable release ordinal. Autosave does not establish Library
membership; Save to Library, Save as new, version creation and restore are
different operations. See the [lifecycle record](Spatial_Library_Lifecycle_20261014.md).

Independent Environment documents currently use `PARALLAX_ENVIRONMENT_DRAFT_1`
and `PARALLAX_ENVIRONMENT_VERSION_1` from `library-lifecycle-contracts.ts`.
`library-lifecycle-service.ts` owns saving, copying, releasing and reuse. A Scene
embeds an independent room snapshot under `studio.environment` and retains its
source in `studio.environmentBinding` with `INDEPENDENT_PINNED_SNAPSHOT` policy.
Updating a source never silently updates consumers; changed attached supports
are checked before any replacement. Historical versions remain unchanged.

SC-01 checkpoint `c5f99f950054c7a3918e369c667ece2597abb3e9` introduces a
`PARALLAX_ENVIRONMENT` record kind and a top-level Scene Environment pin,
`environmentPlacements`, description and presentation fields. These are **pending
interfaces**, not fields already integrated into PR #722. Reconcile these two
representations explicitly before combining branches: retain working-versus-saved
semantics, source identity, private-photo provenance, immutable versions and CAS.
Do not leave two competing Environment authorities or silently rewrite old pins.

SC-01's `src/parallax/scene-reference.ts` exports `SceneReference`,
`sceneReferenceSchema`, `sceneReference` and `validateSceneReference`. It binds a
validated immutable Scene definition/version/checksum, its exact Environment pin,
behavior IDs and `CUT`/`PRESERVE_ENVIRONMENT` transition intent. Future Chronicle
consumers must validate the complete reference rather than substitute latest
versions. Transition intent is not SC-03 runtime implementation. Current Chronicle
attachment remains `library-service.ts::attachSpatialVersion`, validated through
the existing Chronicle/Drydock/publication authorities.

## Implemented behavior and remaining acceptance

| Original acceptance | Current boundary |
| --- | --- |
| A–E, J–M | Renderer-linked placement/recovery, room semantics, clarification, clamping, selection/framing, matched pan gestures, explicit retry and Assistant state transitions have bounded source/browser evidence. A final combined candidate still needs qualification. |
| F, G, O | Entity-bound keyframes, live scrubbing, clip movement/resizing, eased/cinematic motion, opacity, triggered simulation, reset and saved replay are implemented through the shared evaluator. Previous production journeys retain their exact source identities. |
| H | One/two-photo import, review, correction, refinement and independent environment save are implemented. Real Sol requests reached usable proposals, but orientation variability, geometry rejections and incomplete clutter/sloped-ceiling fidelity remain open. No universal reconstruction-accuracy claim. |
| I | Independent definitions/instances, explicit Library membership, CAS, copies, versions, archive and recovery have bounded lifecycle evidence. SC-01 integration and the SC-00C redesign remain separate. |
| N, P | Existing modeled props, room construction and mode/reduced-motion journeys have bounded evidence. Complete premium visual quality and SC-02 light/effect/audio work are not discharged. Whole-overhaul owner acceptance remains open. |

The first refreshed local suite ran 792 checks: 788 passed and four failed. One
failure exposed Library collection metadata in Assistant context; three used an
obsolete visible Save draft button instead of the current working autosave flow.
Keep this initial failure distinct from the subsequent repairs and their results.

The repaired domain/Studio suite passed all 793 checks across 72 files. Assistant
context now omits private Library organization metadata, and tests follow the
actual working autosave flow. A further isolated provider/Apply regression passes:
a title-only reviewed edit preserves nondefault tags, collection, favorite and
entity content while withholding private metadata from the provider request.
Independent review reran 43 focused checks and found no blocker in that repair.
These software results do not close the combined experience or integration gate.

The browser-first phone requirement remains unqualified. The owner's real iPhone
Safari test reached corner selection but reset tracking and failed calibration.
TinyVIO remains local-prototype-only, its plane output is not admitted, and
Guided View is an explicit fallback. See the [phone checkpoint](Two_Room_Phone_Readiness_20261014.md).

The merged Sounding Line lifecycle repair removes its infrastructure obstruction;
it does not supply the missing Crossdeck experience design/capture or establish
product acceptance. SC-00 must not rerun the separately owned Crossdeck capture
without explicit human authorization. Final ordinary qualification, source-bound
review and owner acceptance remain distinct gates. No merge is authorized here.
