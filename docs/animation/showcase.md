# Animation showcase

`/dev/animations` is a development-only route. The server calls `notFound()` when `NODE_ENV` is production, so no lab UI or sample asset is exposed by a production build.

The showcase provides:

- Library filters for GSAP, Motion, StPageFlip, Rive, and Lottie.
- All 28 registered product scenes plus eight focused library/asset demonstrations.
- Play, pause, resume, restart, skip, supported reverse, progress scrubber, 0.25–2x speed, fullscreen, reset, and motion-mode controls.
- Keyboard controls: Space play/pause, R restart, S skip, Left/Right seek, Escape exit fullscreen.
- A serial trailer that previews the system without calling progression, access, or GM APIs.
- StPageFlip manual/programmatic controls; Rive live input controls/status; Lottie play/pause/segment/speed/direction/destroy; and local asset/fallback/error states.
- Live FPS, long-task, scene, visibility, mounted-runtime, and asset-failure diagnostics.

The showcase uses generic development text and local artwork. It must never make authenticated mutations or contain unreleased story content. Add every new scene and every new runtime asset here before integrating it into a production surface.

The `TEST ANIMATIONS` button is rendered only in development on player and GM surfaces and links to the lab. It is intentionally absent from production bundles at the UI boundary as well as guarded at the route.
