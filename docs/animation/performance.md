# Animation performance

The animation budget prioritizes input response and readable state over decoration.

- Keep the main thread responsive at 60 Hz where possible; no single authored animation callback should perform layout-heavy work per frame.
- Development metrics flag `PerformanceObserver` long tasks and show rolling FPS, active scene, mounted GSAP/PageFlip/Rive/Lottie counts, visibility, and asset failures.
- GSAP targets are cached by scene construction, SVG paths are local, and SplitText is reverted after each scene.
- Motion animates `transform` and `opacity` on dedicated wrappers. Layout animation is reserved for small component transitions.
- Lottie and Rive are dynamic client imports. Rive uses the offscreen renderer, disables unneeded listeners, and forbids runtime CDN fallback. Noncritical assets mount at idle/intent.
- Hidden-document playback pauses. Reduced motion disables ambient loops and page curl. Unmounted runtimes are destroyed and timeline contexts are reverted.
- StPageFlip clones only the current React page model, uses one instance per visible book, updates in place, and destroys the instance before its host is cleared.
- Decorative textures and particles have ceilings in `motionPolicy`; the product can switch to gentle or reduced mode without changing content.

The showcase trailer runs scenes serially and is intended as a stress audit. Watch for counts that do not return to zero, rising asset failures, repeated long tasks, and FPS that stays below 45 on the target hardware. Investigate a regression before adding more visual layers.

## Latest development observation

The 2026-07-17 in-app browser review held at a 60 FPS estimate while idle and during the sampled trailer start/skip flow. The initial development compilation and asset load registered between zero and one long task depending on cache state; the counter did not continue rising while idle. The full-mode steady state reported one Rive instance, two Lottie instances, one StPageFlip instance, zero GSAP timelines while idle, and no asset failures. Manual destroy/reset returned the Lottie count from two to one and then restored it to two without a console error. At 390, 1440, and 2560 CSS pixels, document scroll width equaled client width.

These are development diagnostics on one workstation, not a portable performance benchmark. The production showcase is intentionally unavailable, so release profiling should exercise the real landing, access, player, and quartermaster surfaces under representative device throttling.

Production review should include browser performance traces on the actual low-end mobile target, real final Rive binaries, throttled 4G/local-cache behavior, and memory snapshots after repeated section navigation. The current development metrics are diagnostics, not production telemetry.
