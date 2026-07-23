# Project One Voyage Phase 2 design record: Close the Old Passage

Status: frozen for implementation on the dedicated Phase 2 branch. This is a
production-style proof and retirement-readiness phase, not authorization to
remove legacy persistence or to begin Phase 3.

## Preflight

| Item                                        | Recorded value                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Repository                                  | `Kgray44/treasurehuntSoT`                                                                               |
| Canonical checkout                          | `\\gwplastics.com\VT\Users\kgray\My Documents\treasurehunt\forever-treasure-companion`                  |
| Phase 2 worktree                            | `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\project-one-voyage-phase2-close-the-old-passage` |
| Branch                                      | `codex/project-one-voyage-phase2-close-the-old-passage`                                                 |
| Starting `origin/main`                      | `f4bfc4b4f3585bc8f60ce4d94375dc77a7092da2`                                                              |
| Upstream at creation                        | `origin/main`                                                                                           |
| Initial Phase 2 worktree status             | clean                                                                                                   |
| Existing concurrent Phase 2 branch observed | Harborlight Phase 2; no One Voyage Phase 2 branch existed                                               |

The canonical checkout is on an unrelated owner worktree with untracked
governing files and is not modified by this phase. The worktree inventory also
contains historical One Voyage, Wayfarer, Sealed Hold, Harborlight,
Lanternwake, Phase 3, Phase 4, and validation worktrees; none is an input
branch for this phase.

## Revalidated shared contracts

- **One Voyage** owns `Chronicle`, immutable `PublishedTaleVersion`,
  `TaleSession`, `TaleSessionEvent`, canonical runtime commands, projections,
  legacy migration, and bounded legacy compatibility.
- **Wayfarer** owns `UserAccount`, `AccountSession`,
  `AccountRoleAssignment`, private account lifecycle, credentials, providers,
  and privacy. A `PlayerProfile` is the person-facing projection, not an
  identity root. `PlayerIdentitySession` and `GameMasterSession` are retained
  compatibility sources only.
- **Sealed Hold** retains private-package, scanner, quarantine, private asset,
  and encryption authority. This phase verifies relationships only.
- **Harborlight** retains Community Profiles, listings, releases, dependency
  handling, installation, outbox, and lineage. A Community release continues
  to reference an immutable `PublishedTaleVersion`, never a mutable runtime.
- **Lanternwake** remains the animation and presentation-policy owner. Its
  missing Rive authoring assets are recorded separately and are not altered.

## Frozen Phase 2 compatibility contracts

The shared TypeScript contract in
`src/compatibility/compatibility-observation-contract.ts` is authoritative for
new observation producers and consumers.

1. Each compatibility invocation has a generated correlation ID, a bounded
   route key, operation, disposition, result, and test-traffic marker.
2. Observation data contains no raw credential, source payload, display name,
   email, request body, private asset key, or story text. Source references are
   represented only by an HMAC-free stable canonical/session identifier where
   already available, never by a secret.
3. Observation is best effort. A durable-write failure cannot block, retry, or
   duplicate the authoritative canonical action. It is reported through the
   operation result as an observation failure and remains auditable.
4. Every retained adapter resolves a canonical account/session/membership and
   calls canonical policy, projection, command, event, and audit paths. No
   adapter may write a legacy business model.
5. Every retained legacy component is `canWrite=false` in the retirement
   manifest. Migration tooling is the explicit offline exception and is never
   imported by a production route.

## Implementation plan and ownership

1. Add the minimal One Voyage telemetry/rehearsal persistence only if required
   by the frozen contract, using SQLite `20260722110000` and MySQL `0011`.
   The unused reserved identifiers remain unused; no cross-project migration
   identifiers are consumed.
2. Add static and runtime writer-prohibition tests, route dispositions, safe
   compatibility observations, expanded fixture/parity proof, and canonical
   account/session exchange tests.
3. Add a disposable MySQL 8 rehearsal runner that creates isolated schemas,
   runs the checked-in ordered chain, executes legacy migration and runtime
   proof using a least-privilege runtime account, verifies constraints, and
   drops only schemas it created.
4. Add a disposable backup/restore rehearsal that checks a database backup
   hash, canonical semantic state, authorization/revocation, and restart
   behavior. No production schema, asset root, service, NGINX configuration,
   or credential is read or changed.
5. Classify legacy routes/modules/models/tables/fields. Delete only an
   unreachable application wrapper when direct proof exists. Keep legacy
   tables and a non-executing future removal plan pending the one-release and
   observation-window gates.

## Migration and recovery decision

Phase 2 reserves SQLite `20260722110000` through `20260722114999` and MySQL
`0011` through `0012`. The branch will consume only an identifier justified by
a durable Phase 2 requirement and will record any unused reservation. Destructive
SQL is documentation only and will not be executed or packaged as an active
migration.

Recovery is restore-to-an-isolated-schema followed by migration verification,
semantic parity, authorization/revocation checks, and a clean application
restart. A simple routing rollback is prohibited after a canonical event.

## Expected conflict surface

Likely shared files are both Prisma schemas, package scripts, the retirement
manifest, compatibility adapters, Chronicle migration/parity helpers, and
cross-project documentation. Wayfarer conflicts are identity/session policy;
Sealed Hold conflicts are only private-content relationship checks; Harborlight
conflicts are immutable release lineage; Lanternwake is documentation/test-gate
only. No other project is changed in this branch.
