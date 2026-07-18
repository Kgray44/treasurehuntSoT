# Project Lanternwake Phase 1 Design Record

Status: Phase 1 implementation and acceptance validation complete; repository synchronization is coordinator-owned and reported after this document checkpoint  
Phase: Light the Lantern - Animation Truth, Presentation Integrity, and Broken-Trigger Repair  
Date: 2026-07-18  
Coordinator: Codex root task  
Repository: `Kgray44/treasurehuntSoT`  
Starting branch and commit: `main` at `40a58ec1329caea8245b10ce344eb05f5d6baed2`  
Audit baseline: `4dbe8c0ae2fbab2785d1d3f26b8d7ba33bf56aee`

## 1. Decision summary

Phase 1 establishes presentation truth. A timeline that builds, plays, or resolves is not proof that a presentation occurred. A successful presentation requires a host-scoped scene instance, satisfied target cardinality and visibility, compatible property ownership, successful runtime settlement, the required semantic labels and final state, and exactly-once cleanup. A specifically approved readable fallback is a distinct successful outcome; it is never reported as full animation presentation.

The frozen Phase 1 interfaces are:

- `SceneTargetContract`
- `SceneTargetRequirement`
- `SceneTargetObservation`
- `ScenePreflightReport`
- `PresentationOutcome`
- `PresentationReceipt<T>`
- `ScenePlaybackPolicy`
- `SceneAcknowledgmentPolicy`
- `SceneFinalStatePolicy`
- `ResolvedMotionPolicy`
- `JournalPhaseOutcome`
- `ReplayablePresentation`
- `SceneReachability`

These contracts are compatibility foundations for Phase 2 `SceneHost`; Phase 1 does not build the full persistent global ceremony host or broadly migrate every screen.

### Implemented Phase 1 outcome

The current working tree implements the frozen interfaces and the requested Phase 1 truth boundary:

- all 28 registry scenes have explicit contracts and exhaustive reachability evidence: 16 `production`, 4 `legacy`, 5 `future-contract`, 3 `deprecated`, and 0 `development-only`;
- target discovery is host-scoped and enforces visibility, cardinality, stale-instance, PageFlip-source, and property-ownership rules before playback;
- the Director returns typed receipts, records bounded privacy-safe telemetry, and never treats timeline settlement alone as presentation proof;
- `CHAPTER_RELEASED` acknowledgment is receipt-gated, idempotent, and retryable after unacknowledged failure;
- replay is projected from persisted immutable event identity, survives refresh, generates a fresh scene-instance identity, and is presentation-only;
- Journal opening uses bounded Web Animations API observation with typed phase outcomes and deterministic cleanup;
- `AnimationProvider` resolves the single motion policy and publishes it through `html[data-motion-level]`, which is the CSS motion authority;
- validation has a fail-closed isolated-database identity gate, owned runtime ports, mutation observation, and canonical-database before/after proof.

The coordinator-owned final `npm run validate` gate completed successfully with exit code 0. Format, lint, and type checking passed; Vitest passed **46 test files / 304 tests**; animation asset validation passed for **3 Lottie JSON files, 1 local Rive binary, and the local SVG fallbacks**; seeded-database, backfill, accepted-history, and launcher-preservation checks passed; the production build and restart proof passed; and Playwright completed with **27 passed / 17 intentional skips**. The validation harness proved the isolated database identity, preserved the canonical database and its SQLite family unchanged, and released its controlled ports and processes. Mandatory `Codex_Chats` / `Development_Docs` synchronization remains a separate coordinator-owned finalization step and is not claimed complete in this record.

## 2. Sources of truth and conflict rule

Priority order:

1. The Project Lanternwake Phase 1 request attached to this task.
2. `Development_Docs/Animation_System_Full_Audit.md`.
3. `Development_Docs/Animation_System_Audit_Matrix.csv`.
4. `Development_Docs/Animation_System_Implementation_Roadmap.md`.
5. `Development_Docs/Animation_System_Test_Plan.md`.
6. `Development_Docs/KG_Original_Animation_Audit_Reconciliation_Source.md`.
7. Current canonical source and focused runtime/test evidence.

`Development_Docs/Animation_Original_Audit_Reconciliation_Ledger.csv` did not exist at preflight. The 238-item reconciliation source remains preserved, but Phase 1 does not perform the full reconciliation or the 238-animation expansion.

When the earlier audit or roadmap asks for the Phase 2/3 global Player host, the current Phase 1 request controls: Phase 1 adds host identity and a compatible current-surface replay controller, not the full global host migration.

## 3. Repository reality and preservation boundary

At preflight:

