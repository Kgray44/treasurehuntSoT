# Project Lanternwake Phase 3 — Unfurl the Tale

## Design record

- Status: frozen for implementation
- Date: 2026-07-18
- Branch: `codex/project-lanternwake-phase-3-unfurl-the-tale`
- Phase 3 base and Phase 2 final handoff: `7747ce5b472fdb19b9fe8f35ea12fbe974902fe7`
- Phase 2 implementation: `d529b59e06ad1f2d736f6e1b888ebb78f169dcc0`
- Phase 2 evidence: `acf390f`
- Phase 2 chat synchronization: `7747ce5`

This record freezes Phase 3 architecture before parallel event-family implementation. It is a design contract, not an implementation or validation claim.

## 1. Truth boundary and intake

The controlling Phase 3 denominator is **189 unique accepted requirements: 90 Codex plus 99 Original Audit (OA)**. The 152 physical Phase 3 matrix rows include 62 OA carrier rows and are not additive; `152 + 99` would double-count. Intake status at the base SHA is 114 `architecture_ready`, 65 `partially_implemented`, nine `not_started`, and one `blocked`. Accepted unmapped and unresolved requirements remain zero program-wide.

All 152 Phase 3 physical rows use `MX-*`. Therefore the stable legacy-prefix measure finds zero assigned existing-animation-defect rows. Separately, eight Phase 3 MX rows have non-`Missing` current-quality evidence (`MX-051`, `MX-054`, `MX-056`, `MX-061`, `MX-063`–`MX-066`) and remain current-quality/partial-compatibility work. The schema has no explicit defect flag; both definitions are preserved.

The six-section, uppercase 17-event system named by the Phase 3 brief is the compatibility `/tale/[campaignSlug]` `PlayerExperience`. The repository's canonical durable route is `/player/playthroughs/[playthroughId]/journal`, with the legacy session route reusing `TallTaleJournalSession`. Phase 3 will not create a second Player application or claim that changing `/tale` adds the 17-event system to the canonical durable route. Shared Journal opening, PageFlip, focus, fallback, and archival behavior may improve both stacks; a future normalized event/projection bridge must be explicit.

Phase 2's full `npm run validate` exited 1 at its production-build step because its temporary worktree used a `node_modules` junction. After that junction was removed and local dependencies were installed, canonical `npm run build` and two restart proofs passed. Phase 3 preserves both facts.

## 2. Dependency intake

Phase 3 consumes, rather than forks, these Phase 1/2 interfaces and boundaries:

1. one provider-scoped `AnimationDirector`;
2. one provider-scoped `SceneHostRegistry`;
3. one provider-scoped ownership registry;
4. `SceneHost` and nearest-host registration;
5. persistent `player-progression` and local `player-section-enhancement` host kinds;
6. immutable provider/host/generation/instance/scene/playback identity;
7. v2 registered target contracts and exact once-per-invocation resolution;
8. identity-only, provider-scoped external target handles;
9. atomic runtime/property claims and permits;
10. final-state handoff, readable fallback, verification, and cleanup;
11. structured `PresentationReceipt` truth;
12. resolved full/gentle/product-reduced/browser-reduced policy;
13. PageFlip hidden-source/current-clone/stale-clone identity boundary;
14. PageFlip runtime ownership of curl geometry and transforms;
15. bounded Lottie command/failure lifecycle;
16. truthful Rive fallback state;
17. validated semantic audio cue gating;
18. Journal opening phase machine and `JOURNAL_READY` interactivity boundary;
19. durable authoritative `ProgressEvent` sequence and Player-safe projection;
20. SSE durable replay before live subscription;
21. existing per-device viewed-ceremony uniqueness;
22. canonical snapshot and saved-state undo transactions;
23. Quartermaster authentication, authorization, CSRF, audit, and command correlation;
24. host/target/ownership telemetry snapshots;
25. focusable semantic section headings and PageFlip source exclusion;
26. isolated database/runtime validation harness; and
27. path-scoped `Codex_Chats` / `Development_Docs` synchronization.

