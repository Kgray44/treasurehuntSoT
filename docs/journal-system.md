# Journal system

## Governing Player rule

**The Player Library is the place where Chronicles are browsed. The immersive journal is the place where Chronicles are played.** Cards remain selectors in `/player/library`; they do not become the live story surface.

### Phase 3 opening and PageFlip readiness

Journal opening profiles are first/full, returning/abbreviated, completed/archive, manual full replay, and reduced. Completed/archive is quiet and does not create a false live-stream expectation. Skip, motion change, recoverable interruption, timeout, or asset/runtime failure must converge on equivalent readable content; only route unmount performs cleanup without claiming readiness.

`JOURNAL_READY` is a verified handoff, not the end of a cover animation. The `JournalReadyReceipt` requires the PageFlip runtime or static fallback to be ready, the current page identity to be valid, the interface/objective controls to be reachable, focus to have an eligible destination, and the fallback/readability result to be truthful. A readiness timeout or probe failure calls `forceReadableFallback(reason)` before the session can report a readable ready state.

Page turns emit `turn-start`, `turn-commit`, `turn-settle`, `turn-cancel`, and `turn-failed` with book/mount identity and current boundary generation. A queued turn rebases against the current page/generation when dispatched, while a same-page request cancels as a no-op. The fallback abandons the failed PageFlip runtime and renders the current semantic page without assigning curl ownership elsewhere. Session-identity changes reset session-scoped opening, cursor, page, and callback state; access revocation is terminal for that identity.

Published playthroughs use one physical journal renderer at `/player/playthroughs/[playthroughId]/journal`. The legacy token route renders that same component, and the old archive route redirects to it. Active, paused, resumed, and completed playthroughs therefore share one visual and interaction model. The original campaign journal and the published Chronicle journal also share `PhysicalJournalBook` and `PageFlipBook`, preserving the cover, attached latch, seal, binding, left/right page geometry, page stacks, page curl, reduced-motion reader, and responsive transformations.

`journal-contract.ts` is the Player presentation boundary. Its typed modes are story, riddle, map, artifact, decision, objective, location verification, message, cinematic, and chapter complete. A small optional presentation object selects spread mode, page-turn behavior, and paper/ink treatment without duplicating story content. The recursive Player projection removes answer keys, solutions, Captain/Creator notes, condition expressions, future branches, private consequences, and unreleased hints before the renderer sees them. Logic-only condition and variable blocks remain in canonical progression but do not become readable leaves.

`journal-page-model.ts` builds stable title, edition, chapter, block, and endpaper pages from the released projection. Current progress remains in the version-pinned `TaleSession`, `RevealState`, inventory, verification records, and ordered events. Per-Player reading position, drawer, text scale, and presentation preferences are stored separately in `PlayerProfile.preferences`; moving through older pages never moves the story. Completed journals use the same released pages from the pinned immutable edition, disable mutations, and retain the checksum/edition record.

The existing authenticated SSE endpoint is the single live transport. Reconnect resumes after the last processed sequence, duplicate or stale events only refresh canonical state, and a newly released block turns the physical journal only while the reader is following live progress. Otherwise the journal announces new content and exposes Return to Current Objective. Captain-driven changes and helper verification enter through the progression engine, never through a second journal state machine.

The canonical durable journal continues to use its own `ChronicleJournalSession`; the compatibility `/tale/[campaignSlug]` progression host is not implied to exist there. Shared opening, PageFlip lifecycle, focus, fallback, and access-revocation behavior are reused without creating a second business-state engine.

The book is dominant on desktop, becomes a compact two-page layout at medium widths, and becomes one readable parchment sheet with bottom drawers and a persistent objective control on narrow or short-landscape screens. Page-turn controls, chapter tabs, drawers, actions, text scaling, Escape, Arrow/Page keys, live announcements, focus-visible states, and reduced-motion behavior remain keyboard and assistive-technology accessible.

## Original campaign journal

Chapters use `LOCKED`, `TEASER`, `READY`, `REVEALING`, `ACTIVE`, `SOLVED`, and `COMPLETE`. Locked/ready chapters serialize only ordinal, state, and an explicitly safe teaser. Narrative, objective, clue, released hints, annotations, and cross-links serialize only for readable states.

Hints are ordered records with a nullable release time. The server omits unreleased hints. Viewed state uses the player access identity and stable content keys, so it reconciles across devices that share the invitation identity. Annotations are released `JournalEntry` records and never include GM audit metadata.

`buildJournalPages` converts only the sanitized public snapshot into stable physical page IDs: hard covers, endpapers, title/dedication, chapter dividers, readable narrative/objective/riddle leaves, sealed locked leaves, and back matter. StPageFlip receives selectable semantic HTML, updates its existing instance with `updateFromHtml`, preserves safe current indices, emits orientation/page events, and is destroyed on unmount. Keyboard buttons and Arrow/Page keys turn pages. Reduced motion renders the same page model without page curl.

To add a page type, extend the discriminated page model and its secret-filtering/index-stability tests, render one semantic copy in `JournalWorkspace`, and keep its ID based on stable public keys. See `docs/animation/architecture.md`.