- `main` and `origin/main` were equal (`0` ahead, `0` behind).
- No files were staged.
- Twenty-two tracked files and fourteen untracked files contained pre-existing concurrent shell/platform work.
- Phase 1 core paths under `src/animation`, `src/components/player/PlayerExperience.tsx`, player APIs/domain/snapshot, Prisma, and animation/acceptance tests were clean and unchanged from the audit baseline.
- `src/app/layout.tsx`, `src/styles/tokens.css`, and the untracked original reconciliation source are explicit collision/preservation paths.
- The existing persisted data model is sufficient for replay. Phase 1 will not edit Prisma schemas or create a migration unless new evidence invalidates that conclusion.

Concurrent shell, landing, platform, Studio, Tall Tale, style, and unrelated test changes must not be staged, overwritten, normalized, or attributed to Phase 1. Reduced-motion implementation will avoid editing the concurrent root layout and global token file unless an explicit serialized handoff becomes unavoidable.

## 4. Frozen core types

The source may use equivalent aliases for existing compatibility names, but it must preserve these capabilities and meanings.

```ts
type MotionMode = "full" | "gentle" | "reduced";

type AnimationRuntimeOwner =
  | "gsap"
  | "motion"
  | "css"
  | "page-flip"
  | "rive"
  | "lottie"
  | "web-animations"
  | "web-audio"
  | "react";

type SceneTargetProperty =
  | "transform"
  | "opacity"
  | "clip-path"
  | "filter"
  | "stroke-dasharray"
  | "stroke-dashoffset"
  | "layout"
  | "visibility"
  | "custom";

type SceneReachability = "production" | "legacy" | "development-only" | "future-contract" | "deprecated";

type SceneTargetCardinality = { min: number; max: number };

type SceneVisibilityRule = {
  mustBeConnected: boolean;
  mustHaveNonZeroBox: boolean;
  mustNotBeDisplayNone: boolean;
  mustNotBeVisibilityHidden: boolean;
  minimumEffectiveOpacity: number;
  mustIntersectHost: boolean;
  mustIntersectViewport?: boolean;
  rejectPageFlipSource: boolean;
  rejectStaleSceneInstance: boolean;
};

type SceneTargetRequirement = {
  part: string;
  required: boolean;
  cardinality: SceneTargetCardinality;
  visibility: SceneVisibilityRule;
  owner: AnimationRuntimeOwner;
  properties: SceneTargetProperty[];
};
```

`part` resolves only inside the supplied host root. Phase 1 selectors remain compatible with current `data-scene-part` markup. A future Phase 2 host may replace the selector mechanism without changing contract semantics.

## 5. Scene target contract

```ts
type ScenePlaybackPolicy = {
  source: "automatic" | "explicit" | "operation" | "replay" | "development";
  replayable: boolean;
  allowUserSkip: boolean;
  userSkipFinalState?: string;
  allowPolicySkip: boolean;
  allowedFallback?: string;
  priority: number;
};

type SceneAcknowledgmentPolicy = {
  kind: "mandatory" | "optional" | "informational" | "animation-independent";
  acknowledgeOn: Array<"presented" | "presented-fallback" | "skipped-by-user">;
  fallbackMustBeReadable: boolean;
  acknowledgmentOwner: "player-presentation" | "caller" | "none";
};

type SceneFinalStatePolicy =
  | { kind: "revert-immediately" }
  | { kind: "hold-until-unmount"; semanticState: string }
  | { kind: "commit-semantic-pose"; semanticState: string }
  | { kind: "reconcile-then-revert"; semanticState: string }
  | { kind: "readable-static-fallback"; semanticState: string; fallback: string };

type SceneTargetContract = {
  version: 1;
  sceneName: AnimationSceneName;
  reachability: SceneReachability;
  expectedHostKind: string;
  requiredTargets: SceneTargetRequirement[];
  optionalTargets: SceneTargetRequirement[];
  timeoutMs: number;
  playbackPolicy: ScenePlaybackPolicy;
  acknowledgmentPolicy: SceneAcknowledgmentPolicy;
  finalStatePolicy: SceneFinalStatePolicy;
  reducedFallback: "semantic-final-state" | "static-reader" | "none";
  replacedBy?: string;
};
```

Every one of the 28 registry entries must carry a contract. Production scenes must have at least one meaningful semantic target. Deprecated scenes may have no required GSAP targets only when their playback policy rejects production requests and names the owning replacement.

Required targets are the minimum readable ceremony or state transition. Fog, sparks, peripheral dimming, ambient particles, secondary fragments, and decorative flicker remain optional. Requirements will not be weakened to keep tests green.

## 6. Host and instance compatibility