Focused dependency assertions must prove: host isolation; no parent selection through nested hosts; exact current-clone selection; stale-handle rejection; atomic claim rollback; runtime-permit revocation; immutable live/replay identity; final-state handoff before cleanup; no hidden-source focus/targets; chapter host readiness only after all targets; and persistent/event/keyed target non-cross-selection.

## 3. Frozen Phase 3 contracts

### 3.1 `ProgressionSceneHost`

The existing persistent outer `SceneHost kind="player-progression"` is the sole global authority. It remains mounted outside the keyed conditional section content and exposes stable, boxed layers: backdrop, primary ceremony, event object, readable summary, destination/skip/replay controls, polite live region, and fallback. Event-specific visual children may change; the host identity and authority may not. It owns presentation, not business state, event storage, snapshots, navigation, or arbitrary DOM queries.

### 3.2 `ProgressionPresentationController`

The controller adapts immutable Player-safe events into requests, submits them to the queue, creates a fresh Director invocation, supplies `finalStateRuntime`, records the wrapper receipt, gates acknowledgment, restores section/focus/scroll, and offers replay/destination actions. It never mutates progression state.

### 3.3 `ProgressionPresentationQueue`

The queue is a pure deterministic layer above the Director. Authoritative live/reconnect work sorts by sequence, then priority, then stable request ID. One active request executes at a time. Live/reconnect outranks replay; active replay may be interrupted except at declared semantic commit boundaries. Pending replay never delays authoritative work. The queue emits a receipt for presented, duplicate, stale, deferred, cancelled, or failed work.

### 3.4 `ProgressionPresentationRequest`

Required immutable fields are request ID, event ID, event sequence, event type, sanitized payload, source (`live | reconnect | replay`), policy version, priority, enqueue time, relevant section, mandatory flag, and playback identity. Requests contain no DOM element or mutable snapshot reference.

### 3.5 `ProgressionPresentationPriority`

Priority is an ordered numeric value derived only from the exhaustive event policy. Authoritative source precedence is separate from numeric event priority. `CHAPTER_RELEASED` remains the highest ceremony priority; state reversal, campaign status, finale/artifact, chapter solve, and ordinary section updates follow their declared policy. Tests freeze the exact ordering.

### 3.6 `ProgressionPresentationStatus`

`queued | active | presented | duplicate | stale | deferred | interrupted | skipped | fallback | failed | cancelled`. Status describes presentation truth only and never rewrites authoritative event truth.

### 3.7 `ProgressionPresentationReceipt`

The wrapper receipt contains request/event identity, source, status, queue wait, scene receipt when one exists, semantic labels, exact target report, fallback/final-state result, restoration result, acknowledgment eligibility, retry disposition, and timestamps. Duplicate IDs produce `duplicate` without scene, audio, acknowledgment, or order change. One event may have many explicit replay receipts but at most one eligible live/reconnect viewed acknowledgment per device.

### 3.8 `PlayerSectionId`

`journal | chart | treasures | quests | log | finale`. These stable IDs describe the compatibility companion only and must not be presented as canonical durable-journal drawers.

### 3.9 `PlayerSectionRestoration`

Before a global presentation, capture section ID, section scroll position, meaningful connected active element/trigger, and section heading fallback. Never change section merely to supply a cinematic target. After completion, restore the exact connected, visible, non-inert, non-hidden-source element; otherwise the explicit destination control or still-mounted section heading. Preserve scroll unless an explicit user destination action navigates.

### 3.10 `GlobalProgressionPresentation`

Every accepted event has one readable global presentation in the persistent host: one heading, authoritative safe summary, controlled live announcement, optional decoration, and relevant controls. This layer alone owns queue status, skip, replay, fallback, focus, and acknowledgment eligibility.

### 3.11 `SectionLocalEnhancement`

