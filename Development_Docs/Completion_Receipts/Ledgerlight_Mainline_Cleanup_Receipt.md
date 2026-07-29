# Ledgerlight Mainline Cleanup Receipt

**Status:** cleanup complete; final mainline merge and push pending.  
**Starting remote main:** `cea12ce12150635aa593ba214d21a6db7ec425a9`

## Consolidation result

- Canonical checkout: `\\gwplastics.com\VT\Users\kgray\My Documents\treasurehunt\forever-treasure-companion`.
- Canonical baseline before cleanup: `cea12ce12150635aa593ba214d21a6db7ec425a9`.
- Removed through `git worktree remove`: 25 clean, process-unowned worktrees
  whose HEAD was reachable from fetched `origin/main`.
- Deleted through `git branch -d`: 21 merged local branches. Two additional
  merged-to-main branches were retained because Git's upstream-aware `-d`
  safeguard refused them: `development/universal-language` and
  `codex/true-north-mainline-reconciliation-20260729`.
- Pruned Git worktree metadata with `git worktree prune --expire now`.

## Preserved worktrees

| Path                                                   | State at inventory                        | Preservation reason                                                                                                                      |
| ------------------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `forever-treasure-companion`                           | 15 untracked governing documents          | Preserved as local commit `4fef58987` on `safety/pre-consolidation-untracked-documents-20260729`; this checkout is now canonical `main`. |
| `fix-harborlight-community-listing-routes`             | 3 unstaged tracked deletions on `main`    | Preserved as local commit `e42e1e354` on `safety/pre-consolidation-main-20260729`.                                                       |
| `harborlight-phase1-validation`                        | modified SQLite Prisma schema             | Uncommitted work.                                                                                                                        |
| `phase2-mainline-convergence-gate-audit`               | clean, unmerged branch                    | HEAD is not represented in main.                                                                                                         |
| `project-harborlight-phase2-open-the-exchange`         | clean, unmerged branch                    | HEAD is not represented in main.                                                                                                         |
| `treasurehunt-p2-harborlight`                          | modified and untracked Harborlight source | Uncommitted work.                                                                                                                        |
| `treasurehuntSoT-harborlight-phase3-welcome-the-fleet` | deleted validation script                 | Uncommitted work.                                                                                                                        |
| `treasurehuntSoT-phase3-phase4-convergence`            | modified/deleted migration and scripts    | Uncommitted work.                                                                                                                        |
| `treasurehuntSoT-sealed-hold-phase4`                   | deleted runtime and validation scripts    | Uncommitted work.                                                                                                                        |
| `treasurehuntSoT-sounding-line-governance`             | clean, unmerged branch                    | Project Sounding Line was explicitly out of scope.                                                                                       |
| `treasurehuntSoT-true-north`                           | deleted runtime and validation scripts    | Uncommitted work.                                                                                                                        |
| `treasurehuntSoT-wayfarer-phase4`                      | untracked `tmp` directory                 | Uncommitted runtime artefact.                                                                                                            |
| `wayfarer-phase2-baseline-validation`                  | untracked `pnpm-lock.yaml`                | Uncommitted runtime artefact.                                                                                                            |

No process command line referenced any registered worktree during the inventory.

## Repository reconciliation

- Updated README, SECURITY, CHANGELOG, product, developer, and reference
  documentation to reflect the consolidated implementation and its limits.
- Preserved original Ledgerlight records as historical evidence and added the
  current mainline truth reconciliation record.
- Removed nine byte-identical legacy `docs/animation` duplicates after matching
  their archived hashes; retained the archived copies.
- Reclassified three ADRs under `Development_Docs/Architecture_Decisions`.
- Promoted Wayfarer Phases 3/4, Sealed Hold Phases 3/4, Harborlight Phase 3,
  True North, and Ledgerlight catalog claims into owning fragments; removed
  obsolete branch-complete fragments.
- Rebuilt `Development_Docs/document-index.json`, the migration matrix, and
  generated `Development_Docs/Features/FEATURE_CATALOG.md` from source
  fragments.
- Corrected the stale pre-convergence browser language while preserving
  `P34-BME-20260729` as risk acceptance rather than a full matrix pass.

## Residual artefacts and limits

Five Git-unregistered local directories could not be removed after
`git worktree remove` because Windows rejected their long paths. They are not
registered worktrees and contain no `.git` link:

- `project-wayfarer-phase2-full-profile-preferences`
- `treasurehuntSoT-ledgerlight-documentation`
- `treasurehuntSoT-phase3-phase4-convergence-continuation`
- `treasurehuntSoT-sealed-hold-phase3`
- `treasurehuntSoT-wayfarer-phase3`

The configured shell lacked npm and UNC installation failed; the isolated local
fallback is documented in the validation record. No private content or secrets
were introduced. Final validation and remote parity are recorded at closure.
