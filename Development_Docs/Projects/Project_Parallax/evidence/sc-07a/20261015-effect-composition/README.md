---
title: SC-07A saved Effect and Composition publishing evidence
audience: product-engineering
status: local-browser-pass-pending-protected-qualification
canonical_for: sc-07a-effect-composition-publishing-evidence-20261015
last_reviewed: 2026-10-15
---

# Saved Effects and Compositions in Community Harbor

The first focused production Chromium attempt on exact test source `f29fee51fa6d5adc86a3fccf54e5a8c256544697` failed when a saved procedural Effect did not appear in the paged **Effects** Library tab; the second Composition case did not run. The [failed attempt](first-attempt-failed.log.txt) is retained as a failed result. The owner-scoped paged catalog classified every non-asset, non-composition source as a Scene, although the earlier non-paged catalog and Harborlight package projection recognized `EFFECT`.

Candidate `355325b6ad485694b301d58471dbec126d82fa1c` restores saved Effect classification in the owner-scoped page and global compact projection. Its focused [Effect and Composition browser run](focused-pass.log.txt) passed **2/2**. The same exact code and test source then passed the complete [eleven-case SC-07A production Chromium suite](eleven-case-browser.log.txt) **11/11** using Sounding Line's generic profile, a fresh isolated SQLite database, synthetic identities and a production Next.js build. The [suite receipt](browser-suite-profile.json), [runtime and cleanup receipt](browser-runtime.json), and [Playwright result](playwright-last-run.json) record `PASS`; the owned browser, server tree, proxy and ports were cleaned up.

Both new journeys start from owned private saved content in the actual Spatial Library, open its contextual publishing dialog, submit through the authoritative Harborlight package and moderation path, open the approved listing, and install into a second Creator's Library. The [installed Effect](effect-installed-desktop.png) appears in **Effects** and the [installed Composition](composition-installed-desktop.png) appears in **Compositions** as read-only Community content. Each installed detail refuses a new Publish action. The server package assertions verify `EFFECT` and the dependency-closed `composition: true` marker. Focused catalog tests passed **17/17**, with TypeScript and targeted lint passing on the correction source.

This is local synthetic browser and service evidence. Formal Product Experience capture, independent review, protected Sounding Line qualification, real-device behavior and owner acceptance remain open. The separately owned Crossdeck Phase 2 continuity intent still blocks the formal planner on protected main.
