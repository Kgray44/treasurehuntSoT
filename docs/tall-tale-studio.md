# Tall Tale Studio Phase 1

## Delivered workflow

Tall Tale Studio is an additive authoring and play system. It does not replace the original single-campaign companion.

- `/studio` lists drafts, validation state, release state, assets, and sessions.
- `/studio/tales/new` creates a private tale and first chapter.
- `/studio/tales/[id]` edits a vertical story graph with optimistic autosave, undo/redo, dnd-kit pointer/keyboard sorting, and explicit add/move controls.
- Settings, assets, locations, artifacts, and version history have dedicated nested routes.
- `/tales` is the dynamic public catalog. `/play/[taleSlug]` starts a version-pinned session.
- `/captain` lists live sessions; `/captain/sessions/[id]` controls progression and exposes the development verification simulator.

Creator and publisher operations require a server-side GM session, explicit capabilities, and CSRF. Player access tokens are random, stored only as hashes, and retained in a strict HTTP-only browser cookie rather than the session URL. Media storage keys are opaque and validated before filesystem access.

The editor includes searchable Block Library, Chapters, and Story Outline tabs; collapsible chapters; visible flow/drop indicators; and responsive inspector behavior. A selected block can be rendered in an isolated desktop or mobile viewport with reduced-motion and replay controls, while Full Tale Preview and Play From Here use expiring draft sessions. The More menu exposes settings, version history, duplicate, and guarded archive actions.

## Authoring model

The registry in `src/tall-tale/block-registry.ts` is the source of truth for all Phase 1 blocks:

1. Narrative
2. Captain's Note
3. Riddle
4. Information
5. Travel Direction
6. Location
7. Arrival Check
8. Image
9. Image Transformation
10. Cinematic
11. Audio
12. Artifact Reveal
13. Hidden Message Reveal
14. Collection Update
15. Confirmation
16. Choice
17. Text Answer
18. Captain Approval
19. Wait
20. Condition
21. Set Variable
22. Chapter Complete
23. Tale Complete

Each entry owns a stable type ID, category, defaults, inspector metadata, Zod configuration schema, asset-field declarations, and verification-provider dispatch. Unknown types render a safe diagnostic card and do not execute arbitrary behavior.

The editor sends the complete normalized draft with its `autosaveVersion`. The server claims that exact token before replacing chapter and block rows. A stale browser receives `DRAFT_CONFLICT`; its local state is not discarded. Choice and condition targets become explicit `BlockConnection` records. Duplication assigns new chapter/block IDs and remaps branch targets.

## Publishing and sessions

Publishing runs server-side graph, configuration, asset, and reachability validation. Blocking errors prevent a release; warnings remain visible. A successful publish serializes tale metadata, chapters, blocks, connections, locations, artifacts, and exact asset variants into a checksummed immutable snapshot. The transaction advances `latestPublishedVersionId` and marks the previous release non-current.

The catalog lists only current public releases; current unlisted releases remain available by their direct address. Starting a game records the exact `publishedVersionId`; later releases cannot alter that session. Preview sessions instead carry a draft snapshot and are visibly labeled. Every session event has a monotonic sequence and globally unique idempotency key.

Version History can preview any immutable release, compare two releases with structured added/removed/moved/renamed/access-scope changes, copy a release into a newly numbered draft, or fork it as a separate private Tall Tale with explicit provenance. None of those operations mutate a published snapshot or silently retarget active playthroughs. The catalog reports New, In Progress, or Completed/Replayable for compatibility browser sessions; the canonical Player library groups durable identity memberships by invitation, waiting, active, completed, replay/new-edition, and closed state.

The progression engine advances automatic blocks, evaluates variables/conditions, grants artifacts once, and opens standardized verification requests. Text answers, player confirmations, timers, Captain decisions, helper submissions, and the simulator converge on that engine. It rejects duplicate, stale, wrong-session, wrong-version, wrong-block, and wrong-request submissions.

## Assets and reusable libraries

Uploads validate MIME allowlists, size, and magic bytes. Originals are retained; images receive WebP thumbnail, preview, optimized, and mobile derivatives with checksums. Duplicate content returns the existing logical asset. Replacement adds new variants to the same asset ID, preserving existing draft references and older version snapshots. Published media requests are restricted to variants captured by that version.

Assets support display metadata, tags, semantic roles, collections, search/filtering by media/context/role/tag/collection/usage, recent and unused views, lazy thumbnails, paged expansion, drag-to-field assignment, usage lookup, original download, replacement, and guarded archive. A local `TaleAssetStorage` implementation isolates storage operations behind a replaceable interface. Locations support searchable/sortable records, duplicate/edit/archive, used-by counts, player copy, private Captain notes, map/display assets, a reference collection, and a future verification profile. Artifacts provide the parallel searchable/duplicable workflow for lore, ordinary-object labels, artwork/reveal/model assets, inventory categories, and persistence.

Interactive player, Captain, upload, and helper routes apply bounded per-process rate limits in addition to authorization, CSRF, idempotency, and optimistic concurrency. Structured logs cover publish, asset ingestion, session starts, accepted/rejected verification, and sanitized API failures without recording answers, credentials, bearer tokens, or raw evidence.

## Data and migration

SQLite migration `20260717213000_tall_tale_studio_phase1` and MySQL migration `0003_tall_tale_studio_phase1` add the authoring domain. The subsequent platform migrations extend that same model with identity, membership, invitation, reveal, role, and audit data. The seed is progress-safe under `--ensure`; an explicit preset remains the only development reset path.

For local SQLite:

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
```

For a fresh MySQL database, apply the platform script after the three prior domain scripts in the exact order documented in `docs/deployment.md`.

## Operational checklist

Before release, run `npm run validate`. Manually confirm narrow/mobile editor navigation, draft conflict messaging with two windows, published-session pinning after publishing a newer release, asset archive protection, Captain disconnect/reconnect state, and helper rejection cases. Keep `.data/tall-tale-assets` or the configured durable asset root backed up alongside the database.
