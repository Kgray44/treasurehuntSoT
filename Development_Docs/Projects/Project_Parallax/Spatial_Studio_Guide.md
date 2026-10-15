---
title: Parallax Spatial Studio Creator guide
audience: creators
status: current
canonical_for: parallax-spatial-studio-guide
last_reviewed: 2026-10-15
---

# Build a spatial experience

In the SC-07A implementation candidate, a Creator-owned item saved to the private Spatial Library can open **Publish to Community…** from its selected details. Choose an immutable Environment version first when publishing a room. The guided dialog shows the saved revision, then collects listing details, a configured license, credits and rights acknowledgment. A Scene includes its pinned Environment in the server-reviewed package. Inspect that sanitized package and its privacy warning before explicitly submitting. A pending release requires separate Community moderation before its public listing can be installed. **Open in Spatial Studio** selects the pinned, read-only release in Library; the visible canvas is a separate private working Scene. Make a separate licensed copy to edit installed content. Unsupported binary assets, photo-derived rooms and unverifiable remix dependencies are refused. See the [combined SC-07A owner review route](SC_07A_Combined_Adaptation_20261015.md). Protected acceptance remains pending.

For measured AI costs, model selection, room-validation behavior and built-in instructions, see the
[user development overview](Spatial_Studio_User_Development_Overview.md).

In the current Library integration candidate, choose **Assets**, **Environments**
or **Scenes** in the same panel; **Compositions** and **Effects** appear when their
providers supply content. Select a card to inspect its details and actions. Use
Source, Show and In-use filters to find your definitions. **Open original** or
**Edit original** changes that definition; **Create independent copy** opens the
normal named-copy flow. Working autosave remains separate from **Save to private
Library**. Returning from editing an Environment keeps its Library category.
An Environment card's **View associated Scenes** action filters the Scenes list to
its saved definition. A Scene's details name that Environment and offer **View
Environment**; **Open original** edits the selected Scene. Switching to Scene
Graph and back to Library keeps the current content category and parent filter.
The SC-01 integration candidate adds **Manage Scenes** beside the shared
Environment and active Scene. Choose a saved Environment version, create a Scene
from its baseline, or duplicate an existing Scene. The gallery keeps names,
descriptions, save state and version associations visible. Rename, save, archive,
switch, preview and compare operate on the selected independent Scene.

**Edit shared Environment** opens the same owned definition in its Environment
workspace. Built-ins create an owned copy. Working edits save in place; choose
Library membership and an immutable version deliberately. **Base preview lighting**
belongs to the Environment, while **Scene preview lighting** can override it for
one Scene. Existing Scenes retain their versions until **Review Environment impact**
and an explicit per-Scene update. Missing semantic features or moved attached
supports require repair before an update. Released Scenes remain unchanged.

The separate legacy Environment workspace provides its own working save, Undo/Redo,
Library and immutable-version controls. Its retained edits still check their original
revision after a conflict. Some older versions store placement references without
furniture or architecture; the Manager and editor explain when room geometry is
absent. Add shared furniture to an owned working copy and release it deliberately,
or choose another Environment. Save failures stay beside the active Scene controls
while the Manager is open. Working changes are retained; use **Save Scene** to retry
after the reported condition clears. Four actual browser journeys validate this
integration candidate's normal and retained-error flows. Independent combined
experience acceptance remains pending. The
[integration checkpoint](SC_01_Studio_Integration_20261015.md) records those boundaries.

Initial photo estimates may receive a small horizontal fit to clear modeled
solids. These adjustments are marked inferred and shown first in review notes;
check them against your photos. Existing edited rooms are not automatically
fitted. Thin physical features retain their thickness, and invalid estimated
height is reported explicitly. A valid simplified room is not a measured survey;
sloping ceilings and complex clutter can remain approximate. See the
[two-room test boundaries](Two_Room_Phone_Readiness_20261014.md).

