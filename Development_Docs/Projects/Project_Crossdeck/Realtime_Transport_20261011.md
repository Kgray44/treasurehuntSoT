---
title: Crossdeck committed-change transport and measured validation
audience: product-engineering
status: implementation-candidate
canonical_for: crossdeck-realtime-transport-20261011
last_reviewed: 2026-10-11
---

# Committed-change delivery

This scoped correction replaces Phase 2's nominal 500 ms snapshot discovery with
SSE invalidation and nominal 10-second active reconciliation. Pairing, authorized
commands, durable revisions, replay protection, custody, explicit receive and
acknowledgement, crew projection and One Voyage ownership retain their existing
contracts. No later Crossdeck, Reach or Parallax phase is implemented here.

The inspected protected baseline is `f458bf2dc1176016c2d166180f038f0f15ac9f7c`.
The independent [Spatial Studio review PR #705](https://github.com/Kgray44/treasurehuntSoT/pull/705)
contains real current-mainline screenshots, not owner design acceptance. Product
Studio source is outside this transport correction. Historical Phase 2 receipts
retain their original polling implementation and source identity.

## Runtime and deployment decision

Checked-in deployment uses a long-running Node/Next server (`deploy/forever-treasure.service`)
behind one Nginx upstream. `deploy/nginx.conf` enables public HTTP/2, disables
response buffering and has a one-hour proxy read timeout. This matches the
[Next self-hosting streaming requirements](https://nextjs.org/docs/app/guides/self-hosting).
The running production topology and proxy configuration were not inspected or changed.
Native EventSource keeps commands on the existing HTTP/CSRF route and introduces
no networking framework, database migration, external broker or new permanent service.

After a successful database transaction resolves, the canonical sync service
publishes a process-local wake-up hint. A notification error cannot turn a
committed command into a reported transaction failure. Read-side reconciliation
also publishes its resulting committed revision. The stream never contains an
object, text, account, membership, token, sensor observation or progression event.
It contains a strict version-1 `CROSSDECK_PRESENTATION_CHANGED` envelope with the
authorized surface UUID, monotonic deck revision and random event UUID.

Every active account/Voyage scope also shares one lightweight durable revision
observation per second per process. It selects the deck revision, rather than
reconstructing presentation snapshots, and recovers commits made in another
process or after a lost local hint. The database remains the commit boundary;
only committed rows become notifications. Multi-instance convergence requires
all instances to use the same canonical database. Separate SQLite copies cannot
provide that guarantee. Live MySQL and deployed multi-host operation remain open.

## Authority and resource lifetime

The same-origin, Node-only event route consumes the canonical AccountSession
cookie and exact session-bound surface/Voyage participation. It refuses extra
query parameters, cross-origin fetch context and mismatched origins. Tokens are
never accepted in the URL. Private responses use no-store/no-transform,
`Vary: Cookie`, no-referrer and `X-Accel-Buffering: no`; no CORS channel is offered.

Authorization is checked on connection, before every changed-revision delivery
and at nominal five-second intervals. Session, pairing and membership loss close
the stream. A role change also ends it, causing the client to clear the old
presentation. Canonical HTTP routes independently authorize every fetch and
command. Five seconds is a server detection cadence, not a promise about a
suspended browser's visible paint. Content policy changes are projected by the
canonical snapshot/view resolver; event metadata cannot grant content access.

Connections are limited to 256 per server object and two per session/surface,
with a five-minute lifetime. Backpressure, consumer cancellation, request abort,
database failures and revoked authority release scope subscriptions and timers.
The local process bus is a hint facility, not a competing persistence store.
The existing [HTTP/1.1 browser connection limit](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
still matters for many same-origin tabs; HTTP/2 and closing hidden views avoid
using one persistent connection for every inactive tab.

The client fetches initially, on stream establishment/reconnect, on a newer
revision, after relevant foreground/pageshow/network restoration and every ten
seconds while active. Duplicate, stale, unknown and wrong-scope envelopes are
ignored. Revision gaps fetch current state, not event history. Rapid hints share
one fetch and at most a necessary follow-up; lower revisions cannot overwrite a
newer delivered snapshot. HTTP 401/403 and explicit authority-ended events stop
retries and clear presentation. Event establishment retries use bounded
exponential backoff with jitter while HTTP reconciliation remains available.
Hidden/page-exit/offline views close their channel and timers; unmount and session
replacement abort requests and suppress old callbacks and command results.

## Validation and measurement

Focused development passes include the retained Phase 1/2 service, API, object,
transport and component tests. Added tests cover observable post-commit revision,
post-write rollback without publication, notifier outage, independent-service
durable recovery, authorization, role changes, revocation, stream capacity,
current revision after server recreation, coalescing, lost hints and cleanup.
The browser suite retains pairing/disconnect and extends manual map custody
handoff to a valid phone-to-desktop return transfer. These use shared Device Lab
D0/D1 contracts. D2/native, D3/physical, D4/D5, owner walkthrough and deployment
remain separate; unsupported tiers are not promoted by browser emulation.

`scripts/crossdeck/run-realtime-browser.mjs` creates its own migrated synthetic
database, credentials, email outbox, two loopback Next processes and bounded
browser workers. It records exact source/tree/lockfile/runtime and cleanup.
The comparison bundles the actual baseline and candidate transport adapters;
it measures 20-second idle windows at 2, 5, 20 and 32 surfaces, distributed over
person/Voyage scopes respecting the existing 12-surface cap. SQL event counts,
CPU and memory are sampled from the actual primary Next process without logging
query text or parameters. Distinct browser processes represent devices, with
at most five surfaces each under local HTTP/1.1. Startup is staggered and reported
separately from steady state. This tool emits focused development evidence,
never a Sounding Line acceptance decision.

The canonical Sounding Line browser adapter's local cookie proxy does not
immediately propagate a disconnected downstream SSE socket to its upstream.
Focused streaming/load proof therefore uses the directly authenticated owned
Next server. The required ordinary browser journeys remain on the unchanged
authority runner. The load case explicitly skips without its task-owned metrics
environment; an ordinary skip is not performance acceptance.

The first two development load runs failed during large simultaneous startup;
their results remain failed. Trace inspection found canonical SQLite 409
transaction-conflict responses with multi-second queueing. Initial two/five
surface results are provisional, not full-load qualification. The final measured
report, exact candidate qualification and protected integration are pending.

## Documentation and catalog decision

Current Sextant, spatial program, current-status, feature-status, product features
and Player guidance are reconciled against accepted mainline. Sextant Phase 3,
Parallax Phase 2, Crossdeck Phase 2 and Reach's Phase 1 foundation preview are
integrated software; native/physical/owner gates remain explicit. Historical
acceptance records are unchanged. The changelog records this transport correction.
This performance correction preserves the major capability, so no machine-readable
Feature Catalog fragment change is required.