At most one enhancement may run when its relevant section is already mounted and its exact registered handle is ready. It starts only after explicit global-to-local handoff, is optional, never queues or acknowledges, never owns replay or fallback, and cannot block the global receipt. Unrelated/hidden sections are never mounted to obtain targets.

### 3.12 `ReplayPresentationRequest`

Replay uses the same immutable Player-safe event and policy with a fresh request/scene instance, source `replay`, lower source precedence, and permanent `acknowledgmentEligible=false`. It may not POST/PATCH/DELETE, append events, change progression, advance presence cursors, add a viewed row, or reuse stale handles. Refresh reconstruction comes from a bounded authorized Player-safe history, not unsanitized stored payloads.

### 3.13 `ProgressionEventPresentationPolicy`

One exhaustive `Record<Phase3PlayerProgressEventType, ProgressionEventPresentationPolicy>` replaces partial maps. Each entry declares: scene, priority, mandatory/optional, interruptibility boundary, relevant section, global target contract, optional local target contract, replay eligibility, acknowledgment policy, focus behavior, skip behavior, notification policy, audio labels or intentional silence, full/gentle/reduced semantics, fallback, safe payload projector, and settled-state handoff. Adding/removing an event must fail typecheck/tests until declared.

| Event                          | Scene                     | Priority class | Relevant section | Replay | Global readable outcome / optional local handoff                             |
| ------------------------------ | ------------------------- | -------------- | ---------------- | ------ | ---------------------------------------------------------------------------- |
| `CHAPTER_RELEASED`             | `chapter-release`         | ceremony       | journal          | yes    | chapter released; explicit Open/Return / Journal settle only if already open |
| `CHAPTER_SOLVED`               | `mark-solved`             | chapter        | journal          | yes    | named chapter solved / exact chapter stamp                                   |
| `ARTIFACT_AWARDED`             | `artifact-award`          | artifact       | treasures        | yes    | named artifact awarded / exact altar slot                                    |
| `ARTIFACT_SILHOUETTE_REVEALED` | `artifact-award`          | artifact       | treasures        | yes    | named silhouette discovered / exact silhouette slot                          |
| `ARTIFACT_CONNECTED`           | `artifact-connection`     | section        | treasures        | yes    | named connection / exact keyed path                                          |
| `MAP_LOCATION_REVEALED`        | `map-reveal`              | section        | chart            | yes    | named location / exact keyed marker                                          |
| `MAP_ROUTE_REVEALED`           | `route-draw`              | section        | chart            | yes    | named route / exact keyed route                                              |
| `SIDE_QUEST_DISCOVERED`        | `quest-discovery`         | section        | quests           | yes    | named quest / exact quest note                                               |
| `SIDE_QUEST_UPDATED`           | dedicated update policy   | section        | quests           | yes    | named changed objective / exact objective                                    |
| `SIDE_QUEST_COMPLETED`         | `quest-complete`          | section        | quests           | yes    | named quest/reward / exact stamp                                             |
| `JOURNAL_ANNOTATION_ADDED`     | journal annotation policy | section        | journal          | yes    | annotation summary / exact visible page ink                                  |
| `PLAYER_LOG_ENTRY_ADDED`       | `log-entry`               | section        | log              | yes    | log summary / exact event-ID row ink                                         |
| `FINALE_TEASED`                | `finale-tease`            | finale         | finale           | yes    | mechanism wake summary / mechanism settled state                             |
| `FINALE_REQUIREMENT_UPDATED`   | `finale-requirement`      | finale         | finale           | yes    | named requirement delta / exact keyed socket                                 |
| `CAMPAIGN_PAUSED`              | `pause`                   | state          | none             | yes    | readable paused state / persistent shell styling                             |
| `CAMPAIGN_RESUMED`             | `resume`                  | state          | none             | yes    | readable resumed state / persistent shell styling                            |
| `STATE_REVERTED`               | `undo`                    | reversal       | none             | yes    | safe previous/current summary / affected visible targets when known          |

