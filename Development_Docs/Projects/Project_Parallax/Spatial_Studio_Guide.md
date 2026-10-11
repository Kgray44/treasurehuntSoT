---
title: Parallax Spatial Studio Creator guide
audience: creators
status: local-implementation
canonical_for: parallax-spatial-studio-guide
last_reviewed: 2026-10-11
---

# Build a spatial experience

Open **Spatial Studio** from Creator Studio, or select **Add Spatial Moment** on a Chronicle passage. Guided mode starts with a Desk Map and keeps the canvas at the center of the workspace.

The [Phase 3 workstation candidate](Phase_3_Workstation_Review.md) is under development and awaiting explicit owner visual approval. It is not yet the protected-main experience. Its editing workflow is:

- Add a visual asset to the current scene from the asset browser, or drag it into the viewport. **New scene** opens a separate spatial moment.
- Select an object in the scene or hierarchy. Choose **Move**, **Rotate** or **Scale** to use its gizmo. Drag empty space to orbit, Shift-drag to pan and scroll to zoom. Plan and elevation views help inspect placement; precise inspector controls and keyboard movement remain available.
- Collapse the library or inspector to enlarge the viewport. Resize a dock from its edge, or focus the separator and use arrow keys.
- Enter a supported placement instruction in spatial assistance. **Preview placement** shows the proposed scene without saving it; inspect the result, then approve or discard. Unsupported instructions explain their limits. Provider availability is explicit; supported phrase rules remain available without AI.
- For adaptive objects, **Move** highlights safe synthetic surfaces. Choosing one edits the surface/context intent; the resolver continues to enforce clearance, reach and safety rules. Compare environments before publishing.
- Author visual state changes in the timeline. Drag an event or use its arrow keys to change the delay; seek and play to inspect the result. Expand **Sequence properties & simulation** for trigger, target and simulation controls.
- Use Guided preview to inspect the same authored clue without camera or precision movement. Synthetic scenes and confidence overlays do not establish real AR tracking or physical qualification. Optional field feedback retains only consented bounded metadata; automatic room-image upload is disabled.

The accepted Phase 2 publication and library workflow remains:

1. Choose a preset, name the experience and edit its clue. Choose desk, wall, entrance or local placement. Drag an object in the canvas or use its keyboard movement and size/rotation controls. Detailed mode reveals hierarchy, layers and timeline; Engineering adds explicit coordinates. Changing mode does not change the experience.
2. Select a synthetic environment and preview the Lens, phone frame, Guided fallback or accessibility view. Check that the alternative text preserves the clue. Crew and remote previews compare fixed synthetic views; they do not establish real-world placement or shared-device synchronization.
3. Select **Validate in Drydock**. Correct errors, review warnings and check scale/performance estimates. Model, texture and audio import manifests expose compatibility checks, but their renderer is currently unavailable and they cannot be released.
4. Select **Save to Spatial Library** to make a Chronicle-only draft reusable across your Chronicles. Working drafts autosave. Search saved items by title, tag, category or collection; mark favorites, inspect usage and open version history. Fork an item before creating an independent variant.
5. Select **Create immutable version**, choose the Chronicle passage and **Attach exact version**. Existing attachments retain their pinned version when you edit the working draft. The passage inspector offers Edit in Parallax, narrative fallback override and detach.
6. Return to the Chronicle's existing validation, Sea Trial/suite and publication review. Chronicle publication retains the exact spatial version and checksum. Reopen it through Edit in Parallax.

Undo and redo apply to ordinary editing and accepted AI proposals. When configured, AI intent and critique are advisory: review the proposed placement, content and alternative text before applying it. If you edit the draft after requesting a proposal, request a fresh proposal before applying. Manual editing remains available when AI is unconfigured.

If a save conflicts with another revision, preserve your work as a new fork or reload the authoritative item. An immutable version is never overwritten. Synthetic previews are authoring aids; representative-device acceptance and physical tracking qualification remain separate.
