---
title: Project Homeport Route Crossfade Transition Contract
audience: product-engineering
status: current
canonical_for: project-homeport-route-crossfade-transition-contract
last_reviewed: 2026-08-05
---

# Project Homeport Route Crossfade Transition Contract

## Scope

Direct page-to-page crossfade inside a stable ProductShell.

## Required behavior

- One platform RouteMotionBoundary overlaps outgoing and incoming page layers; the incoming layer becomes visible before the outgoing layer reaches zero opacity.
- No frame may show only the shell background during an ordinary transition. ProductShell, global navigation, account controls, and footer remain stable.
- Request loading is independent and appears only after the existing 500 ms delay; fast routes show no loading and slow routes do not introduce a blank intermediary.
- Focus, scroll, pointer ownership, cleanup, abort/replacement, back/forward, and reduced motion are deterministic and accessible.

## Verification

- frame-sequence opacity/coverage proof
- fast/499/500/501 ms integration
- focus/scroll/back-forward tests
- cross-product desktop/mobile/reduced-motion journeys

## Truth boundary

This architecture contract does not prove implementation, migration, live inbox delivery, evidence acceptance, Sounding Line authority, publication, owner acceptance, merge, PR, or deployment.
