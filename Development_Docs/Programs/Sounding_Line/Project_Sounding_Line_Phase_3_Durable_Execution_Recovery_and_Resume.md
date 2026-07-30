---
title: Project Sounding Line Phase 3 Durable Execution Recovery and Resume
audience: engineering
status: current
---

# Durable execution

Run journals live outside Git and record plan/source/policy identity, controller host/PID, state, cleanup, heartbeat, and a bounded followable log. Equivalent active requests are suppressed. Resume is refused when source, policy, or plan identity differs, or when terminal cleanup is unknown. Cancellation is durable and terminal state is logged.
