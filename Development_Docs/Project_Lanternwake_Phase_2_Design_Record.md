# Project Lanternwake Phase 2 Design Record

Status: Approved architecture; Phase 1 baseline gate completed as recorded in section 3  
Program: Project Lanternwake  
Phase: Phase 2: Claim the Deck  
Formal scope: Runtime Ownership, Scene Scoping, and Animation Boundary Enforcement  
Branch: `codex/project-lanternwake-phase-2-claim-the-deck`  
Design worktree base: synchronized `fb8eb4ac33f4a44028fe82fb08df0ac0e5021db6` plus the hash-matched validated Phase 1 working-tree snapshot  
Date: 2026-07-18

This record freezes the shared Phase 2 architecture before component migrations begin. It extends the typed presentation truth established by Phase 1; it does not create a second director, target-contract system, motion policy, replay source, acknowledgment path, or telemetry stream.

## 1. Decision summary

Claim the Deck establishes two enforceable invariants:

1. Every scene invocation resolves targets only through one registered `SceneHost` and explicit external handles.
2. Every actively animated property group on an element has exactly one permitted runtime owner.

The implementation will therefore:

- place host, target, external-handle, ownership, and diagnostic registries inside one `AnimationProvider` instance;
- separate the lifetime of a mounted host from the identity of each scene invocation;
- upgrade target contracts to version 2 with `expectedHostKinds`, qualified target sources, and exact cardinality;
- resolve registered targets in one host-local pass and give runtimes only validated target handles;
- require a non-forgeable write permit before an animation adapter can write a claimed property group;
- treat Motion, CSS animation, PageFlip, Rive, Lottie, Web Animations, React transitions, and dnd-kit as participants in the same ownership model as GSAP;
- reconcile semantic final state before cleanup may revert temporary presentation state;
- distinguish hidden PageFlip sources, current visible clones, and stale clones by code-enforced identity;
- preserve the exact 28-scene reachability disposition: 16 production, 4 legacy, 5 future contracts, and 3 deprecated;
- preserve all 220 Codex requirements and all 238 OA requirements, with 97 OA mappings to existing matrix rows and 141 dedicated specificity-preserving rows;
- stop after Phase 2 validation and synchronization; Phase 3 does not begin automatically.

Static `data-*` attributes remain useful diagnostics. They are never authority for host membership, invocation identity, target validity, external-handle validity, or ownership.

## 2. Why the current compatibility boundary is insufficient

Phase 1 truthfully scopes preflight to a caller-supplied root, but a Player or Quartermaster application root is still too broad. It can contain permanent section content, a temporary event overlay, hidden PageFlip sources, current PageFlip clones, stale clones, and repeated semantic part names at the same time. A broad selector can then make DOM order choose an artifact, route, marker, quest, or log entry. It can also let one event satisfy another event's target contract.

Application-root querying is unsafe because application roots describe product ownership, not cinematic lifetime. They survive route and section changes, contain nested animation systems, and do not distinguish live playback from replay. Phase 2 replaces that compatibility boundary with a mounted local host and a new immutable invocation for every play.

Duplicate part names are valid across hosts. `route-path` in Host A and `route-path` in Host B are unrelated records because their qualified identities include provider, host, target, and generation. No resolver falls back to the nearest DOM match or the first element in document order.

## 3. Sources and completed Phase 1 dependency gate

The governing sources are the full audit, audit matrix, roadmap, test plan, KG original audit source, Phase 1 design record, and the final synchronized Phase 1 evidence embedded across those artifacts. The historical audit baseline is `4dbe8c0ae2fbab2785d1d3f26b8d7ba33bf56aee`; implementation targets the current checkout rather than restoring historical source. A separate Phase 1 implementation report and validation report were not authored; the synchronized full audit, matrix, roadmap, test plan, and design record are the authoritative equivalent evidence. The OA reconciliation ledger is a Phase 2 deliverable and therefore did not exist at this gate.

The Phase 1 task completed and was reread before Phase 2 source implementation. Its authoritative `npm run validate` exited 0 with 46 Vitest files / 304 tests, 27 Playwright passes / 17 intentional skips, zero failures, and zero blockers. Assets, seeded database, backfill, accepted-history preservation, launcher preservation, production build/restart, owned-process cleanup, and canonical-database isolation passed. The required chat/development-document synchronization committed and verified `origin/main` at `fb8eb4ac33f4a44028fe82fb08df0ac0e5021db6`.

Phase 1 intentionally left its validated application implementation as a preserved working-tree snapshot. The coordinator fast-forwarded this isolated branch to `fb8eb4a`, copied the 67 tracked and 39 untracked Phase 1 paths without staging or changing `main`, and verified SHA-256 equality for all 106 paths. The final Phase 1 interfaces confirm the compatibility assumptions in this record: target contracts, structured preflight and receipts, playback/acknowledgment/final-state policies, resolved motion policy, bounded Journal outcomes, reachability metadata, and persisted presentation replay are present. The dedicated Phase 2 host, instance, ownership, PageFlip, and zero-loss requirements remain unimplemented and correctly belong to this phase.

The dependency gate is therefore complete. Phase 2 may implement against this exact snapshot. Any later source change from another task must be reconciled explicitly; no writer may silently restore the older design base or weaken the final Phase 1 evidence.

## 4. Authority and lifetime model

One `AnimationProvider` owns one provider-scoped authority bundle:

```ts
type AnimationAuthority = {
  providerId: AnimationProviderId;
  hosts: SceneHostRegistry;
  externalTargets: ExternalSceneTargetRegistry;
  ownership: AnimationOwnershipRegistry;
  diagnostics: SceneHostDiagnostics;
};
```

There are no module-global host, target, handle, claim, or diagnostic registries. A handle minted by one provider is rejected by another provider. Provider unmount aborts active invocations, completes policy-safe cleanup, releases claims and handles, unregisters hosts, and drops all retained DOM references.

The lifetimes are deliberately different:

