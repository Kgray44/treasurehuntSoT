---
title: Repository cleanup audit and retention decision
audience: engineering
status: current
canonical_for: repository-cleanup-audit-2026-09-21
last_reviewed: 2026-09-21
---

# Repository cleanup audit and retention decision

## Scope and decisions

The cleanup work preserves application, database, authentication, authorization, and public API behavior. `docs/` is reserved for product use; engineering operations, setup, configuration, route, command, provider, and documentation-authoring records live under `Development_Docs/Engineering/`.

The proprietary license, contribution posture, and root product landing page are maintained separately. The current package-script audit remains intentionally conservative: all 260 scripts are classified as active ordinary development, Sounding Line or CI, operations, or project tooling. No script is removed merely because its name includes a historical phase label; command-interface simplification requires a separate, justified design.

## Documentation and configuration normalization

| Area                                                       | Canonical location                                    | Decision                       |
| ---------------------------------------------------------- | ----------------------------------------------------- | ------------------------------ |
| User documentation                                         | `docs/`                                               | Product and user guidance only |
| Documentation-authoring references                         | `Development_Docs/Engineering/Documentation/`         | Internal maintenance material  |
| Operations, developer, and reference records               | `Development_Docs/Engineering/Repository_Operations/` | Internal engineering material  |
| Project Wakebook governing document, records, and evidence | `Development_Docs/Projects/Project_Wakebook/`         | One canonical project home     |
| Specialized Playwright configurations                      | `tests/config/playwright/`                            | Canonical configuration home   |

The root `playwright.config.ts` remains the ordinary configuration. `playwright.drydock-phase4.config.ts` remains as a documented compatibility entrypoint because the active Drydock browser launcher still invokes that root path; it imports the canonical specialized configuration.

Project Wakebook's governing document, records, and evidence now share the underscore-form canonical home. Project Deepwater, Project Drydock, and Project Shipwright were audited but have no parallel underscore-form directories; their established space-form homes remain in place to preserve active references rather than creating a cosmetic path churn.

## Evidence-retention decision

The owner has explicitly confirmed that this repository is both Voyagewright's source repository and its comprehensive engineering and development record. The following content is intentional, first-class repository material:

- `Development_Docs/`
- `Experience_Images/`
- `Codex_Chats/`
- governing documents, completion receipts, validation records, accepted screenshots, visual evidence, and development history

Their size is intentional and is not a cleanup defect. This audit does not recommend extracting, pruning, summarizing, relocating, or otherwise reducing these records. No accepted evidence is deleted and no Git history is rewritten.

## Third-party notices

`THIRD_PARTY_NOTICES.md` remains a high-level, dependency-metadata-grounded notice. A deterministic, reviewed dependency-license inventory is a separate future improvement if it can be introduced without inventing unsupported legal claims or a new compliance platform.
