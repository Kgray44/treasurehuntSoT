---
title: Project Sounding Line Phase 2 Integration Manifest
audience: engineering
status: current
---

# Project Sounding Line Phase 2 Integration Manifest

## Provenance

- Phase 2 branch: `codex/project-sounding-line-phase2-open-the-channels`
- Phase 1 expected closure and actual base: `5c0d185695c546337324db20442c6561469da2ed`
- `origin/main` at preflight: `3699f5e7c638d950aab3b55169b603121b57c85b`
- Harborlight observation: `codex/project-harborlight-phase4-secure-the-harbor` at `1840689c2e58bc156d67034e9c82ac2e0c7c30c2`

## Delivered surfaces

- `scripts/sounding-line/runtime.mjs`: marker-gated roots, canonical receipts,
  dependency graph checks, scheduler, broker, leases, SQLite baseline/clones,
  loopback service identity, browser context roots, cleanup, and compatibility
  status.
- `scripts/sounding-line/cli.mjs`: nonauthoritative `runtime`, `resource`,
  `compatibility`, and `certification report` commands. Product `run` and
  `cancel` are intentionally refused until an accepted allowlisted adapter is
  available.
- `tests/sounding-line/phase2-runtime.test.mjs` and
  `src/sounding-line/runtime.test.ts`: focused native and Vitest proof.

## Shared surfaces and package state

No shared configuration or package file was touched. Dependencies were
installed in the Phase 2 worktree with `pnpm install --lockfile=false
--ignore-scripts`; no lockfile or package manifest changed. Prisma generation
was not required by this standalone Node runtime. Runtime databases, browser
profiles, logs, and receipts stay outside Git under the local runtime base.

## Integration order and rollback

1. Complete and accept Harborlight Phase 4.
2. Integrate Harborlight and refresh Phase 1 inventory/resource metadata.
3. Rebase or merge Phase 2 only onto that accepted baseline after explicit
   authority; rerun coexistence, adapter, and compatibility evidence.
4. Enable only individually certified shared adapters, retaining the serial
   harness for every uncertified suite.

Rollback is a branch revert of the namespaced Sounding Line paths. It neither
requires database restoration nor changes the legacy harness.