| Lifetime         | Object                                      | Begins                                    | Ends                                               |
| ---------------- | ------------------------------------------- | ----------------------------------------- | -------------------------------------------------- |
| Provider         | `AnimationAuthority`                        | `AnimationProvider` mount                 | provider unmount                                   |
| Mounted boundary | `SceneHostRegistration` / `SceneHostHandle` | host ref becomes connected                | host unmount or explicit release                   |
| Invocation       | `SceneInvocationHandle`                     | director accepts one play request         | terminal receipt and cleanup                       |
| Target           | `SceneTargetHandle`                         | target ref registers in a host generation | target unmount, generation change, or host release |
| External bridge  | `ExternalSceneTargetHandle`                 | owning registry grants an export          | scene/handoff completion or explicit revocation    |
| Property write   | `AnimationWritePermit`                      | atomic claim grant                        | claim release, abort, interruption, or cleanup     |

Host identity answers “where may a scene operate?” Scene-instance identity answers “which exact play owns this work?” Replaying the same persisted event reuses the authoritative event ID but always receives a new instance ID and invocation sequence.

## 5. Frozen identities and `SceneHostKind`

Opaque branded IDs prevent accidental interchange:

```ts
type AnimationProviderId = string & { readonly __brand: "AnimationProviderId" };
type SceneHostId = string & { readonly __brand: "SceneHostId" };
type SceneInstanceId = string & { readonly __brand: "SceneInstanceId" };
type SceneTargetId = string & { readonly __brand: "SceneTargetId" };
type ExternalSceneTargetId = string & { readonly __brand: "ExternalSceneTargetId" };
type OwnershipClaimId = string & { readonly __brand: "OwnershipClaimId" };

type SceneHostKind =
  | "gateway"
  | "access"
  | "player-progression"
  | "player-section-enhancement"
  | "journal-opening"
  | "quartermaster-command"
  | "platform-ceremony"
  | "development-showcase";
```

Only registry factories mint these identities. The required host categories are closed for Phase 2 so later phases consume one architecture. A new category requires a reviewed contract change, not an arbitrary string at a call site.

`SceneInstanceId` is opaque and unique. Its diagnostic projection includes scene name, event/action key, playback kind (`live`, `replay`, or `development`), monotonic host-local invocation sequence, and an unguessable suffix. Timestamps, React indexes, scene names, and host IDs are never sufficient identity by themselves. Raw event or action payloads are not embedded.

## 6. `SceneHost`, registration, and host handle

`SceneHost` is the React boundary that registers one connected root with provider authority and supplies its mounted-host handle through context.

```ts
type OwnershipScope = Readonly<{
  providerId: AnimationProviderId;
  hostId: SceneHostId;
  boundary: "host" | "invocation" | "handoff";
}>;

type SceneHostRegistration = Readonly<{
  providerId: AnimationProviderId;
  hostId: SceneHostId;
  kind: SceneHostKind;
  root: HTMLElement;
  ownershipScope: OwnershipScope;
  generation: number;
}>;

type SceneHostHandle = Readonly<{
  providerId: AnimationProviderId;
  hostId: SceneHostId;
  kind: SceneHostKind;
  generation: number;
  beginScene(request: SceneInvocationRequest): SceneInvocationHandle;
  registerTarget(input: SceneTargetRegistration): SceneTargetHandle;
  exportTarget(input: ExternalTargetExportRequest): ExternalSceneTargetHandle;
  snapshot(): SceneHostDiagnosticSnapshot;
  release(): void;
}>;
```

The registration is the internal connected-root record. The handle is the opaque mounted-host capability. Neither contains a current scene name or scene instance because one mounted host can run sequential invocations and, when policy permits, isolated concurrent invocations.

Nested hosts are supported. React context binds a target to the nearest `SceneHost`. A parent host cannot resolve a nested host's targets even though the nested DOM lies under the parent root. Duplicate host IDs within one provider are rejected; duplicate IDs in separate providers remain isolated. Releasing a host is idempotent and aborts only that host's active invocations.

## 7. Immutable scene invocation

The director creates one immutable invocation after validating the requested scene against the mounted host kind:

```ts
type SceneInvocationRequest = Readonly<{
  sceneName: AnimationSceneName;
  eventOrActionId?: string;
  playback: "live" | "replay" | "development";
  targetContract: SceneTargetContractV2;
  motionPolicy: ResolvedMotionPolicy;
  signal?: AbortSignal;
}>;

type SceneInvocationHandle = Readonly<{
  providerId: AnimationProviderId;
  hostId: SceneHostId;
  hostKind: SceneHostKind;
  hostGeneration: number;
  instanceId: SceneInstanceId;
  sceneName: AnimationSceneName;
  eventOrActionId?: string;
  playback: "live" | "replay" | "development";
  invocationSequence: number;
  targetContract: SceneTargetContractV2;
  ownershipScope: OwnershipScope;
  resolveTargets(): SceneTargetResolutionReceipt;
  claim(request: AnimationOwnershipClaimRequest): AnimationOwnershipClaimResult;
  complete(result: SceneInvocationCompletion): Promise<PresentationReceipt>;
  abort(reason: SceneInterruptionReason): Promise<PresentationReceipt>;
}>;
```

All director, resolver, ownership, metric, final-state, cleanup, interruption, replay, and test operations carry `SceneInstanceId`. If the host generation or invocation identity no longer matches, target resolution fails with `target-stale-instance`; it never silently rebinds.

## 8. Version 2 target contracts

Phase 2 upgrades the Phase 1 contract without changing presentation or acknowledgment truth:

