---
title: Account security and connected identities
audience: user
status: current
canonical_for: account-security-guide
last_reviewed: 2026-08-03
---

# Account security and connected identities

Personal Harbor separates ordinary account security from session management.
**Security** starts the accepted password-reset and recovery lifecycle; it does
not display or invent a current password. **Sessions & Devices** lists bounded
device metadata, lets you revoke an owned session, and provides an explicit
Sign Out Everywhere confirmation. Revocation does not delete Voyage records.

**Linked Identities** shows safe provider summaries only. Provider secrets,
access tokens, refresh tokens, and requested scopes are not returned to the
page. Protected unlinking cannot remove the last accepted sign-in path and does
not pretend a disabled or simulator adapter is a live provider.

**Data & Account** distinguishes available controls from unsupported export,
deactivation, or deletion operations. An unavailable operation is labelled;
there is no decorative destructive button.

These surfaces are complete on the Project Homeport Phase 3 branch, not on main
or deployed. Live identity-provider behavior remains externally unvalidated.

Phase 5 gives each account section a visible desktop/mobile entry and a stable
return to Personal Harbor. Password-reset and verification URLs remain
tokenized deep links with valid, invalid, expired, consumed, or revoked recovery
states; they never appear in ordinary navigation and committed evidence contains
no token material. This is branch-local synthetic proof, not live-provider or
deployment evidence.
