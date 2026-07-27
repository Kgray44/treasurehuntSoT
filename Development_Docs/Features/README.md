# Feature Catalog Maintenance

The completed-feature catalog is a repository-governed description of stable, meaningful capabilities. JSON fragments are authoritative; `FEATURE_CATALOG.md` is generated.

Update the owning fragment when accepted work introduces or materially expands a major product or developer system; changes users or availability; changes a meaningful privacy, security, lifecycle, offline, or accessibility capability; replaces, removes, or deprecates a cataloged capability; promotes a branch-complete feature to mainline; or resolves a meaningful limitation.

Do not update it for ordinary corrections, performance work that preserves capability, tests, evidence-only work, documentation corrections, dependency upgrades, internal renames, small visual polish, an extra endpoint, checkpoints, partial work, future architecture, experiments, or unaccepted branches.

At closeout: review the full diff, decide whether capability changed, update only the owning fragment when needed, revise evidence, run `npm run features:sync`, run `npm run features:validate`, and include the required Feature Catalog line in the final response. Generated Markdown is never hand-edited; resolve its conflicts by reconciling JSON and regenerating.

One task normally edits one subsystem fragment. Stable IDs do not change for wording edits. A branch-complete feature is eligible only after its local acceptance criteria pass. On integration, promote the entry to its mainline owner, replace evidence with the integration commit, remove its branch-complete copy, regenerate, and validate.
