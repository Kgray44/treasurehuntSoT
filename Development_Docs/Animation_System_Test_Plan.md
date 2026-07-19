# Animation System Test Plan

Status: required completion plan for the animation-system audit of exact committed baseline `4dbe8c0ae2fbab2785d1d3f26b8d7ba33bf56aee`, plus the focused implementation evidence for Project Lanternwake Phase 1 on the working tree based on `40a58ec1329caea8245b10ce344eb05f5d6baed2`. The integrated Phase 1 gate is green: `npm run validate` exited 0 with 46 Vitest files / 304 tests, 27 Playwright tests passed / 17 intentional skips, 3 Lottie JSON files / 1 local development Rive binary / local SVG fallbacks validated, seeded-database and backfill checks passed, accepted history and launcher state were preserved, the production build and restart proof passed, the canonical database family remained unchanged, and validation-owned resources were released. This does not claim completion of Phases 2-6 or final repository synchronization.

## 1. Purpose, scope, and truth boundary

This plan prevents the failures documented in `Animation_System_Full_Audit.md` from returning. It covers the root animation policy, all 28 registered GSAP scenes, Motion interactions, StPageFlip, the four production Rive contracts, all three Lottie assets, CSS and Web Animations API phases, Web Audio cues, modern platform flows, legacy cinematic flows, and every Player progression event in every Player section.

The governing rule is:

> Timeline completion is not visual success. A test passes only when the expected trigger reaches the correct visible and unique target instance, commits the required semantic final state, preserves accessibility, obeys replay and one-shot policy, and reconciles authoritative data in the correct order.

The following evidence states must remain distinct in test names and reports:

- **Baseline-confirmed:** observed in source or a completed test against commit `4dbe8c0ae2fbab2785d1d3f26b8d7ba33bf56aee`.
- **Runtime-confirmed:** observed in the real rendered baseline flow with recorded trigger, target, section, mode, and result.
- **Harness-only:** demonstrated in `/dev/animations`; never treated as production integration proof.
- **Required future test:** specified here but not yet executed safely.
- **Blocked:** cannot run until the stated fixture, production asset, or isolation precondition exists.

This plan does not authorize production fixes, database mutation outside a verified isolated fixture, a competing development server, or a new application copy.

## 2. Existing evidence and remaining gaps

| Evidence                                   | Baseline result                                                                                                                                                                                                                                 | What it proves                                                                                                                                                                                                                                                                         | What it does not prove                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Focused Vitest run                         | 13 files, 44 unit/component tests passed                                                                                                                                                                                                        | Scene builders construct in all modes; covered director/core, journal opening, Rive/Lottie wrappers, PageFlip, and workspace interactions execute their asserted paths                                                                                                                 | Production visibility, target uniqueness, every-section behavior, replay after refresh, whole-app reduced motion                     |
| `npm run assets:validate`                  | Passed: 3 Lottie JSON files, 1 local development Rive binary, and local SVG fallbacks                                                                                                                                                           | Registered local files are parseable/present according to current contracts                                                                                                                                                                                                            | The four production Rive objects have real `.riv` art; they do not                                                                   |
| Focused animation Playwright               | 3 passed; WebKit-mobile showcase test skipped                                                                                                                                                                                                   | Chromium showcase and Chromium/WebKit-mobile first arrival exercised the existing focused assertions                                                                                                                                                                                   | Complete mobile showcase coverage or real production event integration                                                               |
| Showcase exercise                          | All 36 entries exercised in reduced mode with no logged runtime exception                                                                                                                                                                       | The development harness can invoke its entries in reduced mode and clean up the measured runtimes                                                                                                                                                                                      | Full/gentle modes, visible required targets, unique ownership, or production reachability                                            |
| Landing viewport check                     | Six required viewports had no horizontal overflow; reduced content remained readable                                                                                                                                                            | Landing layout containment for the observed states                                                                                                                                                                                                                                     | All routes, modes, checkpoints, or visual correctness; at 1440x900 `stars` had zero height and `arrival-copy` appeared twice         |
| Journal/PageFlip observation               | Ten scene-part elements and two visible `peripheral` targets were measured; clone architecture was inspected                                                                                                                                    | Duplicate `peripheral` targets and source/clone structural risk exist                                                                                                                                                                                                                  | An actual progression target duplicated inside the tested PageFlip snapshot                                                          |
| Legacy login acceptance                    | Wrong credentials returned HTTP 401; `.form-error` did not appear within 10 seconds                                                                                                                                                             | The observed failure-feedback contract failed                                                                                                                                                                                                                                          | Whether modern and legacy login fail identically in a clean isolated fixture                                                         |
| Chapter release acceptance                 | Seal, parchment, and ink stages rendered and replay was offered; elapsed time was 10,081 ms                                                                                                                                                     | That one Journal release reached visible stages                                                                                                                                                                                                                                        | The `<10,000 ms` timing contract, every-section behavior, replay after refresh, interruption, or all modes/viewports                 |
| Database isolation attempt                 | The detached server resolved the main checkout database; the server was stopped and exact audit rows were repaired after backup and assertions                                                                                                  | Next.js source-worktree separation alone is not database isolation                                                                                                                                                                                                                     | Any later mutating matrix; no such run is claimed                                                                                    |
| Lanternwake Phase 1 integrated gate        | `npm run validate` exited 0; 46 Vitest files / 304 tests passed; typecheck, lint, format, asset validation, seeded-database/backfill checks, accepted-history and launcher-preservation checks, production build, and production restart passed | Typed contracts and receipts, measured target preflight, acknowledgment/retry, persisted safe replay composition, bounded Journal waits, resolved motion policy, scene dispositions, runtime lifecycle behavior, build viability, and restart behavior passed their Phase 1 assertions | It does not complete the Phase 2-6 host, production-art, all-event/all-section, all-viewport, performance, or 20-cycle leak programs |
| Lanternwake Phase 1 browser specifications | The isolated browser gate completed with 27 Playwright tests passed and 17 intentional skips across the configured projects                                                                                                                     | Receipt-gated retry/fallback, persisted replay after refresh, mutation-free replay state comparison, fresh-document Journal lifecycle accounting, browser reduced motion, and Player/Quartermaster final-state holds ran successfully                                                  | Intentional skips remain skips, not passes; their reasons belong to the declared project/mutation ownership boundaries               |

The original audit coverage remains a useful baseline rather than a completion gate. Lanternwake Phase 1 now has integrated unit, browser, database-isolation, build, restart, and cleanup proof, but it does not claim the Phase 3 102-case Player event/section matrix, the complete six-viewport route matrix, production performance budget, or 20-cycle leak protocol.

### 2.1 Lanternwake Phase 1 focused evidence inventory

The verified integrated run is `46` Vitest files / `304` passing tests / `0` failed, plus `27` Playwright tests passed / `17` intentional skips. These aggregates are authoritative; the rows below identify the Phase 1 proof surfaces without double-counting shared files.

| Phase 1 concern                               | Implemented proof surface                                                                                                                                                                                                                        | Focused assertion                                                                                                                                                                                                                                                                                                                          | Current evidence state                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| All 28 scene contracts and reachability       | `src/animation/director/scene-registry.test.ts`; `src/components/animation/AnimationControls.test.tsx`; `src/components/animation/AnimationShowcase.test.tsx`                                                                                    | 28 unique contracted names; 16 production, 4 legacy, 5 future-contract, and 3 deprecated; deprecated entries cannot claim production semantics; showcase labels remain harness-only                                                                                                                                                        | Integrated Phase 1 gate green                                         |
| Target visibility, cardinality, and ownership | `src/animation/core/target-preflight.test.ts`; `src/animation/core/ownership.test.ts`                                                                                                                                                            | All required Phase 1 target cases below, opt-in viewport intersection, sanitized ownership conflicts, idempotent ownership release, and real repeated-preflight p95 below 50 ms                                                                                                                                                            | Focused green                                                         |
| Typed receipts and terminal outcomes          | `src/animation/director/AnimationDirector.test.ts`                                                                                                                                                                                               | Preflight precedes builders/operations/timelines; receipt distinguishes presented, approved fallback, policy/user skip, abort, interruption, timeout, missing, duplicate, ownership, and runtime failure; cleanup is exactly once                                                                                                          | Focused green                                                         |
| `CHAPTER_RELEASED` acknowledgment and retry   | `src/components/player/PlayerExperience.test.tsx`; `src/app/api/player/[campaignSlug]/viewed/route.test.ts`; `src/animation/director/scene-registry.test.ts`                                                                                     | Failed automatic presentation stays unviewed despite snapshot refresh; a successful retry acknowledges exactly once; route rejects ineligible events and uses the existing idempotent upsert key                                                                                                                                           | Unit and isolated browser mutation proof green                        |
| Persisted, player-safe replay                 | `src/domain/replay.test.ts`; `src/lib/snapshot.test.ts`; `src/components/player/PlayerExperience.test.tsx`; `tests/e2e/lanternwake-phase1.spec.ts`                                                                                               | Replay reconstructs the latest immutable released event from authorized readable data, creates a new presentation instance, restores section/focus, and sends no story or viewed mutation; browser proof includes refresh, two post-refresh replays, a resolved motion change, unsafe-request capture, and full persisted-state comparison | Unit and isolated browser proof green                                 |
| Bounded Journal CSS/WAAPI lifecycle           | `src/animation/journal/opening-machine.test.ts`; `src/components/player/journal/TallTaleJournalSession.test.ts`; `tests/e2e/lanternwake-journal.spec.ts`                                                                                         | Finite-only waits; missing actor/animation, rejected `finished`, infinite ambient work, timeout, abort, reduced fallback, unmount generation, and deterministic readable outcomes; abort settles under 100 ms in the unit harness; same-document unmount cleanup completes below 250 ms and returns tracked resources to zero              | Unit and real-browser lifecycle proof green                           |
| One resolved motion authority                 | `src/animation/core/quality.test.ts`; `src/animation/director/AnimationProvider.test.tsx`; `src/components/animation/PageFlipBook.test.tsx`; `src/components/animation/LottieEffect.test.tsx`; `src/components/animation/RiveRuntime.test.tsx`   | Strictest product/browser policy wins; provider feeds `MotionConfig`, root CSS attribute, director, and runtime interfaces; mode changes do not create unrelated replay or duplicate runtime ownership                                                                                                                                     | Integrated policy and browser proof green                             |
| Audio, runtime cleanup, and telemetry         | `src/animation/core/audio-cues.test.ts`; `src/components/animation/PageFlipBook.test.tsx`; `src/components/animation/LottieEffect.test.tsx`; `src/components/animation/RiveRuntime.test.tsx`; `src/animation/director/AnimationDirector.test.ts` | Audio fails closed until validated targets and semantic label, never constitutes presentation proof, and remains nonblocking; PageFlip/Lottie/Rive clean up exactly once; receipts expose sanitized IDs, counts, labels, timing, acknowledgment decision, and failure reason without story payload                                         | Integrated cleanup green; production Rive art remains outside Phase 1 |
| Browser semantic and access-transition truth  | `tests/e2e/lanternwake-phase1.spec.ts`; `tests/e2e/lanternwake-journal.spec.ts`; `tests/e2e/lanternwake-access-transitions.spec.ts`                                                                                                              | Required-target failure stays unviewed and retryable; approved reduced fallback views once; browser-reduced Journal is statically readable; Player and Quartermaster committed success poses remain held until the authorized destination is visible, with no route snapback                                                               | Isolated browser proof green                                          |

