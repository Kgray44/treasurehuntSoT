# Project Wayfarer Phase 3 Design Record

## Scope freeze

Phase 3 implements the private, per-person Chronicle Passport history: durable
`PlayerChronicleRecord` projections, version-pinned historical snapshots,
outcomes, safe progress summaries, explicitly accurate timing, owner-authored
reflections and Memories, private Keepsakes, consent, and crew-history
snapshots. One Voyage remains the source of facts; Wayfarer owns the rebuildable
privacy-governed projection. No One Voyage source row is written by a Phase 3
operation.

The worktree begins from `origin/main` at
`6bd8209d2d7f0edc73da9566fd06e825ae51a602` (verified 2026-07-25). The
implementation branch is `codex/project-wayfarer-phase3-chronicle-history` in
`C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\treasurehuntSoT-wayfarer-phase3`.
The canonical UNC checkout is not modified.

## Contracts

- One `PlayerChronicleRecord` is unique per `(playerProfileId, sourcePlaythroughId)`.
- Each record pins the `PublishedTaleVersion` identifier and checksum and captures
  title, cover reference, Creator attribution, participant name, and avatar
  references on its first derivation. Current profiles and Chronicles never
  refresh these values.
- Reconciliation reads memberships, invitations, version-pinned sessions, and
  event type/created-at metadata. It never parses or copies raw event payloads,
  answers, variables, notes, credentials, tokens, or object keys.
- Chapter and artifact summaries use only the pinned snapshot plus canonical
  event block IDs, sequences, and timestamps. Choice selection is explicitly
  `UNAVAILABLE` because the canonical event contract does not preserve an
  option identity safely. Missing evidence is never represented as zero.
- Personal wall-clock timing begins at the later of session start and membership
  join, then ends at personal completion or the governed session fallback.
  The timing definition is `WAYFARER_TIMING_V1`.
- Reflection and Memory content are separate editable owner annotations;
  projection upserts never replace them. Keepsake content is a bounded private
  presentation payload validated with Zod. A durable crew snapshot is frozen
  on first projection. Consent is scoped (`DISPLAY_NAME`, `AVATAR`, `QUOTE`,
  `PHOTO`, `AUDIO`, `GENERAL_MEDIA`) and defaults to pending.
- Detailed records are `ONLY_ME` by default. There is no Captain, Creator,
  public Profile, Community, or general crew detail route in Phase 3.

## Explicit exclusions retained

Phase 3 does not implement artifact ownership or custody, achievements,
analytics, public history or Community sharing, public crew graphs, passkeys,
MFA, export, deletion, new provider integrations, a runtime redesign, or
external-media deployment. Artifact references are limited to sanitized
version-pinned summaries and reflection references.

## Reconciliation

The projector is idempotent: repeat runs upsert the unique record, update only
derived source facts, and preserve snapshots and owner annotations. Invalid or
insufficient source evidence is represented with a projection status/reason.
The records are compatible with future tombstones because historical text and
media references are retained independently of mutable current profile fields.
