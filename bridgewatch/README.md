# Bridgewatch - Phase 3: Keep the Watch

Bridgewatch is a private, read-only internal board for Project Bridgewatch.
It is a standalone Fastify service with a local SQLite cache and a static
dashboard. It does not belong to the public Next.js application.

## Safety boundary

- GitHub calls use `GET` only; Bridgewatch has no GitHub write path.
- The optional GitHub token is server-side only and is never included in the
  dashboard, API payloads, logs, or SQLite cache.
- Human dashboard and API endpoints are GET/HEAD observation endpoints. There
  are no control buttons, GitHub writes, Sounding Line controls, worker queues,
  or browser credentials.
- The only POST routes are machine-only activity telemetry endpoints. They use
  a dedicated Bridgewatch token, cannot change lifecycle/milestone/finalizer
  truth, and retain no prompts, logs, commands, secrets, or private content.
- GitHub and accepted repository records remain authoritative. A missing
  denominator displays `UNMEASURED`; a cached green check is not a release Go.

## Run privately

Copy `.env.example` to an untracked `.env`, set `BRIDGEWATCH_REPOSITORY`, then
load those environment variables using the approved host mechanism. The default
host is `127.0.0.1`. Non-loopback hosting is rejected unless it explicitly sets
`BRIDGEWATCH_ALLOW_EXTERNAL=true` and a dedicated dashboard username/password;
human dashboard and observation routes then use HTTP Basic authentication.

```text
cd bridgewatch
npm install
npm run build
node dist/lib/server.js
```

The service initializes `var/bridgewatch.sqlite` itself and safely migrates a
Phase 1 cache through the Phase 2 durable project/phase/milestone/completion,
worker, and observed-test history to Phase 3's typed events, normalized
snapshots, and daily rollups. Current source collection can rebuild the current
projection, but accepted records, completion receipts, final decisions, and
mainline identities are never retention targets. Keep deployment storage
private and follow the Phase 3 deployment runbook for backup and restore.

## Same-host Voyagewright gateway

The accepted internal listener is `127.0.0.1:4318`. Voyagewright exposes the
same standalone service at `/bridgewatch` through canonical Admiralty
`PLATFORM_OBSERVE` authorization. The root application uses the server-only
`BRIDGEWATCH_INTERNAL_URL=http://127.0.0.1:4318` value for local development;
deployed NGINX sends an internal authorization subrequest to Voyagewright and
then proxies only the allowlisted dashboard, static asset, and read-only API
GET/HEAD routes directly to port 4318. Browser cookies and authorization
headers are removed before the upstream request.

The gateway never exposes `/healthz`, `/readyz`, arbitrary paths, or
`/api/telemetry/*`. The telemetry POST endpoints remain available only on the
private Bridgewatch listener with their distinct machine bearer token. Keep
Bridgewatch loopback-only; do not set `BRIDGEWATCH_ALLOW_EXTERNAL` for this
same-host deployment.

## Operations

`GET /healthz` reports process health. `GET /readyz` reports whether a usable
GitHub snapshot is cached. `GET /api/summary`, `/api/projects`,
`/api/projects/:id`, `/api/history`, `/api/projects/:id/history`,
`/api/trends`, `/api/projects/:id/trends`, `/api/archive`, `/api/branches`,
`/api/pull-requests`, `/api/workers`, `/api/tests`, `/api/attention`,
`/api/activity?since=...`, and `/api/sources` are human read-only observation
endpoints. `/api/history` is bounded, filters normalized meaningful events,
and defaults to the last 12 hours; `/api/activity` remains worker activity.
Startup refreshes GitHub and the source-owned Sounding Line projection; a
source failure retains a cached state and never blanks the board.

The browser-local `bridgewatch:last-seen:v1` key affects only the displayed
history range. Invalid, unavailable, or future local values fall back to the
last 12 hours and never acknowledge or mutate server truth. The dashboard has
no controls for GitHub, Sounding Line, project lifecycle, milestones, tests,
or releases.

Inspect retention before applying it:

```text
npm run history:inspect
npm run history:prune -- --compact
npm run history:backup -- --target /operator-owned/bridgewatch.sqlite
```

The default detailed event/snapshot window is 30 days and the daily rollup
window is 90 days. Rollups are generated before transient pruning, durable
tables are rejected as deletion targets, and `SOUNDING_LINE_DECISION` events
remain as accepted evidence. `--compact` is manual and only vacuums after a
material prune; it may briefly block SQLite work.

## Reporter and Sounding Line integration

Set `BRIDGEWATCH_TELEMETRY_TOKEN` only in private host configuration, then send
a strict activity heartbeat to `POST /api/telemetry/heartbeat` or completion to
`POST /api/telemetry/finish` with `Authorization: Bearer <dedicated token>`.
Telemetry credentials are rejected in URLs and payloads; there is a 4 KiB body
limit, a 60/minute client limit, and a default 90-second stale threshold.

Bridgewatch invokes the read-only
`scripts/sounding-line/status-projection.mjs` adapter over Sounding Line runtime
markers, sealed plans, receipts, and leases. It never reads terminal logs or
process lists, and it cannot schedule, cancel, clean up, lease, or finalize.

Focused validation uses `npm run validate`. It is implementation evidence only;
Sounding Line remains the authority for phase, mainline, and release decisions.
See `Development_Docs/Project_Bridgewatch_Phase_3_Deployment_Runbook.md` for
the private NGINX/systemd topology, online backup, restore rehearsal, and
failure posture.