Phase 1 play requests add:

```ts
type ScenePlayRequest<T> = {
  root: HTMLElement;
  hostId: string;
  hostKind: string;
  requestSource: "automatic" | "explicit" | "operation" | "replay" | "development";
  eventOrActionId?: string;
  display?: SceneDisplayContext;
  operation?: () => Promise<T>;
  presentationFallback?: PresentationFallbackHandler;
  queue?: boolean;
  signal?: AbortSignal;
};

type PresentationFallbackResult = {
  completed: boolean;
  readable: boolean;
  semanticState?: string;
  fallback?: string;
};

type PresentationFallbackHandler = (
  context: PresentationFallbackContext,
) => PresentationFallbackResult | Promise<PresentationFallbackResult>;
```

The director generates a new `sceneInstanceId` for every play, including replay. The authoritative event ID is never rewritten. The supplied root is the compatibility host boundary. Phase 1 records host identity, scopes target queries to it, rejects stale-instance markers when present, and reports duplicates within it. This does not claim to be the final Phase 2 host architecture.

The fallback callback is an adaptive addition discovered during Director integration. Contract metadata names what is allowed, but metadata alone can never report fallback success. `presented-fallback` requires the callback to complete, verify a readable state, and return its semantic state. An absent, failed, incomplete, or unreadable callback preserves the original typed failure.

## 7. Target observation and visibility

```ts
type SceneTargetElementObservation = {
  connected: boolean;
  rect: { x: number; y: number; width: number; height: number };
  display: string;
  visibility: string;
  effectiveOpacity: number;
  hostIntersection: boolean;
  viewportIntersection?: boolean;
  pageFlipSource: boolean;
  staleSceneInstance: boolean;
  owner?: AnimationRuntimeOwner;
  rejectedOwner?: AnimationRuntimeOwner;
};

type SceneTargetObservation = {
  part: string;
  required: boolean;
  matchedCount: number;
  visibleCount: number;
  duplicateCount: number;
  ownershipRejectedCount: number;
  observations: SceneTargetElementObservation[];
};

type ScenePreflightFailure = {
  part: string;
  code:
    | "missing-required-target"
    | "duplicate-required-target"
    | "disconnected-target"
    | "hidden-target"
    | "zero-box-target"
    | "outside-host"
    | "outside-viewport"
    | "page-flip-source"
    | "stale-scene-instance"
    | "ownership-rejected";
};

type ScenePreflightReport = {
  sceneName: AnimationSceneName;
  sceneInstanceId: string;
  hostId: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  requiredSatisfied: boolean;
  observations: SceneTargetObservation[];
  failures: ScenePreflightFailure[];
};
```

Effective opacity is the product of the target and rendered ancestor opacities up to the host. A target is ineligible when it is disconnected, has a required zero box, is `display:none`, has `visibility:hidden|collapse`, falls below the declared opacity threshold, fails required host/viewport intersection, is a marked hidden PageFlip source, belongs to a stale scene instance, violates cardinality, or cannot obtain the declared property ownership.

Viewport intersection is opt-in. Elements may begin outside the viewport while still being valid when the contract only requires host intersection. Initial opacity may be zero for an authored reveal only when the contract's threshold permits it and a final semantic checkpoint later verifies the readable state; Phase 1 preflight must not call such a target already presented.

## 8. Presentation outcomes and receipts

```ts
type PresentationOutcome =
  | "presented"
  | "presented-fallback"
  | "skipped-by-policy"
  | "skipped-by-user"
  | "aborted"
  | "interrupted"
  | "timed-out"
  | "missing-required-target"
  | "duplicate-required-target"
  | "ownership-rejected"
  | "runtime-failed";

type PresentationReceipt<T = void> = {
  sceneName: AnimationSceneName;
  sceneInstanceId: string;
  hostId: string;
  hostKind: string;
  requestSource: ScenePlayRequest<T>["requestSource"];
  eventOrActionId?: string;
  outcome: PresentationOutcome;
  motionPolicy: ResolvedMotionPolicy;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  semanticLabelsReached: string[];
  targetReport: ScenePreflightReport;
  fallbackUsed?: string;
  interruptionReason?: string;
  finalSemanticState?: string;
  acknowledgmentAllowed: boolean;
  cleanup: "completed" | "completed-with-errors";
  operationResult?: T;
};
```

`AnimationDirector.play()` always resolves a receipt for presentation-terminal states. Authoritative operation failure is recorded as `runtime-failed` and may also be exposed through a sanitized error channel; it must not be mistaken for successful visual presentation. The generic `operationResult` preserves current caller functionality without conflating business truth and presentation truth.

