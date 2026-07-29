# Project Lanternwake Phase 6 — Account-Switch Continuation

Recorded 2026-07-25 after the targeted audio lifecycle runner reached a terminal result. This is a deliberate checkpoint for changing the Codex account; it is **not** a Lanternwake completion receipt and main has not been merged.

## Repository state

- Repository/worktree: `Kgray44/treasurehuntSoT` at `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\lanternwake-phase6-mainline`
- Current branch: `integration/lanternwake-phase6-mainline`
- Branch base: `origin/main` and merge-base `6bd8209d2d7f0edc73da9566fd06e825ae51a602`
- Source checkpoint HEAD before committing this record: `0ad8ab0e78235f0bf6556f1df9cc5930bba1c6c3` (`test(lanternwake): locate readable page status`)
- Remote integration HEAD at checkpoint: `0ad8ab0e78235f0bf6556f1df9cc5930bba1c6c3`
- Ahead/behind at checkpoint: `0/0`
- Complete Git status at checkpoint: clean (`git status --short` produced no entries; `git status --branch --short` reported only `integration/lanternwake-phase6-mainline...origin/integration/lanternwake-phase6-mainline`).
- Latest pushed functional commit: `0ad8ab0e78235f0bf6556f1df9cc5930bba1c6c3`.

This record itself must be committed and pushed as the next, documentation-only checkpoint. After that push, verify the new local and remote integration SHA match before doing any other work.

## Terminal targeted audio proof

