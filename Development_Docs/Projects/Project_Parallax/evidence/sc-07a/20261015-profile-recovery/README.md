---
title: SC-07A public Profile prerequisite recovery evidence
audience: product-engineering
status: local-browser-pass-pending-protected-qualification
canonical_for: sc-07a-profile-prerequisite-recovery-evidence-20261015
last_reviewed: 2026-10-15
---

# SC-07A public Profile prerequisite recovery

The [eight-case production Chromium suite](../../../../../../tests/e2e/parallax-spatial-community.spec.ts) passed 8/8 on exact code and test source `d74ee3d759c9870dffbd04c777444a69b986658e`. Sounding Line's generic isolated browser profile used fresh task-owned SQLite, a production Next build, synthetic Creators, and one Chromium worker. Its [final log](eight-case-final-browser.log.txt), [suite receipt](browser-suite-profile.json), [runtime receipt](browser-runtime.json), and [Playwright result](playwright-last-run.json) retain the result. Browser, proxy, server-tree, and port cleanup all reported `PASS`.

Copied terminal logs have trailing whitespace removed for the repository diff; their diagnostic lines and results are otherwise preserved.

The added case starts with a saved private asset and a Creator whose Profile is not ready for public Community publishing. The wizard blocks its first Continue action and offers **Set up public Profile** without creating a listing. The link opens the existing Profile editor; saving a valid handle and public default visibility returns to the same saved Studio definition. Reopening the wizard enables Continue, while the saved source remains private and no listing exists. [Desktop](profile-required-desktop.png), [narrow mobile](profile-required-mobile.png), and [ready return](profile-ready-return.png) captures show the actual authenticated UI. The mobile case asserts the setup action sits above the sticky footer; the case also checks for severe and critical accessibility findings. The other seven cases continue to cover the publication, moderation, installation, update, refusal, retry, and natural Creator entry paths.

The [focused before-layout run](profile-recovery-focused-before-layout.log.txt) and [eight-case before-layout run](eight-case-before-layout.log.txt) passed on their own earlier source heads. Inspection of their mobile capture exposed the below-fold setup action, so those passes do not substitute for the final-source result. The [final focused run](profile-recovery-visible-focused.log.txt) passed after the layout change and directly checks mobile placement.

An [initial infrastructure attempt](infrastructure-startup-failed.log.txt) stopped before the browser because Windows `Add-Type` could not write to nearly full C: temporary storage. The same candidate passed when task-owned temporary files were directed to D:. The failed attempt is retained and is not counted as product evidence.

The [formal experience planner attempt](experience-plan-blocked.log.txt), using protected base `9983c900875ffa116e7945318823e93e6e94348b` and candidate `d74ee3d759c9870dffbd04c777444a69b986658e`, stopped at `PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity:Crossdeck and Parallax experience integration`. This separately owned protected-base intent still prevents formal capture/replay and Sounding Line qualification. Local synthetic browser proof does not establish owner acceptance, physical-device behavior, or real-room safety.
