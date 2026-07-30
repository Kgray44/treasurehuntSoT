---
title: Project Sounding Line Phase 3 Mainline Validation Record
audience: engineering
status: current
---

# Project Sounding Line Phase 3 Mainline Validation Record

All results below were obtained from exact integration merge
`d01f340e38a5194f1ee887d73d2bcdca88249a57` unless a retained exception is
explicitly identified.

| Gate                                     | Result                      | Exact evidence                                                                                                                                                       |
| ---------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma SQLite client                     | PASS                        | `prisma generate --schema prisma/schema.sqlite.prisma`                                                                                                               |
| Focused Sounding Line suites             | PASS                        | `node --test` Phase 1 CLI, Phase 2 runtime, Phase 3, and preparation tests: 32 tests                                                                                 |
| Full unit suite                          | PASS                        | Vitest: 162 files, 1,106 tests, 83.90 s                                                                                                                              |
| Policy and inventory                     | PASS                        | policy `1.1.0`, digest `c0cf74d2c24e23a2bd0a2d40a6efee0a9c342ac5c2576f49f61301abc726c946`; inventory complete with zero critical unknowns                            |
| TypeScript and formatting                | PASS                        | `tsc --noEmit`; repository Prettier check                                                                                                                            |
| Documentation and catalog                | PASS                        | documentation validation and tests (4/4); catalog generation, validation (33 entries), and tests (8/8)                                                               |
| Architecture, language, privacy          | PASS                        | One Voyage architecture, Voyagewright language, and repository privacy scan                                                                                          |
| Lint                                     | PASS WITH EXISTING WARNINGS | 0 errors; 82 existing warnings, none introduced by the integration                                                                                                   |
| Production build                         | PASS                        | `next build --webpack`: compile, TypeScript, and 107 static pages completed                                                                                          |
| Harborlight targeted browser/concurrency | PASS                        | two isolated lanes, ports 3101/3102, 2/2 browser tests per lane; retained receipt `sounding-line-phase3-mainline-20260729-rerun/logs/harborlight-browser-lanes.json` |

The targeted lanes used separate task-owned validation mirrors, SQLite clones,
browser contexts, servers, output roots, and retained receipts. Their first
launch stopped before a browser/server started because both lanes attempted to
bootstrap the same ignored local `.env`; after the normal local configuration
was complete, the same governed lanes passed. This is recorded as harness
bootstrap evidence, not as a product failure.

The full canonical browser matrix was not rerun. The user-directed bounded
P34 result remains non-green: the prior canonical attempt timed out at test 15
after three minutes and test 22 after four minutes, then verified task-owned
cleanup. The exact-merge targeted browser and unit evidence found no new
Phase-3-specific regression, but they do not make P34 green or complete.

External MySQL/provider execution is not configured and remains
`EXTERNAL_PENDING`; it is excluded from the pass counts above.

Execution usage:

- Elapsed time: UNAVAILABLE_FROM_HOST
- Total tokens: UNAVAILABLE_FROM_HOST
- Input tokens: UNAVAILABLE_FROM_HOST
- Output tokens: UNAVAILABLE_FROM_HOST
