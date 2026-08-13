---
title: Project Admiralty Phase 2 Mainline Safety Contract
audience: product-owner-engineering-security-operations-support
status: current
canonical_for: project-admiralty-phase-2-mainline-safety
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 2 mainline safety contract

## Post-phase capability

Phase 2 delivers a useful read-only Admiralty workspace: a platform command
center, bounded cross-domain search, rich account and support inspection,
Chronicle and immutable-edition inspection, Voyage operational inspection,
Community and moderation intelligence, worker/job/provider visibility,
effective configuration and release visibility, an Audit Explorer, and
correlation-led investigation.

Every value is a typed sanitized projection from a canonical owning subsystem.
Admiralty presents and correlates that truth; it does not become the owner of
accounts, Chronicles, Voyages, Community state, private content, providers,
configuration, releases, jobs, backups, or verification evidence.

## Active behavior

- Authorized operators receive navigation and data according to exact named
  read capabilities.
- Every administrative route authorizes on the server before returning a
  privileged projection.
- Operational states include source, observation time, freshness, validation,
  and safe failure meaning. Missing evidence is not represented as zero or
  healthy.
- Phase 1 privileged assurance, Support Access consent, grant expiry,
  revocation, scoped projections, and canonical audit behavior remain active.
- Sensitive account diagnostics remain locked without an active matching
  Support Access grant, including for a full Administrator.

## Dormant behavior

Phase 2 exposes no new account, role, session, Chronicle, Voyage, Community,
job, provider, configuration, flag, release, backup, private-content, repair,
or break-glass mutation. No inert or hidden later-phase control is presented as
available. Phase 3 and Phase 4 registry entries remain dormant unless an exact
read-only human-facing capability is delivered and tested in this phase.

## Compatibility

The Phase 1 `/admin` authority, ordinary-user not-found behavior, account-owner
Support Access surface, canonical identity/session model, audit taxonomy, and
92-entry Living Registry floor remain supported. Phase 2 extends those
contracts additively and must not require a second sign-in, session, role,
person, audit, or domain table.

## Future work

Broad administrative mutations, saved investigations/case management,
business-domain repair, provider changes, configuration edits, job control,
release orchestration, backup restore, private-content access, and emergency
controls remain later-phase work. Phase 3 is not authorized by this contract.

## Schema impact

Expected schema impact is `NONE`: zero new business tables, zero duplicated
snapshots, zero administrative copies of canonical state, and zero persistent
search indexes or read caches. Any discovered schema need pauses schema work
until its owner, rebuildability, dual-database parity, and migration reservation
are governed explicitly.

## Rollback and disable

Phase 2 is additive. Removing the new routes, projections, registry mappings,
and test registrations restores the accepted Phase 1 surface without data
migration or backfill. Existing Phase 1 tables and behavior are not removed or
reinterpreted.

## Permanent-stop test

If no later Admiralty phase is implemented, Voyagewright remains coherent:
Phase 1 security and consent remain intact; every Phase 2 screen is useful and
read-only; all unavailable facts are labeled truthfully; no control promises a
mutation that does not exist; and no later phase is required for correctness.

Contract result at registration: `FROZEN`.
