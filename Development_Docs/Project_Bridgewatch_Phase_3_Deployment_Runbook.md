---
title: Project Bridgewatch Phase 3 Deployment Runbook
audience: engineering
status: current
canonical_for: project-bridgewatch-phase-3-deployment
last_reviewed: 2026-08-16
---

# Project Bridgewatch Phase 3 — Private Deployment Runbook

Bridgewatch is one private, read-only Node/Fastify service with a SQLite data
directory outside the release checkout. It is not a control plane.

## Private topology

```text
Private operator network
        |
identity-aware access proxy (for example Cloudflare Access)
        |
NGINX TLS termination
        |
127.0.0.1:4318 bridgewatch.service
        |
Node + Fastify ---- writable /var/lib/bridgewatch/bridgewatch.sqlite
```

Keep the application release directory read-only to the service user. Store
`BRIDGEWATCH_GITHUB_TOKEN`, telemetry token, and optional dashboard Basic
authentication only in a root-owned environment file; never pass them in a
command line, browser code, or checked-in configuration.

## Systemd example

```ini
[Unit]
Description=Bridgewatch read-only mission control
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=bridgewatch
Group=bridgewatch
WorkingDirectory=/opt/bridgewatch/current/bridgewatch
EnvironmentFile=/etc/bridgewatch/bridgewatch.env
ExecStart=/usr/bin/node dist/lib/server.js
Restart=on-failure
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/bridgewatch
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Build the release before deployment, set `BRIDGEWATCH_DB_PATH` to
`/var/lib/bridgewatch/bridgewatch.sqlite`, and retain the default loopback host.
If a non-loopback bind is necessary, `BRIDGEWATCH_ALLOW_EXTERNAL=true` and both
dashboard authentication values are required by typed configuration; an access
proxy remains the normal private boundary.

## NGINX and readiness

Proxy only from NGINX to `http://127.0.0.1:4318`. Terminate TLS at the proxy,
enforce the private identity gate there, and forward no unauthenticated public
route. Probe `/healthz` for process liveness and `/readyz` for a cached GitHub
projection. Human routes and JSON observation routes are GET/HEAD only; the
two machine telemetry routes require their separate bearer token.

### v1.2 mounted observation routes

The `deploy/nginx.conf` map must remain synchronized with the private Fastify
route allowlist. v1.2 adds bounded `program`, comparison, version/phase,
pull-request, branch profile, source profile, and Sounding Line run GET routes.
It does not widen the mount into a generic proxy: reject all mutation methods,
telemetry paths, health paths, arbitrary query strings, and arbitrary upstream
selection. After a source update, verify the exact mounted root and the
allowlisted profile paths against a task-owned listener before an operator
reloads NGINX.

### Windows task-owned runtime

For a local Windows qualification instance, build Bridgewatch and invoke
`npm run lifecycle:windows -- start` from `bridgewatch/`. The helper records
only the PID it starts, checks the loopback `/healthz` endpoint, and refuses to
replace an existing listener or stop a process whose command line is not the
expected Bridgewatch server path. Use `status`, `restart`, and `stop` through
the same helper. This is local lifecycle support; it does not replace the
Linux systemd topology or authorize an external listener.

## Retention and compaction

The defaults retain detailed event/snapshot telemetry for 30 days and daily
rollups for 90 days. Inspect first:

```powershell
npm --prefix bridgewatch run history:inspect
```

Apply pruning only during a quiet period:

```powershell
npm --prefix bridgewatch run history:prune
```

Pass `--compact` only after a material prune (at least 1,000 rows). SQLite
VACUUM can briefly block the database; it is intentionally not a continuous
operation. Pruning refuses durable history tables.

## Backup and restore

Bridgewatch history is useful but not business-critical; a backup failure must
not affect Voyagewright. Run a daily SQLite online backup under the service
user or a narrow operator account:

```powershell
npm --prefix bridgewatch run history:backup -- --target /var/backups/bridgewatch/bridgewatch-$(date +%F).sqlite
```

For a restore test, stop the task-owned test instance (not a shared service),
copy the backup to a new task-owned data path, start Bridgewatch against that
path, and verify `/api/projects`, `/api/history`, `/api/archive`, and
`/api/trends`. Do not overwrite a live SQLite file in place. The Phase 3 test
suite performs an isolated backup/restore semantic check.

## Failure posture

GitHub or Sounding Line failure leaves the cached observation visible and
labelled stale/unavailable. Reporter absence is UNMEASURED, not failed. A
history persistence error leaves current source projections available with a
persistent Bridgewatch warning. No outage permits inferred completion or an
upstream mutation.