### 3.14 `ProgressionAudioLabelMap`

Every event explicitly lists semantic labels or intentional silence. Audio may start only for the active request after target preflight and the matching instance-scoped Director label. Deduplicate by event ID, scene instance, and label. Semantic cues use `motionOnly=false`; motion-only decoration may use `true`. Sound/mute/failure never changes meaning, state, acknowledgment, or focus.

### 3.15 `ProgressionFallbackPolicy`

Every event declares one readable fallback: heading, safe summary, destination/replay/continue controls as applicable, equivalent reduced outcome, and verification callback. `finalStateRuntime` must reconcile settled UI, render fallback on target/runtime failure, verify readability, and perform idempotent cleanup. Missing Phase 5 art is never a reason to hide authoritative text.

### 3.16 `OpeningPresentationPolicy`

Profiles are first/full, reentry/abbreviated, completed/archive, manual-full replay, and reduced. Skip, motion change, recoverable interruption, timeout, Lottie/Rive/PageFlip failure converge on an equivalent readable final pose and `JOURNAL_READY`; route unmount only cleans up. Archive mode is quiet and creates no false live-channel expectation.

### 3.17 `JournalReadyReceipt`

The receipt records opening profile/mode/outcome, PageFlip runtime-or-static readiness, current page identity, interface/objective reachability, focus destination, announcement, fallback truth, and cleanup. The Journal is interactive only after this receipt verifies `JOURNAL_READY`; it must not depend merely on a cover animation finishing.

### 3.18 `PageTurnLifecycleEvent`

Typed events are `turn-start | turn-commit | turn-settle | turn-cancel | turn-failed`, carrying book/mount identity, source, from/to page, orientation, mode, timestamp, reason/fallback, and current-boundary generation. Audio and page-local effects bind to lifecycle semantics, not coarse `flipping` state. StPageFlip remains the only curl owner; static fallback preserves page and focus.

### 3.19 `ProgressionNotificationPolicy`

Each event declares announcement politeness, unseen-count behavior, destination action, stacking/coalescing, and dismissal. Notifications summarize authoritative content; they neither acknowledge the presentation nor replace it. The persistent progression queue is the only ordering authority.

### 3.20 `OfflineReconciliationPresentation`

On reconnect, first revalidate access and fetch authority. Compare separate observed, queued, presented, and acknowledged cursors; fetch Player-safe unseen events; sort by sequence; deduplicate IDs; summarize the gap; queue mandatory work; preserve replay; and acknowledge only valid global receipts. Revocation terminates delivery and lands on a readable access state. Snapshot sequence is business-state position, never a presentation-acknowledgment cursor.

## 4. Event persistence, delivery, and acknowledgment

The durable `ProgressEvent` remains business truth. Delivery states are distinct: committed, process-published, client-observed, queued, presented, and acknowledged. A route must not imply rollback merely because post-commit publish/projection fails. SSE replay/live handoff must close the query-to-subscribe race and clean listeners on cancel/abort. Presence must not post `snapshot.sequence` as cinematic completion.

The existing viewed route/table may be generalized only if authorization and uniqueness remain `(campaign, device, event)` and policy eligibility is server-verified. Persisted client receipt detail is diagnostic, sanitized, and never security authority. `ViewedContent` stays separate reading state.

Replay history is bounded and Player-safe. `CHAPTER_RELEASED` continues reconstructing private story/objective/riddle through authorized snapshot logic. `STATE_REVERTED` requires a safe previous/current projector; unavailable identities remain explicit rather than guessed. Real log targets use immutable progress-event ID, not the annotation/log domain key.

The Quartermaster UI must use the hardened expected-sequence/idempotency/correlation contract before Phase 3 claims command-receipt convergence. `COMMITTED`, process-published, delivered, presented, and acknowledged are distinct statuses.

## 5. Journal and asset integration

