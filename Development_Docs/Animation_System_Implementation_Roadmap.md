# Animation System Implementation Roadmap

## Roadmap status and truth boundary

This roadmap is the implementation sequence that follows the animation-system audit of baseline commit `4dbe8c0ae2fbab2785d1d3f26b8d7ba33bf56aee`. The Project Lanternwake Phase 1 section records its completed evidence, and the dated Phase 2 reconciliation records Claim the Deck implementation and composite validation at implementation commit `d529b59e06ad1f2d736f6e1b888ebb78f169dcc0`. Phases 3 through 6 remain planning only. Phase 2 repository synchronization and remote publication are still coordinator-owned finalization steps; the dated reconciliation at the end of this roadmap is authoritative for the current phase state.

Current Phase 1 state: implementation, focused verification, documentation reconciliation, and the integrated technical gate are complete. `npm run validate` exited `0` with type-check, lint, format, 46 Vitest files / 304 tests, animation-asset contracts, database checks, the legacy backfill, production build, production restart proof, and isolated browser validation all passing; Playwright reported 27 passed and 17 skipped. The validation report also proved that the copied validation database was distinct from and did not change the canonical database. At this documented pre-finalization checkpoint, only the coordinator-owned chat/development-document dry-run, live synchronization, synchronization validation, and final Git/remote classification remained; their later result belongs to the synchronizer report and final task handoff. No production Rive binary, persistent/global Player ceremony host, Prisma schema change, or Phase 2+ visual expansion was added.

The sequence is based on verified baseline findings:

- all 28 registered GSAP scenes can currently build and complete without a declared required-visible-target contract;
- `PlayerExperience` can refresh state and acknowledge an event after presentation errors, including the case where no required visible target moved;
- the core `chapter-release` presentation is mounted with Journal content, is therefore section-dependent, and its replay payload exists only in component state;
- the physical journal phase wait has no bounded timeout or abort race around `animation.finished`;
- production Rive contracts for the Invitation Seal, Journal Clasp, Voyage Compass, and Finale Mechanism have no production `.riv` paths; mounted Invitation Seal and Finale Mechanism show static fallbacks, while Journal Clasp and Voyage Compass are unmounted contracts;
- broad Player-root selectors, repeated `data-scene-part` values, StPageFlip source/cloned DOM, and warning-only ownership claims permit invisible or competing animation targets;
- the custom motion policy, `MotionConfig`, and CSS media queries do not share one authoritative reduced-motion decision;
- full-to-gentle mode changes do not update an existing StPageFlip instance, and Lottie runtimes are recreated on mode changes;
- all 36 development-showcase entries were exercised in reduced mode without a logged runtime exception, but that is harness evidence rather than production visibility or reachability evidence; and
- a baseline chapter-release run visibly reached seal, parchment, ink, and replay states but completed in 10,081 ms, outside the existing `<10,000 ms` acceptance contract.

The baseline runtime later proved that an isolated-source Next.js process could still infer and mutate the main checkout database. Those exact audit-created rows were repaired and the process was stopped. Future mutation tests must prove the resolved database path before the first request; an alternate working directory or port is not database isolation.

The current `main` checkout also contains concurrent uncommitted product work. Every future implementation phase must repeat repository preflight, preserve that work, and establish current file ownership before editing any likely-affected path. This roadmap does not authorize overwriting those changes.

## Ordering principles

1. Presentation truth precedes visual richness. A timeline is successful only when its declared required presentation is visible or an explicit accessible fallback has completed.
2. Server truth and presentation truth are separate. Business mutations remain authoritative on the server; presentation acknowledgment follows the phase-specific policy and never fabricates business success.
3. Replay is presentation-only. It uses persisted, player-safe event data, never repeats a command, never advances progression, and never creates another viewed/event record.
4. Each runtime keeps its intended responsibility: GSAP for narrative sequencing; Motion for React presence and layout; StPageFlip for physical page curl; Rive for stateful vector objects; Lottie for contained effects; CSS for material and restrained ambient behavior; Web Animations API for observing CSS phases; Web Audio for semantic cues; and dnd-kit for authoring drag-and-drop.
5. One node has one property owner. Cross-library compositions use nested wrappers and an explicit handoff instead of same-node transform or opacity writes.
6. Full, gentle, product-reduced, and browser-reduced modes must resolve through one policy and reach the same readable semantic state.
7. Production screens, not `/dev/animations`, are the acceptance surface.

## Dependency graph and release gates

```text
Phase 1: truth, acknowledgment, bounded lifecycle, persisted replay
  -> Phase 2: enforced ownership and instance-scoped scene hosts
       -> Phase 3: Player ceremonies and every-event/every-section integration
       -> Phase 4: modern platform, libraries, invitation, and Studio motion
            -> Phase 5: authored Rive assets and wrapper/PageFlip completion
                 -> Phase 6: integrated performance, accessibility, and polish
```

Phase 3 and Phase 4 may run in parallel only after the Phase 2 scene-host, ownership, and motion-policy interfaces are stable and their write paths are disjoint. Phase 5 asset authoring can start earlier as an isolated design/export lane, but production registration waits for the Phase 2 ownership contract and the Phase 3/4 semantic inputs. Each phase has a focused acceptance gate; the integrated `npm run validate` gate runs once on the completed phase state under one validation owner.

## Phase 1 - Animation truth and broken-trigger repair

Project Lanternwake implements this phase's truth, acknowledgment, replay, lifecycle, motion-policy, reachability, and validation-isolation foundations in the current working tree. Its technical implementation and centralized integrated validation are complete. At this documented checkpoint the coordinator-owned repository finalization gate had not yet run; its result is reported separately by the synchronizer and final task handoff. Phase 2 has not started.

### Exact scope

1. Define a typed scene-target contract for every registered scene:
   - required versus optional parts;
   - local scene-host and instance identifier;
   - minimum visible and unique counts;
   - visibility criteria based on connection, rendered box, display, visibility, and effective opacity;
   - properties and runtime expected to own each target; and
   - explicit reduced/fallback presentation requirements.
2. Add a director preflight and typed presentation outcome. `AnimationDirector.play()` must distinguish at least `presented`, `presented-fallback`, `skipped-by-policy`, `aborted`, `missing-required-target`, `interrupted`, and `runtime-failed`. A built or completed GSAP timeline is not automatically `presented`.
3. Make progression acknowledgment policy explicit in `PlayerExperience`:
   - mandatory ceremonies are not marked viewed when required presentation fails;
   - a named, readable accessible fallback may satisfy the policy when the full scene cannot run;
   - failed mandatory events remain recoverable instead of being silently cleared;
   - snapshot refresh is not treated as proof of presentation; and
   - presentation exceptions are logged with event ID, scene, host, mode, and target-integrity outcome without leaking private payload data.