```ts
type SceneTargetSource = { kind: "host" } | { kind: "external"; handleKey: string };

type SceneTargetRequirementV2 = Readonly<{
  key: string;
  part: ScenePartName;
  source: SceneTargetSource;
  required: boolean;
  cardinality: { min: number; max: number };
  visibility: SceneVisibilityRule;
  owner: AnimationRuntimeOwner;
  properties: readonly AnimatedProperty[];
}>;

type SceneTargetContractV2 = Readonly<{
  version: 2;
  sceneName: AnimationSceneName;
  reachability: SceneReachability;
  expectedHostKinds: readonly SceneHostKind[];
  targets: readonly SceneTargetRequirementV2[];
  timeoutMs: number;
  playbackPolicy: ScenePlaybackPolicy;
  acknowledgmentPolicy: SceneAcknowledgmentPolicy;
  finalStatePolicy: SceneFinalStatePolicyV2;
  cleanupPolicy: SceneCleanupPolicy;
  reducedFallback: "semantic-final-state" | "static-reader" | "none";
  replacedBy?: string;
}>;
```

`expectedHostKinds` replaces the singular free-form Phase 1 `expectedHostKind`. Every allowed kind is explicit. Production contracts may use only the eight frozen host kinds. Target keys are unique per contract and allow the same part to be requested for different roles without using DOM order.

A Phase 1 v1 adapter may translate one verified legacy host kind and split required/optional arrays into `targets`, but it cannot broaden an unknown kind, infer an external handle, weaken cardinality, or make deprecated work production-reachable. All 16 production scenes must use native v2 contracts before the compatibility adapter can be disabled for production playback.

## 9. Host-local target registration and resolution

Production v2 scenes do not call `document.querySelector`, `document.querySelectorAll`, query an application role root, or re-query raw DOM after preflight. A target registers by callback ref with its nearest host:

```ts
type SceneTargetRegistration = Readonly<{
  targetId: SceneTargetId;
  part: ScenePartName;
  element: HTMLElement;
  ownerHint?: AnimationRuntimeOwner;
  allowedProperties: readonly AnimatedProperty[];
  pageFlip?: PageFlipTargetIdentity;
}>;

type SceneTargetHandle = Readonly<{
  providerId: AnimationProviderId;
  hostId: SceneHostId;
  hostGeneration: number;
  targetId: SceneTargetId;
  part: ScenePartName;
  targetGeneration: number;
}>;
```

The raw element remains private to provider runtime adapters. A scene receives handles and structured observations, not a selector string that a builder can run again.

At invocation preflight the resolver takes one snapshot of the host's registered targets, qualifies every candidate once, and caches the exact accepted handle set on the invocation. It verifies:

1. provider, host, host generation, and scene instance;
2. connectedness and containment in the registered host root;
3. nearest-host ownership, excluding nested hosts;
4. target and PageFlip generation;
5. contract part, source, cardinality, and allowed property set;
6. required visibility, non-zero geometry, and effective opacity;
7. PageFlip source/current-clone rules;
8. current ownership compatibility.

Optional rejected candidates never return to a builder through a later raw query. Required failure makes presentation fail or invoke only a contract-approved readable fallback. Exact failure codes are:

```text
target-not-found
target-outside-host
target-hidden
target-zero-box
target-duplicate
target-stale-instance
target-source-tree
target-wrong-owner
target-disconnected
target-contract-mismatch
```

The resolution receipt records candidate count, accepted target IDs, rejection codes, required/optional status, visibility result, and cardinality result. It contains no DOM nodes, HTML, text, or secret content.

## 10. Explicit external target handles

Cross-tree continuity is capability-based. A scene cannot export an arbitrary element or select a destination with a broad query. The owning host registry validates and mints the handle:

```ts
type ExternalSceneTargetHandle = Readonly<{
  providerId: AnimationProviderId;
  externalTargetId: ExternalSceneTargetId;
  sourceHostId: SceneHostId;
  sourceHostGeneration: number;
  targetId: SceneTargetId;
  targetGeneration: number;
  destinationHostId?: SceneHostId;
  allowedProperties: readonly AnimatedProperty[];
  lifetime: "scene" | "handoff";
  expiresAfterInstanceId?: SceneInstanceId;
}>;
```

The consumer must declare an `external` target requirement and pass the matching handle key in the play request. Resolution rejects a disconnected element, revoked or expired handle, stale source generation, wrong provider, wrong destination host, wrong target identity, or property outside the exported allowlist. Scene cleanup revokes `scene` handles. Final-state reconciliation explicitly completes or revokes `handoff` handles.

Artifact award, artifact connection, marker stamp, route reveal, ship movement, log insertion, and finale requirement transfer will pass named source and destination handles. No fallback selects the first artifact slot, marker, route, quest, or log entry in DOM order.

## 11. Runtime owners, properties, and ownership groups

```ts
type AnimationRuntimeOwner =
  | "gsap"
  | "motion"
  | "css"
  | "page-flip"
  | "rive"
  | "lottie"
  | "web-animations"
  | "react"
  | "dnd-kit";

type AnimatedProperty =
  | "transform"
  | "translate"
  | "scale"
  | "rotate"
  | "opacity"
  | "layout"
  | "clip-path"
  | "filter"
  | "width"
  | "height"
  | "path-drawing"
  | "stroke-dasharray"
  | "stroke-dashoffset"
  | "scroll-position"
  | "visibility";

type PropertyOwnershipGroup =
  | "spatial-transform"
  | "presence"
  | "geometry"
  | "clipping"
  | "filtering"
  | "path-drawing"
  | "scroll";
```

The frozen normalization is:

| Group               | Properties                                        | Important conflicts                                                                                                 |
| ------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `spatial-transform` | transform, translate, scale, rotate, layout       | Motion layout/layoutId, GSAP transforms, PageFlip curl transforms, and dnd-kit drag transforms conflict on one node |
| `presence`          | opacity, visibility                               | Motion presence and GSAP opacity conflict during the same lifecycle                                                 |
| `geometry`          | width, height                                     | active layout/size interpolation has one owner                                                                      |
| `clipping`          | clip-path                                         | cinematic reveal has one active writer                                                                              |
| `filtering`         | filter                                            | filter animation has one active writer                                                                              |
| `path-drawing`      | path-drawing, stroke-dasharray, stroke-dashoffset | aliases normalize to one SVG drawing group                                                                          |
| `scroll`            | scroll-position                                   | programmatic scroll has one active owner                                                                            |

