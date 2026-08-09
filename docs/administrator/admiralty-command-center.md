---
title: Admiralty Command Center
audience: administrator-support-operations-security
status: current
canonical_for: admiralty-command-center-guide
last_reviewed: 2026-08-09
---

# Admiralty Command Center

Project Admiralty is Voyagewright's governed platform-administration surface.
Phase 1 authority is owner accepted on main. The Phase 2 Chartroom is currently
available only on its named review branch and remains pending owner walkthrough.

An identity with an active Admiralty role sees **Admiralty** in the account
workspace menu. The visible areas are filtered by named read capabilities:
Platform Overview, People, Chronicles, Voyages, Community, Operations,
Providers, Configuration, Releases, Audit, and Investigate. Direct routes also
authorize independently; hiding a menu item is never the security boundary.

The Chartroom is read-only except for inherited Phase 1 Support Access. Account
diagnostics still require recent privileged assurance, an exact request, target
consent, operator/target/scope/time matching, and canonical audit evidence.
Revocation closes the grant immediately.

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
