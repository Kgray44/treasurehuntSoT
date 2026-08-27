---
title: Bridgewatch v1.2 Mission Control operator guide
audience: engineering
status: current
canonical_for: bridgewatch-v1.2-operator-guide
last_reviewed: 2026-08-27
---

# Bridgewatch v1.2 — Mission Control and Data Fabric

Bridgewatch v1.2 is a private, read-only internal Mission Control for project,
version, phase, GitHub, Sounding Line, source-health, and retained-history
observation. Its Phase 2 data fabric adds bounded source adapters, fact
provenance, coverage, and durable observation history. It is a post-completion
product-version amendment: the accepted
Phase 1–3 program history remains historical evidence and v1.2 does not create
or imply a Phase 4.
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
npm ci
npm run build
node dist/lib/server.js
```

The service initializes `var/bridgewatch.sqlite` itself and safely migrates a
Phase 1 cache through the Phase 2 durable project/phase/milestone/completion,
worker, and observed-test history to Phase 3's typed events, normalized
snapshots, and daily rollups. Current source collection can rebuild the current
projection, but accepted records, completion receipts, final decisions, and
mainline identities are never retention targets. Keep deployment storage
private and follow the Phase 3 deployment runbook for backup and restore. The
v1.2 discovery projection adds safe normalized observed project/version/phase,
GitHub PR/branch, source-health, and evidence rows while retaining all earlier
cache and accepted-history compatibility records.

### P2 data fabric

The **Data & Coverage** station makes the observer's source boundary explicit.
It collects only typed, bounded facts from the repository, local `origin/main`,
machine-indexed governing records, the Project Registry, Feature Catalog,
Deepwater evidence, Sounding Line's source-owned read-only projection, opt-in
activity telemetry, an optional Voyagewright runtime-identity file, schema and
migration inventory, and an optional provider-status file. It does not read
user records, browser credentials, headers, prompts, prose, media, terminal
logs, or process command lines.

Every fact and adapter reports identity, configuration and reachability,
freshness, authority/maturity, precise limitation or failure, and whether it
is retained from that source's last known good cache. Fact states are
`AUTHORITATIVE`, `PROVISIONAL`, `STALE`, `SOURCE_UNAVAILABLE`,
`NOT_HISTORICALLY_RECORDED`, or `UNKNOWN`. Coverage displays exact observed
and expected fact-class counts by system; it never manufactures a percentage
or reconstructs unrecorded history. Where two sources observe current main,
the local `origin/main` observation has declared precedence over GitHub.

P2 adds `GET /api/facts`, `GET /api/coverage`, and
`GET /api/facts/:key`. SQLite migration 5 stores bounded fact snapshots and
changed-value history separately from the P1-P3 cache/history tables. Optional
host-owned status paths are configured only through
`BRIDGEWATCH_VOYAGEWRIGHT_RUNTIME_STATE_PATH` and
`BRIDGEWATCH_PROVIDER_STATUS_PATH`; their readers allowlist safe identity and
count fields before persistence. Those files are observations, not a control
channel.

### Windows lifecycle helper

On Windows, build first and set the normal private Bridgewatch environment
(especially `BRIDGEWATCH_REPOSITORY`). The lifecycle helper records only the
PID it starts in the untracked `var/bridgewatch-runtime.json`, verifies its
loopback health endpoint, and refuses to take over a port or process it does
not own.

```powershell
cd bridgewatch
npm run build
npm run lifecycle:windows -- start
npm run lifecycle:windows -- status
npm run lifecycle:windows -- stop
```

Use `-- restart` only for a helper-owned process. The helper does not start a
public listener, retain credentials, or provide a browser control surface.

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
`/api/activity?since=...`, `/api/sources`, `/api/facts`, `/api/coverage`, and
`/api/facts/:key` are human read-only observation
endpoints. `/api/history` is bounded, filters normalized meaningful events,
and defaults to the last 12 hours; `/api/activity` remains worker activity.
Startup refreshes GitHub and the source-owned Sounding Line projection; a
source failure retains a cached state and never blanks the board.

v1.2 adds `GET /api/program`, version and phase profiles below
`/api/projects/:id`, retained PR/branch/Sounding Line profiles,
`GET /api/compare?from=...&to=...`, and `/api/sources/:name`. The hash-routed
dashboard offers Overview, Program, Projects, Operations, GitHub, Attention,
History, Sources, and Data & Coverage stations. It is a read-only convenience over the same
bounded APIs; deep links, browser Back/Forward, and a comparison fidelity label
do not change source authority.

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
