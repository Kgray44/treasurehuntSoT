---
title: Project Tideglass Phase 3 Design Record
audience: product-engineering
status: current-main-wakebook-reconciliation
canonical_for: project-tideglass-phase-3-design
last_reviewed: 2026-08-12
---

# Project Tideglass Phase 3 design record: Choose the Passage

Phase 3 creates the ordinary, discoverable **What Changed?** experience over the accepted Tideglass authority. It does not change the meaning of a Change Set, create a second edition/history store, or begin Phase 4.

## Frozen authority and baseline

| Item                                        | Frozen value                                                                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial implementation `origin/main` base   | `54e3d818d49d45282a9c419d562d4b5c78911ccd`                                                                                                                |
| Current reconciliation target `origin/main` | `9e9d629085cb1551b1a3959c31b0b460c37724a9`                                                                                                                |
| Dedicated branch                            | `codex/project-tideglass-phase3-choose-the-passage`                                                                                                       |
| Dedicated worktree                          | `C:\Users\kkids\Documents\treasurehuntSoT-tideglass-phase3-choose-the-passage`                                                                            |
| Wakebook reconciliation worktree            | `C:\Users\kkids\Documents\treasurehuntSoT-tideglass-phase3-wakebook-reconciliation` on `codex/project-tideglass-phase3-wakebook-reconciliation`           |
| Phase 2 status and ancestry                 | `ACCEPTED_MAINLINE`; integrated `3219fd1b5598d1997b7f85d641f2f3cb1fe3f1b3` is an ancestor of the reconciled current main                                  |
| Preserved semantic policies                 | `tideglass.semantic.v1`, `tideglass.policy.v1`, `tideglass.change-codes.v1`, `tideglass.projection.v1`, `tideglass.summary.v1`, `tideglass.annotation.v1` |
| Prisma and migrations                       | None. The existing immutable editions, annotation rows, and Wayfarer history records satisfy this phase.                                                  |
| Release authority                           | One explicit, exact-SHA `Sounding Line / Mainline Decision` only after candidate qualification, current-main reconciliation, and owner acceptance.        |

The governing order is the current repository rules, Global Product Governance Standard, Project Tideglass governing document, Continuous Development and Mainline Integration Standard, effective Sounding Line authority, accepted Phase 1/2 records, accepted cross-project contracts, and current source. The pasted Phase 3 authorization supersedes only the historical Phase 2 statement that Phase 3 was then unauthorized; it does not rewrite that receipt.

## Ownership and integration decisions

| Concern                                         | Decision                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Comparison semantics                            | Tideglass v1 service, classified Change Set, projection, and summary remain the sole authority. UI wording is presentation only.                                                                                                                                                           |
| Edition truth, availability, and recommendation | One Voyage/publishing remains authoritative. Phase 3 consumes the publishing-owned `isCurrent` selection used for new Voyage creation as the current comparison target; it never derives a target from publication dates or invents a richer replay recommendation.                        |
| Played anchor                                   | A Tideglass adapter reads an owner-checked `PlayerChronicleRecord` through Wayfarer. It uses the exact retained published-version ID/checksum and never persists or rewrites history.                                                                                                      |
| Multiple playthroughs                           | Separate record choices remain separate; Tideglass presents a chooser and does not deduplicate them.                                                                                                                                                                                       |
| Audience and spoiler disclosure                 | The server derives `PUBLIC_PREVIEW`, `PLAYER_SAFE`, or `CREATOR_FULL`; a client may narrow but never elevate. Disclosure only reveals data already present in the authorized DTO.                                                                                                          |
| Chronicle-detail entry                          | The public Chronicle detail gains a visible comparison entry, reached from Gateway -> Explore Chronicles -> Chronicle detail.                                                                                                                                                              |
| Personal-history entry                          | Passport history and record detail gain a visible `See what changed` action bound to their exact record.                                                                                                                                                                                   |
| Return context                                  | Only same-origin local paths from an allowlisted Tideglass/Chronicle/Passport/Studio set are retained. Malformed or external values fall back to the source surface.                                                                                                                       |
| Creator Studio                                  | The published-version `Compare` action consumes a narrow Tideglass `CREATOR_FULL` adapter. The raw snapshot comparator is removed from ordinary Studio product presentation.                                                                                                               |
| Legacy comparator / Deepwater finding           | The storage-oriented `comparePublishedVersions` implementation and its ordinary consumer are removed. Studio uses the canonical exact-edition Tideglass comparison and `CREATOR_FULL` semantic projection; the Deepwater finding can be updated only after complete consumer evidence.     |
| Wakebook                                        | Wakebook Phase 1 is accepted on current main. Its Journey Detail receives a Tideglass-owned, owner-safe comparison handoff only when the exact retained history anchor and Publishing-owned target resolve. Wakebook renders the handoff and does not compare editions or derive a target. |
| Shipwright                                      | Shipwright Phase 1 is accepted on the reconciled main. Tideglass preserves its accepted TaleEditor behavior and changes only the narrow semantic-comparison consumer.                                                                                                                      |
| Helm / Captain                                  | The reconciled Helm surfaces expose no accepted edition-comparison or preflight consumer. `CAPTAIN_UI_DEFERRED_NO_ACCEPTED_CONSUMER` remains the explicit Phase 4 handoff.                                                                                                                 |

