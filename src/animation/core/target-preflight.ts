import type {
  ScenePreflightFailure,
  ScenePreflightFailureCode,
  ScenePreflightReport,
  SceneTargetContract,
  SceneTargetElementObservation,
  SceneTargetRect,
  SceneTargetRequirement,
} from "./animation-types";
import { claimAnimationOwnershipWithEvidence, type AnimationOwnershipLease } from "./ownership";

export type SceneTargetPreflightOptions = {
  root: HTMLElement;
  contract: Pick<SceneTargetContract, "sceneName" | "requiredTargets" | "optionalTargets">;
  sceneInstanceId: string;
  hostId: string;
  now?: () => number;
  viewportRect?: SceneTargetRect;
};

export type ScenePreflightCleanupReport = {
  claimedCount: number;
  releasedCount: number;
  alreadyReleased: boolean;
};

export type SceneTargetPreflightResult = {
  report: ScenePreflightReport;
  release: () => ScenePreflightCleanupReport;
};

type RequirementResult = {
  observation: ScenePreflightReport["observations"][number];
  failures: ScenePreflightFailure[];
  satisfied: boolean;
  leases: AnimationOwnershipLease[];
};

type RenderedStyle = {
  display: string;
  visibility: string;
  effectiveOpacity: number;
};

function toRect(rect: DOMRect | SceneTargetRect): SceneTargetRect {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

function intersects(first: SceneTargetRect, second: SceneTargetRect) {
  if (first.width <= 0 || first.height <= 0 || second.width <= 0 || second.height <= 0) return false;
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function opacityOf(style: CSSStyleDeclaration) {
  const opacity = Number.parseFloat(style.opacity);
  return Number.isFinite(opacity) ? opacity : 1;
}

function renderedStyle(target: HTMLElement, root: HTMLElement): RenderedStyle {
  const view = target.ownerDocument.defaultView;
  let display = "";
  let visibility = "";
  let effectiveOpacity = 1;
  let current: HTMLElement | null = target;
  while (current) {
    const style = view?.getComputedStyle(current) ?? current.style;
    if (!display) display = style.display;
    if (!visibility) visibility = style.visibility;
    if (style.display === "none") display = "none";
    if (style.visibility === "hidden" || style.visibility === "collapse") visibility = style.visibility;
    effectiveOpacity *= opacityOf(style);
    if (current === root) break;
    current = current.parentElement;
  }
  return { display, visibility, effectiveOpacity };
}

function ancestorsThroughHost(target: HTMLElement, root: HTMLElement) {
  const ancestors: HTMLElement[] = [];
  let current: HTMLElement | null = target;
  while (current) {
    ancestors.push(current);
    if (current === root) break;
    current = current.parentElement;
  }
  return ancestors;
}

function isPageFlipSource(target: HTMLElement, root: HTMLElement) {
  return ancestorsThroughHost(target, root).some((element) => {
    if (element.hasAttribute("data-pageflip-source")) return true;
    if (!element.classList.contains("page-flip-source")) return false;
    return element.hasAttribute("inert") || element.getAttribute("aria-hidden") === "true";
  });
}

function hasStaleSceneInstance(target: HTMLElement, root: HTMLElement, sceneInstanceId: string) {
  return ancestorsThroughHost(target, root).some((element) => {
    const instance = element.getAttribute("data-scene-instance") ?? element.getAttribute("data-scene-instance-id");
    return instance !== null && instance !== sceneInstanceId;
  });
}

function defaultViewport(root: HTMLElement): SceneTargetRect {
  const view = root.ownerDocument.defaultView;
  const documentElement = root.ownerDocument.documentElement;
  return {
    x: 0,
    y: 0,
    width: view?.innerWidth ?? documentElement.clientWidth,
    height: view?.innerHeight ?? documentElement.clientHeight,
  };
}

function partTargets(root: HTMLElement, part: string) {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-scene-part]")).filter(
    (element) => element.getAttribute("data-scene-part") === part,
  );
}

function addFailure(
  failures: ScenePreflightFailure[],
  seen: Set<ScenePreflightFailureCode>,
  part: string,
  code: ScenePreflightFailureCode,
) {
  if (seen.has(code)) return;
  seen.add(code);
  failures.push({ part, code });
}

