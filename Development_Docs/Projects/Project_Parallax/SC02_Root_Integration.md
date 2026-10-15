---
title: SC-02 integration into the current Spatial Studio
audience: engineering
status: in-progress
canonical_for: parallax-sc02-root-integration-20261015
last_reviewed: 2026-10-15
---

# Scope and preserved authority

This integration continues PR #722. It adopts SC-02 source/evidence ancestry
`73db990b554e2236df7bbda4286f5b8023a3636f` into the existing qualification
candidate at `5333638a`, preserving the current groups, room geometry, continuous
surfaces, placement, timeline, Assistant, independent Environment workspace and
unified Library. The obsolete SC-02 Asset Browser shell is not substituted for
the current Library. Implemented element descriptors feed its existing provider
seam. Original source reviews, failed captures and SC-02 review transitions remain
historical evidence, not combined-candidate acceptance.

The narrow SC-00C phone Library patch is taken from exact source
`e0fea9f702407d38a69f7b739b49a2805ca5af01`. Its standalone proof does not
qualify the combined Studio header or renderer.

# Integration decisions

Typed elements are optional in canonical entities. Old records retain omission
and checksum material. Paper keeps plane-local orientation; Y-up element roots
retain the actual selected horizontal room frame and yaw. Renderer object caches,
canonical opacity, selection, room editing and renderer receipts remain in place.
Effects use the authored timeline, bounded counts, preview quality and reduced
motion. Preview sound requires an explicit user gesture and stops on pause,
backgrounding and disposal.

Composition extraction saves through the canonical draft writer and explicitly
adds Library membership. Reuse resolves the current owner record or an exact
requested release, then makes an independent editable copy in the current Scene.
Ordinary reusable assets/assemblies retain their existing released-copy route.
Installed Community provenance remains owned by SC-07A; its pending corrections
are not imported or claimed complete here.

Unsupported native/simulated element rendering uses the authored Guided meaning.
An explicitly requested Browser AR provider instead reports unsupported element
types and requires the user to choose Guided View. It must never silently replace
the requested browser AR attempt.

# Validation and remaining gates

The first combined focused run retained 152 passing checks and two failures:
floating-point quaternion identity after Y-up frame composition, and simulated
runtime fallback for unsupported elements. The frame result is normalized and
simulated fallback restored. The second run passes 154 checks across five files,
including existing BrowserRoomView corner/lifecycle tests. These are isolated
domain/component checks, not physical tracking evidence.

Independent source review found two additional blocking integration defects:
`PX-SC02-OPACITY-01` (element fade envelopes overwritten by animation opacity,
including skipped particle alpha) and `PX-SC02-COMPOSITION-MOTION-01` (composition
extraction/reuse discarded tracks). The repair composes intrinsic alpha, element
envelope and animation opacity once for Mesh and Points; saves/remaps included
tracks and frame identities; and rebases root POSITION keys with the extracted
and inserted pose while retaining child-local keys. The independent re-review
found both source findings resolved. This is source review, not rendered acceptance.

The aggregate rerun passes **979 checks across 82 files**, including the final
moving-root regression and photo recovery/Studio/Lens tests. The first broad run
failed 23 checks: two Canvas fixtures needed the real AnimationProvider/new audio
cleanup seam, and 21 image-bearing component checks exposed Next's CommonJS
namespace through the moved Windows dependency junction. Test setup now unwraps
the actual Next Image component; it does not replace it with a mock image.
All failed logs are retained. Final full typing, changed-file lint, documentation
validation and Feature Catalog validation pass after the repairs. Actual-browser
work remains pending.

The first combined local browser invocation stopped before application startup
because its database path failed the existing isolation contract. Its original
PowerShell tree field is malformed and is not source-binding evidence. The second
used an admitted isolated database but Turbopack refused the C: dependency junction
into D:. A detached owned D: validation checkout at the same `e073eaa2` candidate
and tree `3d25b96e169d069dd6a63d80b89ad6bf0d37df90`, with literal same-drive
dependencies, built successfully and rendered the real Studio. That third attempt
failed before insertion because the test requested `textbox / Search Library`;
the actual control is a category-specific `searchbox / Search assets`. It does not
qualify element insertion or playback. All three failed logs, original receipts,
and the third attempt's screenshot/recording/trace remain under
`evidence/sc02/root-integration-20261015/`. Task-owned server/proxy cleanup passed.
The correction uses the visible searchbox in the selected Library category and
waits for canonical autosave rather than invoking the removed Save draft button.
These local invocations do not reset protected review history or allowances.

The owner held the iPhone upright and steady and saw no error after the second
corner set. Physical calibration remains failed/unqualified. Current providers
return no admitted detected planes. The existing synthetic corner tests do not
explain the physical failure, establish camera-pose accuracy, or justify retaining
corner rays across changed maps. No owner runtime is modified by this integration.

SC-01 Scene Manager/CAS integration, SC-00B Inspector integration, Community
composition provenance, combined mobile/rendered proof, Crossdeck design gates,
protected qualification and owner/device acceptance remain separate pending work.
No paid inference was run for this integration.
