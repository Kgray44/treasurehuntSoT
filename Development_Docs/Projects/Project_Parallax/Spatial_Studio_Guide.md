---
title: Parallax Spatial Studio Creator guide
audience: creators
status: current
canonical_for: parallax-spatial-studio-guide
last_reviewed: 2026-10-15
---

# Build a spatial experience

Open **Spatial Studio** from Creator Studio, or select **Add Spatial Moment** on a Chronicle passage. Guided mode starts with a Desk Map and keeps the canvas at the center of the workspace.

The [Phase 3 implementation](Phase_3_Implementation.md) and [refined workstation](Phase_3_Workspace_Refinement.md) are software-qualified on protected main through PR #711 and received explicit owner visual approval on 2026-10-11. The editing workflow is:

- Add a visual asset to the current scene from the asset browser, or drag it into the viewport. **New scene** opens a separate spatial moment.
- Select an object in the scene or hierarchy. Choose **Move**, **Rotate** or **Scale** to use its gizmo. Drag empty space to orbit, Shift-drag to pan and scroll to zoom. Plan and elevation views help inspect placement; precise inspector controls and keyboard movement remain available.
- Collapse the library or inspector to enlarge the viewport. Resize a dock from its edge, or focus the separator and use arrow keys.
- In the [workspace refinement candidate](Phase_3_Workspace_Refinement.md), choose Spatial Editing, Scene Construction, Behavior Authoring or Focus / Immersive from **Workspace layout**. The left rail opens Spatial Library or Scene Hierarchy. The Library itself has Assets, Environments, Scenes, Effects and Compositions tabs. The Inspector exposes contextual accordion sections; the bottom strip opens Timeline, Simulation, Diagnostics or Events. Drag a dock edge or use its separator arrow keys. **Reset Workspace Layout** restores the default; presentation preferences never edit the scene.
- **Ask Parallax** opens floating assistance; **Dock assistance** overlays it on the scene. Drag the floating title to move the window and any edge or corner to resize it; focused handles also accept arrow keys and Shift for larger steps. The composer stays at the bottom. The default command bar stays compact. **Scene actions** contains Drydock validation and immutable version creation, and **Library, reuse & publication** contains library metadata and Chronicle attachment.
- Enter a supported placement instruction in spatial assistance. **Preview placement** shows the proposed scene without saving it; inspect the result, then approve or discard. Unsupported instructions explain their limits. Provider availability is explicit; supported phrase rules remain available without AI.
- For adaptive objects, **Move** highlights safe synthetic surfaces. Choosing one edits the surface/context intent; the resolver continues to enforce clearance, reach and safety rules. Compare environments before publishing.
- Author visual state changes in the timeline. Drag an event or use its arrow keys to change the delay; seek and play to inspect the result. Expand **Sequence properties & simulation** for trigger, target and simulation controls.
- Use Guided preview to inspect the same authored clue without camera or precision movement. Synthetic scenes and confidence overlays do not establish real AR tracking or physical qualification. Optional field feedback retains only consented bounded metadata; automatic room-image upload is disabled.

The canonical publication and library workflow remains:

1. Choose a preset, name the experience and edit its clue. Choose desk, wall, entrance or local placement. Drag an object in the canvas or use its keyboard movement and size/rotation controls. Detailed mode reveals hierarchy, layers and timeline; Engineering adds explicit coordinates. Changing mode does not change the experience.
2. Select a synthetic environment and preview the Lens, phone frame, Guided fallback or accessibility view. Check that the alternative text preserves the clue. Crew and remote previews compare fixed synthetic views; they do not establish real-world placement or shared-device synchronization.
3. Select **Validate in Drydock**. Correct errors, review warnings and check scale/performance estimates. Model, texture and audio import manifests expose compatibility checks, but their renderer is currently unavailable and they cannot be released.
4. Select **Save to Spatial Library** to make a Chronicle-only draft reusable across your Chronicles. Working drafts autosave. Search saved items by title, tag, category or collection; mark favorites, inspect usage and open version history. Fork an item before creating an independent variant.
5. Select **Create immutable version**, choose the Chronicle passage and **Attach exact version**. Existing attachments retain their pinned version when you edit the working draft. The passage inspector offers Edit in Parallax, narrative fallback override and detach.
6. Return to the Chronicle's existing validation, Sea Trial/suite and publication review. Chronicle publication retains the exact spatial version and checksum. Reopen it through Edit in Parallax.

