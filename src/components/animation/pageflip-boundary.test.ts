import { afterEach, describe, expect, it } from "vitest";
import type { SceneTargetContractV2 } from "@/animation/core/animation-types";
import { defaultSceneCleanupPolicy } from "@/animation/core/final-state-handoff";
import { resolveMotionPolicy } from "@/animation/core/quality";
import { SceneHostRegistry } from "@/animation/hosts/scene-host-registry";
import {
  createPageFlipMountId,
  getPageFlipCloneBoundary,
  PageFlipBoundaryController,
  type PageFlipPageTargetAuthority,
  qualifiesPageFlipClone,
} from "./pageflip-boundary";

const activeControllers: PageFlipBoundaryController[] = [];
const activeRegistries: SceneHostRegistry[] = [];

function fixture(onPageTargetsChange?: (authority: PageFlipPageTargetAuthority | null) => void) {
  const sourceRoot = document.createElement("div");
  sourceRoot.className = "page-flip-source";
  sourceRoot.innerHTML = `
    <article id="page-one">
      <h2 id="heading-one">First page</h2>
      <label for="answer-one" aria-describedby="hint-one">Answer</label>
      <input id="answer-one" aria-labelledby="heading-one" aria-describedby="hint-one" />
      <p id="hint-one">A harmless hint</p>
      <svg aria-hidden="true"><defs><clipPath id="clip-one"><path /></clipPath></defs><path clip-path="url(#clip-one)" /></svg>
      <span data-scene-part="chapter-heading" data-gsap-owned data-scene-instance="stale">Ink</span>
    </article>
    <article id="page-two"><h2 id="heading-two">Second page</h2><span data-scene-part="chapter-heading" data-gsap-owned>Off-page ink</span></article>
  `;
  const runtimeRoot = document.createElement("div");
  runtimeRoot.className = "page-flip-runtime";
  const shell = document.createElement("section");
  shell.append(sourceRoot, runtimeRoot);
  document.body.append(shell);
  const registry = new SceneHostRegistry();
  const sceneHost = registry.registerHost({ kind: "player-section-enhancement", root: shell });
  const controller = new PageFlipBoundaryController({
    mountId: createPageFlipMountId("test-book"),
    runtimeGeneration: 1,
    bookId: "test-book",
    runtimeRoot,
    sourceRoot,
    sceneHost,
    onPageTargetsChange,
  });
  activeControllers.push(controller);
  activeRegistries.push(registry);
  return { controller, runtimeRoot, sourceRoot, shell, registry, sceneHost };
}

function pageTargetContract(): SceneTargetContractV2 {
  return {
    version: 2,
    sceneName: "chapter-heading",
    reachability: "production",
    expectedHostKinds: ["player-section-enhancement"],
    targets: [
      {
        key: "page-heading",
        part: "chapter-heading",
        source: { kind: "host" },
        required: true,
        cardinality: { min: 1, max: 4 },
        visibility: {
          mustBeConnected: true,
          mustHaveNonZeroBox: false,
          mustNotBeDisplayNone: false,
          mustNotBeVisibilityHidden: false,
          minimumEffectiveOpacity: 0,
          mustIntersectHost: false,
          mustIntersectViewport: false,
          rejectPageFlipSource: true,
          rejectStaleSceneInstance: true,
        },
        owner: "gsap",
        properties: ["transform"],
      },
    ],
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
    finalStatePolicy: { kind: "commit-final-state", semanticState: "page-heading-ready" },
    cleanupPolicy: defaultSceneCleanupPolicy,
    reducedFallback: "semantic-final-state",
  };
}