### 2.2 Required target/preflight case ledger

`src/animation/core/target-preflight.test.ts` directly covers the 15 primary Phase 1 case rows below; the zero-size test separately exercises zero width and zero height, so every one of the 16 conditions named in the Phase 1 prompt is asserted. Viewport intersection is an additional opt-in rule rather than a universal visibility requirement, and `src/animation/core/ownership.test.ts` separately proves privacy-safe conflict evidence and scoped cleanup.

| Case                                          | Required result                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| Zero matches                                  | Required target fails; no successful empty selection                           |
| Disconnected target                           | Cannot satisfy a required contract                                             |
| Zero-width or zero-height target              | Cannot satisfy a visible-box requirement                                       |
| `display:none` on target or rendered ancestor | Cannot satisfy visibility                                                      |
| `visibility:hidden` or `collapse`             | Cannot satisfy visibility                                                      |
| Effective opacity below threshold             | Target and ancestor opacity are composed; effectively transparent targets fail |
| Target outside supplied host                  | Cannot satisfy host-scoped visibility                                          |
| Valid visible host-scoped target              | Passes, records timing/geometry/style evidence, and releases ownership         |
| Duplicate target                              | Fails when matches exceed maximum cardinality                                  |
| Allowed multiple cardinality                  | Passes only within the declared minimum/maximum                                |
| Hidden PageFlip source marker                 | `data` source marker, `inert`, or `aria-hidden` source is rejected             |
| Stale scene instance                          | Mismatched instance marker is rejected                                         |
| Rejected ownership                            | Conflicting declared property owner prevents use                               |
| Optional target absent                        | Does not weaken required-target truth and is not claimed                       |
| Optional target hidden                        | Is observed but neither fails the scene nor receives an ownership claim        |

The additional viewport case proves that a contract can require viewport intersection without imposing it on scenes that legitimately begin outside the viewport but inside their host.

The preflight performance assertion is a measured unit gate rather than a mocked duration. It performs eight untimed warmups, records 40 `performance.now()` executions of the real preflight/release path, sorts the samples, selects the nearest-rank p95 at zero-based index 37, and requires that value to be strictly below 50 ms.

## 3. Test ownership, layers, and serialized resources

| Test concern                                                    | Primary layer/owner          | Fixture                                                | Parallel policy                                     | Required output                                                        |
| --------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------- |
| Scene contracts, mode policy, target validation, ownership      | Animation core unit owner    | JSDOM/fake timers; no server                           | Shard by module                                     | Per-contract assertions and deterministic failures                     |
| Rive, Lottie, PageFlip, Motion wrappers, CSS/WAAPI phase bridge | Animation component owner    | Rendered component with mocked runtime boundary        | Shard by runtime; never share global clocks         | Lifecycle counts, property-owner log, accessibility assertions         |
| Player progression and replay                                   | Player integration owner     | Explicit isolated campaign/event fixture               | Mutating cases serialized                           | Event receipt, target telemetry, snapshot and viewed-state evidence    |
| Login, invitation, Libraries, waiting room, Studio              | Platform integration owner   | Explicit role/invitation fixtures                      | Read-only cases may shard; mutations serialized     | Network response, UI state, transition checkpoint, persistence result  |
| Viewport, visual, accessibility, browser reduced motion         | Browser/visual owner         | One authoritative Playwright server/browser allocation | Read-only projects may shard after fixture creation | Checkpoint screenshots plus semantic assertions                        |
| Performance and memory                                          | Performance owner            | Production build, stable machine profile               | Serialized; no competing test load                  | Trace, thresholds, runtime/heap deltas                                 |
| Full build, full E2E, `npm run validate`                        | Integration validation owner | Integrated branch/worktree                             | Run once after focused gates                        | Exit status, counts, artifacts, classified failures                    |
| Port, browser, and database state                               | Runtime/database owner       | Ports 3100/3200 only as configured by validation       | Exclusive ownership                                 | Listener/PID, resolved database identity, before/after integrity proof |

Port `3000` remains the single canonical development server and is not acquired by this test plan. Playwright's configured port `3100` and validation port `3200` are controlled test resources, not alternate applications. No worker starts, stops, or reuses a listener it does not own.

### 3.1 Database and runtime isolation preflight

Any test that can create a login attempt, presence row, viewed receipt, progress event, snapshot, audit record, session, invitation change, or command result must fail closed before the first HTTP request unless all of these checks pass:

1. The runtime/database owner creates a uniquely named copy of the approved seed database in an ignored test-data directory.
2. The server receives an explicit absolute `DATABASE_URL`; current working directory and Next.js inferred project root are not accepted as proof.
3. Startup evidence records the server PID, listener, redacted resolved database path, and an isolation nonce stored only in the copied database.
4. A read-only application query returns that nonce, proving the process and fixture refer to the same copy.
5. The canonical/main database absolute path, hash, size, and modification time are recorded before the run.
6. Only the runtime/database owner may seed, mutate, migrate, reset, start, or stop the test runtime.
7. After the run, the copied database contains the expected mutations and the canonical/main database hash, size, and modification time are unchanged.
8. A mismatch aborts the suite immediately. It is an environment failure, not an application failure, and no further mutation test may run.

Chromium owns mutation cases sequentially. WebKit/mobile projects use immutable or per-project database copies and remain read-only unless truly separate databases have been proven. Tests must not infer isolation from a detached Git worktree alone.

### 3.2 Implemented and runtime-proven Phase 1 isolation harness

The fail-closed harness is implemented in `scripts/test-all.ps1` and `scripts/prepare-validation-isolation.ts`, with the development-only identity query at `src/app/api/dev/validation/database-identity/route.ts` and Playwright reuse disabled in `playwright.config.ts`.

The implemented sequence is:

1. Sample the canonical `prisma/dev.db` fingerprint three times and abort if SHA-256, byte size, or modification time is unstable.
2. Create a uniquely named `validation-isolated-<timestamp>-<guid>.db` with exclusive-copy semantics from the approved validation seed.
3. Set an explicit absolute Prisma `file:` URL and insert one random SHA-256 nonce as a `PlatformAuditEvent` marker only in that copy.
4. Refuse any pre-existing listener on port `3100`; start one hidden validation process and require its sole listener PID to descend from the process tree the harness launched.
5. Query `/api/dev/validation/database-identity` and continue only when both `validationDatabase` and `nonceMatch` are true.
6. Capture a pre-browser mutation-count checkpoint, run shared-database mutations only in Chromium, and keep the WebKit command-center mutation cases skipped/read-only.
7. Stop only the explicitly proven listener/launcher PIDs, require port `3100` to become free, then serialize the production restart proof on port `3200`.
8. Require expected mutations and an isolated-copy fingerprint change while proving the canonical SHA-256, size, and modification time are unchanged.

The successful `npm run validate` wrote `database-isolation-report.json` below the validation artifact root with the redacted copy filename, nonce hash, server/listener identity, checkpoints, mutation counts, isolated and canonical fingerprints, and `canonicalDatabaseUnchanged: true`. Seeded-database, backfill, accepted-history, and launcher-preservation checks passed; the isolated copy changed as expected while the canonical database fingerprint and sibling family remained unchanged. The production build/restart proof passed and validation-owned listeners and processes were released. This report is runtime isolation proof for the Phase 1 gate, not authorization to mutate the canonical database in later phases.

## 4. Shared animation truth oracle

Every cinematic or stateful animation test records a `SceneObservation` with at least:

```text
sceneName
sceneInstanceId
eventOrActionId
rootHostId
currentRoute
currentPlayerSection
resolvedMotionMode
triggerTimestamp
semanticLabelsReached
requiredTargetCount
optionalTargetCount
visibleRequiredTargetCount
duplicateTargetCount
targetOwnerAndProperties
targetBoundingBoxes
computedDisplayVisibilityOpacity
finalSemanticState
interruptionOrFallbackReason
audioCueAndLabel
runtimeCountsBeforeAndAfter
acknowledgmentTimestamp
```

### 4.1 Universal pass rules

A scene passes only if:

