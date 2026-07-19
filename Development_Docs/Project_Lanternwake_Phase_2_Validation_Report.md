# Project Lanternwake Phase 2 Validation Report

Status: **draft; Claim the Deck is not yet release-validated**

Date: 2026-07-18  
Branch: `codex/project-lanternwake-phase-2-claim-the-deck`  
Starting commit: `fb8eb4ac33f4a44028fe82fb08df0ac0e5021db6`  
Ending commit: `[PENDING_FINAL_GATE]`

## 1. Truth boundary

This report distinguishes accepted current evidence from planned or in-progress checks. A patch, worker completion, test inventory, historical Phase 1 result, skipped case, or fix-needed audit is not a Phase 2 pass. Every `[PENDING_FINAL_GATE]` marker must be replaced with an exact command, exit code, counts, environment, and classification before Claim the Deck can be declared complete.

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

A C4 component-repair lane reported a focused gate of **3 files / 8 tests**, plus lint, Prettier, and diff cleanliness. The exact coordinator replay command and integrated-state result are `[PENDING_FINAL_GATE]`; this lane result is retained as focused evidence but is not counted as final acceptance.

Core (97 tests), scene (55), C2 (6), C3 (10), A2 (32), PageFlip, and integration-lane counts are intentionally not promoted: their files are still changing or require re-audit. Exact results: `[PENDING_FINAL_GATE]`.

## 3. Required command/result matrix

| Gate                | Exact command or selection                                           | Status                 | Counts / exit          | Classification / note                                              |
| ------------------- | -------------------------------------------------------------------- | ---------------------- | ---------------------- | ------------------------------------------------------------------ |
| Format              | `npm run format:check`                                               | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | Integrated tree only                                               |
| Lint                | `npm run lint`                                                       | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | Integrated tree only                                               |
| Typecheck           | `npm run typecheck`                                                  | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | Strict TypeScript gate                                             |
| Unit tests          | `npm test` or exact final Vitest selections                          | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | Record files/tests/failures/skips                                  |
| Component tests     | exact high-risk component Vitest selections                          | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | Chart, Log, Artifact/Altar, Companion, Quartermaster, Access/login |
| SceneHost tests     | host registry, React boundary, target preflight, two-host selections | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | Mandatory host/isolation proof                                     |
| Ownership tests     | ownership, director permits, runtime-surface, collision selections   | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | Must include multi-property fail-close and identity-only handoff   |
| PageFlip tests      | boundary, book, showcase, consumer selections                        | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | All 14 required cases plus clone interception                      |
| Accessibility tests | automated axe/semantic plus keyboard/focus selections                | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | A skip is not a pass                                               |
| Browser tests       | exact Playwright projects/specs/greps                                | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | Serialized owner and isolated database                             |
| Viewport tests      | six required viewport projects/checkpoints                           | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | 2560x1440, 1920x1080, 1440x900, 430x932, 390x844, 844x390          |
| Lifecycle tests     | exact 20-cycle harness commands                                      | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | Five required lifecycle groups                                     |
| Asset contracts     | `npm run assets:validate`                                            | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | Missing production art stays disclosed                             |
| Build               | `npm run build`                                                      | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | Production build/restart proof                                     |
| E2E                 | `npm run test:e2e` or exact final Playwright command                 | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | Database mutation serialized                                       |
| Full validation     | `npm run validate`                                                   | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | One coordinator-owned integrated gate                              |
| Git SHA / remote    | exact `git` verification                                             | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | No implementation commit claimed yet                               |
| Chat/docs sync      | synchronizer dry-run, live run, validate                             | `[PENDING_FINAL_GATE]` | `[PENDING_FINAL_GATE]` | Coordinator-only finalization                                      |

## 4. SceneHost and target gate

Required: unique/duplicate registration; immutable invocation identity; host-local resolution; identical names across hosts; stale and outside-host rejection; detached/nested cleanup; external handles; unmount; idempotency; simultaneous Player/Quartermaster hosts; showcase isolation; and exact target evidence without broad re-query.

Mandatory two-host fixture result: `[PENDING_FINAL_GATE]`.

## 5. Ownership and Motion gate

Required runtime pairs are GSAP/Motion, GSAP/CSS, Motion/CSS, Motion/PageFlip, GSAP/PageFlip, GSAP/Rive container, GSAP/Lottie container, Motion-layout/GSAP-transform, dnd-kit/Motion-transform, and dnd-kit/GSAP-transform. Each pair must prove atomic grant/reject, write prevention, multi-property fail-close, release/reclaim, stale/interruption/fallback/unmount cleanup, and valid nested wrappers.

