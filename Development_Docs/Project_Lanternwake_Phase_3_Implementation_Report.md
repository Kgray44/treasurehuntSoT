# Project Lanternwake Phase 3 — Unfurl the Tale

- Status: **implementation complete; composite validation accepted; merged to `main`**
- Report date: 2026-07-19
- Ending implementation commit: `3a24e1e9c88449ee0bdfe35d7ab4bfe378d82fac`
- Integrated merge commit: `35132ca5e38187336c0632f392edbfc985e5ff55`
- Published finalization evidence: `e44173420924350ebca0e7b9f37fbb0b3279f2df`
- Integrated validation: **PASS — see `Project_Lanternwake_Phase_3_Validation_Report.md`**

This report records the completed Phase 3 implementation. Sections that describe the original implementation-stage evidence plan are retained as design history; the final acceptance authority is `Project_Lanternwake_Phase_3_Validation_Report.md`. That report records the cumulative browser evidence, bounded failures, post-fix targeted verification, merged-main gates, accepted visual-review deviation, Git ancestry, and remote parity without claiming a post-fix 599-case rerun or a retained screenshot archive.

## 1. Executive summary

Phase 3 replaces the compatibility Player companion's section-local presentation state with one persistent, receipt-gated progression presentation system. The worktree contains an exhaustive 17-event policy, authoritative-first queue, persistent global host, four-cursor controller, Player-safe replay history, hardened SSE/viewed routes, exact section target capabilities, shared Journal/PageFlip readiness and fallback work, and a hardened Quartermaster bridge.

Every event has a readable global outcome available from all six starting sections without forced navigation. A mounted relevant section may receive one optional after-commit enhancement, but that enhancement cannot order, acknowledge, replay, or block the event. Replay uses a fresh identity and cannot mutate. Access revocation is terminal and removes protected Player content.

The 102 event/section carriers, focused runtime repairs, merged-main build/static gates, and final Git proof are accepted by the composite Phase 3 validation report. The planned post-fix 599-case rerun, hashed 57-image archive, and Phase 6-wide production performance/polish work are explicitly not claimed.

## 2. Repository and branch

- Repository: `Kgray44/treasurehuntSoT`
- Isolated worktree: `C:\Users\kkids\Documents\Codex_TreasureHunt_Phase3`
- Branch: `codex/project-lanternwake-phase-3-unfurl-the-tale`
- Phase 2 source branch: `codex/project-lanternwake-phase-2-claim-the-deck`
- Canonical application remains the root Next.js App Router package.
- Phase 3 compatibility presentation surface: `/tale/[campaignSlug]`.
- Canonical durable Player journal remains `/player/playthroughs/[playthroughId]/journal`; this report does not claim the compatibility progression host exists there.

## 3. Starting and ending commit

- Starting/Phase 2 final handoff: `7747ce5b472fdb19b9fe8f35ea12fbe974902fe7`.
- Phase 2 implementation: `d529b59e06ad1f2d736f6e1b888ebb78f169dcc0`.
- Phase 2 evidence: `acf390f`.
- Phase 2 chat synchronization: `7747ce5`.
- Ending Phase 3 commit: `3a24e1e9c88449ee0bdfe35d7ab4bfe378d82fac`.
- Final merge on `main`: `35132ca5e38187336c0632f392edbfc985e5ff55`.

## 4. Worktree safety

Phase 3 runs in its own worktree and branch based exactly on the Phase 2 final handoff. The shared `main` checkout is outside this implementation path. Dependency generation used a real local `node_modules` directory rather than the Phase 2 temporary junction condition. The coordinator retains sole ownership of dependency installation, schema/migrations, ports, shared databases, full builds/suites, Git integration, generated evidence, and final synchronization.

Final status is complete. Phase 3 is an ancestor of `main`, and `main` matched `origin/main` at `35132ca5e38187336c0632f392edbfc985e5ff55` when finalization began.

## 5. Phase 1 dependency result

Phase 3 receives the Phase 1 animation provider, Director, host/target registry, runtime/property ownership, scene receipt, motion-policy, asset fallback, and focus/lifecycle foundations through the Phase 2 handoff. The historical `main` Phase 1 baseline was `fb8eb4ac33f4a44028fe82fb08df0ac0e5021db6`; Phase 3 did not reimplement those systems.

