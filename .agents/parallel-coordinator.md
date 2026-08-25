# Parallel Coordinator

`scripts/parallel-coordinator/coordinator.mjs` is deterministic scheduling logic. It has no native-chat, GitHub mutation, Sounding Line, or product-write authority.

## Autonomous dispatch

Use `AUTONOMOUS_DISPATCH` when the Coordinator Codex parent chat has the native agent harness. In the current Codex harness, the parent can create bounded workers with `spawn_agent`, discover live task agents with `list_agents`, deliver a dispatch with `followup_task` (or queue a non-waking message with `send_message`), and monitor/retrieve replies with `wait_agent`. Agent IDs returned by that harness are the session-local `workerRef`; do not put them in Git, handoffs, prompts, or reports intended for the repository.

The parent chat owns the `CodexWorkerTransport` adapter behavior:

1. Keep `/.coordinator/worker-registry.json` task-local and ignored. Register only a unique `(project, PR, workerRef)` match. If discovery is ambiguous, mark only that worker unreachable.
2. Fetch protected main and live PR state. Run `planAutonomousDispatch` with product handoffs plus registry state.
3. Deliver only returned envelopes. A `FINALIZE_NEXT` envelope authorizes one ordinary finalization attempt; reconciliation envelopes authorize one focused reconciliation. `WARM_STANDBY` and `HOLD` produce no message.
4. Receive the `PARALLEL_WORKER_REPLY_V1` envelope, verify the responding `workerRef`, and call `validateWorkerReplyAgainstLiveState` with fresh GitHub observations before changing local state or replanning.
5. Store only registry refs, compact handoffs, queue plan, dispatch IDs/outcomes, current main, and metrics. Never persist transcripts, credentials, or cross-project private context.

The repository protocol is in `controller-protocol.mjs`. It deliberately has no executable network transport: native parent-chat dispatch is supported by Codex and remains outside deterministic Node scheduling. When that native harness is unavailable, run the existing `plan`/advisory flow and have the owner relay envelopes manually.

## Safety and retries

- One mutable dispatch may be active per worker. Duplicate `dispatchId` values are suppressed.
- A stale response, live head mismatch, moved protected main, or ambiguous worker fails closed and triggers replanning; it never authorizes a merge.
- Park `UNREACHABLE` workers and advance other legal candidates. Do not message HOLD workers.
- At most two worker-owned candidate-repair cycles may follow a genuine ordinary-Sounding-Line defect. Then park the product as `BLOCKED`.
- Product handoffs retain only product truth. Transport lifecycle (`IDLE`, `DISPATCHED`, `RUNNING`, `REPLIED`, `UNREACHABLE`) is coordinator-local.
