---
title: Project Shipwright Phase 2 Mainline Safety Manifest
audience: engineering
status: active
canonical_for: project-shipwright-phase-2-mainline-safety
last_reviewed: 2026-08-12
---

# Project Shipwright Phase 2: Fit the Tools - Mainline Safety Manifest

## Source identity

| Field                  | Value                                                                           |
| ---------------------- | ------------------------------------------------------------------------------- |
| Branch                 | `codex/project-shipwright-phase2-fit-the-tools-r2`                              |
| Original base          | `191a964488d0df71f8dcb91c5b8372fc73b6b32e` (`origin/main` at worktree creation) |
| Schema / Prisma impact | None                                                                            |
| Current state          | Candidate qualification complete; owner product gate pending                    |

## Safety assertions under test

- Existing Studio draft/autosave/history/preview/publish calls remain the mutation and authority boundary.
- Every current registered type resolves to a UI strategy; unknown types use a schema-aware safe fallback rather than disappearing.
- Drydock remains source of contracts, defaults, migration output, variable type checking, graph-edge compatibility projection, issue severity, and remediation.
- Variable rename preserves the stable Drydock variable ID, updates only governed references, leaves prose untouched, and enters the existing undo/autosave flow.
- Migration application is creator-confirmed and revision-guarded; its structural preview and applied output are derived from the Drydock parser, not from a Shipwright migration encoder.
- Mode preference is presentation-only local storage, not Chronicle data.
- Existing Passage motion controls remain represented through the existing presentation fields and reduced-motion policy.
- The Inspector and all new controls remain keyboard reachable, with semantic labels, visible focus, section disclosure, and responsive narrow-screen styling.
- A 100-Passage synthetic component regression and a task-owned Chromium journey cover Inspector selection and desktop/tablet/phone reachability without shared runtime data.

## Candidate safety attestation

`MAINLINE_SAFETY_CONTRACT = PASS_FOR_OWNER_CANDIDATE`.

Permanent-stop proof: **YES**. If Shipwright Phase 3 is never built, all 23 current active Story Block types remain authorable through a contract-aware editor strategy or the safe schema-aware fallback, and valid Chronicles retain the existing autosave, undo/redo, preview, validation, publication, and runtime boundaries. The qualification suite includes a 100-Passage selection regression, all 23 Drydock contracts, and the isolated Creator browser journey.

This local safety pass is not a substitution for the remaining owner product gate, exact-source Sounding Line decision, or protected-main integration. Those acceptance layers remain pending.
