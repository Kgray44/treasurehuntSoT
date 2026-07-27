# Project Sealed Hold Phase 2 Validation Record

## Contract reconciliation

The owner-authorized 2026-07-22 V2 amendment is governing. The prior `blocked-governing` conclusion was historical: implementation started before the record specified the authenticated header, exact UTF-8 passphrase handling, record ordering, terminal chain receipt, and bounded persistent transport requirements. V2 is implemented in place; no V3 was introduced.

## Continuation evidence

| Gate                          | Result                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma generation             | Primary and SQLite clients regenerated after confirming no Sealed Hold Node/Next/Prisma process held the query-engine DLL.                                                      |
| Prisma validation             | MySQL schema validated with an isolated syntactic MySQL URL; SQLite schema validated with an isolated SQLite URL.                                                               |
| Formatting and typecheck      | `prettier --check .` and `tsc --noEmit` passed.                                                                                                                                 |
| Focused private-content suite | 11 files, 49 tests passed.                                                                                                                                                      |
| Full Vitest                   | 102 files, 905 tests passed in 101.03 s. Existing jsdom/canvas/animation diagnostics were non-failing.                                                                          |
| SQLite                        | Clean application of all 16 migrations followed by materialization/export proof for draft, published, archive, and V1 service flow; `foreign_key_check` returned zero findings. |
| Lint                          | Zero errors; 61 inherited warnings.                                                                                                                                             |
| Production build              | Turbopack rejects the local shared `node_modules` symlink. `next build --webpack` passed, including TypeScript and all 58 generated pages.                                      |
| Security scans                | Repository, staged-diff, and build-output private-content scans passed; language validation passed.                                                                             |
| Browser attempt               | An owned dev server and an owned production server both stopped on the shared dynamic-route conflict described below, before Studio rendered.                                   |

## External integrations

Docker, `mysql`, MinIO/S3, ClamAV, and a KMS emulator were absent. Their provider-neutral implementations and deterministic tests are complete, while live integration status is `implemented-external-unconfigured`. No unavailable provider was recorded as passed.

## Browser acceptance

The owner-authorized mainline correction `4a84b9fd2dfa439127c35b8ce865ff8b7a5742b7` was cherry-picked as `b3fe602d0a643914b7b53e5e9c508b85e3e2aaf5`. It moved only the public listing route to `src/app/api/community/listings/public/[slug]/route.ts`. The owned production server (PID `28644`, port `4317`) then rendered the authenticated private-content console against `sealed-hold-phase2-browser.db` and isolated private provider/object/staging roots. Synthetic V1 package selection, inspection, import, canonical materialization, passphrase clearing, status announcements, verified export/download, mobile portrait, and desktop checks passed. The server was stopped after validation.
