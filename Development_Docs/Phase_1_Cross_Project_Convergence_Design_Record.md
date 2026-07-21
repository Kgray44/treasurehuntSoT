# Phase 1 Cross-Project Convergence Design Record

Status: integration candidate; not merged to `main` and not production accepted.

## Baseline decision

The branch starts at Project One Voyage `4e8f385687b01aa6b1e97452ff76e6e7e3b58b8c`, whose parent `a0a2111ced1c9ef840fde214763fda9144ce41d4` records the accepted Lanternwake Phase 5 and Universal Language reconciliation. Live `origin/main` verified at preflight was `0ecd2f9cca6116e2f7f9ab4408ade749fb061e72`; all three frozen candidates share it as their merge base. Main already contains the accepted Lanternwake and Universal Language code; `a0a2111c` adds only their reconciliation record. One Voyage is therefore the correct canonical-content baseline, not a competing replacement for accepted history.

## Canonical model

- `Chronicle`, `PublishedTaleVersion`, `TaleSession`, `TaleSessionEvent`, the snapshot builder, and the command path are the single content/runtime authority. Legacy Companion writers remain compatibility-only and must not be called by canonical mutations.
- `UserAccount` is the claimed-person root. `PlayerProfile` is one optional Player projection per account. Player, Captain, and Creator are account capabilities, never separate identities.
- Creator and Captain mutations retain historical actor strings but write canonical account foreign keys. Audits retain historical actor snapshots and use canonical account ownership when resolvable. Ambiguous source identities remain unresolved; they are never auto-merged.
- Canonical sessions, invitations, membership, Chronicle ownership, and private import ownership resolve through `UserAccount`. Legacy Player cookies and invitations remain secure compatibility exchanges.
- Private packages point to canonical Chronicle content. Imports are private drafts only: they do not publish, launch, invite, or grant Player access. Private assets require canonical role, session membership, publication/reveal state, and availability checks.

## Compatibility and removal gates

| Retained component | Boundary | Removal gate |
| --- | --- | --- |
| Legacy Player identity session | secure exchange to canonical account session | all active Player identities backfilled, reconciled, and accepted |
| Game Master strings | historical actor snapshot and lookup input | canonical Creator/Captain ownership coverage plus audited no-reader release |
| Legacy invitations | controlled acceptance path | all unexpired invitations reconciled and a migration-window approval |
| Campaign/legacy tables | read-only compatibility source | exact parity, owner sign-off, backup/restore rehearsal |
| Quartermaster route | invokes canonical Captain service | Captain route telemetry proves no legacy writer use |

## Final migration order

1. Existing canonical One Voyage migrations (`20260721113000_project_one_voyage`, MySQL `0005`).
2. Wayfarer account models (`20260721120000_wayfarer_unified_identity`, MySQL `0006`).
3. Wayfarer actor ownership and deterministic backfill, with unresolved candidates recorded rather than merged.
4. Sealed Hold package, import, and private-asset models.
5. Cross-project account/Chronicle/private-content constraints and indexes.
6. Compatibility deprecation only after the documented removal gates pass; no legacy table is dropped in this release.