Undo and redo apply to ordinary editing and accepted AI proposals. When configured, AI intent and critique are advisory: review the proposed placement, content and alternative text before applying it. If you edit the draft after requesting a proposal, request a fresh proposal before applying. Manual editing remains available when AI is unconfigured.

If a save conflicts with another revision, preserve your work as a new fork or reload the authoritative item. An immutable version is never overwritten. Synthetic previews are authoring aids; representative-device acceptance and physical tracking qualification remain separate.

## Use models, lights and compositions

The refitted Library groups original models and classic presets under Assets, lighting and spatial effects under Effects, and reusable assemblies under Compositions. Search by name or description, choose a source, then inspect an item. Use **Add to active Scene**, a card's action menu or drag a supported card into the viewport. Dragged physical models indicate a compatible floor, table or wall target and refuse an invalid drop; effect drops use their type-specific initial position for Inspector adjustment. Original model cards show their packaged thumbnails. The newly added object is selected in the Inspector; ordinary placement, transforms, Undo and save controls remain available. Preview-only cards explain why insertion is unavailable.

To preview Ghostly Presence, add it from Compositions. Its blue light, mist, particles and synthesized ambience remain separate children in Hierarchy. Adjust each child, enable an entrance envelope, then play the existing timeline. Enable preview audio deliberately to hear positional ambience; pause or mute stops it. Reduced motion keeps stable effects. Point and spot lights affect the actual scene; ambient light fills the scene and has no meaningful position or range control.

Select the composition root and use **Save selected composition**. Open **Compositions** in Spatial Library and choose **Add composition** to add an independent copy to another fixed Scene. Saving a Scene and reloading it retains its elements, child relationships and authored timing. Imported arbitrary models/audio, volumetric fog, occlusion-aware projection, live cloth simulation and automatic proximity triggers are not provided by these controls. Current Player/native adapters preserve meaning through Guided View for the new element types.

Open **Environments** to inspect built-in, owned or reconstructed places, then choose **View associated Scenes** or **Manage Environment**. Opening details does not edit a place. Under **Scenes**, filter by Environment, open an owned Scene, or use its rename, collection, favorite, duplicate and archive actions. Archiving a working Scene preserves immutable versions and Chronicle references. Private saved items and published Community content have distinct lifecycles; Community installation and publishing are not available from this Library candidate. See the [SC-00C implementation record](SC_00C_Spatial_Library_Refit.md) for its validation state.

The [SC-02 record](SC02_Assets_and_Effects.md) identifies current qualification and the original assets' licensing provenance.

## Author an adaptive scene remotely

Choose Remote Semantic Placement in the placement controls. Select preferred surfaces and surrounding context, then refine height, orientation, concealment, clearance, reach and allowed substitutes. A supported phrase such as placing a map near furniture can produce a reviewable structured recipe without an AI provider. Unsupported or ambiguous phrases explain the limit; use the guided controls to finish the recipe.

Add related objects from the Library and choose their separation and reveal relationships. Compare the same scene in several synthetic environments. Placement diagnostics distinguish a good match, acceptable substitute, low confidence and no valid placement. If no safe arrangement exists, revise the conflicting constraint or improve the Guided alternative; the resolver will not fabricate a surface.

Choose a placement policy appropriate to the story. Sticky retains a lifecycle; Per Crew shares a logical crew decision; Per Run permits an authorized new run to vary; Variant uses the selected run variant. Calibrated preserves a reviewed semantic recipe and still resolves safe geometry. These policies do not promise that separate physical devices share an aligned real-world anchor.