The consumed Phase 1 contracts passed the focused failure-only browser gate and the final merged-main source suite; the evidence and accepted no-rerun boundary are recorded in the Phase 3 Validation Report.

## 6. Phase 2 dependency result

Phase 2 completed on remote SHA `7747ce5b472fdb19b9fe8f35ea12fbe974902fe7` with 458 accepted requirements reconciled (220 Codex plus 238 OA), a 361-row matrix, and zero accepted-unmapped or unresolved entries. Its reported focused/static gates and isolated Playwright suite passed. Its single `npm run validate` invocation exited 1 at the production-build step because of the temporary worktree `node_modules` junction; after removing that junction and installing local dependencies, canonical build and two restart proofs passed. Phase 3 preserves both facts.

## 7. Requirement intake totals

- Base Phase 3 intake: **189 unique requirements**, 90 Codex plus 99 OA.
- Phase 4 assignment: **32** platform/shell requirements.
- Active Phase 3 set after assignment: **157** requirements.
- Baseline presentation matrix: **102** event/section carriers, 17 events by six starting sections.
- Accepted-unmapped and unresolved program requirements at intake: zero.
- Three Phase 3 Rive binary rows remain `blocked_external_asset`; OA-173 / MX-257 remains `blocked_environment` pending a moon-phase data contract and fixtures.

The final dedicated-ledger disposition is 265 `validated` / `passed` rows, 32 `architecture_ready` / `planned` rows explicitly assigned to Phase 4, three Phase 5 `blocked_external_asset` rows, and one `blocked_environment` moon-phase row. The governing matrix records 119 Phase 3 rows as `validated` / `passed`, one Phase 3 environment blocker, and the 32 platform/shell rows under Phase 4. The OA ledger records 98 Phase 3 rows as `validated` / `passed` plus OA-173 as `blocked_environment`. The final acceptance proof is complete in the Phase 3 Validation Report.

## 8. ProgressionSceneHost design

`ProgressionSceneHost` is one persistent outer `SceneHost kind="player-progression"` outside conditional section content. It supplies stable boxed layers for the readable heading/summary, event-family object, controls, live region, and fallback. Only the selected event family's relevant visual target is perceptible/eligible; unrelated persistent targets remain neutral.

While active, the overlay applies true modal behavior without unmounting the workspace. It focuses the first enabled Skip, Replay, or destination control, otherwise the heading. Completion restores the exact still-eligible prior focus or a declared fallback. Politeness supports `polite`, `assertive`, and `off` without creating duplicate local announcements.

## 9. Event queue

The pure deterministic `ProgressionPresentationQueue` orders live/reconnect work by authoritative source precedence, event sequence, policy priority, and stable request ID. It deduplicates event identity, rejects stale work, supports deferred/cancelled/interrupted receipts, and permits authoritative work to interrupt replay outside a declared semantic commit boundary. Pending replay never delays authoritative events.

Queue receipts distinguish presented, skipped, fallback, duplicate, stale, deferred, interrupted, failed, and cancelled truth. A successful status alone is not acknowledgment evidence.

## 10. Event presentation policy

An exhaustive typed `Record` covers the exact 17 event types. Each policy declares scene, priority, mandatory/optional status, interruptibility, relevant section, global targets, optional local targets, replay, acknowledgment, focus, skip, notification, audio or intentional silence, full/gentle/reduced semantics, fallback, safe payload projection, and settled-state handoff.

The global host always provides the readable outcome. Section-local enhancement is optional, starts only after global commit, and owns neither acknowledgment nor fallback.

## 11. Chapter release

`CHAPTER_RELEASED` is the highest-priority ceremony. It remains visible from every starting section and does not force Journal navigation. Authorized presentation history reconstructs title, narrative, objective, and riddle from the current `PublicChapter`; an unavailable, locked, invalid, or unreadable chapter causes the replay-history event to be omitted rather than exposing stored prose.

The global host owns the mandatory chapter ceremony targets. A Journal-local settle may run only when its exact mounted target is ready. Skip/failure must converge through final-state readability before any viewed acknowledgment.

## 12. Journal opening

