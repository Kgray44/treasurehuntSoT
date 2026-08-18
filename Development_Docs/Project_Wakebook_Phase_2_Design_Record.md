---
title: Project Wakebook Phase 2 Design Record
audience: product-engineering
status: draft
canonical_for: project-wakebook-phase-2-design-record
last_reviewed: 2026-08-13
---

# Project Wakebook Phase 2 design record

## Phase identity and baseline

Project Wakebook Phase 2, **Bind the Voyages**, enriches one owner-private,
version-pinned Voyage Detail into a durable remembrance experience. It begins
from accepted `origin/main` `60b89841986e66fbc2c0828489d38002a1617506` on
`codex/project-wakebook-phase2-bind-the-voyages` in the task-owned worktree
`C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\treasurehuntSoT-wakebook-phase2-bind-the-voyages`.

Phase 1 is accepted protected-main history (PR #41, merge `cbf634d4`) and is
an input, not a branch to resume. This phase does not start Phase 3 or merge
without the required owner walkthrough and protected-main process.

The machine-readable Deepwater capability-realization impact declaration is
[`Project_Wakebook_Phase_2_Capability_Impact.json`](Project_Wakebook_Phase_2_Capability_Impact.json).
It records a candidate-only expansion of the existing private archive and does
not assert protected-main integration, realization, or owner acceptance.

## Mainline-safety contract

After this phase, an owner can privately revisit one exact historical Voyage,
understand the retained journey path, crew, attribution, artifact and
achievement context, and curate Reflection, Memories, media, and a consent-aware
Keepsake without rewriting what happened. If all later Wakebook work stops, this
remains a complete, reachable experience.

Timeline, People, archive-wide analytics, edition-awareness expansion, replay
orchestration, public sharing, Landfall, and printable Voyage Books remain
dormant. No dormant control is presented as available.

## Frozen ownership boundary

| Domain                                          | Authority                 | Wakebook Phase 2 responsibility                                                         |
| ----------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------- |
| Runtime Voyage, events, membership, completion  | One Voyage / Helm         | Read only through accepted Wayfarer history; never mutate or serialize raw events.      |
| Durable historical record, annotations, consent | Wayfarer                  | Owner-scoped composition and existing governed mutations only.                          |
| Personal artifacts and achievements             | Wayfarer Artifact Cabinet | Present provenance-backed chronology and handoffs; never calculate ownership or awards. |
| Semantic comparison                             | Tideglass                 | Preserve the existing owner-safe handoff; never compute a diff.                         |
| Protected media                                 | Sealed Hold               | Retain only authorized opaque references and delivery states.                           |
| Public sharing                                  | Harborlight               | No direct Wakebook public-share action.                                                 |
| Acceptance                                      | Sounding Line             | Incremental evidence first; one exact-source authority only after qualification.        |

## Frozen DTO rules

The Wakebook detail service is the only place that composes the Phase 2 DTO.
React, routes, and tests consume that DTO and do not infer historical meaning.

- `HistoricalPathSummary` contains only version-pinned, retained chapter,
  objective, and safe-choice evidence. Missing evidence is explicit
  `UNAVAILABLE`, never inferred from current content or raw event payload.
- `HistoricalAttribution` separates immutable Creator/Captain snapshots from an
  optional safe current identity hint. Current profiles never overwrite history.
- `VoyageArtifactChronology` distinguishes witnessed context from canonical
  personal records, assembly context, and collection context.
- `VoyageAchievementChronology` contains only deterministic, source-linked
  achievement evidence.
- `ReflectionEditorContract` and `MemoryCurationContract` are owner-authored
  annotations. They cannot alter canonical chapter, outcome, timing, or crew
  facts. Server validation binds references to the owned historical Voyage.
- `KeepsakePresentationContract` is private and derives participant material
  only from current consent decisions. Revocation degrades the representation;
  it does not alter the underlying history record.
- `TechnicalProvenance` is owner-only progressive disclosure. It can expose
  bounded source identity and quality, never raw events, credentials, storage
  keys, secret answers, private notes, or provider evidence.

## Historical quality and failure rules

Every enriched fact has a quality of `EXACT`, `ESTIMATED`, `UNAVAILABLE`, or
`NOT_APPLICABLE` and a bounded source class. Unknown is not zero. A partial
dependency degrades only the affected section and retains valid historical
content. Foreign and missing records receive the same neutral result.

## Schema decision

Historical truth tables are not added. The initial audit finds that existing
`PlayerChronicleRecord`, historical participant snapshots, Reflection, Memory,
Keepsake consent, artifact records, assembly records, and achievements provide
the required canonical truth. The existing Sealed Hold
`ProtectedMediaAssociation` seam now binds an owner-clean `WAYFARER_MEMORY`
to `MEMORY_PRIVATE`; it persists no provider key, URL, or media bytes. No new
Wakebook schema or migration is required.

## Rollback

Revert Wakebook-owned DTO, routes, components, styles, tests, and records.
Never delete or rewrite Wayfarer history, annotations, consent decisions,
artifact provenance, achievements, or protected-media source objects.
