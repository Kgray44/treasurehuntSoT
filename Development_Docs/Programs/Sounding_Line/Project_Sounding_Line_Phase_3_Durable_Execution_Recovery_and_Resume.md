---
title: Project Sounding Line Phase 3 Durable Execution Recovery and Resume
audience: engineering
status: current
---

# Durable execution

Run journals live outside Git and record plan/source/policy identity, controller host/PID, executable digest, controller-token digest (never the token), state, cleanup, heartbeat, and a bounded followable log. `sounding-line phase3 runtime start` creates a detached Node controller, so it does not rely on the caller's terminal pipe; the controller has a cooperative cancellation loop and emits a clean terminal receipt for the no-allocation control path.

Equivalent active requests are suppressed. `runtime inspect-orphans` only marks a local run orphaned after its recorded controller identity is no longer live. `runtime recover` requires exact source, policy, and plan identities; callers that provide a history store also require a valid SQLite integrity result. Resume is refused when identities differ or cleanup is unknown.

For an explicitly declared, local `execution` request, the controller may run one narrowly allowlisted Phase 2 adapter (`policy`, `inventory`, documentation/language/architecture/privacy checks, or Prisma schema validation). It creates a sealed, non-authoritative Phase 2 runtime, uses its lease and cleanup path, and records only adapter identity and digests in the Phase 3 journal. Browser, build, and legacy-full adapters are intentionally excluded from this controller path pending their distinct resource and cancellation contracts.