The director determines the outcome from preflight, runtime start, semantic labels, timeout/abort/interruption/skip state, approved fallback, final-state verification, and cleanup. GSAP promise completion alone is insufficient.

## 9. Acknowledgment policy

Four concepts remain distinct:

1. authoritative event receipt;
2. authoritative business state and snapshot reconciliation;
3. presentation attempt and receipt;
4. viewed acknowledgment.

`CHAPTER_RELEASED` uses `kind: "mandatory"` and may acknowledge only `presented`, an approved readable `presented-fallback`, or policy-approved `skipped-by-user` after the readable final state. All target, ownership, runtime, timeout-without-fallback, abort, and unhandled-interruption outcomes remain unacknowledged and retryable.

Snapshot refresh may occur independently, but it never authorizes acknowledgment. While a mandatory ceremony is pending or failed, automatic chapter `ViewedContent` mutation is also suppressed; otherwise snapshot refresh could indirectly mark content viewed.

The viewed endpoint validates that the event exists, belongs to the authenticated campaign, is a released `CHAPTER_RELEASED` event, and is currently eligible before its idempotent upsert. Client receipt data is presentation evidence for UX, not authority to mutate business progression.

## 10. Persisted replay source

No Prisma change is planned. Existing `ProgressEvent` rows contain immutable event identity, campaign, type, payload, sequence, version, and release time; current public snapshot data contains the player-authorized readable chapter.

```ts
type ReplayablePresentation = {
  eventId: string;
  eventType: "CHAPTER_RELEASED";
  sequence: number;
  occurredAt: string;
  sceneName: "chapter-release";
  payloadVersion: number;
  payload: {
    ordinal: number;
    title: string;
    narrative: string;
    objective: string;
    riddle: string;
  };
  replayPolicy: "presentation-only";
};
```

`PublicSnapshot` gains an optional latest replayable chapter presentation built from the latest released, campaign-scoped `CHAPTER_RELEASED` identity plus the currently authorized readable chapter projection. Raw `ProgressEvent.payload` and `CampaignSnapshot.state` are never returned. Sparse historical rows use a typed readable fallback rather than private/raw data.

Replay:

1. reads immutable safe data;
2. preserves the authoritative event ID and payload;
3. creates a new presentation instance ID;
4. uses the current resolved motion policy;
5. temporarily uses the current compatible Journal presentation surface when necessary;
6. performs no command, progress-event, chapter, invitation, presence, preference, or viewed mutation;
7. normalizes initial presentation state;
8. restores the prior section and focus;
9. cleans up owned runtimes.

The current-section limitation remains documented until Phase 3 supplies the persistent global ceremony host.

## 11. Resolved motion policy

```ts
type ResolvedMotionPolicy = {
  level: MotionMode;
  source: {
    productSetting: MotionMode;
    browserPrefersReduced: boolean;
  };
  allowSpatialTravel: boolean;
  allowContinuousAmbientMotion: boolean;
  allowPageCurl: boolean;
  allowRiveStateTravel: boolean;
  allowLottiePlayback: boolean;
  allowMotionCues: boolean;
  durationScale: number;
  distanceScale: number;
  preserveSemanticStaging: true;
};
```

Resolution is strictest-wins: browser reduced always resolves to reduced; product reduced resolves to reduced; otherwise the product full/gentle setting controls. The provider owns one product state and one `matchMedia` subscription. All consumers read the provider context. Motion receives `always` for resolved reduced and `never` otherwise; individual Motion call sites cannot re-enable spatial travel. The provider publishes `data-motion-level` on the document element without requiring edits to the concurrent root layout. Phase 1 CSS selectors use `html[data-motion-level]`; component-local motion attributes may expose state for diagnostics, but they are not independent CSS policy authorities.

The same object is supplied to GSAP scene context, journal durations/timeouts, PageFlip curl/fallback, Rive stable-pose policy, Lottie playback/frame policy, motion-related audio cues, and metrics. Reduced motion preserves semantic order, readable content, focus, controls, status announcements, and acknowledgment policy. It does not mean hidden content.

## 12. Journal phase contracts and outcome

```ts
type JournalPhaseOutcome =
  | { status: "completed"; phase: JournalPhase; finiteAnimationCount: number; durationMs: number }
  | { status: "completed-fallback"; phase: JournalPhase; reason: string }
  | { status: "missing-actor"; phase: JournalPhase; actor: string }
  | { status: "missing-animation"; phase: JournalPhase }
  | { status: "timed-out"; phase: JournalPhase; timeoutMs: number }
  | { status: "aborted"; phase: JournalPhase }
  | { status: "runtime-failed"; phase: JournalPhase; errorCode: string };
```

