# Player guide: Vision scans

> Vision `0.8.0-b6` is experimental and not approved for public distribution.

## Setup

Launch the authorized Companion or pair the browser through the explicit local pairing flow. Select the Sea of Thieves application window—not the whole desktop. The Companion does not inject, read game memory, edit files, or automate input.

When a story asks, hold **Inspect Surroundings**. **Vision Active** means the selected window is being sampled for this attempt. Release the control to finish. Pause or Stop is always available; an incomplete scan cannot verify a waypoint.

## Data and privacy

Player frames stay local and transient by default. The bounded ring and selected evidence are cleared after inference. Ordinary diagnostics retain metadata such as result, failed gates, package/engine versions, timing, and hashes—not footage. A separate unmistakable consent is required for any retained diagnostic case.

## Guidance

- `INSUFFICIENT_VISUAL_EVIDENCE`: the system cannot decide; improve lighting, framing, stability, or target visibility and retry.
- `AMBIGUOUS`: the scene resembles a known wrong place; change angle or position and follow the story hint.
- `NOT_AT_TARGET`: evidence supports that this is the wrong governed scene; verify the story step.
- `SYSTEM_ERROR`: no location judgment was made; check Companion health and ask the Captain.
- Offline content missing: reconnect so the pinned package can be obtained. Existing cached content may continue under the governed offline rules.

Never treat “insufficient” as “wrong.” If repeated guidance cannot recover, stop scanning and use the Captain path.
