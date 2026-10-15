---
title: Browser tracking corner recovery and local diagnostics evidence
audience: product-engineering
status: partial-qualification
canonical_for: parallax-browser-tracking-recovery-20261015
last_reviewed: 2026-10-15
---

# Browser tracking recovery

The owner held the iPhone upright and steady, observed frequent tracking resets,
and saw no error or completed calibration after the second corner set. That
physical session remains failed with an unknown cause. This bounded correction
preserves valid second-view taps when one correspondence is rejected, and adds
an explicitly copied, capped local event history without camera, map, pose, room
or account data. Existing session, freshness, parallax and room-fit admission
remain authoritative. Neither local prototype currently supplies admitted planes.

## Retained attempts

- `attempt1-6cf0e7dc631a`: production build and TypeScript passed. Both browser
  cases failed before UI execution because the synthetic test fixture omitted
  required Studio metadata. Original logs, traces and cleanup PASS are retained;
  this is no recovery-screen evidence. The fixture now uses `emptyStudioContent`.
- `attempt2-eac5d65250f5`: exact source
  `eac5d65250f5aa1ae1064faa28657991982bdc62`; production build/TypeScript and both
  desktop/390px-phone browser journeys passed. Browser execution took 22,440 ms,
  including owned runtime orchestration; Playwright reported 12.2 seconds.
  Four screenshots and two complete recordings show natural Chronicle journal
  entry, Lens opening, an injected tracker-script failure, visible recovery,
  expanded local event details and explicit Guided return. Both pages recorded
  no uncaught page errors or document-width overflow. Cleanup PASS confirms
  the owned runtime stopped and ports were released.

Inspection of attempt 2 found a contradictory status label: after startup fails,
the error says tracking stopped while the sample-less status line defaults to
INITIALIZING. A bounded correction changes that label to STOPPED and adds a
browser assertion. Its fresh recapture/review is required before this increment's
presentation can be accepted. Original attempt 2 is unchanged.

Independent media review also found pale Guided title/clue text on light parchment
(P2). Global heading and paragraph rules read theme tokens directly, overriding
the card's inherited dark `color`. The bounded repair scopes heading/body tokens
to the card, strengthens its small category-label contrast and adds computed
contrast checks against both gradient endpoints. Fresh browser proof also needs
to execute Retry and read back the explicitly copied diagnostic summary; attempt
2 established enabled controls, not those operations.

`focused-tests.original.log` retains 31 passing checks across five files on the
first correction, including invalid second-view retry, bounded diagnostic export,
clipboard failure and prior freshness/map/background/Guided races. Independent
source review found no blocker in that bounded source, while explicitly declining
physical or rendered acceptance. Its source identity was the dirty delta on
`7622709427c503639f0086aa02e7b24902615f4c`, later committed in `6cf0e7dc6`.
The intermediate 32-check run failed one assertion because both the outer notice
and camera hint repeated completion after the displayed pose aged under load.
Its original log is retained. Updating the displayed pose from the same admitted
post-open snapshot and showing paused feedback for stale tracking resolves that
case without broadening the assertion. All 33 focused checks subsequently pass.

## Evidence limits

The browser uses Chromium's synthetic camera and deliberately fails the tracking
script at its network boundary. It does not load or qualify a SLAM engine, solve
physical alignment, exercise Safari sensors, verify anchoring/drift, or establish
the cause of the owner's failed session. Corner correspondence recovery has unit
coverage; no physical corner or tabletop detection is implied by the UI captures.
No OpenAI call was made. Existing Crossdeck, protected integration, tracker
licensing/provenance and real-device gates remain open. This temporary validation
runtime is stopped; these receipts are not an active owner test endpoint.
