# Project Drydock Phase 4 Test Plan

Status: DEVELOPMENT — this plan is not an acceptance receipt.

## Implemented focused checks

- `drydock:readiness`: canonical decisions, warnings, stale evidence, capability-derived Suite policy, and safe publishing evidence.
- `drydock:compatibility` and `drydock:historical`: parser/upcast compatibility and non-destructive migration preview.
- `drydock:publishing-contract`: owner-safe readiness/evidence APIs and immutable evidence projection.
- Launch Gate component tests: loading, server decision/checksum, and failure presentation.
- Prisma SQLite/MySQL static schema validation and task-owned SQLite rehearsal through all 62 migrations, including Suite evidence and source-idempotent publication constraints; MySQL SQL parity is statically verified.

## Required before qualification

- task-owned SQLite migration rehearsal with Phase 3 representative data;
- MySQL live proof if an isolated policy-approved service is available;
- exact-source publication race, double-submit, and transaction-rollback tests;
- required Suite persistence/recovery and stale-policy tests;
- full historical fixture matrix and reader-security limits;
- authenticated browser, Axe, keyboard, responsive, privacy/security, and performance evidence;
- Harborlight/provider/Sealed Hold/Lanternwake integration evidence;
- registered Sounding Line authoritative suites and frozen-candidate qualification.

No item in the second section may be inferred from the focused checks above.
