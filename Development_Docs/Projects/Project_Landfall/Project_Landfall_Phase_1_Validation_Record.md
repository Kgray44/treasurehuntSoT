---
title: Project Landfall Phase 1 Validation Record
audience: product-engineering
status: current
canonical_for: project-landfall-phase-1-validation
last_reviewed: 2026-09-29
---

# Phase 1 Validation Record

This record contains commands and outcomes observed on the Phase 1 candidate. Hosted PR checks and protected integration are tracked by the PR rather than inferred from local proof.

## Local proof

| Check                                        | Observed result                                                                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Recovered v1.0 PDF integrity                 | Attached source and repository copy have identical SHA-256 `6d37b0c634fc1aa578debbbd79d6eb5a478526ab1143e0e80ee89393203aec5`      |
| Focused Landfall/Drydock/Chronicle tests     | 14 files, 50 tests passed on the candidate worktree; includes mock browser intake and DOM map rendering                           |
| SQLite migration rehearsal                   | Passed 70 migrations on fresh and upgrade in-memory histories with preserved pre-existing row                                     |
| SQLite and MySQL Prisma schema validation    | Passed both schemas using non-secret local placeholder connection strings                                                         |
| MySQL server migration                       | Not run; no isolated supported MySQL server in this worktree                                                                      |
| TypeScript and affected ESLint               | `npm run typecheck` passed; affected ESLint passed with one existing unused `_publishedAt` warning in `src/chronicle/snapshot.ts` |
| Production build                             | `npm run build` passed on the candidate worktree; existing Edge-runtime/NFT warnings remain outside Landfall                      |
| Documentation and feature catalog validation | `npm run docs:index`, `docs:validate`, `features:sync`, and `features:validate` passed                                            |
| Ordinary Sounding Line                       | PASS on code candidate `66d42bb6`; the selected generic browser profile passed 23/23 tests in a task-owned built-server runtime   |
| PR checks / protected integration            | Tracked by the PR; local qualification alone does not establish hosted acceptance or protected integration                        |

The browser mock tests use synthetic positions and a fictional virtual chart. They establish deterministic behavior and DOM projection but do not constitute live hardware, actual map tiles, deployment database proof, or owner acceptance. The selected legacy Homeport, Helm, and Drydock browser journeys were aligned with the already accepted sign-in, Studio, and Muster UI before the ordinary Sounding Line passed; no unrelated product behavior was changed for those tests.
