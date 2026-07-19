# Project Lanternwake Phase 2 Implementation Report

Status: **draft implementation record; V2/V3 repair re-audits and final integrated validation are pending**

Date: 2026-07-18  
Program: Project Lanternwake  
Phase: Phase 2 - Claim the Deck  
Formal scope: runtime ownership, scene scoping, animation boundary enforcement, PageFlip identity, final-state handoff, high-risk component separation, and zero-loss audit reconciliation

## 1. Executive summary

Claim the Deck establishes one provider-scoped place for animation scenes to stand: a registered host, immutable invocation identity, explicit target registrations, registry-minted cross-tree identity handles, atomic property ownership, runtime write permits, and verified final-state handoff before cleanup. The working tree also contains the PageFlip source/clone boundary and bounded migrations for Chart, Log, Artifact/Inspection, Companion, Quartermaster, Access/login, and the development showcase.

Requirement reconciliation is complete as a data-integrity result: 220 Codex requirements and 238 OA requirements are preserved, 97 OA requirements use existing matrix rows, 141 have dedicated specificity-preserving rows, 289 mapping edges are explicit, and zero accepted requirements are unmapped or unresolved. The validator and its 13-test suite pass.

This is not yet a Phase 2 completion declaration. Independent V2 and V3 audits returned fix-needed findings. Repairs are landing, but neither audit may be called repaired until its re-audit passes. Integrated format, lint, typecheck, unit, build, browser/E2E, accessibility, lifecycle, viewport, full validation, Git, and synchronization evidence remains `[PENDING_FINAL_GATE]`.

## 2. Starting branch and commit

- Isolated worktree: `C:\Users\kkids\Documents\Codex_TreasureHunt_Phase2`
- Branch: `codex/project-lanternwake-phase-2-claim-the-deck`
- Starting commit: `fb8eb4ac33f4a44028fe82fb08df0ac0e5021db6`
- Canonical upstream at start: `origin/main`, verified at the same commit
- Ending commit: `[PENDING_FINAL_GATE]`
- Phase 2 branch upstream/push result: `[PENDING_FINAL_GATE]`

## 3. Repository safety result

Phase 2 was isolated from the active `main` checkout. After Phase 1 synchronized, the branch fast-forwarded to `fb8eb4a`. The coordinator copied the preserved Phase 1 working snapshot into the isolated worktree and verified SHA-256 equality for all 106 paths: 67 tracked modifications and 39 untracked paths. The Phase 2 worktree did not take ownership of the `main` development server, port 3000, browser, canonical database, dependency installation, schema, migrations, lockfile, full build, E2E, Git integration, or synchronization.

Final complete-status and accidental-scope review: `[PENDING_FINAL_GATE]`.

## 4. Phase 1 dependency verification

Phase 1 is complete, validated, and synchronized. Its full gate exited 0 with 46 Vitest files / 304 tests, 27 Playwright passes / 17 intentional skips, three Lottie JSON files, one local Rive binary and SVG fallback validation, isolated database identity, canonical SQLite-family preservation, seed/backfill/accepted-history/launcher checks, production build/restart, and process cleanup. Documentation and chat synchronization was committed and pushed at the Phase 2 base commit.

Phase 2 preserves Phase 1 target contracts, receipts, acknowledgment policy, persisted chapter replay, Journal wait boundaries, and resolved motion policy. It does not reinterpret Phase 1 evidence as proof of Phase 2 host isolation or ownership enforcement.

## 5. SceneHost architecture

`AnimationProvider` owns one `SceneHostRegistry`. `SceneHost` registers a connected local boundary with stable provider/host/generation identity, binds target refs to the nearest host, and tears down registrations idempotently. Nested hosts cannot leak their target registrations to a parent. Provider teardown revokes its hosts and capabilities.

The release contract includes duplicate-host rejection, simultaneous identical host IDs under different providers, host-local resolution, exact target counts, disconnected/stale rejection, and two-host isolation.

## 6. Scene-instance identity

Every play and replay receives a fresh immutable invocation containing provider, host, host generation, scene, instance, target-contract, and policy identity. Target resolution, claims, permits, receipts, metrics, handoff, cleanup, and diagnostics carry the invocation. A stale or mismatched generation fails closed instead of rebinding to current DOM order.

