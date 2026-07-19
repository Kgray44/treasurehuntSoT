import type { Locator, Page, Route } from "@playwright/test";
import {
  LOTTIE_DEVELOPMENT_FAILPOINT_GLOBAL,
  type LottieDevelopmentFailpoint,
} from "../../src/components/animation/LottieEffect";
import {
  expect,
  navigatePhase3Section,
  openPhase3Player,
  PHASE3_MOTION_MODES,
  phase3Test as test,
  setPhase3Motion,
} from "./fixtures/lanternwake-phase3";

const lifecycleCycles = 20;
const extendedTimeout = 900_000;

type AudioFaultMode = "success" | "blocked" | "missing" | "play-error";

type ProbeCounters = Readonly<{
  activeListeners: number;
  activeTimeouts: number;
  activeIntervals: number;
  activeRafs: number;
  activeWaapi: number;
  activeAudioContexts: number;
  activeAudioNodes: number;
  audioContextConstructs: number;
  audioContextFailures: number;
  audioResumeAttempts: number;
  audioResumeFailures: number;
  audioOscillatorCreates: number;
  audioOscillatorStarts: number;
  audioOscillatorStops: number;
  audioNodeFailures: number;
}>;

type ExtendedSnapshot = ProbeCounters &
  Readonly<{
    hosts: number;
    targets: number;
    claims: number;
    pageFlipRuntimes: number;
    pageFlipSources: number;
    pageFlipClones: number;
    stalePageFlipNodes: number;
    riveOwners: number;
    riveCanvases: number;
    riveLoading: number;
    riveFallbacks: number;
    lottieOwners: number;
    lottieLoading: number;
    lottieReady: number;
    lottieFailed: number;
    lottiePlaying: number;
    focusTraps: number;
    activeDocumentAnimations: number;
    pendingDocumentAnimations: number;
    heapBytes: number | null;
  }>;

type ProbeWindow = Window & {
  __phase3ExtendedLifecycleProbe: ProbeCounters;
};