Each observed phase declares actor selector, actor requirement, expected finite animation, duration by policy, timeout safety margin, reduced/static fallback, and final semantic state. The waiter filters irrelevant descendants, infinite ambient animations, and already-cancelled work; it races finite completion, abort, unmount/cancellation signal, and a phase-derived timeout through one idempotent settlement path.

Missing actor, missing required animation, runtime rejection, timeout, and abort remain distinct. Consumers explicitly decide whether a readable fallback settles to `JOURNAL_READY`. Abort and user skip settle within 100 ms in the unit harness. Unmount removes timers/listeners and does not retain unresolved `animation.finished` promises.

## 13. Reachability disposition

Current revalidation produces:

- 16 `production`
- 4 `legacy`
- 5 `future-contract`
- 3 `deprecated`
- 0 `development-only`

The eight no-production-caller scenes are disposed as follows:

| Scene                    | Disposition       | Reason                                                                                             |
| ------------------------ | ----------------- | -------------------------------------------------------------------------------------------------- |
| `journal-open`           | `deprecated`      | Replaced by the bounded journal opening machine.                                                   |
| `manual-page-flip`       | `deprecated`      | StPageFlip owns manual curl and input physics.                                                     |
| `programmatic-page-flip` | `deprecated`      | StPageFlip owns programmatic movement.                                                             |
| `chapter-heading`        | `future-contract` | No production trigger or scoped host.                                                              |
| `prose-ink`              | `future-contract` | No production trigger or scoped host.                                                              |
| `marker-stamp`           | `future-contract` | Requires a distinct authoritative location event.                                                  |
| `ship-course`            | `future-contract` | Requires authoritative current-position state and a scoped host.                                   |
| `artifact-inspection`    | `future-contract` | Motion owns the shared-element transition; a future contract may target only an inner detail node. |

Showcase availability is harness evidence only. Deprecated scenes are rejected outside development requests, and showcase labels must display reachability.

## 14. Telemetry and privacy

Telemetry is an allowlisted summary, never a serialized request, receipt, DOM node, or event payload. Allowed values are:

- scene, host, scene-instance, and event/action identifiers;
- route template and Player section enum;
- resolved motion level and source booleans;
- outcome, fallback, cleanup, acknowledgment decision;
- target-part names and required/visible/duplicate/rejected counts;
- semantic-label names;
- duration and bounded timing metrics.

Forbidden values include story prose, riddles, unpublished content, invitations/PINs, authentication/session data, raw event/snapshot payloads, DOM/HTML/text, arbitrary URLs/query strings, raw error stacks, and signed asset URLs. Ownership diagnostics log only owner/property/part identifiers, never element objects.

Development/test diagnostics use a bounded in-memory recorder and sanitized console messages. The recorder retains 100 events by default, clamps configured capacity to 250, projects at most 64 target-part summaries and 32 semantic labels per receipt, bounds identifiers/counts/durations, strips route queries, and redacts opaque route segments. Recording is observational: subscriber failure cannot alter presentation truth. Production users receive only a readable fallback or safe error code.

## 15. Compatibility and Phase 2 transition

Phase 1 compatibility rules:

- keep current scene builders and declarative registry;
- attach contracts centrally rather than mechanically rewriting every builder;
- scope preflight to the supplied current root;
- require explicit `hostId` and `hostKind` at direct callers;
- retain authoritative operation results in receipts;
- reject false production use of deprecated scenes;
- use static readable fallbacks when current broad roots cannot satisfy truthful targets;
- do not claim that Phase 1 root scoping solves all stale-instance or cross-section hosting.

Phase 2 can introduce dedicated `SceneHost` wrappers, instance attributes, property-owner wrappers, and PageFlip source/clone boundaries while consuming these same contracts and receipts. Phase 3 can move Player ceremonies to the persistent global host without changing event identity, acknowledgment policy, or replay source.

The audit limitation `AL-003` remains explicit. Phase 1 prevents the non-looping ink-bloom Lottie from autoplaying on mount and exposes a tested commanded one-shot runtime contract, but `JournalWorkspace` does not yet issue that command from the production semantic ink label. The wrapper behavior is implemented; production semantic trigger wiring is not claimed complete and remains later-phase work.

## 16. Execution dependency graph (implementation record)