## 7. Target resolver

Production v2 resolution consumes the invocation's immutable registered-target snapshot. It validates host/generation/target identity, cardinality, connectivity, geometry, visibility, PageFlip lifecycle, required/optional status, and ownership. Broad roots may remain only behind the bounded legacy adapter; native production builders must not perform document-wide or root-requery target selection.

## 8. External target handles

Cross-tree continuity requires a registry-minted, provider-scoped, host-bound, generation-bound external handle. Handles are explicit capabilities, not selectors. They can be revoked and fail for foreign, stale, disconnected, or mismatched identities.

V3 requires the Artifact Award destination handle to be identity-only: it may identify and reconcile the Motion-owned destination without authorizing GSAP to write its properties. Re-audit result: `[PENDING_FINAL_GATE]`.

## 9. Ownership enforcement

Ownership is provider-scoped and normalized into property groups. Atomic claim batches either grant every requested target/property or leave no provisional claim. A live opaque `AnimationWritePermit` binds exact provider, invocation, target generation, runtime, and property groups; rejected or revoked permits cannot write. Cleanup, interruption, fallback, policy change, host teardown, and unmount revoke the relevant claims and permits.

V3 found that a single-property permit could validate a multi-property GSAP configuration. Multi-property fail-close repair and re-audit: `[PENDING_FINAL_GATE]`.

## 10. Motion integration

Motion remains the structural owner for layout, presence, dialog, card/list, form-state, and ordinary interaction surfaces. A provider-scoped runtime-surface lease is the enforcement bridge: Motion may write only while its target, invocation, and property-group capability remains live. GSAP is confined to deliberately separated cinematic children or wrappers.

Runtime-owned Motion hook retry and re-audit: `[PENDING_FINAL_GATE]`.

## 11. PageFlip boundary

StPageFlip remains the sole owner of physical curl, drag, keyboard and programmatic turns, page index, orientation, and turn lifecycle. Hidden React sources are inert, excluded from accessibility and cinematic target registration, and sanitized. Visible clones receive deterministic page/instance/generation identity; IDs and local IDREFs are namespaced. Stale generations are revoked. Temporary runtime clones are intercepted synchronously and made inert/untargetable, with a fail-closed observer as a backstop.

`journal-open`, `manual-page-flip`, and `programmatic-page-flip` remain explicit deprecated registry records. The showcase demonstrates the real PageFlip runtime instead of fake production curl proof.

Focused PageFlip evidence and final browser/accessibility proof: `[PENDING_FINAL_GATE]`.

## 12. Scene dispositions

The registry remains exactly 28 scenes:

- 16 production: `first-arrival`, `session-reentry`, `chapter-release`, `map-reveal`, `route-draw`, `artifact-award`, `artifact-connection`, `quest-discovery`, `quest-complete`, `log-entry`, `finale-tease`, `finale-requirement`, `mark-solved`, `pause`, `resume`, `undo`;
- 4 legacy: `player-access`, `quartermaster-login`, `seal-break`, `prepare-chapter`;
- 5 future-contract: `chapter-heading`, `prose-ink`, `marker-stamp`, `ship-course`, `artifact-inspection`; and
- 3 deprecated: `journal-open`, `manual-page-flip`, `programmatic-page-flip`.

The 16 production contracts carry v2 host-kind data in the current registry. Final proof that every production builder/caller is native-v2 and cannot re-query outside its invocation: `[PENDING_FINAL_GATE]`.

## 13. Final-state handoff

Canonical policies are `revert-immediately`, `hold-final-until-unmount`, `commit-final-state`, `reconcile-then-revert`, and `fallback-to-static-state`. Handoff identifies and verifies the semantic state before releasing animation resources and ownership. A failed handoff may use only a bounded readable safe fallback; if neither becomes readable, claims are retained rather than exposing a false or snapping-back result. Cleanup failure is recorded without rewriting the authoritative operation result.

## 14. Component migrations

