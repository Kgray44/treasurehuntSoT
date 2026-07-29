# Project Lanternwake Phase 2 Validation Report

Status: **composite validation accepted; repository synchronization and remote publication pending**

Date: 2026-07-18  
Branch: `codex/project-lanternwake-phase-2-claim-the-deck`  
Starting commit: `fb8eb4ac33f4a44028fe82fb08df0ac0e5021db6`  
Implementation commit: `d529b59e06ad1f2d736f6e1b888ebb78f169dcc0`
Evidence-document follow-up commit: to be recorded after commit

## 1. Truth boundary

This report distinguishes accepted current evidence from planned or in-progress checks. A patch, worker completion, test inventory, historical Phase 1 result, skipped case, or fix-needed audit is not a Phase 2 pass. Accepted evidence below records the exact command family, exit classification, counts, environment, and recovery proof. The combined `npm run validate` process is explicitly **not** called a zero-exit pass: it exited 1 at the production-build step because the temporary worktree `node_modules` junction was incompatible with that worker/Turbopack environment. Every substantive subgate passed either before that point or in the canonical junction-free recovery described below.

Phase 1 validation remains valid for Phase 1 only. Its `npm run validate` gate passed with 46 Vitest files / 304 tests and 27 Playwright passes / 17 intentional skips, plus assets, isolated database, seed/backfill/history, build/restart, launcher preservation, and cleanup. It does not prove Phase 2 host isolation, ownership, PageFlip, component, or final-state behavior.

## 2. Accepted Phase 2 evidence

### 2.1 Reconciliation validator

Command:

```powershell
python scripts/validate_animation_reconciliation.py `
  --oa-source Development_Docs/KG_Original_Animation_Audit_Reconciliation_Source.md `
  --matrix Development_Docs/Animation_System_Audit_Matrix.csv `
  --ledger Development_Docs/Animation_Original_Audit_Reconciliation_Ledger.csv `
  --shard-manifest Development_Docs/Project_Lanternwake_Phase_2_Reconciliation_Shard_Manifest.csv `
  --mode final --no-write
