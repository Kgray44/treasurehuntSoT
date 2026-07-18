# Animation System Test Plan

Status: required completion plan for the animation-system audit of exact committed baseline `4dbe8c0ae2fbab2785d1d3f26b8d7ba33bf56aee`. This document defines future acceptance coverage; it does not claim that unrun cases already pass.

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

| Evidence                     | Baseline result                                                                                                                                | What it proves                                                                                                                                                         | What it does not prove                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Focused Vitest run           | 13 files, 44 unit/component tests passed                                                                                                       | Scene builders construct in all modes; covered director/core, journal opening, Rive/Lottie wrappers, PageFlip, and workspace interactions execute their asserted paths | Production visibility, target uniqueness, every-section behavior, replay after refresh, whole-app reduced motion             |
| `npm run assets:validate`    | Passed: 3 Lottie JSON files, 1 local development Rive binary, and local SVG fallbacks                                                          | Registered local files are parseable/present according to current contracts                                                                                            | The four production Rive objects have real `.riv` art; they do not                                                           |
| Focused animation Playwright | 3 passed; WebKit-mobile showcase test skipped                                                                                                  | Chromium showcase and Chromium/WebKit-mobile first arrival exercised the existing focused assertions                                                                   | Complete mobile showcase coverage or real production event integration                                                       |
| Showcase exercise            | All 36 entries exercised in reduced mode with no logged runtime exception                                                                      | The development harness can invoke its entries in reduced mode and clean up the measured runtimes                                                                      | Full/gentle modes, visible required targets, unique ownership, or production reachability                                    |
| Landing viewport check       | Six required viewports had no horizontal overflow; reduced content remained readable                                                           | Landing layout containment for the observed states                                                                                                                     | All routes, modes, checkpoints, or visual correctness; at 1440x900 `stars` had zero height and `arrival-copy` appeared twice |
| Journal/PageFlip observation | Ten scene-part elements and two visible `peripheral` targets were measured; clone architecture was inspected                                   | Duplicate `peripheral` targets and source/clone structural risk exist                                                                                                  | An actual progression target duplicated inside the tested PageFlip snapshot                                                  |
| Legacy login acceptance      | Wrong credentials returned HTTP 401; `.form-error` did not appear within 10 seconds                                                            | The observed failure-feedback contract failed                                                                                                                          | Whether modern and legacy login fail identically in a clean isolated fixture                                                 |
| Chapter release acceptance   | Seal, parchment, and ink stages rendered and replay was offered; elapsed time was 10,081 ms                                                    | That one Journal release reached visible stages                                                                                                                        | The `<10,000 ms` timing contract, every-section behavior, replay after refresh, interruption, or all modes/viewports         |
| Database isolation attempt   | The detached server resolved the main checkout database; the server was stopped and exact audit rows were repaired after backup and assertions | Next.js source-worktree separation alone is not database isolation                                                                                                     | Any later mutating matrix; no such run is claimed                                                                            |

Current coverage is therefore a useful baseline, not a completion gate. In particular, the 102-case Player event/section matrix, five-state motion matrix, six-viewport route matrix, ten-step replay protocol, production performance budget, and 20-cycle leak protocol are all future requirements.

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

The animation system is not complete until all of the following are true:

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

Until these gates pass, the current evidence remains an audit baseline: the framework runs, but complete visible, unique, replayable, reduced-safe production semantics are not yet proven.
