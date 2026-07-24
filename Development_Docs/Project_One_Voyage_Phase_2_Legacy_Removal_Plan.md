# Phase 2 legacy removal plan

No legacy persistence table is dropped by this phase. The prepared future
removal package is deliberately non-executing: after one full compatibility
release, a truthful observation window, retained recovery evidence, and owner
approval, remove application adapters first, re-run route/reachability and
backup-restore proof, then separately authorize table removal.

The implementation closes new legacy execution paths: new Player and staff
sessions issue `AccountSession`; retained PlayerIdentitySession and
GameMasterSession rows can only be read long enough to rotate compatible
browsers. Retained legacy routes resolve canonical identity, policy, state,
event, and audit paths. The CSV reachability ledger is the authoritative
component-by-component removal gate.

Future destructive SQL is intentionally absent. A table name reservation is
not evidence that time, release observation, or owner approval has passed.
