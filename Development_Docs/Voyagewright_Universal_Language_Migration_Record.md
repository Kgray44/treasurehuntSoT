# Voyagewright Universal Language Migration Record

## Status

**Branch:** `development/universal-language`
**Dedicated worktree:** `Forever-Treasure-Language`
**Governing document:** `Voyagewright_Language_Design_Foundation.pdf` (Foundation v1.0, July 2026; SHA-256 `9D9668909CD448A9E471D0D62457498D0865CDF062D972D4612EB539FB40B46C`)
**Starting committed baseline:** `7c3677035867081e4078536bef2f7d540bfd94e6` (`work/lanternwake-latest` remote state)
**Final implementation state:** Complete on the dedicated language branch and ready for integration review. No merge into Lanternwake has been performed.
**Implementation state:** In progress — glossary and copy architecture established; product-surface audit and migration follow.

## Authority and change protection

Project Lanternwake owns component and scene architecture, animation runtimes, scene hosts, lifecycle behavior, transitions, motion accessibility, and presentation mechanics. This branch owns visible product language only. Copy edits must preserve all existing behavior and animation hooks.

The active Lanternwake checkout is `forever-treasure-companion` on `work/lanternwake-latest` at `ec19f2115cca1a3de9dd44d7859f088485fcfb04`; it was not modified. A separate Phase 4 worktree contains concurrent uncommitted lifecycle changes in invitation, sign-in, voyage-room, and player-experience files. Static wording in those files is an integration-risk area and must be reconciled against their completed committed state before final integration.

## Canonical terminology and capitalization

| Concept                   | Canonical display term          |
| ------------------------- | ------------------------------- |
| Company                   | Absolute Relative Systems       |
| Product                   | Voyagewright                    |
| Creator interface         | Voyagewright Studio             |
| Player interface          | Voyagewright Player             |
| Live operator interface   | Captain's Console               |
| Connector                 | Voyagewright Connector          |
| Authored experience       | Chronicle                       |
| Playthrough               | Voyage                          |
| Operator                  | Captain                         |
| Participants              | Crew                            |
| Major division            | Chapter                         |
| Authored unit             | Passage                         |
| Progress point            | Waypoint                        |
| Optional discovery        | Echo                            |
| Major collected object    | Artifact                        |
| Test playthrough          | Preview Voyage                  |
| Completed record          | Voyage Record                   |
| Creator collection        | Chronicle Library               |
| Active-play collection    | Active Voyages                  |
| Completed-play collection | Voyage History / Voyage Records |

Capitalize canonical product objects when they name Voyagewright concepts. Use ordinary sentence case when the same words describe a non-product concept. Preserve literal names for ordinary controls such as Save, Cancel, Delete, Email, Password, Privacy, Version history, and Validation errors.

## Language architecture

| Artifact                          | Purpose                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `src/language/canonical-terms.ts` | Canonical terms, deprecated display terms, capitalization policy                   |
| `src/language/copy-types.ts`      | Typed speaker ownership, audience, delivery context, voice layer, localization key |
| `src/language/platform-copy.ts`   | Shared platform labels, empty/loading/recovery language                            |
| `src/language/player-copy.ts`     | Functional-truth-first Player progression copy                                     |
| `src/language/captain-copy.ts`    | Direct Captain control and consequence language                                    |
| `src/language/studio-copy.ts`     | Creator-focused Studio labels                                                      |
| `src/language/error-copy.ts`      | Parameterized, actionable error patterns                                           |

The product currently has no localization framework. Each new shared copy entry therefore carries a stable `localizationKey`, speaker ownership, audience, delivery context, and voice-layer metadata so localization can be introduced without using English copy as an identifier.

## Audit coverage and application status

| Surface                                  | Status      | Evidence / disposition                                                                                                                    |
| ---------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Absolute Relative Systems public website | NOT PRESENT | No separate company-site package or deployment surface exists in this repository.                                                         |
| Voyagewright marketing site              | IN PROGRESS | Root landing page and shared product shell are in `src/components/landing` and `src/components/shell`.                                    |
| Voyagewright Player                      | IN PROGRESS | Routes and components under `src/app/player`, `src/components/player`, and `src/components/platform`.                                     |
| Captain's Console                        | IN PROGRESS | Routes and components under `src/app/captain`, `src/components/captain`, `src/components/platform`.                                       |
| Voyagewright Studio                      | IN PROGRESS | Routes and components under `src/app/studio`, `src/components/studio`, and `src/tall-tale`.                                               |
| Voyagewright desktop wrapper             | NOT PRESENT | No Electron, Tauri, native wrapper, shortcut, or desktop manifest is tracked.                                                             |
| Voyagewright Connector                   | NOT PRESENT | No connector application, tray surface, or capture-permission package is tracked.                                                         |
| Installer / updater                      | NOT PRESENT | No installer or update configuration is tracked.                                                                                          |
| Emails                                   | NOT PRESENT | No email template or delivery system is tracked.                                                                                          |
| Notifications                            | PARTIAL     | In-app state and status notifications are audited with their owning Player/Captain flows. No separate OS notification service is tracked. |
| Metadata and manifests                   | IN PROGRESS | Next metadata is in `src/app/layout.tsx`; no PWA manifest is tracked.                                                                     |
| Documentation                            | IN PROGRESS | This record, foundation companion, inventory, and validator documentation are the owned documentation surfaces.                           |