Static CSS or React-rendered semantic state is not an active animation claim. A CSS transition/keyframe, React transition driver, or imperative style interpolation is an active claim. PageFlip owns physical page wrapper transforms; Rive and Lottie own their internal rendered state and must separately claim any container property they animate.

Web Audio remains scene metadata because it does not own DOM properties.

## 12. Claims, atomicity, and write permits

```ts
type AnimationOwnershipClaim = Readonly<{
  claimId: OwnershipClaimId;
  providerId: AnimationProviderId;
  hostId: SceneHostId;
  sceneInstanceId: SceneInstanceId;
  targetId: SceneTargetId;
  runtime: AnimationRuntimeOwner;
  properties: readonly AnimatedProperty[];
  groups: readonly PropertyOwnershipGroup[];
  scope: OwnershipScope;
  startedAt: number;
  status: "active" | "released" | "expired";
}>;

type AnimationOwnershipClaimResult =
  | {
      status: "granted";
      claim: AnimationOwnershipClaim;
      permit: AnimationWritePermit;
    }
  | {
      status: "rejected";
      requestedTargetId: SceneTargetId;
      property: AnimatedProperty;
      group: PropertyOwnershipGroup;
      requestedOwner: AnimationRuntimeOwner;
      existingOwner: AnimationRuntimeOwner;
      existingSceneInstanceId?: SceneInstanceId;
      reason: AnimationOwnershipConflictReason;
    };
```

An `AnimationWritePermit` is an opaque registry token tied to the exact claim, target generation, runtime, properties, and invocation. It is not serializable or constructible by a scene. GSAP, Motion, CSS, PageFlip, Rive, Lottie, Web Animations, React-transition, and dnd-kit adapters require a live permit before applying a property-writing configuration.

Claims for all targets and groups required by one scene step are acquired atomically: either the complete set is granted or every provisional claim rolls back. A compatible repeat claim is allowed only for the same runtime, scene instance, target generation, and group; it is reference-counted under the same claim. A different runtime, scene, or generation is rejected. There is no stealing, warning-and-continuing, or cross-runtime release.

When a required claim is rejected:

- the target is not passed to the runtime adapter;
- no tween, variant, CSS class, drag transform, or runtime state write is created for it;
- preflight records `ownership-rejected`;
- the scene returns a typed failure unless its contract authorizes and verifies a readable fallback;
- mandatory presentation remains unacknowledged.

Release is idempotent and covers success, failure, skip, timeout, interruption, abort, fallback, target unmount, host unmount, provider unmount, and route change. A bounded stale sweep may remove only disconnected targets or claims whose invocation is terminal. It may never release a connected live claim to make another claim pass. Diagnostics expose counts and identifiers but do not retain elements.

## 13. Motion, CSS, PageFlip, and drag integration

Runtime responsibilities are separated structurally:

```tsx
<motion.div data-motion-layout-wrapper>
  <div aria-hidden="true" data-gsap-cinematic-child />
</motion.div>
```

Motion continues to own list/card/shared layout, presence, dialogs, tabs, filters, section transitions, form state, and ordinary interaction feedback. GSAP owns bounded narrative sequences, SVG drawing, motion paths, and server-synchronized ceremonies. CSS owns materials and static states, claiming only active transitions or keyframes. PageFlip owns the physical curl. dnd-kit owns the draggable transform for the duration of drag.

The same node may not combine:

- Motion `layout` or `layoutId` with a GSAP spatial transform;
- Motion presence opacity with GSAP opacity in the same lifecycle;
- dnd-kit drag transform with Motion or GSAP transform during drag;
- PageFlip wrapper transform with Motion or GSAP transform;
- a Rive/Lottie container property with another runtime unless the properties normalize to different groups.

Diagnostic owner attributes mirror granted claims only. They do not grant or preserve ownership.

## 14. Final-state handoff and cleanup

Phase 2 uses canonical policy names and maps Phase 1 aliases without changing their meaning:

```ts
type SceneFinalStatePolicyV2 =
  | { kind: "revert-immediately" }
  | { kind: "hold-final-until-unmount"; semanticState: string }
  | { kind: "commit-final-state"; semanticState: string }
  | { kind: "reconcile-then-revert"; semanticState: string; handoffTargetKey: string }
  | { kind: "fallback-to-static-state"; semanticState: string; fallback: string };

type SceneFinalStateHandoff = Readonly<{
  sceneInstanceId: SceneInstanceId;
  policy: SceneFinalStatePolicyV2;
  semanticState: string;
  handoffTargetId?: ExternalSceneTargetId;
  begin(): Promise<SceneFinalStateHandoffReceipt>;
}>;

type SceneCleanupPolicy = Readonly<{
  cleanupTimeoutMs: number;
  onHandoffFailure: "hold-safe-pose" | "render-static-fallback" | "report-failure";
  releaseOrder: readonly [
    "runtime-resources",
    "temporary-styles",
    "external-handles",
    "ownership-claims",
    "target-handles",
    "invocation-registration",
  ];
}>;
```

Compatibility mapping:

| Phase 1                    | Phase 2 canonical name     |
| -------------------------- | -------------------------- |
| `revert-immediately`       | `revert-immediately`       |
| `hold-until-unmount`       | `hold-final-until-unmount` |
| `commit-semantic-pose`     | `commit-final-state`       |
| `reconcile-then-revert`    | `reconcile-then-revert`    |
| `readable-static-fallback` | `fallback-to-static-state` |

The semantic-state or destination acknowledgment must occur before a temporary visual layer may revert. The cleanup sequence is:

1. classify the terminal outcome and stop accepting new runtime writes;
2. reach or render the approved readable semantic pose;
3. begin final-state handoff and record its target;
4. for commit, update React/business-derived presentation state; for reconcile, wait for the permanent target to render and acknowledge the same state; for hold, retain the safe pose until route/unmount;
5. verify the readable final state and record handoff completion or a bounded failure;
6. release runtime resources; revert only temporary styles allowed by the policy;
7. revoke external handles, release claims and target handles, and unregister the invocation;
8. emit the sanitized cleanup receipt.

