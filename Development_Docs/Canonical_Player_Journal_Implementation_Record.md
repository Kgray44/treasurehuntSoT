# Canonical Player Tall Tale Journal implementation record

Status: implementation and release-gate validation complete on 2026-07-18  
Repository baseline: `main` at `0192a16`, synchronized with `origin/main` (`0` behind, `0` ahead) before edits  
Governing rule: **The Player Library is the place where Tall Tales are browsed. The immersive journal is the place where Tall Tales are played.**

## Investigation findings

The repository contains two Player storytelling implementations:

- The original campaign companion at `/tale/[campaignSlug]` already owns the reusable immersive journal work. Its implementation is centered in `src/components/player/workspace/JournalWorkspace.tsx`, `src/components/animation/PageFlipBook.tsx`, `src/animation/journal/page-model.ts`, `src/animation/journal/opening-machine.ts`, and the journal portions of `src/styles/player.css`. It includes the closed cover, attached latch, wax-seal opening, worn left/right page geometry, center binding, page stacks, StPageFlip turns, chapter tabs, reduced-motion semantic reader, keyboard page controls, and responsive single-page behavior.
- Published Tall Tale playthroughs currently enter `/play/[taleSlug]/session/[sessionId]` and render `PlayerRuntime.tsx`. That runtime receives only the current block and presents it as one centered `runtime-block` card. Completed platform playthroughs instead enter `/player/playthroughs/[playthroughId]/archive` and render `VoyageArchive.tsx` as a separate metadata-and-list screen.

The canonical Player Library already exists at `/player/library`. Its cards are correctly grouped by invitation, waiting, active/paused, completed, replay, and closed states. The accepted-invitation waiting room at `/player/playthroughs/[playthroughId]` is also correctly separated from active play.

## Existing data and synchronization

`TallTale`, `TaleDraft`, chapters, story blocks, and immutable `PublishedTaleVersion.contentSnapshot` already form one Creator/runtime content model. `TaleSession` is the version-pinned playthrough aggregate. It stores lifecycle state, current chapter/block, ordered event sequence, variables, inventory, timestamps, and completion. `RevealState` records disclosed blocks and assets; `TaleSessionEvent` is ordered, durable, idempotent, and replayed over the existing authenticated SSE endpoint. Captain controls and helper verification both call the same progression engine.

The current Player session API safely authenticates both durable Player memberships and legacy opaque runtime cookies, but it projects only the current block. Its block shape also includes more authoring structure than an immersive Player renderer requires. The archive API correctly rebuilds released history from the session's pinned published version, but it uses a competing visual surface.

## Reuse, retirement, and route changes

Reusable:

- `PageFlipBook` and its reduced-motion fallback
- physical cover, page, binding, stack, latch, seal, and responsive CSS
- explicit journal-opening phase machine
- immutable published snapshots and the existing 23-type Creator block registry
- version-pinned `TaleSession`, reveal ledger, inventory, verification requests, durable events, SSE replay, and Captain progression controls
- Player Library cards and invitation/waiting-room flows

Retired from primary Player gameplay after verification:

- the one-card-at-a-time use of `PlayerRuntime`
- the standalone list-based use of `VoyageArchive`

`PublishedBlockView` remains an isolated Studio block-preview renderer; it is not the active Player session surface.

Canonical route plan:

- `/player/library` remains the card library.
- `/player/playthroughs/[playthroughId]` remains the invitation/lobby/waiting route and forwards launched or completed playthroughs into the journal.
- `/player/playthroughs/[playthroughId]/journal` becomes the durable-identity live and historical journal route.
- `/play/[taleSlug]/session/[sessionId]` remains a legacy compatibility route but renders the same canonical journal component.
- `/player/playthroughs/[playthroughId]/archive` becomes a compatibility redirect to the same historical journal instead of a second Player experience.

## Implementation architecture

The implementation adds a typed journal presentation contract over the existing canonical `PublishedBlock` data rather than copying Creator content. A Player-safe journal projection exposes only revealed blocks, safe presentation metadata, current/complete progress, authorized assets, and exact edition metadata. Logic-only blocks remain durable in the event stream but do not become visible pages.

One reusable physical book frame now serves both the original campaign journal and the Tall Tale runtime. A Tall Tale page model converts released blocks into stable page IDs and explicit story, riddle, map/location, artifact, decision, objective/waiting, message, cinematic/media, and completion page modes. Active and historical sessions use the same renderer; historical mode disables mutations and continues reading from the pinned immutable version.

Canonical progress remains in `TaleSession`, `RevealState`, verification records, inventory, variables, and ordered events. Per-Player reading position and journal UI preferences are persisted separately through the existing Player preference record, so browsing an older page never mutates the current block. Legacy cookie sessions use a local reading-state fallback only and do not change canonical progress.

SSE remains the only live transport. Replayed event sequences refresh canonical state but do not replay already acknowledged visual triggers. A newly released current block physically turns the journal only when the Player is following live progress; otherwise the journal announces new content and offers a Return to Current Objective action.

