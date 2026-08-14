---
title: Project Wakebook Phase 2 Test Plan
audience: product-engineering
status: ready-for-v14-mainline-acceptance
canonical_for: project-wakebook-phase-2-test-plan
last_reviewed: 2026-08-13
---

# Project Wakebook Phase 2 test plan

Incremental verification covers the Wakebook service DTO, owner-only route
authorization, Wayfarer remembrance reference integrity, component detail
states, Tideglass handoff, protected-media association/listing/delivery, and
the dedicated Phase 2 browser scenario. Candidate qualification requires the
registered Wakebook unit/component/browser suites, artifact and achievement
cross-project proof, protected-media authorization, consent revocation, mobile,
keyboard, zoom, reduced-motion, and visual evidence. A final authoritative
Sounding Line decision is prohibited until that frozen candidate is qualified.

On 2026-08-13 the focused Vitest evidence passed 30 tests across eight files,
and TypeScript completed with no errors. The local Prisma diagnosis used Node
`v24.19.0`, Prisma `6.19.3`, and `prisma/schema.sqlite.prisma`: client
generation and schema validation were sound, and the Windows schema engine
launched. The original failure was fresh SQLite-file creation at a task URL of
the form `file:C:/wt/wb2-prisma/browser/<task-owned>.db`. Creating that
task-owned file with Prisma's shipped schema engine before migration restored
the supported local path without using a canonical development database.

The registered `wakebook-phase2` browser project then passed two focused
Chromium journeys on isolated task-owned SQLite data: the visible owner
walkthrough and the private-media/consent/snapshot-safety journey. Their
combined coverage includes desktop, narrow mobile widths, keyboard focus,
effective 200% zoom, reduced motion, no horizontal overflow, and zero serious
or critical axe violations. The synthetic evidence also verifies unavailable
choice truthfulness and unscanned, withdrawn, archived, and revoked media
non-delivery. No real Chronicle, account, or private media was used.

The synthetic corpus will cover a complete solo Voyage, multi-crew/consent
state, partial legacy history, protected media, historical stability, and a
foreign account. No real Chronicle or private media is used.

After Sounding Line v1.4 became effective, the candidate was reconciled with
protected main `268932d630ee0ea1721d0072da4041f7209b7464`. The prior focused
candidate evidence remains bounded legacy evidence, and the affected local
Vitest, TypeScript, Prisma, policy/registry, and dedicated browser evidence
was rebound against the reconciled candidate. The phase now waits only for the
independent v1.4 post-cutover hosted browser-fixture closure before a frozen
candidate may enter Mainline Decision.