async function installExtendedLifecycleProbe(page: Page, audioMode: AudioFaultMode = "success") {
  await page.addInitScript(
    ({ audioMode: initialAudioMode }) => {
      type Listener = EventListenerOrEventListenerObject;
      type Registration = Readonly<{
        wrapped: EventListener;
        signal: AbortSignal | null;
        abort: EventListener | null;
      }>;
      type MutableProbe = {
        activeListeners: number;
        activeTimeouts: number;
        activeIntervals: number;
        activeRafs: number;
        activeWaapi: number;
        activeAudioContexts: number;
        activeAudioNodes: number;
        audioContextConstructs: number;
        audioContextFailures: number;
        audioResumeAttempts: number;
        audioResumeFailures: number;
        audioOscillatorCreates: number;
        audioOscillatorStarts: number;
        audioOscillatorStops: number;
        audioNodeFailures: number;
      };
      const probe: MutableProbe = {
        activeListeners: 0,
        activeTimeouts: 0,
        activeIntervals: 0,
        activeRafs: 0,
        activeWaapi: 0,
        activeAudioContexts: 0,
        activeAudioNodes: 0,
        audioContextConstructs: 0,
        audioContextFailures: 0,
        audioResumeAttempts: 0,
        audioResumeFailures: 0,
        audioOscillatorCreates: 0,
        audioOscillatorStarts: 0,
        audioOscillatorStops: 0,
        audioNodeFailures: 0,
      };
      Object.defineProperty(window, "__phase3ExtendedLifecycleProbe", {
        value: probe,
        configurable: true,
      });

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
        return id;
      }) as typeof window.setTimeout;
      window.clearTimeout = ((id?: number) => {
        if (typeof id === "number" && timeoutIds.delete(id))
          probe.activeTimeouts = Math.max(0, probe.activeTimeouts - 1);
        nativeClearTimeout(id);
      }) as typeof window.clearTimeout;
      window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
        const id = nativeSetInterval(handler, timeout, ...args);
        intervalIds.add(id);
        probe.activeIntervals += 1;
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
      const rafIds = new Set<number>();
      window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
        let id = 0;
        id = nativeRequestAnimationFrame((time) => {
          if (rafIds.delete(id)) probe.activeRafs = Math.max(0, probe.activeRafs - 1);
          callback(time);
        });
        rafIds.add(id);
        probe.activeRafs += 1;
        return id;
      }) as typeof window.requestAnimationFrame;
      window.cancelAnimationFrame = ((id: number) => {
        if (rafIds.delete(id)) probe.activeRafs = Math.max(0, probe.activeRafs - 1);
        nativeCancelAnimationFrame(id);
      }) as typeof window.cancelAnimationFrame;

      if (typeof Element.prototype.animate === "function") {
        const nativeAnimate = Element.prototype.animate;
        Element.prototype.animate = function (...args: Parameters<Element["animate"]>) {
          const animation = nativeAnimate.apply(this, args);
          let active = true;
          probe.activeWaapi += 1;
          const settle = () => {
            if (!active) return;
            active = false;
            probe.activeWaapi = Math.max(0, probe.activeWaapi - 1);
          };
          nativeAdd.call(animation, "finish", settle, { once: true });
          nativeAdd.call(animation, "cancel", settle, { once: true });
          return animation;
        };
      }

      const releaseNode = (node: { released: boolean }) => {
        if (node.released) return;
        node.released = true;
        probe.activeAudioNodes = Math.max(0, probe.activeAudioNodes - 1);
      };
      class FakeAudioParam {
        setValueAtTime() {}
        exponentialRampToValueAtTime() {}
        cancelScheduledValues() {}
        setTargetAtTime() {}
      }
      class FakeOscillator {
        released = false;
        type: OscillatorType = "sine";
        frequency = new FakeAudioParam();
        onended: (() => void) | null = null;
        constructor(private readonly mode: AudioFaultMode) {
          probe.activeAudioNodes += 1;
          probe.audioOscillatorCreates += 1;
        }
        connect() {}
        disconnect() {
          releaseNode(this);
        }
        start() {
          if (this.mode === "play-error") {
            probe.audioNodeFailures += 1;
            throw new DOMException("Injected oscillator start failure", "NotSupportedError");
          }
          probe.audioOscillatorStarts += 1;
        }
        stop() {
          probe.audioOscillatorStops += 1;
          this.onended?.();
        }
      }
      class FakeGain {
        released = false;
        gain = new FakeAudioParam();
        constructor() {
          probe.activeAudioNodes += 1;
        }
        connect() {}
        disconnect() {
          releaseNode(this);
        }
      }
      class FakeAudioContext {
        currentTime = 0;
        destination = {};
        state: AudioContextState;
        private closed = false;
        constructor() {
          probe.audioContextConstructs += 1;
          if (initialAudioMode === "missing") {
            probe.audioContextFailures += 1;
            throw new DOMException("Injected AudioContext absence", "NotSupportedError");
          }
          this.state = initialAudioMode === "blocked" ? "suspended" : "running";
          probe.activeAudioContexts += 1;
        }
        createOscillator() {
          return new FakeOscillator(initialAudioMode) as unknown as OscillatorNode;
        }
        createGain() {
          return new FakeGain() as unknown as GainNode;
        }
        resume() {
          probe.audioResumeAttempts += 1;
          if (initialAudioMode === "blocked") {
            probe.audioResumeFailures += 1;
            return Promise.reject(new DOMException("Injected autoplay block", "NotAllowedError"));
          }
          this.state = "running";
          return Promise.resolve();
        }
        close() {
          if (!this.closed) {
            this.closed = true;
            this.state = "closed";
            probe.activeAudioContexts = Math.max(0, probe.activeAudioContexts - 1);
          }
          return Promise.resolve();
        }
      }
      Object.defineProperty(window, "AudioContext", { value: FakeAudioContext, configurable: true });
      Object.defineProperty(window, "webkitAudioContext", { value: FakeAudioContext, configurable: true });
    },
    { audioMode },
  );
}

async function readSnapshot(page: Page): Promise<ExtendedSnapshot> {
  return page.evaluate(() => {
    const probe = structuredClone((window as unknown as ProbeWindow).__phase3ExtendedLifecycleProbe);
    const animations = document.getAnimations();
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
    return {
      ...probe,
      hosts: document.querySelectorAll("[data-scene-host-id]").length,
      targets: document.querySelectorAll("[data-scene-target-id]").length,
      claims: document.querySelectorAll('[data-animation-claim-id], [data-pageflip-runtime-claim="granted"]').length,
      pageFlipRuntimes: document.querySelectorAll("[data-pageflip-runtime]").length,
      pageFlipSources: document.querySelectorAll("[data-pageflip-source]").length,
      pageFlipClones: document.querySelectorAll("[data-pageflip-clone-generation]").length,
      stalePageFlipNodes: document.querySelectorAll(
        '[data-pageflip-role="temporary"], [data-pageflip-role="unproven"], [data-pageflip-lifecycle="stale"]',
      ).length,
      riveOwners: document.querySelectorAll('[data-animation-owner="rive"]').length,
      riveCanvases: document.querySelectorAll(".rive-object canvas, canvas[data-rive-runtime]").length,
      riveLoading: document.querySelectorAll(".rive-loading").length,
      riveFallbacks: document.querySelectorAll(
        '[data-rive-runtime-status="fallback"], .rive-object + [data-fallback-active="true"]',
      ).length,
      lottieOwners: document.querySelectorAll('[data-animation-owner="lottie"]').length,
      lottieLoading: document.querySelectorAll('[data-lottie-status="loading"]').length,
      lottieReady: document.querySelectorAll('[data-lottie-status="ready"]').length,
      lottieFailed: document.querySelectorAll('[data-lottie-status="failed"]').length,
      lottiePlaying: document.querySelectorAll('[data-lottie-status="ready"] svg, [data-lottie-status="ready"] canvas')
        .length,
      focusTraps: document.querySelectorAll('[aria-modal="true"]:not([hidden])').length,
      activeDocumentAnimations: animations.filter((animation) => animation.playState === "running" || animation.pending)
        .length,
      pendingDocumentAnimations: animations.filter((animation) => animation.pending).length,
      heapBytes: Number.isFinite(heap) ? heap! : null,
    };
  });
}