- the expected trigger selects the expected scene contract and payload;
- every required selector resolves to the declared cardinality within the declared scene host;
- every required target has a non-zero bounding box, intersects the scene host or viewport as intended, and is not `display:none`, `visibility:hidden/collapse`, or effectively transparent at its required checkpoint;
- hidden PageFlip source nodes, off-section nodes, and stale scene instances are excluded;
- duplicate count is zero unless a contract explicitly declares cardinality greater than one;
- one runtime owns each animated property on a node for the whole scene interval;
- a rejected ownership claim prevents the rejected runtime from writing, rather than merely warning;
- labels occur in order and the final semantic state is stable after cleanup;
- skip, abort, failure, and reduced paths end in a readable and interactive state;
- sound is synchronized to a semantic label after target validation and is never the only success signal;
- a mandatory presentation is not marked viewed before visible success, explicit accessible fallback completion, or an intentional user skip receipt;
- replay does not reissue the server mutation or create a second viewed receipt; and
- runtime instance counts return to their expected baseline after completion/unmount.

The director must report a structured target-contract failure when any required target rule fails. A fulfilled GSAP promise, audio cue, console-free run, screenshot, or snapshot refresh by itself is not a pass.

## 5. Unit tests

| ID    | Unit under test           | Required cases                                                                                                         | Concrete pass assertion                                                                                                                          |
| ----- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| UT-01 | Scene registry            | All 28 registered names; production/dev reachability metadata                                                          | No duplicate names; each scene declares trigger, host, required/optional targets, modes, replay, timeout, final state, and acknowledgment policy |
| UT-02 | Target resolver           | missing, hidden, zero-area, off-host, duplicate, disconnected, PageFlip-source, explicit multi-target                  | Reject invalid required targets with structured diagnostics; never silently return a successful empty array                                      |
| UT-03 | Ownership registry        | GSAP/Motion, GSAP/CSS, Motion/PageFlip, layoutId/GSAP FLIP, Rive/Lottie container wrappers                             | Second owner cannot write the same property; wrapper separation allows non-overlapping properties                                                |
| UT-04 | Motion policy resolver    | full, gentle, product reduced, browser reduced, both reduced, stored-value corruption, media change                    | One resolved policy is the strictest applicable state and is consumed consistently; no `MotionConfig` bypass                                     |
| UT-05 | Duration/travel policy    | every scene in full/gentle/reduced                                                                                     | Gentle scales duration/travel as declared; reduced preserves ordered final state without unnecessary spatial travel                              |
| UT-06 | Replay receipt            | original play, repeated replay, refresh reconstruction, stale payload, simultaneous live event                         | Presentation replay is idempotent, uses persisted immutable payload, and never produces a command or viewed mutation                             |
| UT-07 | Event acknowledgment gate | success, skip, accessible fallback, missing target, thrown scene, abort, timeout                                       | Viewed acknowledgment occurs only for allowed terminal states; failure remains retryable                                                         |
| UT-08 | One-shot keys             | landing first arrival, per-campaign journal intro, per-event automatic presentation                                    | Key scope exactly matches tab/campaign/event policy; route remount and refresh behavior are explicit                                             |
| UT-09 | Journal phase observer    | expected animation, missing actor, missing animation, infinite animation, rejected `finished`, abort, timeout, unmount | No indefinite wait; abort/unmount settles promptly; missing expected animation fails or follows an explicit reduced fallback                     |
| UT-10 | Audio label map           | every cue-bearing event/scene, mute, disabled audio, Web Audio failure                                                 | One cue at the declared label after target validation; failure is non-blocking and never substitutes for visuals/text                            |
| UT-11 | PageFlip settings         | full to gentle, gentle to full, reduced entry/exit, orientation                                                        | Existing instance applies supported settings or recreates once while preserving page/index/focus                                                 |
| UT-12 | Lottie control policy     | full/gentle/reduced changes, visibility, document hidden, non-looping ink trigger                                      | Ambient loops do not reload unnecessarily; one-shot ink starts only from its semantic label and does not replay on mode change                   |
| UT-13 | Rive contracts            | invitation seal, journal clasp, voyage compass, finale mechanism                                                       | Production contract requires a real project `.riv` path before being reported as Rive-ready; state/input/reduced-pose schema validates           |
| UT-14 | Interruption priority     | new live event, navigation, skip, pause, offline, auth route handoff                                                   | Deterministic queue/cancel policy; exactly one terminal receipt and stable final state                                                           |
| UT-15 | Metrics/runtime counters  | mount, failure, retry, replay, unmount                                                                                 | Counts cannot become negative or monotonically grow; failed initialization is released                                                           |

Use fake timers only for deterministic scheduling assertions. At least one real-browser test must cover WAAPI `animation.finished`, media-query changes, and route unmount because JSDOM cannot validate those browser behaviors.

## 6. Component tests

| ID    | Component/runtime                          | Required cases                                                                                                          | Pass threshold                                                                                                                                   |
| ----- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| CT-01 | `AnimationProvider` / Motion configuration | browser preference changes before and after mount; product mode cycles                                                  | All consumers report the same resolved policy on the next committed render; spatial Motion is absent in resolved reduced mode                    |
| CT-02 | `PageFlipBook`                             | manual/keyboard/programmatic turn, queue, mode change, orientation, content update, import failure, reduced fallback    | Page/index/focus preserved; one visible host; hidden sources contain no selectable production scene targets; one instance destroyed per creation |
| CT-03 | `LottieEffect`                             | load, ready, error, stalled load, viewport/document pause, mode change, unmount                                         | No blank required state; ambient continuity preserved; one-shot begins only when commanded; load/runtime counts return to baseline               |
| CT-04 | `RiveStatefulObject`                       | real asset, missing asset, load error, state signals, rapid signal replacement, reduced pose, unmount                   | Correct state machine/input receives each signal; fallback is explicit and accessible; never labeled as a live Rive animation when fallback-only |
| CT-05 | Player scene host                          | each progression prop, section changes during play, duplicate selectors, absent section targets                         | Required global host remains mounted; correct instance wins; off-section nodes cannot satisfy the contract                                       |
| CT-06 | `JournalWorkspace` and opening machine     | every opening phase, skip, replay, abort/unmount, reduced, missing actor                                                | Ordered final readable journal; no hang; controls and focus enabled only when interactive                                                        |
| CT-07 | Motion/GSAP collision surfaces             | Voyage Chart marker, Ship's Log row, artifact inspection object, companion navigation, Quartermaster action             | Motion and GSAP animate separate wrappers/properties; instrumentation reports no concurrent same-property writer                                 |
| CT-08 | Platform forms/dialogs/cards               | pending, success, validation error, server error, permission mismatch, rapid resubmit, route unmount                    | Pending state is visible; result appears within 1,000 ms of response; no stale or duplicate transition; focus enters the result/alert            |
| CT-09 | Audio controls                             | enabled, muted, volume, reduced motion, context creation failure                                                        | Mute/volume persist; motion mode does not silently override sound preference; every cue has a visual/text equivalent                             |
| CT-10 | Development showcase                       | all 36 entries; replay, pause, resume, seek, speed, skip, reverse, serial trailer, fallback simulation, runtime metrics | Harness still exercises every registered surface and each control, but assertions explicitly identify it as harness-only                         |

## 7. Target-integrity tests

Target integrity is a precondition, not optional diagnostics.

### 7.1 Contract assertions

For every named scene, test:

1. zero required targets -> structured failure, no timeline/audio/viewed acknowledgment;
2. one correct visible target -> start allowed;
3. duplicate required target -> failure unless exact cardinality is declared;
4. matching hidden source plus visible clone -> only the host-bound visible clone qualifies;
5. matching permanent section target plus temporary event prop -> contract instance/host ID chooses the intended target;
6. target detached after validation -> interrupt and reconcile through the declared fallback;
7. target ownership rejected -> target is removed from the timeline and the scene fails if it was required;
8. opacity, display, visibility, clipping, zero-size, and viewport-intersection changes at each semantic label -> recorded and asserted;
9. properties changed by GSAP, Motion, CSS, StPageFlip, Rive, or Lottie -> exactly match declared ownership; and
10. cleanup -> no transform/opacity snapback that contradicts the committed semantic state.

### 7.2 High-risk duplicate fixtures

Create focused fixtures for `route-path`, `map-fog`, `map-marker-new`, `artifact-reveal`, `artifact-light`, `artifact-slot-target`, `artifact-connection-path`, `quest-note-new`, `quest-stamp`, `red-thread`, `log-entry-new`, `log-symbol-new`, `finale-ring-outer`, `finale-ring-inner`, `finale-light-path`, `workspace-light`, `lantern`, and `peripheral`.

Each fixture includes a permanent section node, temporary event node, hidden PageFlip source, visible PageFlip clone, and stale prior-scene node. The current scene contract must select only its declared host/instance. Broad root selection is a failure even if the visual snapshot looks plausible.

### 7.3 Phase 1 receipt and mandatory-acknowledgment matrix

The director receipt, scene acknowledgment policy, Player consumer, and viewed route must agree on this matrix. `PlayerExperience.test.tsx` verifies the failure/retry/snapshot-refresh sequence, while the director and viewed-route suites verify the terminal-state and persistence boundaries.

| Terminal receipt outcome                          | Mandatory `CHAPTER_RELEASED` viewed?      | Focused rule                                                                                |
| ------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `presented`                                       | Yes                                       | Required targets and semantic final state succeeded                                         |
| `presented-fallback`                              | Yes only when the scene policy permits it | Fallback callback must explicitly report completed, readable content and the semantic state |
| `skipped-by-user`                                 | Yes only when the scene policy permits it | Intentional skip commits the declared readable final state                                  |
| `skipped-by-policy`                               | Policy-specific                           | Deprecated/informational policy cannot impersonate mandatory presentation                   |
| `missing-required-target`                         | No                                        | Remains retryable; snapshot refresh may still reconcile business state                      |
| `duplicate-required-target`                       | No                                        | Cardinality failure cannot acknowledge                                                      |
| `ownership-rejected`                              | No                                        | A runtime that does not own the property cannot present it                                  |
| `runtime-failed`                                  | No                                        | Builder, timeline, operation, or runtime error remains retryable                            |
| `timed-out` without approved fallback             | No                                        | Timeout is a distinct failure                                                               |
| `aborted`                                         | No                                        | Route/unmount abort does not imply presentation                                             |
| `interrupted` without completed approved fallback | No                                        | A later scene cannot acknowledge the interrupted scene                                      |

