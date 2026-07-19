import type { Locator, Page } from "@playwright/test";
import { PAGE_FLIP_DEVELOPMENT_FAILPOINT_GLOBAL } from "../../src/components/animation/PageFlipBook";
import {
  expect,
  navigatePhase3Section,
  openPhase3Player,
  PHASE3_PLAYER_SECTIONS,
  phase3Test as test,
  readPhase3Evidence,
  waitForPhase3Receipt,
  type Phase3CaseFixture,
  type Phase3EventType,
  type Phase3FixtureManager,
} from "./fixtures/lanternwake-phase3";

const lifecycleCycles = 20;

type LifecycleProbe = Readonly<{
  activeEventSources: number;
  activeListeners: number;
  activeTimeouts: number;
  activeIntervals: number;
  activeWaapi: number;
  activeRaf: number;
  pendingWaapiPromises: number;
  peakEventSources: number;
  peakListeners: number;
  peakTimers: number;
  peakWaapi: number;
  peakRaf: number;
  peakPendingWaapiPromises: number;
}>;

type LifecycleSnapshot = LifecycleProbe &
  Readonly<{
    hosts: number;
    targets: number;
    claims: number;
    pageFlipRuntimes: number;
    eventOverlays: number;
    staleClones: number;
    retainedPageBoundaries: number;
    pageFlipGenerations: number;
    currentPrimaryAuthorities: number;
    lottieSurfaces: number;
    riveSurfaces: number;
    activeFocusTraps: number;
    activeDocumentAnimations: number;
    heapBytes: number | null;
  }>;

type LifecycleScenario = Readonly<{
  id: string;
  eventType: Phase3EventType;
  run: (context: LifecycleContext) => Promise<void>;
}>;

type LifecycleContext = Readonly<{
  page: Page;
  phase3: Phase3FixtureManager;
  fixture: Phase3CaseFixture;
  eventId: string;
  eventIds: readonly string[];
}>;

