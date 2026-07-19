import type {
  AnimatedProperty,
  AnimationProviderId,
  AnimationRuntimeOwner,
  ExternalSceneTargetId,
  OwnershipScope,
  ResolvedMotionPolicy,
  SceneHostId,
  SceneHostKind,
  SceneInstanceId,
  ScenePlaybackKind,
  SceneTargetContractV2,
  SceneTargetId,
  SceneTargetResolutionReceipt,
} from "../core/animation-types";
import type {
  AnimationOwnershipBatchResult,
  AnimationOwnershipClaimResult,
  AnimationOwnershipConflictReason,
} from "../core/ownership";

export type SceneTargetRegistration = Readonly<{
  /** Stable semantic key; the registry mints the opaque target ID. */
  targetKey: string;
  part: string;
  element: Element;
  ownerHint?: AnimationRuntimeOwner;
  allowedProperties: readonly AnimatedProperty[];
  pageFlip?: Readonly<{
    role: "source" | "visible-clone" | "stale-clone";
    generation: number;
    pageId: string;
    current: boolean;
  }>;
}>;

export type SceneTargetHandle = Readonly<{
  providerId: AnimationProviderId;
  hostId: SceneHostId;
  hostGeneration: number;
  targetId: SceneTargetId;
  part: string;
  targetGeneration: number;
  release: () => void;
}>;

export type ExternalTargetExportRequest = Readonly<{
  target: SceneTargetHandle;
  destinationHostId?: SceneHostId;
  allowedProperties: readonly AnimatedProperty[];
  lifetime: "scene" | "handoff";
  expiresAfterInstanceId?: SceneInstanceId;
}>;

export type ExternalSceneTargetHandle = Readonly<{
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
  revoke: () => void;
}>;

export type SceneInvocationRequest = Readonly<{
  sceneName: SceneTargetContractV2["sceneName"];
  eventOrActionId?: string;
  playback: ScenePlaybackKind;
  targetContract: SceneTargetContractV2;
  motionPolicy: ResolvedMotionPolicy;
  signal?: AbortSignal;
  externalTargets?: Readonly<Record<string, ExternalSceneTargetHandle>>;
}>;

export type SceneInvocationCompletion = Readonly<{
  outcome: "completed" | "fallback" | "aborted" | "interrupted" | "failed";
  finalSemanticState?: string;
}>;

export type SceneInterruptionReason =
  | "abort-signal"
  | "host-unmounted"
  | "provider-unmounted"
  | "route-change"
  | "motion-policy-reduced"
  | "superseded"
  | "runtime-failed";

export type SceneInvocationCleanupReceipt = Readonly<{
  instanceId: SceneInstanceId;
  outcome: SceneInvocationCompletion["outcome"];
  releasedClaims: number;
  revokedExternalHandles: number;
  alreadyTerminal: boolean;
}>;

export type SceneInvocationOwnershipRequest = Readonly<{
  targetId: SceneTargetId;
  runtime: AnimationRuntimeOwner;
  properties: readonly AnimatedProperty[];
}>;

export type SceneTargetUseDenialReason = "identity-only" | "property-not-declared" | "permit-rejected" | "target-stale";

export type SceneTargetUseResult<T> =
  | Readonly<{ status: "applied"; value: T }>
  | Readonly<{ status: "denied"; reason: SceneTargetUseDenialReason }>;

export type RuntimeSurfaceClaimRequest = Readonly<{
  target: SceneTargetHandle;
  element: Element;
  runtime: AnimationRuntimeOwner;
  properties: readonly AnimatedProperty[];
}>;

export type RuntimeSurfaceLease = Readonly<{
  status: "granted";
  providerId: AnimationProviderId;
  hostId: SceneHostId;
  hostGeneration: number;
  lifecycleInstanceId: SceneInstanceId;
  targetId: SceneTargetId;
  targetGeneration: number;
  runtime: AnimationRuntimeOwner;
  properties: readonly AnimatedProperty[];
  withElement: <T>(property: AnimatedProperty, operation: (element: Element) => T) => SceneTargetUseResult<T>;
  withProperties: <T>(
    properties: readonly AnimatedProperty[],
    operation: (element: Element) => T,
  ) => SceneTargetUseResult<T>;
  release: () => boolean;
}>;

