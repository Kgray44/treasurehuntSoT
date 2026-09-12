---
title: Muster Refit Iteration 1 Focused Proof
audience: product-engineering
status: current
canonical_for: voyagewright-refit-v1-muster-iteration-1-proof
last_reviewed: 2026-09-12
---

# Muster iteration 1 preview

The first implementation is ready for owner inspection. Treatment remains `MAJOR_STRATEGY_RETHINK`, lifecycle remains `IMPLEMENTATION_ITERATING`, and owner acceptance is absent. This is focused local development evidence, with no merge, release, final Sounding Line qualification, or next-area implementation.

Branch: `refit-v1/muster`. Worktree: `D:/CodexWorktrees/treasurehunt-refit-v1-muster`. Protected-main baseline: `a8b72f37`. Preview: <http://127.0.0.1:3128/captain/voyages/muster-all-ready/muster>. An authenticated synthetic Captain preview is left open in the Codex browser.

## Implemented areas

Captain and Player entry routes share one role-aware room. The supplied lantern room, teal crew cards, real Crew Chat, inset Chronicle cover, tall parchment, readiness display and exact bottom-center quote follow the [design packet](design-packet.md). The real global header remains intact. Mobile stacks the same illustrated, parchment and chat experience; tablet rebalances the panels.

The projection reads existing Voyage, membership, invitation, presence, Chronicle and Helm records. Captain authority is independent of Player participation. Commands reuse canonical APIs and confirmations. Launch remains permitted by the existing contract with at least one ready member when membership rows exist; the room truthfully reports how many are still preparing. A Captain-only room with no membership rows retains the canonical launch gate.

Crew Chat adds one persisted Voyage message model, matching SQLite/MySQL migration definitions, scoped read/send endpoints and metadata notifications on the existing Voyage event bus. Access checks require current joined membership or Captain authority, including a Captain who does not participate as a Player. Reads and writes reauthorize; mutation requests require CSRF. Messages are plain text, limited to 1,000 characters, with durable per-sender/Voyage rate limits, ordered recent history and retry idempotency. Browser reconciliation covers missed notifications and reconnection. The UI preserves older-message scroll position and displays new-message counts, pending sends and retry feedback.

## Focused evidence

All fixtures, sessions, databases, media and process output are local to this worktree's ignored `.runtime/muster` directory. The existing owner runtime on port 3000 and unrelated worktrees were preserved. Preview chat messages were actually sent through the new authenticated API/UI and persist in the task database; they are not hardcoded component examples.

The browser proof at `.runtime/muster/proof/focused-proof.json`, recorded 2026-09-12 at 08:26 UTC, passed 17 grouped checks:

| Area             | Observed result                                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role projections | Captain+Player counts 4/4; Player-only has Player wording and no Captain commands; Captain-only displays four cards but counts three Players; Captain-only with zero Players remains truthful. |
| Readiness        | All-ready and 2/4-ready projections display current data and preserve the canonical launch rule.                                                                                               |
| Chat             | Real Enter send, cross-client receipt, reload persistence, empty state, Shift+Enter newline, plain-text HTML, length rejection and retry idempotency passed.                                   |
| Chat continuity  | Older-message scroll stayed in place; unread indication, jump to latest and offline/reconnect passed.                                                                                          |
| Authorization    | Anonymous, outsider, departed-member and missing-CSRF requests were rejected; durable rate limiting returned 429.                                                                              |
| Lifecycle        | Confirmed canonical launch produced ACTIVE; relinquishment produced vacant captaincy/Succession Hold and updated viewer authority.                                                             |
| Images           | Authorized canonical Chronicle cover returned PNG; a different Chronicle with no cover used the supplied island fallback.                                                                      |
| Responsive       | 1536 × 1024 desktop, 1024 × 900 tablet and 390 × 844 mobile screenshots inspected; no horizontal overflow or overlap between main panels.                                                      |
| Motion           | Browser reduced-motion proof disabled scene animation with the complete static composition preserved. The shared component also passes the product motion hook's reduced mode to the scene.    |
| Runtime          | Zero browser page errors during the focused pass.                                                                                                                                              |

Local rendered evidence: `.runtime/muster/proof/desktop.png`, `player.png`, `captain-only.png`, `not-all-ready.png`, `tablet.png`, `mobile.png` and `reduced-motion.png`. The component suite additionally checks role changes, confirmation boundaries, queued reconciliation, terminal revocation during an outstanding response, single authoritative journal handoff, and failed-send draft retention with a stable retry identifier.

## Asset wiring and remaining visual delta

The original attachments are in `C:/Users/kkids/.codex/attachments/bef77338-0755-4e5c-a20b-c2107f987955`. Unedited copies of image-1, image-2 and image-4 are wired as `public/images/muster/lantern-room.png`, `moonlit-island.png` and `parchment.png`. Image-3 is the owner-approved composition reference. The island is registered as the canonical development Forever Treasure cover, with a guarded seed helper that preserves unrelated existing covers and immutable published editions. The same artwork is the no-cover fallback.

The supplied blank parchment has an opaque rectangular background. A separate decorative layer with an organic CSS silhouette approximates its paper edges; this is the small remaining visual mismatch. It can be replaced with a transparent parchment asset without changing content layout. Crew photographs appear only when an authorized real profile image exists; missing images use initials. The quote, rules and compass ornament remain live decorative markup.

## Validation boundaries

The original SQLite migration chain was rehearsed into a separate task database. Prisma then rejected a legacy `CHAR(64)` profile-media field during fixture preparation. That database is retained as `.runtime/muster/migration-rehearsal.sqlite`; the working synthetic preview database was initialized from the current SQLite Prisma schema. This is a local fixture compatibility boundary, not a production migration certification. MySQL execution is deferred.

Next development startup reports existing Edge-instrumentation warnings about Node modules imported by `src/audit/runtime.ts`; no browser runtime errors were observed. No unrelated instrumentation change was made.

Validation passed: `npx tsc --noEmit`; ESLint over all changed Muster source and development helpers; 16 component tests across three files; MySQL Prisma schema validation; `npm run docs:index`; `npm run docs:validate`; `npm run features:sync`; `npm run features:validate`; and `git diff --check`. No feature-catalog fragment or generated catalog content changed. Broad product/Sounding Line acceptance remains deferred until owner acceptance.

## Documentation disposition

| Document                                                      | Classification and disposition                                                                           |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Muster design packet and this proof                           | Current human engineering evidence under `Development_Docs`; frontmatter and Refit navigation supplied.  |
| Refit README and registry                                     | Current project navigation and machine-readable control record; Muster remains iterating and unaccepted. |
| `.agents/refit-muster.md`                                     | Active automation guidance with task ownership, fixture and preview continuation boundaries.             |
| Product features, current status and feature-status reference | Current human product documentation; preview availability and acceptance boundary recorded.              |
| Captain and Player guides                                     | Current human guides; role-aware preview behavior and Crew Chat described.                               |
| Changelog                                                     | Current human change record; candidate-only first implementation entry.                                  |

Feature-catalog decision: no owning fragment changes in this iteration. The catalog excludes partial or unaccepted branch work; this preview does not declare a completed or generally available capability.