Opening profiles are first/full, returning/abbreviated, completed/archive, manual-full replay, and reduced. Archive mode is quiet and starts no false SSE expectation. The opening phase machine does not declare interactivity merely because the cover animation ended.

`JOURNAL_READY` requires a receipt that verifies PageFlip runtime-or-static readiness, current page identity, interface/objective reachability, focus destination, announcement, fallback, and cleanup. Timeout or readiness-probe failure forces a readable PageFlip fallback before readiness can be claimed.

## 13. Journal pages

Page turns expose `turn-start`, `turn-commit`, `turn-settle`, `turn-cancel`, and `turn-failed` with book/mount identity and current boundary generation. Queued turns rebase from the actual current page and generation when dispatched. Same-page requests cancel as no-ops rather than reporting a false turn.

`forceReadableFallback(reason)` abandons the failed runtime, preserves the current semantic page and eligible focus, and renders a static reader. Current-page target restoration selects the exact current visible primary for the active generation and rejects stale, inert, hidden, or disconnected clones. Session-identity changes reset session-scoped opening, cursor, page, and callback state.

## 14. Voyage Chart

Voyage Chart exposes exact keyed capabilities for map markers and routes. Registration, deduplication, retraction, and endpoint truth are separate from the global presentation. Motion owns component presence/interactions while GSAP receives only the dedicated permitted chart target after global commit. The Voyage Compass interface has a truthful local SVG/CSS fallback until authored Rive art exists.

## 15. Treasure Altar

Treasure Altar registers exact artifact slot, silhouette, connection path, and endpoint identities. A nested `player-section-enhancement` host prevents local targets from contaminating global host cardinality. Motion and GSAP use separate wrappers/properties, and target retraction removes capability rather than leaving a stale handle.

## 16. Artifact Inspection

Artifact Inspection supplies an exact keyed inspection/engraving target and a focus-safe return path. Its semantic dialog is a real boxed section-enhancement host rather than a zero-box registration root. The Motion wrapper remains separate from the Director-owned inner target.

## 17. Side-Quest Ledger

Side-quest discovery, objective update, and completion have distinct exact targets. Quest IDs/objective identities remain stable, annotation/unseen state is not substituted for progression-event identity, and decorative Lottie content stays outside the accessibility tree. A local quest effect is optional after global commit and cannot claim the event ran if its capability was unavailable.

## 18. Ship’s Log

Log presentation uses immutable `ProgressEvent.id` as `progressEventId`, not a journal/log domain key. The exact row, fresh-ink, date, and symbol targets are registered separately so a new event cannot select an older matching row. Ordinary log entries remain intentionally silent until a validated semantic audio label exists.

## 19. Finale

Finale Teased and Finale Requirement Updated use keyed requirement/mechanism targets while retaining readable global summaries. The mechanism adapter drives both frozen semantic `state` and `progress` signals. Runtime status is retractable with `status | null`; null/unmount revokes the capability. The actual Finale Mechanism `.riv` remains `blocked_external_asset`, so the CSS/SVG fallback is the production truth for Phase 3.

## 20. Pause/resume/undo

`CAMPAIGN_PAUSED`, `CAMPAIGN_RESUMED`, and `STATE_REVERTED` have persistent-host readable outcomes and replacement-state notification behavior. They require no off-section target. Revert projects only a safe previous/current summary; unavailable identities are not guessed. These presentations do not roll back or rewrite the authoritative transaction.

## 21. Quartermaster bridge

The command, compatibility action, status, and Quartermaster page paths require `CAPTAIN` capability. Payload validation is bounded and discriminated. Idempotency compares a canonical fingerprint of complete normalized intent, and every sequence-consuming business path reserves `expectedSequence` by compare-and-set inside its transaction.

`PREPARE_HINT` records the prepared action identity and reports committed staging separately from process publication (`NOT_APPLICABLE`/`NOT_ATTEMPTED`). Persistence, process publication, Player delivery, presentation, and acknowledgment are distinct. Unexpected failures return generic client text.

## 22. Replay

Replay draws from bounded authorized Player-safe `presentationHistory`, creates a new request and Director playback identity, and is always acknowledgment-ineligible. It stays behind authoritative work and may be interrupted. A replay mutation guard prevents progression/viewed/presence writes; replay does not reuse stale section capabilities.

