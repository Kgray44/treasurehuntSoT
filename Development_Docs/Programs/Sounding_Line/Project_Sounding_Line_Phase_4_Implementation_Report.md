---
title: Project Sounding Line Phase 4 Implementation Report
audience: engineering
status: current
---

# Project Sounding Line Phase 4 Implementation Report

## Implemented local protocol core

`scripts/sounding-line/phase4.mjs` provides the provider-neutral local control
contract. It implements worker enrollment, explicit trust domains and lifecycle
states, strict capability matching, sealed node-scoped assignments, heartbeat
identity, deterministic local/CI plan comparison, dual-run comparison,
canonical SHA-256 evidence manifests, replay prevention, cleanup enforcement,
release-veto decisions, and monotonic cutover transitions.

The CLI exposes only repository-relative JSON inputs for plan parity, dual-run,
local release-decision, and cutover checks. It does not execute arbitrary shell
commands, connect a remote worker, issue authoritative release status, or store
credentials. Every Phase 4 CLI result is `nonAuthoritative`.

## Trust and authority boundary

Local trusted, CI trusted, pull-request-restricted, and external-restricted
domains are separate. Restricted workers cannot satisfy release-authority or
private-fixture requirements. Unknown capabilities deny assignment. Revoked,
quarantined, unhealthy, drained, and offline workers cannot silently resume
normal work. Evidence binds source, policy, plan, node, attempt, worker boot,
environment, lockfile, executable, artifacts, outcome, cleanup, retention, and
digest identity.

## Remaining external proof

Hosted CI, separate remote workers, provider credentials, production signing
keys, branch-protection application, MySQL/provider gates, and the P34 full
browser matrix are not claimed by this local implementation. P34 remains
`P34-BME-20260729` and non-green. The legacy serial harness remains the
emergency fallback and has not been retired.

Execution usage:

- Elapsed time: UNAVAILABLE_FROM_HOST
- Total tokens: UNAVAILABLE_FROM_HOST
- Input tokens: UNAVAILABLE_FROM_HOST
- Output tokens: UNAVAILABLE_FROM_HOST
- Cached or reused tokens: UNAVAILABLE_FROM_HOST
- Tool calls: UNAVAILABLE_FROM_HOST
- Usage source: UNAVAILABLE_FROM_HOST