async function installLifecycleProbe(page: Page) {
  await page.addInitScript(() => {
    type Listener = EventListenerOrEventListenerObject;
    type Registration = Readonly<{
      wrapped: EventListener;
      signal: AbortSignal | null;
      abort: EventListener | null;
    }>;
    type MutableProbe = {
      activeEventSources: number;
      activeListeners: number;
      activeTimeouts: number;
      activeIntervals: number;
      activeWaapi: number;
      activeRaf: number;
      pendingWaapiPromises: number;
      peakEventSources: number;
      peakListeners: number;
      peakTimers: number;
      peakWaapi: number;
      peakRaf: number;
      peakPendingWaapiPromises: number;
    };
    const probe: MutableProbe = {
      activeEventSources: 0,
      activeListeners: 0,
      activeTimeouts: 0,
      activeIntervals: 0,
      activeWaapi: 0,
      activeRaf: 0,
      pendingWaapiPromises: 0,
      peakEventSources: 0,
      peakListeners: 0,
      peakTimers: 0,
      peakWaapi: 0,
      peakRaf: 0,
      peakPendingWaapiPromises: 0,
    };
    Object.defineProperty(window, "__phase3LifecycleProbe", { value: probe, configurable: true });
    const updatePeaks = () => {
      probe.peakEventSources = Math.max(probe.peakEventSources, probe.activeEventSources);
      probe.peakListeners = Math.max(probe.peakListeners, probe.activeListeners);
      probe.peakTimers = Math.max(probe.peakTimers, probe.activeTimeouts + probe.activeIntervals);
      probe.peakWaapi = Math.max(probe.peakWaapi, probe.activeWaapi);
      probe.peakRaf = Math.max(probe.peakRaf, probe.activeRaf);
      probe.peakPendingWaapiPromises = Math.max(probe.peakPendingWaapiPromises, probe.pendingWaapiPromises);
    };

    const nativeAdd = EventTarget.prototype.addEventListener;
    const nativeRemove = EventTarget.prototype.removeEventListener;
    const registrations = new WeakMap<EventTarget, Map<string, Map<Listener, Map<boolean, Registration>>>>();
    const captureOf = (options?: boolean | AddEventListenerOptions | EventListenerOptions) =>
      typeof options === "boolean" ? options : Boolean(options?.capture);
    const release = (target: EventTarget, type: string, listener: Listener, capture: boolean) => {
      const byType = registrations.get(target);
      const byListener = byType?.get(type);
      const byCapture = byListener?.get(listener);
      const registration = byCapture?.get(capture);
      if (!registration) return null;
      byCapture!.delete(capture);
      if (byCapture!.size === 0) byListener!.delete(listener);
      if (byListener!.size === 0) byType!.delete(type);
      if (registration.signal && registration.abort) {
        nativeRemove.call(registration.signal, "abort", registration.abort);
      }
      probe.activeListeners = Math.max(0, probe.activeListeners - 1);
      return registration;
    };
    const releaseTarget = (target: EventTarget) => {
      const byType = registrations.get(target);
      if (!byType) return;
      for (const [type, byListener] of byType) {
        for (const [listener, byCapture] of byListener) {
          for (const capture of [...byCapture.keys()]) release(target, type, listener, capture);
        }
      }
      registrations.delete(target);
    };

    EventTarget.prototype.addEventListener = function (
      type: string,
      listener: Listener | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (!listener || (typeof options === "object" && options.signal?.aborted)) {
        nativeAdd.call(this, type, listener, options);
        return;
      }
      const capture = captureOf(options);
      const existing = registrations.get(this)?.get(type)?.get(listener)?.get(capture);
      if (existing) {
        nativeAdd.call(this, type, existing.wrapped, options);
        return;
      }
      let byType = registrations.get(this);
      if (!byType) {
        byType = new Map();
        registrations.set(this, byType);
      }
      let byListener = byType.get(type);
      if (!byListener) {
        byListener = new Map();
        byType.set(type, byListener);
      }
      let byCapture = byListener.get(listener);
      if (!byCapture) {
        byCapture = new Map();
        byListener.set(listener, byCapture);
      }
      const once = typeof options === "object" && Boolean(options.once);
      const signal = typeof options === "object" ? (options.signal ?? null) : null;
      const wrapped: EventListener = (event) => {
        try {
          if (typeof listener === "function") listener.call(this, event);
          else listener.handleEvent(event);
        } finally {
          if (once) release(this, type, listener, capture);
        }
      };
      const abort: EventListener | null = signal
        ? () => {
            release(this, type, listener, capture);
          }
        : null;
      byCapture.set(capture, { wrapped, signal, abort });
      probe.activeListeners += 1;
      updatePeaks();
      nativeAdd.call(this, type, wrapped, options);
      if (signal && abort) nativeAdd.call(signal, "abort", abort, { once: true });
    };
    EventTarget.prototype.removeEventListener = function (
      type: string,
      listener: Listener | null,
      options?: boolean | EventListenerOptions,
    ) {
      if (!listener) {
        nativeRemove.call(this, type, listener, options);
        return;
      }
      const registration = release(this, type, listener, captureOf(options));
      nativeRemove.call(this, type, registration?.wrapped ?? listener, options);
    };

    const NativeEventSource = window.EventSource;
    const activeEventSources = new Set<EventSource>();
    window.EventSource = new Proxy(NativeEventSource, {
      construct(target, args) {
        const source = Reflect.construct(target, args) as EventSource;
        const nativeClose = source.close.bind(source);
        let closed = false;
        probe.activeEventSources += 1;
        activeEventSources.add(source);
        updatePeaks();
        Object.defineProperty(source, "close", {
          value: () => {
            if (!closed) {
              closed = true;
              probe.activeEventSources = Math.max(0, probe.activeEventSources - 1);
              activeEventSources.delete(source);
              releaseTarget(source);
            }
            nativeClose();
          },
        });
        return source;
      },
    });
    Object.defineProperty(window, "__phase3LifecycleEmitAccessRevoked", {
      value: () => {
        for (const source of activeEventSources) {
          source.dispatchEvent(new MessageEvent("access-revoked", { data: "{}" }));
        }
      },
      configurable: true,
    });

    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    const nativeSetInterval = window.setInterval.bind(window);
    const nativeClearInterval = window.clearInterval.bind(window);
    const timeoutIds = new Set<number>();
    const intervalIds = new Set<number>();
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      let id = 0;
      const wrapped = (...callbackArgs: unknown[]) => {
        if (timeoutIds.delete(id)) probe.activeTimeouts = Math.max(0, probe.activeTimeouts - 1);
        if (typeof handler === "function") handler(...callbackArgs);
        else Function(handler)();
      };
      id = nativeSetTimeout(wrapped, timeout, ...args);
      timeoutIds.add(id);
      probe.activeTimeouts += 1;
      updatePeaks();
      return id;
    }) as typeof window.setTimeout;
    window.clearTimeout = ((id?: number) => {
      if (typeof id === "number" && timeoutIds.delete(id)) {
        probe.activeTimeouts = Math.max(0, probe.activeTimeouts - 1);
      }
      nativeClearTimeout(id);
    }) as typeof window.clearTimeout;
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const id = nativeSetInterval(handler, timeout, ...args);
      intervalIds.add(id);
      probe.activeIntervals += 1;
      updatePeaks();
      return id;
    }) as typeof window.setInterval;
    window.clearInterval = ((id?: number) => {
      if (typeof id === "number" && intervalIds.delete(id)) {
        probe.activeIntervals = Math.max(0, probe.activeIntervals - 1);
      }
      nativeClearInterval(id);
    }) as typeof window.clearInterval;

    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
    const frameIds = new Set<number>();
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      let id = 0;
      id = nativeRequestAnimationFrame((time) => {
        if (frameIds.delete(id)) probe.activeRaf = Math.max(0, probe.activeRaf - 1);
        callback(time);
      });
      frameIds.add(id);
      probe.activeRaf += 1;
      updatePeaks();
      return id;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) => {
      if (frameIds.delete(id)) probe.activeRaf = Math.max(0, probe.activeRaf - 1);
      nativeCancelAnimationFrame(id);
    }) as typeof window.cancelAnimationFrame;

    const nativeAnimate = Element.prototype.animate;
    Element.prototype.animate = function (...args: Parameters<Element["animate"]>) {
      const animation = nativeAnimate.apply(this, args);
      let active = true;
      probe.activeWaapi += 1;
      updatePeaks();
      const settle = () => {
        if (!active) return;
        active = false;
        probe.activeWaapi = Math.max(0, probe.activeWaapi - 1);
      };
      nativeAdd.call(animation, "finish", settle, { once: true });
      nativeAdd.call(animation, "cancel", settle, { once: true });
      probe.pendingWaapiPromises += 1;
      updatePeaks();
      void animation.finished.then(
        () => {
          probe.pendingWaapiPromises = Math.max(0, probe.pendingWaapiPromises - 1);
        },
        () => {
          probe.pendingWaapiPromises = Math.max(0, probe.pendingWaapiPromises - 1);
        },
      );
      return animation;
    };
  });
}