The final focused browser gate proved the repaired retry/fallback and persisted acknowledgment paths without changing the canonical database. Broader replay implementation is covered by the accepted source suite; the waived comprehensive rerun is recorded rather than inferred.

## 23. Audio

Every event policy declares instance-scoped semantic labels or intentional silence. Audio begins only after user interaction, active-request target preflight, and the matching Director label; it deduplicates by event/scene instance/label. Mute, volume, playback failure, and cleanup cannot change meaning, final-state truth, focus, or acknowledgment.

Audio policy and cleanup are accepted through source coverage and the completed composite review. A new post-fix cross-browser sweep was not performed and is not claimed.

## 24. Lottie

One-shot effects are command-gated and load with runtime autoplay disabled. Reduced mode stops movement and selects the representative frame; command state is cleared on completion/stop/reduced/unmount so visibility restoration cannot replay an old one-shot. Import, fetch, data, timeout, and renderer failure leave the local fallback and authoritative content intact.

## 25. Rive fallback interfaces

Journal Clasp, Voyage Compass, and Finale Mechanism have frozen state-machine names, inputs, states, reduced poses, reduced semantic signals, pages, and local fallback paths. Their availability is truthfully `blocked_external_asset`; no production `.riv` path or runtime-ready claim is invented. The development rating binary proves the loader only and does not satisfy production art.

## 26. Offline/reconnect

The controller keeps separate observed, queued, presented, and acknowledged cursors. Reconnect first revalidates access, loads bounded authorized presentation history and batch acknowledgment IDs, merges durable replay/live events by sequence/ID, and queues only unseen work. The SSE route subscribes before its replay query, bounds live buffering/deduplication/backpressure, and periodically revalidates access.

Access revocation is terminal for the current identity: reconnect stops, in-memory controller/history is cleared, protected workspace content is removed, and a readable access state is shown.

## 27. Focus/accessibility

The persistent overlay owns one controlled live region; local components do not duplicate ceremony announcements. Decorative Lottie/Rive/SVG content is hidden from the accessibility tree. Modal inertness applies only while the global overlay is active. Focus targets reject hidden-source, stale-clone, unrelated, inert, hidden, detached, or disabled nodes and restore to an exact eligible element or declared heading/destination fallback.

The completed browser/visual review is accepted for Phase 3. A second post-fix all-viewport sweep and per-image hash archive were waived by the project owner and are not claimed as executed.

## 28. Additional OA animations

The Phase 3 Player Event Coverage Ledger maps all 99 OA intake requirements to their source, carrier, status, evidence path, blocker, and later-phase ownership. The current reconciliation separates active Phase 3 work from 32 Phase 4 assignments and explicit Phase 5 art/PageFlip portions. OA-173 remains blocked on authoritative moon-phase data and fixtures rather than being represented as an animation pass.

Final OA reconciliation and commit evidence passed in the Phase 3 ledger and merged-main validators.

## 29. Additional MX animations

The ledger retains the 152 Phase 3 MX physical carrier rows without treating those rows as additional requirements. The 102 exact event/section carriers cover all 17 events from all six starting sections; supplemental contract and asset rows preserve cross-phase truth. Current-quality/partial compatibility work is not promoted merely because a typed carrier exists.

Final MX carrier reconciliation and commit evidence passed in the Phase 3 ledger and merged-main validators.

## 30. Tests

Focused source tests exist for the exhaustive policy/queue, controller, persistent host, PageFlip lifecycle/fallback, Journal opening/session identity, exact section targets, Player-safe history/SSE/viewed routes, Quartermaster authorization/idempotency/sequence handling, Rive contracts/runtime, reconciliation validators, and the Phase 3 event ledger. Implementation lanes ran focused checks while files were owned by those lanes.

The authoritative commands, counts, browser failure ledger, post-fix checks, merged-main build, and accepted deviations are final in the Phase 3 Validation Report.

## 31. Performance

