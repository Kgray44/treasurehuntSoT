---
title: Project Trim Phase 1 Benchmark and Dogfood Record
audience: engineering
status: current
canonical_for: project-trim-phase-1-dogfood
last_reviewed: 2026-08-14
---

# Project Trim Phase 1 benchmark and dogfood record

The Phase 1 generator was run against four tracked representative fixtures. The generated task-local packets were not retained as canonical records; this record preserves their safe summary.

| Fixture                        | Pointers | Confidence                 | Authority pointers | Mapping fallback                | Packet bytes | Expansion required        | Unrelated project context | Usage                                        |
| ------------------------------ | -------: | -------------------------- | -----------------: | ------------------------------- | -----------: | ------------------------- | ------------------------- | -------------------------------------------- |
| focused repair                 |        4 | BOUNDED                    |                  4 | conservative profile fallback   |        5,628 | yes, SOURCE demonstration | no                        | CALIBRATED_ESTIMATE 36,000 (19,800-55,800)   |
| bounded product implementation |        6 | BOUNDED                    |                  4 | conservative profile fallback   |       10,835 | no                        | no                        | CALIBRATED_ESTIMATE 108,000 (59,400-167,400) |
| documentation-only             |        4 | PARTIAL_REQUIRES_EXPANSION |                  4 | unknown mapping targeted search |        3,953 | no                        | no                        | CALIBRATED_ESTIMATE 45,000 (24,800-69,800)   |
| release closure                |        6 | PARTIAL_REQUIRES_EXPANSION |                  4 | unknown mapping targeted search |        4,715 | no                        | no                        | CALIBRATED_ESTIMATE 48,000 (19,200-86,400)   |

The estimates use `project-trim-r1-bands-1.0` and are not official billing. These fixtures do not provide a defensible pre-Phase-1 token comparison, so no savings percentage is claimed. The observed remaining waste class is coarse/partial mapping coverage: Phase 1 safely surfaces it and performs targeted expansion rather than omitting needed context.

## Phase 1 implementation accounting

- Wall clock: approximately 13 minutes from fresh-worktree creation to focused qualification.
- Exact Codex goal accounting: unavailable in the task surface. First-order `CALIBRATED_ESTIMATE`: 117,000 tokens, range 64,400-181,400, `MIXED_ENGINEERING`, medium confidence, estimator `project-trim-r1-bands-1.0`; not official billing.
- Full governing documents read: 1 (the supplied R1 PDF). Broad repository searches: 0. Context expansions recorded in dogfood: 1. Repeated reads observed in the dogfood ledger: 0.
- Largest remaining waste class: incomplete impact mapping, which correctly triggers conservative expansion. The package runner also attempted normal dependency setup but stopped on local ignored-build approval metadata; direct bundled-tool qualification remained available.
