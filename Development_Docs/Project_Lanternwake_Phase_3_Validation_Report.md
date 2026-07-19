# Project Lanternwake Phase 3 — Validation Report

## 1. Metadata and truth boundary

| Field                                | Value                                               |
| ------------------------------------ | --------------------------------------------------- |
| Phase                                | Phase 3 — Unfurl the Tale                           |
| Branch                               | `codex/project-lanternwake-phase-3-unfurl-the-tale` |
| Phase 3 base / Phase 2 final handoff | `7747ce5b472fdb19b9fe8f35ea12fbe974902fe7`          |
| Integrated implementation SHA        | **PENDING**                                         |
| Evidence SHA                         | **PENDING**                                         |
| Validation run ID                    | **PENDING**                                         |
| Validation started / finished UTC    | **PENDING** / **PENDING**                           |
| Validator                            | **PENDING**                                         |
| Verdict                              | **PENDING — no release verdict has been issued**    |

This is the required evidence structure for Phase 3. A `PENDING` cell is not a pass. This report must be updated only from command output and artifacts produced against the final integrated SHA. Documentation-lane checks recorded below are preliminary and do not replace the coordinator-owned integrated gate.

## 2. Reconciliation and coverage-ledger gate

Program-wide reconciliation remains defined as 220 Codex plus 238 OA, or 458 accepted requirements, 361 matrix rows, zero accepted unmapped requirements, and zero unresolved requirements. Phase 3 owns 189 unique accepted requirements: 90 Codex plus 99 OA. Its 152 physical matrix rows include OA carriers and are not additive to 189.

| Check                     | Exact command                                                                                                                                                                                                                                                                                                                                                                                            | Expected                                                                                       | Integrated result            | Evidence                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------- |
| Program reconciliation    | `python scripts/validate_animation_reconciliation.py --oa-source Development_Docs/KG_Original_Animation_Audit_Reconciliation_Source.md --matrix Development_Docs/Animation_System_Audit_Matrix.csv --ledger Development_Docs/Animation_Original_Audit_Reconciliation_Ledger.csv --shard-manifest Development_Docs/Project_Lanternwake_Phase_2_Reconciliation_Shard_Manifest.csv --mode final --no-write` | 458 accepted; 361 matrix; 0 unmapped; 0 unresolved                                             | **PENDING**                  | run ID / log: **PENDING**                                                              |
| Reconciliation unit tests | `python -m unittest scripts.tests.test_validate_animation_reconciliation`                                                                                                                                                                                                                                                                                                                                | exit 0                                                                                         | **PENDING**                  | run ID / log: **PENDING**                                                              |
| Phase 3 ledger            | `python scripts/validate_phase3_player_event_ledger.py --ledger Development_Docs/Project_Lanternwake_Phase_3_Player_Event_Coverage_Ledger.csv --no-write`                                                                                                                                                                                                                                                | 301 rows; 17/17 events; 6/6 sections; 102/102 cases; 20 Journal-opening rows; 10 PageFlip rows | **PENDING integrated rerun** | preliminary documentation-lane run: exit 0 on 2026-07-19; final run/SHA **PENDING**    |
| Phase 3 ledger unit tests | `python -m unittest scripts.tests.test_validate_phase3_player_event_ledger`                                                                                                                                                                                                                                                                                                                              | 14 tests; exit 0                                                                               | **PENDING integrated rerun** | preliminary documentation-lane run: 14 passed on 2026-07-19; final run/SHA **PENDING** |

## 3. Runtime and database isolation

Mutation-capable browser validation must run only through `npm run validate`, whose `scripts/test-all.ps1` owner creates a unique copied SQLite database, proves its absolute path and nonce through the running application, records the owned PID and port, and verifies the canonical SQLite family unchanged afterward. An alternate worktree or port alone is not isolation.

| Evidence                                 | Required value       |
| ---------------------------------------- | -------------------- |
| Canonical database absolute path         | **PENDING**          |
| Canonical pre-run SHA-256 / size / mtime | **PENDING**          |
| Isolated database absolute path          | **PENDING**          |
| Isolation nonce hash                     | **PENDING**          |
| Validation server PID / port             | **PENDING** / `3100` |
| Production server PID / port             | **PENDING** / `3200` |
| Post-run canonical-family verification   | **PENDING**          |
| Port 3100 and 3200 release proof         | **PENDING**          |