| Surface                              | Intended boundary                                                                                         | Current acceptance state                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Voyage Chart                         | Motion marker/layout wrapper; nested GSAP stamp/pulse/reveal child; semantic marker handle                | Implemented surface; final gate pending           |
| Ship's Log                           | Motion row/presence wrapper; nested GSAP fresh-ink/symbol children; authoritative event identity          | Implemented surface; final gate pending           |
| Artifact Inspection / Treasure Altar | Motion shared-layout/dialog shell; nested engraving/light children; local export/focus/inertness boundary | V2 repairs landing; re-audit pending              |
| Companion Header / Navigation        | permanent Motion owner markers; deliberate aria-hidden cinematic dim children; controls excluded          | V2 repairs landing; re-audit pending              |
| Quartermaster                        | invocation-local command host, Motion controls/dialog, GSAP cinematic children, explicit external handles | 13 dual-host caller proof and V3 re-audit pending |
| Access/login                         | Motion form/pending/error state; bounded GSAP accepted/rejected child; route-stable handoff               | Implemented surface; final gate pending           |
| PageFlip consumers                   | source/clone generation boundary; actual StPageFlip turn ownership                                        | Implemented surface; final gate pending           |

## 15. Diagnostics

Structured diagnostics expose bounded IDs, counts, lifecycle, outcomes, policy, and failure codes; they do not retain or serialize DOM nodes or text. The showcase reports host/instance/target/claim and PageFlip lifecycle data as diagnostic evidence only. It cannot promote a harness scene to production reachability.

## 16. Tests

The working tree contains focused host registry/React boundary, ownership, target preflight, director, provider, final-state, scene registry/builders, PageFlip boundary/book, showcase, high-risk component, Quartermaster, Access/login, and reconciliation-validator tests. The accepted reconciliation gate passed and its unit suite passed 13/13. A bounded C4 component repair gate reported 3 files / 8 tests plus lint, Prettier, and diff cleanliness; its final integrated rerun remains pending.

Core (97), scene (55), C2 (6), C3 (10), A2 (32), PageFlip, and integration-lane focused counts are not recorded as final because files are changing or need re-audit. Exact final commands, counts, failures, skips, and classifications: `[PENDING_FINAL_GATE]`.

## 17. Browser validation

The coordinator exclusively owns the browser, server, ports, and database copy. Phase 2 browser/E2E results, the mandatory two-host fixture, PageFlip runtime proof, collision-surface proof, and production-context component flows: `[PENDING_FINAL_GATE]`.

## 18. Accessibility

Required proof covers semantic roles, interactive controls, decorative child hiding, hidden PageFlip source exclusion, visible page readability, focus order, dialog trap/return, exact trigger return, route focus after navigation, readable fallback, reduced state, and non-motion state signals at all required surfaces. Result: `[PENDING_FINAL_GATE]`.

## 19. Lifecycle and performance

The release protocol requires at least 20 cycles each of host mount/unmount, scene play/cleanup, Artifact Inspection open/close, PageFlip mount/update/unmount, and a non-mutating Quartermaster overlay, with registries/claims/targets/handles/clones/listeners/timers returning to baseline. It also requires the six viewport checks and production-profile performance evidence. Result: `[PENDING_FINAL_GATE]`.

## 20. Requirement tracking

| Required total                         | Current evidence      |
| -------------------------------------- | --------------------- |
| Codex animation requirements preserved | 220                   |
| OA requirements preserved              | 238                   |
| Accepted total                         | 458                   |
| Matrix                                 | 361 rows / 58 columns |
| OA ledger                              | 238 rows / 40 columns |
| OA existing-only / dedicated mappings  | 97 / 141              |
| Mapping edges                          | 289                   |
| Coverage exact / combined / partial    | 184 / 47 / 7          |
| Accepted unmapped / unresolved         | 0 / 0                 |

Current normalized status is intentionally conservative pending re-audits: matrix 259 `architecture_blocked`, 90 `partially_implemented`, 10 `not_started`, 2 `blocked`; OA ledger 159 `architecture_blocked`, 67 `partially_implemented`, 10 `not_started`, 2 `blocked`. Claim the Deck implemented/validated/blocked totals and the number promoted to `architecture_ready` are `[PENDING_FINAL_GATE]`; they will be derived from the final canonical artifacts rather than estimated.

## 21. Files changed

