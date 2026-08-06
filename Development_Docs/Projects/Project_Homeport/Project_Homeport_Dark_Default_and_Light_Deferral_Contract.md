---
title: Project Homeport Dark Default and Light Deferral Contract
audience: product-engineering
status: current
canonical_for: project-homeport-dark-default-light-deferral-contract
last_reviewed: 2026-08-05
---

# Project Homeport Dark Default and Light Deferral Contract

## Scope

Deterministic Dark defaults while preserving explicit preferences and deferring broad Light polish.

## Required behavior

- Anonymous first paint, missing preference, new account, new Profile preference, and Round 3 owner fixture resolve to DARK before interactive paint.
- An explicit stored DARK, LIGHT, or SYSTEM choice remains canonical; existing user intent is not overwritten by the new default.
- Cross-tab reconciliation and hydration remain stable. No wrong-theme flash or dependence on operating-system Light preference is allowed for a missing preference.
- Light Mode remains available as previously implemented, but broad redesign and unrelated Light polish are explicitly deferred from Round 3.

## Verification

- bootstrap/default units
- anonymous/new-account first paint
- stored-choice persistence
- owner-fixture preflight

## Truth boundary

This architecture contract does not prove implementation, migration, live inbox delivery, evidence acceptance, Sounding Line authority, publication, owner acceptance, merge, PR, or deployment.
