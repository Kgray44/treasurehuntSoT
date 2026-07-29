# Repository Instructions

Active automation guidance belongs in [`.agents/`](.agents/README.md), not in product or user documentation. Preserve repository safety rules, use an owned worktree, avoid real private content, and keep validation isolated from shared runtime state.

## Documentation contract

Before completing a change, classify every new or materially changed document; give current human documents valid frontmatter; place engineering evidence under `Development_Docs`; place active automation material under `.agents`; update indexes and navigation; and run `npm run docs:validate`. User-visible behavior changes require review of product features, current status, feature status, affected guides, and the changelog.

## Feature Catalog Governance

Before changing product behavior, read `Development_Docs/Features/README.md` and `Development_Docs/Features/FEATURE_CATALOG.md`.

At the end of every task, decide whether completed work changes a major feature or important subfeature. Update the owning machine-readable fragment only for a completed major capability, meaningful expansion, replacement, removal, availability change, or meaningful limitation. Do not update for ordinary bug fixes, tests, refactors, dependency updates, documentation-only work, minor polish, internal endpoints, or partial work.

Before the final response run `npm run features:sync` and `npm run features:validate`. Include exactly one line: `Feature Catalog: UPDATED`, `Feature Catalog: NO CHANGE REQUIRED`, or `Feature Catalog: BLOCKED - <exact reason>`. Never hand-edit `FEATURE_CATALOG.md`.
