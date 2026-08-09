---
title: Project Wakebook Phase 1 Current History Audit
audience: product-engineering
status: current
canonical_for: project-wakebook-phase-1-current-history-audit
last_reviewed: 2026-08-09
---

# Project Wakebook Phase 1 current history audit

## Audit baseline

This one-time audit was completed before product-source modification against accepted `origin/main` `273fb5255ad222812530422e902db04c0ddd1961`. It covers the current Prisma schemas and migration families, Wayfarer materialization and mutations, Passport pages/APIs/navigation, Feature Catalog, Homeport route/screen/journey records, and Sounding Line registration.

## Durable history census

| Concept                              | Canonical owner and source               | Durable/current facts                                                                                                                                                                                                | Wakebook Phase 1 use                                                                                             |
| ------------------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `PlayerChronicleRecord`              | Wayfarer; one row per profile/Voyage     | Source membership/Voyage, exact version ID/checksum, historical title/cover/Creator/player snapshots, role, lifecycle/outcome, timestamps, versioned timing, serialized safe summaries, fingerprint/projection state | Primary played-Voyage record; no duplicate table                                                                 |
| `PlayerChronicleParticipantSnapshot` | Wayfarer                                 | Historical display name/avatar alt, participation/crew role, join/complete/remove dates, eligibility/tombstone                                                                                                       | Owner-safe crew preview and detail                                                                               |
| `ChronicleReflection`                | Wayfarer owner annotation                | Favorite references and private note                                                                                                                                                                                 | Detail only; never card payload                                                                                  |
| `ChronicleMemory`                    | Wayfarer owner annotation                | Private title/body/reference, visibility, soft delete                                                                                                                                                                | Count on cards; full active owner records on detail; mutation preserved                                          |
| `VoyageKeepsake`                     | Wayfarer remembrance                     | Private generated payload, status, generation dates                                                                                                                                                                  | Presence/status on card/detail; generation preserved                                                             |
| `VoyageKeepsakeConsent`              | Wayfarer consent                         | Participant, scope, state, decision/grant/revoke dates                                                                                                                                                               | Existing mutation and redaction semantics preserved                                                              |
| `PlaythroughMembership`              | One Voyage / Wayfarer identity seam      | Player, role, crew role, lifecycle dates, `pinnedAt`, `hiddenAt`, participation alias                                                                                                                                | Materialization source; pin/hide are not copied into history and Phase 1 does not invent replacement persistence |
| `TaleSession`                        | One Voyage                               | Exact version, lifecycle, start/completion and runtime state                                                                                                                                                         | Materializer source only; Wakebook read operations never mutate it                                               |
| `TaleSessionEvent`                   | One Voyage                               | Runtime event sequence/payload                                                                                                                                                                                       | Materializer reads a whitelist; Wakebook never serializes or queries raw events for UI                           |
| `PublishedTaleVersion`               | Chronicle publishing / One Voyage source | Stable ID, label, checksum, immutable content snapshot                                                                                                                                                               | Exact edition identity and historical cover resolution                                                           |
| `Invitation`                         | One Voyage invitation lifecycle          | Intended player, lifecycle dates, replacement chain; credentials also exist but are forbidden                                                                                                                        | Separate bounded invitation history without secrets or played statistics                                         |
| `ArtifactGrantReceipt`               | Wayfarer Artifact Cabinet                | Immutable grant provenance                                                                                                                                                                                           | Artifact-boundary contract; not a card ownership shortcut                                                        |
| `PlayerArtifactRecord`               | Wayfarer Artifact Cabinet                | Owner, source Voyage/event/version, historical label, recipient/ownership/custody/status and dates                                                                                                                   | Canonical personal artifact context and Cabinet link                                                             |
| `PlayerAchievement`                  | Wayfarer Artifact Cabinet                | Versioned achievement evidence and private visibility                                                                                                                                                                | Audited; Phase 1 does not expand achievement presentation beyond existing surfaces                               |

SQLite and MySQL contain equivalent Wayfarer history, participant-consent, artifact, and Homeport participation-alias migrations. No later migration adds a missing durable Phase 1 archive concept. The schema decision is `NONE`.

## Materialization revalidation

`materializeChronicleHistory(playerProfileId)` remains the only history projector. It:

