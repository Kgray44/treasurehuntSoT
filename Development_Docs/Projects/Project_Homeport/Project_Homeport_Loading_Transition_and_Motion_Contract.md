---
title: Project Homeport Loading Transition and Motion Contract
audience: product-engineering
status: current
canonical_for: project-homeport-loading-transition-motion-contract
last_reviewed: 2026-08-04
---

# Loading, transition, and motion contract

One shared delayed-loading primitive starts internal busy state immediately but shows a visual loading surface only when
work remains unresolved at 500 ms. Success at 100 or 499 ms produces no flash; 500/501 ms produces the correct surface;
completion, error, unmount, interruption, and route change cancel timers and stale layers. Authoritative errors may appear
immediately and invalidated private content never remains visible.

One shared route-transition lifecycle coordinates outgoing/incoming restrained motion, operability, focus, scroll,
Back/Forward, interruption, account-menu navigation, workspaces, Community, Personal Harbor, and immersive exits. Reduced
motion is immediate or near-immediate. The account menu uses the platform/Lanternwake motion authority for a 140-200 ms
opacity/translate/scale transition with Escape, outside-click, focus restoration, touch, and route cleanup.

Home ambient motion uses governed lifecycle-managed lantern swing, occasional staggered star twinkle, and slow fog drift.
It pauses when hidden and becomes static under reduced motion. Player/Captain/Creator role icons render at their final CSS
position before hydration; hover/focus decoration begins only from that correct layout.
