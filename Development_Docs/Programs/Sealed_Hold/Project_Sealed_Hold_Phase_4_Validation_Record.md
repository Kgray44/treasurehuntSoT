# Project Sealed Hold Phase 4 Validation Record

Date: 2026-07-25

Local evidence used a fresh task-owned SQLite database and private provider root under `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion`, synthetic JPEG bytes only, port 3114, and two short-lived worker compositions. No canonical checkout, production service, production data, or personal media was read or changed.

## Passed Phase 4 evidence

- SQLite migration deployment applied all 32 migrations, including the four Phase 4 protected-media migrations.
- Final focused Vitest: 27/27 tests passed for contracts, delivery/withdrawal, raster handling, key lifecycle, backup coverage, worker lease/handler composition, Creator/CSRF owner route behavior, and operations reporting.
- Authenticated Playwright: 1/1 passed. It exercised protected-source registration; truthful queued and blocked-consent states; an expired worker lease reclaimed by a fresh worker; exact consent activation; display derivative readiness; idempotent request reuse with no duplicate derivative/grant; active public opaque delivery; anonymous owner/public denial; source-identity redaction; mobile portrait; reduced motion; keyboard operation; Axe with zero serious/critical violations; withdrawal; post-withdrawal denial; source retention; quarantine denial; and a fresh worker composition completing persisted grant reconciliation.
- Repository Vitest run completed 128 files / 977 tests with 976 passing. The only failing assertion was a pre-existing Phase 2 base64url-tampering test under parallel Node 24 execution. Its exact test file then passed 9/9 in isolation; no Phase 4 test failed.
- Targeted ESLint passed for all changed Phase 4 source, route, test, and Playwright configuration files.
- A repeated browser run found and verified a genuine fix for cross-source opaque-reference collisions when distinct sources sanitize to equal pixels. The reference is now derived from protected-media identity plus final output checksum, retaining retry idempotency without cross-authorization collision.
- TypeScript has no Phase 4 diagnostic after the final annotation correction. The broad command remains blocked by inherited diagnostics listed below.

## Separate inherited baseline issues

- `scripts/validate-animation-assets.ts`: missing `@rive-app/webgl2` and its resulting implicit parameter diagnostic. This Lanternwake-owned build/type failure was independently reproduced and is not changed by Phase 4.
- `tests/private-content/repair-service.test.ts`: two existing tuple-cast diagnostics.
- The single parallel full-suite Phase 2 key-tampering flake described above is recorded as a regression-harness observation, not a Phase 4 defect; its focused rerun passed.

## External and convergence gates

Not locally claimed: production MySQL, S3/MinIO, ClamAV, KMS, alert delivery, Linux/systemd supervision, operational restore against an external backup target, and live Wayfarer/Harborlight deployment convergence.
