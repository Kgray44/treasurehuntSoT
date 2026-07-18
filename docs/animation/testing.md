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