The retry proof requires: first automatic attempt fails, no viewed request is sent, the authoritative snapshot refresh still occurs, a bounded user retry succeeds, exactly one viewed request follows that successful receipt, and duplicate SSE/retry activity does not create another acknowledgment. The route retains its existing idempotency key and returns a generic conflict for missing, cross-campaign, wrong-type, or unreleased events without exposing eligibility details.

## 8. Every-event/every-section matrix

Run every one of the 17 progression event types from each of the six Player sections: **102 independent cases**. Each case starts from a fresh authoritative snapshot and unique event ID.

Matrix codes:

- `G` - the persistent global progression host presents a visible, unique, correct event object; the current section remains mounted; settled authoritative content updates; viewed acknowledgment follows permitted presentation completion.
- `C` - the full chapter ceremony uses the persistent ceremony host, preserves the current section, and offers an explicit Journal action after completion; it is never allowed to depend on Journal targets.
- `+J`, `+V`, `+T`, `+Q`, `+L`, `+F` - in addition to the global presentation, the currently relevant Journal, Voyage Chart, Treasure, Quest, Log, or Finale destination settles visibly without becoming a second cinematic owner.

| Event type -> scene                                  | Journal | Voyage Chart | Treasure Altar | Side-Quest Ledger | Ship's Log | Finale Chamber |
| ---------------------------------------------------- | ------- | ------------ | -------------- | ----------------- | ---------- | -------------- |
| `CHAPTER_RELEASED` -> `chapter-release`              | C+J     | C            | C              | C                 | C          | C              |
| `CHAPTER_SOLVED` -> `mark-solved`                    | G+J     | G            | G              | G                 | G          | G              |
| `ARTIFACT_AWARDED` -> `artifact-award`               | G       | G            | G+T            | G                 | G          | G              |
| `ARTIFACT_SILHOUETTE_REVEALED` -> `artifact-award`   | G       | G            | G+T            | G                 | G          | G              |
| `ARTIFACT_CONNECTED` -> `artifact-connection`        | G       | G            | G+T            | G                 | G          | G              |
| `MAP_LOCATION_REVEALED` -> `map-reveal`              | G       | G+V          | G              | G                 | G          | G              |
| `MAP_ROUTE_REVEALED` -> `route-draw`                 | G       | G+V          | G              | G                 | G          | G              |
| `SIDE_QUEST_DISCOVERED` -> `quest-discovery`         | G       | G            | G              | G+Q               | G          | G              |
| `SIDE_QUEST_UPDATED` -> `quest-discovery`            | G       | G            | G              | G+Q               | G          | G              |
| `SIDE_QUEST_COMPLETED` -> `quest-complete`           | G       | G            | G              | G+Q               | G          | G              |
| `JOURNAL_ANNOTATION_ADDED` -> `log-entry`            | G+J     | G            | G              | G                 | G          | G              |
| `PLAYER_LOG_ENTRY_ADDED` -> `log-entry`              | G       | G            | G              | G                 | G+L        | G              |
| `FINALE_TEASED` -> `finale-tease`                    | G       | G            | G              | G                 | G          | G+F            |
| `FINALE_REQUIREMENT_UPDATED` -> `finale-requirement` | G       | G            | G              | G                 | G          | G+F            |
| `CAMPAIGN_PAUSED` -> `pause`                         | G       | G            | G              | G                 | G          | G              |
| `CAMPAIGN_RESUMED` -> `resume`                       | G       | G            | G              | G                 | G          | G              |
| `STATE_REVERTED` -> `undo`                           | G       | G            | G              | G                 | G          | G              |

Every cell asserts the universal truth oracle plus:

- route and section before/after;
- exact scene and immutable event payload;
- exactly one active progression host and scene instance;
- required/visible/duplicate target counts;
- no hidden source or unrelated section target selected;
- final snapshot sequence and event-derived content;
- one permitted viewed receipt only after completion/fallback/skip;
- no receipt on required-target failure;
- focus restoration and live-region announcement;
- runtime counts after cleanup; and
- replay availability from persisted event history after refresh.

Run the complete 102-case matrix first in full mode at 1440x900. Then apply the risk-based cross product in Sections 11 and 12: all 17 events across five modes in their relevant section, chapter release and global pause/resume/undo across all six sections and all five modes, and every P0/P1 event at all six viewports. Do not create an unbounded Cartesian suite when pairwise/risk coverage supplies the same evidence.

## 9. End-to-end tests

### 9.1 Player ceremony and progression

| ID      | Flow                            | Required checkpoints                                                                                                                                                                    |
| ------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E2E-P01 | First Player visit              | first-arrival key absent; activation; journal phase labels; PageFlip handoff; interface/focus ready; key written only after valid terminal state                                        |
| E2E-P02 | Same-tab/session reentry        | abbreviated reentry only; full Replay introduction remains available; no server mutation                                                                                                |
| E2E-P03 | Chapter release                 | authoritative command/event, target preflight, seal, parchment, ink heading/story/objective/riddle, map/quill, readable final state, viewed receipt; elapsed time strictly `<10,000 ms` |
| E2E-P04 | Chapter release outside Journal | repeat from Chart, Treasure, Quest, Log, Finale; global ceremony is visible; section does not silently supply required targets or force navigation                                      |
| E2E-P05 | All progression types           | complete the 102-cell matrix and assert current section plus relevant settled destination                                                                                               |
| E2E-P06 | Event burst                     | queue two different events and a duplicate event ID; order is stable, duplicate is ignored, each unique event receives one terminal receipt                                             |
| E2E-P07 | Offline/reconnect               | disconnect before event, reconnect with replayed SSE/snapshot, present unseen event once, no skipped sequence or duplicate presentation                                                 |

### 9.2 Authentication

Test modern Player sign-in, modern Captain sign-in, modern Creator sign-in, legacy Player AccessGate, and legacy Quartermaster login as separate named projects/fixtures. For each:

- pending state starts after submission and blocks duplicate submission without trapping focus;
- invalid credentials, invalid invitation, permission mismatch, network failure, and server failure render a programmatically associated alert within **1,000 ms after the response/failure is observed**;
- the baseline legacy regression specifically asserts that HTTP 401 produces `.form-error` (or its governed replacement) rather than timing out at 10 seconds;
- success animation begins only after the authoritative success response;
- final open/unlocked/success state cannot snap back before route handoff;
- route navigation occurs once and only to the authorized destination;
- abort/unmount cancels visual work and does not submit again; and
- reduced mode preserves pending/result order and focus without spatial travel.

### 9.3 Invitations and waiting room

Cover resolution/loading, valid, invalid, expired, revoked, PIN required/invalid/valid, account required, acceptance, decline, replacement, transition to waiting room, access revocation, readiness change, polling fallback, scheduled start, Captain launch, reconnect, and automatic journal transition.

Acceptance must be server-first: the seal/open transition cannot imply success before the mutation succeeds. Replay, where allowed, replays only the persisted presentation. Launch plays once per authoritative launch version. Failure leaves readable recovery actions and the correct focus target.

### 9.4 Libraries, wizard, Studio, and shell

Cover Player Library groups, gallery/list, search, sort, pin/unpin/hide, waiting/active/completed/new-edition cards, empty states, and card-to-voyage transitions. Cover Captain Library tabs, groups, voyage cards, launch state, invitation extend/revoke/replace, published Tales, every new-voyage wizard step, invitation/QR result, and polling updates. Cover Studio Library/editor presence, dnd-kit reorder, insertion/deletion, validation, autosave, preview replay, publish/version, upload error, immutable versions, and comparison.

Motion owns list/layout/dialog/route presence; dnd-kit owns authoring drag movement. Tests reject GSAP narrative timelines on ordinary filters/cards and reject Motion as the owner of long server-synchronized ceremonies. Shell, theme, and color-scheme transitions must not restart narrative scenes.

### 9.5 Implemented Lanternwake Phase 1 browser gate

The following specifications are implemented, statically checked, and passed in the coordinator-owned isolated run. Each mutating Chromium flow first requires `/api/dev/validation/database-identity` to prove the isolated validation database and nonce; WebKit remains read-only or intentionally skipped for those cases:

- `tests/e2e/lanternwake-phase1.spec.ts` proves a missing required target remains unviewed and retryable, then proves that the approved reduced readable fallback is eligible for exactly one acknowledgment. Its serial replay case uses the released event, reloads the document, replays twice after refresh, changes the resolved motion policy from reduced to full, replays again, records every non-GET/HEAD `/api` request during each replay window, and compares the complete persisted campaign mutation state plus the immutable replay payload before and after.
- `tests/e2e/lanternwake-journal.spec.ts` creates a uniquely named voyage only after database-identity proof. A probe installed before navigation tracks animation listeners, keydown listeners, EventSources, and active fetches. Same-document Journal-to-Library unmount must release every tracked resource in less than 250 ms without changing the document token; repeated Library-to-Journal cycles must return resource balances to zero. A new page for each test supplies a fresh document/probe rather than leaking counters across tests. Browser-reduced mode must reach the readable static `JOURNAL_READY` fallback.
- `tests/e2e/lanternwake-access-transitions.spec.ts` proves both Player invitation access and Quartermaster login retain their committed success pose until the authorized destination is visibly ready. The transition frame probe rejects any visual snapback before handoff and verifies the authenticated Player snapshot or Captain status afterward.

The authoritative browser result was 27 Playwright tests passed and 17 intentional skips. The validation report also confirmed isolated mutation deltas, the replay no-mutation comparisons, Journal cleanup below 250 ms with tracked resource balances returned to zero, and final validation-resource cleanup. The 17 skips remain explicitly classified skips rather than passes.