4. Add a player-safe persisted replay source for the most recent chapter-release presentation. Prefer the existing sanitized progress event/snapshot data and `ViewedCeremony` model; add schema only if the existing records cannot meet the contract after proof. Replay must reconstruct after refresh and must not call a command endpoint or create progression state.
5. Repair `waitForJournalPhase()` lifecycle behavior:
   - race each finite wait with abort and a bounded timeout;
   - ignore or separately classify infinite ambient animations;
   - validate the expected opening actor and finite animation set;
   - give missing actors/animations an explicit fallback outcome instead of an unreported pass; and
   - settle on skip, unmount, route change, and mode change in a deterministic final semantic state.
6. Establish a single reduced-motion decision surface for the director, Motion, CSS state, PageFlip fallback, Rive pose, Lottie frame/segment, and sound policy. This phase establishes correctness and propagation; Phase 6 performs final experience tuning.
7. Classify the eight development-only/dead/redundant scene contracts before leaving the phase: `journal-open`, `manual-page-flip`, `programmatic-page-flip`, `chapter-heading`, `prose-ink`, `marker-stamp`, `ship-course`, and `artifact-inspection`. A scene must be connected to a real semantic trigger, retained as an explicit future contract, or deprecated with callers/tests updated. `seal-break` remains a real legacy Quartermaster production call and is not grouped with unreachable scenes.

### Project Lanternwake implementation status

| Workstream                                            | Status                                                                | Current evidence                                                                                                                                                                                                                                                                                                                                    | Preserved boundary or remaining gate                                                                                                                                               |
| ----------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen scene contracts and typed receipts             | Implemented; integrated verified                                      | `animation-types.ts`, `scene-registry.ts`, and registry tests cover all 28 names, 41 required targets, 82 optional targets, host/instance metadata, acknowledgment/playback/final-state policy, and typed presentation receipts.                                                                                                                    | Phase 2 remains planning only.                                                                                                                                                     |
| Target preflight and property ownership               | Implemented; integrated verified                                      | `target-preflight.ts`, `ownership.ts`, and their tests reject missing, detached, zero-box, hidden, transparent, off-host, out-of-cardinality, hidden PageFlip-source, stale-instance, and ownership-conflicting required targets before playback.                                                                                                   | Phase 2 still owns broad migration to dedicated instance-scoped `SceneHost` wrappers.                                                                                              |
| Director settlement and accessible fallback truth     | Implemented; integrated verified                                      | `AnimationDirector.ts` returns typed outcomes, only accepts fallback success after an explicit readable semantic-final-state result, preserves operation results, bounds timeout/abort/interruption, and cleans resources exactly once.                                                                                                             | A built or settled timeline remains insufficient proof of presentation.                                                                                                            |
| Mandatory `CHAPTER_RELEASED` acknowledgment and retry | Implemented; integrated verified                                      | `presentation-policy.ts` and `PlayerExperience.tsx` gate acknowledgment on receipt truth, keep failures retryable, prevent replay acknowledgment, deduplicate success, and treat snapshot refresh independently.                                                                                                                                    | Phase 3 still owns migration to a persistent/global ceremony host; the Phase 1 compatible host remains current-surface scoped.                                                     |
| Persisted mutation-free replay                        | Implemented; integrated verified                                      | `replay.ts`, `snapshot.ts`, Player replay handling, and focused tests reconstruct the latest authorized release from immutable event identity plus readable chapter data, survive refresh, restore the prior section/focus, and avoid command or viewed mutation.                                                                                   | No Prisma schema or migration was needed. Raw `ProgressEvent.payload` and `CampaignSnapshot.state` remain private.                                                                 |
| Bounded Journal WAAPI lifecycle                       | Implemented; integrated verified                                      | `opening-machine.ts` and Journal consumers distinguish completion, missing actor, no finite animation, runtime failure, timeout, abort, and static fallback; infinite ambient work is ignored and abort settles under the 100 ms unit contract.                                                                                                     | This is lifecycle truth, not Phase 3 cinematic expansion.                                                                                                                          |
| One resolved Phase 1 motion authority                 | Implemented; integrated verified                                      | `AnimationProvider.tsx`, `quality.ts`, Motion policy context, director context, Journal, PageFlip, Rive/Lottie wrappers, audio policy, and `html[data-motion-level]` propagation share one resolved full/gentle/reduced decision.                                                                                                                   | Phase 6 retains final experience tuning and broader legacy/concurrent product-style cleanup outside the Phase 1-owned surfaces.                                                    |
| Runtime adapters and direct callers                   | Implemented; integrated verified                                      | Audio uses receipt-validated semantic cues; PageFlip updates full/gentle/reduced behavior without losing page/focus; Lottie and Rive wrappers expose truthful stable/fallback behavior; Access Gate, Quartermaster, Harbor, Player, and development controls use host-scoped receipt semantics.                                                     | Production Rive authoring/registration remains Phase 5; the current Rive contract intentionally retains static fallback truth.                                                     |
| Reachability disposition                              | Implemented; integrated verified                                      | Registry tests freeze 16 production, 4 legacy, 5 `future-contract`, and 3 deprecated scenes. `journal-open` and both GSAP page-flip contracts are deprecated; `chapter-heading`, `prose-ink`, `marker-stamp`, `ship-course`, and `artifact-inspection` remain future contracts.                                                                     | Future-contract scenes are not production-complete and gain no new trigger in Phase 1.                                                                                             |
| Telemetry privacy                                     | Implemented; integrated verified                                      | `presentation-telemetry.ts` provides a bounded recorder; the director records each returned receipt using scene/event/host/instance identifiers, outcome codes, timing, labels, and target counts while excluding DOM objects, text content, and private payloads.                                                                                  | Privacy-safe structured telemetry remains the Phase 1 boundary.                                                                                                                    |
| Validation isolation and acceptance gate              | Complete; integrated verified                                         | `npm run validate` exited `0`: 46 Vitest files / 304 tests passed, Playwright reported 27 passed / 17 skipped, animation assets validated, database checks and the legacy backfill passed, the production build and restart proof passed, and the isolated validation database was proven distinct from and non-mutating to the canonical database. | Full technical validation is complete; retain the isolated-runtime evidence for final reporting.                                                                                   |
| Governing-document and repository finalization        | Technical documentation reconciled at the pre-finalization checkpoint | The design record and maintained animation documents are reconciled against implemented truth with one writer per file.                                                                                                                                                                                                                             | Chat/development-document dry-run, live sync, validation, scoped commit/push evidence, and final working-tree classification remain coordinator-owned and are reported separately. |

The integrated technical evidence is sufficient to mark every Phase 1 implementation row above complete and verified. Phase 1 still awaits the coordinator-owned repository synchronization and final Git/remote classification before the task can be reported fully finalized.

### Dependencies

- The audit matrix and full audit provide the 28-scene inventory, target names, call sites, reachability, and severity.
- The presentation-outcome type and acknowledgment policy must be agreed before changing `PlayerExperience` or its API tests.
- The replay source must use the existing player authorization and event sanitization boundary in `src/domain/visibility.ts`; raw private event payloads must not be exposed.
- The phase-wait contract must be stable before Phase 3 changes the physical opening or ceremony handoff.
- A mutation-test database path must be explicitly resolved, recorded, and compared with the canonical database path before any integration/E2E mutation test starts.

