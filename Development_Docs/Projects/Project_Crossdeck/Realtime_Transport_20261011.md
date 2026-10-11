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

Crew display content requests also have their own lifetime and generation guard.
Selecting a newer presentation aborts the old request; Voyage replacement creates
a fresh display session and clears the former content. Periodic authorization
failure aborts pending content. Stale periodic refreshes cannot overwrite a newer
presentation. These guards preserve the existing crew-only canonical view route.

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
transaction-conflict responses with multi-second queueing. The corrected
staggered-start run passes with zero startup and steady-state failures at every
cohort. This does not qualify a simultaneous SQLite reconnect storm or live MySQL.

## Source-bound measured results

The full comparison binds clean `81452bc6b7b55d1a8d3352999c114eea98d09110`,
tree `607e9e781f10213d6439236e8984cdd68094d57e`, Node 24.18.0 on Windows and
lockfile SHA-256 `a2f4140400648da7810670a7ef677e04d526628a8f66a98efcc180f5eef74014`.
Its fresh production build and all five browser cases pass. The [raw measurements](realtime-evidence-20261011/idle-measurements-81452bc6.json)
and [runtime/cleanup record](realtime-evidence-20261011/runtime-81452bc6.json)
preserve the original numbers. Each row is a nominal 20-second idle window;
SQL/CPU boundaries use actual one-second process samples.

| Surfaces | Snapshot GETs, old → new | Reduction | SQL queries, old → new | SQL reduction | Server CPU ms, old → new | Peak RSS MiB, old → new |
| -------- | ------------------------ | --------- | ---------------------- | ------------- | ------------------------ | ----------------------- |
| 2        | 75 → 4                   | 94.7%     | 1,847 → 341            | 81.5%         | 2,501 → 391              | 298.3 → 244.0           |
| 5        | 190 → 9                  | 95.3%     | 4,586 → 863            | 81.2%         | 3,812 → 984              | 342.2 → 342.4           |
| 20       | 762 → 40                 | 94.8%     | 18,371 → 3,755         | 79.6%         | 11,937 → 2,108           | 458.9 → 484.7           |
| 32       | 1,221 → 64               | 94.8%     | 29,611 → 5,283         | 82.2%         | 13,625 → 2,906           | 608.0 → 622.9           |

Each updated idle cohort opens one event connection per surface and reports zero
failures. CPU reductions range from 74.2% to 84.4%; neither total server load nor
memory improved by 95%. Memory is mixed and rises across the cumulative test
process; this short run does not prove long-term memory behavior or production
capacity. Synthetic scopes are 1/1/2/4 respectively, not 32 surfaces attached
to one person contrary to the existing cap. Browser processes are bounded to seven.

Twenty active changes in the full run have command-request-to-authorized-snapshot
callback latency p50 **167 ms**, p95 **370 ms**, p99 **455 ms**. This includes
command HTTP, authorized fetch and test callback, rather than a physical paint
or an instrumented transaction timestamp. The same run measures independent
Node-process delivery at **1,215 ms**, network restoration at **144 ms**,
controlled foreground recovery at **163 ms**, reload plus reconciliation at
**336 ms**, and deliberately discarded notification recovery at **10,180 ms**.
Concurrent focus commands both commit and both browsers converge on the durable
winning revision; progression event cardinality does not change. Active session
revocation ends event access and subsequent snapshot fetch returns 401.

A separate [active/UI supplement](realtime-evidence-20261011/active-measurements.json)
binds clean `6f7c5026df9ee28bd43b573b3ddf0bf6a269a44d`, tree
`ae5a454b29feae83b1e9bf48c8b281e11793d45d`. Only test/measurement tooling changed
from the comparison; product, Prisma, public assets, lockfile, Next and TypeScript
configuration are identical. The [runtime record](realtime-evidence-20261011/runtime-6f7c5026.json)
explicitly declares reuse of that unchanged product build. All three supplemental
cases pass. It records 20 commands, 20 explicit sequence reads, 40 notification
fetches, 40 events and no newly opened event connections. The roughly 3.01-second
sampled server window observes 3,582 SQL statements and 2,343 ms CPU, including
one-second boundary uncertainty, startup overlap and periodic authority checks;
these counts are not exclusive per-command costs. Callback latency is p50/p95/p99
**77/98/105 ms**. Cross-process delivery is **2,045 ms**, network/foreground/reload
recovery **124/121/139 ms**, and dropped-hint recovery **10,012 ms**. These separate
runs show local timing variation; no deployed subsecond cross-instance SLA is claimed.

