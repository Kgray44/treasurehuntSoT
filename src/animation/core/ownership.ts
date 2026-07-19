import {
  normalizeAnimationRuntimeOwner,
  type AnimatedProperty,
  type AnimationOwner,
  type AnimationProviderId,
  type AnimationRuntimeOwner,
  type OwnershipClaimId,
  type OwnershipScope,
  type PropertyOwnershipGroup,
  type SceneInstanceId,
  type SceneTargetId,
} from "./animation-types";

const animatedProperties = new Set<AnimatedProperty>([
  "transform",
  "translate",
  "scale",
  "rotate",
  "opacity",
  "layout",
  "clip-path",
  "filter",
  "width",
  "height",
  "path-drawing",
  "stroke-dasharray",
  "stroke-dashoffset",
  "scroll-position",
  "visibility",
]);

const runtimeOwners = new Set<AnimationRuntimeOwner>([
  "gsap",
  "motion",
  "css",
  "page-flip",
  "rive",
  "lottie",
  "web-animations",
  "web-audio",
  "react",
  "dnd-kit",
]);

const groupByProperty: Readonly<Record<AnimatedProperty, PropertyOwnershipGroup>> = {
  transform: "spatial-transform",
  translate: "spatial-transform",
  scale: "spatial-transform",
  rotate: "spatial-transform",
  layout: "spatial-transform",
  opacity: "presence",
  visibility: "presence",
  width: "geometry",
  height: "geometry",
  "clip-path": "clipping",
  filter: "filtering",
  "path-drawing": "path-drawing",
  "stroke-dasharray": "path-drawing",
  "stroke-dashoffset": "path-drawing",
  "scroll-position": "scroll",
};

export function ownershipGroupFor(property: AnimatedProperty): PropertyOwnershipGroup {
  return groupByProperty[property];
}

export function normalizeAnimatedProperties(
  properties: readonly string[],
):
  | Readonly<{ ok: true; properties: readonly AnimatedProperty[]; groups: readonly PropertyOwnershipGroup[] }>
  | Readonly<{ ok: false; property: string }> {
  const unique = [...new Set(properties)];
  for (const property of unique) {
    if (!animatedProperties.has(property as AnimatedProperty)) return Object.freeze({ ok: false, property });
  }
  const normalized = unique as AnimatedProperty[];
  return Object.freeze({
    ok: true,
    properties: Object.freeze(normalized),
    groups: Object.freeze([...new Set(normalized.map(ownershipGroupFor))]),
  });
}

export type AnimationOwnershipConflictReason =
  | "provider-mismatch"
  | "target-stale"
  | "property-not-allowed"
  | "property-conflict"
  | "invocation-terminal";

export type AnimationOwnershipClaimRequest = Readonly<{
  sceneInstanceId: SceneInstanceId;
  targetId: SceneTargetId;
  targetGeneration: number;
  element: Element;
  runtime: AnimationRuntimeOwner;
  properties: readonly AnimatedProperty[];
  allowedProperties: readonly AnimatedProperty[];
  scope: OwnershipScope;
}>;

export type AnimationOwnershipClaim = Readonly<{
  claimId: OwnershipClaimId;
  providerId: AnimationProviderId;
  hostId: OwnershipScope["hostId"];
  sceneInstanceId: SceneInstanceId;
  targetId: SceneTargetId;
  targetGeneration: number;
  runtime: AnimationRuntimeOwner;
  properties: readonly AnimatedProperty[];
  groups: readonly PropertyOwnershipGroup[];
  scope: OwnershipScope;
  startedAt: number;
  status: "active" | "released" | "expired";
}>;

declare const writePermitBrand: unique symbol;

export type AnimationWritePermit = Readonly<{
  claimId: OwnershipClaimId;
  targetId: SceneTargetId;
  targetGeneration: number;
  runtime: AnimationRuntimeOwner;
  properties: readonly AnimatedProperty[];
  [writePermitBrand]: true;
}>;

export type AnimationOwnershipRejection = Readonly<{
  status: "rejected";
  requestedTargetId: SceneTargetId;
  property: AnimatedProperty;
  group: PropertyOwnershipGroup;
  requestedOwner: AnimationRuntimeOwner;
  existingOwner: AnimationRuntimeOwner;
  existingSceneInstanceId?: SceneInstanceId;
  reason: AnimationOwnershipConflictReason;
}>;

