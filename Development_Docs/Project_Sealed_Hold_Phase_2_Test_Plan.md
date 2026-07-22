# Project Sealed Hold Phase 2 Test Plan

**Status:** living plan. A test is passed only when its named command/result is recorded in the validation record; unchecked rows are not passes.

## Current focused coverage

| Area | Current proof | Expected result |
| --- | --- | --- |
| V1 envelope/path/storage | `tests/private-content/package.test.ts` | bounded authenticated package, wrong-passphrase/tamper rejection, traversal rejection, local hash finalization |
| Frozen contracts | `tests/private-content/phase2-contracts.test.ts` | transition legality, wrapped-key tamper rejection, scanner configuration truth, truncated v2 rejection |
| repository private-content scan | `tests/private-content/security.test.ts` | sentinel/sensitive-content detection behavior |

Run focused coverage with `npm test -- tests/private-content`. The final command and environment belong in `Project_Sealed_Hold_Phase_2_Validation_Record.md`, not this plan.

## Required acceptance matrix

| Area | Required proof |
| --- | --- |
| Prisma/migrations | format, SQLite/MySQL validate/generate, ordered clean/existing SQLite rehearsal, MySQL static and isolated-live result where available |
| Package/upload | v1 compatibility; v2 incremental frames, backpressure, cancellation, truncation/reorder/duplicate/tamper, resumable durable parts, expiration/cleanup/digest mismatch |
| Keys/retry payload | random DEK/wrap/unwrap/tamper, dual-read, resumable legacy plaintext backfill, verified clear/tombstone, rotation/rewrap/retirement gate |
| Storage | local streaming/range/checksum/promotion/quarantine; isolated S3-compatible multipart/resume/abort/health when service available |
| Scanner | synthetic outcomes, real adapter health/version where available, timeout/retry/restart, non-clean delivery denial, override audit, bounded image/audio/video/PDF/GLB fixtures |
| Canonical import | each content type, Studio validator rejection, deterministic mappings/conflicts, private draft handoff, immutable published version policy, no session/invitation/Community side effects |
| Workers | enqueue transaction rollback, claim race, lease renewal/expiry, cancellation, bounded retry, idempotency, shutdown and restart recovery |
| Delivery/export | owner/player/reveal/cross-account/anonymous denial, clean/quarantine enforcement, ranges/safe headers, current-canonical-state export, edit-after-import round trip, cancellation/progress/download expiry |
| Backup/integrity | encrypted closed backup, tamper/object failure, isolated DB/object restore, authorization after restore; missing/corrupt/orphan/unknown-key/missing-mapping/stale-upload repair and GC grace/reference preservation |
| Studio/API/CLI | authenticated dashboard/workflow, progress/paused/cancelled/retry/conflict/health/status, keyboard/focus/reduced-motion/screen-reader/mobile checks |
| Repository | private-content/staged-diff/build scans, format, lint, TypeScript, complete Vitest, production build, browser tests where supported, documentation and archive synchronization |

## Isolation rules

Use synthetic fixtures only; create storage/database roots outside the repository and remove only exact isolated targets. No production MySQL, object store, keys, scanner, user data, workbooks, services, or endpoint configuration is in scope. An unavailable external provider is recorded as skipped/blocked with its exact attempted command/error while provider-neutral proof continues.
