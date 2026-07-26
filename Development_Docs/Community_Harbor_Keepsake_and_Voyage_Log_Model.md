# Community Harbor Keepsake and Voyage Log Model

**Migration correction, 2026-07-25:** the later provenance requirement was proven, and every fetched remote head was checked before reservation. SQLite `20260725146000_harborlight_phase3_wayfarer_source` and MySQL `0037_harborlight_phase3_wayfarer_source` are now Harborlight-owned additive migrations. The disposable 32-migration SQLite rehearsal verified legacy-row preservation, nullable source fields, the `PENDING_SOURCE` default, unique constraints, indexes, and clean foreign keys; no private Wayfarer persistence was copied.

`CommunityVoyageKeepsake` is not a second canonical private Keepsake. Pending Wayfarer Phase 3 convergence, it is a Harborlight-owned, private publication-preparation record: it may retain a Wayfarer Keepsake identity, source watermark/projection checksum, selected publication-safe fields, Creator restriction review, sanitization and public-consent readiness, and a Voyage Log draft identity. It must not derive or retain private Memories, Reflection authority, historical Chronicle truth, timing derivation, historical participant truth, or Passport presentation. Its legacy `taleSessionId` is a private verification implementation detail and is never a public identity. Existing pushed migration `20260725143000_harborlight_phase3_keepsakes_voyage_logs_consent` is preserved; the semantic correction is additive and no new migration is reserved until a concrete persistence need is proven.

A Voyage Log is an explicit publication choice from a Keepsake and supports `PRIVATE`, `CREW_ONLY`, `UNLISTED`, and `COMMUNITY` visibility. Participant and media consent are purpose-specific, revocable, and checked at publication/projection time. Public media requires eligible scan/processing status and a separately checksummed sanitized derivative. GPS EXIF is removed; private locations are omitted and approximate locations are generalized. Creator sharing restrictions prevent governed artifacts, finale references, or story text from publication even after completion.

The public Voyage Log projection has safe Chronicle identity, opted-in display names, safe duration and selected reaction, verified-completion badge, sanitized media, spoiler-safe summary, and permitted comments. It never exposes raw session IDs, prose snapshots, events, answers, variables, Captain notes, invitations, private participant identity, original media, raw storage keys, or exact private coordinates.

## Wayfarer Phase 3 reconciliation — read-only candidate audit, 2026-07-25

This record is based on immutable commit `a880a5db8e607797e86b4a0549866bbca1f72553` (`test(e2e): prove wayfarer phase 3 browser acceptance`), reached through `origin/codex/project-wayfarer-phase3-chronicle-history`. The candidate is unmerged and remains `WAYFARER PHASE 3 LOCALLY COMPLETE — SHARED VALIDATION PENDING`; it is an upstream integration contract, not `origin/main` authority. Inspection used only Git object/ref reads. No Wayfarer worktree, ref, database, test runtime, or file was changed.

### Canonical Wayfarer model and watermark

Wayfarer owns the private per-player `PlayerChronicleRecord`, unique on `(playerProfileId, sourcePlaythroughId)`, pinned to the exact `PublishedTaleVersion` and checksum. It owns frozen historical Chronicle and participant snapshots, source fingerprint/watermark reconciliation, timing (`WAYFARER_TIMING_V1`), owner-authored `ChronicleReflection`, private `ChronicleMemory`, canonical private `VoyageKeepsake`, regeneration, and private Keepsake selections. Its projector reads only membership, invitation, Tale Session, pinned version, and allowlisted event type/timestamp metadata; it does not parse raw payloads or write One Voyage source rows. A source-fingerprint match skips projection writes. Its closure browser matrix records source-count invariance for the synthetic Session, events, and memberships.

Wayfarer participant snapshots are historical, private snapshots. Crew material in a private Keepsake is omitted for solo Voyages and, for multi-person Voyages, includes only a participant with an explicit granted private-Keepsake scope. Owner projections are account-rooted and owner-only; crew-safe output is consent-filtered; a foreign account receives no detail projection. Passport is Wayfarer presentation, not a Harborlight surface.

