---
title: Admiralty Command Center
audience: administrator-support-operations-security
status: current
canonical_for: admiralty-command-center-guide
last_reviewed: 2026-08-27
---

# Admiralty Command Center

Project Admiralty is Voyagewright's governed platform-administration surface.
Phases 1 and 2 are owner accepted and integrated on canonical main. Phase 2's
exact-source authority and protected integration completed in PR #28; neither
phase is a deployment claim.

An identity with an active Admiralty role sees **Admiralty** in the account
workspace menu. The visible areas are filtered by named read capabilities:
Platform Overview, People, Chronicles, Voyages, Community, Operations,
Providers, Configuration, Releases, Audit, and Investigate. Direct routes also
authorize independently; hiding a menu item is never the security boundary.

The Chartroom is read-only except for inherited Phase 1 Support Access. Account
diagnostics still require recent privileged assurance, an exact request, target
consent, operator/target/scope/time matching, and canonical audit evidence.
Revocation closes the grant immediately.

## Support Pilot S1 cases

An operator with `SUPPORT_REQUEST` can open `/admin/support/cases` for an exact
target and a bounded purpose. The case creates the owner-visible Support Access
request; no administrator role, case record, or recent-assurance session can
substitute for that consent. An operator additionally holding `SUPPORT_USE`
may, after fresh privileged assurance, begin a short-lived execution that is
bound to the exact case, operator, target, active grant, approved scopes, and
expiry.

The S1 console shows case and consent status, expiry or revocation, execution
status, sanitized evidence provenance, findings, diagnosis, and an
`INFORMATION_ONLY` repair proposal. S1 can write its support-control and audit
records, but it has no repair executor and cannot mutate user, Voyage,
Community, session, job, projection, or configuration truth.

Statuses name their source, environment, freshness, observation time, and safe
failure meaning. `UNAVAILABLE`, `STALE`, and missing-contract states are not
treated as healthy. Transactional-email delivery and live verification-provider
health remain unavailable until their canonical owners publish accepted safe
operator contracts.

Admiralty never exposes passwords, session or OAuth secrets, CSRF material,
provider credentials, private Chronicle content, raw event/job payloads,
Community report prose, private assets, object keys, storage roots, encryption
material, or arbitrary database access. Broad administrative mutation is a
later-phase capability and is not present in Phase 2.