Opening semantic order is entry, camera approach, shadow ground, clasp wake, latch release, cover opening, page-stack compression, sealed-page reveal, seal pressure/fracture, fragment settle, book settle, PageFlip readiness, interface reveal, objective reveal, then `JOURNAL_READY`. Reduced mode applies the same semantic outcomes without physical travel.

The Journal Clasp, Voyage Compass, and Finale Mechanism interfaces freeze states, inputs, reduced pose, fallback, labels, mount/failure behavior now. Their actual authored `.riv` binaries remain Phase 5 `blocked_external_asset`; Phase 3 must mount truthful CSS/SVG fallback adapters and must not invent binary paths or claim a Rive runtime. Lottie one-shots are command/label driven, not mount-autoplay, and declare reduced frames and failure fallback.

## 6. Accessibility, performance, and lifecycle gates

Every event has one readable heading and controlled announcement; decorative objects are absent from the accessibility tree. Skip, Replay, destination, PageFlip, artifact, quest, log, finale, and reconnect controls remain keyboard/touch reachable at all viewports and 200% zoom where supported. No hidden source, inert, detached, or unrelated target may receive focus. Modal focus traps apply only to true modals.

Chapter release must be strictly below 10,000 ms; target preflight p95 below 50 ms; Skip/Replay/PageFlip response begins within 100 ms; interruption/unmount cleanup below 250 ms. Desktop frame p95 is at most 25 ms, mobile at most 40 ms; no app-attributable stall exceeds 100 ms; cumulative long-task budgets are 200 ms for chapter and 100 ms for ordinary transitions; CLS is at most 0.10.

Twenty-cycle lifecycle tests return hosts, claims, runtimes, listeners, timers, EventSource instances, focus traps, clones, audio work, Lottie work, and WAAPI promises to baseline.

## 7. Acceptance structure

- 102 baseline cases: 17 events × six starting sections, full mode, 1440×900.
- At least 185 distinct M1–M5 cases: all 17 events in their relevant section plus chapter release, pause, resume, and revert from every section.
- Six viewports: 2560×1440, 1920×1080, 1440×900, 430×932, 390×844, and 844×390.
- Replay uses the brief's 12-step protocol as a superset of older “ten-step” wording and proves zero network/database mutation plus fresh scene identity.
- Resilience covers every named interruption, fallback, offline/reconnect, duplicate/stale event, motion change, refresh, revocation, and server/runtime failure.
- Five Phase 2 `test.fixme` cases become release gates: PageFlip generation revocation, current-visible-primary qualification, Quartermaster focus return, complete chapter-host readiness, and persistent/event/keyed isolation.
- Mutation Playwright runs only through the unique copied-database isolation harness. WebKit remains read-only for shared-database coverage. Production performance must run against an owned production server; HTTP restart probes alone are insufficient.

Skipped, blocked, unavailable, and nonzero commands are never passes.

## 8. Ownership and critical path

One writer owns each file at a time. The coordinator exclusively owns dependency installation, manifests/lockfiles, shared database/schema/migrations, development and production servers, ports 3000/3100/3200, browser state, full builds/suites, Git integration, final validation, generated evidence, and final synchronization.

Critical path: freeze this record → implement pure policy/queue and persistent host → integrate `PlayerExperience` without forced navigation and with final-state runtime → add safe persistence/reconnect/ack paths → complete shared Journal/PageFlip semantics → add exact section handles/enhancements → integrate command/audio/fallback/accessibility → freeze ledgers/reports → focused checks → isolated browser/performance/full validation → one synchronization pass.

## 9. Blockers and reconciliation decisions