GSAP `context.revert()` or `clearProps` may not run before step 5 when it would visibly undo success. A failed handoff holds the safe pose or renders the contract-approved static fallback; cleanup never flashes a closed, locked, or unsuccessful state.

Receipts add these exact fields:

```ts
type SceneFinalizationReceipt = {
  finalStatePolicy: SceneFinalStatePolicyV2["kind"];
  finalStateCommitted: boolean;
  handoffTargetId?: string;
  handoffStarted: boolean;
  handoffCompleted: boolean;
  handoffFailure?: SceneSafeFailureCode;
  cleanupStarted: boolean;
  cleanupCompleted: boolean;
  cleanupResult: "completed" | "completed-with-fallback" | "completed-with-errors";
};
```

Access/login success uses `hold-final-until-unmount` until navigation commits. Route failure renders a stable recoverable interactive state. Authentication failure never displays success. Abort, unmount, reduced mode, and repeated submission follow the same single-flight handoff and cleanup state machine.

## 15. PageFlip source and clone boundary

StPageFlip is the sole owner of physical page curl, drag, pointer, keyboard, programmatic turns, page index, orientation, and turn lifecycle.

```ts
type PageFlipSourceBoundary = Readonly<{
  pageFlipInstanceId: string;
  sourceGeneration: number;
  bookId: string;
  pageId: string;
  contentRevision: string;
  root: HTMLElement;
}>;

type PageFlipCloneBoundary = Readonly<{
  pageFlipInstanceId: string;
  cloneGeneration: number;
  bookId: string;
  pageId: string;
  pageIndex: number;
  orientation: "portrait" | "landscape";
  lifecycle: "initializing" | "visible" | "settling" | "stale" | "disposed";
  current: boolean;
  root: HTMLElement;
}>;
```

The hidden React source is marked as source content, made inert and non-focusable while duplicated, excluded from the accessibility tree, and excluded from host target registration. Cinematic identity and stale scene-instance attributes are stripped or replaced on the source, while PageFlip, content-identity, accessibility, and test attributes are preserved from an explicit allowlist. IDs used by a visible clone are deterministically namespaced; no source/clone duplicate IDs remain.

After initialization or update, the adapter binds each visible clone to PageFlip instance, clone generation, page identity, index, orientation, current-page state, and lifecycle. It registers only deliberate inner cinematic targets with a local page host. A clone copied from an older generation becomes `stale`, its handles are revoked, and it cannot satisfy a current contract. Off-page clones qualify only when the contract explicitly allows them. PageFlip wrapper transforms are never exported to GSAP; a dedicated inner child is required.

The implementation uses a combination of source exclusion, attribute sanitization, clone namespacing, explicit target re-registration, and host boundaries. It does not blindly remove every `data-*` attribute.

The required integrity fixture contains a hidden React source, current visible clone, stale prior clone, permanent section target, temporary event target, another host with the same part, detached target, zero-box target, and transparent target. Only the declared current visible target may qualify.

`manual-page-flip` and `programmatic-page-flip` remain deprecated registry records for traceability, reject production playback, and are removed from fake showcase execution. The showcase demonstrates real PageFlip controls and lifecycle labels. `journal-open` likewise remains deprecated in favor of the bounded Journal opening machine.

## 16. Exact scene disposition

The registry contains exactly 28 scenes. Phase 2 preserves explicit evidence for every scene and allows no ambiguous status.

| Disposition     | Count | Scenes                                                                                                                                                                                                                                                       | Phase 2 action                                                                                                          |
| --------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Production      |    16 | `first-arrival`, `session-reentry`, `chapter-release`, `map-reveal`, `route-draw`, `artifact-award`, `artifact-connection`, `quest-discovery`, `quest-complete`, `log-entry`, `finale-tease`, `finale-requirement`, `mark-solved`, `pause`, `resume`, `undo` | migrate to native v2 host/instance resolution and enforced ownership                                                    |
| Legacy          |     4 | `player-access`, `quartermaster-login`, `seal-break`, `prepare-chapter`                                                                                                                                                                                      | retain compatibility callers, isolate dedicated hosts, and prevent new canonical use                                    |
| Future contract |     5 | `chapter-heading`, `prose-ink`, `marker-stamp`, `ship-course`, `artifact-inspection`                                                                                                                                                                         | keep typed, unreachable production contracts; mark later visuals only `architecture_ready` after their boundaries exist |
| Deprecated      |     3 | `journal-open`, `manual-page-flip`, `programmatic-page-flip`                                                                                                                                                                                                 | reject production playback and name the Journal/PageFlip replacements                                                   |

The production count is 16, legacy count 4, future-contract count 5, and deprecated count 3. `chapter-heading` and `prose-ink` require a later visible scoped page host and semantic trigger. `marker-stamp` requires a marker-specific trigger and handle. `ship-course` requires authoritative path and ship handles. `artifact-inspection` may animate only engraving/detail children; Motion owns the shared-layout object.

## 17. High-risk component boundaries

### 17.1 Voyage Chart

The stable structure is Motion marker layout wrapper -> GSAP event-visual child -> stable semantic marker content. Motion owns layout, wrapper transform, and press interaction. GSAP owns only the inner stamp, pulse, and bounded reveal. CSS owns material/static states. Markers have explicit semantic IDs and target handles; React index and DOM order are prohibited. Player progression and section-enhancement hosts are distinct. Marker insertion/update/focus/click/stamp, section transitions, reduced mode, and duplicate-host isolation are required tests.

### 17.2 Ship's Log

The stable structure is Motion list-row wrapper -> semantic log content + GSAP fresh-ink child + GSAP symbol child. Motion owns row presence, position, and layout. GSAP never writes transform or opacity on `motion.li`. Each entry is keyed and targeted by authoritative event ID. A temporary overlay reconciles to the authoritative refreshed row before it reverts. The canonical Journal currently lacks a unified Ship's Log surface, so Phase 2 does not claim that broader product migration.

