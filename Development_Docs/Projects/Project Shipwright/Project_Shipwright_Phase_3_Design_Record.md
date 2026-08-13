---
title: Project Shipwright Phase 3 Design Record
audience: engineering
status: active
canonical_for: project-shipwright-phase-3-design
last_reviewed: 2026-08-13
---

# Project Shipwright Phase 3: Shape the Chronicle - Design Record

## Authority and frozen starting point

| Field | Value |
| --- | --- |
| Branch | `codex/project-shipwright-phase3-shape-the-chronicle` |
| Actual worktree | `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\treasurehuntSoT-shipwright-phase3-shape-the-chronicle` |
| Original branch base | `60b89841986e66fbc2c0828489d38002a1617506` |
| Fetched `origin/main` | `60b89841986e66fbc2c0828489d38002a1617506` |
| Preferred UNC worktree | Attempted only as a fresh checkout and abandoned before authoring when its checkout could not populate. The local worktree is the governed UNC-safe execution location. |
| Shipwright Phase 2 | Satisfied: accepted candidate `00e58fc427d97d5775e1b911ea8f62ba428b0c51`, protected PR #72, merge `25a5ecc3989d137a95291c340f07143860b821cc`, formal `ACCEPTED_MAINLINE` receipt. |
| Drydock Phase 2 | Satisfied: accepted merge `847e035775984888be71edf614f2205fd6c5a376`, 70-rule static catalog, 23/23 current contracts verified. |
| Semantic authority | Drydock owns block schemas, canonicalization, validation, migrations, compatibility, and static analysis. One Voyage/Chronicle owns draft persistence, immutable publication, and runtime progression. |
| Phase boundary | Phase 4 simulation UX and Phase 5 publishing overhaul are not started. |

The current source inventory contains 23 active, versioned block contracts. The complete Appendix A audit is frozen in [the Phase 3 readiness matrix](Project_Shipwright_Phase_3_Block_Readiness_Matrix.md). No Appendix A candidate is newly activated merely because it has a familiar name; existing semantic equivalents remain existing types and all unsupported types stay absent from the Library.

## Chosen Phase 3 activation batches

1. **Reusable composition**: private block presets, fragments, chapter templates, deterministic insertion planning, atomic undoable application, cross-Chronicle import, and provenance.
2. **Context-aware Library**: Blocks plus the real reusable-content categories, deterministic search/filter/ranking, insertion preview, and compatibility explanations.
3. **Provider-aware presentation**: only accepted existing asset/artifact and Harborlight-installed-content metadata may be shown. Landfall and Watchglass remain unavailable because this baseline contains no accepted authoring contract to consume.

There is **no new semantic Story Block batch** in this base. The readiness audit found no candidate with a distinct accepted Drydock contract, static rules, runtime, reader, accessibility, compatibility evidence, and owner adapter that is not already one of the 23 active types. Existing `narrative`, `choice`, `audio`, `cinematic`, `imageTransformation`, `arrivalCheck`, `condition`, `setVariable`, `captainApproval`, and `artifactReveal` may be reused by templates and presets; they are not renamed or duplicated as newly supported ontology.

## Reusable-content domain model

Phase 3 introduces a minimal authoring-library persistence boundary rather than a table per concept:

- `ReusableAuthoringItem` is owner-scoped and has a stable item ID, kind (`PRESET`, `FRAGMENT`, `CHAPTER_TEMPLATE`), status, name, description, tags, current immutable version reference, timestamps, and privacy-safe usage count.
- `ReusableAuthoringItemVersion` is append-only and stores the canonical, versioned envelope; checksum; compatibility; dependencies; accessibility obligations; attribution; lineage; and source identity. Updating an item creates a version; insertion always records the exact source version and never creates live mutable transclusion.
- `ReusableAuthoringUsage` records a private, authorized draft-local provenance pointer, source item/version, insertion timestamp, and copied/snapshot semantics. It supports usage warnings without exposing another Creator's work.

The initial personal-library model is private to the authenticated Creator. It stores no runtime session state, player state, Captain-command state, secret, storage key, passphrase, raw scanner detail, or executable payload. Harborlight content remains a separate installed package/release authority: Shipwright only projects its release, license, attribution, lineage, compatibility, and installation state into a read-only adapter.

## Envelope, parameters, and compatibility

Every reusable version has a strict `voyagewright.reusable-authoring/v1` envelope with item kind, schema version, immutable version ID, source owner, metadata, body, dependencies, accessibility metadata, attribution, lineage, compatibility, and checksum. The body is constrained to canonical current Chronicle/Drydock data and cannot carry JavaScript, HTML, SQL, shell commands, arbitrary expressions, remote scripts, or provider secrets.

Parameters have a stable key, label, type, required flag, optional canonical default, help text, Drydock-backed validation source, and destination path. Supported Phase 3 parameter kinds are plain text/title, safe asset/artifact/location/variable references, duration, target, choice label, and visibility. Values are validated before an insertion plan exists. Drydock AST fields retain their current owner parser; a parameter cannot introduce a new expression language.

