---
title: Project Drydock Phase 2 Mainline Safety Contract
audience: engineering
status: active
canonical_for: project-drydock-phase-2-mainline-safety
last_reviewed: 2026-08-10
---

# Project Drydock Phase 2 Mainline Safety Contract

## Additive boundary

Phase 2 is an additive static-analysis slice. It consumes Phase 1 contracts, asset snapshot metadata, and existing Studio validation data. It owns no One Voyage transition, TaleSession/Event write, publication transaction, asset storage record, provider credential, or Shipwright editor architecture.

## Fail-closed rules

- A full static run without asset metadata reports incomplete proof.
- A report is bound to the exact canonical source checksum and rule catalog version.
- A durable report receipt stores only checksum, rule/proof metadata, safe issue data, and report digest; it never stores the authored source snapshot.
- A waiver cannot delete an issue, survive unrelated source/rule change, waive a current error rule, or bypass a revoked/expired authorization.
- Durable waiver creation is Administrator-only, resolves the issue from an owner-scoped immutable validation receipt, and records the receipt source revision rather than trusting client-supplied rule data.
- A repair preview cannot apply after source changes and always yields a checksum-bound inverse.
- Publication revalidates an exact source, requires a complete error-free Drydock receipt, and then retains existing draft autosave-version checks as the freshness guard.

## Rollback

The Phase 2 modules and narrow Studio validation integration can be reverted without data restoration. Existing validation remains available; the latest JSON summary may retain an inert historical receipt. The additive `DrydockValidationRun` and `DrydockRuleWaiver` SQLite/MySQL migrations have no backfill and are intentionally not destructively reversed: an emergency application rollback may leave their tables inert until a separately governed retention migration. No provider setup or live-state correction is introduced by the current slice.

## Permanent-stop status

**NO, not yet.** The current slice is coherent and additive but Phase 2 is not complete until its remaining static domains, governed tests, documentation, reconciliation, and protected mainline acceptance are delivered. Phase 3 remains a separate future task.
