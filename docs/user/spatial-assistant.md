---
title: Spatial Assistant Creator guide
audience: creator
status: current
canonical_for: spatial-assistant-creator-guide
last_reviewed: 2026-10-12
---

# Describe your spatial idea

For precise manual placement, **Surfaces** lets you snap a selected clue to the
room's floor, walls or furniture and aligns it to the chosen plane. The Placement
section explicitly names manual or automatic placement. Automatic placement
chooses a safe position from your preferences; snapping, Undo and Redo consume no
AI requests. Current reference rooms are synthetic; photo reconstruction is not
available.

The Spatial Assistant is available in Spatial Studio when your administrator
has configured and enabled assistance for your account. Manual editing stays available.

Open **Ask Parallax** in Spatial Studio, select an object, and describe the experience you want. For example: “Move the map
near the entrance,” “Add a readable pirate note on the desk,” or “Highlight the
map one second after someone inspects it.” Send the idea deliberately. Typing,
selecting another object, and moving around the scene do not send AI requests.
Use Enter to send and Shift+Enter for another line.

The Assistant prepares proposed changes for your review. Read the explanation
and any limitations, then switch between the current and proposed scenes. You
can approve the complete proposal or choose independent changes. Changes that
depend on another change must be selected together. **Apply** saves reviewed
changes; **Reject** leaves the scene unchanged. Undo and Redo use the ordinary
editor history.

On a narrow screen, **View canvas** hides the panel while preserving the proposed
scene. Reopen **Ask Parallax** to continue the same review and apply or reject it.

The Assistant uses the Studio's blue appearance. Light appearance covers the
workspace, menus and preview environment. **Dock assistance** places the panel
over the scene; opening or docking it preserves the scene's size.
When floating, drag **Ask Parallax** in the title bar to move the window. Drag any
edge or corner to resize it. Focus the title or a resize handle and use arrow
keys; hold Shift for larger steps. Your account remembers the position and size
on this browser. **Reset Workspace Layout** restores the default. The composer
stays at the bottom while the conversation scrolls above it. The Library,
Inspector and bottom workspace sections contain the tools for your current
authoring mode. Detailed adds appearance and dependencies; Engineering also
shows coordinates and anchor diagnostics.

If a request fails, the feedback appears at the top of the panel and your message
stays in the composer. You can adjust it and deliberately send again. Unsupported
sizes or capabilities explain their limits and leave the scene unchanged.

After the scene is saved, its address identifies that working scene. Refreshing
reopens the same saved draft; its Chronicle and Passage context stay in the address.

If a request is unclear, answer the clarification with the object, direction,
distance, exact text or interaction you mean. **Refine this proposal** prepares
the composer for your follow-up. The candidate keeps bounded recent task context
for that scene, so an answer such as “The selected map” retains the original
instruction. Previous proposals remain suggestions; the saved scene determines
what exists now. **Start new task** clears the local task context and review,
leaving your scene unchanged. If older context has expired, start a new task and
describe the change using your current scene. The Assistant never chooses to apply a proposal
for you. An edit, Undo or Redo while a proposal is pending clears that review;
prepare a new proposal against the current scene.

Supported proposals create readable text, parchment and markers; adjust object
details, position, size and placement; configure supported inspect/pick/place
interactions and timed show/highlight behavior; and improve Guided alternatives.
In an adaptive scene, proposals can change the preferred surface, nearby entrance,
furniture or window, relative arrangement and partial concealment. Recipe changes
require a new calibration review. In a fixed scene, guided controls enable adaptive
placement when you need those constraints. Ordinary fixed placement stays available.

Physical illumination, particle effects, custom materials and automatic
recognition need capabilities the Assistant cannot supply. It explains the
limitation or suggests a supported alternative.

Your remaining allowance and reset time appear in the panel. Advanced assistance
requires account permission and a deliberate selection. A cancellation or
provider failure keeps your draft safe. If a save acknowledgement is uncertain,
retry the same reviewed change. Assistance can be unavailable because it is
unconfigured, disabled, temporarily unreachable, or at an allowance limit. You
can continue editing manually.

Your submitted instruction, up to two relevant previous task turns and bounded
scene context (up to four objects) are sent for interpretation. Select the relevant
object when working with a larger scene. The submitted instruction is retained
with its private proposal for the administrator-configured retention period;
the default is 30 days. It does not appear in general usage reports or browser
storage. Existing clue text, private Guided descriptions, media and other
accounts' content are excluded from that context. Object labels are included;
avoid putting sensitive information in a submitted instruction or label.

Choose **Environment** to explore ten distinct synthetic layouts: Bedroom, Living room, Small dorm, Office, Classroom, Gallery, Outdoor trail, Plaza, Empty room and Cluttered room. Each contains furnishings or scenery appropriate to its name. Surfaces follow the displayed geometry; the floor remains one complete plane. Furniture footprints prevent floor placement underneath objects. These invented previews do not reconstruct a room from photographs.

## Studio overhaul preview

The isolated overhaul preview keeps the same blue Studio design. In **Scene
Graph**, select an asset and use the icon toolbar above the list to show or hide,
lock or unlock, duplicate or remove it. The rows show assets and their status.
The Inspector presents the selected object first, followed by grouped settings
and separate environment tools appropriate to your authoring mode.

Right-click an object, graph row, preset, saved scene or empty canvas for commands
that apply there. With keyboard focus on a menu target, use Shift+F10 or the
Context Menu key; arrow keys move between available commands and Escape returns
focus. Locked objects and preview or pending operations limit applicable
commands. Edits retain ordinary Undo, Redo and Save.

In this preview, room features can be edited and saved. Photo-based room
proposals require configured private storage, clean scanning, explicit consent
and an available AI allowance. Missing configuration leaves manual room editing
available. Synthetic workflow checks establish preview, Apply, refinement and
permission withdrawal; they do not establish live photograph interpretation or
physical room accuracy. The complete overhaul remains in draft qualification.