For mandatory discoveries, author bounded hint stages, expected and maximum search time, Show me, an accessible direct clue and the alternate completion text. Preview the terminal recovery before creating an immutable version. Player search time pauses during irrelevant or interrupted activity. Guided recovery exposes the clue; ordinary Chronicle controls still determine completion.

## Review optional field feedback

Players can decline optional feedback and continue normally. The consent explanation names the retained categories, Creator access, retention and withdrawal. Feedback contains no room image, audio, location, coordinates or scanning path. Automatic image upload is unavailable. Player-reported physical feedback is self-reported evidence, not certified device accuracy.

Open Field Quality for an owned definition. Simulation and physical reports appear separately. Review eligible feedback against the current draft, make a bounded recipe adjustment and acknowledge Creator Reviewed before Calibrated. Changing the recipe invalidates the old acknowledgement. A stale or concurrent review must be refreshed. Verified requires later independent eligible reports for the calibrated released version; it is not a physical AR certification label.

Create a new immutable Spatial Library version and attach that exact version before the Chronicle's normal validation, Suite and publication review. Earlier published versions remain unchanged. Feedback withdrawal deletes the original retained report; already published reviewed recipes may remain without that report.

## Reuse one Environment across Scenes

In the SC-01 candidate, the strip above the canvas identifies the active Scene and its pinned Environment revision. Open **Manage Scenes** to create an Environment, create independent Scenes from its baseline, duplicate a Scene, rename, archive, save, preview or compare. The gallery lists the Scenes belonging to the selected Environment. Each Scene keeps its own objects, transforms, visibility and behaviors.

Use **Edit Environment** for shared room dimensions, furniture, architecture and semantic features. Built-in Environments open as owned copies. Saving creates a new Environment revision; existing Scenes keep their prior pins. Open **Review Environment impact**, inspect the changes and affected placements, then update each working Scene deliberately. Undo restores the previous association. Released Scene versions and existing Chronicle bindings remain unchanged.

Environment editing has its own Undo/Redo and explicit Save/Discard controls. Scene edits use the ordinary Studio history and save queue. The [SC-01 implementation record](SC_01_Environment_and_Scene_Manager.md) tracks browser and integration qualification; synthetic previews do not establish physical room or AR accuracy.

## Review a Community release candidate

In the SC-07A candidate, save a personal asset or Scene, then select **Publish to Community** in Spatial Studio, the saved item's Library details or context menu, or Scene Manager. An owned synthetic Environment also has that action. The same guided dialog opens from each entry. Saving alone remains private.

Review the saved revision, write the listing description and tags, inspect every included Environment and choose a configured Harborlight license. A synthetic Environment requires a geometry privacy acknowledgment. Review the content-derived preview and expand **Inspect the sanitized package** for the full JSON before choosing **Submit to Community**. The result is pending moderation; the listing appears publicly only after approval. To update a release later, select the existing listing in the description step and review the new immutable package. A submission still awaiting moderation cannot accept a changed update; retrying the exact submitted choices returns the same release. When Studio already knows a source contains an unresolved model, media, Vision reference, remix or calibration limit, its action reads **Review publishing limits** and the same dialog explains the limit before server review. If review reports a rights error, the saved Studio source remains private and can be edited before another attempt.

An approved Community listing offers **Install to my Library**. Review the exact release, license, included items and credits, then install. Open the pinned read-only result in Spatial Studio; choose **Create editable copy** to work separately. Third-party media, SC-02 physical models without owner redistribution authorization, private Vision/calibration references, reconstructed or measured rooms and unverified remix rights currently block publication with a specific explanation. Original private room photos are never included in the supported package. The [SC-07A implementation record](SC_07A_Direct_Spatial_Community_Publishing.md) tracks local evidence and remaining acceptance gates.
