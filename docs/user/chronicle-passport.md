---
title: Chronicle Passport
audience: user
status: current
canonical_for: chronicle-passport-guide
last_reviewed: 2026-08-01
---

# Chronicle Passport

Chronicle Passport is the profile surface for your account identity, handle, preferences, and permitted profile presentation. Update only information you want associated with your account, and use privacy controls where offered.

Expected result: allowed profile changes appear on your Passport without granting access to another person's Voyages. If you see an unexpected profile or shared item, stop and report the access concern privately under [SECURITY.md](../../SECURITY.md).

Related: [privacy](privacy.md) and [troubleshooting](troubleshooting.md).

On the Project Homeport Phase 1 branch, the Passport and product shell read the
same server-resolved current-user context. Signing in, signing out, accepting
an invitation, changing roles, expiring or revoking a session, and returning
to a visible tab all trigger a fresh authoritative check. Browser storage and
route names are never treated as authorization. This branch behavior is not
yet available on main.

On the Phase 2 branch, Account groups View My Profile, Chronicle Passport,
Preferences, Privacy & Safety, Chronicle History, Artifact Cabinet, and
Security & Sessions. Those controls resolve to current Passport sections or
account security; they do not create empty pages. The stable section anchors
are a wayfinding adapter only. Personal Harbor information architecture,
provider-control cleanup, and visual reconstruction remain Phase 3. This
branch behavior is not on main, deployed, or owner accepted.
