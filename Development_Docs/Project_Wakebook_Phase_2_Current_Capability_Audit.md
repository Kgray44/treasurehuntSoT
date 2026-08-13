---
title: Project Wakebook Phase 2 Current Capability Audit
audience: product-engineering
status: current
canonical_for: project-wakebook-phase-2-current-capability-audit
last_reviewed: 2026-08-13
---

# Project Wakebook Phase 2 current capability audit

## Audit baseline

The audit was performed before Phase 2 product-source modification against
accepted `origin/main` `60b89841986e66fbc2c0828489d38002a1617506`.

## Accepted foundation

| Concern      | Current accepted capability                                                                                                                                                                                            | Phase 2 gap or preservation rule                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Detail       | Owner-scoped `GET /api/passport/voyages/:recordId` supplies historical title/cover, edition ID/checksum, lifecycle, outcome, timing, chapters, crew, artifact records, annotations, provenance, and Tideglass handoff. | Keep this canonical read endpoint and expand its strict DTO.                                    |
| Path         | Stored completed-chapter summaries are version-pinned. Objective and choice storage currently represents truthful unavailable evidence.                                                                                | Support safe retained detail when present; never reconstruct missing choices.                   |
| Attribution  | `PlayerChronicleRecord.creatorAttributionSnapshot` and participant role snapshots exist.                                                                                                                               | Select and present Creator plus Captain/dual-role history without current-profile substitution. |
| Reflection   | Private note and four favorite references exist; mutation is Wayfarer-owned.                                                                                                                                           | Add source-bound selectable labels, complete save states, and reference integrity checks.       |
| Memories     | Owner-only create and soft-delete exist with title/body/reference fields.                                                                                                                                              | Add edit, validated Voyage-bound references, curation UI, and authorized media linkage.         |
| Keepsake     | Wayfarer stores a private payload and scoped participant consent; participant-only decisions are enforced.                                                                                                             | Project a polished private presentation, all consent states, and revocation degradation.        |
| Artifacts    | Artifact receipts, personal records, assemblies, and contributions are canonical and source-Voyage keyed.                                                                                                              | Add chronology/assembly context; retain witnessed-versus-owned distinction.                     |
| Achievements | Versioned private `PlayerAchievement` records and definition snapshots exist.                                                                                                                                          | Present only deterministic evidence tied to this Voyage.                                        |
| Media        | Sealed Hold models and authorized-delivery infrastructure exist separately.                                                                                                                                            | Verify an opaque reference seam before linking a Memory; do not expose object identity.         |
| Tideglass    | `loadTideglassHistoryComparisonEntry` already provides the owner-safe handoff.                                                                                                                                         | Preserve unchanged.                                                                             |

## Current constraints

- Existing Wayfarer reflection and Memory mutations have no revision-conflict
  token; Phase 2 will not claim stale-edit protection until an accepted,
  compatible contract exists.
- Current stored choice and objective summaries are intentionally unavailable
  for historical editions unless safe canonical detail is retained.
- Existing Keepsake generation is Wayfarer-owned and uses consent filtering;
  Wakebook composes its presentation rather than becoming a consent authority.
- The current Phase 1 detail is functionally complete but visually combines
  forms and history. Phase 2 reorganizes it into progressive disclosure.

## Schema and migration audit

`prisma/schema.prisma` and `prisma/schema.sqlite.prisma` currently contain
equivalent Wayfarer history, artifact, achievement, Keepsake-consent, and
Sealed Hold models. No new historical truth model is justified. Any media link
requires an additive cross-provider-safe reference model and equivalent
migrations, subject to the repository's current migration reservation rules.
