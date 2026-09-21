---
title: Project Bridgewatch v1.2 Local Validation Record
audience: engineering
status: current
canonical_for: project-bridgewatch-v1.2-local-validation
last_reviewed: 2026-08-17
---

# Project Bridgewatch v1.2 — Local Validation Record

## Scope

This record preserves the local, task-owned v1.2 Mission Control evidence and
its later protected-main integration receipt. It neither reopens the accepted
Phase 1–3 program nor authorizes a Bridgewatch Phase 4.

## Verified implementation evidence

- `npm --prefix bridgewatch run validate` passed 67 focused Bridgewatch tests,
  including discovery, reconciliation, comparison, server, store, source,
  Sounding Line v1.4 projection, and Mission Control route coverage. One
  parallel-worker performance-threshold observation was reproduced three times
  in isolation and once with the complete suite serialized (all passed); no
  application change was made because the only failure occurred under shared
  test-worker contention.
- `npm --prefix bridgewatch run build` completed successfully.
- The direct root gateway suite
  `vitest run src/admiralty/bridgewatch-gateway.test.ts` passed 7 tests.
- `npm run docs:index`, `npm run docs:validate`, `npm run lint`, and
  `npm run typecheck` completed successfully. Lint reported existing and
  generated warnings only; it reported no errors.
- A task-owned loopback instance on `127.0.0.1:48519` passed `/healthz`, served
  the reconciled project portfolio, presented Bridgewatch `v1.2` as
  authoritative and `IN_DEVELOPMENT`, and returned the enriched project and
  phase profiles.
- With the existing keyring-backed GitHub session supplied only to that child
  process, the collector was `HEALTHY`, recorded 100 retained pull requests and
  30 branches, reported 4,951 remaining requests, and observed main
  `3df555a05efee98270dd69bcae32a7e34c814c12`. No token was written to a file or
  retained in this record.
- The requested direct `127.0.0.1:4318/healthz` returned `200` and
  `READ_ONLY`, but its listener was not owned by this worktree, so it was not
  restarted or replaced; its direct `/bridgewatch` request returned `404`.
  The staging hostname did not resolve from this host.
- Static accessibility coverage verifies labelled controls, visible focus,
  reduced motion, responsive layout, and hash Back/Forward handling. Current
  interactive browser control was unavailable in this environment, so no new
  candidate-specific visual screenshot claim is made.

## Historical local-evidence boundary

The preceding isolated listener and collector observations remain local
evidence. They do not claim ownership of the shared 4318 listener, a staging
deployment, or a later operator observation. Those claims remain separately
verified after protected integration.

## Protected integration receipt

Bridgewatch v1.2 reached protected main through
[PR #160](https://github.com/Kgray44/treasurehuntSoT/pull/160). Its exact
candidate `94f4d1d67797c15be05b4a1f6660289a2a77627a`, qualified against
`cf7f94e96c22c01e01e36532f9dc803691cbe7b4`, received `RELEASE_GO` from
[Sounding Line run 32008030331](https://github.com/Kgray44/treasurehuntSoT/actions/runs/32008030331): 12/12 logical and 12/12 physical receipts passed with clean runtime conformance.

Normal protected binding then passed in
[run 32007940402, attempt 2](https://github.com/Kgray44/treasurehuntSoT/actions/runs/32007940402), and PR #160 merged as
`d0c41961e106fcc05eafdc5988de2a59c285fe15`. The protected merge parents are
the qualified base and exact candidate; its tree
`8dfde72f99aecaa6d2608e24376879c7cc7ceb3f` equals the validated candidate
tree. Detached exact-main verification passed Bridgewatch validation (68 tests),
the Bridgewatch build, the 7-test Admiralty gateway suite, and documentation
validation. This record-only follow-up updates generated Feature Catalog
provenance only; it adds no product, schema, route, or authority behavior.