async function readLifecycleSnapshot(page: Page): Promise<LifecycleSnapshot> {
  return page.evaluate(() => {
    const probe = structuredClone(
      (
        window as unknown as Window & {
          __phase3LifecycleProbe: LifecycleProbe;
        }
      ).__phase3LifecycleProbe,
    );
    const heap = (
      performance as Performance & {
        memory?: { usedJSHeapSize: number };
      }
    ).memory?.usedJSHeapSize;
    return {
      ...probe,
      hosts: document.querySelectorAll("[data-scene-host-id]").length,
      targets: document.querySelectorAll("[data-scene-target-id]").length,
      claims: document.querySelectorAll('[data-animation-claim-id], [data-pageflip-runtime-claim="granted"]').length,
      pageFlipRuntimes: document.querySelectorAll("[data-pageflip-runtime]").length,
      eventOverlays: document.querySelectorAll('[data-progression-overlay][data-progression-state="active"]').length,
      staleClones: document.querySelectorAll(
        '[data-pageflip-role="temporary"], [data-pageflip-role="unproven"], [data-pageflip-lifecycle="stale"]',
      ).length,
      retainedPageBoundaries: document.querySelectorAll("[data-pageflip-role]").length,
      pageFlipGenerations: document.querySelectorAll(
        "[data-pageflip-source-generation], [data-pageflip-clone-generation]",
      ).length,
      currentPrimaryAuthorities: document.querySelectorAll(
        '[data-pageflip-role="primary"][data-pageflip-current="true"][data-pageflip-lifecycle="visible"]',
      ).length,
      lottieSurfaces: document.querySelectorAll('[data-animation-owner="lottie"], [data-lottie-runtime]').length,
      riveSurfaces: document.querySelectorAll('[data-runtime-owner="rive"], canvas[data-rive-runtime]').length,
      activeFocusTraps: document.querySelectorAll('[aria-modal="true"]:not([hidden])').length,
      activeDocumentAnimations: document
        .getAnimations()
        .filter((animation) => animation.playState === "running" || animation.pending).length,
      heapBytes: Number.isFinite(heap) ? heap! : null,
    };
  });
}

