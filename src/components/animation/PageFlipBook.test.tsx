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
import { PageFlipBook, type FlipBookPage, type PageFlipBookHandle } from "./PageFlipBook";
import type { PageFlipPageTargetAuthority } from "./pageflip-boundary";

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

    renderPageFlip(<PageFlipBook pages={failingPages} mode="full" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Cover" })).toBeVisible());
    expect(calls.constructors).toHaveBeenCalledOnce();
    expect(calls.destroy).toHaveBeenCalledOnce();
    expect(calls.instance?.destroyMock).toHaveBeenCalledOnce();
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

    ref.current?.turnTo(1);
    await advanceTurnReadinessFrame();
    ref.current?.flipTo(0);
    expect(calls.turnTo).toHaveBeenCalledWith(1);
    expect(calls.flipTo).toHaveBeenCalledWith(0, "top");
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
    ref.current?.turnTo(1);
    await advanceTurnReadinessFrame();
    ref.current?.flipTo(3);

    expect(calls.next).toHaveBeenCalledTimes(2);
    expect(calls.previous).toHaveBeenCalledOnce();
    expect(calls.turnTo).toHaveBeenCalledWith(1);
    expect(calls.flipTo).toHaveBeenCalledWith(3, "top");
    expect(container.querySelector(".page-flip-book")).toHaveAttribute("data-animation-owner", "page-flip");
    expect(container.querySelector(".page-flip-runtime")).toHaveAttribute("data-pageflip-turn-owner", "st-page-flip");
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
    const targetAuthorities: PageFlipPageTargetAuthority[] = [];
    const onPageTargetsChange = vi.fn((authority: PageFlipPageTargetAuthority | null) => {
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
      <PageFlipBook pages={markedPages} mode="full" onPageTargetsChange={onPageTargetsChange} />,
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