If isolation preparation, runtime identity, canonical-family verification, or cleanup fails, classify the affected mutation gate as `database-isolation`; do not run or count mutation cases.

## 4. Exact command matrix

| Order | Gate                     | Exact command                                                                                                                                                                                                                                                                                                                                                                                            | Exit        | Counts / artifact                                   | Run ID      | SHA         | Status      |
| ----: | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------- | ----------- | ----------- | ----------- |
|     1 | Diff whitespace          | `git diff --check`                                                                                                                                                                                                                                                                                                                                                                                       | **PENDING** | **PENDING**                                         | **PENDING** | **PENDING** | **PENDING** |
|     2 | Reconciliation           | `python scripts/validate_animation_reconciliation.py --oa-source Development_Docs/KG_Original_Animation_Audit_Reconciliation_Source.md --matrix Development_Docs/Animation_System_Audit_Matrix.csv --ledger Development_Docs/Animation_Original_Audit_Reconciliation_Ledger.csv --shard-manifest Development_Docs/Project_Lanternwake_Phase_2_Reconciliation_Shard_Manifest.csv --mode final --no-write` | **PENDING** | **PENDING**                                         | **PENDING** | **PENDING** | **PENDING** |
|     3 | Reconciliation tests     | `python -m unittest scripts.tests.test_validate_animation_reconciliation`                                                                                                                                                                                                                                                                                                                                | **PENDING** | **PENDING**                                         | **PENDING** | **PENDING** | **PENDING** |
|     4 | Phase 3 ledger           | `python scripts/validate_phase3_player_event_ledger.py --ledger Development_Docs/Project_Lanternwake_Phase_3_Player_Event_Coverage_Ledger.csv --no-write`                                                                                                                                                                                                                                                | **PENDING** | **PENDING**                                         | **PENDING** | **PENDING** | **PENDING** |
|     5 | Phase 3 ledger tests     | `python -m unittest scripts.tests.test_validate_phase3_player_event_ledger`                                                                                                                                                                                                                                                                                                                              | **PENDING** | **PENDING**                                         | **PENDING** | **PENDING** | **PENDING** |
|     6 | Format                   | `npm run format:check`                                                                                                                                                                                                                                                                                                                                                                                   | **PENDING** | **PENDING**                                         | **PENDING** | **PENDING** | **PENDING** |
|     7 | Lint                     | `npm run lint`                                                                                                                                                                                                                                                                                                                                                                                           | **PENDING** | **PENDING**                                         | **PENDING** | **PENDING** | **PENDING** |
|     8 | Strict TypeScript        | `npm run typecheck`                                                                                                                                                                                                                                                                                                                                                                                      | **PENDING** | **PENDING**                                         | **PENDING** | **PENDING** | **PENDING** |
|     9 | Unit/component           | `npm test`                                                                                                                                                                                                                                                                                                                                                                                               | **PENDING** | files/tests: **PENDING**                            | **PENDING** | **PENDING** | **PENDING** |
|    10 | Animation assets         | `npm run assets:validate`                                                                                                                                                                                                                                                                                                                                                                                | **PENDING** | **PENDING**                                         | **PENDING** | **PENDING** | **PENDING** |
|    11 | Isolated integrated gate | `npm run validate`                                                                                                                                                                                                                                                                                                                                                                                       | **PENDING** | Vitest / Playwright / build / restarts: **PENDING** | **PENDING** | **PENDING** | **PENDING** |
|    12 | Production performance   | performed inside `npm run validate` as `playwright test --config=playwright.phase3-performance.config.ts` against the owned production server                                                                                                                                                                                                                                                            | **PENDING** | trace/report: **PENDING**                           | **PENDING** | **PENDING** | **PENDING** |
|    13 | Final sync dry-run       | `python scripts/sync_codex_chats.py --dry-run`                                                                                                                                                                                                                                                                                                                                                           | **PENDING** | structured report: **PENDING**                      | **PENDING** | **PENDING** | **PENDING** |
|    14 | Final sync               | `python scripts/sync_codex_chats.py`                                                                                                                                                                                                                                                                                                                                                                     | **PENDING** | commit/push: **PENDING**                            | **PENDING** | **PENDING** | **PENDING** |
|    15 | Final sync validation    | `python scripts/sync_codex_chats.py --validate`                                                                                                                                                                                                                                                                                                                                                          | **PENDING** | scoped diff / remote SHA: **PENDING**               | **PENDING** | **PENDING** | **PENDING** |