The measurement preload observes the real process bus's first advanced revision
after transaction resolution, without replacing delivery or writing private
scope keys. The real Crossdeck UI shows its Receive prompt **194 ms** after that
hint on desktop → phone, **102 ms** on phone → desktop, and **162 ms** on the
disconnect scenario's forward transfer. [Two-way measurements](realtime-evidence-20261011/crossdeck.surface-handoff-visible.json)
and the [additional forward measurement](realtime-evidence-20261011/crossdeck.phone-disconnect-visible.json)
retain exact source and boundaries. This is Playwright-visible DOM evidence;
three transfers do not support a meaningful p95/p99 or physical display claim.

Initial focused development: **67 tests / 11 files**, TypeScript, affected-file lint,
privacy scan, documentation/catalog validation and **58 Sounding Line registration
regressions** pass. A clean-source rerun of the canonical service suites passes
**29 tests / two files**, including both Phase 1 and both Phase 2 shared Device Lab
D0 cases on `81452bc6`, each with zero remaining resources. Their [original D0
receipts](realtime-evidence-20261011/) preserve the scenario pack's existing base
identity rather than relabeling it as this task's base. Phase 1/2 browser scenarios
also pass on that clean source. The supplement retains [Phase 2 handoff D1](realtime-evidence-20261011/phase2-crossdeck.surface-handoff-D1.json)
and [disconnect D1](realtime-evidence-20261011/phase2-crossdeck.phone-disconnect-D1.json)
receipts on `6f7c5026`, plus checksum-matched [handoff](realtime-evidence-20261011/crossdeck.surface-handoff-D1.png)
and [disconnect](realtime-evidence-20261011/crossdeck.phone-disconnect-D1.png) screenshots.

After publishing the measurement candidate, two additional race probes fail on
its unchanged crew-display source: an obsolete asynchronous response overwrites
a newer view, and the old request has no abort signal on Voyage replacement.
The scoped display correction keys the session by Voyage and aborts/guards
content requests and periodic refreshes. Both failing probes pass after repair;
an additional test covers authorization loss with a pending response. The complete
Crossdeck suite passes **70 tests / 12 files** with TypeScript and affected-file
lint passing. Original
red output remains under `artifacts-crossdeck-display-race-red.log`; no failed
run is relabeled as passing. Final regression and protected qualification bind
the corrected head separately from the earlier transport measurements.

## Protected qualification and integration

[Transport PR #706](https://github.com/Kgray44/treasurehuntSoT/pull/706) remains a
candidate pending the required ordinary Sounding Line Mainline Decision. The
original protected base was `f458bf2dc1176016c2d166180f038f0f15ac9f7c`.
Concurrent Pilot PR #707 subsequently landed as `01d32824127d00628546ea4209d09fea57c335c1`;
the candidate preserves that accepted Pilot and reconciles the current-status conflict.
Hosted run [38165997232](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38165997232)
passes for measurement/documentation head `2f3e55e6` only. Corrected display head
`9e3415cd` passes all 70 focused tests and four fresh production-browser journeys
locally. Its hosted run [38166891441](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38166891441)
fails the reverse handoff's ten-second Receive visibility assertion after unit,
static and build checks pass. This failure remains a failure. The revised browser
case checks the reverse HTTP response before visibility, retains metadata-only
request diagnostics on failure, and gives the ten-second reconciliation interval
five seconds of request budget. Measured latency samples retain their actual
elapsed time; the functional budget is not a latency claim. Fresh qualification
of the reconciled candidate is required.

All measurements above are focused development evidence, not protected acceptance.
Final ordinary qualification is delegated to the PR's trusted hosted workflow;
no duplicate local/cloud ordinary run is started. Normal protected merge and
exact landed smoke remain required. No deployment, release or owner/native/
physical acceptance is included.

## Documentation and catalog decision

Current Sextant, spatial program, current-status, feature-status, product features
and Player guidance are reconciled against accepted mainline. Sextant Phase 3,
Parallax Phase 2, Crossdeck Phase 2 and Reach's Phase 1 foundation preview are
integrated software; native/physical/owner gates remain explicit. Historical
acceptance records are unchanged. The changelog records this transport correction.
This performance correction preserves the major capability, so no machine-readable
Feature Catalog fragment change is required.
