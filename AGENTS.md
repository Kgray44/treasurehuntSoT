# Repository Instructions

Before every task, read and obey [`.agents/testing-workflow.md`](.agents/testing-workflow.md). It defines the mandatory development verification, candidate qualification, and authoritative acceptance lifecycle.

For applicable engineering work, bootstrap task context with
[`.agents/context-workflow.md`](.agents/context-workflow.md). The default
Project Trim profile is `STANDARD_AUTONOMOUS` unless a task selects
`UNATTENDED_CONTINUATION`; targeted in-scope context expansion is autonomous.
Generated packets are derived starting maps, never replacements for source or
governing authority.

Active automation guidance belongs in [`.agents/`](.agents/README.md), not in product or user documentation. Preserve repository safety rules, use an owned worktree, avoid real private content, and keep validation isolated from shared runtime state.

Project Homeport work must also follow [`.agents/project-homeport.md`](.agents/project-homeport.md) and its canonical governance and evidence paths.

## GitHub interaction

For any repository GitHub observation, polling, dispatch, or quota decision, follow
[`.agents/github-interaction.md`](.agents/github-interaction.md). It is the
canonical Git-first and shared-quota guidance; do not add ad-hoc `gh api` loops.

## Documentation contract

Before completing a change, classify every new or materially changed document; give current human documents valid frontmatter; place engineering evidence under `Development_Docs`; place active automation material under `.agents`; update indexes and navigation; and run `npm run docs:validate`. User-visible behavior changes require review of product features, current status, feature status, affected guides, and the changelog.

## Feature Catalog Governance

Before changing product behavior, read `Development_Docs/Features/README.md` and `Development_Docs/Features/FEATURE_CATALOG.md`.

At the end of every task, decide whether completed work changes a major feature or important subfeature. Update the owning machine-readable fragment only for a completed major capability, meaningful expansion, replacement, removal, availability change, or meaningful limitation. Do not update for ordinary bug fixes, tests, refactors, dependency updates, documentation-only work, minor polish, internal endpoints, or partial work.

Before the final response run `npm run features:sync` and `npm run features:validate`. Include exactly one line: `Feature Catalog: UPDATED`, `Feature Catalog: NO CHANGE REQUIRED`, or `Feature Catalog: BLOCKED - <exact reason>`. Never hand-edit `FEATURE_CATALOG.md`.

## Deepwater capability-realization impact

Before completing governed work that adds, changes, retires, or materially re-evidences a capability, create or update a machine-readable Deepwater capability-realization impact declaration using [`.agents/deepwater-capability-impact.md`](.agents/deepwater-capability-impact.md). `NO_REALIZATION_IMPACT` is allowed only with a concise rationale. Use Sounding Line impact selection and the affected Deepwater structural checks; do not run a full Deepwater archaeology pass for unrelated small edits. Deepwater contributes evidence only and never replaces Sounding Line release authority.