### Files likely affected

- `src/animation/core/animation-types.ts`
- `src/animation/core/visibility.ts`
- `src/animation/director/AnimationDirector.ts`
- `src/animation/director/AnimationDirector.test.ts`
- `src/animation/director/AnimationProvider.tsx`
- `src/animation/director/scene-registry.ts`
- `src/animation/scenes/scene-utils.ts`
- `src/animation/scenes/arrival.scene.ts`
- `src/animation/scenes/access.scene.ts`
- `src/animation/scenes/story.scene.ts`
- `src/animation/scenes/command.scene.ts`
- `src/animation/journal/opening-machine.ts`
- `src/animation/journal/opening-machine.test.ts`
- `src/components/player/PlayerExperience.tsx`
- `src/app/api/player/[campaignSlug]/events/route.ts`
- `src/app/api/player/[campaignSlug]/snapshot/route.ts`
- `src/app/api/player/[campaignSlug]/viewed/route.ts`
- `src/domain/story.ts`
- `src/domain/visibility.ts`
- `src/lib/snapshot.ts`
- `prisma/schema.prisma` and an ordered migration only if an evidence-backed replay design requires them
- focused Vitest files and `tests/e2e/animations.spec.ts` / `tests/e2e/acceptance.spec.ts`

### Libraries involved

GSAP, Motion, CSS, Web Animations API, Web Audio policy, React state, Prisma-backed progress/view records, and the existing animation director utilities. No library consolidation is in scope.

### Acceptance criteria

- Each of the 28 registered scenes has an explicit required/optional target contract and reachability disposition.
- A scene that finds zero required visible targets cannot return `presented`; duplicate required targets outside the declared cardinality also fail preflight.
- A mandatory `CHAPTER_RELEASED` presentation is not marked viewed after `missing-required-target`, `runtime-failed`, or an unhandled interruption. An explicit readable fallback may return `presented-fallback` and then acknowledge according to policy.
- Replay is available after refresh from sanitized persisted data, works without forcing the Player into Journal, and produces no command, event, snapshot, audit, or additional viewed mutation.
- A journal phase with an infinite animation, missing actor, unresolved `finished` promise, abort, or unmount reaches a bounded documented outcome; abort/skip cleanup completes within 100 ms in the unit harness.
- Browser reduced motion and product reduced mode both resolve to the same no-travel semantic ordering; `MotionConfig` cannot independently re-enable spatial movement.
- Development-only and redundant scene status is explicit in registry/tests; none is presented as production-complete solely because the showcase can run it.
- Target-integrity and acknowledgment telemetry is bounded and contains identifiers, outcomes, timings, labels, and counts, not DOM objects, rendered text, or private payload content.

### Tests

- Unit: visibility/cardinality checks for detached, zero-box, hidden, transparent, duplicate, and correctly visible targets.
- Unit: director outcomes for success, fallback, missing required targets, duplicate targets, abort, interruption, skip, reverse, and cleanup.
- Unit: opening-phase missing actor, no finite animation, infinite animation, never-settling `finished`, timeout, abort, unmount, mode change, and reduced final state.
- Component: `PlayerExperience` acknowledgment matrix for every director outcome; the mandatory-event failure remains retryable and the fallback path is readable.
- API/unit: persisted replay returns only sanitized player-visible fields and survives refresh without mutating progression.
- E2E: missing required chapter target remains unviewed and retryable; an approved readable fallback views exactly once; persisted replay works immediately, after refresh, a second time after refresh, and after a resolved motion-mode change; the complete non-read API log and persisted identity prove replay performs no command, event, snapshot, audit, presence/access, or additional viewed mutation.
- E2E: an active Journal opening releases observable listeners, event sources, and requests within the browser unmount budget; mode change and skip settle to a readable final pose; browser reduced motion reaches deterministic `JOURNAL_READY`; repeated same-document Journal opening replays do not accumulate observable resources.
- E2E: Player invitation and Quartermaster access transitions hold their committed animation pose until the destination surface is visible, preventing route snapback.
- Run focused tests in independent shards where they do not share the database. One owner runs mutation-dependent Playwright checks after proving database isolation. One owner runs the final `npm run validate` gate.

### Risks

- Conflating event receipt, business success, visual presentation, and viewed acknowledgment could create duplicate replays or stall event polling.
- A strict target contract introduced before scene hosts exist may initially expose many failures. Use explicit fallback outcomes; do not weaken required targets to make tests green.
- Persisting duplicate replay data could leak private payload fields or create a new source of truth. Prefer existing sanitized events and snapshots.
- Director type changes affect every scene and consumer and therefore require an ordered migration, not parallel incompatible edits.
- Timeout values that are too short can turn slow but valid accessibility modes into failures; values must derive from scene budgets and remain abortable.

### Work that can happen in parallel

- After the presentation-outcome interface is frozen: target visibility/cardinality implementation, journal WAAPI lifecycle repair, and player-safe replay endpoint analysis may proceed in separate path-owned lanes.
- Unit tests for target integrity and opening-machine lifecycle may be written alongside their respective implementations.
- A read-only security review of replay payload sanitization may proceed independently.

### Work that must not happen in parallel

- One owner must edit `animation-types.ts`, `AnimationDirector.ts`, `scene-registry.ts`, and shared scene-builder interfaces in dependency order.
- One owner must edit `PlayerExperience.tsx` while acknowledgment and replay integration are applied.
- Prisma schema/migration generation and application are serialized under one schema/database owner; do not create a migration unless the existing model is proven insufficient.
- Database-mutating E2E, the browser session, ports `3000`/`3100`/`3200`, and the final full validation are exclusive resources.

## Phase 2 - Ownership and scene-scoping architecture

### Exact scope

1. Introduce a dedicated `SceneHost`/scene-instance boundary that provides a local root, unique instance ID, declared target contract, and cleanup lifetime. Director queries must resolve inside that host, not the entire Player or Quartermaster root.
2. Turn runtime ownership from warning-only metadata into enforcement. A rejected claim must prevent the incompatible writer from receiving the node. Motion participates in the same ownership model through explicit wrappers, not only `data-*` attributes.
3. Separate properties by wrapper for confirmed collision risks:
   - Voyage Chart Motion marker layout/press versus GSAP event visual;
   - Ship's Log Motion list layout versus GSAP ink/reveal child;
   - Artifact Inspection Motion `layoutId` versus GSAP engraving detail;
   - companion header/navigation presence versus GSAP peripheral dimming; and
   - Quartermaster controls/dialogs versus its cinematic command overlay.
4. Replace generic cross-tree selection with scene-local semantic references. Duplicate part names may exist in different hosts, but one scene instance cannot silently select the permanent section, temporary overlay, hidden source tree, and visible clone together.
5. Define the StPageFlip source/clone boundary: hidden React source is not a cinematic target; clone attributes are sanitized or namespaced; visible PageFlip content exposes only deliberate targets and lifecycle labels.
6. Retire the GSAP `manual-page-flip` and `programmatic-page-flip` curl simulations in favor of StPageFlip lifecycle. Preserve GSAP only for narrative work before/after the physical turn.
7. Add explicit final-state and ownership handoff policy for route-changing access/login sequences so GSAP cleanup cannot visibly snap a seal, lock, or door closed before navigation.

