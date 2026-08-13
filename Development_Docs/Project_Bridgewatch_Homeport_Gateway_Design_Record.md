---
title: Project Bridgewatch Homeport Gateway Design Record
audience: engineering
status: current
canonical_for: project-bridgewatch-homeport-gateway-design
last_reviewed: 2026-08-13
---

# Project Bridgewatch + Homeport - Bring the Watch Home

## Authority and source boundary

- Starting `origin/main`: `60b89841986e66fbc2c0828489d38002a1617506`.
- Qualified implementation: `6212bd1ab9ed23abd52f98154b55d846267a1133`.
- Task branch: `agent/bring-the-watch-home` in a dedicated local worktree.
- Bridgewatch governing authority: Version 1.1, August 11, 2026.
- Product authorities: Voyagewright Global Product Governance, Project
  Homeport, Project Admiralty, and current route/navigation records.
- Verification authority: the current Sounding Line development,
  qualification, finalization, and protected-binding lifecycle.

The canonical nested checkout was dirty and behind current main, so it was
preserved. No Project Bridgewatch Phase 3 branch, worktree, listener, database,
or process was modified. This increment is not Bridgewatch Phase 4 and does not
change Phase 3 behavior or authority.

## Frozen topology

```text
private Voyagewright host
  /bridgewatch
      |
      +-- deployed: NGINX auth_request -> Voyagewright canonical session and
      |             PLATFORM_OBSERVE -> allowlisted direct loopback proxy
      |
      +-- local: thin Next.js gateway -> the same canonical capability check
                                        and allowlisted loopback proxy
                                               |
                                               v
                                  http://127.0.0.1:4318
                                  standalone Fastify + SQLite
```

`4318` is the currently accepted Bridgewatch default in `src/config.ts` and
`.env.example`; `4319` was only conceptual prompt text. The standalone service
continues to own its process, static dashboard, GitHub GET collector, Sounding
Line read projection, telemetry ingestion, and SQLite operational projection.
Voyagewright imports none of that runtime and stores no Bridgewatch state.

## Trusted configuration

The application-side server-only setting is:

```text
BRIDGEWATCH_INTERNAL_URL=http://127.0.0.1:4318
```

Only plain HTTP to `127.0.0.1`, `::1`, or `localhost` is accepted. Credentials,
non-loopback hosts, paths, query strings, and fragments invalidate the
configuration and produce a bounded unavailable response. Request paths,
queries, headers, and browser values cannot select or redirect the upstream.

Deployed NGINX has an explicit `bridgewatch_internal` loopback upstream on
port 4318. This value must remain synchronized with the private Bridgewatch
service environment. No DNS name or public Bridgewatch listener is introduced.

## Access-control rule

Bridgewatch uses the existing canonical Wayfarer account session and Admiralty
`PLATFORM_OBSERVE` capability. There is no new login, username/password, or
Bridgewatch-specific browser credential. The route returns private 404 behavior
for anonymous, ordinary Player, Captain, Creator, Community, and other accounts
without that capability. A visible Bridgewatch entry appears only inside the
already authorized Admiralty shell and overview.

For deployed traffic, NGINX performs an internal subrequest to
`/api/internal/bridgewatch/authorize`. On success it strips browser `Cookie`
and `Authorization` headers before contacting Bridgewatch. The loopback
Bridgewatch service therefore does not receive a Wayfarer session, GitHub
token, telemetry token, or second browser credential.

## Browser proxy boundary

The gateway permits only `GET` and `HEAD` for:

- dashboard root;
- `app.js` and `style.css`;
- summary, projects/project detail, pull-request, action, worker, test,
  attention, activity, and source observation APIs.

All other routes fail closed. In particular, health/readiness endpoints,
arbitrary paths, traversal, and `/api/telemetry/*` are not browser-gateway
routes. The existing telemetry heartbeat and finish POST endpoints remain
private-listener, dedicated-bearer, machine-only intake. Bridgewatch currently
has no SSE route, so no SSE exception is required in this increment.

The standalone dashboard retains its root asset paths and selects its API base
from the browser pathname. The Next.js gateway rewrites only the authorized
root HTML asset URLs to the `/bridgewatch` mount; static assets and APIs are
then served through their allowlisted mounted paths. The same dashboard build
therefore works at `/` on the internal listener and `/bridgewatch` on the host.

## Failure and security behavior

- A stopped or unhealthy Bridgewatch returns a bounded private 503 for an
  authorized caller; internal addresses, stack traces, and credentials are not
  returned.
- NGINX intercepts upstream failures only inside the Bridgewatch location, so
  the main application and unrelated routes remain independent.
- Invalid upstream configuration fails closed before any fetch.
- Proxy response headers are allowlisted and the existing CSP, frame, content
  type, referrer, permissions, cache, and no-index protections remain active.
- No CORS wildcard is added. No browser token or upstream secret is emitted.
- The standalone service remains loopback-only and independently restartable
  through `forever-treasure-bridgewatch.service`.

## Focused evidence contract

The increment must prove:

1. canonical privileged access and visible Admiralty entry;
2. anonymous and ordinary authenticated denial without content leakage;
3. mounted HTML, CSS, JavaScript, read-only API, and mobile behavior;
4. telemetry/mutation exclusion and method allowlisting;
5. trusted loopback-only upstream selection and traversal rejection;
6. safe bounded upstream failure with unrelated-route isolation;
7. credential/header/CORS/CSP boundaries;
8. standalone Fastify build/process and unchanged SQLite ownership; and
9. current documentation, route/navigation, Feature Catalog, and Sounding Line
   policy consistency.

## Deployment handoff

Merging code does not deploy it. The host operator must build the root and
Bridgewatch workspaces, install and enable the standalone systemd unit with a
private environment and durable Bridgewatch database path, set the main app's
`BRIDGEWATCH_INTERNAL_URL`, install/test/reload the NGINX configuration, and
verify that only ports 443 and the intended public host are externally
reachable. Port 4318 must remain loopback/private.
