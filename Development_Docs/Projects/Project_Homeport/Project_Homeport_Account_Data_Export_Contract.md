---
title: Project Homeport Account Data Export Contract
audience: product-engineering
status: current
canonical_for: project-homeport-account-data-export-contract
last_reviewed: 2026-08-04
---

# Account data export contract

Export requires a canonical authenticated account and sensitive reauthentication. Jobs use `REQUESTED`, `BUILDING`,
`READY`, `FAILED`, and `EXPIRED`, expose accessible progress/retry, and produce a versioned manifest, scope statement,
created time, checksum, and structured JSON/CSV archive through a short-lived account-authorized download.

The export may include owner Profile, preferences, settings, safe linked-identity summaries, capabilities, memberships,
Chronicle history, Memories, exportable Keepsakes/artifacts, saves, authored reviews/comments, safe session summaries, and
appropriate security-audit summaries. It excludes password hashes, session/reset/verification/provider tokens, CSRF data,
foreign private data, Captain answers, object keys, credentials, and unrelated private content. Large work is processed
outside the request through the accepted bounded local job runner until a production worker is configured.
