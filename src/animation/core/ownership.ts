import type { AnimationOwner } from "./animation-types";

type PropertyOwner = { owner: AnimationOwner; properties: Set<string> };
const registry = new WeakMap<Element, PropertyOwner[]>();

export function claimAnimationOwnership(element: Element, owner: AnimationOwner, properties: readonly string[]) {
  const claims = registry.get(element) ?? [];
  const conflict = claims.find(
    (claim) => claim.owner !== owner && properties.some((property) => claim.properties.has(property)),
  );
  if (conflict) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[animation ownership] ${owner} cannot claim ${properties.join(", ")}; ${conflict.owner} already owns a conflicting property.`,
        element,
      );
    }
    return false;
  }
  const existing = claims.find((claim) => claim.owner === owner);
  if (existing) properties.forEach((property) => existing.properties.add(property));
  else claims.push({ owner, properties: new Set(properties) });
  registry.set(element, claims);
  element.setAttribute("data-animation-owner", owner);
  return true;
}

export function releaseAnimationOwnership(element: Element, owner: AnimationOwner) {
  const remaining = (registry.get(element) ?? []).filter((claim) => claim.owner !== owner);
  if (remaining.length) {
    registry.set(element, remaining);
    element.setAttribute("data-animation-owner", remaining.at(-1)!.owner);
  } else {
    registry.delete(element);
    element.removeAttribute("data-animation-owner");
  }
}

export function animationOwnerFor(element: Element, property: string) {
  return registry.get(element)?.find((claim) => claim.properties.has(property))?.owner ?? null;
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
