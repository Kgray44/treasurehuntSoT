---
title: Project Landfall Phase 1 Validation Record
audience: product-engineering
status: current
canonical_for: project-landfall-phase-1-validation
last_reviewed: 2026-09-30
---

# Phase 1 Validation Record

This record separates the original Phase 1 foundation from the live-position closure candidate. Hosted PR checks and protected integration are tracked by their PRs rather than inferred from local proof.

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
| Original PR #666 hosted and protected integration | Hosted Sounding Line run `36649910643`, job `109681401517`, passed on head `9e0e66bd010526af1248d89b64d5bf297c1f1e65`; merged as `3e59bd2a7b5c2463932e23c28de50df8ce3e1aad` |

The browser mock tests use synthetic positions and a fictional virtual chart. They establish deterministic behavior and DOM projection but do not constitute live hardware, actual map tiles, deployment database proof, or owner acceptance. The selected legacy Homeport, Helm, and Drydock browser journeys were aligned with the already accepted sign-in, Studio, and Muster UI before the ordinary Sounding Line passed; no unrelated product behavior was changed for those tests.

## Live-position closure candidate

The original candidate lacked the ordinary Player Journal live-position path required by v1.0 section 23.1. The [closure record](Project_Landfall_Phase_1_Live_Position_Closure_Record.md) documents the source correction. On the closure candidate, `npm run typecheck` passed, focused Landfall/API Vitest files passed, and the dedicated task-owned production-browser suite passed 4/4 journeys. The browser run used synthetic physical coordinates, a fictional virtual chart, a nonce-bound isolated SQLite database, and the built Player route. It verified explicit grant, current-position status, watch teardown, denial, virtual no-GPS behavior, nonmember rejection, hidden-geometry exclusion, and no canonical visit from local confidence. Final ordinary Sounding Line, hosted checks, and landed-tree smoke will be recorded after the candidate is frozen and integrated.