### 17.3 Artifact Inspection and Treasure Altar

Motion owns the shared-layout artifact shell, dialog presence, open/close, and focus lifecycle. GSAP owns only nested engraving stroke and detail-light children. Whole-object GSAP FLIP on a `layoutId` node is prohibited. Artifact award and connection use explicit source/destination handles rather than first-match clones. Focus enters and remains trapped in the dialog, then returns to the exact source artifact.

### 17.4 Companion Header and Navigation

Generic `peripheral` targets are replaced with explicitly named, deliberately cardinal dim surfaces. Motion retains header/navigation layout and interaction. A dedicated aria-hidden GSAP overlay or child owns cinematic dimming. A progression scene cannot claim navigation controls or interaction nodes.

### 17.5 Quartermaster

The structure is Quartermaster shell -> Motion command controls + Motion confirmation dialog + dedicated GSAP command `SceneHost` + Motion result/receipt layer. Each command overlay has an instance-local host and persists claims until its final-state handoff completes. GSAP cannot target ordinary action buttons, form controls, recent-event rows, unrelated cards, or permanent command lights outside the invocation. Receipts include the finalization fields in section 14.

### 17.6 Access and login

Motion owns form presence, pending state, validation errors, and permission state. GSAP owns a bounded accepted/rejected cinematic child and route-transition ceremony. Future Rive lock/seal state remains internal to its wrapper. Success holds until navigation; route failure restores stable focusable UI; auth failure never flashes success. Phase 2 migrates the current legacy `AccessGate` and Quartermaster access boundary. Modern Player/Staff platform visuals remain Phase 4 work.

## 18. Diagnostics, fallback, and privacy

Development and test diagnostics expose only bounded structured fields:

```text
Project Lanternwake phase
scene name
scene instance ID
host ID and kind
event or action ID after safe normalization
runtime
target part and opaque target ID
required or optional
visibility and duplicate result
ownership property/group/result
final-state policy
handoff result
cleanup result
```

Required failure codes include target resolution codes from section 9 plus `ownership-rejected`, `handoff-failed`, and `cleanup-failed`. Diagnostic snapshots show registered host/target/claim counts, instance reachability, and PageFlip lifecycle without storing DOM nodes. The development showcase shows host IDs, instance IDs, exact target counts, claims, conflict simulation, hidden-source simulation, duplicate simulation, fallbacks, reachability, deprecated replacements, and the real PageFlip runtime. Showcase success is diagnostic evidence, not production integration proof.

Never log invitation codes, PINs, passwords, authentication tokens, private event payloads, secret story content, unpublished Creator content, DOM/HTML/text, or raw errors. Opaque identifiers are bounded/redacted using the Phase 1 sanitizer. Production users receive a safe readable fallback and stable controls, never internal diagnostic detail.

## 19. Compatibility and migration sequence

Phase 2 proceeds in this order:

1. complete the Phase 1 baseline procedure in section 3;
2. implement provider-scoped host types, registries, context, invocation identity, target handles, and isolation tests;
3. implement ownership groups, atomic claims, permits, adapters, release/sweep behavior, and tests;
4. integrate the director, v2 contracts, receipts, final-state handoff, and cleanup;
5. implement PageFlip source/clone identity, sanitization, lifecycle, real-showcase behavior, and retire fake curl execution;
6. migrate the exact production and legacy scenes through one shared API;
7. migrate Chart/Log, Altar/Inspection, Companion, Quartermaster/Access, and PageFlip in non-overlapping lanes;
8. update diagnostics, requirement artifacts, roadmap, test plan, and reports;
9. run focused validation, then one isolated integrated full gate;
10. synchronize documentation and chat once, and stop for review.

The temporary v1 adapter is one-way and observable. It records compatibility use, rejects document-wide queries and unknown host kinds, and is not available to new Phase 2 components. It is deleted or limited to the four named legacy scenes after all 16 production scenes migrate. No lane may create a parallel host or ownership API.

## 20. Phase 3 handoff: Unfurl the Tale

Phase 3 consumes these stable APIs:

- persistent `player-progression` host;
- event-local and `player-section-enhancement` hosts;
- `SceneInvocationHandle` with live/replay identity;
- v2 target contracts and registered target handles;
- explicit external target exports/imports;
- atomic ownership claims and runtime permits;
- final-state handoff and presentation diagnostics;
- PageFlip source filtering and visible-clone binding.

Chapter release, map location reveal, route reveal, artifact award, quest discovery, log insertion, and finale tease each mount or reuse the appropriate host, register semantic targets by stable domain identity, pass external handles where continuity crosses trees, and use a fresh invocation for replay. Phase 3 must not reinvent host, resolver, ownership, PageFlip filtering, handoff, or identity architecture. This record does not authorize implementation of the complete persistent Player progression UI during Phase 2.

## 21. Phase 4 handoff: Bring the Harbor Alive

Phase 4 consumes `platform-ceremony`, `gateway`, and `access` hosts; access/login handoff; Motion/GSAP wrapper ownership; explicit library-card targets; invitation and waiting-room host patterns; and dnd-kit ownership during Studio drag.

Library cards keep Motion layout on the outer node and cinematic children inside. Invitation and waiting-room ceremonies are local hosts with safe target contracts. Studio acquires the `spatial-transform` group for dnd-kit only during drag and does not permit Motion or GSAP transforms on that same node. Modern PlayerSignIn and StaffSignIn visuals are Phase 4, not legacy AccessGate scope. Phase 4 may extend scenes but cannot create an independent ownership registry.

Phases 5 and 6 are referenced only as `Phase 5 (name not specified in governing brief)` and `Phase 6 (name not specified in governing brief)` until a governing document names them.

## 22. Zero-loss requirement model

The accepted source denominator is fixed for this phase:

```text
Codex audit requirements: 220
OA requirements:          238
Accepted total:           458
```

