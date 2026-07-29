---
title: Project Sounding Line Phase 2 Validation and Integration Record
audience: engineering
status: current
---

# Project Sounding Line Phase 2 Validation and Integration Record

**Status:** PHASE 2 FOCUSED VALIDATED - HARBORLIGHT INTEGRATION PENDING

## Focused evidence

| Check                | Result | Evidence                                                                                                                        |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 policy       | PASS   | `node scripts/sounding-line/cli.mjs validate-policy`: 10 suites, 13 contracts, 9 owners, 16 resources, 6 gates, 3 debt records  |
| Native runtime suite | PASS   | `node --test tests/sounding-line/phase2-runtime.test.mjs`: 6/6                                                                  |
| Broker atomicity     | PASS   | conflicting two-resource bundle left a distinct resource acquirable                                                             |
| SQLite isolation     | PASS   | two clones accepted the same logical ID with different values; baseline row count remained zero                                 |
| Ports/processes      | PASS   | owned loopback HTTP service returned its token and was stopped by its retained handle                                           |
| Browser isolation    | PASS   | two real Chromium contexts connected only to the owned loopback service; cookie and `localStorage` state did not cross contexts |
| Graph execution      | PASS   | independent nodes ran in a concurrent batch; dependency and cycle checks passed                                                 |
| Stale ownership      | PASS   | matching expired marker was `SAFE_STALE`; forged marker was `AMBIGUOUS` and quarantined                                         |
| Vitest bridge        | PASS   | `pnpm exec vitest run src/sounding-line/runtime.test.ts`: 1 file, 1 test                                                        |
| Full Vitest          | PASS   | `pnpm exec vitest run`: 158 files, 1,097 tests                                                                                  |

The SQLite API reports Node's experimental warning; this is a runtime warning,
not a test failure. The browser proof used local Playwright Chromium and
synthetic state only. It made no request to a Harborlight service.

## Truthful exclusions

No MySQL service was configured for a live isolated schema rehearsal. The MySQL
adapter, external provider execution, product-suite adapter activation,
cross-run PID-reuse demonstration, shared-harness lock narrowing, full browser
matrix, and release validation remain **NOT VALIDATED**. They are
not counted as passing evidence. The Phase 2 runtime does not make an
authoritative release decision.

## Harborlight coexistence observation

At preflight, Harborlight Phase 4 was observed read-only at
`codex/project-harborlight-phase4-secure-the-harbor`, local head
`1840689c2e58bc156d67034e9c82ac2e0c7c30c2`, with no working-tree status lines.
Sounding Line created its own local worktree, runtime base, ports, databases,
browser contexts, storage, logs, and receipts. No Harborlight file, database,
port, process, browser state, storage root, or validation lock was acquired,
read for execution, or modified.
