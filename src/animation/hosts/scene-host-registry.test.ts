import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AnimatedProperty,
  ScenePlaybackKind,
  SceneHostKind,
  SceneTargetContractV2,
  SceneTargetRequirementV2,
} from "../core/animation-types";
import { defaultSceneCleanupPolicy } from "../core/final-state-handoff";
import { resolveMotionPolicy } from "../core/quality";
import { SceneHostRegistry } from "./scene-host-registry";
import type { SceneHostHandle } from "./scene-host-types";

const visibility = {
  mustBeConnected: true,
  mustHaveNonZeroBox: true,
  mustNotBeDisplayNone: true,
  mustNotBeVisibilityHidden: true,
  minimumEffectiveOpacity: 0.01,
  mustIntersectHost: true,
  mustIntersectViewport: false,
  rejectPageFlipSource: true,
  rejectStaleSceneInstance: true,
} as const;

function requirement(
  part = "route-path",
  properties: readonly AnimatedProperty[] = ["transform"],
): SceneTargetRequirementV2 {
  return {
    key: `${part}-primary`,
    part,
    source: { kind: "host" },
    required: true,
    cardinality: { min: 1, max: 1 },
    visibility,
    owner: "gsap",
    properties,
  };
}

function contract(kind: SceneHostKind, targets = [requirement()]): SceneTargetContractV2 {
  return {
    version: 2,
    sceneName: "route-draw",
    reachability: "production",
    expectedHostKinds: [kind],
    targets,
    timeoutMs: 1_000,
    playbackPolicy: {
      source: "explicit",
      replayable: true,
      allowUserSkip: true,
      allowPolicySkip: true,
      priority: 1,
    },
    acknowledgmentPolicy: {
      kind: "optional",
      acknowledgeOn: ["presented", "presented-fallback"],
      fallbackMustBeReadable: true,
      acknowledgmentOwner: "caller",
    },
    finalStatePolicy: { kind: "commit-final-state", semanticState: "route-visible" },
    cleanupPolicy: defaultSceneCleanupPolicy,
    reducedFallback: "semantic-final-state",
  };
}

function rect(element: Element, x = 0) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    x,
    y: 0,
    width: 100,
    height: 100,
    top: 0,
    right: x + 100,
    bottom: 100,
    left: x,
    toJSON: () => ({}),
  });
}

function hostRoot(parent: HTMLElement = document.body) {
  const root = document.createElement("section");
  parent.append(root);
  rect(root);
  return root;
}

function target(root: HTMLElement, key = "route-a") {
  const element = document.createElement("div");
  root.append(element);
  rect(element);
  return { element, key };
}

function begin(host: SceneHostHandle, targetContract = contract(host.kind), playback: ScenePlaybackKind = "live") {
  return host.beginScene({
    sceneName: "route-draw",
    playback,
    targetContract,
    motionPolicy: resolveMotionPolicy("full", false),
  });
}