## 10. Replay tests

Apply this exact protocol to every scene whose contract allows replay, including landing gateway, journal introduction, chapter release, persisted progression presentations, invitation reveal where allowed, and Studio preview:

| Step | Action                        | Required assertion                                                                                                |
| ---- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1    | Play once                     | One trigger, correct payload/targets, one terminal presentation receipt                                           |
| 2    | Replay immediately            | Same immutable payload; no mutation/viewed POST; clean starting state                                             |
| 3    | Replay again                  | Identical semantic final state and runtime counts; no accumulated transforms/listeners                            |
| 4    | Navigate away and replay      | Explicit replay surface works without forcing a stale section; prior route/focus is restored                      |
| 5    | Refresh and replay            | Replay is reconstructed from persisted safe history, not component memory such as `lastRelease`                   |
| 6    | Switch motion mode and replay | New resolved policy applies; Lottie/Rive/PageFlip do not accidentally restart before replay                       |
| 7    | Skip midway and replay        | Skip commits accessible final state and receipt; replay starts from normalized initial presentation state         |
| 8    | Interrupt with another scene  | Priority/queue policy is deterministic; neither scene acknowledges the other's terminal state                     |
| 9    | Inspect network/database      | No command, event, invitation, chapter, or viewed-state mutation from presentation-only replay                    |
| 10   | Inspect cleanup               | GSAP/Rive/Lottie/PageFlip counts, listeners, timers, transforms, focus, and live regions return to expected state |

Replay after refresh is a release blocker for chapter release. The baseline `lastRelease` component-only behavior is an explicit failing regression fixture, not accepted design.

Phase 1 proof reconstructs `latestChapterReleasePresentation` from a direct latest-eligible event query rather than a bounded recent-event window. The payload preserves immutable event identity while containing only authorized readable chapter presentation data; raw progress events, campaign snapshots, private riddles, and unpublished content are not returned as replay data. Player replay uses the persisted payload, current resolved motion policy, a new presentation instance, and prior section/focus restoration. The component assertion forbids story and viewed mutation. The passing isolated browser specification exercises the released event, an initial replay, document refresh, two replays after refresh, a real resolved reduced-to-full mode change, and another replay. It captures every unsafe `/api` request during each replay and compares progress events, snapshots, viewed records, command executions, audit logs, Tale-session events, Player access/presence, audio preferences, and the immutable replay projection before and after. The passing runtime trace is the Phase 1 Step 5/9 proof; it does not complete the broader replay matrix reserved for later phases.

## 11. One-shot tests

| One-shot surface                         | Intended scope                                                             | Required positive cases                                      | Required negative cases                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Landing first arrival                    | Once per browser tab; manual replay allowed                                | first visit uses full arrival; same-tab revisit uses reentry | new tab gets first arrival; route remount does not erase policy; replay does not rewrite product state |
| Player journal introduction              | Once per campaign per browser tab; abbreviated reentry; manual full replay | first open, reentry, forced full replay                      | campaign A key does not suppress campaign B; aborted opening does not mark seen prematurely            |
| Progression event automatic presentation | Once per unique authoritative event/device receipt                         | duplicate SSE ignored; refresh reconstructs unseen state     | failed/invisible presentation is not marked viewed; user replay creates no new event/receipt           |
| Chapter release ceremony                 | Once automatically per release event; manual persisted replay              | automatic presentation once; unlimited safe replay           | component remount does not lose replay; mode change does not auto-replay                               |
| Invitation acceptance/decline            | Once per successful authoritative mutation                                 | success presentation once for response/version               | rerender, back/forward, or animation replay does not resubmit                                          |
| Waiting-room launch                      | Once per authoritative launch version                                      | one transition when state changes                            | polling the same version does not replay launch ceremony                                               |
| Non-looping ink Lottie                   | Once on the named semantic label                                           | command begins the correct segment                           | component mount, visibility restore, or mode change does not replay it                                 |
| Ambient CSS/Lottie                       | Loop only while visible and policy permits                                 | pause/resume without resetting semantic state                | hidden document, offscreen element, or reduced policy does not keep expensive motion running           |
| Viewport entrance effects                | Once per declared route/list presence, not accidental observation churn    | enter/remount behavior matches contract                      | resize/intersection jitter does not repeatedly replay content                                          |

Each failure message states the exact one-shot key and scope (`component mount`, `browser tab`, `campaign`, `event ID`, `route visit`, or `application session`); tests must not report only "runs once."

## 12. Mode matrix

Run the following **five resolved policy states**. Product preference and browser preference are controlled independently.

| Matrix state       | Product setting | Browser preference | Expected resolved behavior                                   | GSAP                                 | Motion                                        | PageFlip                                               | Rive/Lottie/CSS/audio                                                                  |
| ------------------ | --------------- | ------------------ | ------------------------------------------------------------ | ------------------------------------ | --------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| M1 Full            | full            | no-preference      | Full declared cinematic behavior                             | Full duration/travel                 | Full presence/layout variants                 | 1100 ms physical curl                                  | Full state motion/ambient loops; CSS full; sound follows user setting                  |
| M2 Gentle          | gentle          | no-preference      | Same narrative order with shorter/lower-amplitude motion     | Gentle contract values               | Gentle variants                               | 620 ms or declared gentle setting on existing instance | Reduced amplitude/speed without runtime recreation; sound independent                  |
| M3 Product reduced | reduced         | no-preference      | Ordered readable final states; no unnecessary spatial travel | Zero/minimal travel, labels retained | Non-spatial opacity/state or immediate result | Accessible static-page fallback                        | Stable Rive pose, representative Lottie frame, reduced CSS; sound follows user setting |
| M4 Browser reduced | full            | reduce             | Must resolve to reduced despite stored full                  | Same as M3                           | Same as M3; `MotionConfig` cannot bypass      | Same as M3                                             | Same as M3                                                                             |
| M5 Both reduced    | reduced         | reduce             | Same semantic state as M3/M4; no double-reduction defects    | Same as M3                           | Same as M3                                    | Same as M3                                             | Same as M3; no duplicate mode transition/reload                                        |

For every state assert narrative labels/order, final DOM and focus equality, interaction availability, target truth, duration/travel policy, runtime counts, and audio preference. Changing M1->M2 in place must update PageFlip timing. Changing any mode must not reload ambient JSON unnecessarily or replay the ink bloom. Changing the browser media query after mount must update Motion, GSAP, PageFlip, Rive, Lottie, CSS, and metrics through the same resolved policy.

## 13. Viewport matrix

| ID  | Viewport  | Orientation/class             | Required coverage                                                                                        |
| --- | --------- | ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| V1  | 2560x1440 | Large desktop landscape       | Landing, all role/auth/platform shells, Player all sections, Quartermaster, Studio, showcase             |
| V2  | 1920x1080 | Desktop landscape             | Same routes; baseline visual checkpoint set                                                              |
| V3  | 1440x900  | Constrained desktop landscape | Primary functional matrix and all semantic checkpoints                                                   |
| V4  | 430x932   | Mobile portrait               | Navigation/focus, single-page journal, forms/dialogs, fallback controls, no clipping                     |
| V5  | 390x844   | Narrow mobile portrait        | Long labels/errors, invitation PIN, replay/skip controls, no horizontal overflow                         |
| V6  | 844x390   | Mobile landscape              | Short-height journal/ceremony, keyboard/focus, controls remain reachable without hidden required targets |

At each viewport assert `document.scrollWidth <= document.documentElement.clientWidth`, except a component with an explicitly governed horizontal scroller. Required targets must have non-zero rectangles and remain in their declared host. Controls cannot be obscured by fixed layers. Text, focus rings, alerts, skip/replay, PageFlip controls, and reduced fallback remain reachable at 200% browser zoom where supported.

PageFlip additionally asserts single/double orientation, current page preservation, turn buttons, keyboard turn, orientation change, and fallback at all six viewports. The landing regression asserts `stars` has non-zero area when required and `arrival-copy` cardinality matches its contract.

## 14. Visual checkpoint tests

Screenshots are captured at semantic states, never at an arbitrary sleep:

- landing: `dark-sea`, gateway reveal, roles ready, session reentry, reduced final;
- authentication: idle, pending, invalid/error, success final immediately before navigation;
- invitation: resolving, valid reveal, PIN, terminal invalid/expired/revoked, accepted final;
- waiting room: closed journal, readiness delta, launch ready, reconnect/revoked;
- journal opening: latch released, cover open, sealed page, seal broken, book settled, PageFlip interactive;
- chapter release: preflight, seal crack, parchment open, each ink stage, route/quill, complete, skip final, reduced final;
- each Player event: global prop active and relevant section settled;
- PageFlip: before turn, mid-turn when deterministic, settled page, reduced/failure fallback;
- Rive: every named state and reduced stable pose once project assets exist;
- Lottie: ready loop, paused representative frame, commanded ink segment, error fallback;
- Quartermaster: confirm, pending overlay, failure reversal, success reconciliation;
- Studio: drag placeholder, reordered settle, validation, autosave, publish/version result.

Use deterministic fixtures, fonts, locale, time, random seed, and asset cache. Mask clocks, connection telemetry, and genuinely nondeterministic particles. Pixel comparison is secondary to DOM/target assertions: after approved baselines, allow at most **0.5% differing pixels on desktop** and **1.0% on mobile** outside declared masks. Any missing required target, wrong layer, clipped control, unreadable text, or focus loss fails regardless of pixel percentage.

## 15. Interruption tests and lifecycle handling

