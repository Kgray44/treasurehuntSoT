---
title: Project Homeport Phase 4 Community Harbor Architecture
audience: product-engineering
status: current
canonical_for: project-homeport-phase-4-community-harbor-architecture
last_reviewed: 2026-08-03
---

# Project Homeport Phase 4: Rebuild Community Harbor

## Status and source boundary

This record freezes Phase 4 before broad implementation. It is Project Homeport Phase 4, not Project Harborlight Phase 4. Harborlight remains the authority for Community persistence, lifecycle, privacy, search semantics, social truth, and moderation. Homeport owns the coherent public product that presents accepted Harborlight truth.

| Field                                | Frozen value                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| Worktree                             | `C:\Users\kkids\Documents\Codex_TreasureHunt-homeport`                         |
| Branch                               | `codex/project-homeport-product-reality-recovery`                              |
| Phase 4 starting SHA                 | `bb6dc6fab09e0cbf391511f4516999a5e3d03376`                                     |
| Remote branch SHA at start           | `bb6dc6fab09e0cbf391511f4516999a5e3d03376`                                     |
| Fetched `origin/main` and merge base | `8d142227d712d27e363b15903dba9b0c99a04bc8`                                     |
| Starting divergence                  | Homeport 19 ahead, 0 behind `origin/main`; 0 ahead, 0 behind its remote branch |
| Canonical database SHA-256           | `DF33983556CF2C6FF01DF6084AE6619EC5DF5C99B11241FA88B4A88F8E144EEB`             |
| Schema decision                      | No schema or migration change                                                  |

No mainline commits exist after the recorded merge base. Phase 1 canonical identity, Phase 2 shell/navigation, and Phase 3 Personal Harbor remain invariant. This freeze does not establish implementation, test, merge, deployment, live-provider, owner-acceptance, or product-acceptance proof.

## Focused current-source census

| Capability             | Current authority                                                      | Current maturity and Phase 4 disposition                                                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Community route family | `src/app/community/**`                                                 | The canonical route family exists. Root, district, creator, collection, Guide, Voyage Log, listing, and privileged moderation routes are preserved. Community detail routes receive explicit source and return paths; moderation stays outside ordinary district navigation. |
| Root discovery         | `src/app/community/page.tsx`, `CommunityDiscoveryBrowser.tsx`          | Functional but form-first and visually skeletal. Replace with content-first shelves, then a compact search/result region. Default discovery and query results remain distinct.                                                                                               |
| District pages         | `PublicCommunitySection.tsx`                                           | Route headings exist, but most pages are generic lists or empty headings. Replace with one governed district shell, navigator, state contract, and typed card grid.                                                                                                          |
| Listings and lifecycle | `CommunityListing`, `CommunityRelease`, `services.ts`                  | Reuse persisted Harborlight truth. Enumeration requires `PUBLISHED`, `COMMUNITY` or `FEATURED`, `ACTIVE`, non-private-real-world records, with archived/removed/quarantined records excluded server-side.                                                                    |
| Search                 | `discovery.ts`, `/api/community/discover`                              | Accepted search/filter/sort semantics and stable cursors exist. Add an allowlisted Homeport result projection and human-readable URL state; do not return authorization fields to cards.                                                                                     |
| Discovery metadata     | `CommunityListingDiscoveryMetadata`, aggregates, editorial features    | Sufficient for duration, players, difficulty, environment, language, accessibility, free/remix, ratings, dates, and deterministic shelves. No schema change is justified.                                                                                                    |
| Creator profiles       | `CommunityProfile`, follow/block services                              | Persisted public creator truth exists. Add rich creator cards and public detail composition; keep account IDs and moderation evidence private.                                                                                                                               |
| Collections            | `CommunityCollection`, `CommunityCollectionItem`                       | Persisted collections exist. Detail must resolve eligible referenced subjects into public cards and omit ineligible references without explaining why.                                                                                                                       |
| Guides                 | `CommunityGuideContent`                                                | Published Guide truth exists. Shipwright's Workshop is frozen as a Guide category, not a redundant ordinary route.                                                                                                                                                           |
| Voyage Logs            | consent-aware Harborlight services/routes                              | Preserve the accepted public projection and present a supported district/card/detail contract. Never expose private locations or unconsented media.                                                                                                                          |
| Saved/social state     | `CommunitySave`, `CommunityCreatorFollow`, `community/social-state.ts` | Reuse server-owned state. Cards request one bounded batch, never one request per card. Anonymous actions preserve return state through sign-in; authenticated mutations expose pending, success, denial, and recoverable failure.                                            |
| Media                  | Harborlight public media bindings and Sealed Hold scanner receipts     | Phase 4 uses only accepted public media references; missing, pending, failed, quarantined, or unavailable media renders a governed typed fallback. No object key crosses the public DTO.                                                                                     |
| Animation              | Lanternwake scene ownership and `CommunitySceneCeremony`               | Route components retain placement and Lanternwake retains lifecycle. Motion is restrained; reduced motion renders semantic final state immediately.                                                                                                                          |
| Homeport control plane | Phase 0-3 inventories and additive updaters                            | Add Phase 4 records and dispositions idempotently. Preserve all historical evidence and prior-phase fields.                                                                                                                                                                  |
| Sounding Line          | generated registry, policy, planner, finalizer                         | Register every Phase 4 contract with stable ownership and isolated resources. Only finalizer `RELEASE_GO` is authoritative.                                                                                                                                                  |

