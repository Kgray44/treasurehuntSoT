---
title: Project Homeport Profile Identity Presentation Contract
audience: product-engineering
status: current
canonical_for: project-homeport-profile-identity-presentation-contract
last_reviewed: 2026-08-05
---

# Project Homeport Profile Identity Presentation Contract

## Scope

Canonical Profile identity composition across Personal Harbor, account controls, and authorized public projections.

## Required behavior

- The Personal Harbor Profile Overview leads with a banner/avatar identity hero, display name, handle state, and biography rather than a completion score.
- A missing handle receives a modest direct reminder; a large completion percentage or progress bar is forbidden.
- Saved avatar derivatives propagate through the canonical current-user/public projection to the shell account trigger, open account menu, and Community identity surfaces.
- Initials render only when no authorized avatar exists; broken, pending, quarantined, removed, or private media never leaks.

## Verification

- projection allowlist tests
- Profile Overview component tests
- avatar propagation journeys
- privacy and broken-media fallback

## Truth boundary

This architecture contract does not prove implementation, migration, live inbox delivery, evidence acceptance, Sounding Line authority, publication, owner acceptance, merge, PR, or deployment.
