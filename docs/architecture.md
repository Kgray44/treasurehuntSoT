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

## Canonical Player Experience shell

The Player Library is the place where Tall Tales are browsed. The immersive Experience shell is the place where Tall Tales are played. Durable Player routes use `/player/playthroughs/[id]/journal/{chapters,map,artifacts,messages}`; token-compatible active routes use `/play/[taleSlug]/session/[sessionId]/{chapters,map,artifacts,messages}`. Legacy base and archive URLs redirect to `chapters` rather than maintaining another renderer.

`TallTaleJournalSession` is a persistent route layout: identity, theme context, header, section tabs, SSE reconciliation, audio/motion state, and current objective remain mounted while the keyed content region changes. Chapters retains `PhysicalJournalBook`; Map, Artifacts, and Messages are full Player-safe pages that consume the same projection. Active and completed modes share these components, with completed mode disabling progression mutations. Reading position, map zoom/selection, artifact selection, and message read state persist separately from progression through `PlayerProfile.preferences`.

This separation keeps Creator content canonical, the Captain engine authoritative, and historical reading immutable. A future location/vision provider can submit a scoped verification outcome through the existing envelope; the resulting ordered event and canonical state projection drive the same journal without a provider-specific Player runtime.

## Application shell, themes, motion, and runtime

`src/app/layout.tsx` is the one frontend root. `ThemeProvider`, `AnimationProvider`, and `ProductShell` are long-lived in that order. The shell supplies role-aware global navigation and deterministic breadcrumbs; nested Studio authoring keeps its stable Story, Settings, Assets, Locations, Artifacts, and Versions workspace navigation; the Experience tabs remain a distinct navigation level.

`src/styles/tokens.css` is the authoritative semantic theme layer. The root defaults to **Verdant Depths** and `[data-theme="moonlit-blue"]` replaces the semantic values for **Moonlit Blue**. Player and staff application preferences are persisted in their existing JSON preference records and cached locally only as a fallback. A Tall Tale stores `APPLICATION`, `VERDANT_DEPTHS`, or `MOONLIT_BLUE`; an explicit Tale value is scoped to the Experience root and therefore overrides, but never overwrites, the application preference.

Product route content is keyed by pathname inside `AnimatePresence`, while the Experience shell keys only its content region. Route families use distinct physical metaphors for library arrival, Studio settling, Captain navigation, settings, book, map, artifacts, and messages. State-change events remain sequence/event-ID driven and are not confused with route entry. Reduced motion keeps fast opacity/state feedback and focus transfer without large spatial movement.

The canonical development command is `npm run dev:full`; the only canonical frontend origin is `http://127.0.0.1:3000`. `npm run dev` and `npm start` also bind explicitly to 3000. The launcher refuses an occupied port unless its state record, runtime root, PID, and listener ownership all match. Isolated validation may override its temporary test port, but no product route, package script, or fallback treats that as another application version. Alternate visual experiments belong in semantic themes or feature branches, not permanent servers on arbitrary ports.
