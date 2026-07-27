# Feature Catalog Schema

Each JSON fragment contains one or more version-1 entries. Required fields are stable `id`, unique `title`, concise `summary`, closed-vocabulary `status`, nonempty `surfaces`, unique nonempty `subfeatures`, and meaningful `evidence`. Optional fields are `program`, `limitations`, and branch metadata.

Statuses are `MAINLINE`, `BRANCH_COMPLETE_NOT_MERGED`, and `COMPATIBILITY`. Branch-complete entries require both `branch` and exact `commit`; they remain outside the mainline section until an integration commit promotes them. IDs are permanent identifiers, not sequence numbers to renumber.

Evidence uses `path`, `commit`, `branch`, `test`, or `completion-record`. Mainline path and completion-record evidence must exist in the checked-out repository. Evidence may not be a Windows, UNC, or developer-local path. Never include credentials, secret values, private story material, raw databases, or raw private-media evidence.

Fragments are owned by their domain. Run `npm run features:sync` to render the deterministic Markdown and `npm run features:validate` to enforce schema, uniqueness, evidence, privacy checks, deterministic ordering, and output freshness. A deprecation or supersession revises the existing record or introduces a clear successor with an honest limitation; planned or partial work belongs in neither completed section.