### Current defects confirmed by source

- The Harbor root shows search controls before meaningful content.
- Six ordinary district routes are absent from the current Harbor navigator.
- `PublicCommunitySection` uses `TWO_D_ARTIFACT` and `THREE_D_ARTIFACT`, but Harborlight item types are `ARTIFACT_2D` and `ARTIFACT_3D`.
- The current discover endpoint serializes internal visibility, publication, moderation, and location lifecycle fields instead of a dedicated public card DTO.
- Generic district lists do not expose the accepted metadata needed for comparison or genuine typed card hierarchy.
- Creator and collection detail pages query persisted rows directly and need a common public-projection boundary.
- Existing mobile Phase 0 evidence captures severe horizontal displacement on root and no-results states.

## Frozen ownership

- Harborlight owns all Community writes, publication and moderation lifecycle, eligibility, search semantics, social truth, licensing, remix lineage, and installation.
- Homeport owns Harbor Home composition, district taxonomy and navigation, typed public cards, public detail composition, responsive state presentation, URL-state UX, and the Phase 4 fixture/evidence lane.
- Wayfarer owns account and public Profile identity truth; compatibility creator snapshots may be read only through safe Harborlight projections.
- One Voyage owns the canonical Begin/Continue Voyage handoff. Phase 4 may link only to an accepted current route and may not create a second runtime writer.
- Sealed Hold owns scan receipts, quarantine, protected storage, and safe derivative eligibility. Homeport never claims a live scanner or hosted object provider.
- Lanternwake owns scene lifecycle and motion policy. Homeport does not create another animation director.
- Sounding Line alone owns authoritative validation and `RELEASE_GO`.

## Frozen route and district taxonomy

The machine-readable district registry is authoritative for labels, routes, visibility, card compatibility, states, and desktop/mobile parity. The ordinary active family is Harbor Home, Featured, Chronicles, Artifacts, Templates, Maps and Location Packs, Audio and Reveal Assets, Creators, Collections, Guides, and Voyage Logs. Shipwright's Workshop is a supported Guide category within `/community/guides`; it is recorded as `REDIRECT_TO_PARENT` and is not counted as a separate active district. Moderation routes remain privileged contextual tools.

Every active district has the same product minimum: visible navigation with `aria-current`, heading and explanation, deterministic populated or intentional empty content, typed cards or meaningful alternate content, loading, error and dependency-unavailable recovery, parent/return paths, mobile layout, keyboard operation, and evidence.

## Public projection and card boundary