export type AnimationOwnershipGrant = Readonly<{
  status: "granted";
  claim: AnimationOwnershipClaim;
  permit: AnimationWritePermit;
  release: () => boolean;
}>;

export type AnimationOwnershipClaimResult = AnimationOwnershipGrant | AnimationOwnershipRejection;

export type AnimationOwnershipBatchResult =
  | Readonly<{
      status: "granted";
      grants: readonly AnimationOwnershipGrant[];
      release: () => number;
    }>
  | AnimationOwnershipRejection;

type ActiveClaim = {
  claim: AnimationOwnershipClaim;
  element: Element;
  permit: AnimationWritePermit;
  referenceCount: number;
};

function opaqueId(prefix: string) {
  const random =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function safeOwnershipWarning(result: AnimationOwnershipRejection) {
  return `[animation ownership] result=rejected owner=${result.requestedOwner} existingOwner=${result.existingOwner} group=${result.group} reason=${result.reason}`;
}

/** Provider-scoped Phase 2 ownership authority. */
export class AnimationOwnershipRegistry {
  private readonly claims = new Map<OwnershipClaimId, ActiveClaim>();
  private readonly claimsByTarget = new Map<SceneTargetId, Set<OwnershipClaimId>>();
  private readonly permits = new WeakSet<object>();
  private readonly terminalInstances = new Set<SceneInstanceId>();
  private destroyed = false;

  constructor(readonly providerId: AnimationProviderId) {}

  claim(request: AnimationOwnershipClaimRequest): AnimationOwnershipClaimResult {
    const result = this.claimBatch([request]);
    return result.status === "granted" ? result.grants[0]! : result;
  }

  claimBatch(requests: readonly AnimationOwnershipClaimRequest[]): AnimationOwnershipBatchResult {
    if (requests.length === 0) {
      return Object.freeze({ status: "granted", grants: Object.freeze([]), release: () => 0 });
    }

    const provisional = new Map<string, AnimationOwnershipClaimRequest>();
    for (const request of requests) {
      const rejection = this.validateRequest(request, [...provisional.values()]);
      if (rejection) {
        if (process.env.NODE_ENV !== "production") console.warn(safeOwnershipWarning(rejection));
        return rejection;
      }
      const groups = normalizeAnimatedProperties(request.properties);
      if (!groups.ok) continue;
      provisional.set(
        `${request.targetId}:${[...groups.groups].sort().join(",")}:${request.runtime}:${request.sceneInstanceId}`,
        request,
      );
    }

    const grants = requests.map((request) => this.grant(request));
    let released = false;
    return Object.freeze({
      status: "granted" as const,
      grants: Object.freeze(grants),
      release: () => {
        if (released) return 0;
        released = true;
        return grants.reduce((count, grant) => count + (grant.release() ? 1 : 0), 0);
      },
    });
  }

  allowsWrite(
    permit: AnimationWritePermit,
    input: Readonly<{
      targetId: SceneTargetId;
      targetGeneration: number;
      runtime: AnimationRuntimeOwner;
      property: AnimatedProperty;
    }>,
  ) {
    if (!this.permits.has(permit as object)) return false;
    const active = this.claims.get(permit.claimId);
    return Boolean(
      active &&
        active.claim.status === "active" &&
        active.permit === permit &&
        active.claim.targetId === input.targetId &&
        active.claim.targetGeneration === input.targetGeneration &&
        active.claim.runtime === input.runtime &&
        active.claim.properties.includes(input.property),
    );
  }

  releaseClaim(claimId: OwnershipClaimId) {
    const active = this.claims.get(claimId);
    if (!active) return false;
    active.referenceCount -= 1;
    if (active.referenceCount > 0) return true;
    this.claims.delete(claimId);
    const targetClaims = this.claimsByTarget.get(active.claim.targetId);
    targetClaims?.delete(claimId);
    if (targetClaims?.size === 0) this.claimsByTarget.delete(active.claim.targetId);
    this.reflectOwner(active.element, active.claim.targetId);
    return true;
  }

  releaseScene(sceneInstanceId: SceneInstanceId) {
    this.terminalInstances.add(sceneInstanceId);
    return this.releaseMatching((active) => active.claim.sceneInstanceId === sceneInstanceId);
  }

  releaseTarget(targetId: SceneTargetId) {
    return this.releaseMatching((active) => active.claim.targetId === targetId);
  }

  sweepStaleClaims() {
    return this.releaseMatching(
      (active) => !active.element.isConnected || this.terminalInstances.has(active.claim.sceneInstanceId),
    );
  }

  snapshot() {
    return Object.freeze({
      providerId: this.providerId,
      activeClaimCount: this.claims.size,
      targetCount: this.claimsByTarget.size,
      terminalInvocationCount: this.terminalInstances.size,
    });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const active of this.claims.values()) active.element.removeAttribute("data-animation-owner");
    this.claims.clear();
    this.claimsByTarget.clear();
    this.terminalInstances.clear();
  }

  private validateRequest(
    request: AnimationOwnershipClaimRequest,
    provisional: readonly AnimationOwnershipClaimRequest[],
  ): AnimationOwnershipRejection | null {
    const normalized = normalizeAnimatedProperties(request.properties);
    const fallbackProperty = request.properties[0] ?? "transform";
    const property = (normalized.ok ? normalized.properties[0] : fallbackProperty) as AnimatedProperty;
    const group = animatedProperties.has(property) ? ownershipGroupFor(property) : "spatial-transform";
    if (this.destroyed || request.scope.providerId !== this.providerId) {
      return this.rejection(request, property, group, request.runtime, "provider-mismatch");
    }
    if (!normalized.ok || normalized.properties.some((candidate) => !request.allowedProperties.includes(candidate))) {
      return this.rejection(request, property, group, request.runtime, "property-not-allowed");
    }
    if (this.terminalInstances.has(request.sceneInstanceId) || !request.element.isConnected) {
      return this.rejection(request, property, group, request.runtime, "target-stale");
    }

    const candidates = [
      ...this.activeClaimsForTarget(request.targetId).map((active) => ({
        runtime: active.claim.runtime,
        sceneInstanceId: active.claim.sceneInstanceId,
        targetGeneration: active.claim.targetGeneration,
        groups: active.claim.groups,
      })),
      ...provisional.map((candidate) => {
        const candidateProperties = normalizeAnimatedProperties(candidate.properties);
        return {
          runtime: candidate.runtime,
          sceneInstanceId: candidate.sceneInstanceId,
          targetGeneration: candidate.targetGeneration,
          groups: candidateProperties.ok ? candidateProperties.groups : [],
        };
      }),
    ];
    const conflict = candidates.find((candidate) => {
      const overlap = candidate.groups.some((candidateGroup) => normalized.groups.includes(candidateGroup));
      const compatible =
        candidate.runtime === request.runtime &&
        candidate.sceneInstanceId === request.sceneInstanceId &&
        candidate.targetGeneration === request.targetGeneration;
      return overlap && !compatible;
    });
    if (conflict) {
      const conflictGroup = normalized.groups.find((candidate) => conflict.groups.includes(candidate)) ?? group;
      const conflictProperty =
        normalized.properties.find((candidate) => ownershipGroupFor(candidate) === conflictGroup) ?? property;
      return this.rejection(
        request,
        conflictProperty,
        conflictGroup,
        conflict.runtime,
        "property-conflict",
        conflict.sceneInstanceId,
      );
    }
    return null;
  }

  private rejection(
    request: AnimationOwnershipClaimRequest,
    property: AnimatedProperty,
    group: PropertyOwnershipGroup,
    existingOwner: AnimationRuntimeOwner,
    reason: AnimationOwnershipConflictReason,
    existingSceneInstanceId?: SceneInstanceId,
  ): AnimationOwnershipRejection {
    return Object.freeze({
      status: "rejected" as const,
      requestedTargetId: request.targetId,
      property,
      group,
      requestedOwner: request.runtime,
      existingOwner,
      ...(existingSceneInstanceId ? { existingSceneInstanceId } : {}),
      reason,
    });
  }

  private grant(request: AnimationOwnershipClaimRequest): AnimationOwnershipGrant {
    const normalized = normalizeAnimatedProperties(request.properties);
    if (!normalized.ok) throw new Error("Animation ownership grant was not validated");
    const existing = this.activeClaimsForTarget(request.targetId).find(
      (active) =>
        active.claim.runtime === request.runtime &&
        active.claim.sceneInstanceId === request.sceneInstanceId &&
        active.claim.targetGeneration === request.targetGeneration &&
        active.claim.groups.length === normalized.groups.length &&
        active.claim.groups.every((group) => normalized.groups.includes(group)) &&
        normalized.properties.every((property) => active.claim.properties.includes(property)),
    );
    if (existing) {
      existing.referenceCount += 1;
      return this.publicGrant(existing);
    }

    const claimId = opaqueId("claim") as OwnershipClaimId;
    const claim = Object.freeze({
      claimId,
      providerId: this.providerId,
      hostId: request.scope.hostId,
      sceneInstanceId: request.sceneInstanceId,
      targetId: request.targetId,
      targetGeneration: request.targetGeneration,
      runtime: request.runtime,
      properties: normalized.properties,
      groups: normalized.groups,
      scope: request.scope,
      startedAt: typeof performance === "undefined" ? Date.now() : performance.now(),
      status: "active" as const,
    });
    const permit = Object.freeze({
      claimId,
      targetId: request.targetId,
      targetGeneration: request.targetGeneration,
      runtime: request.runtime,
      properties: normalized.properties,
    }) as AnimationWritePermit;
    const active: ActiveClaim = { claim, element: request.element, permit, referenceCount: 1 };
    this.claims.set(claimId, active);
    const targetClaims = this.claimsByTarget.get(request.targetId) ?? new Set<OwnershipClaimId>();
    targetClaims.add(claimId);
    this.claimsByTarget.set(request.targetId, targetClaims);
    this.permits.add(permit as object);
    this.reflectOwner(request.element, request.targetId);
    return this.publicGrant(active);
  }

  private publicGrant(active: ActiveClaim): AnimationOwnershipGrant {
    let released = false;
    return Object.freeze({
      status: "granted" as const,
      claim: active.claim,
      permit: active.permit,
      release: () => {
        if (released) return false;
        released = true;
        return this.releaseClaim(active.claim.claimId);
      },
    });
  }

  private activeClaimsForTarget(targetId: SceneTargetId) {
    return [...(this.claimsByTarget.get(targetId) ?? [])].flatMap((claimId) => {
      const active = this.claims.get(claimId);
      return active ? [active] : [];
    });
  }

  private releaseMatching(predicate: (claim: ActiveClaim) => boolean) {
    const matches = [...this.claims.values()].filter(predicate);
    for (const active of matches) {
      active.referenceCount = 1;
      this.releaseClaim(active.claim.claimId);
    }
    return matches.length;
  }

  private reflectOwner(element: Element, targetId: SceneTargetId) {
    const active = this.activeClaimsForTarget(targetId).at(-1);
    if (active) element.setAttribute("data-animation-owner", active.claim.runtime);
    else element.removeAttribute("data-animation-owner");
  }
}