## Product and route contract

The canonical ordinary route is `/chronicles/[taleSlug]/compare`. Its bounded query state may select an exact source/target edition, a Wayfarer history record, and a validated return path. Comparison mode, category filter, and expanded disclosure state remain local presentation state and are never persisted.

## Accepted Wakebook reconciliation

Wakebook Phase 1 reached accepted main in `cbf634d4d5db9cf47edebb89e005e8cc910068bd` after the original Phase 3
product merge. Its accepted Journey Detail supersedes the prior Passport-history detail, so the existing history handoff
must be preserved through the Wakebook surface before Phase 3 records can close.

The narrow adapter remains Tideglass-owned. It loads the canonical passage context using the signed-in player's profile,
selects the requested durable Wayfarer record by exact ID, consumes Publishing's current-edition pointer as the target,
and emits a same-origin comparison URL only for a `PAIR` or intentional `UP_TO_DATE` selection. A missing retained
edition, unavailable target, foreign record, or unpublished Chronicle produces no handoff. Wakebook receives only that
safe link/state and never receives semantic records, raw snapshots, cache entries, Creator context, or comparison
authorization inputs.

This reconciliation adds no Prisma change or migration. It preserves the existing `/passport/history/[recordId]/compare`
owner-checking redirect as defense in depth and returns from the comparison to the exact Journey Detail record.

## Reconciliation to current main

The current-main interval from `54e3d818d49d45282a9c419d562d4b5c78911ccd` to
`4edc8de5e30e9748700c19b466061f9b9a97f268` additionally includes accepted
Admiralty Phase 2 Chartroom work, its navigation and Sounding Line reconciliation
repairs, alongside accepted Helm operational work, Drydock Phase 3 Sea Trials,
Bridgewatch records, and generated catalog updates. The direct overlap was
Shipwright's accepted `TaleEditor`, shared Studio styles, changelog/status
documents, and generated Feature Catalog. The
reconciliation retained the accepted Drydock Studio import and editor behavior,
kept Tideglass's narrow `TideglassStudioComparison` consumer, retained both
truthful branch-status statements, and regenerated the catalog. It neither
consumes unmerged Wakebook source nor adds a Captain UI without a stable accepted
consumer. At that historical reconciliation point, Wakebook and the later
Shipwright, Helm, and Deepwater work remained unconsumed. The Phase 3 browser,
focused test, typecheck, and source-contract evidence were rerun after that
reconciliation.

After owner acceptance, accepted main advanced again to
`541e914f481883200569f8cc7ec5ec9428d7cbb7` through Admiralty Phase 2's
completion records and `4b346397`'s Helm browser-test stabilization. The
advance contains no Tideglass product, schema, policy, API, navigation, or
Studio semantic-consumer source. A range comparison confirms that the reviewed
Tideglass route, API, service, component, Studio, and Chronicle/Passport source
is byte-equivalent to reviewed product source `c2fc8fcc` after rebase. The
documentation truth was reconciled to Admiralty's accepted-main state; only the
focused Helm browser family was rerun and passed all 3/3 registered cases with
runtime conformance `PASSED`. At that historical point, Wakebook, unmerged
Shipwright work, Helm Phase 2 work, and Deepwater Phase 4 remained unconsumed.

