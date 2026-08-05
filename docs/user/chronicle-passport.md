---
title: Chronicle Passport
audience: user
status: current
canonical_for: chronicle-passport-guide
last_reviewed: 2026-08-05
---

# Chronicle Passport

Chronicle Passport is your private, record-led home for the Voyages you joined,
Memories you kept, artifacts granted to you, and eligible Community items you
saved. It is related to your public Profile, but it is not the same surface.
Use [Profile](profile.md) to control the identity other people may see.

Expected result: Passport lists only records authorized for your signed-in
account. Chronicle History opens version-pinned Voyage records; Memories and
private Keepsakes stay owner-authorized; Artifact Cabinet entries retain grant
provenance; Saved from Community contains only eligible public items you chose
to keep. Empty sections explain that no records exist instead of offering test
controls or simulated data.

Related: [Profile](profile.md), [account security](account-security.md),
[privacy](privacy.md), and [troubleshooting](troubleshooting.md).

On the Project Homeport Phase 1 branch, the Passport and product shell read the
same server-resolved current-user context. Signing in, signing out, accepting
an invitation, changing roles, expiring or revoking a session, and returning
to a visible tab all trigger a fresh authoritative check. Browser storage and
route names are never treated as authorization. This branch behavior is not
yet available on main.

On the Project Homeport Phase 3 branch, `/passport` and its History, Memories,
Artifacts, and Saved sections are complete product routes. Desktop and mobile
show the same Personal Harbor destinations. The evidence is synthetic and
branch-local; this behavior is not on main, deployed, or owner accepted.

On the Phase 4 branch, saving or unsaving eligible Community content preserves
the Harborlight authoritative state and reconciles after refresh with Saved
from Community. Ineligible, removed, archived, quarantined, or no-longer-public
subjects do not become private copies in Passport. A failed mutation restores
the prior state and allows retry. This remains branch-local synthetic evidence;
it is not on `main`, deployed, or owner accepted.

On the Phase 5 branch, History and Artifact lists are the genuine sources for
their detail routes, and every Passport section has a visible parent, return,
and equivalent mobile entry. Empty and invalid-detail states provide a safe
onward action instead of requiring browser Back. This remains local synthetic
evidence; repository-wide Phase 6 states, deployment, and owner acceptance are
not claimed.

Phase 6 completes Chronicle Passport overview, History, record, Artifact
Cabinet, provenance, Memories, and Saved surfaces with deliberate populated,
empty, error, dependency, removed, permission, mutation, and media-fallback
states. Desktop, tablet, mobile, narrow-mobile, and effective-200-percent
compositions are branch validated with synthetic records only.

## Phase 7 correction Round 1 status

The owner returned walkthrough Round 1 for correction. The corrected capability has completed local automated validation and is awaiting owner re-review; it is not yet included in a published release. Live email delivery and Discord, Steam, and Microsoft/Xbox connections still depend on separately configured services. Automated accessibility coverage does not replace testing with physical assistive technology.

## Phase 7 correction Round 2 status

Correction Round 2 is locally exact-source validated and ready for owner re-review. Dark, Light, and System themes; truthful account/Profile/workspace state; authoritative Community saves and completion-verified reviews; expanded previews; delayed loading; motion; synthetic email boundaries; and Experience Images are included. Round 2 remains `PENDING_OWNER_DECISION`; this branch is not merged or deployed, and live providers remain external.
