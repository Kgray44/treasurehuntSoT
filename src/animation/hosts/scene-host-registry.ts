import {
  sceneHostKinds,
  type AnimatedProperty,
  type AnimationProviderId,
  type ExternalSceneTargetId,
  type OwnershipScope,
  type SceneHostId,
  type SceneHostKind,
  type SceneInstanceId,
  type SceneTargetId,
  type SceneTargetRequirementV2,
  type SceneTargetResolutionEntry,
  type SceneTargetResolutionFailureCode,
  type SceneTargetResolutionReceipt,
} from "../core/animation-types";
import {
  AnimationOwnershipRegistry,
  type AnimationOwnershipGrant,
  type AnimationOwnershipClaimRequest,
  type AnimationWritePermit,
} from "../core/ownership";
import type {
  ExternalSceneTargetHandle,
  ExternalTargetExportRequest,
  SceneBuildTarget,
  SceneBuildTargetAccess,
  SceneBuildTargetGroup,
  SceneHostHandle,
  SceneHostRegistration,
  SceneInvocationCleanupReceipt,
  SceneInvocationCompletion,
  SceneInvocationHandle,
  SceneInvocationRequest,
  SceneInterruptionReason,
  RuntimeSurfaceClaimRequest,
  RuntimeSurfaceClaimResult,
  SceneTargetHandle,
  SceneInvocationOwnershipRequest,
  SceneTargetRegistration,
} from "./scene-host-types";

type TargetRecord = {
  handle: SceneTargetHandle;
  key: string;
  element: Element;
  ownerHint?: SceneTargetRegistration["ownerHint"];
  allowedProperties: readonly AnimatedProperty[];
  pageFlip?: SceneTargetRegistration["pageFlip"];
  releasing: boolean;
  released: boolean;
};

type ExternalRecord = {
  handle: ExternalSceneTargetHandle;
  revoked: boolean;
};

type InvocationRecord = {
  handle: SceneInvocationHandle;
  request: SceneInvocationRequest;
  resolved?: SceneTargetResolutionReceipt;
  resolvedTargets: Map<SceneTargetId, TargetRecord>;
  terminal?: SceneInvocationCleanupReceipt;
  abortCleanup?: () => void;
};

type HostRecord = {
  registration: SceneHostRegistration;
  handle?: SceneHostHandle;
  key?: string;
  targets: Map<SceneTargetId, TargetRecord>;
  targetsByKey: Map<string, SceneTargetId>;
  invocations: Map<SceneInstanceId, InvocationRecord>;
  externalIds: Set<ExternalSceneTargetId>;
  invocationSequence: number;
  targetSequence: number;
  released: boolean;
};

export type SceneHostRegistrySnapshot = Readonly<{
  providerId: AnimationProviderId;
  registeredHostCount: number;
  registeredTargetCount: number;
  activeInvocationCount: number;
  externalHandleCount: number;
  activeClaimCount: number;
}>;

