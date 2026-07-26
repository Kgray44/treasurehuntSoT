# Phase 3-4 Validation Worktree Incident Record

## Scope and status

- Incident date: 2026-07-26.
- Affected path: `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\validation`.
- Convergence source path: `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\treasurehuntSoT-phase3-phase4-convergence-continuation`.
- Browser, restart, closure, push, and mainline-promotion work remains paused.
- This record does not restore, clean, reset, or otherwise modify the affected directory.

## Discovery and current inspection

The issue was discovered after a validation invocation reported its runtime under the fixed local `validation` path. The affected path contained a `.git` file and pre-existing uncommitted work before the invocation. The current `.git` pointer now references the continuation worktree administration directory, so the affected path is no longer listed as its prior independent worktree identity.

Read-only inspection found:

- Current apparent branch: `codex/phase3-phase4-cross-project-convergence-continuation`.
- Current apparent HEAD: `737d835fb0c95666c1eabfc8abe9523dcbe2d882`.
- No staged files.
- Current modified files: this incident record's three prior convergence documentation edits, five MySQL migration index-name edits, `scripts/rehearse-project-one-voyage-phase2-mysql.ps1`, and `tsconfig.json`.
- Current untracked path: `artifacts/project-one-voyage-isolation-907a2c86029a473bb4a3635c8ebe0b28.json`.

The affected worktree must not be treated as restored, clean, or safe to reuse until its owner confirms its intended contents.

## Known overwritten file

`src/components/platform/InvitationCeremony.tsx` was observed as modified before the incident. It is now clean relative to the apparent HEAD and has blob SHA-1 `3069d1d3d44f2d6cb874d990070bc731f8cd2b38` (raw file SHA-1 `1eb189666851ba793e817111ec01790039fe3161`), matching the continuation worktree and `origin/main`.

This proves the current file is the committed mainline/convergence version. It does not reconstruct the former uncommitted version.

## Recovery evidence

The following read-only evidence sources were inspected:

- every local project worktree below the repository-family root;
- validation logs, rehearsal directories, validation-run directories, and runner directories;
- VS Code, Code Insiders, Cursor, VSCodium, and JetBrains local-history locations when present;
- existing stashes and reflogs;
- historical committed versions of `InvitationCeremony.tsx`.

No candidate recovered the prior uncommitted contents with high confidence. No editor local-history locations were present, no relevant stash entry existed, and no backup, temporary, conflict, or mirror copy was found. A Git unreachable-object scan was attempted read-only but exceeded the controlled command timeout without producing a candidate; it must not be interpreted as recovery evidence.

Historical committed variants exist, but are not candidates for an uncommitted restoration: their blob IDs are `2ef1cba714927674a099a0f8b3c1cb87b61b6176`, `47b2f406a865bbd87cabaab0efff17e31b471847`, and `3c825f9df416abb4198dedafb87d7a1534aa498e`.

## Root cause and potential damage scope

`scripts/dev-common.ps1` selected the fixed path `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\validation` whenever validation mode was used. It then ran:

```text
robocopy <project-root> <runtime-root> /MIR /XD <directory exclusions> /XF *.db *.db-journal *.log .forever-dev.json .forever-lock.sha
```

`/MIR` overwrites matching files and deletes destination files absent from the source. The `.git` exclusion was directory-only; in a linked worktree `.git` is a file, so it was copied and redirected the affected directory's Git administration pointer. The harness also cleared `artifacts\validation` and generated development files under `.next`.

Complete potential-damage scope is every non-excluded source-tree file and directory admitted by that command, plus the `.git` file. Excluded directories were `.git`, `.forever`, `node_modules`, `node_modules.failed`, `.next`, `artifacts`, `coverage`, `test-results`, and `playwright-report`; excluded file patterns were `*.db`, `*.db-journal`, `*.log`, `.forever-dev.json`, and `.forever-lock.sha`. Therefore any pre-existing edited, deleted, or untracked item outside those exclusions could have been overwritten or removed. Known affected paths are `.git`, `src/components/platform/InvitationCeremony.tsx`, `tsconfig.json`, and the prior contents of `artifacts\validation`; additional source-tree damage cannot be excluded without the owner's prior inventory.

## Commands intentionally avoided

No restore, checkout, reset, clean, stash apply, stash drop, merge, rebase, force push, index update, or validation rerun was used during the incident inspection. No candidate content was written back to the affected worktree.

## Harness repair

Validation runs now create a new marker-owned directory below `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\Validation_Runs`. The repair:

- rejects a runtime parent or destination that is inside a Git worktree;
- rejects any runtime containing `.git`;
- never selects the historical fixed `validation` path;
- rejects an already-existing destination;
- writes an ownership marker and lifecycle events before synchronization;
- uses `robocopy /E`, not `/MIR`, and explicitly excludes the `.git` file;
- permits cleanup only after verifying the exact ownership marker and records a cleanup receipt in the task-owned run parent.

`scripts/test-validation-runtime-safety.ps1` regression-tests Git-worktree rejection, dirty-Git rejection, existing non-owned-directory rejection, fresh non-Git runtime creation, marker verification, owned-only cleanup, sibling preservation, and avoidance of the historical fixed path.

## Required user decision

The original uncommitted `InvitationCeremony.tsx` content is not recoverable with high confidence. User confirmation is required before any attempt to repair the affected validation directory, accept its current version, or resume convergence validation.