1. reads the owner's canonical memberships, TaleSession, exact version, safe events, and participants;
2. rejects missing/invalid published snapshots as projection failures;
3. derives lifecycle, personal wall-clock timing, completed chapters, unavailable choices/objectives, shared Voyage artifact summaries, and safe generic outcome;
4. hashes membership/session/version/event/participant sources;
5. skips an unchanged fingerprint;
6. upserts the rebuildable record while preserving title/cover/Creator/player snapshots after creation;
7. creates participant snapshots idempotently and intentionally does not overwrite them;
8. changes no One Voyage business row.

Exact gaps relevant to Wakebook presentation:

- the current list uses one broad include containing Reflection, full active Memory bodies, full crew, Keepsake consent, and Community release relations;
- the list DTO omits published-version ID and human version label;
- current pagination and sorting are not based on the required archive-date precedence;
- only title search and unvalidated status filtering exist;
- no accurate year-group summaries exist;
- invitation items are returned separately but use the page limit independently and are filtered only against the fetched played page;
- raw lifecycle/role/outcome values reach current UI;
- current cover snapshot is an asset identifier, not an owner-safe media reference;
- the materializer's `COMPLETED:<block-id>` is safe stored provenance but must never be rendered directly;
- detailed choice/optional-objective evidence is deliberately unavailable and must remain so.

These are Wakebook read/presentation gaps, not reasons to create a second materializer.

## Current UI and navigation

`/passport` is a distinct Chronicle Passport overview inside Personal Harbor. `/passport/history` is naturally reachable through the visible `History` section on desktop and mobile. `/passport/history/[recordId]` is reached from each history item and has a parent return.

The current history list is functional but skeletal: a search field, flat ordered list, raw lifecycle badge, title/date, counts, and open/review actions. It has no cover, archive identity, year grouping, useful filters/sort, quality-aware timing, crew preview, exact edition label, safe outcome presentation, or large-archive UX.

The current detail is a large engineering-form composition. It exposes raw outcome/role/status vocabulary, a minimal version-pinned section, Reflection and Memory forms, Keepsake actions, and no polished Journey Summary, Crew, Artifact, or Edition sections. Existing mutation behavior is accepted and must remain reachable.

The Homeport route, screen, and journey catalogs already prove ordinary History reachability, but their current screen contracts describe the pre-Wakebook UI. Phase 1 must update the existing records and add the new owner read/cover API routes without creating a second global navigation system.

## Current API and security

- `GET /api/passport/history` authenticates with canonical Wayfarer AccountSession, materializes, and returns broad owner records plus separate invitation items.
- `GET /api/passport/history/:recordId` uses an owner predicate and returns neutral 404 for foreign IDs.
- Reflection, Memory, Keepsake, and consent mutations use current AccountSession/CSRF checks and bounded Zod input where implemented.
- Existing foreign-detail and foreign-mutation tests cover important IDOR paths.

Phase 1 keeps those routes compatible and introduces purpose-specific owner read DTOs. The browser will no longer need full Memory bodies or consent relations to render cards.

## Current verification control plane

Sounding Line currently owns the critical `wayfarer-history-projection` contract through `unit.wayfarer`, `component.passport`, and `browser.passport`, plus Homeport history owner/version/empty-state contracts and visible-route journeys. Wakebook requires its own program ownership, affected paths, suites, contract registrations, and browser journey while retaining these inherited dependencies.

## Audit conclusion

Accepted history is substantially complete and historically stable. Phase 1 is a schema-free service/query and product-experience realization. The correct implementation is a bounded Wakebook summary/detail layer over Wayfarer records, not a data migration or projector rewrite.

## Final accepted-main revalidation

The audit conclusion was rechecked after semantic reconciliation through accepted `origin/main` `468530645e983412e5f4c1aaa103915be77c9c07`. Later Deepwater, Tideglass, Admiralty, Drydock, Feature Catalog, Homeport catalog, Sounding Line, and documentation work did not add a competing history projector or change the canonical One Voyage, Wayfarer, AccountSession, Artifact Cabinet, or remembrance authorities above. Drydock strengthens the accepted Story Block authoring/runtime contract without becoming history authority. Wakebook remains a bounded owner-private projection and presentation layer with no schema change.
