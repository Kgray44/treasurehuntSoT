---
title: Project Homeport Workspace Entry and Resource Authority Contract
audience: product-engineering
status: current
canonical_for: project-homeport-workspace-entry-resource-authority-contract
last_reviewed: 2026-08-05
---

# Project Homeport Workspace Entry and Resource Authority Contract

## Scope

Ordinary workspace entry, empty states, resource-specific authorization, reconciliation, and Chronicle transition safety.

## Required behavior

- Active claimed verified ordinary accounts can enter Player, Captain, and Creator through one AccountSession without self-activating a second identity.
- Entry is not ownership or edit authority: Captain/Creator operations still require their canonical Voyage, Chronicle, draft, publication, or organization grants; no Moderator/Admin or unrelated resource grant is synthesized.
- Captain renders a useful empty library when no authorized Voyages exist. Creator renders a useful empty library with its authorized create action.
- New-account activation provisions entry atomically. Existing-account dry-run/commit reconciliation is auditable, repeat-safe, and skips restricted, unclaimed, or unverified accounts.
- The active-Chronicle lock derives only from authoritative active non-preview Player membership, exposes return/leave recovery, blocks transition only when true, and never substitutes for missing capability.

## Verification

- entry versus resource IDOR matrix
- new-account provisioning
- reconciliation dry-run/commit/repeat
- empty workspace journeys
- true/false lock variants

## Truth boundary

This architecture contract does not prove implementation, migration, live inbox delivery, evidence acceptance, Sounding Line authority, publication, owner acceptance, merge, PR, or deployment.
