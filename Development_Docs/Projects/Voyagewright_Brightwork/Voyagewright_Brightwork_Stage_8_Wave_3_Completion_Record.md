---
title: Voyagewright Brightwork Stage 8 Wave 3 Completion Record
audience: engineering-evidence
status: complete
canonical_for: voyagewright-brightwork-stage-8-wave-3-completion
last_reviewed: 2026-09-04
---

# Voyagewright Brightwork — Stage 8 Wave 3 Completion Record

**Status:** `COMPLETE — PERSONAL HARBOR + CHRONICLE PASSPORT POLISHED`
**Protected base:** `985490af32e644d276254d86405752ceae7cbea4`
**Candidate product commit:** `2f2f6b57117f74ca17f28a229aadf2a1da177b73`
**Scope:** Only Stage 8 Wave 3: Personal Harbor and Chronicle Passport. Wave 4 and every unrelated family remain out of scope.

## Finding disposition

### BW-M-009 — mixed Personal Harbor and Passport structure

- **Root cause:** Personal Harbor contained the full Passport rail/tree, and account registry leaves repeated Passport destinations.
- **Product decision:** Harbor owns account care; Passport is one first-class personal destination for experience history.
- **Implementation:** Split account/Passport IDs, removed the Passport rail/tree and duplicate account leaves, retained direct global/profile entry and deep links, and added one concise counted Harbor gateway.
- **Focused verification:** Harbor/registry tests prove account-only rail IDs; the browser journey proves the gateway and one Passport navigation landmark.
- **Rendered evidence:** `01-harbor-desktop-dark`, `02-harbor-desktop-light`, `03-passport-desktop-dark`, `04-passport-desktop-light`, `11-harbor-mobile`, and `12-passport-mobile`.
- **Preserved contracts:** Global wayfinding, Profile versus private Passport distinction, deep links, and Homeport no-orphan routes.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-010 — flat Personal Harbor actions

- **Root cause:** Passport was a peer profile-hero action and a repeated directory choice, obscuring account-control-center hierarchy.
- **Product decision:** Keep public identity contextual, make Passport one archival gateway, and retain explicit security/privacy/support/account routes.
- **Implementation:** Removed the peer hero Passport action and added `Return to what you experienced` before at-a-glance account cards.
- **Focused verification:** Harbor components and rendered overview prove the primary contextual action, gateway, and account-only rail.
- **Rendered evidence:** `01-harbor-desktop-dark`, `02-harbor-desktop-light`, and `11-harbor-mobile`.
- **Preserved contracts:** Profile, Personal Information, privacy, linked identities, security, sessions, support, data/account, and sign-out remain visible.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-011 — Passport introduction contrast

- **Root cause:** Local parchment text/background values lacked sufficient distinction.
- **Product decision:** Retain parchment warmth while strengthening text, eyebrow, and border contrast.
- **Implementation:** Applied higher-contrast parchment/brass/text values only to the Passport introduction.
- **Focused verification:** Applicable Light/Dark browser states and serious/critical Axe checks pass.
- **Rendered evidence:** `03-passport-desktop-dark`, `04-passport-desktop-light`, and `12-passport-mobile`.
- **Preserved contracts:** Passport remains teal/brass/parchment archival material, not generic shell cards.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-012 — insight-family visual drift

- **Root cause:** Timeline, People, Statistics, and Atlas used cooler one-off surfaces and hard-coded styling outside Passport lineage.
- **Product decision:** Use Wave 2 semantic surface/border/shadow/foreground/focus/accent roles while retaining archival character.
- **Implementation:** Added Passport aliases and migrated insight cards, time groups, people details, statistics, and Atlas states.
- **Focused verification:** Component coverage plus Light/Dark, Axe, and overflow checks across all insight routes pass.
- **Rendered evidence:** `07-timeline-desktop`, `08-people-desktop`, `09-statistics-desktop`, `10-atlas-desktop`, `14-timeline-mobile`, and `15-people-mobile`.
- **Preserved contracts:** Wave 2 token lineage remains authoritative; no replacement shared primitive was created.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-013 — duplicate Passport navigation and titles

- **Root cause:** Insight pages repeated Archive Views tabs and route labels under the Passport shell.
- **Product decision:** PassportLayout is the sole product-level authority; local headings describe content rather than repeat route titles.
- **Implementation:** Removed Archive Views tabs, retained product navigation, and made local headings contextual.
- **Focused verification:** Layout/insight tests and browser assertions prove one `Chronicle Passport sections` landmark and one route title.
- **Rendered evidence:** `03-passport-desktop-dark`, `07-timeline-desktop`, `08-people-desktop`, `09-statistics-desktop`, and `10-atlas-desktop`.
- **Preserved contracts:** Voyage Detail's separate `LONG_PAGE` navigator remains protected.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-014 — Voyage Detail peer actions and prominent provenance

- **Root cause:** Immediate and related actions were peers, and historical evidence appeared as ordinary primary content.
- **Product decision:** Add Memory is primary; related archive/revisit actions are secondary; source/quality evidence is technical disclosure.
- **Implementation:** Grouped actions, retained Cabinet/Tideglass/replay/book/review handoffs, and moved provenance to shared `TechnicalDetails`.
- **Focused verification:** Detail tests and browser assertions cover primary/secondary actions and Technical details.
- **Rendered evidence:** `06-voyage-detail-desktop` and `13-voyage-detail-mobile-navigation`.
- **Preserved contracts:** All actions, immutable-edition truth, private memories, and provenance values remain available.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-015 — no narrow-screen long-page navigation form

