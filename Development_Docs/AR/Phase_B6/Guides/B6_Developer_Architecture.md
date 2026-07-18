# Developer architecture guide

## Layers and boundaries

- Next.js App Router supplies one shared web/PWA/Electron renderer.
- Platform adapters select browser Companion or restricted desktop capabilities without duplicating Studio/Player/Captain logic.
- Electron main/preload own process lifecycle and a fixed IPC bridge; Companion capture runs in an isolated sandboxed worker.
- SQLite is the local development/runtime schema; MySQL has ordered production SQL equivalents.
- Runtime coordination checks signed stage context immediately before idempotent story advancement.

## Vision pipeline

Studio authoring produces versioned assets, regions, negatives, calibration and locked partitions. The B-4 CPU engine curates frames, retrieves target/negative candidates, performs local matching/geometry/pose/coverage/temporal/checkpoint/ambiguity gates, and writes an immutable bounded package. Player capture produces transient evidence; the coordinator returns distinct results and structured guidance. Captain recovery and offline reconciliation share the same authoritative progression rules.

## Packages and release data

Runtime packages allow only known names, JSON media, 32 artifacts, 8 MiB per artifact, and 32 MiB total; hashes, sizes, schema/engine/model/version, package digest, and optional Ed25519 trust scope are verified. Release metadata is separately canonical-signed. See ADRs 0018 and 0019.

## Extending safely

To add a model adapter, implement provider detection and a genuinely active execution path, preserve gate output, add fallback disclosure, version the model bundle, extend compatibility policy, and run current/previous comparisons. Detection alone is not support.

To add a waypoint type, extend the shared domain schemas, authoring rules, package gate contract, guidance, compatibility data, migrations, synthetic tests, real locked corpus, UI/onboarding, and certification policy. Do not weaken mandatory gates or invent automatic eligibility.

## Test surfaces

Vitest covers typed/domain/UI rules; Node tests cover desktop/Companion/native/security/update/package behavior; Playwright covers Chromium mutation flows and WebKit read-only/accessibility/responsive behavior; replay and soak scripts cover production engine fixtures; PowerShell builds and verifies release artifacts. Shared-database mutations intentionally run once in Chromium.
