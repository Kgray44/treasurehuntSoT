# Repository instructions

Active automation guidance belongs in [`.agents/`](.agents/README.md), not in product or user documentation. Preserve repository safety rules, use an owned worktree, avoid real private content, and keep validation isolated from shared runtime state.

## Documentation contract

Before completing a change, classify every new or materially changed document; give current human documents valid frontmatter; place engineering evidence under `Development_Docs`; place active automation material under `.agents`; update indexes and navigation; and run `npm run docs:validate`. User-visible behavior changes require review of product features, current status, feature status, affected guides, and the changelog.