describe("SceneHostRegistry", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("isolates identical target names in simultaneous registered hosts", async () => {
    const registry = new SceneHostRegistry();
    const rootA = hostRoot();
    const rootB = hostRoot();
    const hostA = registry.registerHost({ kind: "player-progression", root: rootA, hostKey: "player-a" });
    const hostB = registry.registerHost({ kind: "player-progression", root: rootB, hostKey: "player-b" });
    const targetA = target(rootA, "route-a");
    const targetB = target(rootB, "route-b");
    const handleA = hostA.registerTarget({
      targetKey: targetA.key,
      part: "route-path",
      element: targetA.element,
      allowedProperties: ["transform"],
    });
    const handleB = hostB.registerTarget({
      targetKey: targetB.key,
      part: "route-path",
      element: targetB.element,
      allowedProperties: ["transform"],
    });

    const invocationA = begin(hostA);
    const resolutionA = invocationA.resolveTargets();
    expect(resolutionA.requiredSatisfied).toBe(true);
    expect(resolutionA.entries[0]?.acceptedTargetIds).toEqual([handleA.targetId]);
    expect(resolutionA.entries[0]?.acceptedTargetIds).not.toContain(handleB.targetId);
    expect(invocationA.resolveTargets()).toBe(resolutionA);

    const claim = invocationA.claim({ targetId: handleA.targetId, runtime: "gsap", properties: ["transform"] });
    expect(claim.status).toBe("granted");
    if (claim.status !== "granted") return;
    const buildTargets = registry.createBuildTargetAccess(invocationA, resolutionA, [claim]);
    const routeTarget = buildTargets.require("route-path-primary").one();
    expect(buildTargets.keys()).toEqual(["route-path-primary"]);
    expect(routeTarget?.withElement("transform", (element) => element.setAttribute("data-permit-used", "yes"))).toEqual(
      {
        status: "applied",
        value: undefined,
      },
    );
    expect(routeTarget?.withElement("opacity", () => undefined)).toEqual({
      status: "denied",
      reason: "property-not-declared",
    });
    expect(targetA.element).toHaveAttribute("data-animation-owner", "gsap");
    expect(targetA.element).toHaveAttribute("data-permit-used", "yes");
    expect(targetB.element).not.toHaveAttribute("data-animation-owner");
    await invocationA.complete({ outcome: "completed", finalSemanticState: "route-visible" });
    expect(routeTarget?.withElement("transform", () => undefined)).toEqual({
      status: "denied",
      reason: "target-stale",
    });
    expect(targetA.element).not.toHaveAttribute("data-animation-owner");
    expect(registry.snapshot()).toMatchObject({
      registeredHostCount: 2,
      activeInvocationCount: 0,
      activeClaimCount: 0,
    });
  });

  it("accepts the exact current PageFlip primary while preserving rejected sibling diagnostics", () => {
    const registry = new SceneHostRegistry();
    const root = hostRoot();
    const host = registry.registerHost({ kind: "player-progression", root });
    const sourceA = target(root, "page-source-a");
    const currentPrimary = target(root, "page-primary-current");
    const offPagePrimary = target(root, "page-primary-off-page");
    const sourceB = target(root, "page-source-b");
    host.registerTarget({
      targetKey: sourceA.key,
      part: "page-content",
      element: sourceA.element,
      allowedProperties: ["opacity"],
      pageFlip: { role: "source", generation: 1, pageId: "page-a", current: true },
    });
    const currentHandle = host.registerTarget({
      targetKey: currentPrimary.key,
      part: "page-content",
      element: currentPrimary.element,
      allowedProperties: ["opacity"],
      pageFlip: { role: "visible-clone", generation: 2, pageId: "page-a", current: true },
    });
    host.registerTarget({
      targetKey: offPagePrimary.key,
      part: "page-content",
      element: offPagePrimary.element,
      allowedProperties: ["opacity"],
      pageFlip: { role: "visible-clone", generation: 2, pageId: "page-b", current: false },
    });
    host.registerTarget({
      targetKey: sourceB.key,
      part: "page-content",
      element: sourceB.element,
      allowedProperties: ["opacity"],
      pageFlip: { role: "source", generation: 1, pageId: "page-b", current: true },
    });
    const pageRequirement = requirement("page-content", ["opacity"]);

    const resolution = begin(host, contract(host.kind, [pageRequirement])).resolveTargets();

    expect(resolution.requiredSatisfied).toBe(true);
    expect(resolution.entries[0]).toMatchObject({
      candidateCount: 4,
      acceptedTargetIds: [currentHandle.targetId],
      rejectionCodes: expect.arrayContaining(["target-source-tree", "target-stale-instance"]),
      visibilitySatisfied: true,
      cardinalitySatisfied: true,
    });
    expect(resolution.entries[0]?.rejectionCodes).not.toContain("target-duplicate");
  });

  it("fails closed when every PageFlip sibling is rejected", () => {
    const registry = new SceneHostRegistry();
    const root = hostRoot();
    const host = registry.registerHost({ kind: "player-progression", root });
    const source = target(root, "page-source");
    const stale = target(root, "page-primary-stale");
    host.registerTarget({
      targetKey: source.key,
      part: "page-content",
      element: source.element,
      allowedProperties: ["opacity"],
      pageFlip: { role: "source", generation: 1, pageId: "page-a", current: true },
    });
    host.registerTarget({
      targetKey: stale.key,
      part: "page-content",
      element: stale.element,
      allowedProperties: ["opacity"],
      pageFlip: { role: "stale-clone", generation: 1, pageId: "page-a", current: false },
    });

    const resolution = begin(host, contract(host.kind, [requirement("page-content", ["opacity"])])).resolveTargets();

    expect(resolution.requiredSatisfied).toBe(false);
    expect(resolution.entries[0]).toMatchObject({
      candidateCount: 2,
      acceptedTargetIds: [],
      rejectionCodes: expect.arrayContaining(["target-source-tree", "target-stale-instance", "target-not-found"]),
      visibilitySatisfied: false,
      cardinalitySatisfied: false,
    });
  });

  it("still rejects multiple fully qualified targets beyond maximum cardinality", () => {
    const registry = new SceneHostRegistry();
    const root = hostRoot();
    const host = registry.registerHost({ kind: "player-progression", root });
    for (const key of ["page-primary-a", "page-primary-b"]) {
      const node = target(root, key);
      host.registerTarget({
        targetKey: node.key,
        part: "page-content",
        element: node.element,
        allowedProperties: ["opacity"],
        pageFlip: { role: "visible-clone", generation: 2, pageId: key, current: true },
      });
    }

    const resolution = begin(host, contract(host.kind, [requirement("page-content", ["opacity"])])).resolveTargets();

    expect(resolution.requiredSatisfied).toBe(false);
    expect(resolution.entries[0]).toMatchObject({
      candidateCount: 2,
      acceptedTargetIds: [],
      rejectionCodes: ["target-duplicate"],
      visibilitySatisfied: true,
      cardinalitySatisfied: false,
    });
  });

  it("denies missing and foreign permits without exposing a target element", async () => {
    const registry = new SceneHostRegistry();
    const root = hostRoot();
    const host = registry.registerHost({ kind: "player-progression", root });
    const node = target(root);
    const targetHandle = host.registerTarget({
      targetKey: node.key,
      part: "route-path",
      element: node.element,
      allowedProperties: ["transform"],
    });
    const invocation = begin(host);
    const resolution = invocation.resolveTargets();
    expect(() => registry.createBuildTargetAccess(invocation, resolution, [])).toThrow("ownership permit");

    const foreignRegistry = new SceneHostRegistry();
    const foreignRoot = hostRoot();
    const foreignHost = foreignRegistry.registerHost({ kind: "player-progression", root: foreignRoot });
    const foreignNode = target(foreignRoot, "foreign-route");
    const foreignTarget = foreignHost.registerTarget({
      targetKey: foreignNode.key,
      part: "route-path",
      element: foreignNode.element,
      allowedProperties: ["transform"],
    });
    const foreignInvocation = begin(foreignHost);
    foreignInvocation.resolveTargets();
    const foreignGrant = foreignInvocation.claim({
      targetId: foreignTarget.targetId,
      runtime: "gsap",
      properties: ["transform"],
    });
    expect(foreignGrant.status).toBe("granted");
    if (foreignGrant.status !== "granted") return;

    expect(
      registry.elementForInvocationTarget(invocation, targetHandle.targetId, foreignGrant.permit, "transform"),
    ).toBeNull();
    await invocation.abort("runtime-failed");
    await foreignInvocation.abort("runtime-failed");
    registry.destroy();
    foreignRegistry.destroy();
  });

  it("resolves and permit-gates an SVG path target without narrowing it to HTMLElement", async () => {
    const registry = new SceneHostRegistry();
    const root = hostRoot();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.append(path);
    root.append(svg);
    rect(path);
    const host = registry.registerHost({ kind: "player-progression", root });
    const targetHandle = host.registerTarget({
      targetKey: "route-svg",
      part: "route-path",
      element: path,
      allowedProperties: ["path-drawing", "stroke-dashoffset"],
    });
    const svgContract = contract(host.kind, [requirement("route-path", ["path-drawing", "stroke-dashoffset"])]);
    const invocation = begin(host, svgContract);
    const resolution = invocation.resolveTargets();
    const claim = invocation.claim({
      targetId: targetHandle.targetId,
      runtime: "gsap",
      properties: ["path-drawing", "stroke-dashoffset"],
    });
    expect(claim.status).toBe("granted");
    if (claim.status !== "granted") return;
    const permitted = registry
      .createBuildTargetAccess(invocation, resolution, [claim])
      .require("route-path-primary")
      .one();

    expect(permitted?.withElement("stroke-dashoffset", (element) => element === path)).toEqual({
      status: "applied",
      value: true,
    });
    expect(permitted?.withProperties(["path-drawing", "stroke-dashoffset"], (element) => element === path)).toEqual({
      status: "applied",
      value: true,
    });
    expect(permitted?.withProperties(["path-drawing", "opacity"], () => true)).toEqual({
      status: "denied",
      reason: "property-not-declared",
    });
    targetHandle.release();
    expect(permitted?.withElement("stroke-dashoffset", () => true)).toEqual({
      status: "denied",
      reason: "target-stale",
    });
    await invocation.abort("runtime-failed");
  });

  it("mints a provider-scoped runtime-surface lease with permit-gated writes and atomic conflict rejection", () => {
    const registry = new SceneHostRegistry();
    const root = hostRoot();
    const host = registry.registerHost({ kind: "player-section-enhancement", root });
    const node = target(root, "page-surface");
    const targetHandle = host.registerTarget({
      targetKey: node.key,
      part: "page-surface",
      element: node.element,
      allowedProperties: ["transform", "opacity"],
    });

    const lease = host.claimRuntimeSurface({
      target: targetHandle,
      element: node.element,
      runtime: "page-flip",
      properties: ["transform", "opacity"],
    });
    expect(lease.status).toBe("granted");
    if (lease.status !== "granted") return;
    expect(lease.lifecycleInstanceId).toContain(`${host.hostId}-runtime-surface-`);
    expect(lease.withElement("transform", (element) => element.setAttribute("data-runtime-surface", "owned"))).toEqual({
      status: "applied",
      value: undefined,
    });
    expect(lease.withProperties(["transform", "opacity"], (element) => element === node.element)).toEqual({
      status: "applied",
      value: true,
    });
    expect(lease.withProperties(["transform", "filter"], () => undefined)).toEqual({
      status: "denied",
      reason: "property-not-declared",
    });
    expect(node.element).toHaveAttribute("data-runtime-surface", "owned");
    expect(lease.withElement("width", () => undefined)).toEqual({
      status: "denied",
      reason: "property-not-declared",
    });

    expect(
      host.claimRuntimeSurface({
        target: targetHandle,
        element: node.element,
        runtime: "motion",
        properties: ["transform"],
      }),
    ).toMatchObject({ status: "rejected", reason: "ownership-rejected", ownershipReason: "property-conflict" });
    expect(registry.snapshot().activeClaimCount).toBe(1);
    expect(lease.release()).toBe(true);
    expect(lease.release()).toBe(false);
    expect(lease.withElement("transform", () => undefined)).toEqual({
      status: "denied",
      reason: "target-stale",
    });
    expect(registry.snapshot().activeClaimCount).toBe(0);
  });

  it("resolves identity-only external targets alongside a Motion lifecycle lease without scene write authority", async () => {
    const registry = new SceneHostRegistry();
    const sourceRoot = hostRoot();
    const destinationRoot = hostRoot();
    const source = registry.registerHost({ kind: "player-section-enhancement", root: sourceRoot });
    const destination = registry.registerHost({ kind: "player-progression", root: destinationRoot });
    const node = target(sourceRoot, "motion-layout-source");
    const targetHandle = source.registerTarget({
      targetKey: node.key,
      part: "artifact-layout-source",
      element: node.element,
      ownerHint: "motion",
      allowedProperties: ["layout"],
    });
    const motionLease = source.claimRuntimeSurface({
      target: targetHandle,
      element: node.element,
      runtime: "motion",
      properties: ["layout"],
    });
    expect(motionLease.status).toBe("granted");
    const external = source.exportTarget({
      target: targetHandle,
      destinationHostId: destination.hostId,
      allowedProperties: ["layout"],
      lifetime: "handoff",
    });
    const identityRequirement: SceneTargetRequirementV2 = {
      key: "artifact-layout-destination",
      part: "artifact-layout-source",
      source: { kind: "external", handleKey: "artifact" },
      required: true,
      identityOnly: true,
      cardinality: { min: 1, max: 1 },
      visibility,
      owner: null,
      properties: [],
    };
    const wrongPart = destination.beginScene({
      sceneName: "route-draw",
      playback: "live",
      targetContract: contract(destination.kind, [
        { ...identityRequirement, key: "wrong-identity", part: "different-artifact-part" },
      ]),
      motionPolicy: resolveMotionPolicy("full", false),
      externalTargets: { artifact: external },
    });
    expect(wrongPart.resolveTargets().entries[0]).toMatchObject({
      acceptedTargetIds: [],
      rejectionCodes: expect.arrayContaining(["target-contract-mismatch"]),
    });
    await wrongPart.abort("runtime-failed");
    const invocation = destination.beginScene({
      sceneName: "route-draw",
      playback: "live",
      targetContract: contract(destination.kind, [identityRequirement]),
      motionPolicy: resolveMotionPolicy("full", false),
      externalTargets: { artifact: external },
    });
    const resolution = invocation.resolveTargets();
    expect(resolution.requiredSatisfied).toBe(true);
    const identityTarget = registry
      .createBuildTargetAccess(invocation, resolution, [])
      .require("artifact-layout-destination")
      .one();
    expect(identityTarget).toMatchObject({
      targetId: targetHandle.targetId,
      identityOnly: true,
      runtime: null,
      properties: [],
    });
    expect(identityTarget?.withElement("layout", () => undefined)).toEqual({
      status: "denied",
      reason: "identity-only",
    });
    expect(identityTarget?.withProperties(["layout", "opacity"], () => undefined)).toEqual({
      status: "denied",
      reason: "identity-only",
    });
    expect(
      invocation.claim({ targetId: targetHandle.targetId, runtime: "motion", properties: ["layout"] }).status,
    ).toBe("rejected");
    expect(registry.snapshot().activeClaimCount).toBe(1);
    await invocation.complete({ outcome: "completed" });
    expect(registry.snapshot().activeClaimCount).toBe(1);
    if (motionLease.status === "granted") motionLease.release();
    expect(registry.snapshot().activeClaimCount).toBe(0);
  });

  it("rejects stale, mismatched and foreign runtime surfaces and tears leases down with the host", () => {
    const registryA = new SceneHostRegistry();
    const registryB = new SceneHostRegistry();
    const rootA = hostRoot();
    const rootB = hostRoot();
    const hostA = registryA.registerHost({ kind: "player-section-enhancement", root: rootA });
    const hostB = registryB.registerHost({ kind: "player-section-enhancement", root: rootB });
    const nodeA = target(rootA, "surface-a");
    const nodeB = target(rootB, "surface-b");
    const targetA = hostA.registerTarget({
      targetKey: nodeA.key,
      part: "page-surface",
      element: nodeA.element,
      allowedProperties: ["transform"],
    });
    const targetB = hostB.registerTarget({
      targetKey: nodeB.key,
      part: "page-surface",
      element: nodeB.element,
      allowedProperties: ["transform"],
    });

    expect(
      hostA.claimRuntimeSurface({
        target: targetB,
        element: nodeB.element,
        runtime: "page-flip",
        properties: ["transform"],
      }),
    ).toEqual({ status: "rejected", reason: "target-foreign" });
    expect(
      hostA.claimRuntimeSurface({
        target: targetA,
        element: nodeB.element,
        runtime: "page-flip",
        properties: ["transform"],
      }),
    ).toEqual({ status: "rejected", reason: "element-mismatch" });

    const lease = hostA.claimRuntimeSurface({
      target: targetA,
      element: nodeA.element,
      runtime: "page-flip",
      properties: ["transform"],
    });
    expect(lease.status).toBe("granted");
    if (lease.status !== "granted") return;
    expect(lease.providerId).toBe(registryA.providerId);
    expect(lease.providerId).not.toBe(registryB.providerId);
    hostA.release();
    expect(lease.withElement("transform", () => undefined)).toEqual({
      status: "denied",
      reason: "target-stale",
    });
    expect(lease.release()).toBe(false);
    expect(
      hostA.claimRuntimeSurface({
        target: targetA,
        element: nodeA.element,
        runtime: "page-flip",
        properties: ["transform"],
      }),
    ).toEqual({ status: "rejected", reason: "host-stale" });
    expect(registryA.snapshot().activeClaimCount).toBe(0);

    targetB.release();
    expect(
      hostB.claimRuntimeSurface({
        target: targetB,
        element: nodeB.element,
        runtime: "page-flip",
        properties: ["transform"],
      }),
    ).toEqual({ status: "rejected", reason: "target-stale" });
    registryA.destroy();
    registryB.destroy();
  });

  it("mints a unique immutable invocation for every live and replay request", async () => {
    const registry = new SceneHostRegistry();
    const root = hostRoot();
    const host = registry.registerHost({ kind: "player-progression", root });
    const node = target(root);
    host.registerTarget({
      targetKey: node.key,
      part: "route-path",
      element: node.element,
      allowedProperties: ["transform"],
    });

    const first = begin(host);
    const replay = begin(host, contract(host.kind), "replay");
    expect(first.instanceId).not.toBe(replay.instanceId);
    expect(first.invocationSequence).toBe(1);
    expect(replay.invocationSequence).toBe(2);
    expect(first.playback).toBe("live");
    expect(replay.playback).toBe("replay");
    await first.complete({ outcome: "completed" });
    await replay.complete({ outcome: "completed" });
  });

  it("rejects duplicate host keys and prevents a parent from registering a nested host target", () => {
    const registry = new SceneHostRegistry();
    const parentRoot = hostRoot();
    const childRoot = hostRoot(parentRoot);
    const parent = registry.registerHost({ kind: "player-progression", root: parentRoot, hostKey: "same-key" });
    expect(() => registry.registerHost({ kind: "access", root: hostRoot(), hostKey: "same-key" })).toThrow(
      "Duplicate scene host key",
    );
    const child = registry.registerHost({ kind: "player-section-enhancement", root: childRoot });
    const childTarget = target(childRoot, "child-route");
    expect(() =>
      parent.registerTarget({
        targetKey: "wrong-parent",
        part: "route-path",
        element: childTarget.element,
        allowedProperties: ["transform"],
      }),
    ).toThrow("nested host");
    expect(
      child.registerTarget({
        targetKey: childTarget.key,
        part: "route-path",
        element: childTarget.element,
        allowedProperties: ["transform"],
      }).hostId,
    ).toBe(child.hostId);
  });

  it("validates registry-minted external handles and rejects foreign or revoked capabilities", async () => {
    const registry = new SceneHostRegistry();
    const sourceRoot = hostRoot();
    const destinationRoot = hostRoot();
    const source = registry.registerHost({ kind: "player-progression", root: sourceRoot });
    const destination = registry.registerHost({ kind: "player-section-enhancement", root: destinationRoot });
    const node = target(sourceRoot, "artifact-source");
    const sourceTarget = source.registerTarget({
      targetKey: node.key,
      part: "artifact",
      element: node.element,
      allowedProperties: ["transform", "opacity"],
    });
    expect(registry.isRegisteredHandle(source)).toBe(true);
    expect(registry.isRegisteredHandle({ ...source })).toBe(false);
    expect(() =>
      source.exportTarget({
        target: { ...sourceTarget },
        destinationHostId: destination.hostId,
        allowedProperties: ["transform"],
        lifetime: "scene",
      }),
    ).toThrow("live registered target");
    const external = source.exportTarget({
      target: sourceTarget,
      destinationHostId: destination.hostId,
      allowedProperties: ["transform"],
      lifetime: "scene",
    });
    const externalRequirement: SceneTargetRequirementV2 = {
      ...requirement("artifact"),
      key: "artifact-source",
      source: { kind: "external", handleKey: "source" },
    };
    const forgedExternal = { ...external, allowedProperties: ["transform", "opacity"] as const };
    const forgedInvocation = destination.beginScene({
      sceneName: "route-draw",
      playback: "live",
      targetContract: contract(destination.kind, [externalRequirement]),
      motionPolicy: resolveMotionPolicy("full", false),
      externalTargets: { source: forgedExternal },
    });
    expect(forgedInvocation.resolveTargets().entries[0]).toMatchObject({
      acceptedTargetIds: [],
      rejectionCodes: expect.arrayContaining(["target-source-tree"]),
    });
    await forgedInvocation.abort("runtime-failed");
    const invocation = destination.beginScene({
      sceneName: "route-draw",
      playback: "live",
      targetContract: contract(destination.kind, [externalRequirement]),
      motionPolicy: resolveMotionPolicy("full", false),
      externalTargets: { source: external },
    });
    expect(invocation.resolveTargets().entries[0]).toMatchObject({
      acceptedTargetIds: [sourceTarget.targetId],
      rejectionCodes: [],
    });
    await invocation.complete({ outcome: "completed" });

    const afterRevoke = destination.beginScene({
      sceneName: "route-draw",
      playback: "replay",
      targetContract: contract(destination.kind, [externalRequirement]),
      motionPolicy: resolveMotionPolicy("full", false),
      externalTargets: { source: external },
    });
    expect(afterRevoke.resolveTargets().entries[0]?.rejectionCodes).toContain("target-source-tree");
    await afterRevoke.abort("runtime-failed");

    const foreignRegistry = new SceneHostRegistry();
    expect(foreignRegistry.providerId).not.toBe(registry.providerId);
    registry.destroy();
    foreignRegistry.destroy();
  });

  it("rejects writable external targets with the wrong part, runtime hint, or property capability", async () => {
    const registry = new SceneHostRegistry();
    const sourceRoot = hostRoot();
    const destinationRoot = hostRoot();
    const source = registry.registerHost({ kind: "player-progression", root: sourceRoot });
    const destination = registry.registerHost({ kind: "player-section-enhancement", root: destinationRoot });
    const node = target(sourceRoot, "bounded-artifact");
    const targetHandle = source.registerTarget({
      targetKey: node.key,
      part: "artifact",
      element: node.element,
      ownerHint: "gsap",
      allowedProperties: ["transform", "opacity"],
    });
    const external = source.exportTarget({
      target: targetHandle,
      destinationHostId: destination.hostId,
      allowedProperties: ["transform"],
      lifetime: "handoff",
    });
    const cases: SceneTargetRequirementV2[] = [
      {
        ...requirement("wrong-part"),
        key: "wrong-part",
        source: { kind: "external", handleKey: "source" },
        identityOnly: false,
        owner: "gsap",
        properties: ["transform"],
      },
      {
        ...requirement("artifact"),
        key: "wrong-runtime",
        source: { kind: "external", handleKey: "source" },
        identityOnly: false,
        owner: "motion",
        properties: ["transform"],
      },
      {
        ...requirement("artifact", ["opacity"]),
        key: "insufficient-properties",
        source: { kind: "external", handleKey: "source" },
        identityOnly: false,
        owner: "gsap",
        properties: ["opacity"],
      },
    ];
    for (const targetContract of cases) {
      const invocation = destination.beginScene({
        sceneName: "route-draw",
        playback: "live",
        targetContract: contract(destination.kind, [targetContract]),
        motionPolicy: resolveMotionPolicy("full", false),
        externalTargets: { source: external },
      });
      const entry = invocation.resolveTargets().entries[0];
      expect(entry?.acceptedTargetIds).toEqual([]);
      expect(entry?.rejectionCodes).toEqual(
        expect.arrayContaining([
          targetContract.key === "wrong-runtime" ? "target-wrong-owner" : "target-contract-mismatch",
        ]),
      );
      await invocation.abort("runtime-failed");
    }
  });

  it("revokes scene external handles before releasing invocation ownership claims", async () => {
    const registry = new SceneHostRegistry();
    const sourceRoot = hostRoot();
    const destinationRoot = hostRoot();
    const source = registry.registerHost({ kind: "player-progression", root: sourceRoot });
    const destination = registry.registerHost({ kind: "player-section-enhancement", root: destinationRoot });
    const node = target(sourceRoot, "ordered-cleanup");
    const targetHandle = source.registerTarget({
      targetKey: node.key,
      part: "artifact",
      element: node.element,
      ownerHint: "gsap",
      allowedProperties: ["transform"],
    });
    const external = source.exportTarget({
      target: targetHandle,
      destinationHostId: destination.hostId,
      allowedProperties: ["transform"],
      lifetime: "scene",
    });
    const targetContract: SceneTargetRequirementV2 = {
      ...requirement("artifact"),
      key: "ordered-artifact",
      source: { kind: "external", handleKey: "source" },
      identityOnly: false,
      owner: "gsap",
      properties: ["transform"],
    };
    const invocation = destination.beginScene({
      sceneName: "route-draw",
      playback: "live",
      targetContract: contract(destination.kind, [targetContract]),
      motionPolicy: resolveMotionPolicy("full", false),
      externalTargets: { source: external },
    });
    invocation.resolveTargets();
    expect(
      invocation.claim({ targetId: targetHandle.targetId, runtime: "gsap", properties: ["transform"] }).status,
    ).toBe("granted");
    expect(registry.snapshot()).toMatchObject({ externalHandleCount: 1, activeClaimCount: 1 });
    const releaseScene = registry.ownership.releaseScene.bind(registry.ownership);
    let externalCountAtOwnershipRelease = -1;
    vi.spyOn(registry.ownership, "releaseScene").mockImplementation((instanceId) => {
      externalCountAtOwnershipRelease = registry.snapshot().externalHandleCount;
      return releaseScene(instanceId);
    });

    await invocation.complete({ outcome: "completed" });

    expect(externalCountAtOwnershipRelease).toBe(0);
    expect(registry.snapshot()).toMatchObject({ externalHandleCount: 0, activeClaimCount: 0 });
  });

  it("revokes external handles before target and host teardown ownership release", async () => {
    const registry = new SceneHostRegistry();
    const directRoot = hostRoot();
    const directHost = registry.registerHost({ kind: "player-progression", root: directRoot });
    const directNode = target(directRoot, "direct-release");
    const directTarget = directHost.registerTarget({
      targetKey: directNode.key,
      part: "route-path",
      element: directNode.element,
      allowedProperties: ["transform"],
    });
    directHost.exportTarget({ target: directTarget, allowedProperties: ["transform"], lifetime: "handoff" });
    const directLease = directHost.claimRuntimeSurface({
      target: directTarget,
      element: directNode.element,
      runtime: "gsap",
      properties: ["transform"],
    });
    expect(directLease.status).toBe("granted");
    const releaseTarget = registry.ownership.releaseTarget.bind(registry.ownership);
    let directExternalCount = -1;
    let targetWasLiveAtOwnershipRelease = false;
    vi.spyOn(registry.ownership, "releaseTarget").mockImplementation((targetId) => {
      directExternalCount = registry.snapshot().externalHandleCount;
      targetWasLiveAtOwnershipRelease =
        directNode.element.hasAttribute("data-scene-target-id") &&
        directLease.status === "granted" &&
        directLease.withElement("transform", () => undefined).status === "applied";
      return releaseTarget(targetId);
    });
    directTarget.release();
    expect(directExternalCount).toBe(0);
    expect(targetWasLiveAtOwnershipRelease).toBe(true);

    const hostRootNode = hostRoot();
    const host = registry.registerHost({ kind: "player-progression", root: hostRootNode });
    const hostNode = target(hostRootNode, "host-release");
    const hostTarget = host.registerTarget({
      targetKey: hostNode.key,
      part: "route-path",
      element: hostNode.element,
      allowedProperties: ["transform"],
    });
    host.exportTarget({ target: hostTarget, allowedProperties: ["transform"], lifetime: "handoff" });
    const invocation = begin(host);
    invocation.resolveTargets();
    expect(invocation.claim({ targetId: hostTarget.targetId, runtime: "gsap", properties: ["transform"] }).status).toBe(
      "granted",
    );
    const releaseScene = registry.ownership.releaseScene.bind(registry.ownership);
    let hostExternalCount = -1;
    vi.spyOn(registry.ownership, "releaseScene").mockImplementation((instanceId) => {
      hostExternalCount = registry.snapshot().externalHandleCount;
      return releaseScene(instanceId);
    });
    host.release();
    expect(hostExternalCount).toBe(0);
    expect(registry.snapshot()).toMatchObject({ externalHandleCount: 0, activeClaimCount: 0 });
  });

  it("releases targets, invocations, external handles, claims and DOM references idempotently", async () => {
    const registry = new SceneHostRegistry();
    const root = hostRoot();
    const host = registry.registerHost({ kind: "player-progression", root });
    const node = target(root);
    const targetHandle = host.registerTarget({
      targetKey: node.key,
      part: "route-path",
      element: node.element,
      allowedProperties: ["transform"],
    });
    const invocation = begin(host);
    invocation.resolveTargets();
    const claim = invocation.claim({ targetId: targetHandle.targetId, runtime: "gsap", properties: ["transform"] });
    expect(claim.status).toBe("granted");
    host.release();
    host.release();
    const terminal = await invocation.abort("host-unmounted");

    expect(terminal.alreadyTerminal).toBe(true);
    expect(registry.snapshot()).toMatchObject({
      registeredHostCount: 0,
      registeredTargetCount: 0,
      activeInvocationCount: 0,
      externalHandleCount: 0,
      activeClaimCount: 0,
    });
    expect(root).not.toHaveAttribute("data-scene-host-id");
    expect(node.element).not.toHaveAttribute("data-scene-target-id");
  });
});