### Dependencies

- Phase 1 target contracts and typed presentation outcomes are complete.
- The single reduced-motion decision surface is available to all wrappers.
- The Player global ceremony design in Phase 3 and modern platform designs in Phase 4 consume this host API; they must not invent parallel host abstractions.
- Current uncommitted work in Player/platform components must be reconciled before assigning writers.

### Files likely affected

- `src/animation/core/ownership.ts` and `src/animation/core/ownership.test.ts`
- `src/animation/core/animation-types.ts`
- `src/animation/director/AnimationDirector.ts`
- `src/animation/director/AnimationProvider.tsx`
- `src/animation/scenes/scene-utils.ts`
- `src/animation/scenes/story.scene.ts`
- `src/components/player/PlayerExperience.tsx`
- `src/components/player/workspace/VoyageChart.tsx`
- `src/components/player/workspace/ShipsLog.tsx`
- `src/components/player/workspace/ArtifactInspection.tsx`
- `src/components/player/workspace/CompanionHeader.tsx`
- `src/components/player/workspace/CompanionNavigation.tsx`
- `src/components/animation/PageFlipBook.tsx`
- `src/components/gm/Quartermaster.tsx`
- `src/components/player/AccessGate.tsx`
- focused component and ownership tests

### Libraries involved

GSAP, Motion, StPageFlip, React refs/context, CSS wrapper styling, Rive/Lottie container contracts, and the ownership/visibility utilities.

### Acceptance criteria

- Director target resolution cannot escape the active scene host.
- Every active scene instance has a unique ID and reports required, optional, visible, duplicate, rejected-owner, and actual-property counts.
- Rejected ownership stops the conflicting property writer; it is not warning-only.
- Confirmed Motion/GSAP conflict surfaces use separate DOM nodes and declare which runtime owns transform, opacity, layout, and clip-path.
- A PageFlip target-integrity test proves hidden source nodes are excluded and no unintended duplicate is selected from a visible clone.
- Two visible `peripheral` targets are no longer ambiguously dimmed by one undeclared selector; the ceremony explicitly names its intended wrapper(s).
- Manual, keyboard, and programmatic page curl remain owned by StPageFlip; retired GSAP curl scenes have no registry/call-site ambiguity.
- Route-changing access/login sequences hold their committed final pose until navigation or render a stable failure state.

### Tests

- Unit: claim/release/reject behavior across GSAP, Motion wrapper, CSS transition, Rive container, Lottie container, and PageFlip content.
- Component: same-node conflict regressions for Voyage Chart, Ship's Log, Artifact Inspection, companion navigation/header, and Quartermaster.
- Component: hidden-source/visible-clone target filtering across PageFlip initialization and content update.
- Director integration: two simultaneous host instances with identical part names cannot cross-select.
- E2E visual checkpoint: access/login success and failure show no cleanup snapback before route or error state.

### Risks

- Adding wrappers can change layout, focus order, stacking context, or StPageFlip geometry.
- Ownership enforcement may reveal undeclared existing dependencies that warning-only behavior concealed.
- Removing cloned attributes without a replacement host could break a legitimate page-local effect.
- Central scene utility and registry edits are conflict-prone and can invalidate all scene tests at once.

### Work that can happen in parallel

- After the host/ownership API is frozen, disjoint component wrapper migrations can run as separate lanes: Chart/Log, Treasure/Inspection, companion chrome, and Quartermaster/access.
- PageFlip clone-contract tests can proceed in an isolated component lane.
- A read-only DOM/property ownership inventory can verify migrated nodes while writers work elsewhere.

### Work that must not happen in parallel

- One integration owner controls the host API, ownership registry, scene utilities, and scene registry.
- No two writers may change `PlayerExperience.tsx`, `PageFlipBook.tsx`, or `Quartermaster.tsx` concurrently.
- Global styles or providers have one writer because wrapper changes can create cross-surface regressions.
- Browser/E2E and database resources remain centrally owned; component lanes run focused non-runtime tests only.

## Phase 3 - Player cinematic integration

### Exact scope

1. Mount a persistent Player ceremony/event host outside conditional section content so mandatory presentations remain visible from Journal, Voyage Chart, Treasure Altar, Side-Quest Ledger, Ship's Log, and Finale Chamber.
2. Rebuild `chapter-release` on that host with required seal, parchment, heading/ink, route/quill, completion, and readable fallback states. Keep the current section in place; after an off-Journal ceremony, offer an explicit Return to Journal action rather than forced navigation.
3. Make replay reconstruct from Phase 1 persisted data, restore the prior section, and remain presentation-only after immediate replay, repeated replay, navigation, refresh, motion-mode changes, skip, and interruption.
4. Apply the scene-host contract to all live Player event types: chapter release/solved, artifact award/silhouette/connection, map location/route, side-quest discovered/updated/completed, annotation, log entry, finale tease/requirement, campaign pause/resume, and undo.
5. Give every event a global readable presentation plus an optional section-local enhancement. Absence of the matching section cannot make the event invisible or block acknowledgment indefinitely.
6. Connect or retire the semantic gaps identified by the audit (`marker-stamp`, `ship-course`, `prose-ink`, and inspection detail) without duplicating the broader event scene or the correct Motion/StPageFlip owner.
7. Complete the physical opening handoff from CSS/WAAPI cover phases to StPageFlip and the interface reveal. First-tab, session reentry, full replay, abbreviated replay, skip, and interrupted opening must end at the same `JOURNAL_READY` semantic state.
8. Move progression audio to named director labels after visible-target preflight. Sound cannot announce an invisible ceremony and is never required for comprehension.

### Dependencies

- Phases 1 and 2 are complete, including target outcomes, persisted replay, scene hosts, ownership enforcement, and bounded opening waits.
- The public event/snapshot contract and every-event/every-section expected outcomes are frozen before choreography lanes start.
- Rive remains on documented static fallbacks until Phase 5; Phase 3 scenes must work with either fallback or future state-machine object.

### Files likely affected

- `src/components/player/PlayerExperience.tsx`
- `src/components/player/workspace/JournalWorkspace.tsx`
- `src/components/player/workspace/VoyageChart.tsx`
- `src/components/player/workspace/TreasureAltar.tsx`
- `src/components/player/workspace/ArtifactInspection.tsx`
- `src/components/player/workspace/SideQuestLedger.tsx`
- `src/components/player/workspace/ShipsLog.tsx`
- `src/components/player/workspace/FinaleChamber.tsx`
- `src/components/player/workspace/CompanionHeader.tsx`
- `src/components/player/workspace/CompanionNavigation.tsx`
- `src/components/animation/PageFlipBook.tsx`
- `src/animation/scenes/story.scene.ts`
- `src/animation/scenes/command.scene.ts`
- `src/animation/journal/opening-machine.ts`
- `src/animation/core/audio-cues.ts`
- `src/styles/player.css`
- player API routes needed for replay/event state
- focused tests and `tests/e2e/animations.spec.ts` / `tests/e2e/acceptance.spec.ts`

