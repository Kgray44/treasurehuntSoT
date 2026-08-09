---
title: Project Wakebook Phase 1 Design Record
audience: product-engineering
status: current
canonical_for: project-wakebook-phase-1-design-record
last_reviewed: 2026-08-09
---

# Project Wakebook Phase 1 design record

## Decision and source boundary

Project Wakebook Phase 1, **Open the Wake**, creates a complete private Journey Archive over accepted Wayfarer history. It does not create another history store, progression authority, authentication system, artifact authority, semantic-diff engine, or public-sharing path.

| Boundary                                       | Frozen value                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Worktree                                       | `C:\Users\kkids\Documents\treasurehuntSoT-wakebook-phase1-open-the-wake`                                 |
| Branch                                         | `codex/project-wakebook-phase1-open-the-wake`                                                            |
| Initial accepted base                          | `f1c2f22dd935322c1a71eb80c51592f243dc196d`                                                               |
| Reconciled accepted base before implementation | `273fb5255ad222812530422e902db04c0ddd1961`                                                               |
| Dependency class                               | Class A: accepted Wayfarer/Homeport/Sounding Line contracts only                                         |
| Schema impact                                  | None                                                                                                     |
| SQLite/MySQL reservation                       | None                                                                                                     |
| Activation                                     | Existing authenticated Chronicle Passport destination; no dormant partial mode                           |
| Rollback                                       | Revert Wakebook routes, services, components, styles, tests, and records; retain Wayfarer data unchanged |

The supplied Project Wakebook governing PDF, Global Product Governance Standard, Continuous Development and Mainline Integration Standard, Homeport recovery governance, Sounding Line governance, the pasted Phase 1 execution brief, and accepted Wayfarer/One Voyage/adjacent-project records were read before this freeze. The supplied PDFs remain external input authorities until separately accepted into the repository; current fetched `origin/main` remains implementation truth.

## Mainline Safety Contract

After Phase 1, a signed-in person can naturally reach a polished, private, chronological Journey Archive from Personal Harbor / Chronicle Passport, browse one or many version-pinned Voyages, search and filter safely, open a useful Voyage Detail baseline, understand timing quality and unavailable evidence, distinguish shared Voyage artifact context from personal ownership, and retain existing Reflection, Memory, Keepsake, and consent behavior.

Dormant behavior remains absent: Tideglass semantic comparison, Timeline View, People View, Landfall Map View, cross-Voyage statistics, public sharing, competitive analytics, rich Keepsake redesign, replay/revisit expansion, and edition notifications.

Canonical sources remain:

- One Voyage for runtime facts and events;
- Wayfarer for durable personal history, snapshots, artifact provenance, achievements, annotations, Keepsakes, and consent;
- Homeport for Personal Harbor shell and navigation;
- Sounding Line for verification and release evidence;
- adjacent projects only after an accepted contract reaches main.

The permanent-stop result is coherent: if all later Wakebook phases are cancelled, Phase 1 is still a discoverable, private, useful archive rather than scaffolding for a future feature.

## Frozen service ownership

`src/wakebook` owns human archive contracts, query composition, presentation mappings, privacy-safe DTOs, and typed input/error handling. `src/wayfarer/chronicle-history.ts` retains materialization and all current mutations. React components and route handlers do not invent history semantics.

Phase 1 adds owner-authenticated read endpoints:

- `GET /api/passport/voyages` for bounded archive summaries, year-group summaries, and separate invitation history;
- `GET /api/passport/voyages/:recordId` for owner-safe Voyage Detail;
- `GET /api/passport/voyages/:recordId/cover` for owner-authorized historical cover delivery.

Existing `/api/passport/history` read and mutation routes remain compatible. Existing Reflection, Memory, Keepsake, and consent routes keep their current CSRF and owner/participant authorization.

## Frozen contracts

### 1. Journey Archive summary DTO