`npm run test:e2e` is a focused browser command, but it is not authority to bypass the unique copied-database harness for mutation cases. The release evidence comes from the integrated harness.

## 5. Phase 1 and Phase 2 dependency proof

Phase 1 and Phase 2 evidence may be consumed only when its code and contracts remain present on the integrated Phase 3 SHA. Phase 2’s accepted boundary is 59 Vitest files / 452 tests, 48 Playwright passes / 30 intentional skips / 0 failures across six viewports in Chromium and WebKit, plus canonical build and two restart probes. Its combined `npm run validate` exited 1 at the build step because of a temporary `node_modules` junction; the later junction-free build and restart evidence passed. Phase 3 must preserve both facts.

| Dependency assertion                                                      | Phase 3 regression result |
| ------------------------------------------------------------------------- | ------------------------- |
| Phase 1 receipt/fallback/replay/motion contracts                          | **PENDING**               |
| Phase 2 host/target/ownership/PageFlip/final-state contracts              | **PENDING**               |
| Phase 2 intentional skips remain classified rather than counted as passes | **PENDING**               |
| No dependency junction in the final validation worktree                   | **PENDING**               |

## 6. Persistent host, queue, and 102-case matrix

The baseline matrix is exactly 17 event types × six starting sections at full motion and 1440×900. Every case must prove one persistent `player-progression` host, correct event policy, deterministic queue order, unique readable global target, no forced section navigation, optional local enhancement only when already mounted and ready, settled final state, focus/scroll restoration, acknowledgment order, and cleanup.

| Measure                                 |                         Required | Result      |
| --------------------------------------- | -------------------------------: | ----------- |
| Unique baseline cases                   |                              102 | **PENDING** |
| Passed                                  |                              102 | **PENDING** |
| Failed                                  |                                0 | **PENDING** |
| Skipped                                 | 0 unless individually classified | **PENDING** |
| Duplicate global host/target selections |                                0 | **PENDING** |
| Forced section changes                  |                                0 | **PENDING** |

Per-case evidence source and artifact links: **PENDING**.

## 7. Chapter release, replay, and acknowledgment

The twelve-step replay protocol must cover automatic receipt, completion, refresh, reconstruction from authorized Player-safe history, replay outside Journal, fresh request and scene identity, zero POST/PATCH/DELETE, no new progress event, no new viewed row, unchanged business snapshot, focus/section restoration, and cleanup. `CHAPTER_RELEASED` prose must be reconstructed only from currently authorized readable chapter data; otherwise the event is omitted from history.

| Assertion                                                                          | Result      |
| ---------------------------------------------------------------------------------- | ----------- |
| Automatic mandatory chapter release acknowledges only after a valid global receipt | **PENDING** |
| Failed/fallback-ineligible presentation stays retryable and unacknowledged         | **PENDING** |
| Batch viewed lookup is authorized, bounded, sorted, and deduplicated               | **PENDING** |
| Replay has fresh identity and permanent `acknowledgmentEligible=false`             | **PENDING** |
| Replay makes zero server/database mutation                                         | **PENDING** |
| Revoked/unreadable chapter content is absent                                       | **PENDING** |

## 8. Journal opening and PageFlip

Required opening profiles are first/full, returning/abbreviated, completed/archive, manual-full replay, and reduced. `JOURNAL_READY` requires a truthful `JournalReadyReceipt` and either a ready PageFlip runtime or verified readable static fallback. Page turns emit `turn-start`, `turn-commit`, `turn-settle`, `turn-cancel`, or `turn-failed` with current-boundary generation.

| Gate                    | Required                              | Result      |
| ----------------------- | ------------------------------------- | ----------- |
| Journal opening rows    | 20                                    | **PENDING** |
| PageFlip rows           | 10                                    | **PENDING** |
| Same-page request       | truthful cancellation/no-op           | **PENDING** |
| Queued turn             | rebased current page and generation   | **PENDING** |
| Failure/timeout         | readable static page; focus preserved | **PENDING** |
| Session identity change | old cursors/callbacks/state rejected  | **PENDING** |
| Archive mode            | quiet; no false live channel          | **PENDING** |