Library → Assets includes an **Exclusion Zone** placement tool. Add it to the current room to open
environment editing and select its clear box. Move, Rotate and Scale use the same viewport controls
as other items; the zone remains part of the environment. Finish environment editing to hide its
box while retaining the placement reservation. Asset and group names in Scene Graph open inline
rename on one click; F2, Enter and Escape remain available.

The active overhaul candidate adds named editing groups. Open **Scene Graph**,
then use **Assets** or **Groups**. Ctrl/Command-click adds items; Shift-click
selects a tree range. Keyboard users can focus rows with arrows, use modifier
Space to add, Ctrl/Command A to select the visible category, Ctrl/Command G to
group, F2 to rename and Shift F10 for context actions. Clicking an asset title
still renames it; its icon/body selects it.

The Group icon groups a multiple selection immediately. With fewer than two
items selected, it opens a name/member chooser. Groups can include assets and
editable room features. Enable the pencil in the viewer's upper-right controls
before adding/removing room members or moving a mixed room group. Selecting a
group does not enable environment editing. Edit members changes the selection without moving its
items; regrouping transfers items from previous groups. Ungroup removes only
the group. Ctrl/Command Shift G also ungroups.

Selecting a group highlights the whole selection. Move, Rotate and Scale use
the regular viewport tools; the Inspector also exposes the selection center,
rotation delta and scale factor. A single gesture is one Undo step. Escape
cancels a live gesture. Clicking an asset or room feature selects just that item,
even if it belongs to a group. Select a saved group in **Groups** to edit all its
members together. Unlock selected assets before a group transform. Asset-group
transforms require Manual placement; room groups stay upright and use uniform
scale. Groups are editing metadata: Chronicle rendering uses the same ordinary
entities and baked transforms. The Assistant can propose group creation,
renaming, membership changes, motion and ungrouping for review before Apply.
Bounded desktop grouping journeys and independent review pass. Phone evidence
establishes tree discovery, not touch gizmo qualification. Owner and complete
overhaul acceptance remain pending in this candidate.

Drag Scene Graph rows to reorder assets, groups or editable room features. The
list follows the drag live; dropping saves one Undo step. Escape cancels.
Alt + Up/Down moves a focused row by one place. Reordering preserves positions,
parents and group membership. Selecting an asset group, then clicking a clear
surface, moves the whole group rigidly. If any member does not fit, nothing moves.

**Surfaces** outlines the whole floor, each modeled wall and the furniture planes
in the current reference room. Select an object, then click a clear part of a
surface or choose it from the surface picker. In manual placement, the object
snaps there and rotates to face that surface. With **Clamp** enabled, moving within
18 cm of a fitting plane also aligns it. Blocked furniture cannot receive a clue;
a clue that does not fit stays unchanged. The floor remains one continuous plane.
Table/chair legs and low inaccessible gaps block placement; elevated furniture
leaves floor usable when the modeled clearance is sufficient. Undo and Redo restore these edits.

The Placement section names the current method. **Manual placement** gives you
the exact position; **Author remotely** enables **Automatic placement**, where
surface choices become preferences and the room resolver chooses a safe point.
Automatic wall presets retain their wall preference; a safe tabletop substitute
lies flat on the table. Rotate and Scale remain available for deliberate edits.
The reference rooms are synthetic. The overhaul candidate also exposes protected
photo reconstruction when the existing private-media providers and OpenAI allowance are ready.

Open **Spatial Studio** from Creator Studio, or select **Add Spatial Moment** on a Chronicle passage. Guided mode starts with a Desk Map and keeps the canvas at the center of the workspace.

The [Phase 3 implementation](Phase_3_Implementation.md) and [refined workstation](Phase_3_Workspace_Refinement.md) are software-qualified on protected main through PR #711 and received explicit owner visual approval on 2026-10-11. The editing workflow is:

