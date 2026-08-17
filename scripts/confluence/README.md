# Project Confluence commands

The commands in this directory collect and validate engineering evidence, coordinate ChatGPT handoffs, validate the fixed design authority, and carry exact approved artifacts. They never author or rewrite weekly journal prose.

All operations require `CONFLUENCE_ARCHIVE_PATH` (or `--archive`) to name a local checkout of `Kgray44/voyagewright-journal-archive`. Each operation verifies that the archive is private before a private read/write operation proceeds.

```text
npm run confluence:collect -- --week 2026-W34
npm run confluence:status -- --week 2026-W34
npm run confluence:validate-master -- --week 2026-W34
npm run confluence:replay -- --last-7-days
npm run confluence:resume -- --run <run-id>
npm run confluence:deliver -- --week 2026-W34
```

The only automatic public-delivery state is `SAFE_TO_MIRROR_EXACT`. If a master needs redaction, the delivery command blocks; it cannot rewrite the author’s text.
