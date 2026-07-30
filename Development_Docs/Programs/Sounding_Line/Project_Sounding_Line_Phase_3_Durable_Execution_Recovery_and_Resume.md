---
title: Project Sounding Line Phase 3 Durable Execution Recovery and Resume
audience: engineering
status: current
---

# Durable execution

Run journals live outside Git and record plan/source/policy identity, controller host/PID, executable digest, controller-token digest (never the token), state, cleanup, heartbeat, and a bounded followable log. `sounding-line phase3 runtime start` creates a detached Node controller, so it does not rely on the caller's terminal pipe; the controller has a cooperative cancellation loop and emits a clean terminal receipt for the no-allocation control path.

Equivalent active requests are suppressed. `runtime inspect-orphans` only marks a local run orphaned after its recorded controller identity is no longer live. `runtime recover` requires exact source, policy, and plan identities; callers that provide a history store also require a valid SQLite integrity result. Resume is refused when identities differ or cleanup is unknown. The current controller deliberately has no direct product-adapter execution path: adapter work remains governed through the existing Phase 2 runtime until a separately tested allocation/cleanup contract is added.