- Add a visual asset to the current scene from the asset browser, or drag it into the viewport. **New scene** opens a separate spatial moment.
- Select an object in the scene or hierarchy. Choose **Move**, **Rotate** or **Scale** to use its gizmo. Drag empty space to orbit, Ctrl-drag or middle-drag to pan and scroll to zoom. Plan and elevation views help inspect placement; precise inspector controls and keyboard movement remain available.
- Collapse the library or inspector to enlarge the viewport. Resize a dock from its edge, or focus the separator and use arrow keys.
- In the [workspace refinement candidate](Phase_3_Workspace_Refinement.md), choose Spatial Editing, Scene Construction, Behavior Authoring or Focus / Immersive from **Workspace layout**. The left icon rail opens Library, Hierarchy and Saved sections. The Inspector exposes contextual accordion sections; the bottom strip opens Timeline, Simulation, Diagnostics or Events. Drag a dock edge or use its separator arrow keys. **Reset Workspace Layout** restores the default; presentation preferences never edit the scene.
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

After Apply, the Assistant distinguishes saved changes from the canvas check.
The check waits for a render of that exact saved scene. It reports whether each
affected object is in view, hidden as authored, outside the view, occluded or too
small to read. **Locate … in canvas** selects an object for the existing Frame
selection and Isolate controls. A missing or failed renderer keeps confirmation
pending rather than claiming the object appeared. State transitions follow your
Full, Gentle or Reduced motion preference without delaying saving or inference.

If a save conflicts with another revision, preserve your work as a new fork or reload the authoritative item. An immutable version is never overwritten. Synthetic previews are authoring aids; representative-device acceptance and physical tracking qualification remain separate.

## Use models, lights and compositions

The Library dock groups models by family and separates lights, atmosphere, particles, projections, spatial audio, phenomena and interaction regions. Search by name or description, filter by element type, then click Add or drag a card into the viewport. Model previews show the actual exported geometry. Select an element to edit its supported properties in the Inspector; ordinary placement, transforms, Undo and save controls remain available.

When dragging a physical model into a fixed Scene, move over a supported visible floor, wall or table. The candidate support highlights; release to check whether the model fits near the pointer. A failed fit leaves the Scene unchanged and explains why. Click Add when you want the existing automatic placement choice. Other presets use their authored starting positions when dropped and can then be moved with the normal editing tools.

To preview Ghostly Presence, add it from Compositions. Its blue light, mist, particles and synthesized ambience remain separate children in Hierarchy. Adjust each child, enable an entrance envelope, then play the existing timeline. Enable preview audio deliberately to hear positional ambience; pause or mute stops it. Reduced motion keeps stable effects. Point and spot lights affect the actual scene; ambient light fills the scene and has no meaningful position or range control.

If preview audio is unavailable, audio stays off and the control explains the fallback while the element's text remains available. Returning from Guided View resets audio activation; enable it again in the rendered preview when audio becomes available. Keyboard users can Tab to an asset's selection control and use arrow keys for fixed placement; slash opens assistance and Escape returns focus to Ask Parallax.

On narrow screens, open **View & audio controls** to change quality, enable audio, frame the Scene or change the camera. Close the disclosure to return to the full-width canvas. Transform tools, the selected object and feedback stay beside the Scene; the vertical Library and Inspector docks retain their ordinary controls.

Select the composition root and use Save selected composition. Open Saved and choose Insert composition to add an independent copy to another fixed Scene. Saving a Scene and reloading it retains its elements, child relationships and authored timing. Imported arbitrary models/audio, volumetric fog, occlusion-aware projection, live cloth simulation and automatic proximity triggers are not provided by these controls. Current Player/native adapters preserve meaning through Guided View for the new element types.

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

Choose **Environment** to explore ten distinct synthetic layouts: Bedroom, Living room, Small dorm, Office, Classroom, Gallery, Outdoor trail, Plaza, Empty room and Cluttered room. Each contains furnishings or scenery appropriate to its name. Surfaces follow the displayed geometry; the floor remains one complete plane. Furniture footprints prevent floor placement underneath objects. These invented previews do not reconstruct a room from photographs.