// Bounded Phase 1 compatibility adapter. New Phase 2 code uses AnimationOwnershipRegistry.
type LegacyPropertyClaim = { owner: AnimationRuntimeOwner; properties: Set<string>; token: symbol };
type LegacyOwnershipState = {
  claims: LegacyPropertyClaim[];
  declarativeAttribute: string | null;
  declarativeOwner: AnimationRuntimeOwner | null;
};
const legacyRegistry = new WeakMap<Element, LegacyOwnershipState>();

export type AnimationOwnershipEvidence = {
  claimed: boolean;
  owner: AnimationRuntimeOwner;
  properties: string[];
  part?: string;
  rejectedOwner?: AnimationRuntimeOwner;
  conflictingProperties: string[];
};
export type AnimationOwnershipReleaseEvidence = {
  released: boolean;
  owner: AnimationRuntimeOwner;
  properties: string[];
  part?: string;
};
export type AnimationOwnershipLease = {
  evidence: AnimationOwnershipEvidence;
  release: () => AnimationOwnershipReleaseEvidence;
};

function declarativeOwnerFrom(attribute: string | null): AnimationRuntimeOwner | null {
  if (attribute === "st-page-flip") return "page-flip";
  return attribute && runtimeOwners.has(attribute as AnimationRuntimeOwner)
    ? (attribute as AnimationRuntimeOwner)
    : null;
}

