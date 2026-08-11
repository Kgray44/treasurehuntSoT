---
title: Project Shipwright Phase 1 Validation Record
audience: engineering
status: focused-evidence-recorded
canonical_for: project-shipwright-phase-1-validation
last_reviewed: 2026-08-10
---

# Project Shipwright Phase 1 Validation Record

## Evidence status

This record reports focused, task-owned evidence only. It is not a Sounding Line release finalizer, production acceptance, browser certification, accessibility certification, or owner acceptance.

| Check                                                  | Result                        | Evidence / limitation                                                                                                                                                                                                                                                          |
| ------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused Studio/shell/journal/motion suite              | PASS                          | 27 tests passed: `TaleEditor`, `ProductShell`, `PhysicalJournalBook`, and the finite Shipwright motion vocabulary, using Vitest 4.1.10 and the local completed dependency cache.                                                                                               |
| Existing Studio behavior                               | PASS within focused suite     | Existing More disclosure, dnd/motion ownership, inspector focus, validation focus, failed-save deletion, publication state, autosave/publish, and upload tests passed.                                                                                                         |
| Whole-card movement, selection, and animation controls | PASS                          | Focused coverage proves sortable card wiring, additive selection, and all three persisted animation controls with the finite preset list.                                                                                                                                      |
| Validation presentation                                | PASS                          | Focused coverage proves a blocking issue opens the affected Passage, closes, and can be reopened from the persistent top status.                                                                                                                                               |
| Command palette                                        | PASS                          | Tests cover available canonical actions, absence of invented block action, modal search focus, Escape close, focus restoration, and Ctrl+K opening.                                                                                                                            |
| Canvas view foundation                                 | PASS                          | Test covers the keyboard-reachable zoom control and local 100% to 110% state without changing an existing Passage.                                                                                                                                                             |
| TypeScript                                             | INHERITED ENVIRONMENT BLOCKER | `tsc --noEmit` reaches only two existing unrelated unresolved optional provider imports: `src/wayfarer/transactional-email.ts` cannot resolve `postmark` and `resend`. No diagnostic names a changed Shipwright file. This is not treated as a pass or as a Shipwright defect. |
| Full registered suite/finalizer                        | NOT RUN                       | Requires the current Sounding Line registered workflow and its authoritative final receipt; do not infer it from this focused run.                                                                                                                                             |
| Browser/responsive/accessibility matrix                | NOT RUN                       | Must be executed from a suitable local runtime against the owner walkthrough matrix before any release claim.                                                                                                                                                                  |

## Runtime provenance

The repository lives on a UNC share, which causes Vitest worker/module-resolution failure when invoked from its UNC dependency tree. Focused evidence used the task worktree at `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\treasurehuntSoT-shipwright-phase1-v2`, the bundled Node runtime, and a local existing dependency cache. This is a diagnostic execution arrangement only; it does not alter package lockfiles or package-manager authority.

## Required next validation

1. Re-run registered `component.studio` and `browser.studio` families through the current Sounding Line process.
2. Collect desktop, tablet, and phone walkthrough evidence for Library / Canvas / Inspector, command palette, selection shelf, canvas view controls, and reduced motion.
3. Confirm no active transform conflict between dnd-kit and presentation motion in a browser.
4. Run the authoritative finalizer and record the resulting receipt before any release or protected-main claim.