In the environment-construction overhaul candidate, indoor presets have complete
walls and ceilings; the editor hides camera-facing architecture for cutaway
viewing. Windows and doors cut matching wall openings. Empty Room has only its
architecture, Cluttered Room has editable supported box stacks, and Outdoor Trail
has continuous terrain and a walking strip. Sloped banks are excluded from planar
placement. These reference specifications remain invented authoring fixtures.

Open **Room feature editor → Construction checks** to inspect support, containment,
openings, overlaps and declared paths. Select a named finding to edit its feature.
Checks update as you edit; confidence and visual quality remain separate. Photo
proposals with geometric problems request clarification before saving a room.

## Preview object animation (overhaul candidate)

In the current overhaul candidate, open **Timeline**, select an object and choose
Position, Rotation, Scale or Visibility. **Record keyframe** captures a value at
the current time. Edit time and values below; rotation uses degrees, positions
use local-anchor meters. Choose Step, Linear or Ease in/out. Visibility changes
are discrete. Drag diamond markers or use arrow keys to move their timing; use
Timeline zoom for a shorter visible window.

Drag the blue playhead handle or a blank part of the ruler to scrub the actual
scene continuously. The vertical line spans every track and follows playback;
the readout shows the current scene time. Scrubbing pauses playback. Focus the
handle and use Left/Right for 0.1-second steps, Shift for one-second steps, or
Home/End for the visible window edges. **Show current time** brings an
out-of-window playhead back into view without changing the preview time.
Play, Pause, Restart and Stop share this scene clock. Scrubbing preserves the saved static pose.
Undo/Redo, duplication, deletion and draft saves retain the associated tracks.
Automatic placement owns position; orientation, scale and visibility can still
be animated. A timed visibility event wins a tie with a visibility keyframe.

The **Events** section shows matching triggered changes and the renderer's
current visibility diagnosis. Reset Simulation clears transient inputs and
returns to time zero. If nothing changes, check the behavior's source, trigger,
delay and target. These previews do not advance a live Chronicle.

**Grid** controls discrete movement/rotation/scale increments; **Clamp** aligns
moved objects to nearby clear surfaces. Turn Clamp off for free positioning.
Frame selection fits the selected object's bounds. Isolate selected object hides
the reference room and other objects; Show room restores them. Reveal in editor
returns to static editing and exposes a hidden layer. A renderer error keeps the
draft and offers **Retry 3D renderer**. These candidate changes await complete
rendered qualification of the broader overhaul.

## Edit room features (overhaul candidate)

Choose a named environment, then **Edit room features** to make its geometry
part of the saved scene. Select a feature to change its name, classification,
position, width, height, depth or rotation around the floor. This changes the
actual room in the canvas. A clue bound to an edited desk follows that desk.
Resizing the whole room moves feature positions proportionally; furniture keeps
its own dimensions. Invalid measurements show an error and preserve the room.

Feature descriptions distinguish simulated geometry, inference and Creator
confirmation. These invented rooms are editable authoring aids. Save and reload retain the
edited room and ordinary Undo/Redo can restore earlier edits.

## Reconstruct a room photograph (overhaul candidate)

Open **Room photograph reconstruction** in the Inspector. Configuration status
explains whether private storage, scanning and OpenAI processing are available.
Manual room editing remains available when they are not configured.

The Windows owner preview can be resumed with the persistent local photo
configuration described in [local setup](Parallax_A1_Local_OpenAI_Configuration.md).
Its development scanner is explicitly labeled as uncertified. Configuration
readiness means import and inference can be attempted; geometry validation can
still request clarification without changing the authored room.

Choose a JPEG, PNG or WebP of at most 8 MiB and explicitly authorize sending its
sanitized image to OpenAI for room reconstruction and token counting. Use room
views without people or readable private documents. Review the proposed approximate
dimensions and uncertainty, then choose **Preview room proposal** to inspect its
actual geometry without saving. **Return to saved scene** restores the current
room; **Discard room proposal** removes the proposal. **Apply and save room** saves editable
geometry through ordinary scene history; it does not publish the photograph.
The camera uses a cutaway view while preserving all modeled walls as surfaces.

