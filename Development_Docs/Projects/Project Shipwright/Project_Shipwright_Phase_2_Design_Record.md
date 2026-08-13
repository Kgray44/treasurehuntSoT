---
title: Project Shipwright Phase 2 Design Record
audience: engineering
status: active
canonical_for: project-shipwright-phase-2-design
last_reviewed: 2026-08-12
---

# Project Shipwright Phase 2: Fit the Tools - Design Record

## Authority, baseline, and prerequisite proof

| Field                             | Frozen value                                                                                                                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phase                             | Phase 2 - Fit the Tools                                                                                                                                                                                                                                            |
| Branch                            | `codex/project-shipwright-phase2-fit-the-tools-r5`                                                                                                                                                                                                                 |
| Worktree                          | `C:\\Users\\kkids\\Documents\\treasurehuntSoT-shipwright-phase2-fit-the-tools`                                                                                                                                                                                     |
| Original branch base              | `191a964488d0df71f8dcb91c5b8372fc73b6b32e`                                                                                                                                                                                                                         |
| Fetched `origin/main` at creation | `191a964488d0df71f8dcb91c5b8372fc73b6b32e`                                                                                                                                                                                                                         |
| Shipwright P1 prerequisite        | Satisfied. Accepted candidate `d7f3d0a2c9889134919402b8338f9df5095c657f` is an ancestor of the base; P1 records `ACCEPTED_MAINLINE`, owner acceptance with post-review corrections, explicit repeat-walkthrough waiver, and exact-head Sounding Line `RELEASE_GO`. |
| Drydock P1 hard dependency        | Satisfied. Protected merge `468530645e983412e5f4c1aaa103915be77c9c07` and accepted Shipwright dependency `f07fbb693e32f6b1069870fae9da668ed3392d4b` are ancestors of the base.                                                                                     |
| Current Drydock context           | Drydock P3 is present in the base. Phase 2 consumes only current accepted authoring contracts, validation issues, variable/expression services, migration metadata, and current graph connections. It does not expose a new scenario workspace.                    |
| Prisma impact                     | None planned. Authoring disclosure is client-local preference state and Chronicle mutations use the existing draft pathway.                                                                                                                                        |

## Frozen ownership boundary

Shipwright owns the Creator-facing projection: Inspector structure, labels, grouping, disclosure, safe controls, accessibility, focus, visual summaries, and calls into existing Studio mutations. Drydock remains the only owner of block schemas, defaults, valid values, type rules, migrations, connection policy, variables, expressions, compatibility, and issue severity. One Voyage/Chronicle services retain draft persistence, graph mutation compatibility, runtime progression, and immutable publication authority.

The design creates `ShipwrightAuthoringAdapter` metadata only. It may choose labels, section placement, ordinary versus advanced disclosure, help copy, summaries, and a visual control. It must never define valid values, defaults, requiredness, validation outcomes, completion semantics, provider semantics, migration transforms, or a second serialized expression language.

## Current source inventory

| Concern                                                | Current source                                                                                  | Phase 2 treatment                                                                                                                                                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Studio coordinator and draft mutation/history/autosave | `src/components/studio/TaleEditor.tsx`                                                          | Preserve `change` and `updateSelected`; new Inspector receives these callbacks and owns no save call.                                                                                                                      |
| Current generic Inspector                              | `TaleEditor.tsx` `Field` and `ChoiceListField`                                                  | Replace its selected-block body with a contract-aware Inspector component; keep existing selection and focus contract.                                                                                                     |
| Current Studio registry DTO                            | `src/components/studio/studio-types.ts`, `/api/studio/tales/[taleId]`                           | Retain the registry for library insertion. New Inspector resolves the current `DrydockBlockContract` directly.                                                                                                             |
| Contract authority                                     | `src/drydock/contracts/model.ts`, `registry.ts`, `schemas.ts`, `parser.ts`                      | The Studio API projects the registry contract, schema versions, defaults, asset/accessibility requirements, connection policy, and migration state to the browser. The browser does not import a second contract registry. |
| Variables and rename                                   | `src/drydock/variables.ts`, `variable-explorer.ts`, existing owner-only variable-explorer route | Use explorer data for display/filtering and Drydock operation vocabulary. No text replacement or independent variable store.                                                                                               |
| Expressions                                            | `src/drydock/expressions.ts`                                                                    | Store and edit the canonical AST. A browser-safe projection prevents plainly incompatible selections; canonical Drydock parsing and type checking continue to decide validation.                                           |
| Validation                                             | `src/chronicle/validation.ts`, `StudioValidationPanel.tsx`                                      | Preserve global panel. Localize its same `ValidationIssue` objects by block and canonical field path.                                                                                                                      |
| Connections/targets                                    | `BlockConnection` in studio DTO; Drydock connection policy/parser                               | Present readable Chronicle destinations. Mutate the existing compatibility representation only through the existing draft mutation path.                                                                                   |
| Assets and libraries                                   | current asset/location/artifact data in `EditorData`                                            | Filter choices from Drydock asset requirements; preserve current resource authorization and never expose a storage key.                                                                                                    |
| Preview, comparison, publication                       | existing `TaleEditor` handlers                                                                  | Preserve without new semantics.                                                                                                                                                                                            |