| ID    | Interruption                   | Injection point                                                 | Required terminal behavior                                                                                   |
| ----- | ------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| IN-01 | User skip                      | each skippable semantic label                                   | Immediate readable committed state; one skip receipt; controls/focus restored                                |
| IN-02 | Route/section navigation       | before validation, mid-scene, final label                       | Declared cancel/continue policy; no write to detached nodes; no false acknowledgment                         |
| IN-03 | Component unmount              | CSS/WAAPI phase, GSAP timeline, Rive/Lottie load, PageFlip turn | Abort settles within 250 ms; timers/listeners/runtimes released                                              |
| IN-04 | Tab hidden/visible             | ambient loop and ceremony                                       | Ambient pauses; mandatory presentation follows declared pause/resume policy without restart or duplicate cue |
| IN-05 | Offline/reconnect              | before event, mid-event, before viewed acknowledgment           | Readable offline state; event remains retryable; reconnect reconciles exactly once                           |
| IN-06 | Second live event              | each first-scene stage                                          | Priority/queue order honored; unique host/instance; no target theft                                          |
| IN-07 | Motion-mode change             | mid-GSAP, mid-PageFlip, during Lottie/Rive state                | Deterministic handoff to resolved policy; no duplicate instance or replay                                    |
| IN-08 | Asset/runtime failure          | before ready and after partial mount                            | Explicit accessible fallback; scene either completes allowed fallback or remains retryable                   |
| IN-09 | Infinite/missing CSS animation | `waitForJournalPhase`                                           | Timeout/validation error; never hangs; reduced missing-animation path is explicit                            |
| IN-10 | Failed server response         | auth, invitation, command, viewed receipt                       | Visual success cannot precede authority; failure reversal leaves action recoverable                          |
| IN-11 | Back/forward/refresh           | pending transition and completed ceremony                       | No duplicate mutation; persisted presentation/replay state reconstructs correctly                            |
| IN-12 | Repeated control activation    | submit, replay, skip, page turn, scene control                  | Debounced/idempotent behavior; one owner and one terminal state                                              |

## 16. Performance tests

Performance measurements run against a production build on an otherwise idle, recorded hardware/browser profile. Development FPS and showcase counters are diagnostics only.

| Metric                    | Scenario                                                   | Required threshold                                                                                                                     |
| ------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Chapter-release wall time | full mode, assets warm and cold                            | Strictly `<10,000 ms` from validated trigger to interactive final state; target design budget 5,000-9,000 ms                           |
| Target preflight          | all named scenes                                           | `<50 ms` p95 and before audio/timeline start                                                                                           |
| Animation frame pacing    | landing, opening, release, PageFlip, route/list transition | p95 frame interval <=25 ms desktop and <=40 ms mobile profile; no single app-attributable stall >100 ms                                |
| Long tasks                | each ceremony/transition                                   | No app-attributable long task >100 ms; cumulative long-task time <=200 ms per chapter ceremony and <=100 ms per ordinary UI transition |
| Layout shift              | route/section/card transitions and asset readiness         | CLS <=0.10 per navigation; no shift caused by late animation asset sizing after interaction begins                                     |
| Interaction readiness     | skip, replay, page controls, forms                         | Input response begins <=100 ms; long cinematic work never blocks skip/focus                                                            |
| Runtime duplication       | mode change, replay, route cycle                           | Rive/Lottie/PageFlip active counts never exceed declared mounted component count; GSAP timelines return to zero after terminal cleanup |
| Network/cache             | three Lottie assets and future Rive assets                 | One fetch per asset per cache policy; full/gentle changes do not refetch; failure retry is bounded and visible                         |
| Selector/layout work      | root scenes and event props                                | No document-wide selector for production scene targets; no repeated layout-read/write cycle per target label beyond contract budget    |

Collect trace markers at trigger, validation, every semantic label, final state, and acknowledgment. Report median and p95 over at least five warm runs plus one cold-asset run per P0 ceremony on desktop; run the defined mobile profile separately. A threshold miss fails even when the animation looks acceptable.

For the Phase 1 target-preflight acceptance gate, `src/animation/core/target-preflight.test.ts` separately measures the real preflight and ownership-release path with eight warmups and 40 recorded executions, uses the nearest-rank p95 sample at index 37, and requires `<50 ms`. Interruption budgets are independently enforced: unit abort must settle in `<100 ms`, and the same-document browser unmount must settle in `<250 ms` with animation listeners, window keydown listeners, EventSources, and active requests all at zero. The repeated three-cycle Journal case must show identical zero post-unmount balances rather than merely avoiding an exception.

## 17. Memory-leak tests

Warm the route once, force a supported GC checkpoint where the browser/test environment permits, then execute **20 cycles** of each scenario:

1. play/replay/cleanup for every narrative scene family;
2. enter/leave Player and cycle all six sections;
3. open/close artifact inspection and dialogs;
4. create/destroy PageFlip and change orientation/content;
5. mount/unmount each Rive and Lottie object, including load failure;
6. switch full/gentle/reduced/browser-reduced policies;
7. disconnect/reconnect SSE and visibility listeners; and
8. enter/leave the animation showcase and run its serial trailer.

Pass requirements after each cycle and after cycle 20:

- GSAP active timeline count returns to zero when no scene is active;
- Rive, Lottie, and PageFlip instance counts return exactly to the warmed baseline;
- EventSource, media-query, visibility, resize, keyboard, online/offline, PageFlip, timer, and animation listeners do not grow monotonically;
- no detached scene host, PageFlip source/clone, canvas/SVG runtime, or inspection node remains retained without an intentional cache owner;
- timers and pending WAAPI `finished` promises return to baseline;
- after GC, retained heap growth is <=5% of warmed baseline or <=2 MiB, whichever allowance is larger, with no monotonic positive slope across the final five cycles; and
- replay 20 produces the same semantic final state and target counts as replay 1.

If forced GC is unavailable, runtime/listener/detached-node counts remain hard gates and heap results are reported as observational rather than falsely precise.

## 18. Fallback tests

| Runtime/failure                   | Required injected conditions                                                                     | Required fallback result                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| GSAP target contract              | zero, duplicate, hidden, detached, ownership rejection                                           | No misleading success; accessible final summary or retryable failure; no viewed acknowledgment unless fallback is contractually sufficient |
| Rive                              | contract has no path, 404, corrupt binary, missing state machine/input, runtime import failure   | Explicit SVG/CSS fallback, stable state and text; metrics say fallback, never Rive-ready                                                   |
| Lottie                            | 404, malformed JSON, stalled load, renderer error, document hidden, reduced mode                 | Representative static art or CSS state; no blank layout, retry storm, or accidental one-shot replay                                        |
| PageFlip                          | import failure, initialization throw, source update failure, orientation failure, reduced policy | Static accessible page controls, current page/focus preserved, one visible content copy                                                    |
| CSS/WAAPI                         | missing actor, zero animations, infinite animation, rejected promise, timeout                    | Declared immediate reduced state or explicit failure; no indefinite wait                                                                   |
| Web Audio                         | blocked context, missing buffer, decode/play error, mute                                         | Visual/text sequence continues; metrics record cue failure; no uncaught rejection                                                          |
| Motion                            | reduced policy, presence interruption, layout measurement failure                                | Immediate/non-spatial readable state; no focus loss or same-node GSAP conflict                                                             |
| Network/SSE                       | slow, failed, offline, duplicate/replayed event                                                  | Pending/offline status, idempotent reconciliation, unseen event remains presentable                                                        |
| Authentication/invitation command | 400/401/403/404/409/410/429/500 and timeout                                                      | Specific readable alert within 1,000 ms after response, focus recovery, no success transition or duplicate submission                      |

Fallback simulation in `/dev/animations` is a component/harness test only. Each production call site must also have a focused component or E2E fallback test.

## 19. Per-library acceptance matrix

| Library/tool       | Ownership assertion                                                    | Required focused coverage                                                                                | Release-blocking failures                                                             |
| ------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| GSAP               | Named narrative sequencing inside a versioned scene host               | All 28 contracts, target cardinality, labels, skip/abort/final state, empty target, event acknowledgment | Mandatory scene invisible; false completion; wrong/duplicate target; cleanup snapback |
| Motion             | React presence/layout/dialog/card/filter/button wrappers               | reduced variants, focus, layout stability, wrapper separation                                            | Spatial motion under resolved reduced mode; same-property GSAP collision; focus loss  |
| StPageFlip         | Physical page curl/index/orientation only                              | manual/keyboard/programmatic turn, mode update, clones, fallback, leak                                   | stale full/gentle timing; source selected by GSAP; page/focus loss                    |
| Rive               | Stateful seal/clasp/compass/finale object                              | real project asset, state machine/inputs, stable reduced poses, fallback truth                           | Production claims Rive-ready without asset; missing state has no readable fallback    |
| Lottie             | Contained ambient/effect rendering only                                | visibility pause, cache/mode continuity, semantic one-shot command, failure                              | ink starts/replays outside scene label; blank required state; unbounded reload        |
| CSS                | Material, physical-state, short transition, restrained ambient styling | data-state final poses, media query, animation/transition completion                                     | CSS alone controls authoritative narrative order; reduced state unreadable            |
| Web Animations API | Observe/await declared CSS completion                                  | abort, timeout, infinite/missing/rejected animations                                                     | wait can hang or missing actor silently passes when required                          |
| Web Audio API      | Cue at named semantic stage                                            | cue map, mute/volume, unavailable context, target validation order                                       | cue fires before authority/targets or is the only success indication                  |
| dnd-kit            | Studio drag/sort movement                                              | keyboard/pointer drag, cancel, rollback, persistence settle                                              | Motion/GSAP fights transform; failed save leaves false settled order                  |

## 20. Accessibility and semantic assertions

Every test layer includes the assertions it can reliably own:

