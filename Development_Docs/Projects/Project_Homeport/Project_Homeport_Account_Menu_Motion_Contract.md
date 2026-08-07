---
title: Project Homeport Account Menu Motion Contract
audience: product-engineering
status: current
canonical_for: project-homeport-account-menu-motion-contract
last_reviewed: 2026-08-05
---

# Project Homeport Account Menu Motion Contract

## Scope

Perceptible production account disclosure motion owned by ProductShell and platform motion tokens.

## Required behavior

- Opening and closing both use perceptible opacity, translation, scale, and material/depth change without moving the trigger or surrounding shell geometry.
- The real disclosure DOM is measured; frame evidence includes closed/opening/open/closing/closed computed style and geometry rather than an isolated simulator.
- Escape, outside pointer, navigation, focus trap/return, interruption, repeated toggles, and unmount clean up safely.
- Reduced motion removes spatial travel and long fades while retaining immediate state and focus equivalence.

## Verification

- production component tests
- opening/closing frame sequence
- focus/keyboard/pointer interaction
- reduced-motion proof

## Truth boundary

This architecture contract does not prove implementation, migration, live inbox delivery, evidence acceptance, Sounding Line authority, publication, owner acceptance, merge, PR, or deployment.