## Current active Story Block matrix

All 23 current active types resolve through the contract registry (current version 2; minimum reader version 1). No active type is hidden because it lacks a specialized editor.

| Type                  | Contract-aware disposition | Purpose-built seam                               | Fallback                           |
| --------------------- | -------------------------- | ------------------------------------------------ | ---------------------------------- |
| `narrative`           | PURPOSE_BUILT              | content, presentation, accessibility summary     | contract-generated advanced fields |
| `captainsNote`        | CONTRACT_GENERATED         | Creator-safe content grouping                    | typed fallback                     |
| `riddle`              | CONTRACT_GENERATED         | interaction/content grouping                     | typed fallback                     |
| `information`         | CONTRACT_GENERATED         | content/acknowledgement grouping                 | typed fallback                     |
| `travelDirection`     | CONTRACT_GENERATED         | direction/provider grouping                      | typed fallback                     |
| `location`            | DOMAIN_ADAPTER             | location reference control                       | typed fallback                     |
| `arrivalCheck`        | DOMAIN_ADAPTER             | provider/arrival summary                         | typed fallback                     |
| `image`               | CONTRACT_GENERATED         | constrained asset/accessibility control          | typed fallback                     |
| `imageTransformation` | HYBRID                     | retained alignment editor and constrained assets | typed fallback                     |
| `cinematic`           | CONTRACT_GENERATED         | constrained media/accessibility control          | typed fallback                     |
| `audio`               | CONTRACT_GENERATED         | constrained media/transcript control             | typed fallback                     |
| `artifactReveal`      | PURPOSE_BUILT              | artifact, recipient, reveal summary              | typed fallback                     |
| `hiddenMessageReveal` | CONTRACT_GENERATED         | reveal/media grouping                            | typed fallback                     |
| `collectionUpdate`    | CONTRACT_GENERATED         | artifact/quantity grouping                       | typed fallback                     |
| `confirmation`        | CONTRACT_GENERATED         | interaction grouping                             | typed fallback                     |
| `choice`              | PURPOSE_BUILT              | readable choice rows and target picker           | typed fallback                     |
| `textAnswer`          | CONTRACT_GENERATED         | private answer-safe field grouping               | typed fallback                     |
| `captainApproval`     | CONTRACT_GENERATED         | completion/provider grouping                     | typed fallback                     |
| `wait`                | PURPOSE_BUILT              | duration and fallback summary                    | typed fallback                     |
| `condition`           | PURPOSE_BUILT              | canonical visual expression and targets          | typed fallback                     |
| `setVariable`         | PURPOSE_BUILT              | variable, operation, typed operand               | typed fallback                     |
| `chapterComplete`     | PURPOSE_BUILT              | outcome/completion summary                       | typed fallback                     |
| `taleComplete`        | PURPOSE_BUILT              | terminal/finale summary                          | typed fallback                     |

## Authoring adapter and Inspector architecture

`src/studio/authoring/` contains pure projection helpers:

- `adapters.ts` maps block type to UI-only semantic sections and control preference.
- `field-model.ts` turns contract/schema-aware registry metadata into readable field descriptors and safe generic fallback controls. It does not validate or supply defaults.
- `effective-values.ts` differentiates explicit, canonical-default, unavailable, and legacy values.
- `drydock-adapter.ts` resolves a contract plus stable issue/field-path information.