describe("PageFlip source and clone boundary", () => {
  afterEach(() => {
    for (const controller of activeControllers.splice(0)) controller.dispose();
    for (const registry of activeRegistries.splice(0)) registry.destroy();
    document.body.replaceChildren();
  });

  it("excludes the source and qualifies only a connected current primary clone by default", () => {
    const { controller, runtimeRoot, sourceRoot } = fixture();
    const pages = controller.preparePages(["first", "second"], "revision-1");
    runtimeRoot.append(...pages);
    controller.bindPrimaryPages(0, "landscape");

    expect(sourceRoot).toHaveAttribute("aria-hidden", "true");
    expect(sourceRoot).toHaveAttribute("inert");
    expect(sourceRoot).toHaveAttribute("data-pageflip-role", "source");
    expect(sourceRoot.querySelector("[data-scene-instance]")).toBeNull();

    const first = getPageFlipCloneBoundary(pages[0]!);
    const second = getPageFlipCloneBoundary(pages[1]!);
    expect(first).toMatchObject({ role: "primary", current: true, lifecycle: "visible", pageId: "first" });
    expect(second).toMatchObject({ role: "primary", current: false, lifecycle: "visible", pageId: "second" });
    expect(
      qualifiesPageFlipClone(pages[0]!, {
        pageFlipInstanceId: first!.pageFlipInstanceId,
        cloneGeneration: first!.cloneGeneration,
      }),
    ).toBe(true);
    expect(
      qualifiesPageFlipClone(pages[1]!, {
        pageFlipInstanceId: second!.pageFlipInstanceId,
        cloneGeneration: second!.cloneGeneration,
      }),
    ).toBe(false);
    expect(
      qualifiesPageFlipClone(pages[1]!, {
        pageFlipInstanceId: second!.pageFlipInstanceId,
        cloneGeneration: second!.cloneGeneration,
        allowOffPage: true,
      }),
    ).toBe(true);
  });

  it("registers exact PageFlip authority and resolves only the current visible primary target", async () => {
    const authorities: PageFlipPageTargetAuthority[] = [];
    const { controller, runtimeRoot, sourceRoot, registry, sceneHost } = fixture((authority) => {
      if (authority) authorities.push(authority);
    });
    const pages = controller.preparePages(["first", "second"], "revision-1");
    runtimeRoot.append(...pages);
    controller.bindPrimaryPages(0, "landscape");

    const firstAuthority = authorities.at(-1)!;
    const primaryTargets = firstAuthority.targets.filter((target) => target.role === "primary");
    const currentPrimary = primaryTargets.find((target) => target.current)!;
    const offPagePrimary = primaryTargets.find((target) => !target.current)!;
    expect(primaryTargets).toHaveLength(2);
    expect(firstAuthority.cloneGeneration).toBe(1);
    expect(currentPrimary).toMatchObject({ pageId: "first", part: "chapter-heading", generation: 1 });
    expect(currentPrimary.targetKey).toBe("pageflip:first:primary:g1:chapter-heading:chapter-heading");
    expect(offPagePrimary).toMatchObject({ pageId: "second", part: "chapter-heading", generation: 1 });
    expect(sourceRoot.querySelectorAll("[data-scene-target-id]")).toHaveLength(0);

    const temporary = pages[0]!.cloneNode(true) as HTMLElement;
    runtimeRoot.append(temporary);
    expect(temporary.querySelector("[data-scene-part]")).toBeNull();
    expect(temporary.querySelector("[data-scene-target-id]")).toBeNull();
    expect(sceneHost.snapshot().registeredTargetCount).toBe(2);

    const staleTargetId = currentPrimary.handle.targetId;
    controller.rebindOrientation("portrait", 1);
    const reboundAuthority = authorities.at(-1)!;
    const reboundCurrent = reboundAuthority.targets.find((target) => target.role === "primary" && target.current)!;
    expect(reboundAuthority.cloneGeneration).toBe(2);
    expect(reboundCurrent.pageId).toBe("second");
    expect(reboundAuthority.targets.every((target) => target.handle.targetId !== staleTargetId)).toBe(true);

    const invocation = sceneHost.beginScene({
      sceneName: "chapter-heading",
      playback: "live",
      targetContract: pageTargetContract(),
      motionPolicy: resolveMotionPolicy("full", false),
    });
    const resolution = invocation.resolveTargets();
    expect(resolution.requiredSatisfied, JSON.stringify(resolution)).toBe(true);
    expect(resolution.entries[0]?.acceptedTargetIds).toEqual([reboundCurrent.handle.targetId]);
    expect(resolution.entries[0]?.acceptedTargetIds).not.toContain(staleTargetId);
    expect(resolution.entries[0]?.acceptedTargetIds).not.toContain(offPagePrimary.handle.targetId);
    expect(resolution.entries[0]?.candidateCount).toBe(2);
    expect(resolution.entries[0]?.rejectionCodes).toContain("target-stale-instance");
    expect(
      invocation.claim({ targetId: reboundCurrent.handle.targetId, runtime: "gsap", properties: ["transform"] }),
    ).toMatchObject({ status: "granted" });
    expect(registry.snapshot().activeClaimCount).toBe(1);
    await invocation.complete({ outcome: "completed", finalSemanticState: "page-heading-ready" });

    controller.dispose();
    expect(sceneHost.snapshot()).toMatchObject({ registeredTargetCount: 0, activeClaimCount: 0 });
    sceneHost.release();
    expect(registry.snapshot()).toMatchObject({
      registeredHostCount: 0,
      registeredTargetCount: 0,
      activeClaimCount: 0,
    });
  });

  it("bounds nonce-backed target keys without truncating their collision identity", () => {
    const firstAuthorities: PageFlipPageTargetAuthority[] = [];
    const firstFixture = fixture((authority) => {
      if (authority) firstAuthorities.push(authority);
    });
    const nearCollisionPrefix = `side-quest-${"nonce-backed-identity-".repeat(8)}`;
    const firstPageId = `${nearCollisionPrefix}a`;
    const secondPageId = `${nearCollisionPrefix}b`;
    const firstMarker = `${nearCollisionPrefix}marker-a`;
    const secondMarker = `${nearCollisionPrefix}marker-b`;
    const configureLongTargets = (sourceRoot: HTMLElement) => {
      sourceRoot.children[0]!.querySelector<HTMLElement>("[data-scene-part]")!.setAttribute(
        "data-scene-target-key",
        firstMarker,
      );
      const nearCollisionMarker = document.createElement("span");
      nearCollisionMarker.dataset.scenePart = "chapter-heading";
      nearCollisionMarker.dataset.sceneTargetKey = secondMarker;
      nearCollisionMarker.dataset.gsapOwned = "";
      sourceRoot.children[0]!.append(nearCollisionMarker);
      sourceRoot.children[1]!.querySelector<HTMLElement>("[data-scene-part]")!.setAttribute(
        "data-scene-target-key",
        firstMarker,
      );
    };
    configureLongTargets(firstFixture.sourceRoot);
    const firstPages = firstFixture.controller.preparePages([firstPageId, secondPageId], "revision-long-identity");
    firstFixture.runtimeRoot.append(...firstPages);
    firstFixture.controller.bindPrimaryPages(0, "landscape");

    const firstKeys = firstAuthorities.at(-1)!.targets.map((target) => target.targetKey);
    expect(firstKeys).toHaveLength(3);
    expect(new Set(firstKeys).size).toBe(3);
    expect(firstKeys.every((key) => key.length <= 96)).toBe(true);
    expect(firstKeys.every((key) => /^[A-Za-z0-9._:/-]+$/u.test(key))).toBe(true);
    expect(firstKeys.every((key) => /^pageflip:h[0-9a-f]{32}$/u.test(key))).toBe(true);

    const repeatedAuthorities: PageFlipPageTargetAuthority[] = [];
    const repeatedFixture = fixture((authority) => {
      if (authority) repeatedAuthorities.push(authority);
    });
    configureLongTargets(repeatedFixture.sourceRoot);
    const repeatedPages = repeatedFixture.controller.preparePages(
      [firstPageId, secondPageId],
      "revision-long-identity",
    );
    repeatedFixture.runtimeRoot.append(...repeatedPages);
    repeatedFixture.controller.bindPrimaryPages(0, "landscape");

    expect(repeatedAuthorities.at(-1)!.targets.map((target) => target.targetKey)).toEqual(firstKeys);
  });

  it("namespaces primary IDs and rewrites every local IDREF relation", () => {
    const { controller, runtimeRoot, sourceRoot } = fixture();
    const pages = controller.preparePages(["first", "second"], "revision-1");
    runtimeRoot.append(...pages);
    controller.bindPrimaryPages(0, "landscape");

    const first = pages[0]!;
    const heading = first.querySelector<HTMLElement>("h2")!;
    const input = first.querySelector<HTMLInputElement>("input")!;
    const label = first.querySelector<HTMLLabelElement>("label")!;
    const clip = first.querySelector<SVGElement>("clipPath")!;
    const clipped = first.querySelector<SVGElement>("path[clip-path]")!;
    expect(heading.id).not.toBe("heading-one");
    expect(input.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(label.htmlFor).toBe(input.id);
    expect(label.getAttribute("aria-describedby")).toBe(first.querySelector("p")!.id);
    expect(clipped.getAttribute("clip-path")).toBe(`url(#${clip.id})`);

    const allIds = [
      ...sourceRoot.querySelectorAll<HTMLElement>("[id]"),
      ...runtimeRoot.querySelectorAll<HTMLElement>("[id]"),
    ].map((element) => element.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("rewrites every supported local IDREF without collisions while preserving external references", () => {
    const { controller, runtimeRoot, sourceRoot } = fixture();
    sourceRoot.children[0]!.insertAdjacentHTML(
      "beforeend",
      `
        <input id="foo.bar" data-id="dot" />
        <input id="foo-bar" data-id="dash" />
        <datalist id="list.target" data-id="list"></datalist>
        <form id="form.target" data-id="form"></form>
        <label data-ref="dot" for="foo.bar">Dot</label>
        <label data-ref="dash" for="foo-bar">Dash</label>
        <output data-ref="output" for="foo.bar foo-bar unknown-output"></output>
        <input
          data-ref="single"
          list="list.target"
          form="form.target"
          aria-activedescendant="foo.bar"
          aria-errormessage="foo-bar"
        />
        <div
          data-ref="multi"
          aria-labelledby="foo.bar foo-bar"
          aria-describedby="foo.bar unknown-description"
          aria-controls="foo.bar foo-bar"
          aria-owns="foo.bar foo-bar"
          aria-details="foo.bar foo-bar unknown-details"
          aria-flowto="foo-bar foo.bar"
          itemref="foo.bar foo-bar unknown-item"
        ></div>
        <table><tbody><tr><td data-ref="headers" headers="foo.bar foo-bar unknown-header"></td></tr></tbody></table>
        <a data-ref="link" href="#foo.bar">Link</a>
        <a data-ref="external-link" href="https://example.test/path#foo.bar">External</a>
        <svg>
          <use data-ref="xlink" xlink:href="#foo-bar"></use>
          <path
            data-ref="url-attributes"
            clip-path="url(#foo-bar)"
            fill="url(#foo.bar)"
            filter="url(#foo-bar)"
            mask="url(#foo.bar)"
            marker-start="url(#foo-bar)"
            marker-mid="url(#foo.bar)"
            marker-end="url(#foo-bar)"
          />
        </svg>
        <div
          data-ref="style"
          style="clip-path:url(#foo.bar);filter:url(#foo-bar);background-image:url(https://example.test/#foo.bar);mask:url(#unknown-mask)"
        ></div>
      `,
    );
    const pages = controller.preparePages(["first", "second"], "revision-collision");
    runtimeRoot.append(...pages);
    controller.bindPrimaryPages(0, "landscape");

    const first = pages[0]!;
    const dotId = first.querySelector<HTMLElement>('[data-id="dot"]')!.id;
    const dashId = first.querySelector<HTMLElement>('[data-id="dash"]')!.id;
    const listId = first.querySelector<HTMLElement>('[data-id="list"]')!.id;
    const formId = first.querySelector<HTMLElement>('[data-id="form"]')!.id;
    expect(dotId).not.toBe(dashId);
    expect(first.querySelector<HTMLLabelElement>('[data-ref="dot"]')!.htmlFor).toBe(dotId);
    expect(first.querySelector<HTMLLabelElement>('[data-ref="dash"]')!.htmlFor).toBe(dashId);
    expect(first.querySelector('[data-ref="output"]')).toHaveAttribute("for", `${dotId} ${dashId} unknown-output`);
    const single = first.querySelector('[data-ref="single"]');
    expect(single).toHaveAttribute("list", listId);
    expect(single).toHaveAttribute("form", formId);
    expect(single).toHaveAttribute("aria-activedescendant", dotId);
    expect(single).toHaveAttribute("aria-errormessage", dashId);
    const multi = first.querySelector('[data-ref="multi"]');
    expect(multi).toHaveAttribute("aria-labelledby", `${dotId} ${dashId}`);
    expect(multi).toHaveAttribute("aria-describedby", `${dotId} unknown-description`);
    expect(multi).toHaveAttribute("aria-controls", `${dotId} ${dashId}`);
    expect(multi).toHaveAttribute("aria-owns", `${dotId} ${dashId}`);
    expect(multi).toHaveAttribute("aria-details", `${dotId} ${dashId} unknown-details`);
    expect(multi).toHaveAttribute("aria-flowto", `${dashId} ${dotId}`);
    expect(multi).toHaveAttribute("itemref", `${dotId} ${dashId} unknown-item`);
    expect(first.querySelector('[data-ref="headers"]')).toHaveAttribute("headers", `${dotId} ${dashId} unknown-header`);
    expect(first.querySelector('[data-ref="link"]')).toHaveAttribute("href", `#${dotId}`);
    expect(first.querySelector('[data-ref="external-link"]')).toHaveAttribute(
      "href",
      "https://example.test/path#foo.bar",
    );
    expect(first.querySelector('[data-ref="xlink"]')).toHaveAttribute("xlink:href", `#${dashId}`);
    const urlAttributes = first.querySelector('[data-ref="url-attributes"]');
    expect(urlAttributes).toHaveAttribute("clip-path", `url(#${dashId})`);
    expect(urlAttributes).toHaveAttribute("fill", `url(#${dotId})`);
    expect(urlAttributes).toHaveAttribute("filter", `url(#${dashId})`);
    expect(urlAttributes).toHaveAttribute("mask", `url(#${dotId})`);
    expect(urlAttributes).toHaveAttribute("marker-start", `url(#${dashId})`);
    expect(urlAttributes).toHaveAttribute("marker-mid", `url(#${dotId})`);
    expect(urlAttributes).toHaveAttribute("marker-end", `url(#${dashId})`);
    const style = first.querySelector('[data-ref="style"]')!.getAttribute("style")!;
    expect(style).toContain(`url(#${dotId})`);
    expect(style).toContain(`url(#${dashId})`);
    expect(style).toContain("url(https://example.test/#foo.bar)");
    expect(style).toContain("url(#unknown-mask)");

    const sourceIds = new Set(Array.from(sourceRoot.querySelectorAll<HTMLElement>("[id]"), (element) => element.id));
    const cloneIds = Array.from(first.querySelectorAll<HTMLElement>("[id]"), (element) => element.id);
    expect(new Set(cloneIds).size).toBe(cloneIds.length);
    expect(cloneIds.every((id) => !sourceIds.has(id))).toBe(true);
  });

  it("does not invent DOM-order identity for duplicate page markers", () => {
    const authorities: PageFlipPageTargetAuthority[] = [];
    const { controller, runtimeRoot, sourceRoot } = fixture((authority) => {
      if (authority) authorities.push(authority);
    });
    sourceRoot.children[0]!.insertAdjacentHTML(
      "beforeend",
      '<span data-scene-part="chapter-heading" data-gsap-owned>Ambiguous duplicate</span>',
    );
    const pages = controller.preparePages(["first", "second"], "revision-duplicate");
    runtimeRoot.append(...pages);
    controller.bindPrimaryPages(0, "landscape");

    const authority = authorities.at(-1)!;
    expect(authority.targets.filter((target) => target.pageId === "first")).toHaveLength(0);
    expect(authority.targets.filter((target) => target.pageId === "second" && target.role === "primary")).toHaveLength(
      1,
    );
    expect(sourceRoot.querySelector("[data-scene-target-id]")).toBeNull();
  });

  it("intercepts StPageFlip temporary cloneNode copies synchronously and makes them inert and untargetable", () => {
    const { controller, runtimeRoot } = fixture();
    const pages = controller.preparePages(["first", "second"], "revision-1");
    runtimeRoot.append(...pages);
    controller.bindPrimaryPages(0, "portrait");

    const temporary = pages[0]!.cloneNode(true) as HTMLElement;
    expect(temporary).toHaveAttribute("data-pageflip-role", "temporary");
    expect(temporary).toHaveAttribute("data-pageflip-temporary-clone");
    expect(temporary).toHaveAttribute("aria-hidden", "true");
    expect(temporary).toHaveAttribute("inert");
    expect(temporary.style.pointerEvents).toBe("none");
    expect(temporary.querySelector("[data-scene-part]")).toBeNull();
    expect(temporary.querySelector("[data-gsap-owned]")).toBeNull();
    expect(temporary.querySelector("[data-scene-instance]")).toBeNull();
    expect(getPageFlipCloneBoundary(temporary)).toMatchObject({ role: "temporary", current: false });

    const primaryIds = new Set(Array.from(pages[0]!.querySelectorAll<HTMLElement>("[id]"), (node) => node.id));
    const temporaryIds = Array.from(temporary.querySelectorAll<HTMLElement>("[id]"), (node) => node.id);
    expect(temporaryIds.every((id) => !primaryIds.has(id))).toBe(true);
    runtimeRoot.append(temporary);
    const temporaryBoundary = getPageFlipCloneBoundary(temporary)!;
    expect(
      qualifiesPageFlipClone(temporary, {
        pageFlipInstanceId: temporaryBoundary.pageFlipInstanceId,
        cloneGeneration: temporaryBoundary.cloneGeneration,
        allowOffPage: true,
      }),
    ).toBe(false);
  });

  it("revokes a generation on orientation changes and rejects stale retained identities", () => {
    const { controller, runtimeRoot } = fixture();
    const pages = controller.preparePages(["first", "second"], "revision-1");
    runtimeRoot.append(...pages);
    controller.bindPrimaryPages(0, "landscape");
    const retained = getPageFlipCloneBoundary(pages[0]!)!;

    controller.rebindOrientation("portrait", 1);

    const rebound = getPageFlipCloneBoundary(pages[0]!)!;
    expect(retained).toMatchObject({ lifecycle: "stale", current: false });
    expect(rebound.cloneGeneration).toBeGreaterThan(retained.cloneGeneration);
    expect(rebound).toMatchObject({ orientation: "portrait", current: false, lifecycle: "visible" });
    expect(
      qualifiesPageFlipClone(pages[0]!, {
        pageFlipInstanceId: retained.pageFlipInstanceId,
        cloneGeneration: retained.cloneGeneration,
        allowOffPage: true,
      }),
    ).toBe(false);
    expect(
      qualifiesPageFlipClone(pages[1]!, {
        pageFlipInstanceId: rebound.pageFlipInstanceId,
        cloneGeneration: rebound.cloneGeneration,
      }),
    ).toBe(true);

    const retainedAfterOrientation = getPageFlipCloneBoundary(pages[1]!)!;
    const updatedPages = controller.preparePages(["first", "second"], "revision-2");
    runtimeRoot.replaceChildren(...updatedPages);
    controller.bindPrimaryPages(1, "portrait");
    expect(retainedAfterOrientation).toMatchObject({ lifecycle: "stale", current: false });
    expect(getPageFlipCloneBoundary(updatedPages[1]!)!.cloneGeneration).toBeGreaterThan(
      retainedAfterOrientation.cloneGeneration,
    );
    expect(controller.snapshot()).toMatchObject({ sourceGeneration: 2, currentPage: 1 });
  });

  it("rebinds orientation only from trusted WeakMap identity when datasets are tampered", () => {
    const authorities: PageFlipPageTargetAuthority[] = [];
    const { controller, runtimeRoot } = fixture((authority) => {
      if (authority) authorities.push(authority);
    });
    const pages = controller.preparePages(["first", "second"], "revision-trusted");
    runtimeRoot.append(...pages);
    controller.bindPrimaryPages(0, "landscape");

    pages[0]!.dataset.pageflipPageId = "forged-second";
    pages[0]!.dataset.pageflipPageIndex = "1";
    pages[0]!.dataset.pageflipCurrent = "false";
    pages[1]!.dataset.pageflipPageId = "forged-first";
    pages[1]!.dataset.pageflipPageIndex = "0";
    pages[1]!.dataset.pageflipCurrent = "true";

    controller.rebindOrientation("portrait", 0);

    expect(getPageFlipCloneBoundary(pages[0]!)).toMatchObject({
      pageId: "first",
      pageIndex: 0,
      current: true,
      cloneGeneration: 2,
    });
    expect(getPageFlipCloneBoundary(pages[1]!)).toMatchObject({
      pageId: "second",
      pageIndex: 1,
      current: false,
      cloneGeneration: 2,
    });
    expect(pages[0]).toHaveAttribute("data-pageflip-page-id", "first");
    expect(pages[0]).toHaveAttribute("data-pageflip-page-index", "0");
    const authority = authorities.at(-1)!;
    expect(authority.targets.find((target) => target.current)).toMatchObject({ pageId: "first", generation: 2 });
    expect(authority.targets.find((target) => !target.current)).toMatchObject({ pageId: "second", generation: 2 });
  });

  it("uses its observer as a fail-closed backstop for clones with unproven provenance", async () => {
    const { runtimeRoot } = fixture();
    const unknown = document.createElement("article");
    unknown.className = "stf__item";
    unknown.id = "copied-id";
    unknown.innerHTML = '<span data-scene-part="route-path" data-gsap-owned>Unknown copy</span>';
    runtimeRoot.append(unknown);

    await Promise.resolve();

    expect(unknown).toHaveAttribute("data-pageflip-role", "unproven");
    expect(unknown).toHaveAttribute("data-pageflip-lifecycle", "stale");
    expect(unknown).toHaveAttribute("aria-hidden", "true");
    expect(unknown.querySelector("[data-scene-part]")).toBeNull();
    expect(unknown.id).not.toBe("copied-id");
  });

  it("disposes every boundary once and revokes current qualification", () => {
    const { controller, runtimeRoot } = fixture();
    const pages = controller.preparePages(["first", "second"], "revision-1");
    runtimeRoot.append(...pages);
    controller.bindPrimaryPages(0, "landscape");
    const identity = getPageFlipCloneBoundary(pages[0]!)!;

    controller.dispose();
    controller.dispose();

    expect(controller.snapshot()).toMatchObject({ disposed: true, lifecycle: "disposed" });
    expect(identity).toMatchObject({ lifecycle: "disposed", current: false });
    expect(
      qualifiesPageFlipClone(pages[0]!, {
        pageFlipInstanceId: identity.pageFlipInstanceId,
        cloneGeneration: identity.cloneGeneration,
      }),
    ).toBe(false);
  });

  it("bounds retained clone records through twenty-four revisions, orientations, and temporary clones", async () => {
    const { controller, runtimeRoot } = fixture();
    let latestPages: HTMLElement[] = [];
    for (let cycle = 0; cycle < 24; cycle += 1) {
      latestPages = controller.preparePages(["first", "second"], `revision-${cycle}`);
      runtimeRoot.replaceChildren(...latestPages);
      controller.bindPrimaryPages(cycle % 2, cycle % 2 ? "portrait" : "landscape");
      const temporary = latestPages[cycle % 2]!.cloneNode(true) as HTMLElement;
      runtimeRoot.append(temporary);
      await Promise.resolve();
      controller.updateCurrentPage(cycle % 2, "visible");
      temporary.remove();
      controller.rebindOrientation(cycle % 2 ? "landscape" : "portrait", cycle % 2);

      expect(controller.snapshot()).toMatchObject({
        sourceGeneration: cycle + 1,
        detachedCloneRecordCount: 0,
        retainedCloneRecordCount: 2,
        registeredSourceTargetCount: 0,
        registeredPrimaryTargetCount: 2,
        disposed: false,
      });
    }

    const latestIdentity = getPageFlipCloneBoundary(latestPages[0]!)!;
    controller.dispose();
    expect(controller.snapshot()).toMatchObject({
      sourceGeneration: 24,
      lifecycle: "disposed",
      retainedCloneRecordCount: 0,
      detachedCloneRecordCount: 0,
      registeredSourceTargetCount: 0,
      registeredPrimaryTargetCount: 0,
      disposed: true,
    });
    expect(latestIdentity).toMatchObject({ lifecycle: "disposed", current: false });
  });
});