For another photograph, choose a recognizable **Shared room feature**. A reliable
match refines the same room and preserves feature identities; uncertain alignment
asks for clarification. Confirmed manual corrections and known measurements take
precedence. Correct approximate furniture and scale with the Room feature editor.

**Cancel photo processing** preserves the authored scene. Each imported photo has
a separate withdrawal control, available again after reload. Processing permission
expires after 24 hours or withdrawal; existing authored geometry remains. Private
photographs follow Sealed Hold retention rather than being deleted at that deadline.
The candidate's synthetic development walkthrough does not establish live vision
accuracy, production private-provider readiness or physical room calibration.

**Add room features** creates a generic furnishing of the chosen type. A
classification change edits its label; **Rebuild generic feature shape** changes
its actual model while retaining its name, dimensions and position. **Remove
room feature** removes an unbound feature. Move attached clues to another
support before removing or rebuilding their supporting feature. The whole floor
stays a single feature. In editable rooms, parallel windows and doors intersecting
a wall cut openings through that wall. Surfaces exclude those openings while
retaining one wall identity. Detached or perpendicular features do not cut it.

Under **Scale room from a known measurement**, choose the selected feature's
width, height or depth and enter its measured metres. Apply scales the room and
its furnishings together and retains that reference. Other dimensions remain
estimates. Authored clue sizes keep their metres and follow their supports.
Use Reset view to frame a substantially resized room. Editing the reference
dimension later clears the obsolete scale reference.

## Reuse an object or a complete scene (overhaul candidate)

Select an object and open **Library, reuse & publication**. Enter its asset name,
description and classification, then choose **Save selected object as reusable
asset**. A group includes its children and saves as a reusable assembly. This
creates a separate definition and an immutable version; the source scene stays
unchanged. Dependencies on objects outside the group or on protected media must
be resolved before export. Export and insertion require manual placement.

Open **Saved** from the left rail. Filter by scenes, reusable objects, assemblies,
templates or recent items; search by name, description, classification or tag.
The preview is a labeled schematic of authored bounds. **Add to current scene**
copies the latest released asset into the current scene. Edit and save that
instance with the ordinary Inspector; those edits affect only this scene.
**Open** edits the original definition. Create another immutable version when
you want later insertions to use definition changes. Earlier copies retain their
stored data and version origin.

**Create new scene from this** copies an entire scene, including room geometry,
behaviors and animation. **Archive** removes another definition from Saved
discovery while existing scene copies remain intact. Switch away from a
definition before archiving it. Imported-model rendering remains unavailable.

## Inspect simulation outcomes (overhaul candidate)

Open **Simulation** in the bottom dock. Select an object, then use its available
Inspect, Pick or Place action. If no authored behavior matches, the panel explains
how to add one in Timeline. A matching behavior shows its target, action and due
time. **Preview next delayed action** seeks to the next scheduled action;
**Run simulation** plays the shared clock and **Pause simulation** holds it.

Evaluated objects show visible/hidden, highlighted and animated state beside the
renderer's current visibility diagnosis. For an object outside the view or
occluded, select it and use Frame selection or Isolate in the canvas. Interaction
results distinguish waiting delays, evaluated actions and objects excluded from
Player preview by their layer audience. Engineering adds local coordinates.

**Reset simulation** clears transient interactions, returns to time zero and
shows the initial Player preview. Switching scenes stops playback. Saving
retains authored behaviors and keyframes; reload starts a fresh simulation.
The input limit is 128; reset before adding more interactions. Studio simulation
does not advance Chronicle progression or establish physical AR qualification.

## Candidate branch: Scene Graph and context commands