function stableCounts(snapshot: LifecycleSnapshot) {
  return {
    activeEventSources: snapshot.activeEventSources,
    activeListeners: snapshot.activeListeners,
    activeTimeouts: snapshot.activeTimeouts,
    activeIntervals: snapshot.activeIntervals,
    activeWaapi: snapshot.activeWaapi,
    activeRaf: snapshot.activeRaf,
    pendingWaapiPromises: snapshot.pendingWaapiPromises,
    hosts: snapshot.hosts,
    targets: snapshot.targets,
    claims: snapshot.claims,
    pageFlipRuntimes: snapshot.pageFlipRuntimes,
    eventOverlays: snapshot.eventOverlays,
    staleClones: snapshot.staleClones,
    retainedPageBoundaries: snapshot.retainedPageBoundaries,
    pageFlipGenerations: snapshot.pageFlipGenerations,
    currentPrimaryAuthorities: snapshot.currentPrimaryAuthorities,
    lottieSurfaces: snapshot.lottieSurfaces,
    riveSurfaces: snapshot.riveSurfaces,
    activeFocusTraps: snapshot.activeFocusTraps,
    activeDocumentAnimations: snapshot.activeDocumentAnimations,
  };
}

async function waitForLifecycleBaseline(page: Page, baseline: LifecycleSnapshot) {
  await expect
    .poll(async () => stableCounts(await readLifecycleSnapshot(page)), {
      message: "Lanternwake runtime resources did not return to their warmed baseline.",
      timeout: 10_000,
    })
    .toEqual(stableCounts(baseline));
}

async function visible(locator: Locator) {
  return locator.isVisible().catch(() => false);
}

async function settleActivePresentation(page: Page, waitForActive = false) {
  const overlay = page.locator('[data-progression-overlay][data-progression-state="active"]');
  if (waitForActive) await expect(overlay).toBeVisible({ timeout: 15_000 });
  if (!(await visible(overlay))) return;
  const skip = overlay.getByRole("button", { name: "Reveal readable result" });
  if (await visible(skip)) await skip.click();
  await expect(overlay).toBeHidden();
}

