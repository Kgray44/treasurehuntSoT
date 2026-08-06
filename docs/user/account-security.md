---
title: Account security and connected identities
audience: user
status: current
canonical_for: account-security-guide
last_reviewed: 2026-08-05
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

Phase 6 presents anonymous, session-expired, revoked/invalid, account-restricted,
permission-restricted, dependency-unavailable, and token lifecycle decisions as
distinct accessible states. Security and Sessions mutations show pending,
success, failure, and safe recovery without displaying raw session identifiers.
Live identity-provider behavior remains outside this proof.

## Phase 7 correction Round 1 status

The owner returned walkthrough Round 1 for correction. The corrected capability has completed local automated validation and is awaiting owner re-review; it is not yet included in a published release. Live email delivery and Discord, Steam, and Microsoft/Xbox connections still depend on separately configured services. Automated accessibility coverage does not replace testing with physical assistive technology.

## Phase 7 correction Round 2 status

Correction Round 2 is locally exact-source validated and ready for owner re-review. Dark, Light, and System themes; truthful account/Profile/workspace state; authoritative Community saves and completion-verified reviews; expanded previews; delayed loading; motion; synthetic email boundaries; and Experience Images are included. Round 2 remains `PENDING_OWNER_DECISION`; this branch is not merged or deployed, and live providers remain external.

## Phase 7 correction Round 3 status

Correction Round 3 is locally exact-source validated and ready for owner re-review. It adds governed Profile imagery/cropping and identity propagation, six-digit verification, a Postmark production adapter with task-owned synthetic isolation, ordinary Player/Captain/Creator entry separated from resource authority, direct route crossfades, visible account-menu motion, and Dark defaults. Owner Re-Review Round 3 remains `PENDING_OWNER_DECISION`; the branch is not merged or deployed. Postmark is `POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION`, broad Light Mode visual completion is deferred, and production MySQL plus physical assistive-technology validation remain external.
