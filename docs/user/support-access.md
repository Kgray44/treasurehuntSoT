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







Support Pilot S1 lets an authorized operator open a human-readable support
case from the same consent boundary. A case states its safe purpose and exact
diagnostic scopes; approving it may enable one short-lived, read-only
diagnostic session. The session records only sanitized evidence references,
findings, and an informational next-action proposal.




Support Pilot S2 may also ask you to approve a named registered repair. The
screen shows each exact command before you decide. Approval does not give
general Administrator power: a repair still needs fresh assurance, a current
proposal, a hard risk/budget ceiling, and postcondition verification. You can
decline named repair authority, approve only diagnosis, or revoke active access
at any time.
