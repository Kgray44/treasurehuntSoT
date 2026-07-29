---
title: Project Sounding Line Phase 2 Execution Graph and Scheduler
audience: engineering
status: current
---

# Execution Graph and Scheduler

Plans are deterministic, nonauthoritative records. A plan has one node per
selected suite, validates dependencies, rejects cycles, and records
policy/source digests. Ready nodes sort deterministically and may run together.

Policy text never supplies a command. A reviewed adapter is resolved locally,
leases are acquired atomically, receipts are written, and only owned leases are
released. Failed nodes block dependents. The legacy harness remains the global
release authority.
