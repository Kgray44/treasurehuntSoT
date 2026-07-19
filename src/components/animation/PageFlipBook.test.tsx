import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act, createRef, type ReactElement, type ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimatedProperty } from "@/animation/core/animation-types";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import { SceneHostRegistry } from "@/animation/hosts/scene-host-registry";
import type {
  RuntimeSurfaceClaimRequest,
  RuntimeSurfaceClaimResult,
  SceneTargetUseResult,
} from "@/animation/hosts/scene-host-types";
import {
  PAGE_TURN_LIFECYCLE_BROWSER_EVENT,
  PageFlipBook,
  type FlipBookPage,
  type PageFlipBookHandle,
  type PageFlipPageTargetExportAuthority,
  type PageTurnLifecycleBrowserDetail,
} from "./PageFlipBook";

type RuntimeSurfaceClaimPrototype = {
  claimRuntimeSurface: (record: unknown, input: RuntimeSurfaceClaimRequest) => RuntimeSurfaceClaimResult;
};

const calls = vi.hoisted(() => ({
  orientation: "landscape" as "portrait" | "landscape",
  load: vi.fn(),
  update: vi.fn(),
  destroy: vi.fn(),
  next: vi.fn(),
  previous: vi.fn(),
  turnTo: vi.fn(),
  flipTo: vi.fn(),
  constructors: vi.fn(),
  instances: [] as Array<{
    current: number;
    destroyMock: ReturnType<typeof vi.fn>;
    handlers: Map<string, (event: { data: number | string }) => void>;
    host: HTMLElement;
  }>,
  instance: null as null | {
    current: number;
    destroyMock: ReturnType<typeof vi.fn>;
    handlers: Map<string, (event: { data: number | string }) => void>;
    host: HTMLElement;
  },
}));

vi.mock("page-flip", () => ({
  PageFlip: class {
    current = 0;
    pageCount = 0;
    showCover: boolean;
    destroyMock = vi.fn(() => calls.destroy(this));
    handlers = new Map<string, (event: { data: number | string }) => void>();
    host: HTMLElement;
    constructor(host: HTMLElement, options: { flippingTime: number; startPage: number; showCover: boolean }) {
      this.host = host;
      this.current = options.startPage;
      this.showCover = options.showCover;
      calls.constructors(host, options);
      calls.instance = this;
      calls.instances.push(this);
    }
    loadFromHTML = (pages: HTMLElement[]) => {
      this.pageCount = pages.length;
      this.current = this.getSpreadAnchor(this.current);
      calls.load(pages);
      this.host.replaceChildren(...pages);
    };
    updateFromHtml = (pages: HTMLElement[]) => {
      this.pageCount = pages.length;
      calls.update(pages);
      this.host.replaceChildren(...pages);
    };
    destroy = () => {
      this.destroyMock();
      this.host.remove();
    };
    flipNext = (...args: unknown[]) => calls.next(...args);
    flipPrev = (...args: unknown[]) => calls.previous(...args);
    turnToPage = (page: number) => {
      this.current = this.getSpreadAnchor(page);
      calls.turnTo(page);
    };
    flip = (page: number, corner: string) => {
      this.current = page;
      calls.flipTo(page, corner);
    };
    getCurrentPageIndex = () => this.current;
    getPageCount = () => this.pageCount;
    getOrientation = () => calls.orientation;
    getSpreadIndexByPage = (page: number) => {
      if (page < 0 || page >= this.pageCount) return null;
      if (!this.showCover) return Math.floor(page / 2);
      return page === 0 ? 0 : 1 + Math.floor((page - 1) / 2);
    };
    getSpreadAnchor = (page: number) => {
      if (!this.showCover || page === 0) return page - (page % 2);
      return page % 2 === 0 ? page - 1 : page;
    };
    getPageCollection = () => ({
      getCurrentSpreadIndex: () => this.getSpreadIndexByPage(this.current),
      getSpreadIndexByPage: this.getSpreadIndexByPage,
    });
    on = (name: string, callback: (event: { data: number | string }) => void) => this.handlers.set(name, callback);
  },
}));

const pages: FlipBookPage[] = [
  { id: "one", density: "hard", label: "Cover", content: <h2>Cover</h2> },
  { id: "two", density: "soft", label: "Story", content: <p>Story</p> },
];

const fourPages: FlipBookPage[] = [
  ...pages,
  { id: "three", density: "soft", label: "Riddle", content: <p>Riddle</p> },
  { id: "four", density: "hard", label: "Back cover", content: <p>Back cover</p> },
];

function AnimationTestProvider({ children }: { children: ReactNode }) {
  return <AnimationProvider>{children}</AnimationProvider>;
}

function renderPageFlip(element: ReactElement) {
  return render(element, { wrapper: AnimationTestProvider });
}

async function advanceTurnReadinessFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  });
}

async function settleMockTurn(page: number) {
  act(() => {
    calls.instance!.handlers.get("changeState")?.({ data: "flipping" });
    calls.instance!.current = page;
    calls.instance!.handlers.get("flip")?.({ data: page });
    calls.instance!.handlers.get("changeState")?.({ data: "read" });
  });
  await advanceTurnReadinessFrame();
}