## Final audit disposition

| Surface                                                             | Final status | Evidence / disposition                                                                                                                               |
| ------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Voyagewright marketing site                                         | COMPLETE     | Landing page, product shell, metadata, role selection, and accessible labels use Voyagewright terminology.                                           |
| Voyagewright Player                                                 | COMPLETE     | Player, library, invitation, Journal, Chronicle catalog, empty/recovery, and accessible copy are migrated without changing scene/lifecycle behavior. |
| Captain's Console                                                   | COMPLETE     | Captain UI, operator controls, invitation/session APIs, direct consequence copy, and accessible labels are migrated.                                 |
| Voyagewright Studio                                                 | COMPLETE     | Studio, API, registry, validation, publishing, and creator-facing labels use Chronicle/Passage terminology.                                          |
| Metadata and manifests                                              | COMPLETE     | Next metadata is migrated; no PWA manifest is tracked.                                                                                               |
| Documentation                                                       | COMPLETE     | Foundation companion, inventory, registry, validator, tests, and this migration record are maintained in the branch.                                 |
| Notifications                                                       | PARTIAL      | In-app Player/Captain status and recovery copy is migrated. No separate OS notification service is tracked.                                          |
| Company site, Connector, desktop wrapper, installer/updater, emails | NOT PRESENT  | These separately auditable application surfaces are not tracked in this repository.                                                                  |

## Technical legacy and intentional preservation

| Area                                                                    | Decision                 | Reason                                                                                                                         |
| ----------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `campaignId`, `campaignSlug`, `storyBlock`, existing API route names    | Preserve internally      | Persisted data/API compatibility and low-risk migration boundary; must not appear in product-facing copy.                      |
| `tall-tale` CSS/data identifiers and implementation file names          | Preserve internally      | Animation/style/runtime identifiers are Lanternwake-adjacent technical legacy, not product language.                           |
| Chronicle-authored narration, dialogue, riddles, letters, and documents | Preserve                 | Chronicle authors own their voice; only accidental product-language leakage or placeholder copy is migrated.                   |
| `/tales`, `/play`, `/tale`, `/quartermaster`, and API routes            | Preserve for this branch | Route migration requires redirects, saved-link analysis, and coordinated integration; visible labels and metadata migrate now. |

## Validation plan

1. Run the forbidden-language validator against production copy roots after each copy batch.
2. Run copy-registry and feature tests after each owned surface changes.
3. Run formatting, lint, typecheck, unit tests, language validation, build, and the isolated repository validation harness serially.
4. Use only the language worktree's isolated validation database and its dedicated test server port; do not share Lanternwake's server, database, Playwright session, or generated build output.
5. Before integration, fetch the completed Lanternwake branch and merge it into this branch; resolve conflicts in favor of Lanternwake structure and Voyagewright language.

## Validation results

- `prettier --check .`, ESLint (19 pre-existing warnings, zero errors), TypeScript `--noEmit`, and `scripts/validate-user-facing-language.ts` passed in the dedicated local validation runtime.
- The prohibited-language validator scans `src/app`, `src/components`, `src/platform`, and `src/tall-tale`; it excludes technical identifiers and requires narrow, owned, review-dated exceptions. The approved exception list is currently empty.
- The language-owned focused suites passed. The full non-PlayerExperience unit run passed **84 files / 790 tests**. The production build passed.
- `scripts/test-all.ps1 -SkipBrowserInstall` was attempted in an isolated database/runtime on ports 3100 and 3200. It reached formatting, lint, typecheck, and language validation, then exposed the existing `src/components/player/PlayerExperience.test.tsx` progression-scene failure (109 tests, 105 failing). This path and its test have no language-branch semantic diff from the starting Lanternwake baseline, so it remains Lanternwake-owned and is not modified here.
- Browser acceptance, production performance, and restart proof remain integration-gate work because the harness stops at that existing Lanternwake failure. No server or database was shared with a Lanternwake worktree.

## Completion checklist

- [x] Authoritative PDF located, read, checksum-recorded, and preserved in this worktree.
- [x] Searchable Markdown companion created.
- [x] Migration record and initial inventory structure created.
- [x] Canonical glossary, ownership metadata, and feature copy catalogs created.
- [ ] Production copy migration complete.
- [ ] Forbidden-term validator and validation-pipeline integration complete.
- [ ] All BLOCKER/HIGH inventory items resolved.
- [ ] Full validation complete.
- [ ] Lanternwake baseline synchronization complete.
- [ ] Integration review requested; no automatic merge into Lanternwake.

## Final branch completion

- [x] Production copy migration complete.
- [x] Forbidden-term validator and validation-pipeline integration complete.
- [x] All BLOCKER/HIGH inventory items resolved.
- [x] Language-owned validation and production build complete; the inherited Lanternwake progression failure is recorded above.
- [x] Branch based on the newest fetched committed Lanternwake baseline (`7c3677035867081e4078536bef2f7d540bfd94e6`).
- [x] Integration review requested; no automatic merge into Lanternwake.
- [ ] Merge a completed Lanternwake milestone into this branch during the dedicated integration phase.
