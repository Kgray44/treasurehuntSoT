# Phase B-1 Test Plan

## Automated layers

| Layer             | Coverage                                                                                             | Command                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Domain            | configuration, scenarios, result mapping, transition graph                                           | `npm test`                                      |
| Protocol          | all 27 messages, strict payloads, invalid versions                                                   | `npm test`                                      |
| Flags/permissions | environment defaults and capability mapping                                                          | `npm test`                                      |
| Adapters          | deterministic HTTP path and truthful unavailable Companion                                           | `npm test`                                      |
| Story contracts   | registry/provider and existing exact-once progression tests                                          | `npm test`                                      |
| PWA               | sensitive cache exclusions and shell allowlist                                                       | `npm test`                                      |
| Desktop bridge    | command allowlist and input validation                                                               | `npm run desktop:test`                          |
| Migration         | all SQLite migration SQL on a fresh database, fixture creation and re-ensure                         | `npm run validate` plus the B-1 migration proof |
| UI/E2E            | Studio waypoint lifecycle, Player scan, duplicate/stale guards, Captain diagnostics, manifest/SW     | `npm run test:e2e`                              |
| Regression        | format, lint, strict TypeScript, asset validation, DB invariants, all E2E, production build/restarts | `npm run validate`                              |

Shared-database mutations run in Chromium only. WebKit remains in the suite for read-only/accessibility/responsive checks. The deterministic duplicate scenario must show one accepted progression event and `duplicateResultRejected: true`; delayed/stale results must leave the current stage unchanged.

## Migration proof

The additive SQLite SQL can be applied in order to an empty disposable database with `prisma db execute`. The seed is run twice with `--ensure`; expected counts remain one waypoint, one demo tale, one binding, and one immutable publication. MySQL SQL is generated from the exact pre-B-1 schema and current MySQL schema, syntax reviewed, and applied only in a backed-up MySQL 8 environment.

## Exit evidence

`B1_Demonstration.md` records the mandatory browser, desktop-adapter, PWA, duplicate, stale, and Captain evidence. `B1_Completion_Report.md` records exact command results and any unverified operator-only item; no unchecked item is described as passed.
