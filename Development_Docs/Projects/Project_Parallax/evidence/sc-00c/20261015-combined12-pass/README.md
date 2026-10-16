---
title: SC-00C repaired combined browser suite pass
audience: product-engineering
status: local-combined-browser-pass-pending-sc07a
canonical_for: sc-00c-repaired-combined-browser-suite-20261015
last_reviewed: 2026-10-15
---

# Repaired combined browser suite pass

The [production Chromium log](browser.log.txt) records **12/12 passing** cases on the owned SC-00C candidate at `703e5a636`. The earlier [attempt 3 failure](../../sc01/root-integration-20261015/studio-browser-attempt3/packet.json) remains preserved at `a885b6c3`; this run was made after the query-bound Source-filter correction. A fresh task-owned SQLite database at `artifacts/sc00c/integration/combined12.db` held synthetic Creator data, and the Playwright server used private port 3196. No shared runtime database or private user content was used.

The command selected four tracked specs with one Chromium worker:

```text
npx playwright test tests/e2e/parallax-sc00b-combined.spec.ts tests/e2e/parallax-sc02-integration.spec.ts tests/e2e/parallax-scene-manager.spec.ts tests/e2e/parallax-sc00c-drop-placement.spec.ts --project=chromium --workers=1 --reporter=list
```

The run covered SC-00B Inspector and keyboard rail contexts, physical Library drag and invalid placement, saved composition selection/reuse/playback, SC-01 multiple Scenes per Environment, distinct legacy working/release flows, reconstructed Environment reuse, and autosave failure recovery. [Scene and Library screenshots](scene-captures/combined-composition-playing.png), including [Scene Manager on a phone](scene-captures/sc01-integrated-manager-phone.png), are retained with the full `scene-captures` directory. [Inspector screenshots](inspector-captures/scene-guided.png) and observations are retained with the full `inspector-captures` directory.

The [production build](build.log.txt) passed at `e8abcfdad`. The subsequent merge of protected main `48296fbf2` changed only `scripts/sounding-line/experience-browser.mjs`; the browser candidate `703e5a636` added evidence documents after that merge. Product source was unchanged between the build and this browser run, but this is **not** final source qualification. SC-07A publication/installation, its Library integration, the full combined rerun after that integration, protected admission, physical device behavior, and owner acceptance remain open.