## 9. Section integrations

| Section                   | Required exact integration                                                               | Result      |
| ------------------------- | ---------------------------------------------------------------------------------------- | ----------- |
| Journal                   | current-visible primary page, exact chapter stamp/annotation, no hidden-source selection | **PENDING** |
| Voyage Chart              | keyed location marker and keyed route, Motion wrapper with bounded GSAP child            | **PENDING** |
| Treasure Altar / Artifact | exact slot, silhouette, connection endpoints, dialog-local engraving, focus return       | **PENDING** |
| Side Quests               | distinct quest-note and objective identity, no index selection                           | **PENDING** |
| Ship’s Log                | immutable progress-event ID row, fresh ink/date/symbol target split                      | **PENDING** |
| Finale                    | exact requirement socket and mechanism state/progress, nullable capability retraction    | **PENDING** |

## 10. Quartermaster, delivery, reconnect, and revocation

| Assertion                                                                                          | Result      |
| -------------------------------------------------------------------------------------------------- | ----------- |
| Commands, action/status routes, and Quartermaster pages require `CAPTAIN` capability               | **PENDING** |
| Payloads are discriminated, bounded, and idempotency fingerprints cover the full canonical request | **PENDING** |
| Expected sequence is enforced inside every business transaction                                    | **PENDING** |
| Commit, process publication, client delivery, presentation, and acknowledgment remain distinct     | **PENDING** |
| SSE subscribe/query overlap is ordered and deduplicated                                            | **PENDING** |
| Reconnect uses separate observed/queued/presented/acknowledged cursors                             | **PENDING** |
| Access revocation terminates retry/delivery and removes protected workspace content                | **PENDING** |
| Unexpected server errors remain generic and non-disclosing                                         | **PENDING** |

## 11. Modes, audio, Lottie, and Rive

At least 185 distinct M1–M5 cases are required: all 17 events in their relevant section, plus chapter release, pause, resume, and revert from every section. Browser reduced motion is an upper safety bound and cannot be bypassed.

| Gate                                                                               | Result                                                                             |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Distinct mode cases ≥185                                                           | **PENDING**                                                                        |
| Mode changes do not recreate or replay unrelated runtimes                          | **PENDING**                                                                        |
| Semantic audio starts only from active instance-scoped labels and is deduplicated  | **PENDING**                                                                        |
| Mute/load failure changes no meaning, state, focus, or acknowledgment              | **PENDING**                                                                        |
| Lottie one-shots are command/label driven and have reduced/failure outcomes        | **PENDING**                                                                        |
| Journal Clasp, Voyage Compass, and Finale Mechanism use truthful fallback adapters | **PENDING**                                                                        |
| Actual final `.riv` binaries                                                       | `missing-phase-5-asset` until supplied and validated; never a Phase 3 runtime pass |

## 12. Accessibility and six viewports

Required viewports are 2560×1440, 1920×1080, 1440×900, 430×932, 390×844, and 844×390. Chromium owns mutation flows; WebKit supplies read-only responsive, accessibility, denial, and presentation coverage.

For every required state record browser, viewport, mode, keyboard/touch path, axe result, horizontal-overflow result, focus origin/destination, live-region cardinality, PageFlip accessible-page cardinality, and artifact path. All are **PENDING**.

Release thresholds: zero serious/critical axe violations caused by Phase 3; one readable heading and controlled announcement per event; no hidden, inert, detached, stale, or unrelated focus target; Skip, Replay, destination, PageFlip, artifact, quest, log, finale, and reconnect controls reachable; no horizontal overflow or clipped controls; and readable behavior at 200% zoom where supported.

## 13. Performance and lifecycle

| Budget                                    | Threshold             | Result / artifact |
| ----------------------------------------- | --------------------- | ----------------- |
| Chapter release completion                | strictly `<10,000 ms` | **PENDING**       |
| Target preflight p95                      | `<50 ms`              | **PENDING**       |
| Skip/Replay/PageFlip input response       | `<100 ms`             | **PENDING**       |
| Interruption/unmount cleanup              | `<250 ms`             | **PENDING**       |
| Desktop frame-time p95                    | `≤25 ms`              | **PENDING**       |
| Mobile frame-time p95                     | `≤40 ms`              | **PENDING**       |
| App-attributable single stall             | `≤100 ms`             | **PENDING**       |
| Chapter cumulative long tasks             | `≤200 ms`             | **PENDING**       |
| Ordinary-transition cumulative long tasks | `≤100 ms`             | **PENDING**       |
| CLS                                       | `≤0.10`               | **PENDING**       |