1. Thirty-two platform/shell matrix rows conflict with the explicit Phase 4 exclusion. They remain a release-blocking reconciliation item pending explicit Phase 4 reassignment; Phase 3 will not silently implement or mark them complete.
2. Cross-phase bundles are validated only for their Phase 3 portion: `MX-093/OA-175`, `MX-094/OA-178`, and `MX-097/OA-183` contain Phase 5 scope; `MX-054/OA-090` contains Phase 1 scope; `MX-091/OA-167` contains Phase 2 scope.
3. OA-173 / MX-257 needs an authoritative moon-phase data contract and fixtures. It is a non-art external blocker, not a Phase 5 art blocker.
4. OA-184 retains Phase 3 light-geometry, luminance-budget, and final-timing work.
5. Actual Journal Clasp, Voyage Compass, and Finale Mechanism binaries are Phase 5 `blocked_external_asset`; Phase 3 fallback/interface behavior remains required.
6. Final PageFlip runtime completion beyond the Phase 3 lifecycle/readiness/fallback integration remains Phase 5.

## 10. Later-phase handoff

Phase 4 reuses the existing provider/host/ownership systems, persistent notification-queue integration, Motion route-presence policy, access final-state handoff, focus restoration, resolved motion policy, semantic audio labels, and truthful fallback/Rive boundary. It must not create a second queue, host, or ownership system. Phase 4 does not start automatically.

Phase 5 receives frozen Journal Clasp, Voyage Compass, and Finale Mechanism states/inputs/transitions/reduced poses/fallbacks/mounts/labels/load failures; Lottie label semantics; and the PageFlip lifecycle/readiness contract. Cards remain for browsing Tall Tales; the Journal remains for experiencing them.

## 11. Completion rule

Phase 3 may be called complete only when every accepted requirement is implemented, validated, explicitly later-phase-reassigned, or truthfully blocked; every required artifact and governing document is reconciled; focused and integrated validation is accepted; all resources are released; remote SHA is verified; and the mandated chat/development-document synchronization has run exactly once. This record alone satisfies none of those completion gates.

## 12. Final-reconciliation record (appended 2026-07-19)

Sections 1-11 above remain the frozen pre-implementation contract and have not been rewritten. This appended section records the current reconciliation boundary; it is not a completion claim.

### 12.1 Requirement disposition

- Base intake remains **189 unique accepted requirements: 90 Codex plus 99 OA**.
- **32 platform/shell requirements are assigned to the Phase 4 handoff**, leaving **157 active Phase 3 requirements**. Final acceptance of that cross-phase assignment remains part of the closing evidence package.
- The exact 17-event/six-section baseline remains **102 global-presentation carriers**. Those carriers are coverage cases, not additional requirements.
- The Player event coverage ledger records the source requirement, event/section carrier, implementation state, evidence path, later-phase ownership, and blocker truth without changing the 189-item denominator.

### 12.2 Active blockers and cross-phase handoff

- Journal Clasp, Voyage Compass, and Finale Mechanism production `.riv` binaries remain `blocked_external_asset`. Their typed interfaces, stable reduced poses, semantic signals, and truthful local fallbacks are the Phase 3 deliverable; authored binary art remains Phase 5.
- OA-173 / MX-257 remains `blocked_environment` until an authoritative moon-phase data contract and deterministic fixtures are supplied.
- Cross-phase bundles remain split rather than marked wholesale complete: `MX-093/OA-175`, `MX-094/OA-178`, and `MX-097/OA-183` retain Phase 5 work; `MX-054/OA-090` retains Phase 1 provenance; `MX-091/OA-167` retains Phase 2 provenance.
- The 32 Phase 4 assignments must consume the existing provider, persistent host, presentation queue, resolved motion policy, focus restoration, and fallback contracts. Phase 4 must not create a second presentation authority.

### 12.3 Closing evidence still required

- Ending implementation commit: **PENDING IMPLEMENTATION SHA**.
- Integrated format, lint, typecheck, unit/component, asset, ledger, build, E2E, performance, lifecycle, and full-validation evidence: **PENDING FINAL EVIDENCE**.
- Final 102-case and multi-mode/viewport result: **PENDING FINAL EVIDENCE**.
- Remote branch parity, released ports/resources, final repository status, and the single required synchronization pass: **PENDING FINAL EVIDENCE**.