### Libraries involved

GSAP for narrative scenes, Motion for host/section presence and shared-layout UI, StPageFlip for curl and page state, CSS/WAAPI for physical material phases, Lottie for contained ink/fog effects under semantic control, Rive fallback/state interface, and Web Audio for labeled cues.

### Acceptance criteria

- `chapter-release` is visibly and readably presented from all six Player sections in full, gentle, product-reduced, and browser-reduced modes.
- The full ceremony completes within the encoded acceptance budget (currently `<10,000 ms`), while reduced mode preserves ordered meaning without unnecessary travel.
- Required targets are unique to the active scene instance; no hidden source, unmounted section, unrelated overlay, or PageFlip clone satisfies the presentation contract.
- Replay passes all ten audit replay steps and creates no server mutation; it remains available after refresh.
- Every live event type has a documented and automated every-section outcome: global presentation, optional section enhancement, fallback, acknowledgment policy, and replay/one-shot policy.
- Live events arriving during opening, page turn, another scene, visibility loss, or route unmount follow declared queue/interruption priority and clean up to baseline runtime counts.
- Opening/reentry/replay/skip converge on the same semantic state, focus target, current page, and section.
- Audio fires only from reached semantic labels and respects mute/silent/reduced policy.

### Tests

- Unit: event-to-scene/presentation-policy table covers every `ProgressEventType`.
- Component: global host remains mounted while all six section components enter/leave; optional local enhancement is correctly scoped.
- E2E: 17 event groups by six Player sections, with target counts, visible boxes, scene instance, outcome, acknowledgment, and final state asserted.
- E2E: the ten-step replay sequence, plus live-event collision and refresh reconstruction.
- E2E: first visit, return visit, skip, back/forward, opening interruption, PageFlip handoff, keyboard turn, orientation change, and fallback.
- Visual checkpoints at 2560x1440, 1920x1080, 1440x900, 430x932, 390x844, and 844x390.
- Runtime counts before/after repeated replay and navigation for GSAP, Rive, Lottie, PageFlip, listeners, and timers.

### Risks

- A global host can obscure section controls or steal focus if stacking and focus policy are not explicit.
- Global plus local enhancements can double-present the same event unless one instance owns acknowledgment.
- Queued SSE events can become stale while a long ceremony runs; snapshot reconciliation must not erase unpresented mandatory events.
- Audio and Lottie may begin before target preflight unless label ownership is enforced.
- Player CSS and `PlayerExperience.tsx` are broad, conflict-prone files that may overlap concurrent work.

### Work that can happen in parallel

- After the global host/event contract is frozen, disjoint event families can be implemented in parallel: map/route, artifact/connection, quest, log, finale, and campaign-state scenes.
- Opening/PageFlip handoff can run as a separate path-owned lane from progression event choreography.
- Audio-label mapping and read-only accessibility review can proceed alongside scene implementation.
- Phase 4 can run concurrently if it does not edit Player/global host files or shared providers/styles.

### Work that must not happen in parallel

- One owner controls `PlayerExperience.tsx`, the global host, event queue, acknowledgment, and replay integration.
- One owner controls `story.scene.ts`/`command.scene.ts` integration and resolves scene label conflicts.
- `PageFlipBook.tsx`, player global CSS, and shared audio registry each have one writer.
- Every-event E2E, browser automation, SSE mutation, database state, and full validation are serialized under one authoritative runtime/database owner.

## Phase 4 - Platform, Library and Invitation motion

### Exact scope

1. Bring modern Player, Captain, and Creator sign-in into the shared motion/truth model without copying legacy markup. Pending, permission mismatch, authentication failure, and successful route handoff each receive truthful semantic states; success choreography begins only after server success.
2. Implement the Invitation Ceremony state flow for resolution/loading, invalid, expired, revoked, PIN, account-required, accept, decline, replacement, and transition to waiting room. Use Motion for form/presence, GSAP for a bounded accepted ceremony, and the Phase 5 Invitation Seal interface with a static fallback until the asset exists.
3. Add Motion-owned loading, grouping, gallery/list, filter/sort, pin/hide, state-change, empty, and card-to-voyage transitions in Player Library.
4. Add Motion-owned tab/group, readiness, invitation/QR, polling, published Tale, and New Voyage wizard transitions in Captain Library. Pending and success states must follow authoritative server responses.
5. Complete waiting-room closed-journal, readiness, connection, scheduled start, Captain launch, revoked, reconnect, and automatic journal handoff. Launch uses a bounded cinematic only after authoritative launch state.
6. Add restrained route/shell/theme transitions and notification/unseen-content state changes with focus and live-region continuity.
7. Complete Studio authoring motion for editor presence, inspector, block insert/delete/reorder, validation, autosave, preview, publish/version, asset upload, immutable versions, and comparison. dnd-kit remains the only drag/sort owner; Motion handles surrounding presence/layout.

### Dependencies

- Phase 1 truth/outcome and motion-policy contracts are complete.
- Phase 2 ownership wrappers and scene-host API are stable.
- Authentication, invitation, and library server behavior remains unchanged; animation consumes authoritative responses rather than simulating success.
- Phase 5 Rive assets are optional at first because every platform flow must pass with static fallbacks.

### Files likely affected

- `src/components/platform/PlayerSignIn.tsx`
- `src/components/platform/StaffSignIn.tsx`
- `src/components/platform/InvitationCeremony.tsx`
- `src/components/platform/PlayerLibrary.tsx`
- `src/components/platform/CaptainLibrary.tsx`
- `src/components/platform/PlayerVoyageRoom.tsx`
- `src/components/landing/HarborLanding.tsx` and role-card/shell components where applicable
- `src/components/studio/StudioHome.tsx`
- `src/components/studio/TaleEditor.tsx`
- `src/components/studio/TaleEditorSection.tsx`
- `src/components/studio/NewTaleForm.tsx`
- platform/invitation/auth API consumers without changing their domain behavior
- `src/styles/platform.css`, `src/styles/landing.css`, `src/styles/studio.css`, and one centrally owned shell/global style surface
- `tests/e2e/access-gates.spec.ts`, `tests/e2e/tall-tale-platform.spec.ts`, and `tests/e2e/tall-tale-studio.spec.ts`

### Libraries involved

Motion, bounded GSAP ceremonies, Rive interface/fallback, Lottie ambient effects where contained, CSS materials and restrained pending indicators, Web Audio semantic cues, and dnd-kit for Studio drag/sort.

### Acceptance criteria

