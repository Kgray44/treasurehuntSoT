---
title: Captain guide
audience: captain
status: current
canonical_for: captain-guide
last_reviewed: 2026-08-05
---

# Captain guide

Use the Captain Library to select a Chronicle, prepare a Voyage, and manage its invitations. The Captain session views support monitoring and player preview where enabled. Start only when participants are expected to have access, and use the session controls rather than sharing a private route directly.

Expected result: invited Players can see the Voyage in their library and the Captain can open the relevant session view. If a participant is blocked, re-check their invitation and account role; do not expose Chronicle material to diagnose access.

Creator authoring is separate: see the [Creator guide](creator-guide.md). Operational safety is in [private-content guidance](../administrator/private-content.md).

On the Project Homeport Phase 1 branch, Captain and Creator entry addresses
forward to the single ordinary account sign-in. A signed-in account without
the required capability receives an explicit permission state instead of a
second password prompt. Historical mapped staff sessions are rotated into the
canonical account session; an unmapped legacy session grants no authority.
This branch behavior is not yet available on main.

On the Phase 2 branch, the Captain shell separates global Community Harbor
from Captain-owned Voyages and Crew invitations. Account switches to Player or
Creator Studio only when the signed-in account has those capabilities.
Focused Captain session routes provide Exit to Captain Voyages instead of
depending on browser history. This behavior is not on main or deployed.

On the Phase 5 branch, Captain Library, invitation, Tale, Voyage preview, and
session controls provide the governed sources for their detail routes. The
historical Quartermaster surface links directly to the canonical Captain
Library instead of competing with it. Permission denial and invalid identifiers
retain safe recovery paths. This is branch-local synthetic proof, not a `main`
merge, deployment, or owner acceptance.

Phase 6 completes Captain Library and session presentation with human status
labels, structured confirmation dialogs, visible pending/failure feedback,
keyboard focus restoration, and responsive tablet/mobile controls. Synthetic
browser evidence does not establish live Voyage operations, deployment, or
owner acceptance.

Phase 7 proves a returning account can reach Captain Library and the seeded
session through visible controls, then move to Profile, Player, Creator Studio,
Passport, and sign-out without a second identity. This whole-voyage evidence
is local and synthetic; the owner decision remains pending.

## Phase 7 correction Round 1 status

The owner returned walkthrough Round 1 for correction. The corrected capability has completed local automated validation and is awaiting owner re-review; it is not yet included in a published release. Live email delivery and Discord, Steam, and Microsoft/Xbox connections still depend on separately configured services. Automated accessibility coverage does not replace testing with physical assistive technology.
