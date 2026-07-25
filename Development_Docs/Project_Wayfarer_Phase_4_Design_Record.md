# Project Wayfarer Phase 4 Design Record

Branch `codex/project-wayfarer-phase4-artifacts-achievements` is stacked on
Phase 3 `a880a5db8e607797e86b4a0549866bbca1f72553`; origin/main at start was
`6bd8209d2d7f0edc73da9566fd06e825ae51a602`. Work occurs only in
`C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\treasurehuntSoT-wayfarer-phase4`.

## Authority and source contract

Historical `artifactGranted` events contain shared-inventory evidence only.
They project at most `WITNESSED`; they never imply personal ownership.
New published-Voyage grants create an immutable One Voyage `ArtifactGrantReceipt`
after the canonical event commits. The receipt is schema version 1, contains only
allowlisted IDs, event-time recipient resolution, policy, custody, component
metadata and timestamp, and is the sole personal-grant authority. Corrections
are new receipts linked by `correctionOfGrantId`; raw event payloads are neither
stored in Wayfarer nor returned by its DTOs.

Policies are resolved at event time: `ALL_ACTIVE_PLAYERS`, `SELECTED_PLAYER`,
`DISCOVERING_PLAYER`, `CAPTAIN_SELECTED`, `CREW_ROLE`,
`CREW_COLLECTION_ONLY`, and `PERSONAL_AND_CREW_COLLECTION`. Late, removed,
declined and nonmatching-role memberships do not qualify. Discovery requires an
explicit membership ID. Existing shared-only rows remain unresolved or witness
records; no everyone-owns-it backfill is permitted.

## Wayfarer ledger and privacy

`PlayerArtifactRecord` is unique per owner and source grant event, pins the
published version/checksum and safe artifact/Chronicle snapshots, and separates
authoritative state from favorite, private note, Memory link, visibility and
display placement. Archive is presentation state; revocation/correction is
source state. Personal assembly instances/contributions use immutable recipes;
collection progress is derived from personal qualifying records. Display cases
are owner-scoped and public projections are allowlisted. Achievement definitions
are versioned and facts-derived; no mutable counters or public reputation score
exist.

Phase 4 reads and projects One Voyage facts only. It does not mutate Voyage
events, memberships, shared inventory, published Chronicles, or Harborlight
collections during reconciliation. Later work includes follower projections,
Captain/Creator achievements, and live MySQL proof.
