# Captain guide: Vision operations and recovery

Open the active session’s **Vision attempt diagnostics** and **Vision help**. Confirm the current story stage, waypoint/version, package hash, engine recommendation, result distinction, failed gates, timing, provider/fallback, retention status, and event-delivery state.

## Decisions

- Approve a `VERIFIED` result only when the real Player situation is known.
- Reject evidence that is wrong, unsafe, stale, or belongs to another stage.
- Request a rescan for insufficient or ambiguous evidence and give actionable guidance.
- Manual override is an explicit governed recovery action. It advances at most once and remains auditable.
- Shadow mode records outcomes without automatic story progression.

## Truth labels and improvement

Use `TRUE_POSITIVE`, `TRUE_NEGATIVE`, `FALSE_POSITIVE`, `FALSE_NEGATIVE`, or `UNREVIEWABLE` honestly. A non-unreviewable label creates or updates a metadata-only candidate. It never saves raw Player frames, changes thresholds, mutates a published package, or enters a locked corpus automatically. Creator review and independent admission remain separate.

## Privacy responsibility

Retain only the minimum required evidence. Verify that `rawFramesRetained` is false unless the Player gave separate explicit consent. Do not copy secrets, footage, unrelated window titles, or private story answers into reasons or support logs.