Runtime-owned Motion surface lease result: `[PENDING_FINAL_GATE]`.

## 6. PageFlip gate

Required cases: hidden-source exclusion; visible-current qualification; stale rejection; current/off-page qualification; unique IDs/IDREFs; accessibility tree; manual, keyboard and programmatic StPageFlip ownership; deprecated fake curls; update and orientation identity; and unmount release. Synchronous temporary-clone interception, fail-closed observation, generation revocation, focus/page preservation, and 20-cycle baseline return are required.

Result: `[PENDING_FINAL_GATE]`.

## 7. Final-state and access gate

Required: success response, accepted pose, delayed route, no snapback, route/auth failure, abort, unmount, reduced mode, repeated submission, all five canonical final-state policies, exact semantic identity, handoff-before-cleanup, retained claims until readability, focus recovery, and no false success.

Result: `[PENDING_FINAL_GATE]`.

## 8. High-risk component gate

Required boundaries:

- Voyage Chart Motion wrapper / GSAP inner marker child;
- Ship's Log Motion row / GSAP fresh-ink and symbol children;
- Artifact/Altar Motion shell/dialog / GSAP engraving-light children;
- Companion permanent Motion owner markers / explicit decorative dim children;
- Quartermaster invocation-local command host and 13 source-grounded dual-host callers; and
- Access/login Motion state and bounded GSAP cinematic child.

Result: `[PENDING_FINAL_GATE]`.

## 9. Accessibility and viewport gate

Required viewports: 2560x1440, 1920x1080, 1440x900, 430x932, 390x844, and 844x390. Required accessibility assertions cover roles, control interactivity, decorative hiding, PageFlip source exclusion, visible-page readability, focus order, dialog trap/return, route focus timing, readable fallbacks, reduced motion, and non-motion state signals.

Result: `[PENDING_FINAL_GATE]`.

## 10. Lifecycle and performance gate

Run at least 20 cycles each of host mount/unmount, scene play/cleanup, Artifact Inspection open/close, PageFlip mount/update/unmount, and a non-mutating Quartermaster overlay. Host, target, handle, generation, claim, runtime, clone, listener, timer, and retained-node counts must return to baseline. Production-profile performance must be recorded separately.

Result: `[PENDING_FINAL_GATE]`.

## 11. Database and runtime isolation

Before mutation-capable browser work, record a unique copied database absolute path, isolation nonce through the running app, server PID/port, canonical database hash/size/mtime before and after, SQLite family membership, and cleanup. An alternate worktree or port alone is not isolation.

Result: `[PENDING_FINAL_GATE]`.

## 12. Open fix-needed audits

### V2 component-boundary audit

Baseline audit evidence: 16/16 checks executed with a **fix-needed** verdict. Open items:

1. dialog-local Artifact Inspection export capability;
2. stale callback delivery;
3. duplicate altar heading ID;
4. missing local pointer inertness;
5. permanent Companion owner markers; and
6. invalid engraving ownership property.

Repairs exist or are landing. Re-audit: `[PENDING_FINAL_GATE]`.

### V3 permit and caller audit

Baseline audit evidence: 55/55 checks executed with a **fix-needed / release-blocking** verdict. Open items:

1. one permitted property must not authorize a multi-property GSAP write;
2. `artifact-award` must use identity-only handoff for the Motion-owned destination; and
3. all 13 Quartermaster dual-host callers require source-grounded proof.

Repairs exist or are landing. Re-audit: `[PENDING_FINAL_GATE]`.

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

Current classified failures: V2 and V3 are `task-regression` / fix-needed until repaired re-audits pass. All unrun final gates are `blocked` by integration readiness, not passed or skipped.

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

Claim the Deck requirements implemented / validated / blocked, production scenes migrated, SceneHosts introduced, ownership conflicts fixed, and OA rows promoted to `architecture_ready`: `[PENDING_FINAL_GATE]`. Final values must be derived from the canonical post-validation matrix/ledger and source inventory.

## 15. Current verdict

**NOT YET COMPLETE.** Requirement reconciliation is green, but V2/V3 repair re-audits and every integrated runtime/repository gate remain pending. This draft must not be used to start Phase 3 or Phase 4 automatically.
