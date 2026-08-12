---
title: Project Drydock Phase 3 Reconciliation Record
audience: engineering
status: current
canonical_for: project-drydock-phase-3-reconciliation
last_reviewed: 2026-08-12
---

# Project Drydock Phase 3 reconciliation record

## Reconciled inputs

- Original Phase 3 base: `236c27241bb8d1630274f5d5412ec9addbdb8893`.
- Pre-reconciliation qualified implementation: `764db42c383413cd0cb437c116598b2c1fec3799`.
- Current fetched accepted main at the one reconciliation: `ca40227cbef3575315c089d224a0cd26ec77bc78`.
- Reconciled implementation commit: `a54c1d80506598f0b18f618c55e3048b0cdb6cb8`.

## Semantic resolution

Current main added Project Helm Phase 2 membership-presence records, routes, Studio changes, Sounding Line registration, and MySQL migration `0056_helm_phase2_membership_presence`. The reconciliation retains those accepted inputs and the Drydock Phase 3 slice.

The only direct Phase 3 collision was MySQL migration numbering. Drydock's unchanged additive migrations were renumbered from `0056`/`0057` to `0057`/`0058`, preserving the existing Helm migration at `0056`; SQLite timestamp migration order remains unchanged. The merged Sounding Line registry preserves Helm's presence-specific contract selection and Drydock's full owned-contract selection.

## Requalified evidence

- `npm run drydock:phase3:migrations:sqlite` passed with 59 applied SQLite migrations, the final Phase 3 provenance migration, exact Scenario Suite member shape, and static MySQL parity.
- Both Prisma schema variants validate; the reconciled task-local SQLite Prisma client was regenerated before typecheck.
- `npm run typecheck`, `npm run drydock:test` (33 files / 196 tests), and `npm run test:policy` passed after reconciliation.

The earlier [local browser qualification](Project_Drydock_Phase_3_Browser_Qualification_Record.md) remains behavior evidence for the Drydock surface. This reconciliation did not change Sea Trials behavior; it did not treat that local evidence as staging, live-provider, owner, or mainline proof.

## Candidate boundary

The next commit freezes the reconciled candidate. It is the sole candidate eligible for one serialized Sounding Line Mainline Decision. Any later source change invalidates the freeze and requires requalification and a new decision.
