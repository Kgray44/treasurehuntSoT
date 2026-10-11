---
title: Spatial Assistant Creator guide
audience: creator
status: current
canonical_for: spatial-assistant-creator-guide
last_reviewed: 2026-10-11
---

# Describe your spatial idea

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