Command consumed to completion (do **not** rerun as part of the account switch):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-all.ps1 -SkipBrowserInstall -BrowserOnly -BrowserTestPath tests/e2e/phase3-lifecycle-extended.spec.ts -BrowserGrep "audio .* twenty page-turn cycles"
```

Result: failed after the repository harness prerequisites completed. Playwright ran six entries: the readonly setup passed, `audio success remains nonblocking and releases work for twenty page-turn cycles` failed after 31.1 seconds, and the remaining four audio variants did not run.

Exact failure:

```text
expect(locator('.voyage-shell.view-journal')).toHaveAttribute("data-journal-phase", "JOURNAL_READY")
Timeout 10000ms: locator('.voyage-shell.view-journal') was not found.
tests/e2e/phase3-lifecycle-extended.spec.ts:1097
```

The failure occurred after the forward and reverse page controls had already returned the accessible `Page 3 of 6` status to their initial semantic position. The error-context snapshot contains the canonical readable journal and `Opening skipped. The journal is ready.` status, but no retired `.voyage-shell.view-journal` wrapper. Treat this as the next narrow test-architecture investigation; no repair was made after the failure.

Preserve these targeted-proof artifacts:

- `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\validation\artifacts\validation\playwright\phase3-lifecycle-extended--c0d31-for-twenty-page-turn-cycles-chromium\error-context.md`
- `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\validation\artifacts\validation\playwright\phase3-lifecycle-extended--c0d31-for-twenty-page-turn-cycles-chromium\test-failed-1.png`
- `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\validation\artifacts\validation\playwright\phase3-lifecycle-extended--c0d31-for-twenty-page-turn-cycles-chromium\video.webm`
- `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\validation\artifacts\validation\playwright\phase3-lifecycle-extended--c0d31-for-twenty-page-turn-cycles-chromium\trace.zip`
- `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\validation\artifacts\validation\database-isolation-report.json`

The isolation report is `browser-failed-isolation-verified`: the canonical `prisma\dev.db` SHA remained `81e05080578e2247d24190c8bc7f163e198cafed7bba9baaa6b3b659bcee2710` and the task-owned isolated database absorbed the expected browser mutations.

## Full extended-lifecycle history

The governed file is `tests/e2e/phase3-lifecycle-extended.spec.ts`. Its 20 Playwright entries consist of the readonly setup plus 19 product lifecycle tests.

1. `lanternwake-extended-final-20260725-1552.out.log` was an earlier complete-file attempt. It reached the first 14 entries, then stopped at the Quartermaster confirmation case because its old `Add Player Log Entry` label was retired; five entries did not run.
2. `lanternwake-extended-full-20260725-1740.out.log` was the latest complete-file attempt before this checkpoint, run from the post-Quartermaster repair state. It passed the setup and the following 14 product cases, then timed out on audio success at the old dynamic PageFlip-clone selector; four audio cases did not run:
   - successful Rive showcase remount (20 cycles)
   - Rive 404 fallback (20 cycles)
   - Rive abort fallback (20 cycles)
   - Rive malformed-payload fallback (20 cycles)
   - invitation Rive remount (20 cycles)
   - canonical journal route remount (20 cycles)
   - Lottie success contracts (20 route cycles)
   - Lottie 404 fallback (20 cycles)
   - Lottie abort fallback (20 cycles)
   - Lottie malformed-payload fallback (20 cycles)
   - Lottie stalled-load fallback (20 cycles)
   - Lottie renderer-error fallback (20 cycles)
   - Showcase serial trailer (20 enter/leave cycles)
   - Quartermaster confirmation/focus/overlay lifecycle (20 cycles)
3. The focused audio attempt recorded above replaced the stale dynamic PageFlip marker with the readable page counter, reached the first audio-success test, and then stopped at the remaining stale `.voyage-shell.view-journal` readiness assertion. It is not a pass and does not authorize a full rerun.

Previously recorded focused evidence also remains valid and must not be rerun merely to change accounts: journal accessibility (3), event matrix (9), motion policy (10), replay (2), Chronicle lifecycle (2), showcase Rive remount (2), invitation Rive (2), Lottie success (2), and Lottie static fallback cases (4). Dedicated PageFlip tests retain runtime/clone authority coverage; the audio test must not be made to substitute for that coverage.

## Repairs made since the prior complete-file run

The post-`b168ecba` lifecycle repair chain is pushed and must be preserved:

- `562629ddd` aligned the retired crew-log confirmation label.
- `d200973e1` selected the canonical `Confirm Voyage action` control.
- `4cfa562a6` retired an obsolete, racy command-skip branch.
- `3010fa08e` removed a Playwright-incompatible regex flag from the captain-notice selector.
- `7a64e632a` removed racy cleanup clicks against self-removing captain notices.
- `ba32db72e` scoped the Captain framework-listener aggregate out of the Quartermaster browser remount snapshot while retaining concrete cleanup and focused owned-listener coverage.
- `04c778304` replaced the audio test's dynamic PageFlip-clone requirement with the accessible semantic page position because canonical readiness deliberately enters the readable PageFlip fallback.
- `0ad8ab0e7` made that readable-page selector independent of the compatibility wrapper that is absent in the canonical journal route.

The remaining failed selector at line 1097 was discovered only after the last two commits. Do not alter source or assertions until its exact canonical readiness owner is inspected. Do not randomize logical keys or weaken authoritative SceneHost ownership.

## Safe resumption sequence

1. Verify this documentation checkpoint is pushed and that local/remote integration parity is exact.
2. Inspect the terminal targeted-audio artifacts above and repair only the `.voyage-shell.view-journal` readiness assertion or the exact product defect that evidence proves.
3. Run the affected focused audio proof, commit it, and push it.
4. Only after the focused audio proof passes, restart the complete governed lifecycle file exactly once with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-all.ps1 -SkipBrowserInstall -BrowserOnly -BrowserTestPath tests/e2e/phase3-lifecycle-extended.spec.ts
```

5. Consume the full terminal result. Do not continue Lanternwake finalization, build, reconciliation, or merge work until all 20 Playwright entries pass.

## Runtime cleanup and isolation

- The earlier full-run root process `43032` has exited.
- The targeted runner was consumed to terminal completion. Its task-owned validation server was recorded as server PID `8592` with launcher PID `23416`; both have been released. No task-owned Node process remained.
- Ports `3100` and `3200` had no listening owner at checkpoint.
- `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\validation-runtime.lock` was available for an exclusive open; it was not deleted or modified.
- Canonical database: `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\lanternwake-phase6-mainline\prisma\dev.db`.
- Isolated test runtime/database root: `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\validation\prisma\`; latest isolated file was `validation-isolated-20260725-181320449-74a43e7118224e06b7c5fa17437380d4.db`.
- Test artifacts and browser storage are under `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\validation\artifacts\validation\`; browser state is task-isolated and ephemeral.
- Preserve the prior full-run logs `lanternwake-extended-final-20260725-1552.out.log` and `lanternwake-extended-full-20260725-1740.out.log` (and their `.err.log` companions) in `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\`.

Other pre-existing PowerShell processes and all non-Lanternwake worktrees were left untouched. No unrelated worktree, process, branch, canonical database, or main branch was altered. Do not merge to main during the account switch.
