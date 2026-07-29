# Browser and Compatibility Strategy

Current Playwright configuration has Chromium/Desktop Chrome, a phase-3 read-only setup project, dedicated Wayfarer and Harborlight projects, and WebKit/iPhone 14. It runs a single worker with `fullyParallel: false`, default port 3100, retained failure traces/video/screenshots, and some serial/mutation-specific suites. Sounding Line preserves project-specific fixtures but makes their dependencies and mutable resources visible.

Future browser families are `browser/auth`, `browser/invitations`, `browser/player-journal`, `browser/player-library`, `browser/passport`, `browser/artifacts`, `browser/captain`, `browser/studio`, `browser/community`, `browser/private-operations`, `browser/accessibility`, `browser/responsive`, and `browser/cross-project`.

Each suite declares server-starting versus server-reusing, read-only versus DB-mutating, required browser/device, storage root, fixture, port, DB clone, trace root, and setup dependencies. Chromium, WebKit, and Firefox run where supported; desktop, mobile, tablet, high zoom, reduced motion, keyboard, touch, offline/reconnect, and cached/uncached conditions are selected by contract risk. Accessibility is a distinct evidence lane even when it shares a browser.

Shared setup is a dependency node: if it fails, dependents are `cascade-blocked`, not independent failures. Production-build smoke and restart proof use a separate build/host lease. No mutable journey is sharded until it receives a fresh DB and writable roots; read-only compatibility shards may share only a declared immutable snapshot.