In the active overhaul branch, select an asset in Scene Graph and use its top
icon toolbar to show/hide, lock/unlock, duplicate or remove it. Rows contain asset
identity and read-only hidden/locked indicators. Icons retain tooltips and names
for assistive technology. Removal requires an unlocked object and preserves the
scene's final object; ungroup children before removing a parent.

Right-click an object, graph row, built-in preset or saved definition for its
available commands. The viewport background offers camera and surface controls.
For keyboard use, focus an object/row or canvas and press Shift+F10 (or the menu
key); arrow keys move through actions and Escape dismisses the menu. Saved items
also have a visible actions button. Disabled actions preserve existing locking,
preview, proposal and Library restrictions. Changes use ordinary Undo and Save.
These candidate interfaces are still under browser and visual qualification.

New **Ghost Footprint Trail** presets have five flat boot prints with alternating left/right tread. Duplicating a print or saving it as a reusable asset preserves its side. Existing saved trails retain their authored orientation and size; use the Placement controls to reposition them deliberately.

In the overhaul candidate, choose **Opacity (0–1)** to fade an object’s material. **Add opacity animation** creates a two-second fade from full material to transparent; edit either value or time to change it. One preserves the material’s original translucency, and zero is fully transparent. Play animates the fade; Stop restores its starting value. **Reveal in editor** makes a transparent or very faint object editable without changing the saved animation. Older native companions explain when they cannot preview fading and retain Guided reading.

## Candidate branch: manipulate room features

Choose **Edit room features**, select any feature in the viewport or the room
feature picker, then use the same **Move**, **Rotate**, **Scale**, coordinate-space
and grid controls used for objects. Inspector follows the selection. Room rotation
is upright around Y; scale is uniform. Use Inspector for individual dimensions.
Declared mounted/supported features follow their support, and authored clues
bound to its surfaces follow the edited geometry. **Frame selection** finds a
selected architectural feature even when the normal cutaway hides it.

Changes use ordinary Undo/Redo and Save. Construction checks can flag invalid
support, openings or overlaps after free editing; inspect those findings before
using the environment. **Finish environment editing** restores object selection.

## Candidate branch: Library environments

Open **Library** on the left rail and choose **Assets** or **Environments**.
Edited and reconstructed rooms appear automatically as entries for their saved
source scenes. Click an environment name to rename it, choose **Edit environment**
to open its source scene, or **Use environment** to copy its geometry into the
current scene. Review object placements when changing environments. Scene copies
keep their own geometry and edits. **Delete from Library** removes discovery of
that entry while retaining room geometry in its scene and existing copies;
editing that room again makes it appear in Library. All entries use ordinary
account ownership, save conflicts and persistence.

With an object selected in manual placement, click a visible room surface to
place and align it at that point, even with **Surfaces** closed. Undo restores the
previous placement. Room-feature editing selects geometry instead. Locked objects,
unsafe surfaces, occupied areas and insufficient space retain their constraints.
Automatic placement continues to edit semantic surface preferences.

The page title is **Parallax** in the upper left. The current scene is labeled
**Scene** at the top center. For room features, **Door state** can show an open
frame or closed leaf, and **Appliance shape** distinguishes projectors, instruments
and wall panels. Historical saved shapes remain until deliberately changed.

## Candidate branch: exclusion zones

Choose **Edit room features** to reveal outlined translucent boxes around
modeled surface blockers. Open **Exclusion zones** to **Find surface blockers**
or **Add exclusion zone**. Select a zone in the viewport or Room feature picker;
use the usual Move, Rotate, Scale, name and dimension controls. Choose
**Reserved surface** to limit a reservation to one support, or **Intersecting
surfaces** for a free-standing volume.

