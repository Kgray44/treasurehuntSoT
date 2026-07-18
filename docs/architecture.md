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

## Unified Tall Tale Platform

The platform extends the Studio/session model rather than copying it. `PlayerProfile`/`PlayerIdentitySession` add durable Player identity; `PlaythroughMembership` is the per-Player authorization and library record; `Invitation`/`InvitationEvent` own single-recipient credential lifecycle; `RevealState` is the historical disclosure ledger; `PlatformRoleAssignment` supplements staff capability scope; and `PlatformAuditEvent` records correlated resource actions. `TaleSession` remains the one playthrough aggregate and retains the exact immutable version relation.

`src/platform/auth.ts`, `policy.ts`, `state.ts`, `invitations.ts`, `libraries.ts`, and `audit.ts` separate authentication, policy, lifecycle, transactional invitation behavior, workspace-specific projections, and safe auditing. Player, Captain, and Creator route families call those services and never serialize a raw aggregate. Compatibility routes call the same progression engine. See [Tall Tale Platform](tall-tale-platform.md) for lifecycle, migration, and security detail.

## Canonical Player journal

The Player Library is the place where Tall Tales are browsed. The immersive journal is the place where Tall Tales are played. `/player/playthroughs/[id]/journal` is therefore the canonical active, resumed, paused, and completed Player route; compatibility play and archive routes converge on the same component.

`src/tall-tale/progression.ts` remains authoritative. It projects a recursive Player-safe `journal` view from the pinned published snapshot, reveal ledger, ordered events, and current session pointers. `src/tall-tale/journal-contract.ts` defines the ten presentation modes and secret boundary, while `src/tall-tale/journal-page-model.ts` converts only released content into stable physical pages. `PhysicalJournalBook` owns the shared book shell and `TallTaleJournalSession` owns SSE reconciliation, reading position, presentation state, and Player actions. Reading state is persisted separately from progression through the existing Player preferences record.

This separation keeps Creator content canonical, the Captain engine authoritative, and historical reading immutable. A future location/vision provider can submit a scoped verification outcome through the existing envelope; the resulting ordered event and canonical state projection drive the same journal without a provider-specific Player runtime.