- Modern sign-in flows no longer jump directly from submit to route without a truthful pending/failure/success state; legacy scenes are not falsely counted as modern integration.
- Invitation acceptance animates only after authoritative acceptance. Invalid, expired, revoked, account-required, declined, and replaced states are distinct, readable, keyboard-safe, and replay only presentation where permitted.
- Player and Captain library layout transitions preserve card identity, focus, scroll context, and current selection across grouping, filtering, polling, and mutation responses.
- New Voyage wizard preserves entered data on validation failure, prevents duplicate pending submissions, and shows a persistent created invitation/QR result.
- Waiting-room launch is visible and deterministic under polling/reconnect; revocation cannot be mistaken for temporary disconnection.
- Studio drag/sort has no competing transform writer; save/publish/upload states remain authoritative and accessible.
- All modern surfaces have full/gentle/reduced outcomes, failure fallbacks, mobile behavior, and no horizontal overflow at the six required viewports.

### Tests

- Component: each modern sign-in and Invitation Ceremony state branch, including slow/failure/retry and reduced mode.
- Component: library list/gallery identity, filter/sort, pin/hide, polling update, focus retention, and empty states.
- Component: wizard step/back/validation/pending/result and Studio insert/delete/reorder/autosave/publish transitions.
- E2E: access failure/success and permission mismatch with visual final-state checkpoints.
- E2E: invitation valid/invalid/expired/revoked/PIN/accept/decline/replacement/account-required flows.
- E2E: Player/Captain library workflows, waiting-room polling/reconnect/launch, and Studio authoring, using one isolated database owner for mutations.
- Accessibility: keyboard, focus, live regions, reduced motion, and no hover-only information.

### Risks

- Motion wrappers can alter form submission, focus, validation announcements, or route timing.
- Polling and layout animation can repeatedly reanimate unchanged rows unless state versions are compared.
- Invitation and authentication copy may expose sensitive codes or errors if animation logs capture payloads.
- Concurrent work already touches several platform and style files; implementation must reconcile rather than overwrite it.
- Studio drag transforms will conflict if Motion is applied to the dnd-kit-owned node instead of a wrapper.

### Work that can happen in parallel

- With disjoint file ownership: Player sign-in, Staff sign-in, Invitation Ceremony, Player Library, Captain Library/New Voyage, waiting room, and Studio can be separate implementation lanes.
- Read-only accessibility and performance reviews may run across completed lanes.
- Phase 3 can run concurrently when shared providers, root shell, and global styles are owned by one integration lane and not edited by both phases.

### Work that must not happen in parallel

- Shared platform/shell providers, route layouts, global motion configuration, and global styles have one integration owner.
- `CaptainLibrary.tsx` and its New Voyage workflow remain one ownership unit unless subcomponents are first extracted under an explicit handoff.
- dnd-kit container transforms, package/lockfiles, and any generated asset registry are single-owner resources.
- Full platform E2E, browser sessions, database mutations, and the final build/validation are serialized.

## Phase 5 - Rive/Lottie/PageFlip completion

### Exact scope

1. Author and register four project-owned Rive state machines while retaining labeled SVG/CSS fallbacks:
   - Invitation Seal: `idle`, `hover`, `pressed`, `listening`, `opening`, and `rejected` states with pointer/focus, progress/result, open, and reset inputs;
   - Journal Clasp: `locked`, `awake`, `opening`, and `open` states driven by named opening phases and reset;
   - Voyage Compass: `idle`, `bearing`, and `arrived` states driven by normalized bearing/progress and arrival/reset inputs; and
   - Finale Mechanism: `dormant`, `teased`, `sealed`, `partial`, `ready`, `unlocking`, `unlocked`, and `complete` states driven by authoritative finale progress and unlock/result inputs.
2. Validate artboard, state-machine, input names, load failure, stable reduced pose, pause/resume, visibility, cleanup, and accessible fallback for each Rive object. External libraries may move a container, not the Rive-owned internal object.
3. Keep Lottie as a contained-effect runtime while removing lifecycle defects:
   - do not destroy/reload a runtime solely because full/gentle duration policy changed;
   - preserve loop continuity across mode changes;
   - pause for element/document visibility;
   - expose deterministic representative frames in reduced mode; and
   - start non-looping `ink-bloom` from a GSAP semantic label/segment controller, never uncontrolled mount autoplay.
4. Complete StPageFlip behavior:
   - update or safely recreate the instance when full/gentle `flippingTime` changes;
   - emit turn-start, commit, and settle lifecycle labels;
   - preserve current page through content and orientation changes;
   - sanitize source/cloned scene attributes;
   - keep keyboard, drag, queued programmatic turns, failure fallback, and product/browser reduced behavior coherent; and
   - hand focus/audio/adjacent effects off only at StPageFlip lifecycle boundaries.
5. Remove any remaining production implication that the development `rating-animation.riv` sample proves product asset readiness.

### Dependencies

- Phase 2 wrapper/ownership and source-clone contracts are stable.
- Phase 3/4 semantic state and input names are frozen before Rive artboard/state-machine integration.
- Rive source/export ownership, license/provenance, review, and deterministic output location are established before binaries are committed.
- PageFlip lifecycle consumers agree on labels before the component API changes.

### Files likely affected

- `public/animations/rive/` for four project-authored binaries and provenance metadata
- `public/animations/stills/` for maintained fallbacks
- `public/animations/lottie/` only if an audited asset revision is required
- `src/animation/assets/rive-contracts.ts`
- `src/animation/assets/lottie-contracts.ts`
- `src/animation/core/asset-registry.ts`
- `src/components/animation/RiveRuntime.tsx`
- `src/components/animation/RiveStatefulObject.tsx`
- `src/components/animation/RiveRuntime.test.tsx`
- `src/components/animation/LottieEffect.tsx`
- `src/components/animation/LottieEffect.test.tsx`
- `src/components/animation/PageFlipBook.tsx`
- `src/components/animation/PageFlipBook.test.tsx`
- consuming Invitation, Player, Chart, Finale, and waiting-room components
- asset-validation scripts/tests where their existing contract requires extension

### Libraries involved

Rive, Lottie/web SVG renderer, StPageFlip, React, Motion/GSAP wrapper handoffs, CSS fallbacks, Web Audio labels, and the asset registry.

### Acceptance criteria

- `npm run assets:validate` reports four production Rive binaries whose artboard, state machine, and input contracts match code; the development sample is explicitly non-production.
- Each Rive object reaches every declared state from the real production screen, has a stable reduced pose, survives load failure through the correct fallback, and returns runtime instance counts to baseline after unmount/replay.
- Full/gentle changes do not reload ambient Lottie JSON or restart a non-looping effect; reduced mode uses a deliberate representative frame.
- `ink-bloom` begins at its named ceremony label and cannot replay merely because mode changed.
- Existing StPageFlip instances apply the correct full/gentle timing, preserve page identity through update/orientation, and never expose hidden source nodes as cinematic targets.
- Manual, keyboard, drag, and programmatic turns share lifecycle semantics and accessible fallback behavior.

### Tests

