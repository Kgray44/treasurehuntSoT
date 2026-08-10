---
title: Support Access
audience: user
status: current
canonical_for: support-access-guide
last_reviewed: 2026-08-09
---

# Support Access

Support Access is a temporary, consent-based way to let an authorized support
operator inspect a limited diagnostic projection for your account. It does not
give support staff your password or control of your account.

Open **Account > Support Access** to review pending requests. Each request shows
the requesting operator, purpose, exact scopes, and expiry. You can approve or
deny it. Approval creates a grant for only that operator, your account, and the
listed scopes; a Phase 1 grant lasts no more than 30 minutes. You can revoke an
active grant immediately from the same page.

Supported scopes cover account state, authentication-event summaries,
Chronicle-history metadata, Community-activity summaries, session diagnostics,
and Profile diagnostics. A scope never includes passwords, credential hashes,
session or provider tokens, provider secrets, encryption keys, private
Chronicle prose, or private media. Sensitive reads create a sanitized audit
event.

Denial, cancellation, expiry, revocation, session loss, role loss, a wrong
operator, a wrong target, or an unapproved scope all deny access. If a request
does not match the assistance you expect, deny it and contact the service owner
through a separately trusted channel.

Project Admiralty Phase 1 is ready for an owner walkthrough on its named
development branch. It is not on main, deployed, or owner accepted.
