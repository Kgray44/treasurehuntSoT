---
title: Domain ownership
audience: developer
status: current
canonical_for: domain-ownership
last_reviewed: 2026-07-27
---

# Domain ownership

`src/chronicle` owns authored story contracts, publishing, progression, blocks, assets, and journal models. `src/platform` owns roles, invitations, libraries, policy, and audit surfaces. `src/wayfarer` owns profile and provider-facing identity concerns. `src/community` owns package, artifact, storage, authorization, and exchange foundations. `src/private-content` owns protected package delivery and operational controls. `src/animation` and related presentation components own visual runtime integration.

Route handlers compose these domains but must preserve ownership and authorization boundaries. Compatibility modules are explicitly transitional and should not become new canonical dependencies.