`src/components/studio/inspector/ContractAwareInspector.tsx` receives a selected block, the active Chronicle draft, Studio library data, authoritative current validation result, and a single mutation callback. It renders semantic `CONTENT`, `BEHAVIOR`, `COMPLETION`, `PRESENTATION`, `ACCESSIBILITY`, and `ADVANCED` sections. Each section is an accessible accordion with expanded state, issue count/severity, local dirty indication where available, and a concise effective-state summary.

The parent retains the existing `data-inspector-field` convention. An issue navigation request opens the Inspector, expands the affected section, and focuses its control. The global movable/resizable validation panel remains the source of global discovery and reopens unchanged.

## Disclosure, persistence, and effective values

`GUIDED`, `DETAILED`, and `ENGINEERING` are client-local presentation preferences. Switching modes cannot invoke a Chronicle mutation or autosave. Guided exposes content and all controls required to build a valid ordinary Chronicle; Detailed exposes full supported controls; Engineering adds stable IDs, contract/version state, canonical paths, safe structured diagnostics and rule codes. Engineering never includes secret values, storage keys, or unrelated private data.

The Inspector resolves effective values from the Drydock contract only. It labels an omitted value as `Canonical default` and preserves omission rather than writing the default. Explicit values are `Configured`; unavailable fields are `Not required`; unsupported versions and migration availability are shown as compatibility state. Published data is not migrated by this surface.

## Variables, expressions, and targets

The existing owner-authorized Drydock variable explorer supplies names, types, scopes, privacy class, defaults, allowed operations, reader/writer counts, unused state and issue codes. The variable picker searches and filters this data. The operation picker only offers Drydock-declared allowed operations; the typed operand control uses the declaration type. Rename is exposed only when a safe current canonical helper and a current-draft guard are available; it calls the helper, is added to existing Studio history, and never changes prose.

The expression editor stores the canonical Drydock AST (`schemaVersion: 1`). Its browser-safe projection constrains ordinary control choices and labels structural issues without becoming a validator. The existing server-side Drydock parse/type-check path decides authoritative diagnostics, including imported/legacy-invalid expressions. The normal editor is visual and keyboard operable; safe Engineering mode may inspect the AST but never substitutes a human DSL.

Readable targets are derived from the current Chronicle graph. Candidate labels contain title, type, chapter, short safe summary, terminal state, and validation state. The picker filters candidates according to the Drydock connection policy and changes the existing canonical/compatibility mutation seam rather than introducing a Shipwright target record.

## Autosave, history, accessibility, responsive, security, and performance

All ordinary Inspector changes call the existing `updateSelected`/`change` callback, preserving dirty state, existing debounced autosave, error/conflict retention, and global undo/redo. Custom controls cannot call a separate endpoint. Large/nonreversible migration/rename operations require the existing confirmation pathway and only enter history when current contracts establish a safe reversible mutation.

Controls provide labels, visible focus, Tab order, Enter/Space activation, Escape close behavior for pickers, keyboard list navigation, focus restoration, and live issue-navigation announcement. Narrow layouts retain the existing Inspector drawer behavior; internal section and expression content becomes vertical rather than a desktop graph. Contract data and existing server authorization remain canonical; Engineering diagnostics are structural and redacted.

Stable contract lookup, memoized draft indexes, callback stability, and localized issue filtering prevent Inspector keystrokes from parsing the whole Chronicle. The Phase 2 large-chronicle fixture will contain at least 100 synthetic blocks and representative variables, conditions, choices, media, and issues.

## Test and acceptance plan

- Pure adapter tests: all active contracts resolve, unknown contract fallback, sections/defaults/effective values, modes, and field-path issue mapping.
- Control tests: variables/operations/operands, expressions and AST round trips, targets and connection constraints, accessibility requirements, and safe fallback.
- Inspector component tests: autosave mutation callback, undo/redo through parent pathway, inline issue focus, sections, mode invariance, and preserved animation controls.
- Existing Drydock contract/expression/variable tests remain directly impacted evidence.
- Task-owned browser journey, accessibility, responsive, security/privacy and large-chronicle evidence use isolated resources and synthetic Creator data only.

## Mainline Safety Contract and Phase 3 boundary

If implementation stops after Phase 2, all current 23 Story Block types remain editable and publishable through canonical Drydock contracts; existing autosave, undo/redo, pointer/keyboard movement, multi-select, current animation settings, validation panel, preview, comparison, and publishing remain intact. No Prisma authority, Story Block family, template/fragment, scenario-lab expansion, or publication-workflow redesign is introduced. Phase 3 remains explicitly not started.