No AR/Vision Waypoint Phase B1 documents or implementation files are part of this change. The two pre-existing untracked Phase B PDFs are protected parallel work and must not be edited, staged, or committed by this task.

## Completion report

### 1. Summary

Cards remain the browse/select surface in `/player/library`. Once a playthrough is active, paused, resumed, or completed, the Player enters one immersive physical journal backed by the real version-pinned session, reveal ledger, event stream, and Creator-authored published snapshot. The old runtime card and standalone archive components were removed only after the new route passed the full release gate.

### 2. Journal code found

The reusable book work originated in:

- `src/components/player/workspace/JournalWorkspace.tsx`
- `src/components/animation/PageFlipBook.tsx`
- `src/animation/journal/page-model.ts`
- `src/animation/journal/opening-machine.ts`
- `src/styles/player.css`

### 3. Routes changed

- Added `/player/playthroughs/[playthroughId]/journal` as the durable-identity canonical route.
- Kept `/play/[taleSlug]/session/[sessionId]` as a compatibility entry that renders the same journal.
- Changed `/player/playthroughs/[playthroughId]/archive` to redirect to the journal.
- Changed library/waiting-room destinations so launched and completed playthroughs enter the journal.

### 4. Components created

- `PhysicalJournalBook.tsx`: shared physical cover, binding, page stacks, latch, seal, tabs, and PageFlipBook frame.
- `TallTaleJournalSession.tsx`: canonical live/resume/historical shell, opening phases, SSE reconciliation, persistence, actions, drawers, announcements, and recovery UI.
- `TallTaleJournalPage.tsx`: parchment-native renderer for the ten Player journal modes.

### 5. Components reused

`PageFlipBook`, its semantic reduced-motion fallback, the existing opening-state vocabulary, the campaign journal's physical CSS/material language, the Studio block registry/published snapshot, the Tall Tale progression engine, the Player Library/lobby flow, and the authenticated SSE route remain authoritative and shared.

### 6. Components retired

The unused `src/components/tales/PlayerRuntime.tsx` centered-card runtime and `src/components/platform/VoyageArchive.tsx` list archive were deleted after validation. `PublishedBlockView` remains only as a Studio preview surface.

### 7. Database changes

No schema or migration was needed. Reading position and UI preferences use the existing `PlayerProfile.preferences` JSON without modifying `TaleSession`. Canonical progress continues to use the existing platform migration `20260718020000_tall_tale_platform` (MySQL `0004_tall_tale_platform`); this task adds no migration name.

### 8. API changes

Added `GET`/`POST /api/player/playthroughs/[playthroughId]/journal-state` with membership authorization, CSRF on writes, rate limiting, validation, and preference-preserving persistence. The existing session API now emits a recursively sanitized `journal` projection containing only released Player-readable content and exact edition metadata.

### 9. Session event changes

No competing event channel or event taxonomy was added. Existing ordered events and authenticated SSE replay remain the transport. Progression now marks a completed block in `RevealState` and projects relevant entered/completed/hint events for page history. Client processing tracks the maximum canonical sequence and deduplicates refresh/visual effects.

### 10. Content block support

The contract covers story, riddle, map, artifact, decision, objective, location verification, message, cinematic, and chapter-complete modes. All visible Creator registry blocks map into one of these modes; condition and variable blocks stay nonvisual. Presentation metadata supports spread, page-turn, paper, and ink choices while content remains canonical in Creator data.

### 11. Captain synchronization

Captain and helper actions still enter `src/tall-tale/progression.ts`. Persisted state/events arrive over the existing SSE endpoint. When the Player is following live progress, a new current block turns the physical book; when reading history, the page is preserved and a live-content notice plus Return to Current Objective action appears. Reconnect starts after the last processed sequence and refreshes canonical state.

### 12. Historical mode

Completed playthroughs reopen the same physical journal from the session's pinned immutable `PublishedTaleVersion`. Released pages, visited decisions, completion time, version label, and checksum remain available. Actions are disabled and the session cannot mutate.

### 13. Responsive behavior

Desktop emphasizes the open book with secondary contextual drawers. Medium widths compact the frame while retaining spreads. Narrow portrait and short landscape use a single readable sheet, safe-area-aware bottom tools, touch-safe actions, and a persistent current-objective return. CSS uses width/height/orientation capabilities, not user-agent detection.

### 14. Accessibility behavior

The journal provides semantic headings/regions, keyboard page navigation, visible focus states, Escape-to-close drawers, labels for icon-like controls, status/live announcements, text scaling, transcripts/captions when authored, reduced-motion/direct-opening behavior, and the existing semantic non-curl reader.

### 15. Tests added or expanded

