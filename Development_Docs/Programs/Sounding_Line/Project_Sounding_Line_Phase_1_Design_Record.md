# Project Sounding Line Phase 1 Design Record

**Program:** Project Sounding Line
**Phase:** Take the Soundings
**Status:** implemented; focused validated; plan-only and nonauthoritative
**Base:** `3699f5e7c638d950aab3b55169b603121b57c85b`

Phase 1 adds only read-only policy, inventory, and deterministic plan tooling. `scripts/sounding-line/cli.mjs` validates policy, inventories current verification surfaces, and emits a deterministic plan. It never spawns a selected command, acquires a lock, connects to a database, mutates Git, starts a server, or becomes release authority.

Direct mappings and owner mappings select suites; any unmapped change broadens to all registered suites. Release scope is comprehensive. `npm run validate` and `scripts/test-all.ps1` remain unchanged and authoritative. No broker, scheduler, lease runtime, CI adapter, Prisma change, migration, application behavior, package-script edit, or browser test is included. Rollback removes only the Phase 1 policy/tooling/records.

The repository supplies one consolidated Sounding Line governing record rather than separately named Parts I–III; its architecture, runtime, and repository-policy sections were used as the applicable governing source.