async function replayEventAndSettle(context: LifecycleContext, eventId: string) {
  const before = (await readPhase3Evidence(context.page)).receipts.filter(
    (receipt) => receipt.eventId === eventId,
  ).length;
  const notice = context.page.locator(`[data-progress-event-id="${eventId}"]`);
  if (await visible(notice)) {
    await context.phase3.replay(context.page, eventId);
  } else {
    const history = context.page.locator("[data-presentation-history] details");
    if (!(await history.getAttribute("open"))) await history.locator("summary").click();
    await history.locator(`[data-replay-event-id="${eventId}"]`).click();
  }
  await settleActivePresentation(context.page, true);
  await expect
    .poll(
      async () =>
        (await readPhase3Evidence(context.page)).receipts.filter((receipt) => receipt.eventId === eventId).length,
    )
    .toBe(before + 1);
}

async function replayAndSettle(context: LifecycleContext) {
  await replayEventAndSettle(context, context.eventId);
}

async function replayJournalIntroduction(page: Page) {
  const replay = page.getByRole("button", { name: "Replay introduction" });
  await replay.click();
  const skip = page.getByRole("button", { name: "Skip ceremony" });
  if (await visible(skip)) await skip.click();
  await expect(page.locator("[data-player-experience-root]")).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
}

async function clearLifecycleEvidence(page: Page) {
  await page.evaluate(() => {
    const evidence = (
      window as unknown as Window & {
        __lanternwakePhase3Evidence?: { receipts: unknown[]; states: unknown[] };
      }
    ).__lanternwakePhase3Evidence;
    evidence?.receipts.splice(0);
    evidence?.states.splice(0);
  });
}

async function restorePlayerAfterReadOnlyRevocation(page: Page) {
  await page.reload();
  const open = page.getByRole("button", { name: "Open the journal" });
  if (await visible(open)) {
    await open.click();
    const skip = page.getByRole("button", { name: "Skip ceremony" });
    if (await visible(skip)) await skip.click();
  }
  await expect(page.locator(".voyage-shell")).toHaveAttribute("data-journal-phase", "JOURNAL_READY", {
    timeout: 20_000,
  });
  await expect(page.getByText("Tide connected")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-testid='progression-scene-host']")).toHaveCount(1);
  if (!(await page.locator(".voyage-shell.view-journal").count())) await navigatePhase3Section(page, "journal");
}