export type RuntimeSurfaceClaimRejectionReason =
  | "host-stale"
  | "target-stale"
  | "target-foreign"
  | "element-mismatch"
  | "ownership-rejected";

export type RuntimeSurfaceClaimResult =
  | RuntimeSurfaceLease
  | Readonly<{
      status: "rejected";
      reason: RuntimeSurfaceClaimRejectionReason;
      ownershipReason?: AnimationOwnershipConflictReason;
    }>;

export type RuntimeOwnedSceneTargetInput = Omit<SceneTargetRegistration, "element" | "ownerHint"> &
  Readonly<{
    runtime: AnimationRuntimeOwner;
    properties: readonly AnimatedProperty[];
  }>;

export type RuntimeOwnedSceneTargetBinding = Readonly<{
  bindTarget: (element: Element | null) => void;
  handle: SceneTargetHandle | null;
  lease: RuntimeSurfaceLease | null;
  ownershipReady: boolean;
}>;

/**
 * Exact, permit-gated target capability delivered to a v2 scene builder.
 * The raw element is available only inside `withElement`, after the registry
 * revalidates the live claim, target generation, runtime and property.
 */
export type SceneBuildTarget = Readonly<{
  targetId: SceneTargetId;
  part: string;
  identityOnly: boolean;
  runtime: AnimationRuntimeOwner | null;
  properties: readonly AnimatedProperty[];
  withElement: <T>(property: AnimatedProperty, operation: (element: Element) => T) => SceneTargetUseResult<T>;
  withProperties: <T>(
    properties: readonly AnimatedProperty[],
    operation: (element: Element) => T,
  ) => SceneTargetUseResult<T>;
}>;

export type SceneBuildTargetGroup = Readonly<{
  key: string;
  part: string;
  required: boolean;
  targets: readonly SceneBuildTarget[];
  one: () => SceneBuildTarget | null;
}>;

export type SceneBuildTargetAccess = Readonly<{
  keys: () => readonly string[];
  get: (key: string) => SceneBuildTargetGroup | undefined;
  require: (key: string) => SceneBuildTargetGroup;
}>;

export type SceneInvocationHandle = Readonly<{
  providerId: AnimationProviderId;
  hostId: SceneHostId;
  hostKind: SceneHostKind;
  hostGeneration: number;
  instanceId: SceneInstanceId;
  sceneName: SceneTargetContractV2["sceneName"];
  eventOrActionId?: string;
  playback: ScenePlaybackKind;
  invocationSequence: number;
  targetContract: SceneTargetContractV2;
  ownershipScope: OwnershipScope;
  resolveTargets: () => SceneTargetResolutionReceipt;
  claim: (request: SceneInvocationOwnershipRequest) => AnimationOwnershipClaimResult;
  claimBatch: (requests: readonly SceneInvocationOwnershipRequest[]) => AnimationOwnershipBatchResult;
  complete: (result: SceneInvocationCompletion) => Promise<SceneInvocationCleanupReceipt>;
  abort: (reason: SceneInterruptionReason) => Promise<SceneInvocationCleanupReceipt>;
}>;

export type SceneHostDiagnosticSnapshot = Readonly<{
  providerId: AnimationProviderId;
  hostId: SceneHostId;
  kind: SceneHostKind;
  generation: number;
  connected: boolean;
  registeredTargetCount: number;
  activeInvocationCount: number;
  externalHandleCount: number;
  activeClaimCount: number;
}>;

export type SceneHostHandle = Readonly<{
  providerId: AnimationProviderId;
  hostId: SceneHostId;
  kind: SceneHostKind;
  generation: number;
  beginScene: (request: SceneInvocationRequest) => SceneInvocationHandle;
  registerTarget: (input: SceneTargetRegistration) => SceneTargetHandle;
  claimRuntimeSurface: (input: RuntimeSurfaceClaimRequest) => RuntimeSurfaceClaimResult;
  exportTarget: (input: ExternalTargetExportRequest) => ExternalSceneTargetHandle;
  snapshot: () => SceneHostDiagnosticSnapshot;
  release: () => void;
}>;

export type SceneHostRegistration = Readonly<{
  providerId: AnimationProviderId;
  hostId: SceneHostId;
  kind: SceneHostKind;
  root: HTMLElement;
  ownershipScope: OwnershipScope;
  generation: number;
}>;