The frozen gates are: chapter release below 10,000 ms; target preflight p95 below 50 ms; Skip/Replay/PageFlip response within 100 ms; cleanup below 250 ms; desktop frame p95 at most 25 ms; mobile frame p95 at most 40 ms; no app-attributable stall above 100 ms; chapter/ordinary long-task budgets of 200/100 ms; and CLS at most 0.10.

Phase 3's implementation and product-validation boundary is accepted. Broad production device profiling and final performance/polish remain Phase 6 work; this report does not manufacture a missing post-fix performance trace.

## 32. Lifecycle

Implementation includes idempotent Director/final-state cleanup, external-handle revocation, Lottie/Rive/PageFlip teardown, EventSource access-revocation cleanup, queued-turn cancellation, focus restoration, and session-identity reset behavior. Lifecycle behavior is accepted through the completed source/browser review and focused repair checks. A new post-fix monolithic 20-cycle browser rerun was not performed and is covered by the same accepted deviation as the full matrix.

## 33. Files changed

The completed Phase 3 implementation includes:

- progression contracts/policy/queue/controller/host under `src/components/player/progression/`;
- compatibility Player integration in `src/components/player/PlayerExperience.tsx`, its tests, `src/domain/story.ts`, and `src/styles/player.css`;
- Player history/SSE/viewed APIs under `src/app/api/player/[campaignSlug]/` plus snapshot/visibility/progression projectors;
- Journal/PageFlip/opening work under `src/components/animation/`, `src/components/player/journal/`, and `src/animation/journal/`;
- Chart, treasure, artifact, quest, log, and finale section components/tests under `src/components/player/workspace/`;
- Quartermaster routes/pages/components plus `src/server/admin-command.ts` and tests;
- scene registry/builders, Rive contracts/runtime, reconciliation and ledger validators, isolated validation harness, and Phase 3 E2E/performance configuration;
- this report, the frozen/appended Design Record, coverage ledger, and governing architecture/product documentation.

The authoritative final file list is the Git tree diff from Phase 2 handoff `7747ce5b472fdb19b9fe8f35ea12fbe974902fe7` through Phase 3 tip `3a24e1e9c88449ee0bdfe35d7ab4bfe378d82fac`, merged by `35132ca5e38187336c0632f392edbfc985e5ff55`.

## 34. Known limitations

- Composite Phase 3 validation is final and the implementation/merge commits are recorded above. The report truthfully preserves the waived post-fix comprehensive rerun and missing screenshot archive.
- Journal Clasp, Voyage Compass, and Finale Mechanism authored `.riv` binaries remain Phase 5 `blocked_external_asset`; Phase 3 uses truthful local fallbacks.
- OA-173 / MX-257 remains blocked until authoritative moon-phase data and deterministic fixtures exist.
- Thirty-two platform/shell requirements are assigned to Phase 4 and require closing acceptance evidence.
- The persistent 17-event host belongs to the compatibility `/tale/[campaignSlug]` companion; it is not claimed on the canonical durable journal route.
- Final PageFlip runtime completion beyond the Phase 3 lifecycle/readiness/fallback contract remains Phase 5.
- Process-local event publication remains an accelerator; durable database replay is the restart/reconnect authority.

## 35. Phase 4 handoff

Phase 4 receives the 32 platform/shell assignments and must reuse the existing AnimationProvider, persistent progression host, authoritative-first queue, target/ownership registry, resolved motion policy, notification integration, focus restoration, final-state fallback, access-revocation boundary, and semantic audio labels. It must not create a second global host, queue, ownership system, or business-state store. Phase 4 does not start automatically.

Cross-phase disposition is accepted by the Phase 3 ledger and validation report. Phase 4 must continue from the merged Phase 3 baseline without absorbing Phase 5 authored-art scope.

## 36. Phase 5 handoff

Phase 5 receives the frozen Journal Clasp, Voyage Compass, and Finale Mechanism state machines, inputs, states, reduced poses, semantic signals, fallback paths, mount/status/retraction behavior, labels, and load-failure truth. It also receives Lottie command semantics and the PageFlip lifecycle/readiness/fallback contract. Authored production `.riv` files must be local, provenance-verified, and validated without removing fallback. Cards remain for browsing Tall Tales; the Journal remains for experiencing them.

Phase 5 does not start automatically, and missing Phase 5 art does not reduce Phase 3's readable outcomes.
