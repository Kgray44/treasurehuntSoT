# Animation testing

The animation test strategy separates deterministic orchestration from browser rendering.

## Automated layers

- Unit tests cover motion-mode resolution/scaling, ownership conflicts and release, asset registration, scene completeness, operation/animation synchronization, journal page-model edge cases, and StPageFlip reduced/failure behavior.
- The asset validator parses local Lottie files, verifies all contract/fallback paths, rejects remote animation URLs, and validates the Rive binary envelope.
- Existing acceptance tests exercise first arrival, skip, access failure/success, page opening, live SSE chapter release, semantic ceremony stages, reduced motion, refresh persistence, GM confirmation, and accessibility.
- The production build catches client/server boundary errors and confirms the development showcase is not routable in production.

Run the whole gate with `npm run validate`. Fast focused commands are `npm test`, `npm run assets:validate`, `npm run typecheck`, and `npm run lint`.

## Manual showcase pass

In development, open `/dev/animations` and verify:

1. Every scene plays, pauses, resumes, restarts, skips, seeks, and honors speed.
2. Reversible scenes reverse; unsupported scenes leave state intact.
3. Full, gentle, browser-reduced, and product-reduced modes preserve readable content and focus order.
4. StPageFlip manual, keyboard, and programmatic turns report the correct page/orientation and cleanly reset.
5. Rive reports local load/input state or its honest fallback; Lottie play/pause/stop/speed and forced-error paths work.
6. Fullscreen, narrow portrait, narrow landscape, and 2560px desktop have no clipped controls or horizontal page overflow.
7. FPS, long tasks, mounted runtime counts, visibility, and asset failures return to idle values after reset.

Animation snapshots are evidence, not pixel-perfect contracts. Stable assertions target semantic labels (`data-cinematic-stage`), final state, accessibility, and lifecycle cleanup so minor easing or antialiasing changes do not create false failures.

## Lanternwake Phase 3 Player matrix

Phase 3 adds one persistent Player progression host and an exhaustive policy for 17 event types. Its baseline is exactly 102 cases: each event from each of the six starting sections (`journal`, `chart`, `treasures`, `quests`, `log`, and `finale`) in full mode at 1440×900. Each case proves the correct unique global target, no forced navigation, deterministic queue/source order, optional already-mounted local enhancement, settled or readable fallback state, focus/scroll restoration, acknowledgment order, and cleanup.

At least 185 distinct M1–M5 cases cover all 17 events in their relevant section plus chapter release, pause, resume, and revert from every section. Changing mode in place must not recreate unrelated Rive/Lottie/PageFlip surfaces, replay a one-shot, duplicate a presentation, or weaken readable/focus/acknowledgment semantics. Browser reduced motion cannot be bypassed.

Replay follows the twelve-step Phase 3 protocol: automatic receipt, eligible completion, refresh, authorized bounded-history reconstruction, replay outside Journal, fresh request/scene identities, zero unsafe request, no new progress event, no new viewed row, unchanged business snapshot, focus/section restoration, and cleanup. Reconnect tests keep observed, queued, presented, and acknowledged cursors separate; access revocation terminates delivery and removes protected content.

Journal tests cover first/full, returning/abbreviated, completed/archive, manual-full replay, and reduced opening profiles. PageFlip tests assert ready-or-readable fallback, all five turn lifecycle events, current-boundary generation, queued-turn rebasing, same-page cancellation, current-visible-primary focus/targets, stale clone rejection, and 20-cycle cleanup.

Run the exact ledger checks with:

```powershell
python scripts/validate_phase3_player_event_ledger.py --ledger Development_Docs/Project_Lanternwake_Phase_3_Player_Event_Coverage_Ledger.csv --no-write
python -m unittest scripts.tests.test_validate_phase3_player_event_ledger
```

The release browser gate runs through `npm run validate`, which owns the copied database and servers. Chromium owns mutation cases. WebKit remains read-only for shared-database responsive, accessibility, presentation, and protected-denial coverage. Direct `npm run test:e2e` use must not bypass that isolation boundary.

Required viewports are 2560×1440, 1920×1080, 1440×900, 430×932, 390×844, and 844×390. The semantic visual index has exactly 57 rows: 11 Journal, 14 chapter, six map, seven artifact, five quest, five log, and nine finale. A screenshot is evidence only when its path, SHA-256, run ID, integrated SHA, and review status are recorded.
