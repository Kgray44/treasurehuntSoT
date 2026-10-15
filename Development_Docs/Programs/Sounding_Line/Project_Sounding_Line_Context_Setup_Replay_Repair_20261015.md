---
title: Experience context setup replay repair
audience: engineering-owner
status: implemented-awaiting-protected-qualification
canonical_for: experience-context-setup-replay-repair-20261015
last_reviewed: 2026-10-15
---

# Defect and resulting behavior

Protected preparation [run 38760343298](https://github.com/Kgray44/treasurehuntSoT/actions/runs/38760343298) failed after 25 of 32 context results. The desktop Player reduced-motion context of homeport.shell.crossdeck-companion waited 30 seconds for its Journal witness. Its preceding normal-motion context completed the declared setup. The failed cache hit copied only sign-in cookies, skipped all declared setup, and opened a new tab with no registered device. Preserved media shows the authenticated “Reconnect this device” gate. The coarse PRODUCT_FAILURE browser-exit classification does not establish a product-code defect.

The [failure authority record](evidence/context-setup-replay-20261015/failure-classification.json) binds the exact base, consumer, helper blob, failed reservation, diagnostic artifacts and installed gate rejection. Cleanup reported browser/server trees reaped and ports released; always-upload diagnostics succeeded. Those are separate from capture acceptance. The consumed preparation remains failed, reviews completed remain two, and no capture/review/qualification seal exists.

The helper now caches only a recognized canonical sign-in prefix with one safe same-origin return destination. On a miss it performs every declared setup step, waits for canonical sign-in navigation, and publishes cookies only after the complete setup witness succeeds and the actual authentication destination matches. On a hit it opens that setup destination, replays every remaining declared action or wait using original diagnostic indexes, checks the witness, and then enters the journey. Each context retains its own device registration and purpose choice. Unknown prefixes and unsupported return destinations execute complete setup without a cached shortcut. No tab storage or device identity is copied.

# Proof and boundaries

The focused real-browser fixture uses synthetic accounts and task-owned resources. Four fresh desktop/mobile normal/reduced contexts must perform one sign-in and four distinct UI device registrations and purpose selections. A separate account using an unsupported login prefix must perform complete setup in two contexts. A third account using canonical sign-in must receive its own login, proving cache-key isolation, and an anonymous context must receive no authentication cookie. Delayed client-side authentication navigation exercises the explicit navigation wait. Separately delayed setup readiness rejects premature registration, preserving the declared post-authentication wait. Rendered screenshots, recordings, traces, observed journeys and setup counts are supporting helper proof, not Crossdeck product acceptance. The fixture binds its source digest to the actual helper and fixture bytes.

Focused negative checks cover unsupported prefixes, absent or duplicate destinations, external/protocol-relative paths, dangerous encoding, control characters and sign-in loops. Existing Sounding Line, lifecycle, viewport, authentication, provenance and finite-campaign checks remain required. Independent exact-source review and existing protected-main qualification must precede installation. This is a correction to existing internal tooling; no Feature Catalog capability changes are required.

The [local validation manifest](evidence/context-setup-replay-20261015/local-validation.json) binds the final helper and test bytes, eight-context fixture digest, observations and all 32 artifact hashes. The complete rendered suite passed 12 tests; the final strengthened eight-context fixture also passed. Sounding Line regressions passed 164 tests. A temporary-copy mutation removing only the explicit authentication navigation wait failed the login-count assertion as expected, demonstrating that the new regression detects that missing wait. The committed browser proof retains its original relative paths and exact artifact bytes. Desktop normal and mobile reduced-motion screenshots were inspected and show the ready Journal after actual setup.

This task changes no frozen product, experience contract, finite registry, permissions or branch protection. It does not grant another #721 preparation, reuse the failed slot, complete review three or reset history. Section 24.2 of the [Global Product Governance Standard](../../Governance/Voyagewright_Global_Product_Governance_Standard.md) requires the separately reviewable owner-decision proposal after helper landing. That proposal must bind the new accepted base and full source digest, preserve the original eleven repair/recapture attempts plus this failed verification preparation, and keep the old reservation and artifacts immutable.