function updateLegacyOwnerAttribute(element: Element, state: LegacyOwnershipState) {
  if (state.declarativeAttribute !== null) return;
  if (state.claims.length) element.setAttribute("data-animation-owner", state.claims.at(-1)!.owner);
  else element.removeAttribute("data-animation-owner");
}

function releaseLegacyClaim(element: Element, token: symbol) {
  const state = legacyRegistry.get(element);
  if (!state) return false;
  const remaining = state.claims.filter((claim) => claim.token !== token);
  const released = remaining.length !== state.claims.length;
  const nextState = { ...state, claims: remaining };
  if (remaining.length) legacyRegistry.set(element, nextState);
  else legacyRegistry.delete(element);
  updateLegacyOwnerAttribute(element, nextState);
  return released;
}

export function claimAnimationOwnershipWithEvidence(
  element: Element,
  owner: AnimationOwner,
  properties: readonly string[],
  part?: string,
): AnimationOwnershipLease {
  const normalizedOwner = normalizeAnimationRuntimeOwner(owner);
  const normalizedProperties = [...new Set(properties)];
  const existingState = legacyRegistry.get(element);
  const declarativeAttribute = existingState
    ? existingState.declarativeAttribute
    : element.getAttribute("data-animation-owner");
  const declarativeOwner = existingState ? existingState.declarativeOwner : declarativeOwnerFrom(declarativeAttribute);
  const declarativeConflict =
    declarativeAttribute !== null && (declarativeOwner === null || declarativeOwner !== normalizedOwner);
  const claims = existingState?.claims ?? [];
  const claimConflict = claims.find(
    (claim) =>
      claim.owner !== normalizedOwner && normalizedProperties.some((property) => claim.properties.has(property)),
  );
  const rejectedOwner = declarativeConflict ? declarativeOwner : claimConflict?.owner;
  const conflictingProperties = declarativeConflict
    ? normalizedProperties
    : claimConflict
      ? normalizedProperties.filter((property) => claimConflict.properties.has(property))
      : [];
  const evidence: AnimationOwnershipEvidence = {
    claimed: !declarativeConflict && !claimConflict,
    owner: normalizedOwner,
    properties: normalizedProperties,
    ...(part ? { part } : {}),
    ...(rejectedOwner ? { rejectedOwner } : {}),
    conflictingProperties,
  };
  if (declarativeConflict || claimConflict) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[animation ownership] owner=${normalizedOwner}${part ? ` part=${part}` : ""} rejectedOwner=${rejectedOwner ?? "unknown"} properties=${conflictingProperties.join(",")}`,
      );
    }
    return {
      evidence,
      release: () => ({
        released: false,
        owner: normalizedOwner,
        properties: normalizedProperties,
        ...(part ? { part } : {}),
      }),
    };
  }
  const token = Symbol(`animation-owner:${normalizedOwner}`);
  const state: LegacyOwnershipState = {
    claims: [...claims, { owner: normalizedOwner, properties: new Set(normalizedProperties), token }],
    declarativeAttribute,
    declarativeOwner,
  };
  legacyRegistry.set(element, state);
  updateLegacyOwnerAttribute(element, state);
  let released = false;
  return {
    evidence,
    release: () => {
      if (released)
        return { released: false, owner: normalizedOwner, properties: normalizedProperties, ...(part ? { part } : {}) };
      released = releaseLegacyClaim(element, token);
      return { released, owner: normalizedOwner, properties: normalizedProperties, ...(part ? { part } : {}) };
    },
  };
}

export function claimAnimationOwnership(element: Element, owner: AnimationOwner, properties: readonly string[]) {
  return claimAnimationOwnershipWithEvidence(element, owner, properties).evidence.claimed;
}

export function releaseAnimationOwnership(element: Element, owner: AnimationOwner) {
  const normalizedOwner = normalizeAnimationRuntimeOwner(owner);
  const state = legacyRegistry.get(element);
  if (!state) return;
  const remaining = state.claims.filter((claim) => claim.owner !== normalizedOwner);
  const nextState = { ...state, claims: remaining };
  if (remaining.length) legacyRegistry.set(element, nextState);
  else legacyRegistry.delete(element);
  updateLegacyOwnerAttribute(element, nextState);
}

export function animationOwnerFor(element: Element, property: string) {
  const state = legacyRegistry.get(element);
  const claimedOwner = state?.claims.find((claim) => claim.properties.has(property))?.owner;
  if (claimedOwner) return claimedOwner;
  if (state) return state.declarativeOwner;
  return declarativeOwnerFrom(element.getAttribute("data-animation-owner"));
}

export function claimSceneTargets(
  root: HTMLElement,
  selector: string,
  owner: AnimationOwner,
  properties: readonly string[],
) {
  const targets = Array.from(root.querySelectorAll(selector));
  const claimed = targets.filter((target) => claimAnimationOwnership(target, owner, properties));
  return () => claimed.forEach((target) => releaseAnimationOwnership(target, owner));
}