```text
P0 repository and Git preflight
|-- R1 governing documents ------------------\
|-- R2 current animation architecture --------+-- D1 this frozen design record
|-- R3 Player persistence/ack/replay ----------+
|-- R4 Journal/motion -------------------------+
|-- R5 registry/reachability ------------------+
|-- R6 privacy/security -----------------------+
`-- R7 tests/runtime safety ------------------/
                                                |
                                                +-- W1 shared contracts/director/registry
                                                |    |-- W2 target integrity
                                                |    |-- W3 Journal lifecycle
                                                |    |-- W4 resolved motion provider
                                                |    `-- W5 replay projection/security
                                                |             |
                                                |             `-- W6 Player integration
                                                `------------------ I1 coordinator integration
                                                                         |
                                                                         V1 focused validation
                                                                         |
                                                                         V2 isolated browser/full gate
                                                                         |
                                                                         F1 docs/chat synchronization
```

The implementation followed the critical path D1 -> W1 -> W6 -> I1 -> V1/V2 -> F1. Target, Journal, motion, and replay projection work proceeded under non-overlapping ownership after W1 froze the source interfaces. Integrated validation and evidence reconciliation are complete; the remaining critical-path step is the coordinator-owned chat/development-document synchronization.

## 17. Workstream and file ownership record

| Lane                | Read/write            | Owned paths or concern                                                                                      | Dependency | Completion evidence                                |
| ------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------- |
| W1 architecture     | write, serialized     | `animation-types.ts`, `AnimationDirector.ts`, `scene-registry.ts`, `scene-utils.ts`, shared contracts/tests | D1         | typecheck and focused director/registry tests      |
| W2 target integrity | write                 | target preflight module/tests; structured ownership observations                                            | W1         | 15 required visibility/cardinality cases           |
| W3 Journal          | write                 | `opening-machine.ts` and focused tests                                                                      | W1         | typed bounded outcomes; abort budget               |
| W4 motion           | write                 | provider, motion hook/quality and focused tests; runtime adapters only if needed                            | W1         | M1-M5 resolver/provider proof                      |
| W5 replay/security  | write                 | public replay projection, sanitizer, snapshot/viewed route and focused tests                                | W1         | no schema change; safe projection/route validation |
| W6 Player           | write, serialized     | `PlayerExperience.tsx` and focused component tests                                                          | W1 and W5  | receipt-gated ack, retry, persisted replay         |
| I1 integration      | write, coordinator    | shared consumer migrations, showcase labels, docs                                                           | W2-W6      | complete diff review and integrated typecheck      |
| V1/V2 validation    | exclusive             | tests, browser, database copy, ports 3100/3200, full gate                                                   | I1         | exact exit statuses and isolation proof            |
| F1 finalization     | exclusive coordinator | chat/docs synchronizer                                                                                      | validation | dry-run, sync, validate, remote report             |

Exactly one agent writes a file at a time. `PlayerExperience.tsx` is never split across replay and acknowledgment lanes. `src/app/layout.tsx`, `src/styles/tokens.css`, the existing shell/platform/landing/Studio/Tall Tale changes, Prisma schemas, manifests/lockfiles, generated files, port 3000, and canonical local database are forbidden unless the coordinator explicitly records a new handoff.

## 18. Shared resources and runtime strategy

| Resource                      | Owner                      | Rule                                                                                                  |
| ----------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Port 3000 / normal dev server | none during implementation | Inspect only; do not stop an unknown owner.                                                           |
| Playwright port 3100          | final validation owner     | One isolated server and database only.                                                                |
| Production proof port 3200    | final validation owner     | Used once through repository validation.                                                              |
| Browser                       | final validation owner     | One stateful mutation controller; read-only shards only when isolated.                                |
| Database/seed                 | final validation owner     | Unique copied SQLite database, absolute URL, nonce proof, canonical hash/size/mtime before and after. |
| Prisma                        | no writer planned          | Existing records are sufficient; no migration.                                                        |
| Manifests/lockfile            | no writer planned          | No new dependency is required.                                                                        |
| Full build/E2E/validate       | final validation owner     | Deduplicated and serialized.                                                                          |
| Chat/docs synchronization     | coordinator                | Run once after all workers finish.                                                                    |

Direct `npm run test:e2e` is not accepted as safe mutation evidence until the request's database identity proof is implemented. A worktree or alternate port alone is insufficient.

## 19. Testing strategy

| Layer            | Focus                                                                         | Parallelism                                  | Required treatment                         |
| ---------------- | ----------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------ |
| Type/lint/format | frozen interfaces and integrated source                                       | focused during lanes; full once              | failures classified, never hidden          |
| Unit/component   | target truth, receipts, Journal, motion, replay, acknowledgment, reachability | independent files may run concurrently       | exact pass/fail/skipped counts             |
| Assets           | existing contracts only                                                       | serialized with final checks                 | no false production Rive claim             |
| API/data         | sanitizer, latest replay source, viewed validation                            | focused, no live DB mutation unless isolated | privacy sentinels and campaign/type checks |
| Browser          | selected Phase 1 flows only                                                   | one mutation owner                           | compliant database proof first             |
| Build            | integrated production build                                                   | once                                         | exact exit status                          |
| Full repository  | `npm run validate`                                                            | once                                         | integrated state only                      |

