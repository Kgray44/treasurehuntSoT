---
title: Project Shipwright Phase 2 Owner Walkthrough
audience: product-and-engineering
status: active
canonical_for: project-shipwright-phase-2-owner-walkthrough
last_reviewed: 2026-08-12
---

# Project Shipwright Phase 2: Fit the Tools - Owner Walkthrough

## Gate state

Ready for owner walkthrough. Candidate qualification, current-main reconciliation, documentation, catalog, isolated browser evidence, and the task-owned production walkthrough environment are complete. This guide is the required product-review script; no owner review or waiver has yet been recorded.

The automated rehearsal is `npm run shipwright:phase2:journeys`. It creates a fresh SQLite fixture below `%LOCALAPPDATA%\ProjectShipwright`, uses a synthetic Creator account whose credential handoff remains outside the repository, and allocates a task-owned dynamic port. It is evidence for the review journey, not an owner decision.

After the candidate is frozen, run `npm run shipwright:phase2:walkthrough:prepare`, then `npm run shipwright:phase2:walkthrough:start`. The launcher creates a separate synthetic SQLite database and production build below `%LOCALAPPDATA%\ProjectShipwright\phase2-owner-walkthrough`, refuses the canonical development database and an occupied port, and records the candidate SHA, build ID, private credential-handoff path, and health state. Use `npm run shipwright:phase2:walkthrough:status` to verify the session; `npm run shipwright:phase2:walkthrough:stop` only stops the PID it started.

## Review journey

1. Sign in with the synthetic Creator account and enter Studio through normal visible navigation.
2. Open the synthetic Chronicle and select a Narrative Passage. Confirm Guided, Detailed, and Engineering change disclosure only.
3. Confirm effective/default labeling and retained opening, active, and leaving presentation controls.
4. Select a Choice and choose readable destinations without seeing raw IDs.
5. Select a Condition, search for a declared variable, add a nested ALL/ANY expression, and choose both targets.
6. Select Set Variable, inspect only type-permitted operations, and enter a typed operand.
7. Produce a field-addressed validation failure, open the global panel, select its issue, and confirm focus reaches the exact Inspector field. Also confirm a graph-level issue without a field focuses its Passage card.
8. Repair, validate, undo, redo, wait for autosave, reload, preview, and confirm the existing publication control remains available for a valid draft.
9. Select an older schema Passage, review the Drydock migration preview (versions, affected fields, warnings, data-loss and canonical-output metadata), and apply only if the preview remains current.
10. Rename a declared variable, inspect the governed reference/expression counts, confirm the rename, then undo/redo it. Verify stable variable identity remains unchanged and prose is untouched.

## Review evidence to capture

- Exact candidate SHA, isolated database identifier, task-owned port, browser screenshots, and validation receipt paths.
- Any owner correction and its requalification scope.
- Explicit waiver text if the owner waives this review.

No owner review or waiver is recorded by this document.