const scenarios: readonly LifecycleScenario[] = [
  {
    id: "journal-open-close",
    eventType: "CHAPTER_RELEASED",
    run: async ({ page }) => {
      await replayJournalIntroduction(page);
      await navigatePhase3Section(page, "chart");
      await navigatePhase3Section(page, "journal");
    },
  },
  { id: "chapter-release-replay", eventType: "CHAPTER_RELEASED", run: replayAndSettle },
  {
    id: "all-six-sections",
    eventType: "CHAPTER_RELEASED",
    run: async ({ page }) => {
      for (const section of PHASE3_PLAYER_SECTIONS) await navigatePhase3Section(page, section);
      await navigatePhase3Section(page, "journal");
    },
  },
  {
    id: "map-event",
    eventType: "MAP_LOCATION_REVEALED",
    run: async (context) => {
      await navigatePhase3Section(context.page, "chart");
      await replayAndSettle(context);
      await navigatePhase3Section(context.page, "journal");
    },
  },
  {
    id: "artifact-inspection",
    eventType: "ARTIFACT_AWARDED",
    run: async (context) => {
      await navigatePhase3Section(context.page, "treasures");
      await replayAndSettle(context);
      const artifact = context.page.locator(".artifact-slot:not(:disabled)").first();
      await artifact.click();
      const dialog = context.page.getByRole("dialog").filter({ visible: true });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Close inspection" }).click();
      await expect(dialog).toBeHidden();
      await navigatePhase3Section(context.page, "journal");
    },
  },
  {
    id: "quest-event",
    eventType: "SIDE_QUEST_DISCOVERED",
    run: async (context) => {
      await navigatePhase3Section(context.page, "quests");
      await replayAndSettle(context);
      const filters = context.page.getByRole("group", { name: "Filter side quests" }).getByRole("button");
      await filters.nth(1).click();
      await filters.first().click();
      await navigatePhase3Section(context.page, "journal");
    },
  },
  {
    id: "log-event",
    eventType: "PLAYER_LOG_ENTRY_ADDED",
    run: async (context) => {
      await navigatePhase3Section(context.page, "log");
      await replayAndSettle(context);
      const filter = context.page.locator(".log-filter select");
      await filter.selectOption("journal");
      await filter.selectOption("all");
      await navigatePhase3Section(context.page, "journal");
    },
  },
  {
    id: "finale-event",
    eventType: "FINALE_TEASED",
    run: async (context) => {
      await navigatePhase3Section(context.page, "finale");
      await replayAndSettle(context);
      await navigatePhase3Section(context.page, "journal");
    },
  },
  {
    id: "pause-resume",
    eventType: "CAMPAIGN_PAUSED",
    run: async (context) => {
      for (const eventId of context.eventIds) await replayEventAndSettle(context, eventId);
    },
  },
  {
    id: "pageflip-mount-update-orientation-fallback-unmount",
    eventType: "CHAPTER_RELEASED",
    run: async ({ page }) => {
      const book = page.locator(".main-journal-book");
      const currentPrimary = () =>
        book.locator('[data-pageflip-role="primary"][data-pageflip-current="true"][data-pageflip-lifecycle="visible"]');
      await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(1);
      await expect(currentPrimary()).toHaveCount(1);
      const beforePage = await currentPrimary().getAttribute("data-pageflip-page-index");
      const next = page.getByRole("button", { name: "Next journal page" });
      if (await next.isEnabled()) await next.click();
      else await page.getByRole("button", { name: "Previous journal page" }).click();
      await expect.poll(() => currentPrimary().getAttribute("data-pageflip-page-index")).not.toBe(beforePage);

      await page.setViewportSize({ width: 844, height: 390 });
      await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(1);
      await expect(currentPrimary()).toHaveCount(1);
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(1);
      await expect(currentPrimary()).toHaveCount(1);
      await expect(
        book.locator(
          '[data-pageflip-role="temporary"], [data-pageflip-role="unproven"], [data-pageflip-lifecycle="stale"]',
        ),
      ).toHaveCount(0);

      await navigatePhase3Section(page, "chart");
      await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(0);
      await page.evaluate(
        ({ failpointGlobal }) => {
          (window as unknown as Window & Record<string, string | undefined>)[failpointGlobal] = "readiness-probe";
        },
        { failpointGlobal: PAGE_FLIP_DEVELOPMENT_FAILPOINT_GLOBAL },
      );
      await navigatePhase3Section(page, "journal");
      await expect(book).toHaveAttribute("data-pageflip-status", "fallback");
      await expect(book).toHaveAttribute("data-pageflip-fallback-reason", "development-readiness-probe");
      await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(0);
      await expect(book.locator(".reduced-page-stage > [data-page-index]")).toHaveCount(1);

      await navigatePhase3Section(page, "chart");
      await page.evaluate(
        ({ failpointGlobal }) => {
          delete (window as unknown as Window & Record<string, string | undefined>)[failpointGlobal];
        },
        { failpointGlobal: PAGE_FLIP_DEVELOPMENT_FAILPOINT_GLOBAL },
      );
      await navigatePhase3Section(page, "journal");
      await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(1);
      await expect(currentPrimary()).toHaveCount(1);
      await page.setViewportSize({ width: 1280, height: 720 });
    },
  },
  {
    id: "full-gentle-product-and-browser-reduced",
    eventType: "CHAPTER_RELEASED",
    run: async ({ page }) => {
      const mode = page.getByRole("button", { name: /Motion:/ });
      const root = page.locator("[data-player-experience-root]");
      await expect(root).toHaveAttribute("data-motion-mode", "full");
      await mode.click();
      await expect(root).toHaveAttribute("data-motion-mode", "gentle");
      await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(1);
      await mode.click();
      await expect(root).toHaveAttribute("data-motion-mode", "reduced");
      await expect(page.locator(".main-journal-book")).toHaveAttribute("data-pageflip-status", "reduced");
      await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(0);
      await mode.click();
      await expect(root).toHaveAttribute("data-motion-mode", "full");
      await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(1);

      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(root).toHaveAttribute("data-motion-mode", "reduced");
      await expect(page.locator(".main-journal-book")).toHaveAttribute("data-pageflip-status", "reduced");
      await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(0);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await expect(page.locator("[data-player-experience-root]")).toHaveAttribute("data-motion-mode", "full");
      await expect(page.locator("[data-pageflip-runtime]")).toHaveCount(1);
    },
  },
  {
    id: "visibility-and-sse-reconnect",
    eventType: "CHAPTER_RELEASED",
    run: async ({ page }) => {
      const sourcesBefore = (await readLifecycleSnapshot(page)).activeEventSources;
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", { value: true, configurable: true });
        Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect(page.locator("[data-player-experience-root]")).toHaveAttribute(
        "data-journal-phase",
        "JOURNAL_READY",
      );
      await page.evaluate(() => {
        delete (document as unknown as Record<string, unknown>).hidden;
        delete (document as unknown as Record<string, unknown>).visibilityState;
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.context().setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event("offline")));
      await expect(page.getByText("Signal adrift")).toBeVisible();
      await page.context().setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect(page.getByText("Tide connected")).toBeVisible({ timeout: 15_000 });
      await expect.poll(async () => (await readLifecycleSnapshot(page)).activeEventSources).toBe(sourcesBefore);
    },
  },
  {
    id: "read-only-access-revocation-remount",
    eventType: "CHAPTER_RELEASED",
    run: async ({ page }) => {
      await expect.poll(async () => (await readLifecycleSnapshot(page)).activeEventSources).toBe(1);
      await page.evaluate(() => {
        (
          window as unknown as Window & {
            __phase3LifecycleEmitAccessRevoked: () => void;
          }
        ).__phase3LifecycleEmitAccessRevoked();
      });
      await expect(page.getByRole("heading", { name: "Invitation no longer active" })).toBeVisible();
      await expect.poll(async () => (await readLifecycleSnapshot(page)).activeEventSources).toBe(0);
      const evidence = await readPhase3Evidence(page);
      expect(evidence.states.filter((state) => state.transition === "access-revoked")).toHaveLength(1);
      await restorePlayerAfterReadOnlyRevocation(page);
    },
  },
];