function stableSnapshot(snapshot: ExtendedSnapshot) {
  return {
    activeListeners: snapshot.activeListeners,
    activeTimeouts: snapshot.activeTimeouts,
    activeIntervals: snapshot.activeIntervals,
    activeRafs: snapshot.activeRafs,
    activeWaapi: snapshot.activeWaapi,
    activeAudioContexts: snapshot.activeAudioContexts,
    activeAudioNodes: snapshot.activeAudioNodes,
    hosts: snapshot.hosts,
    targets: snapshot.targets,
    claims: snapshot.claims,
    pageFlipRuntimes: snapshot.pageFlipRuntimes,
    pageFlipSources: snapshot.pageFlipSources,
    pageFlipClones: snapshot.pageFlipClones,
    stalePageFlipNodes: snapshot.stalePageFlipNodes,
    riveOwners: snapshot.riveOwners,
    riveCanvases: snapshot.riveCanvases,
    riveLoading: snapshot.riveLoading,
    riveFallbacks: snapshot.riveFallbacks,
    lottieOwners: snapshot.lottieOwners,
    lottieLoading: snapshot.lottieLoading,
    lottieReady: snapshot.lottieReady,
    lottieFailed: snapshot.lottieFailed,
    lottiePlaying: snapshot.lottiePlaying,
    focusTraps: snapshot.focusTraps,
    activeDocumentAnimations: snapshot.activeDocumentAnimations,
    pendingDocumentAnimations: snapshot.pendingDocumentAnimations,
  };
}

async function waitForBaseline(page: Page, baseline: ExtendedSnapshot) {
  await expect
    .poll(async () => stableSnapshot(await readSnapshot(page)), {
      message: "The extended Lanternwake runtime did not return to its warmed exact baseline.",
      timeout: 20_000,
    })
    .toEqual(stableSnapshot(baseline));
}

async function forceGcIfSupported(page: Page) {
  return page.evaluate(() => {
    const gc = (window as unknown as Window & { gc?: () => void }).gc;
    if (typeof gc !== "function") return false;
    gc();
    return true;
  });
}

function verifyHeapBoundary(
  baseline: ExtendedSnapshot,
  finalSnapshot: ExtendedSnapshot,
  heapSamples: readonly number[],
  forcedGc: boolean,
) {
  if (!forcedGc || baseline.heapBytes === null || finalSnapshot.heapBytes === null) {
    test.info().annotations.push({
      type: "heap-observational",
      description:
        "Forced GC is unavailable; exact runtime, listener, timer, rAF, WAAPI, focus, and DOM gates remain hard.",
    });
    return;
  }
  const permittedGrowth = Math.max(baseline.heapBytes * 0.05, 2 * 1024 * 1024);
  expect(finalSnapshot.heapBytes - baseline.heapBytes).toBeLessThanOrEqual(permittedGrowth);
  const tail = heapSamples.slice(-5);
  if (tail.length < 5) return;
  const midpoint = 2;
  const mean = tail.reduce((sum, sample) => sum + sample, 0) / tail.length;
  const numerator = tail.reduce((sum, sample, index) => sum + (index - midpoint) * (sample - mean), 0);
  const denominator = tail.reduce((sum, _sample, index) => sum + (index - midpoint) ** 2, 0);
  expect(numerator / denominator).toBeLessThanOrEqual(0);
}

async function runTwentyCycles(page: Page, action: (cycle: number) => Promise<void>) {
  await action(0);
  const forcedGc = await forceGcIfSupported(page);
  const baseline = await readSnapshot(page);
  expect(baseline.stalePageFlipNodes).toBe(0);
  expect(baseline.focusTraps).toBe(0);
  const heapSamples: number[] = [];
  for (let cycle = 1; cycle <= lifecycleCycles; cycle += 1) {
    await action(cycle);
    await waitForBaseline(page, baseline);
    if (forcedGc) await forceGcIfSupported(page);
    const snapshot = await readSnapshot(page);
    if (snapshot.heapBytes !== null) heapSamples.push(snapshot.heapBytes);
  }
  if (forcedGc) await forceGcIfSupported(page);
  const finalSnapshot = await readSnapshot(page);
  expect(stableSnapshot(finalSnapshot)).toEqual(stableSnapshot(baseline));
  verifyHeapBoundary(baseline, finalSnapshot, heapSamples, forcedGc);
  return { baseline, finalSnapshot };
}