- Asset-contract tests for path, binary presence, artboard, state machine, inputs, and fallbacks.
- Rive component tests for state/input changes, reduced pose, load failure, pause/visibility, cleanup, and repeated mounts.
- Lottie component tests for no reload on mode change, loop continuity, semantic segment start, stalled load, failure fallback, visibility pause, and cleanup.
- PageFlip tests for full-to-gentle existing-instance behavior, lifecycle events, queueing, source sanitization, page preservation, orientation, import/runtime failure, and reduced fallback.
- Production-screen E2E for each Rive consumer and journal turn mode at required desktop/mobile viewports.
- Repeat-replay/navigation memory test with runtime counts and event-listener/timer baselines.

### Risks

- Binary Rive output can be nondeterministic or hard to review without source/provenance and input-name validation.
- Changing artboard/input names without atomic contract updates produces silent fallback-only behavior.
- Recreating PageFlip for timing can lose page index, focus, or queued turns.
- Lottie reuse can retain stale callbacks unless lifecycle ownership is explicit.
- Rive, Lottie, and PageFlip tests can become browser/runtime dependent; keep deterministic wrapper tests separate from one centralized E2E run.

### Work that can happen in parallel

- Rive asset authoring for the four objects can run as four design lanes with unique files and a shared naming contract.
- Lottie wrapper repair and PageFlip repair can run in parallel because their implementation paths are disjoint.
- Fallback/accessibility review can run read-only while assets are authored.

### Work that must not happen in parallel

- One asset integration owner controls `rive-contracts.ts`, the asset registry, validation rules, and final binary registration.
- A binary and its contract must be handed off atomically; no parallel rename/export against the same object.
- `PageFlipBook.tsx` has one writer and one authoritative browser owner.
- Generated assets, package/lockfile changes, full asset validation, production build, and browser/runtime validation are serialized.

## Phase 6 - Performance, accessibility and final polish

### Exact scope

1. Run the complete production-screen mode, viewport, cache, sound, network, navigation, replay, and interruption matrix. Resolve remaining truth, accessibility, or lifecycle defects before aesthetic polish.
2. Finalize one reduced-motion authority across Motion, GSAP duration/travel, CSS media behavior, StPageFlip fallback, Rive pose, Lottie frame, and sound. Preserve narrative order, content, focus, and available actions.
3. Establish and enforce performance budgets for required scenes: no unbounded phase wait, no avoidable hidden/offscreen animation, no duplicated runtime mount, bounded stagger/blur/filter cost, no mode-change asset reload, and runtime/listener/timer counts returning to baseline after replay/navigation.
4. Scope and pause ambient work by visibility and document state; remove broad selectors and unnecessary layout reads; cap mobile secondary effects.
5. Complete keyboard, focus, live-region, contrast, sound-independent meaning, error recovery, and interruption behavior for every cinematic and modern platform surface.
6. Apply final easing, anticipation, settle, secondary motion, material response, and audio timing only after the preceding gates pass. Do not turn P2/P3 polish into new authoritative state.
7. Update maintained architecture/testing documentation to match the implemented ownership, target, replay, fallback, and validation contracts.

### Dependencies

- Phases 1-5 are integrated and focused tests pass.
- The full audit matrix and Animation System Test Plan are used as the acceptance inventory.
- One integrated runtime/database/browser owner is assigned, with explicit database-path proof before mutation tests.
- Visual and performance baselines are captured from production routes, not only the showcase.

### Files likely affected

- `src/animation/director/AnimationProvider.tsx`
- `src/animation/motion/useMotionMode.ts`
- `src/animation/core/quality.ts`
- `src/animation/core/visibility.ts`
- `src/animation/core/metrics.ts`
- runtime wrappers and scene files proven by profiling to require changes
- `src/styles/landing.css`, `src/styles/platform.css`, `src/styles/player.css`, `src/styles/studio.css`, `src/styles/tall-tale.css`, and shared tokens/global styles under one owner
- focused unit/component/E2E tests
- `docs/design-system.md`, `docs/responsive-behavior.md`, `docs/testing.md`, and relevant `Development_Docs` architecture records when implementation makes them inaccurate

### Libraries involved

All animation runtimes and supporting browser APIs: GSAP, Motion, StPageFlip, Rive, Lottie, CSS, Web Animations API, Web Audio, dnd-kit, browser performance/visibility APIs, and Playwright/Vitest validation.

### Acceptance criteria

- Every required production flow passes full, gentle, product-reduced, browser-reduced, and combined-reduced modes with equivalent readable final state.
- Required viewports (2560x1440, 1920x1080, 1440x900, 430x932, 390x844, 844x390) have no animation-caused horizontal overflow, clipped actions, inaccessible focus, or hover-only state.
- Repeated replay, navigation, mode switching, visibility loss, and route interruption return GSAP, Rive, Lottie, PageFlip, listeners, timers, and queued work to expected baseline counts.
- Core ceremonies meet encoded duration/response budgets and have no unbounded waits or unexplained main-thread long tasks; any device-specific exception is documented with a reduced/fallback policy.
- Sound-off users receive all semantic information; sound-on cues align with reached labels and never announce a failed presentation.
- Cached, uncached, slow, failed, offline, and reconnect paths end in stable, actionable states.
- No production acceptance depends on the development showcase. The showcase remains a diagnostic surface with target-integrity telemetry.
- Maintained documentation and tests describe the implemented system, and `npm run validate` passes or every pre-existing/environmental failure is evidence-backed and explicitly accounted for.

### Tests

- Unit/component: final target, ownership, mode, fallback, lifecycle, focus, and memory contracts.
- E2E: production route matrix for first/return visit, success/failure, slow/offline/reconnect, replay/skip/interruption, back/forward, sound, cached/uncached assets, and every-event/every-section behavior.
- Visual checkpoints at named semantic states, not arbitrary sleeps, for all six viewports and modes.
- Accessibility: keyboard-only, focus order/restoration, live-region announcements, browser reduced motion, product reduced mode, and sound-independent meaning.
- Performance: scene duration/label timestamps, target counts, main-thread long tasks, layout/paint-sensitive effects, asset reloads, and runtime counts before/after stress loops.
- Run focused independent unit shards in parallel. One owner runs the integrated E2E, production build, and final `npm run validate` once on the combined state.

### Risks

- Late global CSS or provider changes can invalidate earlier visual acceptance across every surface.
- Device-dependent performance can make arbitrary timing thresholds flaky; use semantic checkpoints and separately encode bounded duration budgets.
- Accessibility fixes can expose layout/ownership assumptions that require returning to an earlier phase contract rather than adding exceptions.
- Full validation can mutate or contend for the wrong database if path isolation is assumed from port/worktree alone.
- Decorative polish can reintroduce duplicate owners, autoplay, or reduced-motion defects unless it uses the same contracts.

### Work that can happen in parallel

- Read-only accessibility, performance, responsive/visual, memory/lifecycle, and documentation fact-check lanes can run concurrently against one recorded integrated build/evidence set.
- After findings are reconciled, disjoint component/style fixes can run in path-owned lanes.
- Safe unit/component shards can run concurrently when they do not share mutable state.

### Work that must not happen in parallel