Accepted main then advanced from `fb0f13e35fcdd98434d22c357aee02f24d6d9036`
to `cbf634d4d5db9cf47edebb89e005e8cc910068bd` through Wakebook Phase 1.
Unlike the prior record-only advances, this is a direct shared-surface overlap:
the accepted Journey Detail replaces the former Passport history detail and
therefore needs the owner-safe Tideglass history handoff described above. This
isolated reconciliation neither imports an unaccepted branch nor changes a
semantic policy, schema, Studio consumer, or Captain surface.

Current main subsequently advanced to `9e9d629085cb1551b1a3959c31b0b460c37724a9`
through accepted Deepwater Phase 4 plus Helm/Homeport repairs. The interval has
no direct Tideglass or Wakebook product-source overlap. It does change shared
validation-runtime infrastructure, so the isolated branch is rebased to that
base and requalifies its task-owned browser addendum rather than borrowing a
prior runtime receipt.

The route provides the following complete states: loading, unauthorized/unavailable, retryable comparison failure, no meaningful change, partial/redacted history, historical-only edition, up-to-date, populated concise, populated detailed, spoiler collapsed/revealed, and multiple-history selection. The page stacks selectors and cards at narrow widths, has no horizontal document overflow, uses visible text for every change state, and respects reduced motion.

The edition selector DTO is a server-derived list of exact IDs, human labels, publication date, and evidence-backed status badges. The phase vocabulary is `CURRENT_RECOMMENDED`, `PLAYED_BY_YOU`, `ORIGINAL`, `PLAYABLE`, `HISTORICAL_ONLY`, `DEPRECATED`, `INCOMPATIBLE`, and `REDACTED`; unavailable facts are shown as unavailable rather than inferred. `CURRENT_RECOMMENDED` means the current publishing selection for a new Voyage, not an inferred recency rule or a richer replay recommendation.

## Mainline Safety Contract

1. Phase 3 is additive presentation/API-adapter work over accepted Tideglass, publishing, Wayfarer, navigation, and Studio boundaries; it does not mutate published editions, sessions, history, releases, or annotations as part of reading.
2. Removing Phase 3 route, UI, and adapter wiring leaves Phases 1-2 semantic comparison, annotations, publishing, history, and live Voyages intact.
3. All ordinary user comparison output remains server-projected. No raw snapshot, storage key, private location, private media, hidden count, Creator note, or unauthorized Change Record is sent to the browser.
4. The permanently useful outcome, if Phase 4 never starts, is a discoverable Chronicle-detail and Passport-history comparison journey plus a Studio semantic published-version comparison.
5. Phase 4 retains Harborlight and accepted Helm visual integration, larger historical-compatibility corpus, distributed processing, final observability/localization, and program closure.

## Interaction, accessibility, and evidence matrix

| Surface                      | Required proof                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chronicle discovery          | Visible Gateway -> Explore Chronicles -> Chronicle detail -> Compare journey; no manually entered comparison URL.                                            |
| What Changed                 | Selector, swap, concise/detailed mode, category filters, compatibility, spoiler disclosure, no-change, partial, historical, error/retry, and return path.    |
| Wakebook Journey Detail      | Exact owner-bound played anchor, multiple-record chooser, up-to-date state, return to the same Journey Detail, and foreign-record denial.                    |
| Studio                       | Published-version Compare uses canonical Tideglass semantic output for a fixture with rewired branch, added ending, Captain requirement, and caption change. |
| Responsive and accessibility | Desktop and mobile, keyboard focus, 200% zoom, reduced motion, screen-reader names/landmarks, and Axe serious/critical zero.                                 |
| Security and privacy         | Cross-Chronicle, foreign history, audience-escalation, open-redirect, raw snapshot/storage/private-media, Creator-note, and hidden-count leakage denials.    |

## Candidate and owner gates

Each implementation change follows the mandatory focused-test lifecycle. The original owner decision accepted the reviewed Phase 3 product path. Because accepted Wakebook changes the visible personal-history surface, this reconciliation requires targeted owner review after its affected qualification and visual evidence. Only then may a newly frozen candidate later request its single Mainline Decision, and only when the separately governed serial authority queue explicitly grants that position. No frozen PR, protected binding, or shared validation runtime is resumed by this reconciliation.
