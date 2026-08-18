---
title: Project Wakebook Phase 2 Test Plan
audience: product-engineering
status: candidate-qualification-in-progress
canonical_for: project-wakebook-phase-2-test-plan
last_reviewed: 2026-08-18
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

On 2026-08-18 focused Vitest evidence passed 30 tests across eight files, and
TypeScript completed with no errors. The local diagnosis used Node `v24.19.0`,
Prisma `6.19.3`, and `prisma/schema.sqlite.prisma`: client generation, schema
validation with a task-owned URL, and the Windows schema-engine launch passed.
Fresh `migrate deploy` then failed identically on short C: and Y: task paths
with a blank schema-engine error; it was not repaired by changing paths or
redirecting temporary output, and canonical data was never used.

The registered project is `wakebook-phase2`, owned by suite
`browser.wakebook`. The visible Chromium journey passed 1/1 after applying all
59 migrations to a fresh Y: task-owned fixture. The private-media,
consent-revocation, and historical-snapshot safety journey is not claimed
locally: its first run reached cleanup but failed writing a trace to full C:,
and the redirected retry timed out under C: pressure. The current focused
hosted workflow cannot run a branch under v1.4 protected-main policy, so the
frozen protected authority/train run is the remaining browser qualification.

The synthetic corpus will cover a complete solo Voyage, multi-crew/consent
state, partial legacy history, protected media, historical stability, and a
foreign account. No real Chronicle or private media is used.

After the latest reconciliation with protected main
`fc39942a1d8fe57fc13f35cae01445e704b94c45`, policy/registry generation passes
with 2,386 cases, 57 families, 63 suites, and zero policy errors. The preserved
legacy evidence remains bounded; it is not a substitute for the remaining
source-bound hosted browser safety proof.