describe("PageFlipBook", () => {
  beforeEach(() => {
    calls.orientation = "landscape";
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.removeAttribute("data-motion-level");
    delete window.__FOREVER_PAGEFLIP_FAILPOINT__;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    calls.instances.length = 0;
    calls.instance = null;
  });

  it("does not initialize the client-only runtime during server rendering", () => {
    expect(
      renderToString(
        <AnimationProvider>
          <PageFlipBook pages={pages} mode="full" />
        </AnimationProvider>,
      ),
    ).toContain("page-flip-source");
    expect(calls.constructors).not.toHaveBeenCalled();
  });

  it("hydrates deterministic markup and mints a distinct trusted identity for each client remount", async () => {
    const tree = (
      <AnimationProvider>
        <PageFlipBook pages={pages} mode="full" bookId="hydration-book" />
      </AnimationProvider>
    );
    const firstMarkup = renderToString(tree);
    const secondMarkup = renderToString(tree);
    const serverMountId = firstMarkup.match(/data-pageflip-mount-id="([^"]+)"/)?.[1];
    expect(serverMountId).toBeTruthy();
    expect(secondMarkup.match(/data-pageflip-mount-id="([^"]+)"/)?.[1]).toBe(serverMountId);

    const hydrationErrors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...messages: unknown[]) => {
      hydrationErrors.push(messages.map(String).join(" "));
    });
    const hydrationContainer = document.createElement("div");
    hydrationContainer.innerHTML = firstMarkup;
    document.body.append(hydrationContainer);
    let hydratedRoot: ReturnType<typeof hydrateRoot> | null = null;
    await act(async () => {
      hydratedRoot = hydrateRoot(hydrationContainer, tree);
      await Promise.resolve();
    });
    await waitFor(() => expect(calls.constructors).toHaveBeenCalledOnce());
    const hydratedMountId = hydrationContainer
      .querySelector("[data-pageflip-mount-id]")
      ?.getAttribute("data-pageflip-mount-id");
    expect(hydratedMountId).toBeTruthy();
    expect(hydratedMountId).not.toBe(serverMountId);
    expect(hydrationErrors.join("\n")).not.toMatch(/hydration|did not match|server rendered/i);

    await act(async () => hydratedRoot?.unmount());
    hydrationContainer.remove();
    const remount = renderPageFlip(<PageFlipBook pages={pages} mode="full" bookId="hydration-book" />);
    await waitFor(() => expect(calls.constructors).toHaveBeenCalledTimes(2));
    const remountedId = remount.container
      .querySelector("[data-pageflip-mount-id]")
      ?.getAttribute("data-pageflip-mount-id");
    expect(remountedId).toBeTruthy();
    expect(remountedId).not.toBe(hydratedMountId);
  });

  it("loads HTML once, updates the existing instance, and destroys on unmount", async () => {
    const { rerender, unmount } = renderPageFlip(<PageFlipBook pages={pages} mode="full" />);
    await waitFor(() => expect(calls.load).toHaveBeenCalledOnce());
    rerender(
      <PageFlipBook
        pages={[...pages, { id: "three", density: "soft", label: "Back", content: <p>Back</p> }]}
        mode="full"
      />,
    );
    await waitFor(() => expect(calls.update).toHaveBeenCalled());
    expect(calls.constructors).toHaveBeenCalledOnce();
    unmount();
    expect(calls.destroy).toHaveBeenCalledOnce();
  });

  it("destroys a constructed runtime exactly once when loadFromHTML throws and releases every authority", async () => {
    const onTurnLifecycle = vi.fn();
    const onReadinessChange = vi.fn();
    const originalRegisterHost = SceneHostRegistry.prototype.registerHost;
    const providerRegistries: SceneHostRegistry[] = [];
    vi.spyOn(SceneHostRegistry.prototype, "registerHost").mockImplementation(function (this: SceneHostRegistry, input) {
      providerRegistries.push(this);
      return originalRegisterHost.call(this, input);
    });
    calls.load.mockImplementationOnce(() => {
      throw new Error("deterministic PageFlip load failure");
    });
    const failingPages: FlipBookPage[] = [
      {
        id: "failing-cover",
        density: "hard",
        label: "Cover",
        content: (
          <h2 data-scene-part="chapter-heading" data-gsap-owned>
            Cover
          </h2>
        ),
      },
    ];

    const ref = createRef<PageFlipBookHandle>();
    renderPageFlip(
      <PageFlipBook
        ref={ref}
        pages={failingPages}
        mode="full"
        onTurnLifecycle={onTurnLifecycle}
        onReadinessChange={onReadinessChange}
      />,
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: "Cover" })).toBeVisible());
    expect(calls.constructors).toHaveBeenCalledOnce();
    expect(calls.destroy).toHaveBeenCalledOnce();
    expect(calls.instance?.destroyMock).toHaveBeenCalledOnce();
    expect(onTurnLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "turn-failed",
        source: "runtime-initialization",
        reason: "deterministic PageFlip load failure",
        fallback: true,
        generation: 1,
      }),
    );
    expect(ref.current?.readiness()).toMatchObject({ status: "fallback", ready: true, generation: 1 });
    expect(onReadinessChange).toHaveBeenCalledWith(expect.objectContaining({ status: "fallback", ready: true }));
    await waitFor(() =>
      expect(providerRegistries.at(-1)?.snapshot()).toMatchObject({
        registeredHostCount: 0,
        registeredTargetCount: 0,
        activeInvocationCount: 0,
        activeClaimCount: 0,
      }),
    );
  });

  it("does not construct StPageFlip when any required runtime property is denied", async () => {
    const registryPrototype = SceneHostRegistry.prototype as unknown as RuntimeSurfaceClaimPrototype;
    const originalClaimRuntimeSurface = registryPrototype.claimRuntimeSurface;
    const propertyChecks = vi.fn();
    const claimSpy = vi.spyOn(registryPrototype, "claimRuntimeSurface").mockImplementation(function (
      this: SceneHostRegistry,
      record,
      input,
    ) {
      const claim = originalClaimRuntimeSurface.call(this, record, input);
      if (claim.status !== "granted") return claim;
      return Object.freeze({
        ...claim,
        withProperties: <T,>(
          properties: readonly AnimatedProperty[],
          operation: (element: Element) => T,
        ): SceneTargetUseResult<T> => {
          propertyChecks(properties);
          if (properties.includes("clip-path")) {
            return Object.freeze({ status: "denied", reason: "permit-rejected" });
          }
          return claim.withProperties(properties, operation);
        },
      });
    });

    renderPageFlip(<PageFlipBook pages={pages} mode="full" />);

    await waitFor(() => expect(propertyChecks).toHaveBeenCalledWith(["transform", "clip-path", "width", "height"]));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Cover" })).toBeVisible());
    expect(calls.constructors).not.toHaveBeenCalled();
    claimSpy.mockRestore();
  });

  it("refreshes same-page content when the canonical session revision changes", async () => {
    const ref = createRef<PageFlipBookHandle>();
    const { rerender } = renderPageFlip(<PageFlipBook ref={ref} pages={pages} mode="full" revision={1} />);
    await waitFor(() => expect(calls.load).toHaveBeenCalledOnce());
    const firstGeneration = ref.current?.boundary();
    rerender(<PageFlipBook ref={ref} pages={pages} mode="full" revision={2} />);
    await waitFor(() => expect(calls.update).toHaveBeenCalledOnce());
    expect(ref.current?.boundary()).toMatchObject({
      mountId: firstGeneration?.mountId,
      pageFlipInstanceId: firstGeneration?.pageFlipInstanceId,
      runtimeGeneration: firstGeneration?.runtimeGeneration,
      sourceGeneration: 2,
      cloneGeneration: 2,
    });
  });

  it("supports keyboard turns, event-driven page/orientation state, and imperative navigation", async () => {
    const ref = createRef<PageFlipBookHandle>();
    const { container } = renderPageFlip(<PageFlipBook ref={ref} pages={pages} mode="full" />);
    await waitFor(() => expect(calls.instance).not.toBeNull());
    const book = container.querySelector<HTMLElement>(".page-flip-book")!;
    fireEvent.keyDown(book, { key: "ArrowRight" });
    await settleMockTurn(1);
    fireEvent.keyDown(book, { key: "PageUp" });
    expect(calls.next).toHaveBeenCalledOnce();
    expect(calls.previous).toHaveBeenCalledOnce();
    await settleMockTurn(0);
    expect(calls.instance!.host).toHaveAttribute("data-animation-owner", "page-flip");
    expect(calls.instance!.host).toHaveAttribute("data-scene-target-id");
    expect(calls.instance!.host).toHaveAttribute("data-pageflip-runtime-claim", "granted");
    expect(calls.instance!.host).toHaveAttribute("data-pageflip-turn-owner", "st-page-flip");
    const initialBoundary = ref.current?.boundary();
    expect(initialBoundary).toMatchObject({
      runtimeGeneration: 1,
      cloneGeneration: 1,
      currentPage: 0,
      orientation: "landscape",
      lifecycle: "visible",
    });

    calls.instance!.handlers.get("flip")?.({ data: 1 });
    await waitFor(() => expect(screen.getByText("Page 2 of 2")).toBeVisible());
    calls.instance!.handlers.get("changeOrientation")?.({ data: "portrait" });
    await waitFor(() => expect(book).toHaveClass("orientation-portrait"));
    expect(ref.current?.boundary()).toMatchObject({
      runtimeGeneration: 1,
      cloneGeneration: 2,
      orientation: "portrait",
    });

    ref.current?.turnTo(0);
    await advanceTurnReadinessFrame();
    ref.current?.flipTo(1);
    expect(calls.turnTo).toHaveBeenCalledWith(0);
    expect(calls.flipTo).toHaveBeenCalledWith(1, "top");
    expect(ref.current?.pageCount()).toBe(2);
    expect(ref.current?.orientation()).toBe("landscape");
  });

  it("publishes the runtime's initial portrait orientation on both the root and boundary", async () => {
    calls.orientation = "portrait";
    const ref = createRef<PageFlipBookHandle>();
    const { container } = renderPageFlip(<PageFlipBook ref={ref} pages={fourPages} mode="full" />);

    await waitFor(() => expect(calls.instance).not.toBeNull());
    await waitFor(() => expect(container.querySelector(".page-flip-book")).toHaveClass("orientation-portrait"));
    expect(ref.current?.orientation()).toBe("portrait");
    expect(ref.current?.boundary()).toMatchObject({ orientation: "portrait", currentPage: 0 });
    expect(container.querySelector('[data-pageflip-role="primary"][data-pageflip-current="true"]')).toHaveAttribute(
      "data-pageflip-orientation",
      "portrait",
    );
  });

  it("keeps controls, keyboard, and imperative turn channels exclusively on StPageFlip", async () => {
    const ref = createRef<PageFlipBookHandle>();
    const { container } = renderPageFlip(
      <PageFlipBook ref={ref} pages={fourPages} mode="full" bookId="channel-test" />,
    );
    await waitFor(() => expect(calls.instance).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Next journal page" }));
    await settleMockTurn(1);
    fireEvent.keyDown(container.querySelector(".page-flip-book")!, { key: "PageDown" });
    await settleMockTurn(3);
    ref.current?.previous();
    await settleMockTurn(1);
    ref.current?.turnTo(0);
    await advanceTurnReadinessFrame();
    ref.current?.flipTo(3);

    expect(calls.next).toHaveBeenCalledTimes(2);
    expect(calls.previous).toHaveBeenCalledOnce();
    expect(calls.turnTo).toHaveBeenCalledWith(0);
    expect(calls.flipTo).toHaveBeenCalledWith(3, "top");
    expect(container.querySelector(".page-flip-book")).toHaveAttribute("data-animation-owner", "page-flip");
    expect(container.querySelector(".page-flip-runtime")).toHaveAttribute("data-pageflip-turn-owner", "st-page-flip");
  });

  it("publishes a typed start, commit, and settle lifecycle for an animated control turn", async () => {
    const onTurnLifecycle = vi.fn();
    const ref = createRef<PageFlipBookHandle>();
    renderPageFlip(
      <PageFlipBook
        ref={ref}
        pages={fourPages}
        mode="full"
        bookId="lifecycle-book"
        onTurnLifecycle={onTurnLifecycle}
      />,
    );
    await waitFor(() => expect(ref.current?.readiness().status).toBe("ready"));

    fireEvent.click(screen.getByRole("button", { name: "Next journal page" }));
    await settleMockTurn(1);

    expect(onTurnLifecycle.mock.calls.map(([event]) => event.phase)).toEqual([
      "turn-start",
      "turn-commit",
      "turn-settle",
    ]);
    expect(onTurnLifecycle).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        bookId: "lifecycle-book",
        source: "control-next",
        fromPage: 0,
        toPage: 1,
        orientation: "landscape",
        mode: "full",
        fallback: false,
        generation: 1,
      }),
    );
    expect(onTurnLifecycle).toHaveBeenLastCalledWith(
      expect.objectContaining({ phase: "turn-settle", fromPage: 0, toPage: 1, generation: 1 }),
    );
  });

  it("restores the initiating control after its animated turn settles", async () => {
    renderPageFlip(<PageFlipBook pages={fourPages} mode="full" />);
    await waitFor(() => expect(calls.instance).not.toBeNull());
    const next = screen.getByRole("button", { name: "Next journal page" });
    next.focus();

    fireEvent.click(next);
    await settleMockTurn(1);

    await waitFor(() => expect(next).toHaveFocus());
  });

  it("mirrors each lifecycle transition once as a sanitized payload-free browser event", async () => {
    const browserEvents: PageTurnLifecycleBrowserDetail[] = [];
    const privatePages: FlipBookPage[] = [
      { id: "private-cover", density: "hard", label: "Private cover", content: <h2>PRIVATE-COVER-CONTENT</h2> },
      { id: "private-story", density: "soft", label: "Private story", content: <p>PRIVATE-STORY-CONTENT</p> },
    ];
    const { container } = renderPageFlip(
      <PageFlipBook pages={privatePages} mode="full" bookId="browser-evidence-book" />,
    );
    await waitFor(() => expect(calls.instance).not.toBeNull());
    container.addEventListener(PAGE_TURN_LIFECYCLE_BROWSER_EVENT, (event) => {
      browserEvents.push((event as CustomEvent<PageTurnLifecycleBrowserDetail>).detail);
    });

    fireEvent.click(screen.getByRole("button", { name: "Next journal page" }));
    await settleMockTurn(1);

    expect(browserEvents.map((event) => event.phase)).toEqual(["start", "commit", "settle"]);
    expect(browserEvents.map((event) => event.outcome)).toEqual(["started", "committed", "settled"]);
    expect(browserEvents).toEqual(
      browserEvents.map(() =>
        expect.objectContaining({
          version: 1,
          bookId: "browser-evidence-book",
          mountId: browserEvents[0]!.mountId,
          request: "control-next",
          source: "control-next",
          fromPage: 0,
          toPage: 1,
          reason: "none",
          boundaryGeneration: 1,
          runtimeGeneration: 1,
          fallbackStatus: "runtime",
        }),
      ),
    );
    expect(Object.keys(browserEvents[0]!).sort()).toEqual(
      [
        "bookId",
        "boundaryGeneration",
        "currentPage",
        "fallbackStatus",
        "fromPage",
        "mountId",
        "outcome",
        "phase",
        "reason",
        "request",
        "runtimeGeneration",
        "source",
        "toPage",
        "version",
      ].sort(),
    );
    expect(JSON.stringify(browserEvents)).not.toContain("PRIVATE-COVER-CONTENT");
    expect(JSON.stringify(browserEvents)).not.toContain("PRIVATE-STORY-CONTENT");
    expect(JSON.stringify(browserEvents)).not.toContain("Private cover");
    expect(JSON.stringify(browserEvents)).not.toContain("Private story");
  });

  it("publishes sanitized cancellation and failure evidence with no duplicate transitions", async () => {
    const browserEvents: PageTurnLifecycleBrowserDetail[] = [];
    const ref = createRef<PageFlipBookHandle>();
    const { container } = renderPageFlip(<PageFlipBook ref={ref} pages={pages} mode="full" />);
    await waitFor(() => expect(ref.current?.readiness().status).toBe("ready"));
    container.addEventListener(PAGE_TURN_LIFECYCLE_BROWSER_EVENT, (event) => {
      browserEvents.push((event as CustomEvent<PageTurnLifecycleBrowserDetail>).detail);
    });

    ref.current?.turnTo(0);
    await advanceTurnReadinessFrame();
    expect(browserEvents.map((event) => [event.phase, event.reason])).toEqual([
      ["start", "none"],
      ["cancel", "same-spread-or-boundary-no-op"],
    ]);

    browserEvents.length = 0;
    act(() => ref.current?.forceReadableFallback("pageflip-readiness-timeout:private-diagnostic"));
    await waitFor(() => expect(ref.current?.readiness().status).toBe("fallback"));
    expect(browserEvents).toEqual([
      expect.objectContaining({
        phase: "failed",
        outcome: "failed",
        reason: "readiness-timeout",
        fallbackStatus: "fallback",
        currentPage: 0,
      }),
    ]);
    expect(JSON.stringify(browserEvents)).not.toContain("private-diagnostic");
  });

  it("does not publish a stale lifecycle event after the mounted identity is disposed", async () => {
    const browserEvents: PageTurnLifecycleBrowserDetail[] = [];
    const ref = createRef<PageFlipBookHandle>();
    const { container, unmount } = renderPageFlip(<PageFlipBook ref={ref} pages={pages} mode="full" />);
    await waitFor(() => expect(ref.current?.readiness().status).toBe("ready"));
    container.addEventListener(PAGE_TURN_LIFECYCLE_BROWSER_EVENT, (event) => {
      browserEvents.push((event as CustomEvent<PageTurnLifecycleBrowserDetail>).detail);
    });
    ref.current?.next();
    expect(browserEvents.map((event) => event.phase)).toEqual(["start"]);
    const staleHandlers = calls.instance!.handlers;

    unmount();

    expect(browserEvents.map((event) => event.phase)).toEqual(["start"]);
    expect(() => {
      staleHandlers.get("flip")?.({ data: 1 });
      staleHandlers.get("changeOrientation")?.({ data: "portrait" });
      staleHandlers.get("changeState")?.({ data: "read" });
    }).not.toThrow();
  });

  it("truthfully cancels a queued intent when a newer intent replaces it", async () => {
    const onTurnLifecycle = vi.fn();
    const ref = createRef<PageFlipBookHandle>();
    renderPageFlip(<PageFlipBook ref={ref} pages={fourPages} mode="full" onTurnLifecycle={onTurnLifecycle} />);
    await waitFor(() => expect(calls.instance).not.toBeNull());

    act(() => calls.instance!.handlers.get("changeState")?.({ data: "flipping" }));
    ref.current?.flipTo(1);
    ref.current?.flipTo(3);

    expect(onTurnLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "turn-cancel",
        source: "imperative-flip-to",
        fromPage: 0,
        toPage: 0,
        reason: "replaced-by-newer-intent",
      }),
    );
    act(() => calls.instance!.handlers.get("changeState")?.({ data: "read" }));
    await advanceTurnReadinessFrame();
    expect(calls.flipTo).toHaveBeenCalledWith(3, "top");
  });

  it("rebases a queued turn at dispatch after the preceding visible page commits", async () => {
    const onTurnLifecycle = vi.fn();
    const ref = createRef<PageFlipBookHandle>();
    renderPageFlip(<PageFlipBook ref={ref} pages={fourPages} mode="full" onTurnLifecycle={onTurnLifecycle} />);
    await waitFor(() => expect(ref.current?.readiness().status).toBe("ready"));

    ref.current?.next();
    ref.current?.flipTo(3);
    await settleMockTurn(1);
    await waitFor(() => expect(calls.flipTo).toHaveBeenCalledWith(3, "top"));

    const starts = onTurnLifecycle.mock.calls.map(([event]) => event).filter((event) => event.phase === "turn-start");
    expect(starts).toEqual([
      expect.objectContaining({ source: "imperative-next", fromPage: 0, toPage: 1, generation: 1 }),
      expect.objectContaining({ source: "imperative-flip-to", fromPage: 1, toPage: 3, generation: 1 }),
    ]);
  });

  it("assigns the mounted boundary generation only when a pre-initialization intent actually dispatches", async () => {
    const onTurnLifecycle = vi.fn();
    const ref = createRef<PageFlipBookHandle>();
    renderPageFlip(<PageFlipBook ref={ref} pages={fourPages} mode="full" onTurnLifecycle={onTurnLifecycle} />);

    ref.current?.flipTo(3);
    expect(onTurnLifecycle).not.toHaveBeenCalled();

    await waitFor(() => expect(calls.flipTo).toHaveBeenCalledWith(3, "top"));
    expect(onTurnLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "turn-start",
        source: "imperative-flip-to",
        fromPage: 0,
        toPage: 3,
        generation: 1,
      }),
    );
  });

  it("cancels same-page full-mode turnTo and flipTo requests without false commits", async () => {
    const onTurnLifecycle = vi.fn();
    const ref = createRef<PageFlipBookHandle>();
    renderPageFlip(<PageFlipBook ref={ref} pages={fourPages} mode="full" onTurnLifecycle={onTurnLifecycle} />);
    await waitFor(() => expect(ref.current?.readiness().status).toBe("ready"));

    ref.current?.turnTo(0);
    await advanceTurnReadinessFrame();
    ref.current?.flipTo(0);
    await advanceTurnReadinessFrame();

    expect(calls.turnTo).not.toHaveBeenCalled();
    expect(calls.flipTo).not.toHaveBeenCalled();
    expect(onTurnLifecycle.mock.calls.map(([event]) => event.phase)).toEqual([
      "turn-start",
      "turn-cancel",
      "turn-start",
      "turn-cancel",
    ]);
    expect(onTurnLifecycle).not.toHaveBeenCalledWith(expect.objectContaining({ phase: "turn-commit" }));
    expect(onTurnLifecycle).not.toHaveBeenCalledWith(expect.objectContaining({ phase: "turn-settle" }));
  });

  it("abandons an initializing runtime before construction when readiness times out", async () => {
    const onTurnLifecycle = vi.fn();
    const ref = createRef<PageFlipBookHandle>();
    const { container } = renderPageFlip(
      <PageFlipBook ref={ref} pages={pages} mode="full" onTurnLifecycle={onTurnLifecycle} />,
    );
    expect(ref.current?.readiness().status).toBe("initializing");

    act(() => ref.current?.forceReadableFallback("initial-readiness-timeout"));

    await waitFor(() =>
      expect(container.querySelector(".page-flip-book")).toHaveAttribute("data-pageflip-status", "fallback"),
    );
    expect(calls.constructors).not.toHaveBeenCalled();
    expect(ref.current?.readiness()).toMatchObject({ status: "fallback", ready: true, generation: 0 });
    expect(container.querySelector(".page-flip-source")).toBeNull();
    expect(container.querySelector('.reduced-page-stage [data-page-index="0"]')).toHaveTextContent("Cover");
    expect(onTurnLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "turn-failed",
        source: "runtime-initialization",
        reason: "initial-readiness-timeout",
        generation: 0,
      }),
    );
  });

  it.each([
    ["dynamic-import", "development-dynamic-import", 0, 0],
    ["runtime-init", "development-runtime-init", 0, 0],
    ["readiness-probe", "development-readiness-probe", 1, 1],
  ] as const)(
    "uses the real readable fallback path for the development %s failpoint",
    async (failpoint, browserReason, constructorCount, destroyCount) => {
      window.__FOREVER_PAGEFLIP_FAILPOINT__ = failpoint;
      const browserEvents: PageTurnLifecycleBrowserDetail[] = [];
      const onReadinessChange = vi.fn();
      const ref = createRef<PageFlipBookHandle>();
      const { container } = renderPageFlip(
        <PageFlipBook ref={ref} pages={pages} mode="full" initialPage={1} onReadinessChange={onReadinessChange} />,
      );
      container.addEventListener(PAGE_TURN_LIFECYCLE_BROWSER_EVENT, (event) => {
        browserEvents.push((event as CustomEvent<PageTurnLifecycleBrowserDetail>).detail);
      });
      screen.getByRole("button", { name: "Previous journal page" }).focus();

      await waitFor(() => expect(ref.current?.readiness().status).toBe("fallback"));

      expect(calls.constructors).toHaveBeenCalledTimes(constructorCount);
      expect(calls.destroy).toHaveBeenCalledTimes(destroyCount);
      expect(container.querySelector(".page-flip-source")).toBeNull();
      expect(container.querySelector('.reduced-page-stage [data-page-index="1"]')).toHaveTextContent("Story");
      await waitFor(() => expect(screen.getByRole("button", { name: "Previous journal page" })).toHaveFocus());
      expect(onReadinessChange).toHaveBeenCalledWith(expect.objectContaining({ status: "fallback", ready: true }));
      expect(browserEvents).toEqual([
        expect.objectContaining({
          phase: "failed",
          reason: browserReason,
          fromPage: 1,
          toPage: 1,
          currentPage: 1,
          fallbackStatus: "fallback",
        }),
      ]);
    },
  );

  it("ignores development failpoints in production mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    window.__FOREVER_PAGEFLIP_FAILPOINT__ = "dynamic-import";
    const ref = createRef<PageFlipBookHandle>();
    const { container } = renderPageFlip(<PageFlipBook ref={ref} pages={pages} mode="full" />);

    await waitFor(() => expect(ref.current?.readiness().status).toBe("ready"));

    expect(calls.constructors).toHaveBeenCalledOnce();
    expect(container.querySelector(".page-flip-book")).not.toHaveAttribute("data-pageflip-status", "fallback");
  });

  it("forces an idempotent readable fallback with canonical controls and restored focus", async () => {
    const onTurnLifecycle = vi.fn();
    const onReadinessChange = vi.fn();
    const ref = createRef<PageFlipBookHandle>();
    const { container } = renderPageFlip(
      <PageFlipBook
        ref={ref}
        pages={pages}
        mode="full"
        onTurnLifecycle={onTurnLifecycle}
        onReadinessChange={onReadinessChange}
      />,
    );
    await waitFor(() => expect(ref.current?.readiness().status).toBe("ready"));
    const next = screen.getByRole("button", { name: "Next journal page" });
    next.focus();
    const readinessBeforeFallback = onReadinessChange.mock.calls.length;

    act(() => ref.current?.forceReadableFallback("pageflip-readiness-timeout"));

    await waitFor(() =>
      expect(container.querySelector(".page-flip-book")).toHaveAttribute("data-pageflip-status", "fallback"),
    );
    expect(container.querySelector(".page-flip-book")).toHaveAttribute(
      "data-pageflip-fallback-reason",
      "pageflip-readiness-timeout",
    );
    expect(container.querySelector(".page-flip-source")).toBeNull();
    expect(container.querySelector('.reduced-page-stage [data-page-index="0"]')).toHaveTextContent("Cover");
    await waitFor(() => expect(screen.getByRole("button", { name: "Next journal page" })).toHaveFocus());
    expect(ref.current?.readiness()).toMatchObject({ status: "fallback", ready: true, generation: 1 });
    expect(calls.destroy).toHaveBeenCalledOnce();
    expect(onTurnLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "turn-failed",
        source: "runtime-initialization",
        reason: "pageflip-readiness-timeout",
        fallback: true,
        generation: 1,
      }),
    );
    expect(onReadinessChange.mock.calls.slice(readinessBeforeFallback).map(([snapshot]) => snapshot.status)).toEqual([
      "fallback",
    ]);

    const readinessBeforeRepeat = onReadinessChange.mock.calls.length;
    act(() => ref.current?.forceReadableFallback("second-timeout"));
    expect(calls.destroy).toHaveBeenCalledOnce();
    expect(onTurnLifecycle.mock.calls.filter(([event]) => event.phase === "turn-failed")).toHaveLength(1);
    expect(onReadinessChange).toHaveBeenCalledTimes(readinessBeforeRepeat);

    fireEvent.click(screen.getByRole("button", { name: "Next journal page" }));
    expect(container.querySelector('.reduced-page-stage [data-page-index="1"]')).toHaveTextContent("Story");
  });

  it("reserves disposed readiness for real component teardown", async () => {
    const onReadinessChange = vi.fn();
    const { unmount } = renderPageFlip(
      <PageFlipBook pages={pages} mode="reduced" onReadinessChange={onReadinessChange} />,
    );
    await waitFor(() =>
      expect(onReadinessChange).toHaveBeenCalledWith(expect.objectContaining({ status: "reduced", ready: true })),
    );
    onReadinessChange.mockClear();

    unmount();

    expect(onReadinessChange).toHaveBeenCalledOnce();
    expect(onReadinessChange).toHaveBeenLastCalledWith(expect.objectContaining({ status: "disposed", ready: false }));
  });

  it("publishes equivalent lifecycle and readable readiness in reduced mode", () => {
    const onTurnLifecycle = vi.fn();
    const onReadinessChange = vi.fn();
    const ref = createRef<PageFlipBookHandle>();
    renderPageFlip(
      <PageFlipBook
        ref={ref}
        pages={pages}
        mode="reduced"
        onTurnLifecycle={onTurnLifecycle}
        onReadinessChange={onReadinessChange}
      />,
    );

    expect(ref.current?.readiness()).toMatchObject({ status: "reduced", ready: true, generation: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Next journal page" }));
    expect(onTurnLifecycle.mock.calls.map(([event]) => event.phase)).toEqual([
      "turn-start",
      "turn-commit",
      "turn-settle",
    ]);
    expect(onTurnLifecycle).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: "control-next", fromPage: 0, toPage: 1, fallback: false, mode: "reduced" }),
    );
    expect(onReadinessChange).toHaveBeenCalledWith(expect.objectContaining({ status: "reduced", ready: true }));
  });

  it("intercepts a runtime temporary clone synchronously and keeps the visible primary readable", async () => {
    const markedPages: FlipBookPage[] = [
      {
        id: "marked",
        density: "soft",
        label: "Marked",
        content: (
          <div>
            <h2 id="marked-heading">Readable content</h2>
            <p aria-labelledby="marked-heading" data-scene-part="chapter-heading" data-gsap-owned>
              Visible ink
            </p>
          </div>
        ),
      },
    ];
    const { container } = renderPageFlip(<PageFlipBook pages={markedPages} mode="full" bookId="clone-test" />);
    await waitFor(() => expect(calls.load).toHaveBeenCalledOnce());
    const primary = container.querySelector<HTMLElement>('.page-flip-runtime [data-pageflip-role="primary"]')!;
    expect(primary).not.toHaveAttribute("aria-hidden");
    expect(primary.querySelector("[data-scene-part]")).toHaveTextContent("Visible ink");

    const temporary = primary.cloneNode(true) as HTMLElement;
    expect(temporary).toHaveAttribute("data-pageflip-role", "temporary");
    expect(temporary).toHaveAttribute("aria-hidden", "true");
    expect(temporary).toHaveAttribute("inert");
    expect(temporary.querySelector("[data-scene-part]")).toBeNull();
    expect(temporary.querySelector("h2")!.id).not.toBe(primary.querySelector("h2")!.id);
  });

  it("exposes only bounded visible-primary target capabilities from its internal host", async () => {
    const ref = createRef<PageFlipBookHandle>();
    const targetAuthorities: PageFlipPageTargetExportAuthority[] = [];
    const onPageTargetsChange = vi.fn((authority: PageFlipPageTargetExportAuthority | null) => {
      if (authority) targetAuthorities.push(authority);
    });
    const markedPages: FlipBookPage[] = [
      {
        id: "target-page",
        density: "soft",
        label: "Target page",
        content: (
          <p data-scene-part="chapter-heading" data-gsap-owned>
            Deliberate page target
          </p>
        ),
      },
    ];
    const { container, unmount } = renderPageFlip(
      <PageFlipBook ref={ref} pages={markedPages} mode="full" onPageTargetsChange={onPageTargetsChange} />,
    );

    await waitFor(() => {
      const authority = targetAuthorities.at(-1);
      expect(authority?.targets).toHaveLength(1);
    });
    const authority = targetAuthorities.at(-1)!;
    expect(authority.targets).toEqual([
      expect.objectContaining({ pageId: "target-page", role: "primary", current: true, generation: 1 }),
    ]);
    expect(container.querySelector(".page-flip-source [data-scene-target-id]")).toBeNull();
    expect(authority.targets.every((target) => target.handle.hostId === authority.hostId)).toBe(true);
    expect(authority).toEqual(expect.objectContaining({ cloneGeneration: 1, exportTarget: expect.any(Function) }));
    expect(ref.current?.pageTargets()).toBe(authority);
    const exported = authority.exportTarget(authority.targets[0]!, {
      allowedProperties: ["opacity"],
      lifetime: "scene",
    });
    expect(exported).toMatchObject({
      sourceHostId: authority.hostId,
      targetId: authority.targets[0]!.handle.targetId,
      targetGeneration: authority.targets[0]!.generation,
      allowedProperties: ["opacity"],
    });
    exported.revoke();
    expect(ref.current?.boundary()).toMatchObject({
      cloneGeneration: authority.cloneGeneration,
      currentPage: 0,
      lifecycle: "visible",
      registeredPrimaryTargetCount: 1,
    });
    expect(container.querySelector('[data-pageflip-boundary-host="true"]')).toHaveAttribute(
      "data-scene-host-id",
      authority.hostId,
    );

    unmount();
    expect(onPageTargetsChange).toHaveBeenLastCalledWith(null);
  });

  it("queues one programmatic turn while a physical page is already moving", async () => {
    const ref = createRef<PageFlipBookHandle>();
    renderPageFlip(<PageFlipBook ref={ref} pages={pages} mode="full" />);
    await waitFor(() => expect(calls.instance).not.toBeNull());
    calls.instance!.handlers.get("changeState")?.({ data: "flipping" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Next journal page" })).toBeDisabled());
    ref.current?.flipTo(1);
    expect(calls.flipTo).not.toHaveBeenCalled();
    calls.instance!.handlers.get("changeState")?.({ data: "read" });
    expect(calls.flipTo).not.toHaveBeenCalled();
    await waitFor(() => expect(calls.flipTo).toHaveBeenCalledOnce());
    expect(calls.flipTo).toHaveBeenCalledWith(1, "top");
  });

  it("queues only the last turn requested after read but before the Chromium readiness frame", async () => {
    const ref = createRef<PageFlipBookHandle>();
    renderPageFlip(<PageFlipBook ref={ref} pages={pages} mode="full" />);
    await waitFor(() => expect(calls.instance).not.toBeNull());

    act(() => {
      calls.instance!.handlers.get("changeState")?.({ data: "flipping" });
      calls.instance!.handlers.get("changeState")?.({ data: "read" });
    });
    ref.current?.flipTo(0);
    ref.current?.flipTo(1);
    expect(calls.flipTo).not.toHaveBeenCalled();

    await advanceTurnReadinessFrame();
    expect(calls.flipTo).toHaveBeenCalledOnce();
    expect(calls.flipTo).toHaveBeenCalledWith(1, "top");
  });

  it("rearms after a same-spread programmatic no-op so the next valid spread turn dispatches", async () => {
    const ref = createRef<PageFlipBookHandle>();
    renderPageFlip(<PageFlipBook ref={ref} pages={fourPages} mode="full" initialPage={1} />);
    await waitFor(() => expect(calls.instance).not.toBeNull());

    ref.current?.flipTo(2);
    expect(calls.flipTo).not.toHaveBeenCalled();
    await advanceTurnReadinessFrame();

    ref.current?.flipTo(3);
    expect(calls.flipTo).toHaveBeenCalledOnce();
    expect(calls.flipTo).toHaveBeenCalledWith(3, "top");
  });

  it("rearms after a previous-at-cover no-op so a valid next intent still dispatches", async () => {
    const ref = createRef<PageFlipBookHandle>();
    renderPageFlip(<PageFlipBook ref={ref} pages={fourPages} mode="full" initialPage={0} />);
    await waitFor(() => expect(calls.instance).not.toBeNull());

    ref.current?.previous();
    expect(calls.previous).not.toHaveBeenCalled();
    await advanceTurnReadinessFrame();

    ref.current?.next();
    expect(calls.next).toHaveBeenCalledOnce();
  });

  it("keeps the flip-event page authoritative when the Chromium getter lags through read", async () => {
    const ref = createRef<PageFlipBookHandle>();
    const { container } = renderPageFlip(<PageFlipBook ref={ref} pages={fourPages} mode="full" />);
    await waitFor(() => expect(calls.instance).not.toBeNull());
    calls.instance!.current = 1;

    act(() => {
      calls.instance!.handlers.get("changeState")?.({ data: "flipping" });
      calls.instance!.handlers.get("flip")?.({ data: 3 });
      calls.instance!.handlers.get("changeState")?.({ data: "read" });
    });
    await advanceTurnReadinessFrame();

    expect(calls.instance!.current).toBe(1);
    expect(ref.current?.currentPage()).toBe(3);
    expect(ref.current?.boundary()).toMatchObject({ currentPage: 3, lifecycle: "visible", primaryPageCount: 4 });
    const currentPrimary = container.querySelectorAll(
      '[data-pageflip-role="primary"][data-pageflip-current="true"][data-pageflip-lifecycle="visible"]',
    );
    expect(currentPrimary).toHaveLength(1);
    expect(currentPrimary[0]).toHaveAttribute("data-pageflip-page-index", "3");
  });

  it("assigns distinct left and right physical page geometry", () => {
    const html = renderToString(
      <AnimationProvider>
        <PageFlipBook pages={pages} mode="full" />
      </AnimationProvider>,
    );
    expect(html).toMatch(/page-side-right[\s\S]*page-side-left/);
  });

  it("scales the page turn duration for slow-motion physical inspection", async () => {
    renderPageFlip(<PageFlipBook pages={pages} mode="full" playbackRate={0.25} />);
    await waitFor(() => expect(calls.constructors).toHaveBeenCalledOnce());
    expect(calls.constructors).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ flippingTime: 4400 }),
    );
  });

  it("recreates a live full-mode book with gentle timing while preserving its page", async () => {
    const { rerender } = renderPageFlip(<PageFlipBook pages={pages} mode="full" />);
    await waitFor(() => expect(calls.constructors).toHaveBeenCalledOnce());
    calls.instance!.current = 1;
    calls.instance!.handlers.get("flip")?.({ data: 1 });
    await waitFor(() => expect(screen.getByText("Page 2 of 2")).toBeVisible());

    rerender(<PageFlipBook pages={pages} mode="gentle" />);

    await waitFor(() => expect(calls.constructors).toHaveBeenCalledTimes(2));
    expect(calls.constructors.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ flippingTime: 1100 }));
    expect(calls.constructors.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ flippingTime: 620, startPage: 1 }));
    expect(calls.instances[0]?.destroyMock).toHaveBeenCalledOnce();
    expect(calls.instance?.current).toBe(1);
  });

  it("preserves the current page and focus while entering and exiting reduced mode", async () => {
    const { container, rerender } = renderPageFlip(<PageFlipBook pages={pages} mode="full" />);
    await waitFor(() => expect(calls.load).toHaveBeenCalledOnce());
    calls.instance!.current = 1;
    calls.instance!.handlers.get("flip")?.({ data: 1 });
    await waitFor(() => expect(screen.getByText("Page 2 of 2")).toBeVisible());
    const livePage = container.querySelector<HTMLElement>('.page-flip-host [data-page-index="1"]')!;
    livePage.focus();
    expect(livePage).toHaveFocus();

    rerender(<PageFlipBook pages={pages} mode="reduced" />);

    await waitFor(() => expect(screen.getByText("Page 2 of 2")).toBeVisible());
    const reducedPage = container.querySelector<HTMLElement>('.reduced-page-stage [data-page-index="1"]')!;
    await waitFor(() => expect(reducedPage).toHaveFocus());
    expect(calls.instances[0]?.destroyMock).toHaveBeenCalledOnce();

    const previous = screen.getByRole("button", { name: "Previous journal page" });
    previous.focus();
    rerender(<PageFlipBook pages={pages} mode="full" />);

    await waitFor(() => expect(calls.constructors).toHaveBeenCalledTimes(2));
    expect(calls.constructors.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ startPage: 1 }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Previous journal page" })).toHaveFocus());
  });

  it("restores page focus only to the current visible primary when stale and temporary peers precede it", async () => {
    const { container } = renderPageFlip(<PageFlipBook pages={pages} mode="full" bookId="focus-book" />);
    await waitFor(() => expect(calls.load).toHaveBeenCalledOnce());
    const host = container.querySelector<HTMLElement>(".page-flip-runtime")!;
    const primary = host.querySelector<HTMLElement>('[data-pageflip-role="primary"][data-pageflip-current="true"]')!;
    const generation = primary.dataset.pageflipCloneGeneration!;
    const instanceId = primary.dataset.pageflipInstanceId!;

    const stale = document.createElement("article");
    stale.tabIndex = -1;
    stale.dataset.pageIndex = "0";
    stale.dataset.pageflipPageIndex = "0";
    stale.dataset.pageflipRole = "primary";
    stale.dataset.pageflipCurrent = "true";
    stale.dataset.pageflipLifecycle = "stale";
    stale.dataset.pageflipCloneGeneration = generation;
    stale.dataset.pageflipInstanceId = instanceId;
    stale.dataset.pageflipBookId = "focus-book";
    const temporary = stale.cloneNode(true) as HTMLElement;
    temporary.dataset.pageflipRole = "temporary";
    temporary.dataset.pageflipLifecycle = "visible";
    temporary.dataset.pageflipTemporaryClone = "";
    host.prepend(temporary, stale);

    primary.focus();
    act(() => {
      calls.instance!.handlers.get("changeState")?.({ data: "flipping" });
      calls.instance!.handlers.get("flip")?.({ data: 0 });
    });
    await advanceTurnReadinessFrame();

    expect(temporary).not.toHaveFocus();
    expect(stale).not.toHaveFocus();

    act(() => calls.instance!.handlers.get("changeState")?.({ data: "read" }));
    await advanceTurnReadinessFrame();

    expect(primary).toHaveFocus();
    expect(stale).not.toHaveFocus();
    expect(temporary).not.toHaveFocus();
  });

  it.each(["inert", "hidden", "disconnected"] as const)(
    "rejects an %s current primary and falls back to the matching control",
    async (condition) => {
      const { container } = renderPageFlip(<PageFlipBook pages={pages} mode="full" />);
      await waitFor(() => expect(calls.load).toHaveBeenCalledOnce());
      const primary = container.querySelector<HTMLElement>(
        '[data-pageflip-role="primary"][data-pageflip-current="true"]',
      )!;
      primary.focus();
      if (condition === "inert") primary.setAttribute("inert", "");
      if (condition === "hidden") primary.hidden = true;
      if (condition === "disconnected") primary.remove();

      act(() => calls.instance!.handlers.get("flip")?.({ data: 0 }));
      await advanceTurnReadinessFrame();

      expect(screen.getByRole("button", { name: "Next journal page" })).toHaveFocus();
      expect(primary).not.toHaveFocus();
    },
  );

  it("uses only the new visible generation after an orientation rebind", async () => {
    const { container } = renderPageFlip(<PageFlipBook pages={pages} mode="full" />);
    await waitFor(() => expect(calls.load).toHaveBeenCalledOnce());
    const host = container.querySelector<HTMLElement>(".page-flip-runtime")!;
    const primary = host.querySelector<HTMLElement>('[data-pageflip-role="primary"][data-pageflip-current="true"]')!;
    const staleGeneration = primary.dataset.pageflipCloneGeneration!;
    const stale = document.createElement("article");
    stale.tabIndex = -1;
    stale.dataset.pageIndex = "0";
    stale.dataset.pageflipPageIndex = "0";
    stale.dataset.pageflipRole = "primary";
    stale.dataset.pageflipCurrent = "true";
    stale.dataset.pageflipLifecycle = "visible";
    stale.dataset.pageflipCloneGeneration = staleGeneration;
    stale.dataset.pageflipInstanceId = primary.dataset.pageflipInstanceId;
    stale.dataset.pageflipBookId = primary.dataset.pageflipBookId;
    stale.dataset.pageflipOrientation = "landscape";
    host.prepend(stale);
    primary.focus();

    act(() => calls.instance!.handlers.get("changeOrientation")?.({ data: "portrait" }));
    await advanceTurnReadinessFrame();

    expect(primary.dataset.pageflipCloneGeneration).toBe(String(Number(staleGeneration) + 1));
    expect(primary).toHaveAttribute("data-pageflip-orientation", "portrait");
    expect(primary).toHaveFocus();
    expect(stale).not.toHaveFocus();
  });

  it("falls back to the readable host when neither page nor controls can accept focus", async () => {
    const singlePage: FlipBookPage[] = [pages[0]!];
    const { container } = renderPageFlip(<PageFlipBook pages={singlePage} mode="full" />);
    await waitFor(() => expect(calls.load).toHaveBeenCalledOnce());
    const primary = container.querySelector<HTMLElement>(
      '[data-pageflip-role="primary"][data-pageflip-current="true"]',
    )!;
    primary.focus();
    primary.setAttribute("aria-hidden", "true");

    act(() => calls.instance!.handlers.get("flip")?.({ data: 0 }));
    await advanceTurnReadinessFrame();

    expect(container.querySelector(".page-flip-host")).toHaveFocus();
    expect(primary).not.toHaveFocus();
  });

  it("marks the hidden source and strips only source eligibility markers from visible clones", async () => {
    const markedPages: FlipBookPage[] = [
      {
        id: "marked",
        density: "soft",
        label: "Marked",
        content: (
          <div data-pageflip-source data-scene-instance="stale" data-scene-instance-id="also-stale">
            <span data-scene-part="chapter-heading">Readable content</span>
          </div>
        ),
      },
    ];
    const { container } = renderPageFlip(<PageFlipBook pages={markedPages} mode="full" />);
    await waitFor(() => expect(calls.load).toHaveBeenCalledOnce());

    const hiddenSource = container.querySelector<HTMLElement>(".page-flip-source")!;
    const pageFlipHost = container.querySelector<HTMLElement>(
      '[data-pageflip-boundary-host="true"][data-scene-host-boundary="player-section-enhancement"]',
    )!;
    expect(pageFlipHost).toContainElement(hiddenSource);
    expect(pageFlipHost).toContainElement(container.querySelector(".page-flip-runtime"));
    expect(pageFlipHost).toHaveAttribute("data-scene-host-id");
    expect(hiddenSource).toHaveAttribute("data-pageflip-source");
    expect(hiddenSource).toHaveAttribute("aria-hidden", "true");
    expect(hiddenSource).toHaveAttribute("inert");
    expect(hiddenSource.querySelector("[data-scene-instance]")).toBeNull();

    const suppliedClone = (calls.load.mock.calls[0]?.[0] as HTMLElement[])[0]!;
    expect(suppliedClone.querySelector("[data-pageflip-source]")).toBeNull();
    expect(suppliedClone.querySelector("[data-scene-instance]")).toBeNull();
    expect(suppliedClone.querySelector("[data-scene-instance-id]")).toBeNull();
    expect(suppliedClone.querySelector('[data-scene-part="chapter-heading"]')).toHaveTextContent("Readable content");

    const visibleHost = container.querySelector<HTMLElement>(".page-flip-host")!;
    expect(visibleHost.querySelector("[data-pageflip-source]")).toBeNull();
    expect(visibleHost.querySelector("[data-scene-instance]")).toBeNull();
    expect(container.querySelector(".page-flip-book")).toHaveAttribute("data-animation-owner", "page-flip");
  });

  it("destroys every runtime instance exactly once across policy transitions and unmount", async () => {
    const onBoundaryChange = vi.fn();
    const { rerender, unmount } = renderPageFlip(
      <PageFlipBook pages={pages} mode="full" onBoundaryChange={onBoundaryChange} />,
    );
    await waitFor(() => expect(calls.instances).toHaveLength(1));
    rerender(<PageFlipBook pages={pages} mode="gentle" onBoundaryChange={onBoundaryChange} />);
    await waitFor(() => expect(calls.instances).toHaveLength(2));
    rerender(<PageFlipBook pages={pages} mode="reduced" onBoundaryChange={onBoundaryChange} />);
    await waitFor(() => expect(calls.instances[1]?.destroyMock).toHaveBeenCalledOnce());
    rerender(<PageFlipBook pages={pages} mode="full" onBoundaryChange={onBoundaryChange} />);
    await waitFor(() => expect(calls.instances).toHaveLength(3));
    unmount();

    expect(calls.instances).toHaveLength(3);
    for (const pageFlip of calls.instances) expect(pageFlip.destroyMock).toHaveBeenCalledOnce();
    expect(calls.destroy).toHaveBeenCalledTimes(3);
    expect(onBoundaryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ disposed: true, lifecycle: "disposed" }),
    );
  });

  it("uses an immediate accessible fallback and keyboard-independent controls in reduced mode", () => {
    renderPageFlip(<PageFlipBook pages={pages} mode="reduced" />);
    expect(screen.getByRole("heading", { name: "Cover" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next journal page" }));
    expect(screen.getByText("Story")).toBeVisible();
    expect(calls.load).not.toHaveBeenCalled();
  });
});
