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

## r4 current-main verification and replacement freeze

The Helm-owned recovery was incorporated at
`5717ab5c2f1445cd899471932b99eacf20e81bc1` and its exact combined-source
focused hosted `browser.helm` run `31608295048` passed all three selected cases
with clean teardown. The replacement qualification then passed the Drydock,
Studio/API, Phase 2 and Phase 3 migration, policy, Prisma, static, Sounding
Line runtime, production-build, documentation, and Feature Catalog scopes.

Immediately before the r4 freeze, fetched `origin/main` still resolved to
`5735d43821209adb2259ec2c38979281da1bb5b9`, the r3-qualified base. The branch
is a strict descendant of that unchanged base, so no new mainline integration
or conflict resolution exists to perform. The next commit is bound by tag
`project-drydock-phase3-candidate-20260812-r4` and may receive one new explicit
Mainline Decision only after serialized canonical acceptance ownership is
acquired.

## r6 post-Helm main reconciliation and replacement freeze

Helm Phase 2 then completed protected merge PR #53 at
`920d92a51a16d60a2dfe35278598e6d921be7e4c`, with accepted candidate
`61cb6e0fc8df4bf8b5a38cc14f3f1bc715d8ee00`; its sealed authority returned
`RELEASE_GO` with 38 clean receipts and its protected binding passed. That
accepted main advance supersedes r5 before authority: r5 received no Mainline
Decision and remains historical evidence only.

Drydock was rebased once onto accepted main `920d92a51a16d60a2dfe35278598e6d921be7e4c`.
The already-integrated Helm recovery was skipped as equivalent. The sole shared
policy conflict was resolved by preserving Helm's presence-specific contract
mapping and Drydock's dynamically loaded Drydock contracts; generated Catalog
conflicts were rebuilt through `features:sync`, never hand-edited. The exact
reconciled source then passed Feature Catalog 9/9 at 46 entries, policy (57
suites / 455 contracts), Sounding Line runtime 21/21, Drydock 33 files / 196
tests, both 59-migration SQLite rehearsals with static MySQL parity, generated
Prisma client, typecheck, static validation, production build, and documentation
validation.

The next commit is frozen under tag
`project-drydock-phase3-candidate-20260812-r6`. It is the only candidate
eligible for one new explicit Mainline Decision after serialized canonical
acceptance ownership is acquired.

## r4 authority disposition

Candidate r4 (`fd57f0f23330d86502808b197c2b9d5f3a90e422`) consumed its one
hosted Mainline Decision in run `31612564391` against the unchanged accepted
base `5735d43821209adb2259ec2c38979281da1bb5b9`. The sealed
`SOUNDING_LINE_FINALIZER` returned `EVIDENCE_INVALID`: 17 of 18 receipts were
`PASSED` with `CLEAN` cleanup, and no receipt was missing, duplicate, unknown,
or runtime-nonconformant. The sole failed clean receipt was
`unit.feature-catalog`, whose stable-count assertion expected 45 entries while
the audited catalog now correctly contains 46 after the Phase 3 branch-complete
fragment was added. This is a terminal candidate evidence failure, not
protected integration or an exact-main claim. It returns the phase to the
smallest focused Feature Catalog test before any replacement candidate can be
requalified and frozen.

## r5 current-main verification and replacement freeze

The focused repair updates the Feature Catalog stable-count expectation from 45
to 46 and asserts that the Phase 3 `FT-036` branch-complete entry belongs to
Project Drydock Phase 3. On recovery commit
`6a5d66e23e1793afb60bcafc16f723661798d68e`, the direct Catalog suite passed
9/9; Drydock passed 33 files / 196 tests; Studio/API passed 6 files / 14 tests;
both SQLite migration rehearsals passed at 59 migrations with static MySQL
parity; policy, both Prisma schemas, generated client, typecheck, static,
Sounding Line runtime, production build, documentation, and Feature Catalog
validation all passed.

Immediately before this r5 freeze, fetched `origin/main` was still
`5735d43821209adb2259ec2c38979281da1bb5b9`, and the recovery branch remained
a strict descendant. No current-main advance or conflict reconciliation was
required. The next commit is frozen under tag
`project-drydock-phase3-candidate-20260812-r5` and may receive one explicit
Mainline Decision only after serialized canonical acceptance ownership is
acquired.

## r6 protected acceptance and exact-main proof

After serialized canonical acceptance ownership was acquired, r6
(`fcd9010a37224759bb5b71c640e121c9e4f1e1e2`, tagged
`project-drydock-phase3-candidate-20260812-r6`) received its sole hosted
Mainline Decision in run `31618253086`. The sealed finalizer was
`SOUNDING_LINE_FINALIZER` with decision `RELEASE_GO`: all 38 required receipts
passed, all 38 cleanup states were `CLEAN`, and there were no missing,
duplicate, unknown, or invalid receipts. Its evidence digest is
`be3cba53bb4a22a1b44b921882b4cf27af982964c73de1f3dd85b5479583009e`.

Protected binding run `31620037280` then passed and PR #52 merged at
`191a964488d0df71f8dcb91c5b8372fc73b6b32e`. Exact-main proof verifies that
this merge has parents
`920d92a51a16d60a2dfe35278598e6d921be7e4c` and
`fcd9010a37224759bb5b71c640e121c9e4f1e1e2`, the candidate is an ancestor of
`origin/main`, and fetched remote `origin/main` is exactly
`191a964488d0df71f8dcb91c5b8372fc73b6b32e`.

The accepted product integration is final for Phase 3. Current authority
marks record-only closure `TARGET_ARCHITECTURE_PENDING`, so the completion
receipt and Feature Catalog promotion are separately prepared without a
documentation-only merge or another authority invocation.