function opaqueId(prefix: string) {
  const random =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export function createAnimationProviderId(): AnimationProviderId {
  return opaqueId("provider") as AnimationProviderId;
}

function sanitizeKey(value: string, label: string) {
  const key = value.normalize("NFKC").trim();
  if (!key || key.length > 96 || !/^[A-Za-z0-9._:/-]+$/u.test(key)) {
    throw new Error(`Invalid ${label}`);
  }
  return key;
}

function intersects(first: DOMRect, second: DOMRect) {
  return (
    first.width > 0 &&
    first.height > 0 &&
    second.width > 0 &&
    second.height > 0 &&
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function effectiveVisibility(element: Element, root: HTMLElement) {
  const view = element.ownerDocument.defaultView;
  let current: Element | null = element;
  let display = "";
  let visibility = "";
  let opacity = 1;
  while (current) {
    const style = view?.getComputedStyle(current);
    if (style?.display === "none") display = "none";
    if (style?.visibility === "hidden" || style?.visibility === "collapse") visibility = style.visibility;
    const parsed = Number.parseFloat(style?.opacity ?? "1");
    opacity *= Number.isFinite(parsed) ? parsed : 1;
    if (current === root) break;
    current = current.parentElement;
  }
  return { display, visibility, opacity };
}

/** Provider-scoped authority for mounted hosts, targets, invocations and external bridges. */
export class SceneHostRegistry {
  readonly ownership: AnimationOwnershipRegistry;
  private readonly hosts = new Map<SceneHostId, HostRecord>();
  private readonly hostIdsByKey = new Map<string, SceneHostId>();
  private readonly externals = new Map<ExternalSceneTargetId, ExternalRecord>();
  private hostSequence = 0;
  private destroyed = false;

  constructor(readonly providerId: AnimationProviderId = createAnimationProviderId()) {
    this.ownership = new AnimationOwnershipRegistry(providerId);
  }

  registerHost(input: Readonly<{ kind: SceneHostKind; root: HTMLElement; hostKey?: string }>): SceneHostHandle {
    if (this.destroyed) throw new Error("Scene host registry is destroyed");
    if (!sceneHostKinds.includes(input.kind)) throw new Error("Unknown scene host kind");
    if (!input.root.isConnected) throw new Error("Scene host root must be connected");
    const key = input.hostKey ? sanitizeKey(input.hostKey, "scene host key") : undefined;
    if (key && this.hostIdsByKey.has(key)) throw new Error("Duplicate scene host key");
    this.hostSequence += 1;
    const hostId = `${input.kind}-${this.hostSequence.toString(36)}-${opaqueId("host")}` as SceneHostId;
    const ownershipScope = Object.freeze({ providerId: this.providerId, hostId, boundary: "host" as const });
    const registration = Object.freeze({
      providerId: this.providerId,
      hostId,
      kind: input.kind,
      root: input.root,
      ownershipScope,
      generation: 1,
    });
    const record: HostRecord = {
      registration,
      ...(key ? { key } : {}),
      targets: new Map(),
      targetsByKey: new Map(),
      invocations: new Map(),
      externalIds: new Set(),
      invocationSequence: 0,
      targetSequence: 0,
      released: false,
    };
    this.hosts.set(hostId, record);
    if (key) this.hostIdsByKey.set(key, hostId);
    input.root.setAttribute("data-scene-host-id", hostId);
    input.root.setAttribute("data-scene-host-kind", input.kind);
    record.handle = this.hostHandle(record);
    return record.handle;
  }

  snapshot(): SceneHostRegistrySnapshot {
    const hosts = [...this.hosts.values()].filter((host) => !host.released);
    return Object.freeze({
      providerId: this.providerId,
      registeredHostCount: hosts.length,
      registeredTargetCount: hosts.reduce((count, host) => count + host.targets.size, 0),
      activeInvocationCount: hosts.reduce((count, host) => count + host.invocations.size, 0),
      externalHandleCount: [...this.externals.values()].filter((external) => !external.revoked).length,
      activeClaimCount: this.ownership.snapshot().activeClaimCount,
    });
  }

  hostForRoot(root: HTMLElement): SceneHostHandle | null {
    const record = [...this.hosts.values()].find((host) => !host.released && host.registration.root === root);
    return record?.handle ?? null;
  }

  isRegisteredHandle(handle: SceneHostHandle) {
    const record = this.hosts.get(handle.hostId);
    return Boolean(
      record &&
        !record.released &&
        record.handle === handle &&
        handle.providerId === this.providerId &&
        handle.generation === record.registration.generation,
    );
  }

  isRegisteredExternalHandle(handle: ExternalSceneTargetHandle) {
    const record = this.externals.get(handle.externalTargetId);
    return Boolean(record && !record.revoked && record.handle === handle && handle.providerId === this.providerId);
  }

  revokeExternalHandle(handle: ExternalSceneTargetHandle) {
    if (!this.isRegisteredExternalHandle(handle)) return false;
    this.revokeExternal(handle.externalTargetId);
    return true;
  }

  elementForInvocationTarget(
    invocation: SceneInvocationHandle,
    targetId: SceneTargetId,
    permit: AnimationWritePermit,
    property: AnimatedProperty,
  ): Element | null {
    const host = this.hosts.get(invocation.hostId);
    const record = host?.invocations.get(invocation.instanceId);
    const target = record?.resolvedTargets.get(targetId);
    if (
      invocation.providerId !== this.providerId ||
      !host ||
      host.released ||
      invocation.hostGeneration !== host.registration.generation ||
      record?.handle !== invocation ||
      !target ||
      target.released ||
      !target.element.isConnected
    ) {
      return null;
    }
    return this.ownership.allowsWrite(permit, {
      targetId,
      targetGeneration: target.handle.targetGeneration,
      runtime: permit.runtime,
      property,
    })
      ? target.element
      : null;
  }

  createBuildTargetAccess(
    invocation: SceneInvocationHandle,
    resolution: SceneTargetResolutionReceipt,
    grants: readonly AnimationOwnershipGrant[],
  ): SceneBuildTargetAccess {
    const host = this.hosts.get(invocation.hostId);
    const invocationRecord = host?.invocations.get(invocation.instanceId);
    if (
      invocation.providerId !== this.providerId ||
      !host ||
      host.released ||
      invocationRecord?.handle !== invocation ||
      invocationRecord.resolved !== resolution ||
      resolution.sceneInstanceId !== invocation.instanceId ||
      resolution.hostGeneration !== invocation.hostGeneration
    ) {
      throw new Error("Cannot create target access for a stale invocation");
    }

    const requirementByKey = new Map(invocation.targetContract.targets.map((target) => [target.key, target]));
    const groups = new Map<string, SceneBuildTargetGroup>();
    for (const entry of resolution.entries) {
      const requirement = requirementByKey.get(entry.key);
      if (!requirement) throw new Error("Resolved target key is not declared by the contract");
      const targets = entry.acceptedTargetIds.flatMap<SceneBuildTarget>((targetId) => {
        const target = invocationRecord.resolvedTargets.get(targetId);
        if (!target) throw new Error("Resolved target is stale");
        if (requirement.identityOnly) {
          const denyIdentity = <T>(properties: readonly AnimatedProperty[], operation: (element: Element) => T) => {
            void properties;
            void operation;
            return Object.freeze({ status: "denied" as const, reason: "identity-only" as const });
          };
          return [
            Object.freeze({
              targetId,
              part: requirement.part,
              identityOnly: true,
              runtime: null,
              properties: Object.freeze([]),
              withElement: <T>(property: AnimatedProperty, operation: (element: Element) => T) =>
                denyIdentity([property], operation),
              withProperties: denyIdentity,
            }),
          ];
        }
        const grant = grants.find(
          (candidate) =>
            candidate.status === "granted" &&
            candidate.claim.sceneInstanceId === invocation.instanceId &&
            candidate.claim.targetId === targetId &&
            candidate.claim.runtime === requirement.owner &&
            requirement.properties.every((property) => candidate.permit.properties.includes(property)),
        );
        if (!grant) {
          if (entry.required) throw new Error("Required resolved target is missing its ownership permit");
          return [];
        }
        const properties = Object.freeze([...requirement.properties]);
        const withProperties = <T>(requested: readonly AnimatedProperty[], operation: (element: Element) => T) => {
          const exactProperties = [...new Set(requested)];
          if (exactProperties.length === 0 || exactProperties.some((property) => !properties.includes(property))) {
            return Object.freeze({ status: "denied" as const, reason: "property-not-declared" as const });
          }
          const currentHost = this.hosts.get(invocation.hostId);
          const currentInvocation = currentHost?.invocations.get(invocation.instanceId);
          const currentTarget = currentInvocation?.resolvedTargets.get(targetId);
          if (
            !currentTarget ||
            currentTarget !== target ||
            currentTarget.handle.targetGeneration !== target.handle.targetGeneration ||
            currentTarget.released ||
            !currentTarget.element.isConnected
          ) {
            return Object.freeze({ status: "denied" as const, reason: "target-stale" as const });
          }
          const elements = exactProperties.map((property) =>
            this.elementForInvocationTarget(invocation, targetId, grant.permit, property),
          );
          if (elements.some((element) => element !== currentTarget.element)) {
            return Object.freeze({ status: "denied" as const, reason: "permit-rejected" as const });
          }
          return Object.freeze({ status: "applied" as const, value: operation(currentTarget.element) });
        };
        return [
          Object.freeze({
            targetId,
            part: requirement.part,
            identityOnly: false,
            runtime: requirement.owner,
            properties,
            withElement: <T>(property: AnimatedProperty, operation: (element: Element) => T) =>
              withProperties([property], operation),
            withProperties,
          }),
        ];
      });
      const frozenTargets = Object.freeze(targets);
      groups.set(
        entry.key,
        Object.freeze({
          key: entry.key,
          part: entry.part,
          required: entry.required,
          targets: frozenTargets,
          one: () => frozenTargets[0] ?? null,
        }),
      );
    }
    const keys = Object.freeze([...groups.keys()]);
    return Object.freeze({
      keys: () => keys,
      get: (key: string) => groups.get(key),
      require: (key: string) => {
        const group = groups.get(key);
        if (!group) throw new Error("Scene target key is not declared");
        return group;
      },
    });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const record of [...this.hosts.values()]) this.releaseHost(record, "provider-unmounted");
    this.externals.clear();
    this.hostIdsByKey.clear();
    this.ownership.destroy();
  }

  private hostHandle(record: HostRecord): SceneHostHandle {
    return Object.freeze({
      providerId: this.providerId,
      hostId: record.registration.hostId,
      kind: record.registration.kind,
      generation: record.registration.generation,
      beginScene: (request) => this.beginScene(record, request),
      registerTarget: (input) => this.registerTarget(record, input),
      claimRuntimeSurface: (input) => this.claimRuntimeSurface(record, input),
      exportTarget: (input) => this.exportTarget(record, input),
      snapshot: () => this.hostSnapshot(record),
      release: () => this.releaseHost(record, "host-unmounted"),
    });
  }

  private hostSnapshot(record: HostRecord) {
    return Object.freeze({
      providerId: this.providerId,
      hostId: record.registration.hostId,
      kind: record.registration.kind,
      generation: record.registration.generation,
      connected: !record.released && record.registration.root.isConnected,
      registeredTargetCount: record.targets.size,
      activeInvocationCount: record.invocations.size,
      externalHandleCount: [...record.externalIds].filter((id) => !this.externals.get(id)?.revoked).length,
      activeClaimCount: this.ownership.snapshot().activeClaimCount,
    });
  }

  private registerTarget(record: HostRecord, input: SceneTargetRegistration): SceneTargetHandle {
    this.assertLiveHost(record);
    const key = sanitizeKey(input.targetKey, "scene target key");
    if (record.targetsByKey.has(key)) throw new Error("Duplicate scene target key in host");
    if (!input.element.isConnected || !record.registration.root.contains(input.element)) {
      throw new Error("Scene target must be connected inside its host");
    }
    const nestedHost = [...this.hosts.values()].find(
      (candidate) =>
        candidate !== record &&
        !candidate.released &&
        record.registration.root.contains(candidate.registration.root) &&
        candidate.registration.root.contains(input.element),
    );
    if (nestedHost) throw new Error("Scene target belongs to a nested host");
    record.targetSequence += 1;
    const targetId =
      `${record.registration.hostId}-target-${record.targetSequence.toString(36)}-${opaqueId("id")}` as SceneTargetId;
    let released = false;
    const handle: SceneTargetHandle = Object.freeze({
      providerId: this.providerId,
      hostId: record.registration.hostId,
      hostGeneration: record.registration.generation,
      targetId,
      part: sanitizeKey(input.part, "scene target part"),
      targetGeneration: 1,
      release: () => {
        if (released) return;
        released = true;
        this.releaseTarget(record, targetId);
      },
    });
    const target: TargetRecord = {
      handle,
      key,
      element: input.element,
      ...(input.ownerHint ? { ownerHint: input.ownerHint } : {}),
      allowedProperties: Object.freeze([...new Set(input.allowedProperties)]),
      ...(input.pageFlip ? { pageFlip: Object.freeze({ ...input.pageFlip }) } : {}),
      releasing: false,
      released: false,
    };
    record.targets.set(targetId, target);
    record.targetsByKey.set(key, targetId);
    input.element.setAttribute("data-scene-target-id", targetId);
    return handle;
  }

  private claimRuntimeSurface(record: HostRecord, input: RuntimeSurfaceClaimRequest): RuntimeSurfaceClaimResult {
    try {
      this.assertLiveHost(record);
    } catch {
      return Object.freeze({ status: "rejected", reason: "host-stale" });
    }
    if (
      input.target.providerId !== this.providerId ||
      input.target.hostId !== record.registration.hostId ||
      input.target.hostGeneration !== record.registration.generation
    ) {
      return Object.freeze({ status: "rejected", reason: "target-foreign" });
    }
    const target = record.targets.get(input.target.targetId);
    if (
      !target ||
      target.released ||
      target.handle !== input.target ||
      target.handle.targetGeneration !== input.target.targetGeneration ||
      !target.element.isConnected
    ) {
      return Object.freeze({ status: "rejected", reason: "target-stale" });
    }
    if (target.element !== input.element) {
      return Object.freeze({ status: "rejected", reason: "element-mismatch" });
    }

    const lifecycleInstanceId = `${record.registration.hostId}-runtime-${opaqueId("surface")}` as SceneInstanceId;
    const claimResult = this.ownership.claim({
      scope: record.registration.ownershipScope,
      sceneInstanceId: lifecycleInstanceId,
      targetId: target.handle.targetId,
      targetGeneration: target.handle.targetGeneration,
      element: target.element,
      runtime: input.runtime,
      properties: input.properties,
      allowedProperties: target.allowedProperties,
    });
    if (claimResult.status === "rejected") {
      return Object.freeze({
        status: "rejected",
        reason: "ownership-rejected",
        ownershipReason: claimResult.reason,
      });
    }

    const properties = Object.freeze([...claimResult.permit.properties]);
    let released = false;
    const withProperties = <T>(requested: readonly AnimatedProperty[], operation: (element: Element) => T) => {
      const exactProperties = [...new Set(requested)];
      if (exactProperties.length === 0 || exactProperties.some((property) => !properties.includes(property))) {
        return Object.freeze({ status: "denied" as const, reason: "property-not-declared" as const });
      }
      const currentHost = this.hosts.get(record.registration.hostId);
      const currentTarget = currentHost?.targets.get(target.handle.targetId);
      if (
        released ||
        currentHost !== record ||
        currentHost.released ||
        currentHost.registration.generation !== record.registration.generation ||
        currentTarget !== target ||
        currentTarget.handle !== input.target ||
        currentTarget.handle.targetGeneration !== input.target.targetGeneration ||
        currentTarget.element !== input.element ||
        !currentTarget.element.isConnected ||
        !currentHost.registration.root.contains(currentTarget.element)
      ) {
        return Object.freeze({ status: "denied" as const, reason: "target-stale" as const });
      }
      if (
        exactProperties.some(
          (property) =>
            !this.ownership.allowsWrite(claimResult.permit, {
              targetId: target.handle.targetId,
              targetGeneration: target.handle.targetGeneration,
              runtime: input.runtime,
              property,
            }),
        )
      ) {
        return Object.freeze({ status: "denied" as const, reason: "permit-rejected" as const });
      }
      return Object.freeze({ status: "applied" as const, value: operation(currentTarget.element) });
    };
    return Object.freeze({
      status: "granted" as const,
      providerId: this.providerId,
      hostId: record.registration.hostId,
      hostGeneration: record.registration.generation,
      lifecycleInstanceId,
      targetId: target.handle.targetId,
      targetGeneration: target.handle.targetGeneration,
      runtime: input.runtime,
      properties,
      withElement: <T>(property: AnimatedProperty, operation: (element: Element) => T) =>
        withProperties([property], operation),
      withProperties,
      release: () => {
        if (released) return false;
        released = true;
        return claimResult.release();
      },
    });
  }

  private exportTarget(record: HostRecord, input: ExternalTargetExportRequest): ExternalSceneTargetHandle {
    this.assertLiveHost(record);
    const target = record.targets.get(input.target.targetId);
    if (
      !target ||
      target.released ||
      target.handle !== input.target ||
      input.target.providerId !== this.providerId ||
      input.target.hostId !== record.registration.hostId ||
      input.target.hostGeneration !== record.registration.generation
    ) {
      throw new Error("External target export requires a live registered target");
    }
    if (input.allowedProperties.some((property) => !target.allowedProperties.includes(property))) {
      throw new Error("External target export exceeds the registered property allowlist");
    }
    const externalTargetId = opaqueId("external") as ExternalSceneTargetId;
    let revoked = false;
    const handle: ExternalSceneTargetHandle = Object.freeze({
      providerId: this.providerId,
      externalTargetId,
      sourceHostId: record.registration.hostId,
      sourceHostGeneration: record.registration.generation,
      targetId: target.handle.targetId,
      targetGeneration: target.handle.targetGeneration,
      ...(input.destinationHostId ? { destinationHostId: input.destinationHostId } : {}),
      allowedProperties: Object.freeze([...new Set(input.allowedProperties)]),
      lifetime: input.lifetime,
      ...(input.expiresAfterInstanceId ? { expiresAfterInstanceId: input.expiresAfterInstanceId } : {}),
      revoke: () => {
        if (revoked) return;
        revoked = true;
        this.revokeExternal(externalTargetId);
      },
    });
    this.externals.set(externalTargetId, { handle, revoked: false });
    record.externalIds.add(externalTargetId);
    return handle;
  }

  private beginScene(record: HostRecord, request: SceneInvocationRequest): SceneInvocationHandle {
    this.assertLiveHost(record);
    if (request.targetContract.sceneName !== request.sceneName) throw new Error("Scene contract/name mismatch");
    if (!request.targetContract.expectedHostKinds.includes(record.registration.kind)) {
      throw new Error("Scene host kind rejected by contract");
    }
    for (const target of request.targetContract.targets) {
      if (target.identityOnly) {
        if (target.owner !== null || target.properties.length !== 0) {
          throw new Error("Identity-only target requirements cannot declare write ownership");
        }
      } else if (!target.owner || target.properties.length === 0) {
        throw new Error("Writable target requirements must declare an owner and properties");
      }
    }
    record.invocationSequence += 1;
    const instanceId =
      `${request.sceneName}-${request.playback}-${record.invocationSequence.toString(36)}-${opaqueId("instance")}` as SceneInstanceId;
    const ownershipScope: OwnershipScope = Object.freeze({
      providerId: this.providerId,
      hostId: record.registration.hostId,
      boundary: "invocation",
    });
    const invocationRecord = {
      request,
      resolvedTargets: new Map<SceneTargetId, TargetRecord>(),
    } as InvocationRecord;
    const handle: SceneInvocationHandle = Object.freeze({
      providerId: this.providerId,
      hostId: record.registration.hostId,
      hostKind: record.registration.kind,
      hostGeneration: record.registration.generation,
      instanceId,
      sceneName: request.sceneName,
      ...(request.eventOrActionId
        ? { eventOrActionId: sanitizeKey(request.eventOrActionId, "event or action id") }
        : {}),
      playback: request.playback,
      invocationSequence: record.invocationSequence,
      targetContract: request.targetContract,
      ownershipScope,
      resolveTargets: () => this.resolveTargets(record, invocationRecord),
      claim: (claimRequest) => this.claim(record, invocationRecord, claimRequest),
      claimBatch: (claimRequests) =>
        this.ownership.claimBatch(
          claimRequests.map((claimRequest) => this.claimInput(record, invocationRecord, claimRequest)),
        ),
      complete: (result) => this.terminal(record, invocationRecord, result),
      abort: (reason) => this.terminal(record, invocationRecord, { outcome: "aborted", finalSemanticState: reason }),
    });
    invocationRecord.handle = handle;
    const onAbort = () => void this.terminal(record, invocationRecord, { outcome: "aborted" });
    request.signal?.addEventListener("abort", onAbort, { once: true });
    invocationRecord.abortCleanup = () => request.signal?.removeEventListener("abort", onAbort);
    record.invocations.set(instanceId, invocationRecord);
    return handle;
  }

  private resolveTargets(record: HostRecord, invocation: InvocationRecord): SceneTargetResolutionReceipt {
    if (invocation.resolved) return invocation.resolved;
    if (
      record.released ||
      !record.registration.root.isConnected ||
      !record.invocations.has(invocation.handle.instanceId)
    ) {
      return this.staleResolution(record, invocation);
    }
    const entries = invocation.request.targetContract.targets.map((requirement) =>
      this.resolveRequirement(record, invocation, requirement),
    );
    invocation.resolved = Object.freeze({
      sceneName: invocation.request.sceneName,
      sceneInstanceId: invocation.handle.instanceId,
      hostId: record.registration.hostId,
      hostGeneration: record.registration.generation,
      requiredSatisfied: entries.every(
        (entry) => !entry.required || (entry.visibilitySatisfied && entry.cardinalitySatisfied),
      ),
      entries: Object.freeze(entries),
    });
    return invocation.resolved;
  }

  private resolveRequirement(
    record: HostRecord,
    invocation: InvocationRecord,
    requirement: SceneTargetRequirementV2,
  ): SceneTargetResolutionEntry {
    let candidates: TargetRecord[] = [];
    let qualificationHost = record;
    const rejectionCodes = new Set<SceneTargetResolutionFailureCode>();
    if (requirement.source.kind === "host") {
      candidates = [...record.targets.values()].filter(
        (target) => !target.released && target.handle.part === requirement.part,
      );
    } else {
      const external = invocation.request.externalTargets?.[requirement.source.handleKey];
      const externalRecord = external ? this.externals.get(external.externalTargetId) : undefined;
      const sourceHost = external ? this.hosts.get(external.sourceHostId) : undefined;
      const target = external && sourceHost ? sourceHost.targets.get(external.targetId) : undefined;
      if (
        !external ||
        !externalRecord ||
        externalRecord.handle !== external ||
        externalRecord.revoked ||
        external.providerId !== this.providerId ||
        (external.destinationHostId && external.destinationHostId !== record.registration.hostId) ||
        (external.expiresAfterInstanceId && external.expiresAfterInstanceId !== invocation.handle.instanceId) ||
        !target ||
        target.released ||
        target.handle.targetGeneration !== external.targetGeneration
      ) {
        rejectionCodes.add("target-source-tree");
      } else if (
        !requirement.identityOnly &&
        requirement.properties.some((property) => !external.allowedProperties.includes(property))
      ) {
        rejectionCodes.add("target-contract-mismatch");
      } else {
        candidates = [target];
        qualificationHost = sourceHost!;
      }
    }

    const accepted: TargetRecord[] = [];
    for (const target of candidates) {
      const codes = this.qualifyTarget(qualificationHost, target, requirement);
      codes.forEach((code) => rejectionCodes.add(code));
      if (codes.length === 0) accepted.push(target);
    }
    const cardinalitySatisfied =
      accepted.length >= requirement.cardinality.min && accepted.length <= requirement.cardinality.max;
    if (!cardinalitySatisfied && accepted.length < requirement.cardinality.min) rejectionCodes.add("target-not-found");
    if (!cardinalitySatisfied && accepted.length > requirement.cardinality.max) rejectionCodes.add("target-duplicate");
    if (cardinalitySatisfied) {
      for (const target of accepted) invocation.resolvedTargets.set(target.handle.targetId, target);
    }
    return Object.freeze({
      key: requirement.key,
      part: requirement.part,
      required: requirement.required,
      candidateCount: candidates.length,
      acceptedTargetIds: Object.freeze(cardinalitySatisfied ? accepted.map((target) => target.handle.targetId) : []),
      rejectionCodes: Object.freeze([...rejectionCodes]),
      visibilitySatisfied: accepted.length >= requirement.cardinality.min,
      cardinalitySatisfied,
    });
  }

  private qualifyTarget(
    record: HostRecord,
    target: TargetRecord,
    requirement: SceneTargetRequirementV2,
  ): SceneTargetResolutionFailureCode[] {
    const failures: SceneTargetResolutionFailureCode[] = [];
    if (target.handle.part !== requirement.part) failures.push("target-contract-mismatch");
    if (!target.element.isConnected) failures.push("target-disconnected");
    if (!record.registration.root.contains(target.element)) failures.push("target-outside-host");
    const nestedHost = [...this.hosts.values()].find(
      (candidate) =>
        candidate !== record &&
        !candidate.released &&
        record.registration.root.contains(candidate.registration.root) &&
        candidate.registration.root.contains(target.element),
    );
    if (nestedHost) failures.push("target-source-tree");
    if (
      !requirement.identityOnly &&
      requirement.properties.some((property) => !target.allowedProperties.includes(property))
    ) {
      failures.push("target-contract-mismatch");
    }
    if (!requirement.identityOnly && target.ownerHint && target.ownerHint !== requirement.owner)
      failures.push("target-wrong-owner");
    const rect = target.element.getBoundingClientRect();
    const hostRect = record.registration.root.getBoundingClientRect();
    const rendered = effectiveVisibility(target.element, record.registration.root);
    if (requirement.visibility.mustHaveNonZeroBox && (rect.width <= 0 || rect.height <= 0))
      failures.push("target-zero-box");
    if (
      (requirement.visibility.mustNotBeDisplayNone && rendered.display === "none") ||
      (requirement.visibility.mustNotBeVisibilityHidden && Boolean(rendered.visibility)) ||
      rendered.opacity < requirement.visibility.minimumEffectiveOpacity
    )
      failures.push("target-hidden");
    if (requirement.visibility.mustIntersectHost && !intersects(rect, hostRect)) failures.push("target-outside-host");
    if (requirement.visibility.rejectPageFlipSource && target.pageFlip?.role === "source")
      failures.push("target-source-tree");
    if (
      requirement.visibility.rejectStaleSceneInstance &&
      target.pageFlip &&
      (target.pageFlip.role === "stale-clone" || !target.pageFlip.current)
    )
      failures.push("target-stale-instance");
    return [...new Set(failures)];
  }

  private claim(record: HostRecord, invocation: InvocationRecord, request: SceneInvocationOwnershipRequest) {
    return this.ownership.claim(this.claimInput(record, invocation, request));
  }

  private claimInput(
    record: HostRecord,
    invocation: InvocationRecord,
    request: SceneInvocationOwnershipRequest,
  ): AnimationOwnershipClaimRequest {
    if (!invocation.resolved) this.resolveTargets(record, invocation);
    const target = invocation.resolvedTargets.get(request.targetId);
    const writableRequirement = invocation.request.targetContract.targets.find((requirement, index) => {
      const entry = invocation.resolved?.entries[index];
      return (
        !requirement.identityOnly &&
        requirement.owner === request.runtime &&
        request.properties.every((property) => requirement.properties.includes(property)) &&
        entry?.acceptedTargetIds.includes(request.targetId)
      );
    });
    if (!target || target.released || !writableRequirement) {
      return {
        ...request,
        sceneInstanceId: invocation.handle.instanceId,
        scope: invocation.handle.ownershipScope,
        targetGeneration: -1,
        element: record.registration.root,
        allowedProperties: writableRequirement?.properties ?? [],
      };
    }
    return {
      ...request,
      sceneInstanceId: invocation.handle.instanceId,
      scope: invocation.handle.ownershipScope,
      targetGeneration: target.handle.targetGeneration,
      element: target.element,
      allowedProperties: writableRequirement.properties,
    };
  }

  private async terminal(
    record: HostRecord,
    invocation: InvocationRecord,
    completion: SceneInvocationCompletion,
  ): Promise<SceneInvocationCleanupReceipt> {
    if (invocation.terminal) return Object.freeze({ ...invocation.terminal, alreadyTerminal: true });
    invocation.abortCleanup?.();
    let revokedExternalHandles = 0;
    for (const external of Object.values(invocation.request.externalTargets ?? {})) {
      if (external.lifetime === "scene" || external.expiresAfterInstanceId === invocation.handle.instanceId) {
        const record = this.externals.get(external.externalTargetId);
        if (record && record.handle === external && !record.revoked) {
          this.revokeExternal(external.externalTargetId);
          revokedExternalHandles += 1;
        }
      }
    }
    const releasedClaims = this.ownership.releaseScene(invocation.handle.instanceId);
    record.invocations.delete(invocation.handle.instanceId);
    invocation.resolvedTargets.clear();
    invocation.terminal = Object.freeze({
      instanceId: invocation.handle.instanceId,
      outcome: completion.outcome,
      releasedClaims,
      revokedExternalHandles,
      alreadyTerminal: false,
    });
    return invocation.terminal;
  }

  private staleResolution(record: HostRecord, invocation: InvocationRecord): SceneTargetResolutionReceipt {
    const entries = invocation.request.targetContract.targets.map((target) =>
      Object.freeze({
        key: target.key,
        part: target.part,
        required: target.required,
        candidateCount: 0,
        acceptedTargetIds: Object.freeze([]) as readonly SceneTargetId[],
        rejectionCodes: Object.freeze(["target-stale-instance" as const]),
        visibilitySatisfied: false,
        cardinalitySatisfied: false,
      }),
    );
    return Object.freeze({
      sceneName: invocation.request.sceneName,
      sceneInstanceId: invocation.handle.instanceId,
      hostId: record.registration.hostId,
      hostGeneration: record.registration.generation,
      requiredSatisfied: false,
      entries: Object.freeze(entries),
    });
  }

  private releaseTarget(record: HostRecord, targetId: SceneTargetId) {
    const target = record.targets.get(targetId);
    if (!target || target.released || target.releasing) return;
    target.releasing = true;
    for (const externalId of record.externalIds) {
      if (this.externals.get(externalId)?.handle.targetId === targetId) this.revokeExternal(externalId);
    }
    this.ownership.releaseTarget(targetId);
    target.released = true;
    target.element.removeAttribute("data-scene-target-id");
    record.targets.delete(targetId);
    record.targetsByKey.delete(target.key);
  }

  private releaseHost(record: HostRecord, reason: SceneInterruptionReason) {
    if (record.released) return;
    record.released = true;
    for (const externalId of [...record.externalIds]) this.revokeExternal(externalId);
    for (const invocation of [...record.invocations.values()]) {
      void this.terminal(record, invocation, { outcome: "aborted", finalSemanticState: reason });
    }
    for (const targetId of [...record.targets.keys()]) this.releaseTarget(record, targetId);
    const root = record.registration.root;
    if (root.getAttribute("data-scene-host-id") === record.registration.hostId) {
      root.removeAttribute("data-scene-host-id");
      root.removeAttribute("data-scene-host-kind");
    }
    this.hosts.delete(record.registration.hostId);
    if (record.key) this.hostIdsByKey.delete(record.key);
  }

  private revokeExternal(externalTargetId: ExternalSceneTargetId) {
    const external = this.externals.get(externalTargetId);
    if (!external || external.revoked) return;
    external.revoked = true;
    this.externals.delete(externalTargetId);
    this.hosts.get(external.handle.sourceHostId)?.externalIds.delete(externalTargetId);
  }

  private assertLiveHost(record: HostRecord) {
    if (
      this.destroyed ||
      record.released ||
      !record.registration.root.isConnected ||
      !this.hosts.has(record.registration.hostId)
    )
      throw new Error("Scene host is stale or disconnected");
  }
}
