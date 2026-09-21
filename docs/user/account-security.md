---
title: Account security and connected identities
audience: user
status: current
canonical_for: account-security-guide
last_reviewed: 2026-08-08
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




These surfaces are available on main through Project Homeport. Google and GitHub
OAuth are also on main and owner-accepted through the protected staging
experience. The owner completed real sign-in/sign-up with both providers and
returned successfully to Voyagewright without an internal-origin redirect.
Production provider configuration and deployment remain separately governed.