- `src/tall-tale/journal-contract.test.ts`: all visible registry mappings, recursive secret filtering, released hints/choices, presentation normalization.
- `src/tall-tale/journal-page-model.test.ts`: stable leaves/parity/spreads, separate reading restoration, historical projection.
- `src/components/animation/PageFlipBook.test.tsx`: same-ID revision refresh, locked/queued turns, left/right geometry.
- `tests/e2e/tall-tale-platform.spec.ts`: canonical journal entry, Player-safe projection, separate reading persistence, completed library route, read-only historical edition/checksum.

### 16-18. Tests, build, and lint results

Commands run:

```powershell
npx prettier --write <task-scoped files>
npx eslint <task-scoped files>
npx vitest run src/tall-tale/journal-contract.test.ts src/tall-tale/journal-page-model.test.ts src/components/animation/PageFlipBook.test.tsx --reporter=verbose
npm run lint
npm run typecheck
npm run validate
```

Results: focused journal coverage passed 3 files/15 tests. The isolated release gate passed formatting, ESLint, TypeScript, animation assets, database/backfill invariants, 27 Vitest files/90 tests, 21 Playwright tests with 7 intentional WebKit mutation skips, the optimized Next.js build, and two production restart proofs. Validation artifacts are at `%LOCALAPPDATA%\ForeverTreasureCompanion\validation\artifacts\validation`.

### 19. Known limitations

- Legacy opaque-cookie sessions have no durable Player profile, so reading-only position/preferences use local storage; canonical story progress remains server-persisted.
- Real camera/vision matching is intentionally not implemented. The journal already consumes provider-agnostic verification outcomes through the existing helper/progression boundary.
- Author-specific visual differentiation is optional; content without presentation metadata uses physical defaults and safe text alternatives.

### 20. Future recommended work

- Add stable visual-regression captures for the canonical journal's sealed, live spread, behind-live, mobile single-sheet, reconnecting, and completed states.
- Extend Studio preview to show the exact physical page composition for presentation choices.
- When the external vision provider is ready, integrate it only at the existing versioned verification envelope and retain Captain override/audit behavior.

## Exact task file paths

Created:

- `Development_Docs/Canonical_Player_Journal_Implementation_Record.md`
- `src/app/api/player/playthroughs/[playthroughId]/journal-state/route.ts`
- `src/app/player/playthroughs/[playthroughId]/journal/page.tsx`
- `src/components/player/journal/PhysicalJournalBook.tsx`
- `src/components/player/journal/TallTaleJournalPage.tsx`
- `src/components/player/journal/TallTaleJournalSession.tsx`
- `src/tall-tale/journal-contract.ts`
- `src/tall-tale/journal-contract.test.ts`
- `src/tall-tale/journal-page-model.ts`
- `src/tall-tale/journal-page-model.test.ts`

Modified:

- `docs/architecture.md`
- `docs/future-vision-helper.md`
- `docs/journal-system.md`
- `docs/responsive-behavior.md`
- `docs/tall-tale-platform.md`
- `docs/testing.md`
- `src/app/play/[taleSlug]/session/[sessionId]/page.tsx`
- `src/app/player/playthroughs/[playthroughId]/archive/page.tsx`
- `src/components/animation/PageFlipBook.tsx`
- `src/components/animation/PageFlipBook.test.tsx`
- `src/components/platform/PlayerVoyageRoom.tsx`
- `src/components/player/workspace/JournalWorkspace.tsx`
- `src/components/studio/TaleEditor.tsx`
- `src/platform/libraries.ts`
- `src/styles/tall-tale.css`
- `src/tall-tale/progression.ts`
- `src/tall-tale/studio-service.ts`
- `tests/e2e/tall-tale-platform.spec.ts`

Deleted:

- `src/components/platform/VoyageArchive.tsx`
- `src/components/tales/PlayerRuntime.tsx`

The protected parallel files `Development_Docs/phase_b_implementation_roadmap_v1_0.pdf` and `Development_Docs/vision_waypoint_external_ar_governing_specification_v1_0.pdf` are not task changes.

## Development commands

Use `npm run dev:full` for idempotent setup, migration, progress-preserving seed, and startup. Use `npm run dev:stop` to stop only the recorded process. `npm run dev` is the Next-only path after setup.

## Key state descriptions

- **Library:** grouped parchment cards with Continue/Resume/Open Completed Journal actions; cards remain selectors.
- **New entry:** closed leather cover, attached latch, intact seal, title/edition, then the opening ceremony and first spread.
- **Live session:** physical two-page parchment with current Creator-authored content, ink status, contextual chapter/map/artifact/message tools, and objective/action tray.
- **Reading behind live:** the viewed page does not jump; an announced new-content state and Return to Current Objective control appear.
- **Mobile:** one readable parchment sheet, compact header, safe-area bottom tools, and touch-safe actions.
- **Reconnect:** journal stays readable with a reconnection notice and canonical refresh after SSE recovery.
- **Completed:** the same book opens directly into historical reading with completion treatment, immutable edition/checksum, and no mutation controls.

**Final product rule:** The library helps the Player choose an adventure. The journal is the adventure.
