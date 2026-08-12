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

## Current-main addendum

After the original candidate's terminal `RELEASE_NO_GO`, the requalified
replacement candidate was frozen at `bc8f404b81659348bb229ac662b34961186a4068`
and tagged `project-drydock-phase3-candidate-20260812-r2`. While the shared
acceptance lane was correctly occupied by Project Bridgewatch, its accepted
Phase 2 closure advanced protected main to
`5735d43821209adb2259ec2c38979281da1bb5b9`.

The branch was therefore reconciled a second time at
`566598c8a785939264c7aebfafad74bdb923d7c1`. The accepted inputs add
Bridgewatch records and current Sounding Line hosted-acceptance and
record-only-closure infrastructure. There is no Phase 3 source or migration
collision; the only merge conflict was the generated Feature Catalog's source
commit pointer, resolved to the accepted current-main generated state without
editing a machine-readable feature fragment.

This current-main reconciliation supersedes r2 without classifying it as an
authority failure. A fresh focused qualification and a new frozen candidate are
required before the next one Mainline Decision.

During that qualification, `static.core` found only Prettier drift in two
accepted Bridgewatch closure records. Both were mechanically formatted and the
same static scope and production build then passed. No product, authority, or
acceptance evidence was altered by that formatting repair.

The resulting r3 candidate is frozen under tag
`project-drydock-phase3-candidate-20260812-r3`; that tag and the branch head
bind its exact SHA. It may receive one serialized current Sounding Line
Mainline Decision after canonical acceptance ownership is acquired.

## r3 authority disposition

Candidate r3 received that one hosted Mainline Decision at
`01a925d13fb5ab0a6064c1e6e4d2f1995a032349` (run `31601859085`) and the sealed
finalizer returned `EVIDENCE_INVALID`. The sole failed receipt is the required
Helm browser suite; its task-owned worker cleaned up normally. This is not a
current-main advance and does not justify another reconciliation. It returns the
phase to focused development verification. The exact hosted `browser.helm`
diagnostic independently reproduced a cleanly torn-down failure in the Captain
presence-projection assertion, after successful invitation handoffs and
heartbeat responses. Helm-owned repair must therefore prove both acceptance
handoff and presence convergence before any repaired candidate may be
requalified and frozen.