`HomeportCommunityCard` is the only list/search/shelf card DTO. Its base is frozen in `Project_Homeport_Phase_4_Public_Card_Contract.json`; typed variants may omit inapplicable metadata but may not add raw database rows. Server projection performs lifecycle, block, privacy, scan, and location eligibility before serialization.

The public DTO never contains account IDs, session/provider data, raw manifests, package checksums, object keys, storage paths, private Chronicle bodies, answers, private locations/coordinates, unconsented media, moderation evidence, quarantine reasons, reports, sanctions, or hidden lifecycle rows. Missing values are omitted; unknown duration is not zero and missing ratings are not zero stars.

## Content-first shelf strategy

Harbor Home renders deterministic server-owned shelves before search controls: editorially Featured, Recently launched, Recently updated, and Browse by district. A listing may appear on more than one truthfully labelled shelf; deduplication occurs only within each shelf. Editorial labels require an active `CommunityEditorialFeature`; computed shelves use explicit published or meaningful-update dates. An empty Community database renders a Harbor-wide empty state, never no-results language.

## Search, sort, and filter URL contract

Human-readable parameters are `q`, `sort`, repeatable `type`, repeatable `difficulty`, `duration`, `players`, repeatable `theme`, repeatable `environment`, repeatable `accessibility`, `free`, and `remixable`. Unknown or invalid values are ignored client-side and rejected safely at the API boundary. Changes use browser history; Back/Forward restores the exact committed result state. Default Harbor content is restored by clearing discovery parameters.

Compact controls contain search, sort, content type, and duration. Advanced filters use a native disclosure panel so focus and Escape behavior remain browser-standard; active filters render as removable chips and a plain-language summary. Stale requests are aborted and only the newest request may settle the visible result region.

## Detail and action contracts

Every card destination is genuine. Listing detail shows safe description, creator Profile, typed metadata, warning/spoiler treatment, license/remix truth, accepted action availability, social state, and a district-aware return. Creator, collection, Guide, and Voyage Log details use their own allowlisted projections. Ineligible direct entries return a non-revealing not-found state.

`CHRONICLE` primary action uses the accepted public Chronicle route when a public slug can be resolved; other install/remix actions are shown only when an accepted Harborlight authority exists. Unsupported actions are labelled unavailable and are not decorative buttons. Phase 4 never mutates `TaleSession` merely by opening Community content.

## State, responsive, accessibility, and motion contracts

The state vocabulary distinguishes default content, active results, no results, district empty, Harbor-wide empty, loading, dependency unavailable, partial media failure, restricted account, mutation pending/success/failure, archived/removed/unavailable detail, and not found. Failure copy states impact and next action without exposing internal causes.

Desktop and mobile expose the same active district IDs. Navigation may scroll horizontally or collapse into a labelled disclosure but may not remove destinations. Card grids recompose without horizontal page overflow at 390 pixels and 200 percent zoom. Semantic headings, labelled navigation/search/filters, visible focus, minimum touch targets, live mutation announcements, and non-color status cues are required. Reduced motion disables transitions and renders the settled state immediately.

## Fixture and validation isolation

The deterministic `homeport-phase4-synthetic-v1` fixture is created only in a task-owned SQLite copy and task-owned storage roots. It contains synthetic reserved identities and the required public, private, unlisted, quarantined, removed, archived, empty, failure, and relationship states. It commits no database, private content, credentials, real locations, real coordinates, copied riddles, answers, photographs, or object keys. Reset and checksum are deterministic.

The test plan owns one server, port, browser state, database, storage root, evidence root, traces, and cleanup receipt. Focused raw tools are diagnostic; subsystem and mainline Sounding Line finalizer decisions are the only release authority.

## Schema decision and phase boundary

Existing SQLite and MySQL schemas already contain the accepted Harborlight models required by Phase 4. No schema or migration change is permitted for presentation convenience. Phase 5 route convergence, Phase 6 whole-product state closure, Phase 7 final cross-product walkthrough fixture, merge to `main`, deployment, owner acceptance, and product acceptance remain out of scope.
