---
title: Muster Refit Iteration Delta 2
audience: product-engineering
status: current
canonical_for: voyagewright-refit-v1-muster-iteration-2
last_reviewed: 2026-09-12
---

# Muster iteration delta 2

## Identity and preserved scope

- Design packet: [Muster](design-packet.md); registry ID: `muster`.
- Candidate: `refit-v1/muster`, continuing iteration 1 at `21c8d199` in `D:/CodexWorktrees/treasurehunt-refit-v1-muster`.
- Owner direction: `C:/Users/kkids/.codex/attachments/0f70a42b-3a95-4bfa-86ea-695c45874eb3/goal-objective.md`, 2026-09-12.
- Resulting lifecycle: `IMPLEMENTATION_ITERATING`. Owner acceptance remains absent.

Preserve the approved composition, crew and invited-member behavior, chat, role authority, parchment, cover treatment, quote/ornament, responsive layout, all existing functions and every existing review Voyage. This delta changes only the named disclosure, background anchoring, invitation action card and Chronicle-source corrections. No merge, final broad acceptance or next Refit area.

## Implementation

`MusterOptions` replaces the abrupt native disclosure with a semantic button/region pair. The button retains Enter/Space behavior, `aria-expanded` and `aria-controls`; the closed region is inert and hidden from assistive technology. A `ResizeObserver` measures the content's intrinsic height, and the existing Motion engine interpolates the actual panel height over 280 ms using Lanternwake's layout easing, `cubic-bezier(0.22, 1, 0.36, 1)`. New content and responsive text wrapping retarget the measurement. Controls fade and settle by four pixels; the indicator rotates smoothly. Reduced motion uses immediate intrinsic height, no spatial movement and a 60 ms opacity change. The scene is scoped to Muster.

The original artwork was the background of the content-sized `.muster-scene`; growing the parchment therefore changed `cover` scaling. It now belongs to `.muster-environment`, a fixed, pointer-inert layer anchored below the real sticky header. Its width is `100vw`; its height is derived only from the stable viewport and the existing responsive stage minimum, never from content height. The room and ambient glow share this stable coordinate system. UI remains in its existing flow above the artwork. Desktop uses centered cover; tablet and mobile retain deliberate breakpoint crops. Scrollbar removal for dialogs cannot change the artwork's width.

The dashed final card is a single **Invite Crew** link with a plus and **Send another invitation** caption. It retains the established Captain Library destination. The server projection supplies `viewer.canInvite` from current Captain authority, active Captain workspace, a published edition and a nonterminal Voyage. Ordinary Players and terminal Voyages do not see the action card. Real invited people remain separate membership cards.

## Parchment field audit

Let `V` be the authorized canonical `TaleSession`, `E = V.version` selected by `V.publishedVersionId`, and `S = parsePublishedSnapshot(E.contentSnapshot).tale`. The shared `musterChronicleIdentity` selector returns `S` whenever an edition exists. Explicit null values stay null; they are not filled from a newer Chronicle draft. Only a Voyage with no published edition uses the canonical `V.tale` fields.

| Visible field                   | Exact canonical source and display rule                                                                                                                                                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chronicle image                 | `S.coverAssetId`; the authorized cover endpoint checks the asset belongs to `V.taleId`, then calls `resolveAssetVariant(assetId, "PREVIEW", V.publishedVersionId)`, limiting variants to that edition's snapshot. The supplied island is the absent-cover fallback.                                                                |
| Chronicle title                 | `S.title` → `projection.voyage.title`.                                                                                                                                                                                                                                                                                             |
| Subtitle/tagline                | `S.subtitle` → `projection.voyage.subtitle`; omitted when null.                                                                                                                                                                                                                                                                    |
| Overview                        | `S.shortDescription` → `projection.voyage.description`; omitted when null.                                                                                                                                                                                                                                                         |
| Edition                         | `E.versionLabel`, from the exact published edition used by this Voyage; `Unpublished` only when no edition exists.                                                                                                                                                                                                                 |
| Voyage State                    | `V.status` plus `V.captainAuthorityState`. `stateName` maps INVITING/READY/SCHEDULED to the established “Crew Muster” label and vacant authority to “Succession Hold”; other lifecycle states are humanized. These are state-dependent labels, not a fixed mockup value.                                                           |
| Captain                         | `V.captainAccount.profile.displayName` under current authority, with existing canonical member-profile/legacy username fallbacks; vacant authority displays “Captaincy vacant”.                                                                                                                                                    |
| Estimated Duration              | `S.estimatedDuration`, the existing canonical Chronicle metadata field in minutes. Omitted when null; displayed in minutes below an hour or rounded estimated hours otherwise. No new duration model was needed.                                                                                                                   |
| Readiness count/progress        | Canonical `V.memberships`: total statuses INVITED/ACCEPTED/READY/ACTIVE_MEMBER; ready statuses READY/ACTIVE_MEMBER. A Captain-only display card adds no Player to either count.                                                                                                                                                    |
| Readiness message               | `readinessCopy(projection)` combines actual lifecycle, authority, ready/total counts and `viewer.isCaptain`. Terminal states now say the Voyage has ended.                                                                                                                                                                         |
| Primary action state/text       | Actual lifecycle plus `viewer.isCaptain`, `viewer.canLaunch` and `viewer.runtimeHref`; the launch gate reuses published edition, active Captain workspace and the existing at-least-one-ready rule when membership rows exist. Active access opens the Voyage/Console; waiting, vacant and terminal cases have corresponding text. |
| Planned departure, when present | `V.plannedStartAt`, formatted in the viewer's local time.                                                                                                                                                                                                                                                                          |