- Reduced modes preserve narrative order, readable content, semantic labels, controls, and final state without unnecessary travel or continuous motion.
- Alerts use an associated live region/role and receive or are referenced by focus; visual motion is not the only error/success signal.
- Replay and skip have stable accessible names and remain keyboard reachable at every viewport.
- Page turns support buttons and keyboard without trapping focus in hidden source or clone content; only the visible page participates in the accessibility tree.
- Decorative Rive/Lottie/SVG/CSS objects remain hidden from assistive technology while their meaningful state has text.
- Color, opacity, blur, sound, or motion alone never communicates event type, connection, readiness, permission, or failure.
- Focus is restored after dialog, interruption, replay, route cancellation, and artifact inspection.
- Browser reduced-motion changes after mount are honored by Motion as well as the custom policy and CSS.
- Sound-enabled, sound-disabled/muted, and Web Audio failure cases produce the same authoritative text/state result.

Run automated accessibility checks at idle, pending, error, dialog, ceremony complete, reduced fallback, and each modern platform terminal state. Keyboard-only E2E remains required because static accessibility scans do not prove focus sequencing.

## 21. Test data and fixture catalog

The authoritative fixture builder creates immutable named states:

- Player/Captain/Creator credentials: valid, invalid, permission mismatch, locked/rate-limited;
- invitations: resolving, valid, PIN, invalid, expired, revoked, accepted, declined, replacement, account required;
- Library: empty, waiting, active, completed, replay/new edition, hidden/pinned, pending invitation;
- waiting room: closed, partial/ready crew, polling fallback, scheduled, launched, revoked, disconnected;
- Player snapshots: one fixture per section plus all duplicate generic targets and a clean no-target variant;
- one immutable payload for each of the 17 progression event types, with unique ID/sequence and a deliberate duplicate;
- chapter release with deterministic story/objective/riddle/map data and assets in warm/cold states;
- Studio: draft, validation failure, autosave pending/failure/success, published immutable version, upload failure;
- runtime failures: missing/corrupt/stalled Rive/Lottie, PageFlip import failure, Web Audio failure, infinite/missing CSS animation; and
- browser state: first/return visit, storage corruption, cached/uncached assets, online/offline, visible/hidden, all five motion-policy states.

Each fixture declares whether it is read-only or mutating, its database copy, reset strategy, expected row deltas, event IDs, and cleanup. Tests never share a mutable campaign concurrently.

## 22. Execution order and reporting

The critical path is:

```text
contract/unit gates
  -> component/runtime lifecycle gates
  -> target-integrity fixtures
  -> isolated database/runtime preflight
  -> serialized mutation E2E
  -> read-only browser/mode/viewport/visual shards
  -> production performance and leak run
  -> one integrated npm run validate gate
```

Unit and component shards may run concurrently when they do not share fake clocks or global runtime mocks. Database mutation, the authoritative Playwright server/browser, production build, performance run, and full validation remain serialized under their designated owners. A failed lane preserves its report and does not cancel unrelated read-only lanes; dependent gates remain blocked until its prerequisite is repaired.

Use only verified repository commands. Focused Vitest and Playwright file/grep selections are acceptable. Repository-wide gates are `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run assets:validate`, `npm run test:e2e`, `npm run build`, and finally `npm run validate`. There is no separate verified `test:integration` script.

Every run report records:

- baseline/branch/commit and integrated change under test;
- command, browser/project, viewport, motion state, sound/cache/network state;
- server PID/port and redacted database identity proof;
- passed/failed/skipped counts and exit status;
- scene observation artifacts, screenshots/traces, and performance/leak measurements;
- whether a failure is baseline-known, task regression, environment/isolation, blocked by missing production art, or unresolved; and
- skipped matrix cells with a precise reason. A skip is never counted as a pass.

## 23. Completion exit criteria

Phase 1 and the complete multi-phase animation program have different gates. Passing Lanternwake Phase 1 must not be reported as completion of the 102-case Phase 3 matrix, the production-art program, the six-viewport suite, final performance tuning, or the 20-cycle leak protocol.

### 23.1 Lanternwake Phase 1 gate

| Phase 1 criterion                                                    | Focused evidence                                                                                                                                                                                                                                                                                                                     | Integrated Phase 1 acceptance evidence                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| All 28 scenes have explicit target contracts and reachability        | Registry tests freeze 28 unique contracts, 41 required targets, 82 optional targets, and 16 production / 4 legacy / 5 future-contract / 3 deprecated dispositions                                                                                                                                                                    | The integrated gate passed; non-production dispositions remain explicit and cannot claim production semantics      |
| Required target truth cannot be faked                                | The 15-row preflight ledger covers all 16 named target conditions; viewport and ownership tests additionally reject invalid scope and conflicting ownership                                                                                                                                                                          | The isolated browser gate passed required-target failure and approved-fallback geometry/style checks               |
| Every play has a typed receipt and distinct terminal outcome         | Director tests prove structured preflight evidence, semantic labels, operation result, acknowledgment decision, hold/reconcile policy, and exactly-once cleanup                                                                                                                                                                      | The unit gate and browser receipt-dependent flows passed                                                           |
| Mandatory chapter release is receipt-gated and retryable             | Player tests deny viewed acknowledgment after failure while still refreshing the snapshot, then acknowledge once after successful retry; route tests reject ineligible events and keep upsert idempotent                                                                                                                             | Isolated E2E mutation counts and viewed-row proof passed                                                           |
| Approved accessible fallback is not confused with failure            | Director tests require an explicit completed, readable fallback result; metadata or an incomplete callback cannot produce `presented-fallback`                                                                                                                                                                                       | The forced readable-fallback browser checkpoint passed                                                             |
| Chapter-release replay is persisted, refresh-safe, and mutation-free | Snapshot/replay/Player tests use an immutable released event and sanitized readable chapter data; replay makes neither story nor viewed mutation and restores section/focus                                                                                                                                                          | Browser refresh, unsafe-request trace, and complete persisted-state comparison passed                              |
| Journal CSS/WAAPI waits are bounded and abortable                    | Opening-machine and Journal session tests cover completion, missing actor/animation, infinite work, rejection, timeout, abort under 100 ms, reduced fallback, unmount, and stale-generation suppression                                                                                                                              | Real-browser unmount completed below 250 ms and tracked resources returned to zero                                 |
| One motion authority reaches every runtime interface                 | Policy/provider/runtime tests cover M1-M5 resolution, provider propagation, MotionConfig, root CSS attribute, GSAP context, PageFlip, Lottie, Rive, and audio policy input                                                                                                                                                           | Integrated policy and browser reduced-motion checks passed                                                         |
| Non-production scenes are explicit                                   | Registry/showcase tests prove all eight revalidated non-production dispositions and label the development surface as harness-only                                                                                                                                                                                                    | The integrated gate passed                                                                                         |
| Integrated validation is complete                                    | `npm run validate` exited 0 with 46 Vitest files / 304 tests, 27 Playwright passes / 17 intentional skips, and 3 Lottie / 1 local Rive / SVG asset validation                                                                                                                                                                        | Seed/backfill/history/launcher checks, production build/restart, canonical-family preservation, and cleanup passed |
| Phase 1 browser acceptance ran without false proof                   | Three dedicated specifications require isolated database identity and cover missing target, approved fallback, replay after refresh twice, resolved mode change, unsafe-network and complete persisted-state comparison, fresh-document Journal cleanup, browser-reduced semantics, and Player/Quartermaster no-snapback transitions | The coordinator-owned isolated run passed; skips remain explicitly classified rather than counted green            |

The final Phase 1 gate is therefore **complete and green** on the integrated working tree. This conclusion is limited to the Phase 1 scope and evidence above; it does not promote any Phase 2-6 requirement, intentional skip, or missing production artwork into a pass. Repository synchronization is a separate finalization step and is not claimed here.

#### 23.1.1 Preserved Phase 1 boundaries and limitations

- Scene hosts are explicit compatibility hosts. The persistent/global Phase 2/3 cinematic host and broad host migration are not implemented or simulated by the tests.
- Replay is available through the current Player presentation surface; the future global ceremony host and the 102 all-event/all-section cells remain Phase 3 work.
- Production Rive artwork is still unavailable. Static SVG/CSS fallbacks are tested and must never be reported as live Rive readiness.
- Phase 1-owned animation and Player CSS consume the provider-resolved root policy. Broader pre-existing shell/platform stylesheet media queries are not counted as Phase 1 motion-policy proof or silently normalized by this plan.
- `AL-003` remains explicit: Lottie one-shot command gating and lifecycle behavior are proven at the runtime boundary, but the production Journal does not yet issue the ink-bloom command from its semantic ink label. That later-phase wiring is not claimed by the Phase 1 pass.
- Platform-motion expansion, the 238-item animation-addition blueprint, final easing/secondary-motion tuning, full performance profiling, and final visual polish are deliberately outside Phase 1.

### 23.2 Full animation-program exit criteria (future phases included)

The complete animation program is not complete until all of the following are true:

1. All 28 registered scenes have contract unit coverage and a deliberate reachability status; no production scene can pass with zero required visible targets.
2. All **102 Player event/section cases** pass with correct target host, uniqueness, final state, focus, receipt order, and persisted replay.
3. The ten-step replay protocol passes for every replayable scene, including chapter release after refresh and outside Journal, with zero server mutation.
4. Every one-shot has an exact, tested scope; failed/aborted presentations do not prematurely consume that scope.
5. The five-state mode matrix passes across every library; browser reduced motion cannot be bypassed and mode changes do not recreate/replay unrelated runtimes.
6. All six viewport rows pass for P0/P1 flows, PageFlip, navigation, forms, fallback controls, and relevant visual checkpoints without horizontal overflow or hidden required targets.
7. WAAPI phase waits cannot hang on abort, unmount, infinite, missing, or rejected animations.
8. PageFlip applies in-place full/gentle changes, preserves page/focus, and prevents hidden-source/visible-clone target ambiguity.
9. Lottie mode changes do not refetch/restart loops or replay the one-shot ink effect; Rive readiness is claimed only for real validated production art.
10. Motion/GSAP/CSS/PageFlip/Rive/Lottie ownership instrumentation reports no undeclared same-property writer on high-risk nodes.
11. Modern and legacy authentication, invitation, Library, waiting-room, Studio, shell, and offline/reconnect flows meet pending/error/success/focus and reduced-motion contracts; the 401-without-error regression is fixed and covered.
12. Chapter release completes in strictly less than 10,000 ms and meets the target-integrity/acknowledgment gate in warm and cold asset conditions.
13. Performance thresholds pass on the recorded production profile, and all 20-cycle leak scenarios return runtime/listener/detached-node counts to baseline within the declared heap allowance.
14. Every forced runtime/network/asset failure produces its specified readable fallback without a false success or indefinite block.
15. Focused gates and one integrated `npm run validate` pass on the combined implementation. Any skipped, missing-art, environmental, or unresolved result is explicitly disclosed and accepted by the governing owner; it is not silently treated as green.

