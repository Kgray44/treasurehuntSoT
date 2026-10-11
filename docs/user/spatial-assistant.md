---
title: Spatial Assistant Creator guide
audience: creator
status: implementation-candidate
canonical_for: spatial-assistant-creator-guide
last_reviewed: 2026-10-11
---

# Describe your spatial idea

The A1 Spatial Assistant is an implementation candidate. Its shared Studio
integration and visual review are pending; this guide describes the candidate
review experience and does not announce general availability.

Select an object and describe the experience you want. For example: “Move the map
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

If a request is unclear, answer the clarification with the object, direction,
distance, exact text or interaction you mean. Refine and send a new request when
you want a different proposal. The Assistant never chooses to apply a proposal
for you. An edit, Undo or Redo while a proposal is pending clears that review;
prepare a new proposal against the current scene.

Supported proposals create readable text, parchment and markers; adjust object
details, position, size and placement; configure supported inspect/pick/place
interactions and timed show/highlight behavior; and improve Guided alternatives.
Physical illumination, particle effects, custom materials and automatic
recognition need capabilities the Assistant cannot supply. It explains the
limitation or suggests a supported alternative.

Your remaining allowance and reset time appear in the panel. Advanced assistance
requires account permission and a deliberate selection. A cancellation or
provider failure keeps your draft safe. If a save acknowledgement is uncertain,
retry the same reviewed change. Assistance can be unavailable because it is
unconfigured, disabled, temporarily unreachable, or at an allowance limit. You
can continue editing manually.

Only your submitted instruction and bounded scene context are sent for
interpretation. Existing clue text, private Guided descriptions, media and other
accounts' content are excluded from that context. Object labels are included;
avoid putting sensitive information in a submitted instruction or label.
