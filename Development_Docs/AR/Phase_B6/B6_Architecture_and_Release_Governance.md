# Phase B-6 architecture and release governance

## Product boundary

Version `0.8.0-b6` keeps the shared Next.js frontend, Electron desktop shell, local Companion, SQLite/MySQL data models, and the B-4 classical CPU vision engine. It does not add injection, memory reading, input automation, in-game overlays, unrestricted package execution, cloud frame upload, or a second desktop-only authoring implementation.

The renderer is sandboxed with Node integration disabled and context isolation enabled. The preload exposes a fixed command surface. The Companion binds to loopback, requires explicit pairing, exact origins, signed challenges, monotonic request sequences, bounded payloads, and command schemas. Runtime Player frames stay in bounded memory and are cleared after evidence selection; Creator recordings are separately retained authoring assets.

## B-6 components

- `release/*.json`: machine-readable issue register, compatibility policy, release status, performance budgets, error catalog, and dataset manifest.
- `scripts/run-vision-b6-replay.cjs`: deterministic production-engine replay with selectors, concurrency, comparisons, gate-level output, Wilson intervals, and zero-event upper bounds.
- `scripts/run-vision-b6-soak.cjs`: bounded build/scan and RSS regression harness.
- `apps/companion/release-governance.cjs`: canonical Ed25519 metadata, artifact integrity, channel/platform/version/path rules, and active-session interlocks.
- `apps/desktop/release-manager.cjs`: staged download state, atomic activation, startup recovery, health-check rollback, and user-data separation.
- `scripts/build-release.ps1`: validation, signing boundary, NSIS build, Authenticode verification, provenance, manifest, and checksums.
- `/studio/release-readiness` and `/api/vision-release/readiness`: persisted NO-GO evidence surface.
- `VisionImprovementCandidate`: metadata-only queue created from Captain truth labels; Creator disposition is audited and never mutates a locked corpus automatically.

## Versioned contracts

The application/desktop version is `0.8.0-b6`; Companion protocol compatibility is `1.0` and `2.0`; the active B-4 engine remains `1.0.0-b4`; the classical model bundle remains `classical-vision-cpu-1`; and the runtime package schema remains `1`. Compatibility rules explicitly distinguish compatible, migration-required, retest-required, deprecated, and unsupported states.

Published waypoint versions remain immutable. New B-6 certification and compatibility fields default historical published versions to `DRAFT` and `NEEDS_RETEST`, which preserves data without making a new trust claim.

## Release authority

ADR 0018 makes persisted blockers authoritative. ADR 0019 separates signed release metadata from Windows Authenticode and specifies atomic rollback. The current state is `EXPERIMENTAL / NO_GO`; no feature or waypoint type is presented as stable. Nine release-blocking issues remain open after the packaged-capture and local-Rive fixes.

## CI

`.github/workflows/vision-release-gates.yml` defines a Windows fast gate and a scheduled/manual full replay job on `windows-2025`. The label is currently listed by the official [GitHub runner-images repository](https://github.com/actions/runner-images). This workflow has not yet run on the hosted repository, so B6-004 remains open.
