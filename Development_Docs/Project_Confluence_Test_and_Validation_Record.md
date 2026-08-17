---
title: Project Confluence Test and Validation Record
audience: engineering
status: in-progress
canonical_for: project-confluence-validation
last_reviewed: 2026-08-17
---

# Project Confluence validation

Focused Confluence tests exercise private visibility refusal, archive path containment, America/New_York week calculation, evidence collection, missing-metric classification, idempotency, replay pause/resume state, public metadata privacy rejection, and exact-only delivery. The final qualification record will append executed commands, results, replay identity, and protected-main evidence after the candidate is frozen.

## Executed evidence

- `node --test tests/confluence/core.test.mjs`: 6 passed, 0 failed. The suite validates America/New_York boundaries, archive/path and public-metadata guards, token completeness, DOCX A4/margin/heading structure, PDF A4 structure, and byte-exact approved delivery.
- C7 replay `replay-1cbf250f-1a7c-4d17-beca-04f248f48a2f`: 2026-08-10T21:41:59.755Z through 2026-08-17T21:41:59.755Z, America/New_York; it initially paused at `WAITING_FOR_HUMAN_EVIDENCE` with a minimal request at `requests/human-replay/replay-1cbf250f-1a7c-4d17-beca-04f248f48a2f.json`. After a validated private human-evidence source arrived, the preserved run resumed and now stops at `WAITING_FOR_MASTER_AUTHOR`; no journal prose was generated or altered by Codex. The private evidence index preserves two source-digested engineering revisions; the original pre-digest record remains preserved outside that content-addressed index.
- Protected review: PR #176 head `60cc347b59e6adac4564594f316f287295962369` passed Verification-maintenance and Record-only classification, then its candidate-bound authoritative run `32074128526` failed only because all Project Confluence paths are `ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED`. This is a governed admission boundary, not a product-test failure; no Sounding Line policy was weakened or changed.