### Consent and Sealed Hold boundary

`WAYFARER_PRIVATE_KEEPSAKE` is a private Keepsake purpose. Wayfarer records scopes such as display name, avatar, quote, photo, audio, and general media with pending/granted/denied/revoked state. It is read-only input to Harborlight and never authorizes publication. `HARBORLIGHT_VOYAGE_LOG_PUBLICATION` is separately explicit, Voyage-Log-specific, visibility-aware, revocable, expiration-aware where governed, independently auditable, and checksum-bound for media. Harborlight public DTOs expose no Wayfarer or Harborlight consent identifiers.

Sealed Hold remains the owner of protected media, scanner/quarantine truth, object storage, private delivery, and accepted public-derivative ports. Harborlight receives only an approved opaque media reference and public derivative facts; neither source storage keys nor raw private media payloads cross the port.

### Ownership and integration seam

One Voyage remains authoritative for Chronicle, PublishedTaleVersion, TaleSession, TaleSessionEvent, PlaythroughMembership, completion, progression, and canonical runtime facts. Harborlight owns only Community discovery/social behavior and public-sharing preparation: public consent, Creator restrictions, spoiler classification, derivative choice/sanitization/location policy, Voyage Log lifecycle and visibility, search/Open Graph, and public comments/reports/saves/collections.

Harborlight must consume the unmerged candidate through a narrow read-only port, not copied schema or services:

```ts
interface HarborlightKeepsakeSource {
  getEligiblePrivateKeepsake(input: unknown): Promise<HarborlightKeepsakeSourceProjection>;
  getPublicSharingCandidates(input: unknown): Promise<HarborlightSharingCandidateProjection>;
  verifySourceWatermark(input: unknown): Promise<HarborlightSourceVerification>;
}
```

The projection is limited to an opaque Wayfarer Keepsake identity, owner authorization result, exact version/checksum/watermark, completion eligibility, selected owner-authorized safe candidates, and restriction-ready facts. It excludes Memories, Reflection/private notes, raw One Voyage events, account or invitation identifiers, timing internals not selected for sharing, unapproved identities, storage keys, and raw source payloads. Until Wayfarer lands, Harborlight uses only a synthetic test adapter and must label the production adapter `NOT_CONNECTED`; no duplicate private persistence may be fabricated.

### Current overlap disposition and convergence order

| Current Harborlight overlap                                                                         | Disposition                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CommunityVoyageKeepsake` and `src/community/keepsake-store.ts` direct canonical-session generation | Narrow to the Harborlight sharing-source/preparation record and replace direct private-Keepsake derivation with the port. Preserve pushed tables/migrations; do not expose or reuse its legacy session identity publicly.                |
| `safeSnapshot`, `favoriteMoment`, `representationChecksum`, `status`                                | Retain only selected public-preparation facts with provenance; private reflection, memories, regeneration, timing, and historical snapshot authority move/remain in Wayfarer.                                                            |
| `CommunityVoyageLog` and participant/media consent tables                                           | Harborlight-owned public publication workflow. Participant consent is purpose `HARBORLIGHT_VOYAGE_LOG_PUBLICATION`, distinct from Wayfarer private consent; media approval additionally binds exact opaque source identity and checksum. |
| Existing Keepsake routes/tests                                                                      | Recast as Harborlight source-port/draft tests; remove any claim that they provide a private list/detail/generation engine.                                                                                                               |

Convergence order is Wayfarer Phase 3 first, then Harborlight wiring to its accepted projection port. The inspected Wayfarer tree contains SQLite migrations `20260725110000` and `20260725111000` and MySQL `0025` and `0026`; no `20260725120000`–`20260725122000` or MySQL `0027` equivalent exists at the audited commit. Harborlight therefore cannot safely compile a concrete production adapter on this branch. No collision or Harborlight persistence deficiency has yet been proven, so SQLite `20260725146000` and MySQL `0037` are deliberately unreserved and no schema mutation follows from this audit.
