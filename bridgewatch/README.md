# Bridgewatch — Phase 1

Bridgewatch is a private, read-only internal board for Project Bridgewatch.
It is a standalone Fastify service with a local SQLite cache and a static
dashboard. It does not belong to the public Next.js application.

## Safety boundary

- GitHub calls use `GET` only; Bridgewatch has no GitHub write path.
- The optional GitHub token is server-side only and is never included in the
  dashboard, API payloads, logs, or SQLite cache.
- Dashboard and API endpoints are GET/HEAD observation endpoints. There are no
  control buttons, webhooks, mutations, worker queues, or browser credentials.
- GitHub and accepted repository records remain authoritative. A missing
  denominator displays `UNMEASURED`; a cached green check is not a release Go.

## Run privately

Copy `.env.example` to an untracked `.env`, set `BRIDGEWATCH_REPOSITORY`, then
load those environment variables using the approved host mechanism. The default
host is `127.0.0.1`; expose it only through an authenticated private reverse
proxy if remote access is required.

```text
pnpm install
pnpm build
node dist/lib/server.js
```

The service initializes `var/bridgewatch.sqlite` itself. Deleting that local
cache is recoverable but removes the last known observation state until the next
successful collection. Keep deployment storage private and back up only when
the local operational cache is needed for continuity.

## Operations

`GET /healthz` reports process health. `GET /readyz` reports whether a usable
GitHub snapshot is cached. `GET /api/summary` is the dashboard source. A startup
attempts a bounded refresh; failures keep previous cache data and visibly report
an unavailable source. Polling is disabled in Phase 1.

Focused validation uses `pnpm validate`. It is implementation evidence only;
Sounding Line remains the authority for phase, mainline, and release decisions.