Until these broader gates pass, the Phase 1 framework and its focused evidence do not prove complete all-event/all-section, all-viewport, production-art, performance, or leak-safe animation semantics.

## 24. Project Lanternwake Phase 2 release plan: Claim the Deck

This section adds the Phase 2 architecture gate without changing the completed Phase 1 evidence or promoting future-phase visual work. One coordinator owns the database copy, runtime, ports, browser, production build, full E2E, and final `npm run validate`. Component lanes may run focused non-mutating tests only.

### 24.1 Reconciliation validator gate

Run:

```powershell
python scripts/validate_animation_reconciliation.py `
  --oa-source Development_Docs/KG_Original_Animation_Audit_Reconciliation_Source.md `
  --matrix Development_Docs/Animation_System_Audit_Matrix.csv `
  --ledger Development_Docs/Animation_Original_Audit_Reconciliation_Ledger.csv `
  --shard-manifest Development_Docs/Project_Lanternwake_Phase_2_Reconciliation_Shard_Manifest.csv `
  --mode final --no-write

python -m unittest scripts.tests.test_validate_animation_reconciliation
```

The release gate asserts 220 unique Codex rows; contiguous `OA-001` through `OA-238`; 361 matrix rows / 58 columns; 238 ledger rows / 40 columns; 97 existing-only and 141 dedicated OA mappings; 289 mapping edges; 458 accepted requirements; and zero unmapped or unresolved requirements. It also tests schema, prefixes, contiguous source identity, source hashes, mapping existence and reverse links, cardinality, coverage, required fields, library/phase/status enums, evidence, blocker, implementation-commit, validation, disposition, and accepted-history preservation failures. Current evidence: validator passed with every controlling total and the unit suite passed 13/13.

### 24.2 SceneHost, target, and two-host isolation

Unit/component coverage must include all 14 host cases:

1. unique host registration;
2. duplicate-host rejection;
3. unique scene-instance identity;
4. host-local resolution;
5. identical target names in separate hosts;
6. stale-instance rejection;
7. detached-host cleanup;
8. nested-host behavior;
9. external target handles;
10. outside-host rejection;
11. unmount during a scene;
12. idempotent cleanup;
13. simultaneous Player and Quartermaster hosts; and
14. development-showcase isolation.

The release-blocking integration fixture mounts Host A (`map-reveal`, `route-path`) and Host B (`route-draw`, `route-path`), runs only one scene, and asserts that only its target changes, the other host remains untouched, metrics carry the correct instance, target counts stay exact, cleanup does not affect the other host, and no target, handle, host, or ownership claim leaks.

Target fixtures include the correct host target, another host with the same name, hidden source, visible current clone, stale clone, permanent section target, temporary event target, detached target, zero-box target, and transparent target. Production resolution may consume only an immutable registry snapshot or a valid registry-minted external handle; it may not re-query a broad root.

### 24.3 Ownership and write-permit gate

Test these runtime pairs:

- GSAP vs Motion;
- GSAP vs CSS animation;
- Motion vs CSS animation;
- Motion vs PageFlip;
- GSAP vs PageFlip;
- GSAP vs Rive container;
- GSAP vs Lottie container;
- Motion `layoutId` vs GSAP transform;
- dnd-kit vs Motion transform; and
- dnd-kit vs GSAP transform.

Every pair covers first grant, compatible same-runtime claim, atomic conflict rejection, rejected-write prevention, release/reclaim, terminal cleanup, normalized property-group conflict, non-overlapping properties, stale sweep, interruption, fallback, and nested wrappers. A single permit must cover **every** property the runtime configuration can write; one allowed property cannot authorize an undeclared multi-property GSAP write. Property normalization fails closed for the frozen `spatial-transform`, `presence`, `geometry`, `clipping`, `filtering`, `path-drawing`, and `scroll` groups.

External handles are identity capabilities by default. The `artifact-award` destination may participate in continuity and final-state reconciliation without granting GSAP a write claim on the Motion-owned shared-layout destination.

### 24.4 Runtime-owned Motion gating

Motion is an active ownership participant, not an untracked exception. Tests must prove that a provider-scoped runtime-surface lease:

- is minted only for a live registered target and exact property groups;
- is required before Motion layout, presence, or interaction writes begin;
- rejects foreign, stale, wrong-host, wrong-instance, or insufficient-property permits;
- revokes on interruption, unmount, host teardown, and policy transition;
- coexists only with non-overlapping child/wrapper ownership; and
- does not recreate or replay content merely because the resolved motion level changes.

No test may count a declarative marker alone as write enforcement.

### 24.5 PageFlip fourteen-case gate

Test exactly:

1. hidden source exclusion;
2. visible current-clone qualification;
3. stale-clone rejection;
4. current-page target qualification;
5. off-page exclusion where required;
6. no duplicate IDs or broken local IDREFs;
7. correct accessibility tree;
8. manual turn remains StPageFlip-owned;
9. keyboard turn remains StPageFlip-owned;
10. programmatic turn remains StPageFlip-owned;
11. fake GSAP curl scenes are not production scenes;
12. content update preserves/rebinds identity;
13. orientation change preserves/rebinds identity; and
14. unmount releases targets, handles, generations, observers, runtime instances, and claims.

The clone boundary additionally proves synchronous temporary `cloneNode(true)` interception, deterministic namespacing of IDs and every local IDREF relation, source inertness, current-primary readability, fail-closed observer backstop, generation revocation, and twenty repeated boundary cycles returning to baseline.

### 24.6 Final-state and access/login gate

Test success response, accepted visual state, delayed route, no snapback, route failure, auth failure, request abort, component unmount, reduced mode, and repeated submission. Also cover each canonical policy: `revert-immediately`, `hold-final-until-unmount`, `commit-final-state`, `reconcile-then-revert`, and `fallback-to-static-state`.

For every policy, assert the exact semantic target and identity, handoff-before-cleanup ordering, claim retention until readable handoff, bounded safe fallback after handoff failure, cleanup idempotency, and no release while neither the handoff nor safe fallback is readable. Success never returns visually to closed/locked before navigation; failure never flashes success; route failure restores stable focusable controls.

### 24.7 High-risk component and access boundaries

- **Voyage Chart:** Motion marker wrapper; nested GSAP stamp/pulse/reveal child; semantic marker identity; no index or DOM-order selection.
- **Ship's Log:** Motion row/presence wrapper; nested fresh-ink/symbol children; authoritative event identity; overlay-to-canonical-row reconciliation.
- **Artifact Inspection/Treasure Altar:** Motion shared-layout/dialog shell; nested engraving/light children; dialog-local export capability; unique heading identity; local pointer inertness; exact trigger/focus return.
- **Companion Header/Navigation:** permanent Motion owner markers remain on wrapper surfaces; deliberate aria-hidden cinematic children own dimming; controls are not cinematic targets.
- **Quartermaster:** one invocation-local command host per command overlay, explicit external handles, thirteen source-grounded dual-host callers, and no claim on ordinary controls or permanent command lights.
- **Access/login:** form/pending/error/permission state remains Motion-owned; bounded cinematic child is GSAP-owned; accepted pose holds through route completion; route/auth failure remains recoverable and readable.

Component proof must include focus trap/return, semantic roles, decorative `aria-hidden`, pointer/keyboard behavior, reduced state, interruption/unmount cleanup, two-host isolation, and exact ownership instrumentation.

### 24.8 Lifecycle, accessibility, and viewport gates

Run at least **20 cycles each** of:

1. `SceneHost` mount/unmount;
2. scene play/cleanup;
3. Artifact Inspection open/close;
4. PageFlip mount/update/unmount; and
5. a non-mutating Quartermaster command overlay.

After every group and cycle 20, host, target, handle, generation, runtime-surface, and ownership counts return to baseline; stale targets/clones and DOM references are absent; replay uses a new instance; interruptions/routes release claims; no document-wide production target query remains; and listener/timer counts do not grow monotonically.

Run accessibility and responsive validation at all six required viewports:

```text
2560x1440
1920x1080
1440x900
430x932
390x844
844x390
```

Assert no horizontal overflow, clipped control, wrapper layout drift, focus-order drift, PageFlip geometry error, stacking-context regression, unreachable dialog, duplicate accessible page, or unreadable reduced state. Motion is never the only state signal.

### 24.9 Serialized integrated gate and database isolation

Before mutation-capable browser or E2E work, the single validation owner must prove a unique copied database through the running application, record absolute path/nonce/PID/port, and prove the canonical SQLite family unchanged afterward. A worktree or alternate port alone is not database isolation.

The final order is:

```text
reconciliation validator
  -> focused host/target/ownership/Motion/PageFlip/final-state/component tests
  -> integrated format + lint + typecheck + unit/component
  -> proven database isolation
  -> serialized browser/E2E + accessibility + six viewports + 20-cycle lifecycle
  -> assets + production build/restart
  -> one npm run validate
  -> Git and documentation/conversation synchronization proof
```

The validation report records the exact command, exit code, counts, environment, artifacts, and failure classification. Until it replaces every `[PENDING_FINAL_GATE]` marker, Claim the Deck is not complete. V2 and V3 fix-needed audits must be re-run after repairs; their earlier 16/16 and 55/55 focused runs do not become passes retroactively.
