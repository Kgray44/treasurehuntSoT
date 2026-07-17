# Known limitations

- The repository is public. Final story, riddles, personal material, surprise content, production credentials, and private media remain intentionally blocked.
- Invitation seal, journal clasp, voyage compass, and finale mechanism have typed Rive contracts but no final designer-authored `.riv` binaries. Production renders honest original SVG/CSS fallbacks. The sole working `.riv` file is an MIT-licensed development-only runtime sample.
- Current Lottie effects are original shape-layer ambience/punctuation, not final designer-exported Bodymovin artwork.
- Finale unlock/assembly remains structural and cannot enter unsupported `READY` or later states through current controls.
- SSE fan-out is process-local. Database replay is durable, but multi-instance production needs Redis or equivalent pub/sub.
- Interactive route rate limits are process-local. Multi-instance production needs a shared limiter such as Redis in addition to the existing authorization and idempotency controls.
- Initial Ship's Log projection is capped at 250 entries; cursor pagination is future scale work.
- The parallel MySQL migration still needs exercise against a real MySQL 8 integration environment.
- Development FPS/long-task metrics are observational and local, not production telemetry. Final Rive binaries require another mobile GPU/memory profile.
- The complete mutation workflow runs once in Chromium to avoid shared-database contention; privacy, access gates, landing behavior, accessibility, responsive layouts, and mobile behavior also run in WebKit.
- Windows LAN access is opt-in and can still be blocked by firewall or corporate network policy.
- Final licensed audio, production monitoring, CI, deployment, and private content authoring remain later work.
- Tall Tale asset binaries use one local filesystem root in Phase 1. Object storage, antivirus scanning, resumable large uploads, and asynchronous media processing remain production hardening work.
- The future vision provider is deliberately inactive. Phase 1 supplies reference collections, a scoped helper pairing token, a versioned verification contract, strict progression rejection rules, and a development simulator; it does not capture camera frames or claim recognition accuracy.
