---
title: Project Bridgewatch v1.2 Local Validation Record
audience: engineering
status: active-implementation
canonical_for: project-bridgewatch-v1.2-local-validation
last_reviewed: 2026-08-16
---

# Project Bridgewatch v1.2 — Local Validation Record

## Scope

This record covers the v1.2 Mission Control implementation before protected
mainline integration. It records local, task-owned evidence only and neither
reopens the accepted Phase 1–3 program nor authorizes a Bridgewatch Phase 4.

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

## Boundary and remaining protected evidence

The validation does not claim a protected-main merge, ownership of the shared
4318 listener, staging deployment, owner acceptance, or a Sounding Line release
decision. The isolated live collector success is not a deployment claim. Those
claims require a new exact-candidate authoritative envelope and successful
protected-main binding. Current V14 policy permits only mainline candidate
qualification from trusted protected main and rejects both the product branch
and release-candidate gate used here; an owner policy/authority action is
therefore required before protected integration can continue.