- **Root cause:** The reference desktop sticky rail had no intentional compact mobile equivalent.
- **Product decision:** Preserve desktop rail and provide every mobile section through an accessible selector beneath the global header.
- **Implementation:** Added labeled sticky selector with all anchors, selected-hash state, focus styling, and natural document-flow/sticky behavior.
- **Focused verification:** Selecting Technical details updates the hash; mobile Axe and no-overflow checks pass.
- **Rendered evidence:** `13-voyage-detail-mobile-navigation`.
- **Preserved contracts:** Desktop sticky LONG_PAGE navigation and every section anchor remain intact.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-016 — People reads as record metadata

- **Root cause:** The projection grouped participant metadata without the shared-history events that explain an owner's archive relationship.
- **Product decision:** Use remembered role, shared count, and retained first/latest Voyage links; never infer relationships or rank people.
- **Implementation:** Projected owner-scoped snapshots with exact-date safeguards, historical/tombstone labels, archive links, and no current-profile join.
- **Focused verification:** `projectSharedHistory` tests cover owner exclusion, first/latest links, and tombstone/undated fallback; browser states render it.
- **Rendered evidence:** `08-people-desktop` and `15-people-mobile`.
- **Preserved contracts:** Snapshot truth, privacy, no public graph, no ranking, and no inferred importance.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-017 — Timeline lacks temporal composition

- **Root cause:** A flat list had no retained-year grouping or event hierarchy.
- **Product decision:** Group only durable exact chronology by archive year, use human labels, and state when date was not retained.
- **Implementation:** Added year groups, semantic `time`, date-quality fallback, and responsive group spacing.
- **Focused verification:** Component and desktop/mobile browser states assert year anchors; Axe and no-overflow checks pass.
- **Rendered evidence:** `07-timeline-desktop` and `14-timeline-mobile`.
- **Preserved contracts:** No raw event log, inferred chronology, or fabricated event.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-018 — Atlas exposes subsystem architecture

- **Root cause:** The unavailable state led with projection/provider terminology instead of a person's available history.
- **Product decision:** Explain unavailable journey geography plainly; leave source context in technical disclosure.
- **Implementation:** Replaced primary copy and placed Landfall reference in `TechnicalDetails`.
- **Focused verification:** Component/browser assertions cover plain-language state and collapsed disclosure.
- **Rendered evidence:** `10-atlas-desktop`.
- **Preserved contracts:** Atlas never fabricates a route or location.
- **Disposition:** `REPAIRED_AND_VERIFIED`

### BW-M-019 — count freshness depends on entering archive

- **Root cause:** Harbor/Passport summaries counted existing records while archive paths materialized history before counting.
- **Product decision:** One Wayfarer-owned refresh boundary runs before neighboring summary counts; invitations remain separate from played history.
- **Implementation:** Added `refreshChroniclePassportHistory` for both summaries; archive/insight paths retain existing source-bound materialization.
- **Focused verification:** Route-order service tests prove Harbor → Passport and Passport → Harbor converge from unmaterialized history; browser overview/archive both render two records.
- **Rendered evidence:** `01-harbor-desktop-dark`, `03-passport-desktop-dark`, and `05-voyages-desktop`.
- **Preserved contracts:** One Voyage owns events, Wayfarer owns history, and invitations are not played Voyages.
- **Disposition:** `REPAIRED_AND_VERIFIED`

## Local Wave 2 contract usage

- **BW-M-002:** Insight surfaces consume established semantic aliases rather than new material ownership.
- **BW-M-003:** Detail provenance and Atlas source context use shared `TechnicalDetails`.
- **BW-M-006:** Passport product navigation is sole authority; the preserved detail navigator is `LONG_PAGE`.
- **BW-M-007:** The narrow detail selector applies existing recomposition vocabulary without hiding a destination.

## Focused candidate verification

- Focused Vitest: 37 tests across Harbor navigation/count freshness, Passport layout/history/detail/insights, shared history, and technical disclosure.
- `npm run typecheck`, changed-file Prettier, and `git diff --check` passed.
- A task-owned production `next build` passed compilation, TypeScript, and 143 routes. It retained existing audit/workspace Edge-runtime trace warnings; this record does not attribute them to Wave 3.
- Candidate `2f2f6b57117f74ca17f28a229aadf2a1da177b73` passed a task-owned SQLite production `next start` browser journey: 15 desktop/mobile screenshots cover required surfaces, Passport Light/Dark applicability, route transitions, accessibility, and overflow. Focused Axe found no serious or critical violations after the Statistics definition-list repair.

## Evidence boundary and deferrals

The captures, database, and receipts are task-owned synthetic evidence. They prove the named candidate's local rendering; they do not prove deployment, production data, live providers, physical assistive technology, owner visual acceptance, or a 478-frame Brightwork recertification. Preserved pre-repair receipts record test-selector errors and the resolved Statistics definition-list issue; they are not passing evidence.

No Wave 4 Community or Studio work, pending finding, Journal work, or unrelated repair began.