Physical matrix rows and accepted source requirements are separate counts. All 238 OA IDs remain first-class ledger records. Reconciliation maps 97 OA requirements to existing Codex matrix rows and creates 141 dedicated specificity-preserving rows where a broad row would hide the accepted behavior. Thus `97 + 141 = 238`; no consolidation deletes an OA identity and no mirrored matrix row is double-counted as a new accepted source requirement.

Both controlling CSVs add or normalize these exact columns:

```text
Implementation Status
Roadmap Phase
Project Lanternwake Phase
Architecture Dependency
Scene Host Required
Ownership Contract Required
Target Contract Required
Blocked By
Implemented In Commit
Validation Status
```

Allowed implementation statuses are:

```text
not_started
architecture_blocked
architecture_ready
partially_implemented
implemented
validated
blocked
superseded
rejected
```

Each accepted row also retains or gains explicit correct library, trigger, replay policy, reduced-motion behavior, acceptance criteria, source identity, and evidence. `architecture_ready` means the Phase 2 boundary exists; it never means the later visual, trigger, reduced behavior, or acceptance tests are implemented. Historical status/evidence fields remain intact; normalized current fields add current truth without rewriting history.

The validator must fail unless:

1. all 220 Codex IDs are unique and assigned;
2. all `OA-001` through `OA-238` are unique, contiguous, accepted, and assigned;
3. every OA row maps to an existing row or one dedicated row, with totals exactly 97 and 141;
4. every mapping target exists and every accepted row has one roadmap and Project Lanternwake phase;
5. library, trigger, replay, reduced behavior, acceptance criteria, status, and validation status are nonblank and use allowed values;
6. every Phase 2 row has implementation evidence, validation evidence, or an explicit blocker;
7. `implemented` and `validated` have a real implementation path/commit and appropriate test evidence;
8. superseded/rejected rows retain approved rationale and replacement where applicable;
9. the 10 normalized columns exist in both artifacts with exact names;
10. accepted requirements unmapped equals zero.

The Codex matrix validator accepts all existing prefixes, including `MX`, `AS`, `AC`, `AM`, `AP`, `AD`, `AR`, `AL`, `AG`, `AA`, and `AK`; it must not drop valid `AA`, `AK`, or `AP` rows through an incomplete prefix allowlist. Phase names must come from governing records. Phase 5 or 6 names are not invented.

## 23. Validation ownership and required evidence

One coordinator-owned validation lane exclusively controls the runtime, browser, copied database, ports, dependency state, production build, E2E, and full `npm run validate`. Component lanes run only focused non-conflicting checks.

Before any mutating browser test, the owner creates a unique database copy, supplies an absolute `DATABASE_URL`, records server PID/port, stores and queries an isolation nonce through the running app, records canonical path/hash/size/mtime, and proves the canonical database is unchanged afterward. An alternate worktree or port alone is not isolation. Failure stops mutation tests and is classified `database-isolation` or `environment`, never passed by assumption.

### 23.1 SceneHost and two-host release gate

Unit tests cover unique registration, duplicate rejection, unique invocation identity, host-local resolution, identical names across hosts, stale invocation, detached cleanup, nested hosts, external handles, outside-host rejection, unmount, idempotent cleanup, simultaneous Player/Quartermaster hosts, and showcase isolation.

The release-blocking integration fixture mounts Host A `map-reveal` / `route-path` and Host B `route-draw` / `route-path`, runs one scene, and proves only that host changes; metrics name the correct instance; cleanup does not affect the other host; target counts are exact; and no claim leaks.

### 23.2 Ownership

Tests cover GSAP vs Motion, GSAP vs CSS, Motion vs CSS, Motion vs PageFlip, GSAP vs PageFlip, GSAP vs Rive/Lottie containers, Motion `layoutId` vs GSAP transform, dnd-kit vs Motion transform, and dnd-kit vs GSAP transform. They prove first grant, same-runtime compatibility, atomic conflict rejection, rejected-write prevention, release/reclaim, cleanup, normalized property conflicts, non-overlap, stale sweep, interruption, fallback, and nested wrappers.

### 23.3 Components and final state

Focused tests prove the ownership boundaries in section 17. Access/login covers success response, accepted pose, delayed route, no snapback, route failure, auth failure, abort, unmount, reduced mode, and repeated submission. Failure never flashes success; success never returns to closed/locked before navigation; focus and controls remain correct.

### 23.4 PageFlip and accessibility

Tests cover hidden-source exclusion, visible-current clone qualification, stale/off-page rejection, unique IDs, accessibility tree, manual/keyboard/programmatic StPageFlip ownership, deprecated fake curls, update/orientation identity, and unmount release. Semantic roles remain on semantic nodes, decorative children are aria-hidden, visible content remains readable, focus order and dialog trap/return stay correct, route focus waits for navigation, fallbacks are readable, and motion is not the only state signal.

### 23.5 Lifecycle and viewport

Run at least 20 cycles each of host mount/unmount, scene play/cleanup, artifact inspection open/close, PageFlip mount/update/unmount, and a non-mutating Quartermaster overlay. After every group, host/target/claim counts return to baseline; stale clones and DOM references are absent; replay uses a new instance; interruptions/routes release claims; and listener/timer counts do not grow monotonically.

Validate migrated surfaces at:

```text
2560x1440
1920x1080
1440x900
430x932
390x844
844x390
```

Assert no horizontal overflow, clipping, wrapper layout drift, focus-order drift, PageFlip geometry error, stacking-context regression, unreachable dialog, or unreadable reduced state.

### 23.6 Integrated commands and classification

The validation report records command, exit code, passed, failed, skipped, blocked, environment errors, baseline failures, and task regressions for format, lint, typecheck, unit/component, SceneHost, ownership, PageFlip, accessibility, browser, viewport, lifecycle, assets, build, E2E, and one full repository validation. Supported top-level gates include:

```text
npm run format:check
npm run lint
npm run typecheck
npm test
npm run assets:validate
npm run build
npm run validate
```

Failure classifications are `task-regression`, `pre-existing`, `environment`, `database-isolation`, `missing-asset`, `blocked`, and `unresolved`. A blocked, skipped, or unavailable test is never reported as passed.