The production performance run must use the owned optimized server at `127.0.0.1:3200`; development FPS and restart probes are not substitutes. Twenty-cycle runs must return hosts, targets, handles, generations, claims, runtimes, listeners, timers, EventSource instances, focus traps, clones, audio work, Lottie work, and pending WAAPI promises to baseline. Results and traces: **PENDING**.

## 14. Visual evidence

The canonical index is `Development_Docs/Project_Lanternwake_Phase_3_Visual_Checkpoint_Index.md`. It contains exactly 57 semantic checkpoint rows: 11 Journal, 14 chapter, six map, seven artifact, five quest, five log, and nine finale. Current status: **PENDING**; no screenshot path, hash, run ID, or SHA is claimed until a file is captured and verified.

## 15. Failure classification

Use only these classifications:

| Class                   | Meaning                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `task-regression`       | Phase 3 introduced or exposed a failure against the accepted integrated baseline.             |
| `pre-existing`          | Reproduced on the exact Phase 3 base with equivalent environment and data.                    |
| `environment`           | Toolchain, host, dependency, filesystem, browser, or runtime condition invalidated the check. |
| `database-isolation`    | Unique copied-database identity or canonical-family preservation was not proven.              |
| `missing-phase-5-asset` | A frozen Rive interface lacks the externally authored Phase 5 binary.                         |
| `blocked`               | A named prerequisite prevents execution and has an owner/recovery condition.                  |
| `unresolved`            | Evidence is insufficient to classify or repair before handoff.                                |

| Failure ID  | Gate/case   | Class       | Evidence    | Impact      | Recovery owner/action | Retest      | Status      |
| ----------- | ----------- | ----------- | ----------- | ----------- | --------------------- | ----------- | ----------- |
| **PENDING** | **PENDING** | **PENDING** | **PENDING** | **PENDING** | **PENDING**           | **PENDING** | **PENDING** |

## 16. Requirement totals and disposition

| Denominator                          | Total |   Validated |      Failed |     Blocked |  Unresolved |
| ------------------------------------ | ----: | ----------: | ----------: | ----------: | ----------: |
| Program accepted requirements        |   458 | **PENDING** | **PENDING** | **PENDING** | **PENDING** |
| Phase 3 accepted requirements        |   189 | **PENDING** | **PENDING** | **PENDING** | **PENDING** |
| Phase 3 baseline event/section cases |   102 | **PENDING** | **PENDING** | **PENDING** | **PENDING** |
| Phase 3 mode cases                   |  ≥185 | **PENDING** | **PENDING** | **PENDING** | **PENDING** |
| Visual checkpoints                   |    57 | **PENDING** | **PENDING** | **PENDING** | **PENDING** |

The three frozen final Rive binaries are `missing-phase-5-asset` and do not erase Phase 3’s obligation to provide readable CSS/SVG fallback behavior. No denominator may be reduced to make a verdict green.

## 17. Runtime, Git, and finalization proof

| Proof                                                                 | Value       |
| --------------------------------------------------------------------- | ----------- |
| Complete final working-tree classification                            | **PENDING** |
| Integrated implementation commit                                      | **PENDING** |
| Evidence/finalization commit                                          | **PENDING** |
| Local/remote branch equality                                          | **PENDING** |
| Remote SHA                                                            | **PENDING** |
| Canonical DB unchanged                                                | **PENDING** |
| Ports 3100/3200 released                                              | **PENDING** |
| Chat archive dry-run / ingest / validate                              | **PENDING** |
| Development docs eligible/excluded/suspicious/large/conflicted status | **PENDING** |

## 18. Verdict

**PENDING — Phase 3 is not validated by this scaffold.**

A final verdict requires every command and denominator above to be populated from the same final integrated SHA, all nonzero/skipped/blocked results to remain explicit, the production performance and lifecycle gates to complete, the visual index to reference real verified artifacts, Git/remote parity to be proven, and the single final synchronization workflow to succeed. Until then, no `GO`, release-ready, production-art-ready, all-viewports, performance-safe, or leak-safe claim is authorized.