```

Result: **passed**. Accepted totals were `accepted_total=458`, `codex=220`, `oa=238`, `matrix_rows=361`, `existing_mappings=97`, `dedicated_mappings=141`, `accepted_unmapped=0`, and `all_source_unresolved=0`.

Unit command:

```powershell
python -m unittest scripts.tests.test_validate_animation_reconciliation
```

Result: **13/13 passed**.

This evidence proves artifact integrity and zero accepted requirements lost or unmapped. It does not prove visual implementation.

### 2.2 Bounded focused repair evidence

A C4 component-repair lane reported a focused gate of **3 files / 8 tests**, plus lint, Prettier, and diff cleanliness. Its repaired paths were subsequently included in the coordinator's accepted integrated `npm test` result: **59 files / 452 tests, exit 0**.

Earlier core, scene, C2, C3, A2, and integration-lane counts remain diagnostic history. The accepted combined result is 59 Vitest files / 452 tests at exit 0. PageFlip additionally passed its final 34-test focused selection and four browser cases: 2/2 in Chromium and 2/2 in WebKit.

## 3. Required command/result matrix

| Gate                | Exact command or selection                                           | Status                             | Counts / exit                                     | Classification / note                                                    |
| ------------------- | -------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Format              | `npm run format:check`                                               | **passed**                         | exit 0                                            | Final integrated concurrent sweep                                        |
| Lint                | `npm run lint`                                                       | **passed**                         | exit 0                                            | Final integrated concurrent sweep                                        |
| Typecheck           | `npm run typecheck`                                                  | **passed**                         | exit 0                                            | Strict TypeScript gate                                                   |
| Unit tests          | `npm test`                                                           | **passed**                         | 59 files / 452 tests; exit 0                      | Final integrated Vitest result                                           |
| Component tests     | high-risk component selections included in `npm test`                | **passed**                         | included in 59 files / 452 tests                  | Chart, Log, Artifact/Altar, Companion, Quartermaster, Access/login       |
| SceneHost tests     | host registry, React boundary, target preflight, two-host selections | **passed**                         | included in 59 files / 452 tests                  | Mandatory host/isolation proof                                           |
| Ownership tests     | ownership, director permits, runtime-surface, collision selections   | **passed**                         | included in 59 files / 452 tests                  | Multi-property fail-close and identity-only handoff included             |
| PageFlip tests      | boundary, book, showcase, consumer selections                        | **passed**                         | 34 focused tests; exit 0                          | Four focused browser cases also passed                                   |
| Accessibility tests | semantic, keyboard, focus, reduced-state, and PageFlip checks        | **passed**                         | unit plus zero-failure browser evidence           | Intentional project skips are separately counted, not promoted as passes |
| Browser tests       | final integrated Playwright selection                                | **passed**                         | 48 passed / 30 intentional skips / 0 failed; 6.2m | Serialized owner and isolated database                                   |
| Viewport tests      | six required viewport checkpoints in Chromium and WebKit             | **passed**                         | 6 viewports in both projects                      | 2560x1440, 1920x1080, 1440x900, 430x932, 390x844, 844x390                |
| Lifecycle tests     | five required 20-cycle groups plus Journal cleanup                   | **passed**                         | included in 452 tests; cleanup below 250 ms       | Journal browser case passed in 12.8 s                                    |
| Asset contracts     | `npm run assets:validate` stage                                      | **passed**                         | exit 0                                            | Missing future production art remains disclosed                          |
| Build               | junction-free `npm run build`, then two production restart probes    | **passed**                         | exit 0; 7.3 s compile; 22.2 s TS; 30 static pages | `/` 200 and `/dev/animations` 404 twice; port 3200 released              |
| E2E                 | final integrated Playwright selection                                | **passed**                         | 48 passed / 30 intentional skips / 0 failed       | Database mutation serialized and expected mutation observed              |
| Full validation     | `npm run validate`                                                   | **accounted environment exit**     | exit 1 after all pre-build stages passed          | Junction-induced build-worker failure; canonical build/restarts passed   |
| Git SHA / remote    | `git rev-parse HEAD`                                                 | **local implementation committed** | `d529b59e06ad1f2d736f6e1b888ebb78f169dcc0`        | Evidence commit and remote proof pending coordinator finalization        |
| Chat/docs sync      | synchronizer dry-run, live run, validate                             | **pending finalization**           | not yet run for this evidence update              | Coordinator-only finalization; no success claimed                        |

## 4. SceneHost and target gate

Required: unique/duplicate registration; immutable invocation identity; host-local resolution; identical names across hosts; stale and outside-host rejection; detached/nested cleanup; external handles; unmount; idempotency; simultaneous Player/Quartermaster hosts; showcase isolation; and exact target evidence without broad re-query.

The mandatory two-host fixture and target-isolation cases passed within the final 59-file / 452-test integrated sweep and the zero-failure Phase 2 Playwright selection.

## 5. Ownership and Motion gate

Required runtime pairs are GSAP/Motion, GSAP/CSS, Motion/CSS, Motion/PageFlip, GSAP/PageFlip, GSAP/Rive container, GSAP/Lottie container, Motion-layout/GSAP-transform, dnd-kit/Motion-transform, and dnd-kit/GSAP-transform. Each pair must prove atomic grant/reject, write prevention, multi-property fail-close, release/reclaim, stale/interruption/fallback/unmount cleanup, and valid nested wrappers.

The runtime-owned Motion surface lease, multi-property permit fail-close, collision, revocation, and identity-only handoff cases passed within the final 59-file / 452-test integrated sweep.

## 6. PageFlip gate

Required cases: hidden-source exclusion; visible-current qualification; stale rejection; current/off-page qualification; unique IDs/IDREFs; accessibility tree; manual, keyboard and programmatic StPageFlip ownership; deprecated fake curls; update and orientation identity; and unmount release. Synchronous temporary-clone interception, fail-closed observation, generation revocation, focus/page preservation, and 20-cycle baseline return are required.

Result: **passed**. The final focused PageFlip selection passed 34 tests. Full-mode and tombstone runtime cases passed 2/2 in Chromium and 2/2 in WebKit, and the integrated Playwright gate had no failures.

## 7. Final-state and access gate

Required: success response, accepted pose, delayed route, no snapback, route/auth failure, abort, unmount, reduced mode, repeated submission, all five canonical final-state policies, exact semantic identity, handoff-before-cleanup, retained claims until readability, focus recovery, and no false success.

Result: **passed** within the final unit/component sweep and the integrated Phase 2 Playwright selection, including accepted-pose hold, failure recovery, route-focus timing, reduced mode, and no-snapback checks.

## 8. High-risk component gate

Required boundaries:

- Voyage Chart Motion wrapper / GSAP inner marker child;
- Ship's Log Motion row / GSAP fresh-ink and symbol children;
- Artifact/Altar Motion shell/dialog / GSAP engraving-light children;
- Companion permanent Motion owner markers / explicit decorative dim children;
- Quartermaster invocation-local command host and 13 source-grounded dual-host callers; and
- Access/login Motion state and bounded GSAP cinematic child.

Result: **passed** within the final 59-file / 452-test integrated sweep and the zero-failure Phase 2 Playwright selection. This includes the repaired V2/V3 component boundaries and Quartermaster transition geometry.

## 9. Accessibility and viewport gate

Required viewports: 2560x1440, 1920x1080, 1440x900, 430x932, 390x844, and 844x390. Required accessibility assertions cover roles, control interactivity, decorative hiding, PageFlip source exclusion, visible-page readability, focus order, dialog trap/return, route focus timing, readable fallbacks, reduced motion, and non-motion state signals.

Result: **passed**. All six required viewport checkpoints passed in both Chromium and WebKit, together with the semantic, keyboard, focus, reduced-state, and visible-current-page assertions.

## 10. Lifecycle and performance gate

Run at least 20 cycles each of host mount/unmount, scene play/cleanup, Artifact Inspection open/close, PageFlip mount/update/unmount, and a non-mutating Quartermaster overlay. Host, target, handle, generation, claim, runtime, clone, listener, timer, and retained-node counts must return to baseline. Production-profile performance must be recorded separately.

Result: **passed**. All five 20-cycle lifecycle groups are included in the final 59-file / 452-test run. The Journal cleanup assertion stayed below 250 ms, and its complete integrated browser case passed in 12.8 seconds. Production build/start evidence is recorded separately; broader device-specific performance tuning remains future-phase work.

## 11. Database and runtime isolation

Before mutation-capable browser work, record a unique copied database absolute path, isolation nonce through the running app, server PID/port, canonical database hash/size/mtime before and after, SQLite family membership, and cleanup. An alternate worktree or port alone is not isolation.

Result: **isolation verified**. The final report records `status=isolation-verified`, `browserSucceeded=true`, `canonicalDatabaseUnchanged=true`, `canonicalDatabaseFamilyUnchanged=true`, `expectedMutation=true`, `observedMutation=true`, and `server identityVerified=true` on port 3100. The preserved canonical database SHA-256 was `cbcdbb6a8150643b874ac3913743601e27e149f71c6b6a12941a71a9c907cf92`.

## 12. Open fix-needed audits

### V2 component-boundary audit

Baseline audit evidence: 16/16 checks executed with a **fix-needed** verdict. Open items:

1. dialog-local Artifact Inspection export capability;
2. stale callback delivery;
3. duplicate altar heading ID;
4. missing local pointer inertness;
5. permanent Companion owner markers; and
6. invalid engraving ownership property.

The six repairs landed. Focused re-audit passed, and the repaired paths passed the final integrated 59-file / 452-test sweep plus the zero-failure browser gate.

### V3 permit and caller audit

Baseline audit evidence: 55/55 checks executed with a **fix-needed / release-blocking** verdict. Open items:

1. one permitted property must not authorize a multi-property GSAP write;
2. `artifact-award` must use identity-only handoff for the Motion-owned destination; and
3. all 13 Quartermaster dual-host callers require source-grounded proof.

The three release-blocking repairs landed. Focused re-audit passed, and the repaired paths passed the final integrated 59-file / 452-test sweep plus the zero-failure browser gate.

Neither baseline audit is a pass and neither repair is accepted without the re-audit.

## 13. Failure classification ledger

Use only:

- `task-regression` - introduced by Claim the Deck;
- `pre-existing` - independently reproduced on the preserved base;
- `environment` - tool/runtime infrastructure prevented a valid run;
- `database-isolation` - isolated mutation state was not proven;
- `missing-asset` - required production media is unavailable;
- `blocked` - a named prerequisite prevents execution; or
- `unresolved` - evidence is insufficient to classify safely.

Resolved task regressions included the initial Journal probe contamination and Phase 1 skip time-of-check/time-of-use behavior; both repairs passed focused checks and the integrated final Playwright gate. The remaining nonzero command is the `npm run validate` production-build stage and is classified `environment`: the temporary worktree dependency junction was incompatible with that build worker/Turbopack environment. After removing the junction, installing local dependencies, and regenerating Prisma, the canonical standalone build and both restart probes passed. No test failure remains unresolved.

## 14. Requirement-tracking result

| Metric                                | Accepted current result |
| ------------------------------------- | ----------------------- |
| Codex requirements preserved          | 220                     |
| OA requirements preserved             | 238                     |
| Accepted total                        | 458                     |
| Matrix rows / columns                 | 361 / 58                |
| OA ledger rows / columns              | 238 / 40                |
| Existing-only / dedicated OA mappings | 97 / 141                |
| Mapping edges                         | 289                     |
| Exact / combined / partial coverage   | 184 / 47 / 7            |
| Accepted unmapped / unresolved        | 0 / 0                   |

The canonical artifacts remain deliberately conservative: matrix 252 `architecture_ready`, 47 `validated`, 50 `partially_implemented`, 10 `not_started`, and 2 `blocked`; OA ledger 151 `architecture_ready`, 1 `validated`, 74 `partially_implemented`, 10 `not_started`, and 2 `blocked`. Of the 71 Phase 2 matrix rows, 47 directly evidenced runtime/contract rows are `validated`, 23 boundary-enabled rows are `architecture_ready`, and 1 remains `partially_implemented`. Architecture-ready visuals keep blank implementation commits and planned visual validation; the accepted runtime-architecture evidence does not claim later visuals, production art, triggers, progression integration, or full device-performance work.

## 15. Current verdict

**PHASE 2 IMPLEMENTATION AND COMPOSITE VALIDATION ACCEPTED; REPOSITORY FINALIZATION PENDING.** Reconciliation, V2/V3 repaired re-audits, static gates, 59-file / 452-test Vitest, isolated 48-pass Playwright, PageFlip focused browser proof, assets, canonical production build, and restart/cleanup evidence are green. The combined `npm run validate` command remains truthfully recorded as environment exit 1 rather than a pass. The coordinator must still commit this evidence, run the required chat/document synchronization workflow, push the branch, and verify the remote SHA before the repository handoff is complete. Phase 3 or Phase 4 must not start automatically from this report.
