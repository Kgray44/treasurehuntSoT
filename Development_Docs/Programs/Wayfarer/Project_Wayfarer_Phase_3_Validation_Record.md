# Phase 3 Validation Record

Node 22.13.0 and Prisma 6.19.3 were used for this closure pass. The selected
schema engine was
`node_modules/@prisma/engines/schema-engine-windows.exe` (engine hash
`c2990dca591cba766e3b7ef5d9e8a84796e47ab7`); direct `--version` and a minimal
short-ASCII-path SQLite `db push` succeeded.

Repository proof also succeeded on a fresh SQLite database: full-schema
`db push --force-reset --skip-generate` synchronized, and `migrate deploy`
applied all 27 migrations including `20260725110000` and `20260725111000`.
The earlier `Schema engine error` report was not a migration failure. With
Prisma debug logging, PowerShell surfaced debug stderr and the optional missing
per-user `Config/commands.json` command-state file as a nonzero wrapper result
after the engine had already completed the database action.

Passing closure gates: both Prisma schema format/validate/generate flows,
TypeScript, lint (63 existing warnings and zero errors), formatting, language,
assets, architecture, focused tests (12), full Vitest (115 files/951 tests),
and production build. The live browser smoke verified the unauthenticated
Passport boundary. It did not provide the required authenticated synthetic
Voyage matrix. MySQL schema validation passed with an inert local URL; no live
MySQL migration service was configured.

`npm run validate` was attempted after the owned browser server was released,
but the harness correctly refused before mutation because another process held
`C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\validation-runtime.lock`.
The zero-byte lock's timestamp predates this pass and no owned Node, Python, or
PowerShell validation process was visible. The lock was not removed or altered.

Final browser closure (2026-07-25): the authenticated focused Playwright
project passed in 36.6 seconds on task-owned port 3101 with
`file:./wayfarer-phase3-browser-20260725c.sqlite`. The database was a fresh
27-migration SQLite environment and used only synthetic Owner, Crew, Foreign,
Chronicle, Voyage, events, and invitation data. A browser-proven mobile
overflow in the Passport navigation/form controls was corrected in
`src/styles/chronicle.css`; the rerun passed all required viewports and had no
serious or critical Axe violations. One Voyage source counts for the synthetic
session remained unchanged (sessions 1, events 3, memberships 2).

MySQL discovery found a running shared `MySQL80_dashboard` Windows service, but
no `mysql` client, Docker, installed WSL distribution, or safely scoped
disposable credentials/endpoint. It was not touched. Classification:
`BLOCKED EXTERNAL — NO ISOLATED LIVE MYSQL SERVICE`. Prisma MySQL format,
validate, and generation remain passing local parity evidence, not live MySQL
migration proof.

The final `npm run validate` attempt again refused at exclusive lock acquisition
before any mutation. The harness acquires the file with `FileShare.None` and
has no repository-provided stale-lock recovery mechanism. The shared owner was
not interrupted and the lock was not removed.
