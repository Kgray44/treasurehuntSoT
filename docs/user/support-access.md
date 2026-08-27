---
title: Support Access
audience: user
status: current
canonical_for: support-access-guide
last_reviewed: 2026-08-27
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
Chronicle-history metadata, Voyage membership, Community-activity summaries,
session diagnostics, Profile diagnostics, safe runtime status, and audit
correlation. A scope never includes passwords, credential hashes, session or
provider tokens, provider secrets, encryption keys, private Chronicle prose,
private media, raw logs, or arbitrary system access. Sensitive reads create a
sanitized audit event.

Denial, cancellation, expiry, revocation, session loss, role loss, a wrong
operator, a wrong target, or an unapproved scope all deny access. If a request
does not match the assistance you expect, deny it and contact the service owner
through a separately trusted channel.

Project Admiralty Phase 1 is owner accepted on canonical main. Phase 2 places
the same consent flow in the account dossier for authorized support operators;
it does not weaken target approval, exact scope, recent assurance, expiry,
revocation, or auditing. The owner accepted the Phase 2 walkthrough, and its
exact-source authority and protected mainline integration completed in PR #28.
Neither phase is claimed deployed by this guide.

Support Pilot S1 lets an authorized operator open a human-readable support
case from the same consent boundary. A case states its safe purpose and exact
diagnostic scopes; approving it may enable one short-lived, read-only
diagnostic session. The session records only sanitized evidence references,
findings, and an informational next-action proposal. It cannot repair account,
Voyage, Community, session, job, configuration, or other platform state.
