# Project Lanternwake Phase 6 Baseline Record

Date: 2026-07-21

## Selected baseline

| Item                         | Verified value                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Repository root              | `//US-VT-FS01/Users/kgray/My Documents/treasurehunt/forever-treasure-companion`                                         |
| Canonical checkout           | `//US-VT-FS01/Users/kgray/My Documents/treasurehunt/forever-treasure-companion` on `work/lanternwake-latest`            |
| Canonical checkout state     | Pre-existing untracked governing PDFs only; no tracked changes were modified.                                           |
| Current remote `origin/main` | `0ecd2f9cca6116e2f7f9ab4408ade749fb061e72` (`chore(integration): reconcile Lanternwake Phase 5 and Universal Language`) |
| Selected Phase 6 base        | `0ecd2f9cca6116e2f7f9ab4408ade749fb061e72`                                                                              |
| Phase 6 branch               | `codex/project-lanternwake-phase-6-make-it-seaworthy`                                                                   |
| Phase 6 worktree             | `//US-VT-FS01/Users/kgray/My Documents/treasurehunt/Forever-Treasure-Lanternwake-Phase-6`                               |
| Phase 6 upstream             | `origin/main`                                                                                                           |

The branch was created cleanly at the selected base. At the time of creation it had no staged, unstaged, or untracked files.

## Phase 1-5 and Universal Language proof

`origin/main` includes the Phase 5 merge `bbd86bd0f` and the Universal Language merge `b5b5d6351`, followed by the deliberate reconciliation commit `0ecd2f9c`. Its ancestry includes Phase 4 formal acceptance `f6e1827e`, Phase 5 checkpoint `37693dae`, and Universal Language completion `47e5e6d`.

`git merge-base origin/main integration/lanternwake-phase5-universal-language` returned `0ecd2f9cca6116e2f7f9ab4408ade749fb061e72`. Therefore the clean integrated animation/language baseline is already `origin/main`; no history from the candidate integration branch is needed to start Phase 6.

The reported commit `a0a2111ced1c9ef840fde214763fda9144ce41d4` is an immediate child of that baseline, not the required base. Its sole change is the final reconciliation-hash record. It contains no Project One Voyage implementation, but selecting it would introduce needless candidate-branch-only history.

## Explicit candidate exclusions

| Project     | Frozen branch / commit                                                                           | Graph proof                                                                                                                                                                                           | Phase 6 decision                                                             |
| ----------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| One Voyage  | `integration/lanternwake-phase5-universal-language` / `4e8f385687b01aa6b1e97452ff76e6e7e3b58b8c` | `origin/main..integration/lanternwake-phase5-universal-language` is exactly `a0a2111c` then `4e8f3856`; the latter changes Prisma, Chronicle/domain code, migrations, and Project One Voyage records. | Excluded. No merge, cherry-pick, schema, migration, or implementation reuse. |
| Wayfarer    | `codex/project-wayfarer-phase1-unified-identity` / `a478d7957e112c9ce6f63fd423746d3df2a697ce`    | Its merge base with `origin/main` is `0ecd2f9c`; its exclusive commits are `876d7aaa9` and `a478d7957`.                                                                                               | Excluded.                                                                    |
| Sealed Hold | `codex/project-sealed-hold-phase1` / `4b93b4f4554ba504bec6d6462d39960dd28b4afe`                  | Its merge base with `origin/main` is `0ecd2f9c`; its exclusive commit is `4b93b4f4`.                                                                                                                  | Excluded.                                                                    |
| Harborlight | `codex/project-harborlight-phase1-chart-the-harbor` / current local tip `0ecd2f9c`               | The checked-out Harborlight worktree is currently at the selected baseline. Local branch history additionally shows candidate commit `25375908f` outside this base.                                   | Excluded; no Harborlight implementation is present in the selected base.     |

The remote SHA was independently confirmed with `git ls-remote origin`; the required `git fetch origin --prune` completed with automatic maintenance disabled after Git's initial automatic repack was stopped. No refs were rewritten.

## Active worktrees at preflight

- Canonical: `forever-treasure-companion` — `work/lanternwake-latest` at `7c3677035`.
- One Voyage candidate: `Forever-Treasure-Integration` — `integration/lanternwake-phase5-universal-language` at `4e8f3856`.
- Universal Language: `Forever-Treasure-Language` — `development/universal-language` at `47e5e6d`.
- Phase 5: `Forever-Treasure-Lanternwake-Phase-5` — `development/lanternwake-phase-5` at `37693dae`.
- Wayfarer: `Forever-Treasure-Wayfarer-Phase-1` — `codex/project-wayfarer-phase1-unified-identity` at `a478d795`.
- Sealed Hold: `Forever-Treasure-Sealed-Hold-Phase-1` — `codex/project-sealed-hold-phase1` at `4b93b4f4`.
- Harborlight: `Forever-Treasure-Harborlight-Phase-1` — `codex/project-harborlight-phase1-chart-the-harbor` at `0ecd2f9c`.
- Other registered historical/validation worktrees were retained unchanged.

## Baseline decision

Phase 6 must start at `0ecd2f9c`. It is the current remote mainline and contains the accepted Lanternwake Phases 1-5 and Universal Language work, while excluding Project One Voyage, Wayfarer, Sealed Hold, and Harborlight implementation. This decision is based on commit ancestry and diff inspection, not branch naming.
