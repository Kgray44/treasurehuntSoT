---
title: Project Admiralty Support Pilot S3 Architecture
audience: product-engineering
status: current
canonical_for: admiralty-support-pilot-s3-architecture
last_reviewed: 2026-08-28
---

# Support Pilot S3: Close the Case

S3 adds one finalization action to a case owned by the current support
operator. It is not a repair, does not change customer or platform data, and
does not enlarge the S2 registry.

`operator assurance -> owned active case -> no running durable execution -> cancel or revoke remaining access -> CLOSED audit receipt`

The close route requires `SUPPORT_USE`, CSRF validation, recent privileged
assurance, a bounded safe reason, and rate limiting. A stale, foreign, or
terminal case fails closed. A diagnostic session still `RUNNING`, or a repair
still `PENDING` or `COMMITTED`, refuses closure until it has a durable outcome.

Within one transaction S3 cancels an unanswered support request, revokes an
active parent Support Access grant, revokes all still-active delegated
execution grants, stamps `CLOSED`, and writes the administrative audit record.
Repeating a completed close is safe and returns the existing closure state.
The existing case timestamp and immutable administrative audit record are the
durable closure receipt; no new sensitive case narrative store is introduced.

S3 retains every S1/S2 exclusion: no raw SQL or shells, secrets, private
content, authorization or privacy-control mutation, source mutation, audit
rewriting, unregistered repair, or automatic compensation.