## 24. Shared resource and file-ownership rules

Shared architecture files (`animation-types.ts`, `ownership.ts`, `AnimationDirector.ts`, `scene-registry.ts`, and `scene-utils.ts`) have one writer. `PlayerExperience.tsx`, `PageFlipBook.tsx`, `Quartermaster.tsx`, `AnimationProvider.tsx`, global animation styles, manifests/lockfiles, Prisma schema, and generated assets each have one writer at a time. No implementation lane controls port 3000, validation ports, the browser, database, seed, migrations, build, full E2E, or full validation.

The coordinator integrates shared files, reviews all lane output, runs final validation, updates controlling documents, and runs the chat/development-document synchronizer exactly once after implementation evidence is final. Path-scoped edits and staging preserve Phase 1 and unrelated concurrent work.

## 25. Frozen decisions

| ID  | Decision                                                                                                   | Reason                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| D1  | Authority is provider-scoped; no module-global registry.                                                   | Prevents cross-tree leakage, test pollution, and retained DOM state.                  |
| D2  | Mounted host and scene invocation are separate objects and lifetimes.                                      | A host can persist while every live/replay play remains uniquely identifiable.        |
| D3  | Only registries mint branded IDs and handles.                                                              | DOM attributes and arbitrary objects cannot forge authority.                          |
| D4  | V2 contracts use `expectedHostKinds` and declared host/external sources.                                   | Removes free-form host ambiguity and broad cross-tree queries.                        |
| D5  | Targets register through nearest-host context; invocation preflight caches one exact qualified set.        | Prevents re-query drift, nested-host leakage, and optional-target resurrection.       |
| D6  | External continuity uses registry-minted handles with property/lifetime allowlists.                        | DOM order never decides source or destination.                                        |
| D7  | Ownership conflicts normalize by property group and return non-forgeable permits only on atomic grant.     | Warning-only ownership cannot prevent writes.                                         |
| D8  | Motion, CSS animation, PageFlip, Rive, Lottie, Web Animations, React transitions, and dnd-kit participate. | GSAP-only tracking misses confirmed same-node conflicts.                              |
| D9  | Runtime responsibilities use nested wrappers.                                                              | Semantic/layout nodes remain stable while cinematic children are independently owned. |
| D10 | Final-state handoff completes before destructive cleanup.                                                  | Prevents login, route, award, and overlay snapback.                                   |
| D11 | PageFlip uses source exclusion plus sanitized, namespaced, generation-bound clone registration.            | Hidden sources and stale clones cannot satisfy visible requirements.                  |
| D12 | Scene disposition is exactly 16 production, 4 legacy, 5 future-contract, 3 deprecated.                     | Matches current source-grounded reachability and preserves traceability.              |
| D13 | Accepted denominator is 458; OA mapping is 97 existing plus 141 dedicated rows.                            | Prevents broad Codex rows from erasing specific OA requirements.                      |
| D14 | Future visuals become at most `architecture_ready` in Phase 2.                                             | Architecture is not visual implementation or validation.                              |
| D15 | Phase 1 final-baseline reread gates source migration.                                                      | Prevents this design worktree from overwriting the other task's newer implementation. |

## 26. Risk register

| ID  | Risk                                                                      | Impact   | Mitigation / stop condition                                                                          |
| --- | ------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| R1  | Phase 1 final code differs from this design-time snapshot.                | High     | Perform section 3 reread; adapt compatibly or stop on a missing contract.                            |
| R2  | A compatibility adapter preserves application-root behavior.              | High     | Instrument adapter use; forbid it for new components; migrate all 16 production scenes.              |
| R3  | A scene builder re-queries raw DOM after preflight.                       | High     | Give adapters handles/permits only; static search and tests reject production selectors.             |
| R4  | Ownership is recorded but writes remain possible.                         | Critical | Runtime adapters require live permits; tests spy on rejected writes.                                 |
| R5  | CSS, Motion, dnd-kit, or PageFlip bypass ownership.                       | High     | Register active lifecycle claims in their hooks/adapters and normalize groups.                       |
| R6  | Cleanup releases claims before semantic reconciliation.                   | High     | Enforce finalization state machine and receipt ordering.                                             |
| R7  | PageFlip copies source IDs/attributes into visible or stale clones.       | High     | Explicit sanitizer, namespacing, generation revocation, accessibility tests.                         |
| R8  | Requirement consolidation loses OA specificity.                           | Critical | Validate every OA ID, 97/141 mapping totals, required fields, and zero unmapped.                     |
| R9  | Future work is falsely reported implemented.                              | High     | Use exact status vocabulary; require implementation and validation evidence.                         |
| R10 | Browser tests mutate the canonical database.                              | Critical | Fail-closed copy/absolute URL/nonce/fingerprint proof under one owner.                               |
| R11 | Registries retain DOM nodes after lifecycle completion.                   | High     | 20-cycle baselines, weak/internal references where suitable, explicit release and provider teardown. |
| R12 | Wrapper insertion regresses semantics, focus, layout, or mobile geometry. | High     | Component accessibility, keyboard, six-viewport, and visual geometry checks.                         |

## 27. Completion gate for this design

The architecture in this record is frozen for implementation after the Phase 1 procedure in section 3 confirms compatibility. Component writers may begin only after shared source interfaces and focused host/ownership tests are green. Any change to identity, host authority, target source, property normalization, permit enforcement, final-state ordering, PageFlip generation, or the 458-requirement model requires a recorded decision update and coordinator review.

Claim the Deck itself is not complete because this document exists. Completion still requires implemented and validated hosts, invocation identity, scoped targets, explicit external handles, blocked conflicts, Motion integration, collision migrations, PageFlip boundaries, fake-curl retirement, final-state handoff, lifecycle baselines, zero-loss tracking with zero unmapped requirements, governing-document updates, final isolated validation, synchronization, and an exact evidence report.

After those gates pass, Phase 2 stops for review. It does not begin Phase 3 automatically.