Each summary contains only the record ID; deterministic chronology; historical title and safe cover reference; exact published-version ID, label when present, and checksum; human lifecycle; participation role; a bounded historical crew preview; primary timing value and quality; safe outcome; chapter count; and counts/flags for Reflection, Memories, Keepsake, shared artifact context, and canonical personal artifact records.

It never contains Reflection text, Memory body text, raw event payloads, secret variables, Captain notes, storage keys, raw Prisma relations, or another account's private fields.

### 2. Voyage Detail DTO

Detail adds date range, all safe timing metrics, completed chapter evidence, unavailable objective/choice explanations, historical crew snapshots, shared artifact summaries, canonical personal artifact records, existing owner-authored Reflection and Memories, Keepsake status, optional public-review handoff, and technical provenance. Current profile or Chronicle metadata never overwrites historical snapshots.

### 3. Year-group model

The response returns page items grouped by year plus `Date unavailable`. For every displayed year, `totalCount` and `completedCount` are computed against the full owner-scoped filtered set, not inferred from the current page. Recorded duration is shown only when every included record has a supported exact value; otherwise it is omitted rather than presented as a total.

### 4. Archive date

Played-record precedence is `completedAt`, then `startedAt`, then `joinedAt`, then unavailable. Projection `createdAt`, `updatedAt`, and reconciliation time are forbidden substitutes. Invitation chronology is separate.

### 5. Lifecycle presentation

Known states map to calm human labels such as Completed, In progress, Paused, Left the Voyage, Removed from the Voyage, or Voyage abandoned. Unknown source values map to `History status unavailable`; raw enums never reach ordinary UI.

### 6. Historical edition identity

Every played record exposes immutable published-version ID and checksum plus the stored version label when available. A missing label becomes `Played edition`; no label is invented and the current edition is never substituted.

### 7. Timing quality

One presentation function handles `EXACT`, `ESTIMATED`, `UNAVAILABLE`, and `NOT_APPLICABLE`. Current Wayfarer data supplies exact or unavailable values only. Unknown never becomes zero and approximation is visible without a tooltip.

### 8. Crew preview

At most three active historical participant snapshots are returned for cards, excluding the owner membership when identifiable. Tombstoned people become `Former crew member`; no current-profile resolution or inferred relationship label is used.

### 9. Safe outcome

`COMPLETED` and `COMPLETED:<internal-id>` present as `Completed`; no internal identifier is exposed. Other known terminal states receive neutral human labels. A named ending is shown only if a future accepted snapshot provides one; Phase 1 does not reverse-engineer it.

### 10. Chapter summary

Cards receive a count only. Detail receives the accepted historical completed-chapter title and completion time. Missing optional-objective or choice evidence is explicitly unavailable, never zero or reconstructed.

### 11. Artifact context

Stored `SHARED_VOYAGE_ARTIFACT` summaries are labelled as witnessed/shared Voyage context. Personal ownership is shown only from the owner's `PlayerArtifactRecord` projection for the same source Voyage. Artifact Cabinet remains the owning destination.

### 12. Invitation representation

Invitation-only records are returned in a separate bounded collection, use their own lifecycle dates and human labels, and never contribute to played-Voyage counts, duration, artifacts, or completion summaries.

### 13. Filter contract

Phase 1 supports bounded owner-scoped title/crew search and accurate filters for lifecycle, year, participation role, has Memories, has Keepsake, and has artifact context. Creator/Captain/person identity filters are omitted until safe human historical attribution is available. Inputs are strict, URL-safe, clearable, and do not encode Memory content.

### 14. Sort contract

`NEWEST` and `OLDEST` order by the deterministic archive date and stable record ID. Competitive or quality-unsafe duration sorting is absent.

### 15. Cursor contract

The cursor is an opaque, versioned encoding of sort direction, archive date (or unavailable group), and record ID. Invalid/mismatched cursors fail with a bounded input error. Provider-neutral queries read at most `limit + 1` candidates from each date-source partition, merge deterministically, and return no full detail objects.