## Deterministic insertion and remapping

Insertion is a pure planning operation followed by one ordinary Studio mutation. The planner:

1. parses and verifies the reusable envelope and its checksum;
2. verifies owner access, source version, compatibility, dependencies, and parameter values;
3. builds a reserved namespace from the destination Chronicle's block, edge, chapter, variable, artifact, asset, location, provider-config, fragment, template, and uniqueness-sensitive label identities;
4. deterministically allocates new local IDs from an operation nonce and stable source identity;
5. remaps blocks, connections, chapters when applicable, local variable IDs/names, copied local assets/artifacts, anchors, and internal references; deliberately preserves only validated global references;
6. resolves fragment entry and exit ports to explicitly selected destinations;
7. validates the proposed resulting graph through current Drydock canonical parsing and static analysis;
8. emits an immutable insertion preview containing additions, remaps, dependency decisions, attribution/lineage, conflicts, warnings, and validation prerequisites; and
9. applies the complete plan or applies nothing.

The operation is one history entry, one normal autosave mutation, and invalidates stale Drydock evidence. Undo removes the complete insertion; redo reapplies the same stored plan. A concurrent draft revision never silently reruns a plan: the preserved intent is re-planned against the new revision or surfaced as a conflict.

Cross-Chronicle clipboard/import uses this same bounded envelope, rejects malformed, unsupported, excessive, executable, unauthorized, and secret-bearing payloads, and never overwrites colliding destination identities. Plain text remains a separate human-text fallback only.

## Library and provider adapters

The Library exposes only working categories: Blocks, Templates, Fragments, Presets, and currently accepted Assets/Artifacts/Installed Community Content. It has debounced search, bounded rendering, cached read-only metadata, lazy previews, deterministic context ranking, and visible compatibility reasons. Ranking is explainable: current selection connection policy, selected block family, chapter boundary, dependency availability, accessibility readiness, provider availability, recent local use, and explicit Creator search/filter determine order. It is not ML-driven.

An adapter is presentation-only: it declares owner, version, item kinds, browse/search/picker/summary/inspection projections, selection validation entry point, compatibility, and permissions. It cannot define runtime semantics. The initial adapters consume existing asset/artifact metadata and, when installed and authorized, Harborlight package/release lineage. Unaccepted Landfall and Watchglass contracts remain absent, except for a truthful unavailable explanation on an already-existing historical reference.

## User experience, safety, and performance

All flows preserve the Phase 2 Guided, Detailed, and Engineering disclosure modes over identical canonical data. Guided uses plain language and safe defaults; Detailed reveals dependencies and provenance; Engineering reveals schema versions, adapter IDs, source release, remaps, compatibility, and Drydock rule codes without secrets. Every Library, preview, parameter, confirm, provenance, and undo action has keyboard and non-drag access. Phone uses a focused Library/wizard rather than a tiny graph editor.

The planner and Library do not deep-clone an entire Chronicle per keystroke. Search is debounced; previews are lazy; metadata is bounded. Qualification will cover a 100+ block, multi-chapter fixture with variables, repeated templates/fragments, provider references, insertion/undo, autosave, and Drydock revalidation.

## Security, privacy, and data impact

Server actions derive the Creator from the session and never trust client owner IDs. Every list/read/update/archive/insert operation is owner-scoped; cross-account IDOR cases are mandatory. Protected assets retain Sealed Hold authorization and only safe readiness/preview state is projected. Saving reusable content explicitly detects protected Chronicle text, Creator notes, Captain-only information, player-private variables, private media, precise locations, and invitation secrets; unsafe capture fails closed with a classification result.

This phase requires additive Prisma persistence for the personal reusable library because no current model provides owner-scoped immutable reusable authoring versions or usage provenance. It must use matched SQLite/MySQL migrations and migration reservations, and it must not duplicate Harborlight package, installation, license, lineage, or release tables.

## Acceptance and Mainline Safety Contract

Focused evidence covers pure envelope/remapping/planning tests, access/IDOR/import tests, persistence migrations, Library and editor components, autosave/history/conflict tests, current Shipwright P1/P2 regressions, Drydock P2 static-analysis tests, accessibility/responsive evidence, and a synthetic Creator browser journey through visible Studio navigation. The final candidate additionally requires docs, catalog, type/lint/format, privacy/security, build, and current governed Sounding Line qualification. A focused hosted run is diagnostic/qualification evidence only; exactly one frozen-candidate Mainline Decision may be dispatched after complete qualification and required owner walkthrough/waiver.

If development stopped after Phase 3, the 23 existing blocks and P1/P2 interaction model remain unchanged and usable. Every reusable item inserted by Phase 3 is a validated copy with version identity, compatible provenance, atomic undo/autosave, preview, publication, and historical-read support. No unsupported provider block, placeholder Library item, hidden runtime dependency, Phase 4 simulation UI, or Phase 5 publishing overhaul is required. **Mainline Safety Contract: pending implementation and qualification; designed to pass.**