async function assetStatus(page: Page, name: "Rive" | "Lottie") {
  return page
    .locator(".asset-status dl > div")
    .filter({ has: page.locator("dt", { hasText: new RegExp(`^${name}$`, "u") }) })
    .locator("dd");
}

async function openDevelopmentShowcase(page: Page) {
  if (!page.url().endsWith("/")) await page.goto("/");
  const skip = page.getByRole("button", { name: "Skip arrival" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.getByRole("link", { name: /TEST ANIMATIONS/u }).click();
  await expect(page.getByRole("heading", { name: "Forever Treasure Animation Showcase" })).toBeVisible();
}

async function returnToHarbor(page: Page) {
  await page.getByRole("link", { name: "Return to harbor" }).click();
  await expect(page.getByRole("heading", { name: "Choose your place in the Tale" })).toBeVisible();
}

async function routeRiveFailure(route: Route, kind: "404" | "abort" | "malformed") {
  if (kind === "404") {
    await route.fulfill({ status: 404, contentType: "application/octet-stream", body: "missing" });
    return;
  }
  if (kind === "abort") {
    await route.abort("failed");
    return;
  }
  await route.fulfill({ status: 200, contentType: "application/octet-stream", body: "not-a-rive-binary" });
}

async function routeLottieFailure(route: Route, kind: "404" | "abort" | "malformed") {
  if (kind === "404") {
    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    return;
  }
  if (kind === "abort") {
    await route.abort("failed");
    return;
  }
  await route.fulfill({ status: 200, contentType: "application/json", body: "{" });
}

async function expectFallback(locator: Locator, label: RegExp) {
  await expect(locator).toHaveAttribute("data-lottie-status", "failed");
  await expect(locator.locator('[data-fallback-active="true"]')).toHaveAttribute("aria-label", label);
}

async function expectDevelopmentLottieFallback(
  locator: Locator,
  reason: "development-stalled-load-timeout" | "development-renderer-error",
  label: RegExp,
) {
  await expectFallback(locator, label);
  await expect(locator).toHaveAttribute("data-lottie-failure-reason", reason);
  await expect(locator.locator('[data-fallback-active="true"]')).toHaveCount(1);
  await expect(locator.locator(":scope > div").first().locator("svg, canvas")).toHaveCount(0);
}

test.beforeEach(async ({ browserName }) => {
  expect(browserName, "The extended lifecycle spec must remain structurally Chromium-only.").toBe("chromium");
});

test.describe.serial("Project Lanternwake Phase 3 extended runtime lifecycle", () => {
  test("development Rive runtime remounts cleanly for twenty successful cycles", async ({ page }) => {
    test.setTimeout(extendedTimeout);
    await installExtendedLifecycleProbe(page);
    await openDevelopmentShowcase(page);
    await expect(await assetStatus(page, "Rive")).toHaveText("ready", { timeout: 20_000 });
    await runTwentyCycles(page, async () => {
      await page.getByRole("button", { name: "Reset" }).click();
      await expect(await assetStatus(page, "Rive")).toHaveText("ready", { timeout: 20_000 });
      await expect(page.locator('.rive-object[data-animation-owner="rive"] canvas')).toHaveCount(1);
    });
  });

  for (const kind of ["404", "abort", "malformed"] as const) {
    test(`development Rive ${kind} fault is hit and returns to one static fallback for twenty remounts`, async ({
      page,
    }) => {
      test.setTimeout(extendedTimeout);
      let faultHits = 0;
      await installExtendedLifecycleProbe(page);
      await page.route("**/animations/rive/rating-animation.riv", async (route) => {
        faultHits += 1;
        await routeRiveFailure(route, kind);
      });
      await openDevelopmentShowcase(page);
      await expect(await assetStatus(page, "Rive")).toHaveText("fallback", { timeout: 20_000 });
      await expect(page.getByRole("img", { name: /fallback after WebGL or asset failure/u })).toBeVisible();
      const warmedHits = faultHits;
      expect(warmedHits).toBeGreaterThan(0);
      await runTwentyCycles(page, async (cycle) => {
        await page.getByRole("button", { name: "Reset" }).click();
        await expect(await assetStatus(page, "Rive")).toHaveText("fallback", { timeout: 20_000 });
        await expect(page.getByRole("img", { name: /fallback after WebGL or asset failure/u })).toHaveCount(1);
        expect(faultHits).toBe(warmedHits + cycle + 1);
      });
    });
  }

  test("blocked invitation seal fallback remounts cleanly for twenty route cycles", async ({ page }) => {
    test.setTimeout(extendedTimeout);
    await installExtendedLifecycleProbe(page);
    const expectInvitationFallback = async () => {
      await expect(
        page.getByRole("img", {
          name: /Quartermaster door lock\. Original Rive artwork is not yet supplied; showing the production fallback/u,
        }),
      ).toBeVisible();
      await expect(page.locator('.quartermaster-login [data-animation-owner="rive"]')).toHaveCount(0);
    };
    await page.goto("/quartermaster");
    await expectInvitationFallback();
    await runTwentyCycles(page, async () => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Choose your place in the Tale" })).toBeVisible();
      await page.goto("/quartermaster");
      await expectInvitationFallback();
    });
  });

  test("Journal Clasp, Voyage Compass, and Finale Mechanism blocked contracts retract on every section leave", async ({
    page,
    phase3,
  }) => {
    test.setTimeout(extendedTimeout);
    await installExtendedLifecycleProbe(page);
    const fixture = await phase3.createCase("P3-LIFE-RIVE-BLOCKED-CONTRACTS", "CHAPTER_RELEASED");
    await openPhase3Player(page, fixture, "journal");
    const journalClasp = page.locator("[data-journal-clasp-contract]");
    const voyageCompass = page.locator("[data-voyage-compass-contract]");
    const finaleMechanism = page.locator(
      "[data-rive-contract-availability='blocked_external_asset'].finale-rive-contract",
    );
    const expectBlockedFallback = async (contract: Locator) => {
      await expect(contract).toHaveAttribute("data-rive-contract-availability", "blocked_external_asset");
      await expect(contract).toHaveAttribute("data-rive-runtime-status", "fallback");
      await expect(contract.locator('[data-fallback-active="true"]')).toHaveCount(1);
      await expect(contract.locator('[data-animation-owner="rive"]')).toHaveCount(0);
    };
    const contractCycle = async () => {
      await expectBlockedFallback(journalClasp);
      await expect(voyageCompass).toHaveCount(0);
      await expect(finaleMechanism).toHaveCount(0);
      await navigatePhase3Section(page, "chart");
      await expect(journalClasp).toHaveCount(0);
      await expectBlockedFallback(voyageCompass);
      await navigatePhase3Section(page, "finale");
      await expect(voyageCompass).toHaveCount(0);
      await expectBlockedFallback(finaleMechanism);
      await navigatePhase3Section(page, "journal");
      await expect(finaleMechanism).toHaveCount(0);
      await expectBlockedFallback(journalClasp);
    };
    await runTwentyCycles(page, async () => contractCycle());
  });

  test("all three Lottie contracts succeed across twenty route mount-unmount cycles", async ({ page }) => {
    test.setTimeout(extendedTimeout);
    await installExtendedLifecycleProbe(page);
    await page.goto("/");
    await expect(page.locator(".harbor-waves [data-lottie-status='ready']")).toHaveCount(1, { timeout: 20_000 });
    await expect(page.locator(".harbor-fog [data-lottie-status='ready']")).toHaveCount(1);
    await openDevelopmentShowcase(page);
    await expect(page.locator(".demo-lottie-waves[data-lottie-status='ready']")).toHaveCount(1, { timeout: 20_000 });
    await expect(await assetStatus(page, "Lottie")).toHaveText("ready");
    await returnToHarbor(page);
    await runTwentyCycles(page, async () => {
      await openDevelopmentShowcase(page);
      await expect(page.locator(".demo-lottie-waves[data-lottie-status='ready']")).toHaveCount(1, { timeout: 20_000 });
      await expect(await assetStatus(page, "Lottie")).toHaveText("ready");
      await returnToHarbor(page);
      await expect(page.locator(".harbor-waves [data-lottie-status='ready']")).toHaveCount(1, { timeout: 20_000 });
      await expect(page.locator(".harbor-fog [data-lottie-status='ready']")).toHaveCount(1);
    });
  });

  const lottieFaults = [
    {
      key: "moonlit-waves",
      path: "**/animations/lottie/moonlit-waves.json",
      kind: "404",
      start: "harbor" as const,
      locator: ".harbor-waves [data-animation-owner='lottie']",
      label: /Moonlight moving across the harbor static fallback/u,
      hitsPerCycle: 2,
    },
    {
      key: "rolling-fog",
      path: "**/animations/lottie/rolling-fog.json",
      kind: "abort",
      start: "harbor" as const,
      locator: ".harbor-fog [data-animation-owner='lottie']",
      label: /Fog rolling over the harbor static fallback/u,
      hitsPerCycle: 1,
    },
    {
      key: "ink-bloom",
      path: "**/animations/lottie/ink-bloom.json",
      kind: "malformed",
      start: "showcase" as const,
      locator: ".library-lab [data-animation-owner='lottie']",
      label: /Original ink bloom Lottie control demonstration static fallback/u,
      hitsPerCycle: 1,
    },
  ] as const;

  for (const fault of lottieFaults) {
    test(`${fault.key} ${fault.kind} fault is hit and preserves a static fallback for twenty remounts`, async ({
      page,
    }) => {
      test.setTimeout(extendedTimeout);
      let faultHits = 0;
      await installExtendedLifecycleProbe(page);
      await page.route(fault.path, async (route) => {
        faultHits += 1;
        await routeLottieFailure(route, fault.kind);
      });
      if (fault.start === "showcase") await openDevelopmentShowcase(page);
      else await page.goto("/");
      await expectFallback(page.locator(fault.locator), fault.label);
      const warmedHits = faultHits;
      expect(warmedHits).toBeGreaterThan(0);
      await runTwentyCycles(page, async (cycle) => {
        if (fault.start === "showcase") {
          await returnToHarbor(page);
          await openDevelopmentShowcase(page);
        } else {
          await openDevelopmentShowcase(page);
          await returnToHarbor(page);
        }
        await expectFallback(page.locator(fault.locator), fault.label);
        expect(faultHits).toBe(warmedHits + (cycle + 1) * fault.hitsPerCycle);
      });
    });
  }

  const deterministicLottieFailures = [
    {
      kind: "stalled-load",
      reason: "development-stalled-load-timeout",
      timeoutMs: 40,
      delayedTransportMs: 160,
    },
    {
      kind: "renderer-error",
      reason: "development-renderer-error",
      timeoutMs: undefined,
      delayedTransportMs: undefined,
    },
  ] as const satisfies readonly Readonly<{
    kind: LottieDevelopmentFailpoint["kind"];
    reason: "development-stalled-load-timeout" | "development-renderer-error";
    timeoutMs: number | undefined;
    delayedTransportMs: number | undefined;
  }>[];

  for (const failure of deterministicLottieFailures) {
    test(`development ${failure.kind} failpoint reaches the exact Lottie fallback and cleans up for twenty cycles`, async ({
      page,
    }) => {
      test.setTimeout(extendedTimeout);
      await installExtendedLifecycleProbe(page);
      const failpoint: LottieDevelopmentFailpoint = {
        kind: failure.kind,
        assetKey: "moonlit-waves",
        timeoutMs: failure.timeoutMs,
      };
      await page.addInitScript(
        ({ globalName, value }) => {
          (window as unknown as Window & Record<string, unknown>)[globalName] = value;
        },
        { globalName: LOTTIE_DEVELOPMENT_FAILPOINT_GLOBAL, value: failpoint },
      );

      let stalledTransportHits = 0;
      const pendingStalledTransports = new Set<number>();
      if (failure.delayedTransportMs !== undefined) {
        await page.route("**/animations/lottie/moonlit-waves.json", async (route) => {
          stalledTransportHits += 1;
          const requestId = stalledTransportHits;
          pendingStalledTransports.add(requestId);
          await new Promise<void>((resolve) => setTimeout(resolve, failure.delayedTransportMs));
          pendingStalledTransports.delete(requestId);
          await route
            .fulfill({
              status: 200,
              contentType: "application/json",
              path: "public/animations/lottie/moonlit-waves.json",
            })
            .catch(() => undefined);
        });
      }

      const harborLottie = page.locator(".harbor-waves [data-animation-owner='lottie']");
      const showcaseLottie = page.locator(".demo-lottie-waves[data-animation-owner='lottie']");
      let exactFallbackObservations = 0;
      const expectHarborFailure = async () => {
        await expectDevelopmentLottieFallback(
          harborLottie,
          failure.reason,
          /Moonlight moving across the harbor static fallback/u,
        );
        exactFallbackObservations += 1;
      };
      const expectShowcaseFailure = async () => {
        await expectDevelopmentLottieFallback(
          showcaseLottie,
          failure.reason,
          /Showcase moonlit waves static fallback/u,
        );
        exactFallbackObservations += 1;
      };

      await page.goto("/");
      await expectHarborFailure();
      await runTwentyCycles(page, async () => {
        await openDevelopmentShowcase(page);
        await expectShowcaseFailure();
        await returnToHarbor(page);
        await expectHarborFailure();
      });

      const expectedObservations = 1 + (lifecycleCycles + 1) * 2;
      expect(exactFallbackObservations).toBe(expectedObservations);
      if (failure.kind === "stalled-load") {
        expect(stalledTransportHits).toBe(expectedObservations);
        await expect.poll(() => pendingStalledTransports.size).toBe(0);
        await expectHarborFailure();
        expect(exactFallbackObservations).toBe(expectedObservations + 1);
      } else {
        expect(stalledTransportHits).toBe(0);
      }
      test.info().annotations.push({
        type: "validation-failpoint",
        description:
          "The failpoint is asset-scoped, development-only, sanitized in the DOM, and separately unit-proven inert in production mode.",
      });
    });
  }

  test("animation showcase serial trailer completes across twenty enter-leave cycles", async ({ page }) => {
    test.setTimeout(extendedTimeout);
    await installExtendedLifecycleProbe(page);
    await setPhase3Motion(page, PHASE3_MOTION_MODES[2]);
    const playTrailer = page.getByRole("button", { name: "PLAY TRAILER" });
    const runTrailer = async () => {
      await playTrailer.click();
      await expect(page.getByRole("button", { name: "STOP TRAILER" })).toBeVisible();
      await expect(playTrailer).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("No runtime errors.")).toBeVisible();
    };
    await page.goto("/");
    await runTwentyCycles(page, async () => {
      await openDevelopmentShowcase(page);
      await runTrailer();
      await returnToHarbor(page);
    });
  });
});

