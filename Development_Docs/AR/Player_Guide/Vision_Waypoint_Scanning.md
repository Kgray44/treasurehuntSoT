# Player Guide: Vision Waypoint Scanning

## Before scanning

Open the active Tall Tale stage and check the readiness card. It names the selected target, connection state, package state, and configured interaction. In the web/PWA surface, pair the local Companion using the displayed ceremony. In desktop, select the intended Sea of Thieves window. Do not proceed if the selected source or package/version is wrong.

The Companion processes the scan locally. Runtime frames remain in memory, are bounded and discarded after evaluation, and are not uploaded or retained by default. The server receives only derived gates, counts, hashes, provider/version data, duration, and sanitized diagnostics.

## Scan

For **hold** mode, press and hold the scan control or its keyboard equivalent until the real elapsed progress completes; releasing early cancels. For **toggle** mode, activate once to start and again to finish. Keep the game view stable, include the landmark and surrounding context, and move slowly if prompted. The UI does not simulate progress or fabricate confidence.

Results mean:

- **Verified:** the engine found the configured evidence. Shadow and Captain-confirmed stages still wait for Captain; this is not hidden as automatic success.
- **Need a clearer view:** widen the context, remove obstruction/blur, and retry.
- **Not at target:** re-read the story directions and try another bearing; the UI does not reveal the answer.
- **Ambiguous:** include a second landmark or more surroundings. It never advances.
- **System unavailable:** story progress is safe; check Companion/package/source and retry.
- **Story moved on:** the delayed result was stale and did not change progress.

## Recovery

Cancellation never advances the tale. If pairing fails, revoke/re-pair and confirm the exact app origin. If package preparation fails, reconnect, keep the stage open, and retry installation; do not download packages from outside the governed app. If offline, the app queues derived result metadata only and will show a conflict instead of overwriting newer story progress. After reconnecting, leave the journal open until synchronization completes or ask the Captain to review the attempt.

Reduced motion uses the existing Phase A behavior. Controls are buttons with keyboard operation and announced progress/status. Report any focus, announcement, contrast, or alternative-input problem before relying on the feature in a live voyage.