- Global motion provider, shared tokens/styles, central metrics/quality policy, and route shell changes each have one integration owner.
- Only one owner controls the development/test server, browser automation, database, E2E suite, production build, and final full validation.
- Performance capture must not overlap another lane changing the measured runtime.
- Final Git reconciliation and the repository chat/document synchronization gate remain serialized under the coordinator.

## Cross-phase implementation controls

### Shared-resource ownership

| Resource                                          | Required owner                              | Rule                                                                                          |
| ------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Port `3000` and canonical development server      | One runtime owner                           | Inspect the listener first; never stop or reuse an unknown/concurrent process.                |
| Playwright port `3100` and validation port `3200` | One validation owner                        | Use only the configured validation lifecycle; do not create a competing application copy.     |
| Browser automation                                | One controller                              | Other lanes consume saved evidence or request a focused check.                                |
| Database, seed, and migrations                    | One database owner                          | Prove the resolved database path before mutation; serialize reset/seed/migration/E2E.         |
| `package.json` / lockfile                         | One package owner                           | No independent installs or lockfile regeneration by feature lanes.                            |
| Animation types, director, registry, providers    | One architecture owner per ownership window | Freeze and hand off interfaces before consumer lanes edit.                                    |
| Global styles/tokens/shell                        | One integration owner                       | Component lanes use local wrappers/styles until an explicit handoff.                          |
| Rive/Lottie/generated assets                      | One asset integration owner                 | Preserve source/provenance, deterministic names, and contract validation.                     |
| Full E2E/build/`npm run validate`                 | One validation owner                        | Run once on the integrated phase state unless a failure requires a focused rerun.             |
| Chat and `Development_Docs` synchronization       | Coordinator                                 | Run the dry-run/live/validate workflow only after all phase artifacts/changes are reconciled. |

### Phase completion rule

A phase is complete only when its acceptance criteria are mapped to evidence, focused tests pass or failures are accounted for, shared-file handoffs are complete, the integrated diff contains no scope expansion, runtime/database ownership is released, and the coordinator has checked the result against the full audit and Animation System Test Plan. A failed independent lane returns partial evidence and blocks only its dependents; completed lanes are not restarted.

### Exact next action

Finish Project Lanternwake Phase 1 without entering Phase 2: preserve the passing integrated `npm run validate` evidence, inspect the combined diff and working tree, and complete the required coordinator-owned chat/development-document dry-run, live synchronization, synchronization validation, scoped commit/push verification, and final Git/remote classification. Then report Phase 1 complete and stop for review. Do not begin the persistent/global ceremony host, production Rive registration, future-contract scene implementation, platform-wide motion expansion, the 238-animation blueprint, or final visual/performance tuning in this phase.

## Project Lanternwake status reconciliation (2026-07-18)

This dated reconciliation updates current execution status without changing the historical roadmap scope above.

| Project Lanternwake phase        | Current state                                                          | Evidence and boundary                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 - Light the Lantern      | **Complete, validated, synchronized**                                  | `npm run validate` passed with 46 Vitest files / 304 tests and 27 Playwright passes / 17 intentional skips; asset, database-isolation, seed/backfill/history, build/restart, launcher-preservation, and cleanup checks passed; documentation/chat synchronization was pushed at `fb8eb4ac33f4a44028fe82fb08df0ac0e5021db6`    |
| Phase 2 - Claim the Deck         | **Implementation/composite validation accepted; finalization pending** | SceneHost, scene-instance, target, external-handle, ownership-permit, final-state, PageFlip, component-boundary, diagnostics, and reconciliation surfaces are implemented; V2/V3 repairs, 59 files / 452 tests, 48-pass isolated Playwright, assets, and canonical build/restarts passed; sync/push remains coordinator-owned |
| Phase 3 - Unfurl the Tale        | **Not started**                                                        | May consume only the stable Phase 2 APIs after Phase 2 acceptance; the persistent Player progression/event integration is not being implemented by this phase                                                                                                                                                                 |
| Phase 4 - Bring the Harbor Alive | **Not started**                                                        | Modern platform/authentication/Library/invitation/shell motion remains later work; no Phase 2 architecture result is visual implementation proof                                                                                                                                                                              |

### Current tracking totals

| Tracking surface                            | Current total |
| ------------------------------------------- | ------------: |
| Frozen Codex animation rows                 |           220 |
| OA source requirements                      |           238 |
| Accepted source requirements                |           458 |
| Current physical matrix rows / columns      |      361 / 58 |
| OA ledger rows / columns                    |      238 / 40 |
| Existing-only / dedicated OA mappings       |      97 / 141 |
| OA-to-matrix edges                          |           289 |
| Coverage exact / combined / partial         |  184 / 47 / 7 |
| Accepted requirements unmapped / unresolved |         0 / 0 |

The reconciliation validator and its 13 Python tests pass. Normalized implementation state deliberately remains conservative after Phase 2 acceptance: the matrix contains 252 `architecture_ready`, 47 `validated`, 50 `partially_implemented`, 10 `not_started`, and 2 `blocked` rows; the OA ledger contains 151 `architecture_ready`, 1 `validated`, 74 `partially_implemented`, 10 `not_started`, and 2 `blocked` rows. Architecture validation is `passed` for 349 matrix rows / 226 OA rows and `not_started` for 12 rows in each artifact. `architecture_ready` records a passed Phase 2 boundary only: those later visuals retain blank implementation commits and planned visual validation rather than being called implemented.

### Stable Phase 2 handoff target

Phase 3 and Phase 4 must reuse, not fork, these Phase 2 boundaries:

1. provider-scoped `SceneHost` registration and teardown;
2. immutable per-play scene-instance identity;
3. host-local target registration and exact target contracts;
4. registry-minted identity-only external target handles;
5. atomic property-group ownership and opaque write permits;
6. runtime-owned Motion/CSS/PageFlip/Rive/Lottie/WAAPI/dnd-kit integration;
7. final-state handoff and handoff-before-cleanup ordering;
8. PageFlip source, current clone, stale clone, and generation identity;
9. structured presentation receipts, diagnostics, and replay-instance identity; and
10. the 220 + 238 requirement mapping and validator contract.

The five future-contract scenes remain later visuals. Their safe runtime boundaries may be consumed by later phases, but the visuals remain **not implemented** until their later triggers, visuals, assets, reduced states, accessibility, and tests are delivered.

### Current release blockers

- Coordinator-owned evidence commit, chat/document synchronization, branch push, and remote-SHA verification remain required.
- The combined `npm run validate` process exited 1 at production build because of the temporary worktree dependency junction. This is an evidence-backed `environment` classification, not a command pass. After the junction was removed, canonical `npm run build` and two production restart/cleanup probes passed.
- Production Rive visuals, future-contract visuals, Phase 3 progression/event integration, Phase 4 platform motion, broad device-performance tuning, and final art polish remain later work rather than Phase 2 blockers.

Phase 2 implementation and composite validation are accepted. Phase 3 and Phase 4 stay blocked from automatic start until the coordinator completes synchronization, push, and remote verification, then provides the explicit handoff.