Phase 1 does not claim the complete 102 event/section matrix. It does require focused proof for successful and missing-target chapter release, failed acknowledgment, approved fallback, refresh replay, zero-mutation replay, browser reduced motion, and safe affected access transitions when the isolated runtime is available.

## 20. Assumptions and unknowns

| ID  | Assumption or unknown                                                       | Impact                                                    | Verification                                                                                              | Status                                                                                            |
| --- | --------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A1  | Current 28-scene registry remains unchanged during implementation.          | Contract count/callers change.                            | Re-scan registry before integration.                                                                      | Verified at preflight.                                                                            |
| A2  | Existing `ProgressEvent` plus public snapshot is sufficient for replay.     | A migration might be needed.                              | Unit projection and historical sparse-payload fallback tests.                                             | Supported; no migration planned.                                                                  |
| A3  | Current broad roots can satisfy every production target contract.           | Some scenes will truthfully fall back/fail until Phase 2. | Focused DOM and browser fixtures.                                                                         | Compatibility roots remain deliberate; truthful fallback/failure is preserved.                    |
| A4  | Concurrent shell work remains out of Phase 1 files.                         | File ownership collision.                                 | Recheck status before each write handoff.                                                                 | Active risk.                                                                                      |
| A5  | Mutation E2E requires explicit database identity and canonical-state proof. | Unsafe mutation E2E must fail closed.                     | Isolated copy, nonce identity route, absolute URL, mutation observation, canonical hash/size/mtime proof. | Verified by the successful final validation gate; the canonical SQLite family remained unchanged. |

## 21. Risk register

| ID  | Risk                                                               | Probability | Impact   | Mitigation / recovery                                                            | Owner                    | Status                                                                  |
| --- | ------------------------------------------------------------------ | ----------- | -------- | -------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------- |
| K1  | Concurrent shell work overwritten or staged.                       | Medium      | High     | Path ownership, recheck hashes/status, path-scoped diffs/staging only.           | Coordinator              | Open                                                                    |
| K2  | Strict targets expose current broad-host failures.                 | High        | High     | Truthful typed failure/readable fallback; defer dedicated hosts to Phase 2.      | Architecture/Player      | Mitigated by typed outcomes; Phase 2 host work remains.                 |
| K3  | Player acknowledgment still leaks through chapter `ViewedContent`. | Medium      | High     | Gate both ceremony and content-view paths while mandatory attempt is unresolved. | Player                   | Implemented; focused and isolated browser gates passed.                 |
| K4  | Replay projection exposes private payload.                         | Medium      | High     | Allowlisted typed composition; sentinel tests; never return raw rows.            | Replay/security          | Implemented and focused-tested.                                         |
| K5  | Journal promises/timers survive abort.                             | High        | High     | Idempotent race/cleanup; under-100-ms tests.                                     | Journal                  | Unit and isolated browser cleanup proofs passed.                        |
| K6  | Motion provider conflicts with concurrent layout/tokens.           | Medium      | Medium   | Publish root attribute inside provider; avoid concurrent files.                  | Motion/coordinator       | Resolved through provider-owned root attribute.                         |
| K7  | E2E touches canonical database.                                    | Medium      | Critical | Fail-closed unique copy/absolute URL/nonce/hash proof; no mutation otherwise.    | Validation               | Mitigated and verified; the canonical SQLite family remained unchanged. |
| K8  | Operation result migration breaks GM callers.                      | Medium      | High     | Generic receipt retains `operationResult`; migrate direct callers and tests.     | Architecture/integration | Implemented and focused-tested.                                         |
| K9  | Runtime semantics differ from JSDOM.                               | Medium      | High     | Add real-browser WAAPI/media/unmount proof after isolation.                      | Validation               | Real-browser cases passed in the isolated final gate.                   |
| K10 | Documentation marks future phases complete.                        | Low         | High     | Update only implemented Phase 1 rows and limitations.                            | Coordinator              | Mitigated; AL-003 and Phase 2-6 non-scope remain explicit.              |

## 22. Decision log