The audit corrected two source leaks: optional snapshot nulls formerly fell through to draft values, and the cover formerly preferred the mutable Chronicle and unrestricted latest variants. Title, edition, Captain, duration and readiness are not hardcoded display examples.

## Preserved fixture matrix and owner routes

All data stays in the existing task-owned `.runtime/muster/muster.sqlite`; no shared or real application database is involved. Preparation recorded and compared hashes for every prior Voyage with its memberships, invitations, edition and chat. Nine existing Voyages were preserved, including earlier focused-proof states. No fixture reset or chat seeding was performed.

One separate fixture, **The Tidal Observatory**, was added with its own published edition 2.3, 95-minute metadata, a distinct cover, one real invited Sera card and preparing crew. Its working Chronicle deliberately has different draft metadata and cover, making snapshot leakage directly testable. Existing fixtures were not repurposed.

| Review state                                           | URL                                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Captain + Player, all ready, populated chat            | <http://127.0.0.1:3128/captain/voyages/muster-all-ready/muster>             |
| Preparing crew, empty chat                             | <http://127.0.0.1:3128/captain/voyages/muster-preparing/muster>             |
| Captain only, three participating Players              | <http://127.0.0.1:3128/captain/voyages/muster-captain-only/muster>          |
| Captain only, no Players                               | <http://127.0.0.1:3128/captain/voyages/muster-captain-empty/muster>         |
| The Tidal Observatory, edition 2.3, invitation pending | <http://127.0.0.1:3128/captain/voyages/muster-tidal-observatory/muster>     |
| Beyond the Blue Horizon, fallback cover                | <http://127.0.0.1:3128/captain/voyages/muster-fallback/muster>              |
| Retained cancelled lifecycle fixture                   | <http://127.0.0.1:3128/captain/voyages/muster-proof-launch-0239777b/muster> |
| Player-only entry with the Sera fixture account        | <http://127.0.0.1:3128/player/playthroughs/muster-all-ready>                |

## Focused proof and documentation disposition

Local evidence is under `.runtime/muster/delta2`: fixture preservation hashes, frame-by-frame height/indicator samples, parchment source comparison and desktop/tablet/mobile screenshots. Tests cover repeated open/close, dynamic content height, keyboard/assistive semantics, reduced motion, exact stable artwork pixels, dialog/menu anchoring, invitation authorization, retained invited cards and two different published Chronicle projections. Ambient luminance is paused for pixel comparison. Responsive pixel comparisons isolate artwork paint without changing UI layout because moving panel shadows reach the sample strip; full UI screenshots are inspected separately.

The source and component suites cover published-null preservation and role/action boundaries. TypeScript, changed-source lint and required documentation/catalog checks accompany this focused proof. Final broad Refit/Sounding Line acceptance is deferred.

This delta is a current human engineering record under `Development_Docs`, indexed through the Refit README and design packet. Active continuation guidance remains in `.agents/refit-muster.md`. Product features, current status, feature-status reference, Captain/Player guides and changelog were reviewed; current product/status/reference/changelog and Captain guide wording were updated. The Player guide remains accurate. All materially changed human documents have current frontmatter; the registry and generated index are machine-readable records. No catalog fragment changes: these are corrections and local polish on an unaccepted candidate.
