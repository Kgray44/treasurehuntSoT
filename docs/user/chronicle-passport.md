---
title: Chronicle Passport
audience: user
status: current
canonical_for: chronicle-passport-guide
last_reviewed: 2026-08-02
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