| ID  | Decision                                                                            | Evidence / reason                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | No Prisma migration for Phase 1 replay.                                             | Existing immutable `ProgressEvent` identity plus authorized public snapshot is sufficient.                                                                                   |
| D2  | Use a generic `PresentationReceipt<T>` with `operationResult`.                      | Preserves current operation callers while separating presentation truth.                                                                                                     |
| D3  | Provider owns resolved motion; no root-layout edit initially.                       | Eliminates per-consumer authority while preserving concurrent shell work.                                                                                                    |
| D4  | Three deprecated and five future contracts among the eight unreachable scenes.      | Current caller and runtime ownership revalidation.                                                                                                                           |
| D5  | Snapshot carries latest replayable chapter presentation.                            | Existing authenticated, private, read-only route; avoids a raw-event endpoint.                                                                                               |
| D6  | Both ceremony and content viewed mutations are gated.                               | Snapshot refresh currently can mark chapter content viewed independently.                                                                                                    |
| D7  | Phase 1 keeps compatibility roots and documents limitations.                        | Full persistent/global host is an explicit non-goal.                                                                                                                         |
| D8  | Approved fallback is an explicit verified callback, not registry metadata alone.    | The Director needs evidence that a readable semantic state actually completed before returning `presented-fallback`.                                                         |
| D9  | Structured presentation telemetry is a bounded projection, not serialized receipts. | Default 100 / maximum 250 events and 64 target / 32 label caps prevent unbounded retention while allowlists and redaction preserve privacy.                                  |
| D10 | `html[data-motion-level]` is the single CSS motion authority.                       | One provider-resolved policy prevents browser, product, runtime, and stylesheet motion decisions from diverging.                                                             |
| D11 | Validation must prove runtime and database ownership before mutation E2E.           | A unique copied database, nonce-backed identity route, owned port/process tree, mutation observation, and canonical before/after fingerprint make the safety claim testable. |

## 23. Discovery log

| ID  | Finding                                                                                        | Plan effect                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| X1  | Source is unchanged from audit baseline; only audit documents were added in committed history. | Audit defects remain valid but current code is revalidated.                                                                  |
| X2  | Worktree contains divergent unified-shell work.                                                | Preserve 36 pre-existing paths; avoid layout/tokens collision.                                                               |
| X3  | Reconciliation ledger is absent; source has 238 complete OA items.                             | Preserve requirements; do not perform broad reconciliation.                                                                  |
| X4  | Current showcase omits two registered scenes and labels no reachability.                       | Add reachability truth without treating showcase as production proof.                                                        |
| X5  | Viewed endpoint does not validate event ownership/type/release eligibility.                    | Include defense-in-depth route hardening.                                                                                    |
| X6  | Baseline mutation E2E configuration lacked requested DB identity proof.                        | The fail-closed isolated runtime/database wrapper passed the final gate and preserved the canonical SQLite family unchanged. |

## 24. Failure recovery

- A failed implementation lane returns its partial diff, tests, blocker, and ownership release; independent lanes continue.
- Interface conflict returns to the architecture owner before consumers are changed.
- Unexpected overlap with concurrent work stops the affected writer; the coordinator compares both changes and preserves both.
- A failed focused test is classified as task regression, pre-existing, environmental, intermittent, or unresolved; evidence is retained.
- Database identity mismatch immediately stops mutation testing. Canonical state is rechecked; no assumption of safety is permitted.
- No failed lane triggers reset, clean, stash-all, or restart of completed work.

## 25. Completion gate

Phase 1 is complete only when all 28 scenes carry truthful target/reachability/policy contracts; director receipts cannot report `presented` for missing, hidden, duplicate, off-host, stale, or ownership-rejected required targets; mandatory chapter release acknowledgment is receipt-gated and retryable; replay survives refresh with immutable identity and no mutation; Journal waits are bounded and abortable; one provider-resolved motion policy reaches every Phase 1 runtime interface; deprecated/future scenes are not reported as production complete; focused and integrated validation are complete or explicitly blocked with evidence; concurrent work is preserved; governing documents reflect implemented truth; and repository chat/development-document synchronization has passed.

Current outcome: the implementation and acceptance gate are complete. `npm run validate` exited 0 with 46 Vitest files / 304 tests, 27 Playwright passes / 17 intentional skips, successful asset, seeded-database, backfill, accepted-history, launcher-preservation, production-build, and restart checks, and successful isolated-database proof with the canonical SQLite family unchanged. At this documented pre-finalization checkpoint, the mandatory coordinator-owned development-document and chat synchronization had not yet run; repository finalization is therefore reported separately by the synchronizer and final task handoff rather than claimed by this design record.

Phase 1 stops after review. It does not begin Phase 2 or any Phase 3-6 work, implement production Rive artwork, expand platform motion, add the 238 missing animations, or perform final visual/performance tuning.
