# Cinematic transition system

The former timer-based `useCinematicTransition`/`useCeremony` layer has been retired. `AnimationDirector` now owns registered GSAP scenes, semantic labels, a single queue, cancellation, cleanup, play/pause/seek/speed/skip controls, document-visibility behavior, and server-synchronized success/failure branching.

The first arrival uses a longer moonlit harbor composition once per browser session; re-entry uses a compact variant. The physical player invitation and Quartermaster cabin login begin their real authentication requests as soon as the scene begins, idle safely when the response is slow, open only on success, and visibly reject without revealing protected state. The player introduction can be replayed locally and never mutates story state.

Chapter release remains the system's primary narrative ceremony: omen → attention → seal fracture → parchment → heading → story → objective → riddle → map → active state. The real event is already durable before SSE delivery. After presentation or skip, the player acknowledges the event and refreshes the filtered snapshot. Routine section navigation stays fast.

Full motion preserves authored pacing. Gentle motion shortens distances and durations. Reduced motion keeps ordering and readable state with near-immediate fades, no ambient loops, and no page curl. See `docs/animation/` for the full architecture, ownership matrix, 28-scene catalog, asset contracts, testing, performance, and showcase operation.
