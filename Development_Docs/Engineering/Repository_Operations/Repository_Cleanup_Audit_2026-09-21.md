---
title: Repository cleanup audit and archive plan
audience: engineering
status: current
canonical_for: repository-cleanup-audit-2026-09-21
last_reviewed: 2026-09-21
---

# Repository cleanup audit and archive plan

## Scope and decisions

This maintenance pass preserves application, database, authentication, authorization, and public API behavior. The proprietary license and product landing page were already current on the protected-main baseline and were retained. `docs/` is now reserved for product use; setup, deployment, configuration, route, command, and provider material is under `Development_Docs/Engineering/Repository_Operations/`.

## Documentation migration map

| Previous location | Canonical location | Treatment |
| --- | --- | --- |
| `docs/administrator/` | `Development_Docs/Engineering/Repository_Operations/administrator/` | Internal operations records |
| `docs/developer/` | `Development_Docs/Engineering/Repository_Operations/developer/` | Internal engineering records |
| `docs/reference/` | `Development_Docs/Engineering/Repository_Operations/reference/` | Internal reference records |
| Product status and roadmap | `Development_Docs/Engineering/Repository_Operations/product-status/` | Historical and owner-review records |
| Root Wakebook records and evidence | `Development_Docs/Projects/Project_Wakebook/` | Project record and preserved evidence |
| Root project families | `Development_Docs/Programs/`, `Architecture_Decisions/`, `Archive/`, `Completion_Receipts/`, or `Governing/` | Classified canonical homes |

## Playwright configuration migration map

The ordinary `playwright.config.ts` remains at the repository root. All 25 specialized configurations moved from the root to `tests/config/playwright/` with their filenames preserved. Package scripts, journey runners, test registries, impact maps, ownership maps, and engineering records now use the new paths. Relative test and setup paths are resolved from the moved configuration directory.

## Package-script audit

The 260 scripts are classified as 17 ordinary development scripts, 5 Sounding Line or CI scripts, 45 operations scripts, 193 project-tooling scripts, and 0 proven historical or unreachable scripts. No scripts were removed: a name that carries a phase label is not, by itself, proof that the invocation is obsolete.

## Repository-size findings and follow-up archive plan

| Area | Files | Approximate size | Follow-up destination |
| --- | ---: | ---: | --- |
| `Development_Docs` | 1,553 | 350 MB | Keep current records; move accepted, infrequently consulted evidence to a private engineering archive after reference inventory and checksum verification. |
| `Experience_Images` | 594 | 301 MB | Move browser and visual acceptance evidence to a private evidence repository or workflow artifacts/object storage; retain small canonical selection metadata in Git. |
| `Codex_Chats` | 66 | 145 MB | Keep only redacted, governed summaries in Git; migrate source transcripts to a private archive after retention review. |
| Generated test registries and browser evidence | repository-wide | audit required per generated family | Publish transient browser traces, videos, reports, and large generated evidence as workflow artifacts or private object storage. Use Git LFS only for durable, versioned binary assets that must remain repository-addressable. |

No Git history is rewritten and no accepted evidence is deleted in this pass. Future migration must inventory references, copy with checksums, validate consumers, obtain owner approval, and only then remove duplicated in-repository material.

## Intentionally retained legacy material

Historical project records, evidence screenshots, and specialized test configurations remain because their reachability is retained in test registries, engineering records, or validation history. Historical identifiers are not renamed merely for presentation.
