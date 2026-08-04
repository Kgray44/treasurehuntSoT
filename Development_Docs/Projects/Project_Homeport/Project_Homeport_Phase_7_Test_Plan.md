---
title: Project Homeport Phase 7 Test Plan
audience: quality-engineering
status: current
canonical_for: project-homeport-phase-7-test-plan
last_reviewed: 2026-08-04
---

# Project Homeport Phase 7 test plan

## Purpose and authority

This plan proves the whole-product voyage against the frozen Phase 7 architecture. Sounding Line is the only automated
release-decision authority. Focused Node, Playwright, build, documentation, privacy, and schema outputs are diagnostic
until admitted to finalized subsystem and mainline receipts.

## Isolation and resources

- Use only the retained Homeport worktree and branch.
- Hash the canonical `C:\Users\kkids\Documents\Codex_TreasureHunt\prisma\dev.db` before and after; never open it for a
  Phase 7 write.
- Prepare immutable seed `homeport-phase7-integrated-v1`, then recreate one task-owned clone for each journey and one
  separate final owner-walkthrough clone.
- Keep credentials and token handoffs outside Git under the task root. Commit only reserved synthetic names, reserved
  email domains, fictional content, safe screenshots, and bounded metadata.
- Reserve ports 3717 through 3720; leave only the final owned walkthrough runtime on 3717 after closure.

## Journey matrix

The authoritative registry covers A account creation, B returning account, C Player, D Captain, E Creator, F Community
discovery, G Profile, H Chronicle Passport, I password recovery, J session expiry, K permission, L mobile, M sign-out
and multi-tab invalidation, N dependency failure/recovery, and O final whole-voyage rehearsal. Every journey begins at
`/`, uses visible controls, records route and mutation milestones, asserts account state, and recreates its clone.

## Closure gates

Closure requires immutable fixture and clone checks, A-O production-runtime journeys, checksum/source/fixture-bound
evidence, human visual review, failure/recovery states, keyboard/focus and mobile/reduced-motion proof, walkthrough
prepare/start/status/reset/stop safety, exact control-plane dispositions, `FT-B007`, docs and catalog validation,
privacy scans, SQLite and MySQL schema validation, production build, canonical database invariance, clean exact branch
parity, and Sounding Line subsystem and mainline `RELEASE_GO`.

The final runtime must be rebuilt from the final publication commit, healthy on `http://127.0.0.1:3717/`, and left
running for the owner. Automation may report readiness but must keep the owner decision pending.
