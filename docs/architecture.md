# Architecture

## Phase 3 cinematic companion projection

The player reads one server-filtered `PublicSnapshot` containing chapters, released hints/annotations, visible map locations/routes, safe artifact states, visible optional mysteries, event-derived log entries, generic finale state, and per-section unseen counts. One SSE connection transports ordered sanitized events; section navigation is client-side and starts no independent polling.

New normalized records are `MapRoute` and `ViewedContent`. Existing content models gained release, relationship, placement, and safe-label fields rather than duplicating derived display tables. `AudioPreference` now carries the cross-device preference projection; immediate UI choices may also be cached locally for offline startup.

```mermaid
flowchart LR
  P[Player journal + animation director] -->|snapshot + access cookie| N[Next.js server]
  G[Quartermaster] -->|session + CSRF| N
  N -->|Prisma transaction| D[(SQLite dev / MySQL prod)]
  N -->|ordered SSE + replay| P
  N --> A[Audit and save-state log]
```

Server Components enforce initial access. Route handlers own authentication, validation, snapshots, and SSE. `src/server/progression.ts` is the transaction boundary; `src/domain/story.ts` owns state rules. The UI receives only a public projection, never database rows. In-memory publish accelerates same-process delivery while database replay by sequence remains authoritative after reconnect/restart.

The client adds one animation director between ordered domain events and presentation. It starts server work immediately, allows only non-authoritative opening/idle motion while pending, and selects a success or failure timeline from the actual response. One queue owns SSE ceremonies, and the public snapshot remains authoritative after skip, cancellation, reconnect, or visual-runtime failure.

Major dependencies remain deliberately bounded: Prisma for persistence and transactions, bcryptjs for portable hashes, Zod for payload validation, GSAP for cinematic orchestration, Motion for React interaction/presence, StPageFlip for the journal surface, Rive/Lottie for isolated vector assets, Pino for structured redacted logs, and Vitest/Playwright for validation. See `docs/animation/architecture.md` and `docs/animation/library-ownership.md`.

Phase 3 adds an administrative intent layer. `/api/gm/preview` projects without writes, `/api/gm/staging` persists unreleased intent, and `/api/gm/commands` enforces expected sequence and idempotency. `PlayerPresence` supplies expiring evidence. See [admin command pipeline](admin-command-pipeline.md) and [player presence](player-presence-and-sync.md).

## Tall Tale Studio Phase 1

Studio is additive to the original campaign companion. `TallTale` owns identity and catalog metadata; `TaleDraft` owns optimistic autosave state; chapters, blocks, and connections form the editable graph. Publishing validates that graph and writes a complete, checksummed `PublishedTaleVersion.contentSnapshot`. Published rows and referenced asset variants are immutable from the player runtime's perspective.

`src/tall-tale/progression.ts` is the authoritative session engine. Each non-preview `TaleSession` is pinned to one published version and advances through idempotent, ordered events. The player receives its current projection and SSE updates; Captain actions call the same engine. Verification providers all enter through one versioned submission contract, so the simulator and a future paired helper cannot bypass progression rules. See `docs/tall-tale-studio.md`.
