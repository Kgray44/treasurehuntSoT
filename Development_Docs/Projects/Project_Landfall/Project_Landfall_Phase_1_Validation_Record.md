---
title: Project Landfall Phase 1 Validation Record
audience: product-engineering
status: current
canonical_for: project-landfall-phase-1-validation
last_reviewed: 2026-09-29
---

# Phase 1 Validation Record

This record is updated only with commands and outcomes actually observed on the Phase 1 candidate. Protected PR checks and the ordinary Sounding Line are recorded after the candidate is frozen.

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
| Ordinary Sounding Line                       | Pending frozen candidate commit                                                                                                   |
| PR checks / protected integration            | Pending candidate publication                                                                                                     |

The browser mock tests use synthetic positions and a fictional virtual chart. They establish deterministic behavior and DOM projection but do not constitute live hardware, actual map tiles, deployment database proof, or owner acceptance.