function inspectRequirement(
  root: HTMLElement,
  hostRect: SceneTargetRect,
  viewportRect: SceneTargetRect,
  sceneInstanceId: string,
  requirement: SceneTargetRequirement,
  required: boolean,
): RequirementResult {
  const targets = partTargets(root, requirement.part);
  const observations: SceneTargetElementObservation[] = [];
  const leases: AnimationOwnershipLease[] = [];
  const blockingCodes = new Set<ScenePreflightFailureCode>();
  let visibleCount = 0;
  let ownershipRejectedCount = 0;

  for (const target of targets) {
    const rect = toRect(target.getBoundingClientRect());
    const style = renderedStyle(target, root);
    const hostIntersection = intersects(rect, hostRect);
    const viewportIntersection = requirement.visibility.mustIntersectViewport
      ? intersects(rect, viewportRect)
      : undefined;
    const pageFlipSource = isPageFlipSource(target, root);
    const staleSceneInstance = hasStaleSceneInstance(target, root, sceneInstanceId);
    const observation: SceneTargetElementObservation = {
      connected: target.isConnected,
      rect,
      display: style.display,
      visibility: style.visibility,
      effectiveOpacity: style.effectiveOpacity,
      hostIntersection,
      ...(viewportIntersection === undefined ? {} : { viewportIntersection }),
      pageFlipSource,
      staleSceneInstance,
    };
    const invalidCodes: ScenePreflightFailureCode[] = [];
    if (requirement.visibility.mustBeConnected && !observation.connected) invalidCodes.push("disconnected-target");
    if (requirement.visibility.mustHaveNonZeroBox && (rect.width <= 0 || rect.height <= 0)) {
      invalidCodes.push("zero-box-target");
    }
    if (
      (requirement.visibility.mustNotBeDisplayNone && style.display === "none") ||
      (requirement.visibility.mustNotBeVisibilityHidden &&
        (style.visibility === "hidden" || style.visibility === "collapse")) ||
      style.effectiveOpacity < requirement.visibility.minimumEffectiveOpacity
    ) {
      invalidCodes.push("hidden-target");
    }
    if (requirement.visibility.mustIntersectHost && !hostIntersection) invalidCodes.push("outside-host");
    if (requirement.visibility.mustIntersectViewport && !viewportIntersection) invalidCodes.push("outside-viewport");
    if (requirement.visibility.rejectPageFlipSource && pageFlipSource) invalidCodes.push("page-flip-source");
    if (requirement.visibility.rejectStaleSceneInstance && staleSceneInstance) {
      invalidCodes.push("stale-scene-instance");
    }

    if (invalidCodes.length === 0) {
      visibleCount += 1;
      const lease = claimAnimationOwnershipWithEvidence(
        target,
        requirement.owner,
        requirement.properties,
        requirement.part,
      );
      if (lease.evidence.claimed) {
        observation.owner = lease.evidence.owner;
        leases.push(lease);
      } else {
        ownershipRejectedCount += 1;
        observation.rejectedOwner = lease.evidence.rejectedOwner;
        blockingCodes.add("ownership-rejected");
      }
    } else {
      invalidCodes.forEach((code) => blockingCodes.add(code));
    }
    observations.push(observation);
  }

  const duplicateCount = Math.max(0, targets.length - requirement.cardinality.max);
  const claimedCount = leases.length;
  const satisfied =
    !required ||
    (targets.length >= requirement.cardinality.min &&
      targets.length <= requirement.cardinality.max &&
      blockingCodes.size === 0 &&
      claimedCount === targets.length);
  const failures: ScenePreflightFailure[] = [];
  if (required && !satisfied) {
    const seen = new Set<ScenePreflightFailureCode>();
    blockingCodes.forEach((code) => addFailure(failures, seen, requirement.part, code));
    if (visibleCount < requirement.cardinality.min || claimedCount < requirement.cardinality.min) {
      addFailure(failures, seen, requirement.part, "missing-required-target");
    }
    if (duplicateCount > 0) addFailure(failures, seen, requirement.part, "duplicate-required-target");
  }

  return {
    observation: {
      part: requirement.part,
      required,
      matchedCount: targets.length,
      visibleCount,
      duplicateCount,
      ownershipRejectedCount,
      observations,
    },
    failures,
    satisfied,
    leases,
  };
}

export function preflightSceneTargets(options: SceneTargetPreflightOptions): SceneTargetPreflightResult {
  const now = options.now ?? (() => performance.now());
  const startedAt = now();
  const hostRect = toRect(options.root.getBoundingClientRect());
  const viewportRect = options.viewportRect ?? defaultViewport(options.root);
  const requirements = [
    ...options.contract.requiredTargets.map((requirement) => ({ requirement, required: true })),
    ...options.contract.optionalTargets.map((requirement) => ({ requirement, required: false })),
  ];
  const results = requirements.map(({ requirement, required }) =>
    inspectRequirement(options.root, hostRect, viewportRect, options.sceneInstanceId, requirement, required),
  );
  const completedAt = now();
  const leases = results.flatMap((result) => result.leases);
  let released = false;

  return {
    report: {
      sceneName: options.contract.sceneName,
      sceneInstanceId: options.sceneInstanceId,
      hostId: options.hostId,
      startedAt,
      completedAt,
      durationMs: Math.max(0, completedAt - startedAt),
      requiredSatisfied: results.every((result) => result.satisfied),
      observations: results.map((result) => result.observation),
      failures: results.flatMap((result) => result.failures),
    },
    release: () => {
      if (released) return { claimedCount: leases.length, releasedCount: 0, alreadyReleased: true };
      released = true;
      const releasedCount = leases.filter((lease) => lease.release().released).length;
      return { claimedCount: leases.length, releasedCount, alreadyReleased: false };
    },
  };
}