test.describe.serial("Project Lanternwake Phase 3 Quartermaster and audio lifecycle", () => {
  test("mocked Quartermaster confirmations restore focus and release overlays for twenty cycles", async ({
    page,
    phase3Captain,
  }) => {
    test.setTimeout(extendedTimeout);
    await installExtendedLifecycleProbe(page);
    const storage = await phase3Captain.context.storageState();
    await page.context().addCookies(storage.cookies);
    let commandRequests = 0;
    let sequence = 40;
    const interceptedUnsafeRequests: Array<Readonly<{ method: string; pathname: string }>> = [];
    const status = () => ({
      csrfToken: "extended-lifecycle-read-only-csrf",
      campaign: {
        slug: "extended-lifecycle-read-only",
        title: "Extended lifecycle read-only proof",
        status: "ACTIVE",
        sequence,
      },
      chapter: { ordinal: 1, state: "ACTIVE", title: "Read-only lifecycle chapter" },
      playerConnected: false,
      events: [],
      inventory: [],
      sideQuest: null,
      preview: { chapter: { objective: "Keep the confirmation lifecycle mutation-free." } },
    });
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const method = request.method().toUpperCase();
      const pathname = new URL(request.url()).pathname;
      if (method === "GET" && pathname === "/api/gm/status") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(status()) });
        return;
      }
      if (["GET", "HEAD", "OPTIONS"].includes(method)) {
        await route.continue();
        return;
      }
      interceptedUnsafeRequests.push({ method, pathname });
      if (method !== "POST" || pathname !== "/api/gm/commands") {
        await route.fulfill({
          status: 599,
          contentType: "application/json",
          body: JSON.stringify({ error: "Extended lifecycle unsafe request blocked" }),
        });
        return;
      }
      commandRequests += 1;
      sequence += 1;
      const commandInput = request.postDataJSON() as { command?: string; confirmation?: boolean };
      expect(commandInput).toMatchObject({ command: "ADD_LOG_ENTRY", confirmation: true });
      const event = {
        id: `extended-lifecycle-event-${sequence}`,
        type: "PLAYER_LOG_ENTRY_ADDED",
        sequence,
        payload: {},
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "PROGRESSION_EVENT",
          correlationId: `extended-lifecycle-correlation-${sequence}`,
          persistence: "COMMITTED",
          publication: "PROCESS_PUBLISHED",
          delivery: "PUBLISHED",
          deliveryScope: "PROCESS_SUBSCRIBERS_ONLY",
          playerDelivery: "UNCONFIRMED",
          playerPresentation: "UNCONFIRMED",
          playerAcknowledgment: "UNCONFIRMED",
          event,
          playerEvent: event,
        }),
      });
    });
    await page.goto("/quartermaster");
    await expect(page.locator("main.quartermaster-shell:not(.loading-quarters)")).toBeVisible({ timeout: 20_000 });
    const trigger = page.getByRole("button", { name: "Add Player Log Entry" });
    const runConfirmation = async () => {
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Add Player Log Entry" });
      const confirm = dialog.getByRole("button", { name: "Confirm action" });
      const cancel = dialog.getByRole("button", { name: "Cancel" });
      await expect(dialog).toHaveAttribute("aria-modal", "true");
      await expect(page.locator("main.quartermaster-shell")).toHaveAttribute("aria-hidden", "true");
      await expect(page.locator("main.quartermaster-shell")).toHaveAttribute("inert", "");
      await expect(confirm).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(cancel).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(confirm).toBeFocused();
      await confirm.click();
      await expect(dialog).toHaveCount(0, { timeout: 20_000 });
      const skip = page.getByRole("button", { name: "Skip nonessential motion" });
      if (await skip.isVisible().catch(() => false)) await skip.click();
      await expect(page.locator(".cinematic-command-overlay")).toHaveCount(0, { timeout: 20_000 });
      await expect(trigger).toBeFocused();
      await expect(page.locator("main.quartermaster-shell")).not.toHaveAttribute("aria-hidden", "true");
      await expect(page.locator("main.quartermaster-shell")).not.toHaveAttribute("inert", "");
      const dismiss = page.getByRole("button", { name: "Dismiss message" });
      if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
    };
    await runTwentyCycles(page, async () => runConfirmation());
    expect(commandRequests).toBe(lifecycleCycles + 1);
    expect(interceptedUnsafeRequests).toEqual(
      Array.from({ length: lifecycleCycles + 1 }, () => ({ method: "POST", pathname: "/api/gm/commands" })),
    );
  });

  for (const audioCase of [
    { id: "success", mode: "success", muted: false, startsPerTurnPair: 2, failuresPerTurnPair: 0 },
    { id: "blocked-context", mode: "blocked", muted: false, startsPerTurnPair: 0, failuresPerTurnPair: 0 },
    { id: "missing-context", mode: "missing", muted: false, startsPerTurnPair: 0, failuresPerTurnPair: 0 },
    { id: "oscillator-play-failure", mode: "play-error", muted: false, startsPerTurnPair: 0, failuresPerTurnPair: 2 },
    { id: "muted", mode: "success", muted: true, startsPerTurnPair: 0, failuresPerTurnPair: 0 },
  ] as const) {
    test(`audio ${audioCase.id} remains nonblocking and releases work for twenty page-turn cycles`, async ({
      page,
      phase3,
    }) => {
      test.setTimeout(extendedTimeout);
      await installExtendedLifecycleProbe(page, audioCase.mode);
      await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
      await page.addInitScript(({ muted }) => localStorage.setItem("forever-muted", String(muted)), audioCase);
      const fixture = await phase3.createCase(`P3-LIFE-AUDIO-${audioCase.id}`, "CHAPTER_RELEASED");
      await openPhase3Player(page, fixture, "journal");
      const journal = page.locator(".voyage-shell.view-journal");
      const next = page.getByRole("button", { name: "Next journal page" });
      const previous = page.getByRole("button", { name: "Previous journal page" });
      const currentPage = page.locator(
        '[data-pageflip-current="true"][data-pageflip-lifecycle="visible"][data-pageflip-page-id]',
      );
      await expect(next).toBeEnabled();
      const initialPageId = await currentPage.first().getAttribute("data-pageflip-page-id");
      expect(initialPageId).toMatch(/\S/u);
      const turnPair = async () => {
        const before = await readSnapshot(page);
        await next.click();
        await expect
          .poll(() => currentPage.first().getAttribute("data-pageflip-page-id"), {
            message: "The forward page turn did not reach a different semantic page.",
          })
          .not.toBe(initialPageId);
        await previous.click();
        await expect
          .poll(() => currentPage.first().getAttribute("data-pageflip-page-id"), {
            message: "The reverse page turn did not restore the original semantic page.",
          })
          .toBe(initialPageId);
        await expect(journal).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
        const after = await readSnapshot(page);
        expect(after.audioOscillatorStarts - before.audioOscillatorStarts).toBe(audioCase.startsPerTurnPair);
        expect(after.audioNodeFailures - before.audioNodeFailures).toBe(audioCase.failuresPerTurnPair);
        expect(after.activeAudioNodes).toBe(0);
      };
      const { finalSnapshot } = await runTwentyCycles(page, async () => turnPair());
      if (audioCase.mode === "blocked") {
        expect(finalSnapshot.audioResumeAttempts).toBeGreaterThan(0);
        expect(finalSnapshot.audioResumeFailures).toBe(finalSnapshot.audioResumeAttempts);
      }
      if (audioCase.mode === "missing") {
        expect(finalSnapshot.audioContextConstructs).toBeGreaterThan(0);
        expect(finalSnapshot.audioContextFailures).toBe(finalSnapshot.audioContextConstructs);
        expect(finalSnapshot.activeAudioContexts).toBe(0);
      }
      if (audioCase.muted) {
        expect(finalSnapshot.audioOscillatorStarts).toBe(0);
        await expect(page.getByRole("button", { name: "Sound off" })).toHaveAttribute("aria-pressed", "true");
      }
      test.info().annotations.push({
        type: "evidence-gap",
        description:
          "AudioCuePlayer synthesizes oscillator cues and has no decodeAudioData or media-buffer path; decode failure is not a reachable production category.",
      });
    });
  }
});
