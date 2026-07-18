# Phase B-4 Test Plan and Results

## Evidence boundary

The automated suite proves the implementation and its deterministic synthetic fixtures. It does not prove Sea of Thieves field reliability. No real-game creator recording, unseen positive scan, hard-negative corpus, boundary corpus, or game-impact capture was available in this checkout.

## Commands and results

### Clean platform validation

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-all.ps1 -SkipBrowserInstall
```

Result on 2026-07-18: exit 0.

- SQLite: all 9 migrations applied from an empty validation database.
- Formatting, ESLint, and TypeScript: passed.
- Vitest: 36 files, 111 passed, 0 failed, 0 skipped.
- Restricted desktop bridge: 3 passed, 0 failed, 0 skipped.
- Companion contracts/runtime: 28 passed, 0 failed, 0 skipped.
- Playwright: 32 passed, 0 failed, 12 skipped.
- Production Next.js build: passed.
- Production start/restart proof: passed twice; `/dev/animations` remained unavailable in production.

The 12 WebKit skips are intentional mutation/shared-database exclusions. Chromium owns the mutating acceptance cases; WebKit retains read-only access, responsive, and accessibility coverage. Browser logs also showed the existing Rive CDN/WASM fallback warning while the local SVG fallback and suite continued successfully.

### Engine replay and durable evidence

```powershell
node scripts/run-vision-b4-replay.cjs --output Development_Docs/AR/Phase_B4/Evidence/synthetic-replay-report.json
```

Result: exit 0. Three materially different mathematical fixtures ran through the production build and runtime implementations. Each positive returned `VERIFIED`; the easy negative returned `NOT_AT_TARGET`; the two confusable negatives returned `AMBIGUOUS`; all weak-input cases returned `INSUFFICIENT_VISUAL_EVIDENCE`.

### Focused Companion tests

```powershell
npm run companion:test
```

Result: 28 passed. Coverage includes multi-frame gates, frame zeroization, immutable storage, package loading, corrupt/unsafe/duplicate package rejection, provider fallback, cancellation, timeout, stale stage, leakage, deterministic repeat builds, idempotent completion, and the synthetic latency budget.

### Schema checks

```powershell
npx prisma validate --schema prisma/schema.sqlite.prisma
npx prisma validate --schema prisma/schema.prisma
```

Result: SQLite and MySQL schemas validated. The clean platform command independently deployed the complete SQLite migration chain.

## Dataset identities

All three datasets are generated mathematical fixtures and make no Sea of Thieves claim.

| Fixture                        | BuildInput SHA-256                                                 | Package SHA-256                                                    |
| ------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Easy exact landmark            | `6b91df9c73f7ef6509bad7dd26cf9b330d148a6c98980f95414e6cfc34314853` | `a4b3085257a6b267b0dfb0b885239fb40646c8415cfe361364901f9c30a0e261` |
| Moderate natural location      | `2433842a90f57df1590216f2bd5e8d24829acef1f8ceb1ebee85942ac9ffcde6` | `d00e1f19f63a873dfd0636b627d8f0526624572b5ce4544a3c467588955554b6` |
| Difficult confusable viewpoint | `0e01c54c3e16cf88e51ab79d8b49bf7996697de5909733be8993ff633f1a3f58` | `f920325119d3d971232bcb242684ec06264b21aad22e22e47e4b480b060570f5` |

## Required-test coverage map

| Requirement                                   | Result                                                    | Evidence                                                                |
| --------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| Unit and contract tests                       | PASS                                                      | Vitest, desktop, and Companion totals above                             |
| Migration tests                               | PASS                                                      | Empty SQLite database, 9 deployed migrations                            |
| Build integration                             | PASS for synthetic engine and Studio persistence contract | Companion pilot test plus Chromium Studio flow                          |
| Package loader                                | PASS                                                      | Corrupt, traversal, duplicate, schema/model/runtime, and size rejection |
| Replay                                        | PASS for synthetic fixtures                               | Durable JSON evidence                                                   |
| Positive/negative/boundary real pilot corpora | NOT RUN                                                   | No authorized real-game corpus was supplied or captured                 |
| Provider fallback                             | PASS for CPU fallback                                     | Detected GPU providers are never falsely activated                      |
| GPU inference                                 | NOT RUN                                                   | No GPU backend exists in B-4                                            |
| Cancellation and timeout                      | PASS                                                      | Deterministic safe-failure tests                                        |
| Corruption and stale stage                    | PASS                                                      | Package loader and runtime tests                                        |
| Deterministic repeat                          | PASS                                                      | Identical package hash for identical governed inputs                    |

## Remaining validation

Phase B-4 cannot close until three real, materially different Sea of Thieves waypoints have independent reference, validation, locked, negative, and boundary recordings; field truth labels; zero locked false accepts; first-scan and guided-retry rates; CPU/GPU/memory/game-impact measurements; and a reproducible live Companion/Studio demonstration.
