# Captain Guide: Vision Verification Operations

## Diagnostics

Open **Vision attempt diagnostics** for the active session. Confirm the story block, immutable waypoint version, package ID/hash, configured/effective mode, safe-demotion reason, Companion, engine/model/provider, frame counts, duration, failed gates, evidence digest, `raw frames retained: false`, story sequence, and attempt/presentation state. Historical B-4 shadow rows and B-5 attempts remain distinguishable.

## Decisions

Every action requires Captain permission, CSRF protection, a reason, and an idempotency key; it creates a durable decision and audit record.

- **Approve** only accepts an engine `VERIFIED` attempt and delivers the canonical story event once.
- **Reject** records the disposition and preserves the current stage.
- **Request rescan** asks the Player for new evidence without treating uncertainty as a wrong location.
- **Manual override** is the explicit audited path for progressing without a `VERIFIED` engine result and only exists when the published fallback policy permits it.
- **Label truth** records true/false positive/negative, insufficient, ambiguous, or unreviewable evidence for later reliability analysis.
- **Pause automatic** and **demote** immediately force Captain-confirmed policy for the published binding.
- **Promote** reruns certification, field-evidence, package, and rollout checks. A button or synthetic result cannot override failed preflight.

Shadow mode always pauses even when the engine recommends `VERIFIED`. Captain-confirmed mode always pauses for approval. Automatic must be treated as unavailable in the current B-5 release because the required B-4 real-pilot field evidence does not exist.

## Failure recovery

For stale attempts, inspect the newer story sequence and do not redeliver the old event. For a package/identity error, repair or reinstall the exact governed package and start a new attempt. For repeated technical errors, pause/demote, preserve the diagnostics, and use the published manual fallback only with a reason. For Phase A presentation failure, retrigger or continue through the recorded recovery action; do not approve the verification again.

For offline conflicts, compare the queued observation time/state version with current story events. Resolve visibly; never overwrite newer progress. Keep raw screenshots or recordings out of the server diagnostics. Field evidence, if separately authorized and retained, must follow the creator-data retention policy.

## Rollout and rollback

Enable Captain-confirmed integration before considering wider modes. Monitor false-result truth labels, stale/conflict counts, package failures, latency, and manual overrides. To stop B-5, turn off live external AR and the Player/Captain/offline feature flags, keep automatic flags false, and retain the additive database evidence for investigation.