### 16. First-use empty state

The empty archive explains what will appear and links visibly to Community Chronicle discovery, invitation entry, and Personal Harbor. It never displays a blank grid or `No data`.

### 17. Partial history

Projection failures and invalid stored summaries preserve valid records and add a safe owner-facing warning. The browser never falls back to raw TaleSession events.

### 18. Historical unavailable state

Unavailable dates, timing, choices, objectives, covers, media, and source Chronicle metadata have explicit human fallbacks. No absent value is silently recast as zero, current, or owned.

### 19. Navigation

The ordinary path remains Gateway -> signed-in account -> Chronicle Passport -> History -> Voyage Detail on desktop and mobile. `History` stays in Homeport's owned section navigation; the page establishes the product identity through `Your Voyages` and `The Living Journey Archive`. Detail has a visible Archive return.

### 20. Privacy

All list/detail/cover queries begin with canonical AccountSession identity and owner predicates. Foreign and missing record IDs return the same neutral 404 response. Summary redaction occurs server-side. Cover delivery resolves only the owner's version-pinned asset and never serializes a storage key.

### 21. Wayfarer compatibility

Wakebook may trigger the existing idempotent materializer before reads but never forks it. Existing `/api/passport/history` shapes and mutation endpoints remain available for compatibility and regression coverage.

### 22. Sounding Line contracts

Phase 1 registers version pinning, owner privacy, historical stability, timing quality, artifact context, navigation reachability, pagination, year grouping, filters, invitation separation, partial history, and summary redaction. Existing Wayfarer and Homeport contracts remain dependencies rather than being weakened or renamed.

### 23. Schema impact

None. No Prisma model, SQLite migration, MySQL migration, backfill, cache table, or search index is required.

### 24. Rollback

Revert Wakebook-owned service/API/component/style/test/catalog/document changes. Existing Wayfarer projections and annotations require no data rollback and must not be deleted.

### 25. Failure behavior

Optional adjacent-system failure never blocks ordinary history. Artifact lookup failure degrades artifact context; cover failure shows a governed visual fallback; materialization failure exposes partial-history guidance while preserving readable accepted records; session loss routes to canonical sign-in.

### 26. Permanent-stop behavior

No visible Phase 1 page depends on a `coming soon` control. Archive Home, one-Voyage, many-Voyage, invitation-only, detail, empty, filtered-empty, error, and partial states are complete within this phase.

## Concurrency and integration

Deepwater Phase 1 advanced `origin/main` by five commits while Wakebook was blocked. The Wakebook branch fast-forwarded to `273fb52`; incoming changes were confined to Deepwater documentation/tooling plus shared Feature Catalog and Sounding Line control-plane files. No Wakebook-relevant runtime source changed. Shared control-plane edits will be made against the reconciled files and rechecked immediately before final evidence.

No concurrent Phase 1 branch had tracked divergence in Wakebook-owned runtime paths at architecture freeze. Wakebook will not consume unaccepted Tideglass, Helm, Admiralty, Shipwright, or other branch work.

Before final evidence, Wakebook semantically reconciled the later accepted-main sequence through `468530645e983412e5f4c1aaa103915be77c9c07`. That interval adds accepted Deepwater Phase 2/3, Tideglass Phase 1, Admiralty Phase 1, Drydock Phase 1, Feature Catalog, Homeport catalog, Sounding Line, and documentation truth. Shared conflicts were resolved by preserving Tideglass as `FT-B009`, Admiralty as `FT-B010`, and assigning branch-only Wakebook `FT-B011`; combining all project ownership, suite, contract, impact, and gate entries; adding accepted Drydock registry generation without displacing Wakebook generation; and retaining both Admiralty and Wakebook Homeport route/screen/journey additions. No incoming commit replaced Wakebook's archive service, UI, API routes, or schema-free design.