if (scenarios.length !== 13 || new Set(scenarios.map((scenario) => scenario.id)).size !== 13) {
  throw new Error("The Phase 3 lifecycle suite must retain 13 unique twenty-cycle scenarios.");
}

test.describe("Project Lanternwake Phase 3 twenty-cycle lifecycle stress", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Lifecycle stress owns an isolated Chromium fixture; WebKit remains read-only in the viewport suite.",
  );

  for (const scenario of scenarios) {
    test(`${scenario.id} returns every observable resource to its warmed baseline after ${lifecycleCycles} cycles`, async ({
      page,
      phase3,
    }) => {
      test.setTimeout(360_000);
      await installLifecycleProbe(page);
      const fixture = await phase3.createCase(`P3-LIFE-${scenario.id}`, scenario.eventType);
      await openPhase3Player(page, fixture, scenario.eventType === "CAMPAIGN_PAUSED" ? "journal" : undefined);
      const publication = await phase3.publish(fixture);
      await settleActivePresentation(page, true);
      await waitForPhase3Receipt(page, publication.event.id);
      let eventIds: readonly string[] = [publication.event.id];
      if (scenario.id === "pause-resume") {
        const resume = await phase3.publish(fixture, "CAMPAIGN_RESUMED");
        await settleActivePresentation(page, true);
        await waitForPhase3Receipt(page, resume.event.id);
        const pause = await phase3.publish(fixture, "CAMPAIGN_PAUSED");
        await settleActivePresentation(page, true);
        await waitForPhase3Receipt(page, pause.event.id);
        eventIds = [resume.event.id, pause.event.id];

        await page.reload();
        const open = page.getByRole("button", { name: "Open the journal" });
        if (await visible(open)) {
          await open.click();
          const skip = page.getByRole("button", { name: "Skip ceremony" });
          if (await visible(skip)) await skip.click();
        }
        await expect(page.locator(".voyage-shell")).toHaveAttribute("data-journal-phase", "JOURNAL_READY", {
          timeout: 20_000,
        });
        await expect(page.getByText("Tide connected")).toBeVisible({ timeout: 20_000 });
        await expect(page.locator("[data-testid='progression-scene-host']")).toHaveCount(1);
        await expect(page.locator(".voyage-shell.view-journal")).toBeVisible();
      }
      const context = {
        page,
        phase3,
        fixture,
        eventId: publication.event.id,
        eventIds,
      } satisfies LifecycleContext;
      await clearLifecycleEvidence(page);

      await scenario.run(context);
      await settleActivePresentation(page);
      await clearLifecycleEvidence(page);
      const forcedGc = await page.evaluate(() => {
        const gc = (window as unknown as Window & { gc?: () => void }).gc;
        if (typeof gc !== "function") return false;
        gc();
        return true;
      });
      const baseline = await readLifecycleSnapshot(page);
      expect(baseline.eventOverlays).toBe(0);
      expect(baseline.staleClones).toBe(0);
      expect(baseline.activeFocusTraps).toBe(0);
      expect(baseline.activeWaapi).toBe(0);
      const heapSamples: number[] = [];

      for (let cycle = 1; cycle <= lifecycleCycles; cycle += 1) {
        await scenario.run(context);
        await settleActivePresentation(page);
        await clearLifecycleEvidence(page);
        await waitForLifecycleBaseline(page, baseline);
        if (forcedGc) {
          await page.evaluate(() => (window as unknown as Window & { gc: () => void }).gc());
        }
        const snapshot = await readLifecycleSnapshot(page);
        if (snapshot.heapBytes !== null) heapSamples.push(snapshot.heapBytes);
      }

      if (forcedGc) await page.evaluate(() => (window as unknown as Window & { gc: () => void }).gc());
      const finalSnapshot = await readLifecycleSnapshot(page);
      expect(stableCounts(finalSnapshot)).toEqual(stableCounts(baseline));
      expect(finalSnapshot.peakEventSources).toBeGreaterThanOrEqual(finalSnapshot.activeEventSources);
      expect(finalSnapshot.peakListeners).toBeGreaterThanOrEqual(finalSnapshot.activeListeners);
      expect(finalSnapshot.peakWaapi).toBeGreaterThanOrEqual(finalSnapshot.activeWaapi);
      expect(finalSnapshot.peakRaf).toBeGreaterThanOrEqual(finalSnapshot.activeRaf);
      expect(finalSnapshot.peakPendingWaapiPromises).toBeGreaterThanOrEqual(finalSnapshot.pendingWaapiPromises);

      if (forcedGc && baseline.heapBytes !== null && finalSnapshot.heapBytes !== null) {
        const permittedGrowth = Math.max(baseline.heapBytes * 0.05, 2 * 1024 * 1024);
        expect(finalSnapshot.heapBytes - baseline.heapBytes).toBeLessThanOrEqual(permittedGrowth);
        const tail = heapSamples.slice(-5);
        expect(tail).toHaveLength(5);
        expect(tail.every((sample, index) => index === 0 || sample > tail[index - 1]!)).toBe(false);
      } else {
        test.info().annotations.push({
          type: "heap-observational",
          description: "Forced GC is unavailable; DOM/runtime/listener/timer/WAAPI gates remain authoritative.",
        });
      }
    });
  }
});