When Parallax finds a fitting placement, it avoids reserved areas and searches
for nearby clear space. Automatic envelopes follow their modeled blocker.
Changing an envelope's bounds makes it independent; deleting it stays deleted.
Actual solid furniture remains protected even after its envelope is removed.
Finish environment editing hides the boxes and returns to object editing.
Reservations use ordinary Undo, Save and environment Library persistence.
Historical rooms gain automatic envelopes when explicitly enabled for editing;
new photo proposals include them. These volumes describe placement reservations,
not additional objects detected in a photograph. Lens inputs and lens correction
are deferred at the owner's request. Six focused browser journeys passed at f569d894, followed by a selected-feature identity recapture at 265de11b. Independent review accepted bounded Engineering controls, and the owner accepted the supplied presentation on 2026-10-13. Phone evidence covers numeric editing, not physical touch gizmos.

## Create an environment from Library

Open **Library → Environments**, then use **+ Add environment**. Choose an existing saved room or a preset to create an independent copy, or choose an empty environment to start with an editable floor and walls. The source room remains saved. The new environment opens with room editing enabled.

**From photos** accepts one or two JPEG, PNG or WebP views of the same room, up to 8 MiB each. Review the local thumbnails, authorize private image processing, then reconstruct. Import and inference show progress with a reduced-motion alternative and a cancellation control. No dimension or lens-value input is required. Scale and hidden geometry are estimates.

The photo setup separates **Photos**, **Build** and **Review**. While building,
the form gives way to the animated room outline, an **About 1–2 minutes** waiting
estimate and a live elapsed timer from the start. This estimate reflects bounded
local Sol tests, not a countdown or progress percentage. Requests can take longer;
after two minutes the view says so and keeps cancellation available. Timeout,
connection failure, cancellation and a request for a clearer view remain visible
at the top of the setup. **What happened** reveals the detailed reason; selected
photos stay available for a deliberate retry. No retry starts automatically.
Privacy details and imported-photo withdrawal controls use separate disclosures.

Review the actual 3D proposal inside the setup window before **Apply and save room**. Orbit the preview and check features, furniture placement and orientation. Applying saves an independent room and opens its editable features. Failed inference does not create substitute geometry. Closing or discarding the proposal preserves the original scene; a reconstruction attempt may retain an independently saved photo draft and private permissions under the stated retention policy. Permission withdrawal remains available through that draft's photo controls.

The setup flow is implemented on the candidate branch. Its bounded development journeys and independent navigation review passed; the owner accepted its presentation. Reconstruction layout fidelity is separately unresolved; successful UI processing is not proof of a surveyed room or physical AR alignment.

## Assistant follow-ups and editing

Continue a task conversation to refine the object or group you just discussed.
The Assistant uses the established subject for follow-up corrections; name a
new object or explicitly say selected object when you mean a different target.
Ambiguous or removed subjects need clarification. Send clears the input while
retaining the conversation; Start new task clears the prior task.

The current candidate also proposes asset removal/duplication, hierarchy/order,
visibility/locks, scene title and library details, interactions, and timeline
tracks, timing and motion style. Room feature commands require the environment
pencil toggle. Review changes in the canvas before Apply. Removal affects the
scene copy; existing editor validation and Undo remain available. This candidate
still needs complete Studio acceptance and protected integration.

## Working drafts and Library continuation

The active PR #722 candidate autosaves a stable working definition without adding saved cards. Save to Library deliberately establishes membership on that identity. Save as new asks for a name, type and destination and creates an independent definition. Working Drafts and Legacy review remain recoverable views. Collections, favorites, typed search and archive/restore organize existing identities. Version history previews immutable snapshots and restores only mutable working content.

Environments are now independent definitions. Creating/editing/reconstructing one does not manufacture a Scene. Using a room in a Scene records an independent snapshot; editing the original does not update other Scenes or Chronicles. The Inspector distinguishes original definitions and placed instances. Conflicting saves retain pending work and require review or an explicit named copy. See [lifecycle details and verification boundaries](Spatial_Library_Lifecycle_20261014.md).

The original instruction/model measurements above remain historical. The [room instruction continuation](reference/Room_Instruction_Continuation_20261014.md) adds explicit rotated-frame seating offsets and returned-support requirements. A prompt adjustment alone does not prove improved reconstruction fidelity.