Phase 2 implementation and evidence currently touch these exact owned groups; the final Git diff is authoritative and remains `[PENDING_FINAL_GATE]`:

- `src/animation/hosts/SceneHost.tsx`, `SceneHostContext.ts`, `scene-host-registry.ts`, `scene-host-types.ts`, and their tests;
- `src/animation/core/animation-types.ts`, `ownership.ts`, `target-preflight.ts`, `final-state-handoff.ts`, `presentation-telemetry.ts`, `metrics.ts`, and their focused tests;
- `src/animation/director/AnimationDirector.ts`, `AnimationProvider.tsx`, `scene-registry.ts`, and their tests;
- `src/animation/scenes/arrival.scene.ts`, `command.scene.ts`, `story.scene.ts`, `scene-utils.ts`, and `scene-builders.test.ts`;
- `src/components/animation/PageFlipBook.tsx`, `pageflip-boundary.ts`, and their tests;
- `src/components/dev/AnimationShowcase.tsx` and its test;
- `src/components/player/PlayerExperience.tsx`, `AccessGate.tsx`, their tests, and bounded journal/PageFlip consumers;
- `src/components/gm/Quartermaster.tsx` and its test;
- `src/components/player/workspace/VoyageChart.tsx`, `ShipsLog.tsx`, `ArtifactInspection.tsx`, `TreasureAltar.tsx`, `CompanionHeader.tsx`, `CompanionNavigation.tsx`, and their tests;
- `scripts/validate_animation_reconciliation.py` and `scripts/tests/test_validate_animation_reconciliation.py`;
- `Development_Docs/Animation_System_Audit_Matrix.csv`, `Animation_Original_Audit_Reconciliation_Ledger.csv`, `Project_Lanternwake_Phase_2_Reconciliation_Shard_Manifest.csv`, and `KG_Original_Animation_Audit_Reconciliation_Source.md`; and
- the Phase 2 design record, this report, the validation report, and dated appendices in the full audit, roadmap, and test plan.

The final report will distinguish copied Phase 1 snapshot paths, Phase 2 task-authored changes, synchronization-owned changes, generated/ignored files, and unrelated pre-existing work.

## 22. Deviations

- The Phase 1 source arrived as a validated working-tree snapshot rather than an application commit; it was preserved byte-for-byte in the isolated worktree.
- The first V2 and V3 independent audits returned fix-needed rather than pass. Repairs are being applied before final validation.
- `architecture_ready` promotion is deferred until repair re-audits pass; later visuals are not marked implemented.
- No production Rive visual art, full Phase 3 persistent progression integration, or Phase 4 platform-motion program is included.

## 23. Known limitations

1. V2 re-audit must pass the Artifact Inspection export/stale-callback, altar ID/inertness, Companion markers, and engraving-property repairs.
2. V3 re-audit must pass multi-property permit fail-close, identity-only Artifact Award handoff, and 13 Quartermaster dual-host caller evidence.
3. Motion runtime-surface gating awaits the final hook integration/retry.
4. All integrated runtime/browser/database/build/full-validation gates remain pending.
5. Production Rive visuals remain fallback-only where assets are absent.
6. Future-contract visuals, complete Phase 3 all-event/all-section integration, Phase 4 platform motion, full performance tuning, and final art polish remain later work.

## 24. Phase 3 handoff

After Phase 2 passes, Phase 3 may consume the provider-scoped host registry, persistent Player progression/event/section host kinds, immutable invocation identity, native v2 target contracts, identity-only external handles, atomic ownership/write permits, final-state handoff, replay-instance identity, structured receipts/diagnostics, and PageFlip source/clone binding. It must not invent an alternate host, ownership, resolver, or clone architecture.

Phase 3 has not started in this task.

## 25. Phase 4 handoff

After Phase 2 passes, Phase 4 may use the same runtime-surface ownership and final-state APIs for modern Player/Staff sign-in, invitations, Library, waiting room, Studio, shell, forms, and ordinary interface motion. Motion remains the default structural interaction runtime; cinematic children require separate ownership. Future scenes marked `architecture_ready` remain visually unimplemented until their Phase 4/5/6 triggers, assets, reduced states, accessibility, and tests are delivered.

Phase 4 has not started in this task.
