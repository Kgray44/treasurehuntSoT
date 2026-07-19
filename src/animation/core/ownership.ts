import { normalizeAnimationRuntimeOwner, type AnimationOwner, type AnimationRuntimeOwner } from "./animation-types";

type PropertyClaim = {
  owner: AnimationRuntimeOwner;
  properties: Set<string>;
  token: symbol;
};

type OwnershipState = {
  claims: PropertyClaim[];
  declarativeAttribute: string | null;
  declarativeOwner: AnimationRuntimeOwner | null;
};

const registry = new WeakMap<Element, OwnershipState>();

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
]);

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

function updateOwnerAttribute(element: Element, state: OwnershipState) {
  // A component-authored ownership declaration is source truth. Claims made by
  // this registry must neither replace it while active nor remove it on release.
  if (state.declarativeAttribute !== null) return;
  if (state.claims.length) element.setAttribute("data-animation-owner", state.claims.at(-1)!.owner);
  else element.removeAttribute("data-animation-owner");
}

function releaseClaim(element: Element, token: symbol) {
  const state = registry.get(element);
  if (!state) return false;
  const remaining = state.claims.filter((claim) => claim.token !== token);
  const released = remaining.length !== state.claims.length;
  const nextState = { ...state, claims: remaining };
  if (remaining.length) registry.set(element, nextState);
  else registry.delete(element);
  updateOwnerAttribute(element, nextState);
  return released;
}

function sanitizedOwnershipWarning(evidence: AnimationOwnershipEvidence) {
  const part = evidence.part ? ` part=${evidence.part}` : "";
  return `[animation ownership] owner=${evidence.owner}${part} rejectedOwner=${evidence.rejectedOwner ?? "unknown"} properties=${evidence.conflictingProperties.join(",")}`;
}

export function claimAnimationOwnershipWithEvidence(
  element: Element,
  owner: AnimationOwner,
  properties: readonly string[],
  part?: string,
): AnimationOwnershipLease {
  const normalizedOwner = normalizeAnimationRuntimeOwner(owner);
  const normalizedProperties = [...new Set(properties)];
  const existingState = registry.get(element);
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
    if (process.env.NODE_ENV !== "production") console.warn(sanitizedOwnershipWarning(evidence));
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
  const claim: PropertyClaim = { owner: normalizedOwner, properties: new Set(normalizedProperties), token };
  const state: OwnershipState = {
    claims: [...claims, claim],
    declarativeAttribute,
    declarativeOwner,
  };
  registry.set(element, state);
  updateOwnerAttribute(element, state);
  let released = false;
  return {
    evidence,
    release: () => {
      if (released) {
        return {
          released: false,
          owner: normalizedOwner,
          properties: normalizedProperties,
          ...(part ? { part } : {}),
        };
      }
      released = releaseClaim(element, token);
      return {
        released,
        owner: normalizedOwner,
        properties: normalizedProperties,
        ...(part ? { part } : {}),
      };
    },
  };
}

/** Compatibility wrapper for callers that release all claims for one owner. */
export function claimAnimationOwnership(element: Element, owner: AnimationOwner, properties: readonly string[]) {
  return claimAnimationOwnershipWithEvidence(element, owner, properties).evidence.claimed;
}

export function releaseAnimationOwnership(element: Element, owner: AnimationOwner) {
  const normalizedOwner = normalizeAnimationRuntimeOwner(owner);
  const state = registry.get(element);
  if (!state) return;
  const remaining = state.claims.filter((claim) => claim.owner !== normalizedOwner);
  const nextState = { ...state, claims: remaining };
  if (remaining.length) registry.set(element, nextState);
  else registry.delete(element);
  updateOwnerAttribute(element, nextState);
}

export function animationOwnerFor(element: Element, property: string) {
  const state = registry.get(element);
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
