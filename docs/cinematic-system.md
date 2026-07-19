# Cinematic transition system

## Lanternwake Phase 3 progression presentation

The compatibility companion routes the exact 17 progression-event types through one persistent Player host rather than section-local conditional ceremony roots. Changing sections never creates another global host and presentation never forces navigation to obtain a target. Each event policy declares its scene, priority, relevant section, global readable outcome, optional local target, replay/acknowledgment/focus/skip/notification/audio behavior, full/gentle/reduced meaning, payload projector, fallback, and settled-state handoff.

Authoritative live/reconnect work always precedes replay. Replay is reconstructed from bounded authorized Player-safe history, receives a fresh Director identity, and cannot write, acknowledge, or advance presence. A section-local enhancement can begin only after the global commit when the relevant section is already mounted and its exact target is ready; its absence or failure cannot make the event invisible.

Presentation completion is receipt-gated. A successful visual timeline alone is insufficient: the final-state runtime must leave a readable outcome or verified fallback, restore focus/section state, and preserve cleanup truth before the wrapper can authorize a viewed acknowledgment.

The former timer-based `useCinematicTransition`/`useCeremony` layer has been retired. `AnimationDirector` now owns registered GSAP scenes, semantic labels, a single queue, cancellation, cleanup, play/pause/seek/speed/skip controls, document-visibility behavior, and server-synchronized success/failure branching.

The first arrival uses a longer moonlit harbor composition once per browser session; re-entry uses a compact variant. The physical player invitation and Quartermaster cabin login begin their real authentication requests as soon as the scene begins, idle safely when the response is slow, open only on success, and visibly reject without revealing protected state. The player introduction can be replayed locally and never mutates story state.

Chapter release remains the system's primary narrative ceremony: omen → attention → seal fracture → parchment → heading → story → objective → riddle → map → active state. The real event is already durable before SSE delivery. After presentation or skip, the player acknowledges the event and refreshes the filtered snapshot. Routine section navigation stays fast.

Full motion preserves authored pacing. Gentle motion shortens distances and durations. Reduced motion keeps ordering and readable state with near-immediate fades, no ambient loops, and no page curl. See `docs/animation/` for the full architecture, ownership matrix, 28-scene catalog, asset contracts, testing, performance, and showcase operation.
