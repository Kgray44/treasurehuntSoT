import fs from "node:fs/promises";
import path from "node:path";

import { devices, type Locator, type Page } from "@playwright/test";

import { resolveLegacyCampaign } from "../../src/compatibility/legacy-companion";
import {
  PAGE_TURN_LIFECYCLE_BROWSER_EVENT,
  type PageTurnLifecycleBrowserDetail,
} from "../../src/components/animation/PageFlipBook";
import {
  PHASE3_MOTION_MODES,
  expect,
  phase3Test,
  setPhase3Motion,
  type Phase3CaseFixture,
} from "./fixtures/lanternwake-phase3";

const budgets = Object.freeze({
  openingMs: 10_000,
  preflightP95Ms: 50,
  controlResponseMs: 100,
  cleanupMs: 250,
  desktopFrameP95Ms: 25,
  mobileFrameP95Ms: 40,
  maximumLongTaskMs: 100,
  chapterLongTaskCumulativeMs: 200,
  ordinaryLongTaskCumulativeMs: 100,
  cls: 0.1,
});

type LayoutShiftSample = Readonly<{ atMs: number; score: number; phase: string | null; sources: string[] }>;

type VisualProbeResult = Readonly<{
  elapsedMs: number;
  frameDurationsMs: readonly number[];
  framesByPhase: Record<string, number[]>;
  longTaskDurationsMs: readonly number[];
  cls: number;
  layoutShifts: readonly LayoutShiftSample[];
}>;

type RuntimeBaseline = Readonly<{
  sceneHosts: number;
  sceneTargets: number;
  claimedTargets: number;
  activeAnimations: number;
  eventSources: number;
  pageFlipBooks: number;
  temporaryPageClones: number;
  lottiePlaying: number;
  riveCanvases: number;
  activePresentations: number;
}>;

type JournalRuntimeProbe = Readonly<{ snapshot: () => RuntimeBaseline }>;

function percentile(values: readonly number[], fraction: number) {
  expect(values.length, "A percentile cannot pass without measured samples.").toBeGreaterThan(0);
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]!;
}

function total(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0);
}

function maximum(values: readonly number[]) {
  return values.length > 0 ? Math.max(...values) : 0;
}

function rounded(value: number) {
  expect(Number.isFinite(value), "Performance evidence must contain only finite measurements.").toBe(true);
  return Math.round(value * 1_000) / 1_000;
}

function boundedEnvironmentValue(names: readonly string[], pattern: RegExp, fallback: string) {
  const entry = names.map((name) => [name, process.env[name]] as const).find(([, value]) => value !== undefined);
  if (!entry) return fallback;
  const [name, value] = entry;
  if (!value || value.length > 96 || !pattern.test(value)) {
    throw new Error(`${name} is not a bounded validation evidence value.`);
  }
  return value;
}

function performanceArtifactTarget() {
  const artifactRoot = process.env.VALIDATION_ARTIFACTS;
  expect(artifactRoot, "VALIDATION_ARTIFACTS is required for sanitized performance evidence.").toBeTruthy();
  expect(path.isAbsolute(artifactRoot!), "Performance artifact root must be absolute.").toBe(true);
  const resolvedRoot = path.resolve(artifactRoot!);
  const artifactDirectory = path.resolve(resolvedRoot, "phase3-performance");
  expect(artifactDirectory.startsWith(`${resolvedRoot}${path.sep}`)).toBe(true);
  return {
    artifactDirectory,
    artifactPath: path.join(artifactDirectory, "phase3-performance-metrics.json"),
  };
}

async function writePerformanceArtifact(
  artifactPath: string,
  report: Readonly<Record<string, unknown>>,
  forbiddenValues: readonly string[],
) {
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  for (const forbidden of forbiddenValues) {
    if (forbidden) expect(serialized).not.toContain(forbidden);
  }
  await fs.writeFile(artifactPath, serialized, "utf8");
}

async function installRuntimeCounter(page: Page) {
  await page.addInitScript(() => {
    const runtimeWindow = window as unknown as Window & { __phase3RuntimeCounter?: JournalRuntimeProbe };
    let activeEventSources = 0;
    const nativeEventSource = window.EventSource;
    window.EventSource = new Proxy(nativeEventSource, {
      construct(target, args) {
        const source = Reflect.construct(target, args) as EventSource;
        const nativeClose = source.close.bind(source);
        let closed = false;
        activeEventSources += 1;
        Object.defineProperty(source, "close", {
          configurable: true,
          value: () => {
            if (!closed) {
              closed = true;
              activeEventSources -= 1;
            }
            nativeClose();
          },
        });
        return source;
      },
    });
    runtimeWindow.__phase3RuntimeCounter = {
      snapshot: () => ({
        sceneHosts: document.querySelectorAll("[data-scene-host-id]").length,
        sceneTargets: document.querySelectorAll("[data-scene-target-id]").length,
        claimedTargets: document.querySelectorAll("[data-animation-owner]").length,
        activeAnimations: document
          .getAnimations()
          .filter((animation) => animation.pending || animation.playState === "running").length,
        eventSources: activeEventSources,
        pageFlipBooks: document.querySelectorAll("[data-pageflip-book-id]").length,
        temporaryPageClones: document.querySelectorAll(
          '[data-pageflip-role="temporary"], [data-pageflip-role="unproven"]',
        ).length,
        lottiePlaying: document.querySelectorAll('[data-lottie-status="playing"]').length,
        riveCanvases: document.querySelectorAll(".rive-object canvas").length,
        activePresentations: document.querySelectorAll('[data-journal-opening-outcome="running"]').length,
      }),
    };
  });
}

async function readRuntimeBaseline(page: Page): Promise<RuntimeBaseline> {
  return page.evaluate(() => {
    const probe = (window as unknown as Window & { __phase3RuntimeCounter?: JournalRuntimeProbe })
      .__phase3RuntimeCounter;
    if (!probe) throw new Error("The Journal runtime counter is missing.");
    return probe.snapshot();
  });
}

async function waitForStableRuntimeBaseline(page: Page) {
  let previous: RuntimeBaseline | null = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    const current = await readRuntimeBaseline(page);
    if (
      previous &&
      JSON.stringify(current) === JSON.stringify(previous) &&
      current.activeAnimations === 0 &&
      current.activePresentations === 0 &&
      current.temporaryPageClones === 0 &&
      current.lottiePlaying === 0
    ) {
      return current;
    }
    previous = current;
    await page.waitForTimeout(50);
  }
  throw new Error("The observable animation runtime did not return to a stable terminal baseline.");
}

async function waitAnimationFrames(page: Page, count: number) {
  await page.evaluate(
    (frameCount) =>
      new Promise<void>((resolve) => {
        let remaining = frameCount;
        const next = () => {
          remaining -= 1;
          if (remaining <= 0) resolve();
          else requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
      }),
    count,
  );
}

async function startVisualProbe(page: Page) {
  await page.evaluate(() => {
    type LayoutShiftEntry = PerformanceEntry & {
      value: number;
      hadRecentInput: boolean;
      sources?: { node?: Node | null }[];
    };
    type Probe = {
      startedAt: number;
      lastFrameAt: number | null;
      frameTimeStamps: number[];
      phaseChanges: Array<{ at: number; phase: string }>;
      phaseObserver: MutationObserver;
      frameDurationsMs: number[];
      longTaskDurationsMs: number[];
      cls: number;
      layoutShifts: LayoutShiftSample[];
      recordShift: (entry: PerformanceEntry) => void;
      frame: number;
      longTaskObserver: PerformanceObserver;
      layoutShiftObserver: PerformanceObserver;
    };
    const probeWindow = window as unknown as Window & { __phase3VisualProbe?: Probe };
    if (probeWindow.__phase3VisualProbe) throw new Error("A visual performance probe is already active.");
    if (document.visibilityState !== "visible") throw new Error("Performance measurement requires a visible page.");
    const supported = new Set(PerformanceObserver.supportedEntryTypes);
    if (!supported.has("longtask") || !supported.has("layout-shift")) {
      throw new Error("Chromium did not expose required longtask and layout-shift metrics.");
    }

    const probe = {
      startedAt: window.performance.now(),
      lastFrameAt: null,
      frameDurationsMs: [],
      frameTimeStamps: [],
      phaseChanges: [],
      longTaskDurationsMs: [],
      cls: 0,
      layoutShifts: [],
      frame: 0,
    } as unknown as Probe;
    const sampleFrame = (at: number) => {
      if (probe.lastFrameAt !== null) {
        probe.frameDurationsMs.push(at - probe.lastFrameAt);
        probe.frameTimeStamps.push(at);
      }
      probe.lastFrameAt = at;
      probe.frame = requestAnimationFrame(sampleFrame);
    };
    const samplePhase = () => {
      const phase = document.querySelector(".chronicle-journal-shell")?.getAttribute("data-journal-phase") ?? "outside";
      if (probe.phaseChanges.at(-1)?.phase !== phase)
        probe.phaseChanges.push({ at: window.performance.now(), phase });
    };
    samplePhase();
    probe.phaseObserver = new MutationObserver(samplePhase);
    probe.phaseObserver.observe(document.documentElement, {
      subtree: true, childList: true, attributes: true, attributeFilter: ["data-journal-phase"],
    });
    probe.longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) probe.longTaskDurationsMs.push(entry.duration);
    });
    probe.recordShift = (entry) => {
      const shift = entry as LayoutShiftEntry;
      if (shift.hadRecentInput) return;
      probe.cls += shift.value;
      probe.layoutShifts.push({
        atMs: Math.max(0, shift.startTime - probe.startedAt),
        score: shift.value,
        phase: document.querySelector(".chronicle-journal-shell")?.getAttribute("data-journal-phase") ?? null,
        sources: (shift.sources ?? []).map(({ node }) => {
          const element = node instanceof Element ? node : node?.parentElement;
          if (!element) return "unknown";
          return [
            element.tagName.toLowerCase(),
            ...[...element.classList].filter((name) => /^[a-z0-9-]+$/i.test(name)).slice(0, 3),
          ].join(".");
        }),
      });
    };
    probe.layoutShiftObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) probe.recordShift(entry);
    });
    probe.longTaskObserver.observe({ type: "longtask", buffered: false });
    probe.layoutShiftObserver.observe({ type: "layout-shift", buffered: false });
    probe.frame = requestAnimationFrame(sampleFrame);
    probeWindow.__phase3VisualProbe = probe;
  });
}

async function stopVisualProbe(page: Page): Promise<VisualProbeResult> {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
  return page.evaluate(() => {
    const probeWindow = window as unknown as Window & {
      __phase3VisualProbe?: {
        startedAt: number;
        frameDurationsMs: number[];
        frameTimeStamps: number[];
        phaseChanges: Array<{ at: number; phase: string }>;
        phaseObserver: MutationObserver;
        longTaskDurationsMs: number[];
        cls: number;
        layoutShifts: VisualProbeResult["layoutShifts"];
        recordShift: (entry: PerformanceEntry) => void;
        frame: number;
        longTaskObserver: PerformanceObserver;
        layoutShiftObserver: PerformanceObserver;
      };
    };
    const probe = probeWindow.__phase3VisualProbe;
    if (!probe) throw new Error("The visual performance probe is missing.");
    cancelAnimationFrame(probe.frame);
    probe.phaseObserver.disconnect();
    probe.longTaskObserver.takeRecords().forEach((entry) => probe.longTaskDurationsMs.push(entry.duration));
    probe.layoutShiftObserver.takeRecords().forEach(probe.recordShift);
    probe.longTaskObserver.disconnect();
    probe.layoutShiftObserver.disconnect();
    delete probeWindow.__phase3VisualProbe;
    if (probe.frameDurationsMs.length === 0) throw new Error("No animation-frame intervals were measured.");
    const framesByPhase: Record<string, number[]> = {};
    let phaseIndex = 0;
    for (const [index, interval] of probe.frameDurationsMs.entries()) {
      const begin = probe.frameTimeStamps[index]! - interval;
      while (phaseIndex + 1 < probe.phaseChanges.length &&
        probe.phaseChanges[phaseIndex + 1]!.at <= begin) phaseIndex++;
      const phase = probe.phaseChanges[phaseIndex]?.phase ?? "outside";
      (framesByPhase[phase] ??= []).push(interval);
    }
    return {
      elapsedMs: window.performance.now() - probe.startedAt,
      frameDurationsMs: probe.frameDurationsMs,
      framesByPhase,
      longTaskDurationsMs: probe.longTaskDurationsMs,
      cls: probe.cls,
      layoutShifts: probe.layoutShifts,
    };
  });
}

const journal = (page: Page) => page.locator(".chronicle-journal-shell");
const replay = (page: Page) => page.getByRole("button", { name: "Replay full opening" });

async function enterJournal(page: Page, fixture: Phase3CaseFixture, path: string) {
  const access = await page.request.post("/api/player/access", {
    data: { campaignSlug: fixture.slug, accessCode: fixture.accessCode },
  });
  expect(access.ok(), "The isolated Player must be admitted to the Voyage.").toBe(true);
  await page.goto(path);
  await expect(journal(page)).toBeVisible();
}

async function assertReadableJournal(page: Page, reduced = false) {
  await expect(journal(page)).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
  const book = journal(page).locator(".main-journal-book");
  await expect(book).toBeVisible();
  if (reduced) {
    await expect(book).toHaveAttribute("data-pageflip-status", "reduced");
    await expect(book.locator(".reduced-page-stage > [data-page-index]")).toBeVisible();
  } else {
    const primary = book.locator(
      '[data-pageflip-role="primary"][data-pageflip-current="true"][data-pageflip-lifecycle="visible"]',
    );
    await expect(primary).toHaveCount(1);
    await expect(primary).toBeVisible();
  }
}

type OpeningMeasurement = {
  durationMs: number;
  responseMs: number;
  phases: string[];
  reason: string;
  bookStatus: string | null;
};

async function measureOpening(control: Locator): Promise<OpeningMeasurement> {
  await control.evaluate((button) => {
    const shell = button.closest<HTMLElement>(".chronicle-journal-shell");
    if (!shell) throw new Error("The opening control must belong to the canonical Journal.");
    const probeWindow = window as unknown as Window & { __phase3OpeningMeasurement?: Promise<OpeningMeasurement> };
    const phases = new Set<string>();
    const initialPhase = shell.dataset.journalPhase;
    probeWindow.__phase3OpeningMeasurement = new Promise((resolve, reject) => {
      let startedAt: number | null = null;
      let responseMs: number | null = null;
      const onClick = (event: Event) => {
        if (!event.isTrusted) return;
        startedAt = window.performance.now();
      };
      const finish = (error?: Error) => {
        observer.disconnect();
        button.removeEventListener("click", onClick, true);
        clearTimeout(timeout);
        if (error) reject(error);
        else if (startedAt !== null && responseMs !== null) {
          resolve({
            durationMs: window.performance.now() - startedAt,
            responseMs,
            phases: [...phases],
            reason: shell.dataset.journalReadyReason ?? "",
            bookStatus: shell.querySelector(".main-journal-book")?.getAttribute("data-pageflip-status") ?? null,
          });
        }
      };
      const observer = new MutationObserver((mutations) => {
        if (startedAt === null) return;
        const phase = shell.dataset.journalPhase;
        for (const record of mutations) {
          if (record.attributeName === "data-journal-phase" && record.oldValue) phases.add(record.oldValue);
        }
        if (phase) phases.add(phase);
        if (
          responseMs === null &&
          (phase !== initialPhase || shell.dataset.journalOpeningOutcome === "running" || phases.has("BOOK_SETTLING"))
        ) {
          responseMs = window.performance.now() - startedAt;
        }
        if (
          responseMs !== null &&
          phase === "JOURNAL_READY" &&
          phases.has("BOOK_SETTLING") &&
          shell.dataset.journalReadyReason
        ) {
          finish();
        }
      });
      const timeout = window.setTimeout(
        () => finish(new Error("The Journal opening did not hand off to a readable page.")),
        12_000,
      );
      observer.observe(shell, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ["data-journal-phase", "data-journal-opening-outcome", "data-journal-ready-reason"],
      });
      button.addEventListener("click", onClick, { capture: true, once: true });
    });
  });
  await control.click();
  return control.page().evaluate(() => {
    const probeWindow = window as unknown as Window & { __phase3OpeningMeasurement?: Promise<OpeningMeasurement> };
    const result = probeWindow.__phase3OpeningMeasurement;
    delete probeWindow.__phase3OpeningMeasurement;
    if (!result) throw new Error("The Journal's trusted activation measurement is missing.");
    return result;
  });
}

type SkipMeasurement = {
  responseMs: number;
  cleanupMs: number;
  observations: { elapsedMs: number; counts: RuntimeBaseline; animations: string[] }[];
};

async function measureSkip(control: Locator, baseline: RuntimeBaseline): Promise<SkipMeasurement> {
  await control.evaluate((button, expected) => {
    const shell = button.closest<HTMLElement>(".chronicle-journal-shell");
    const probeWindow = window as unknown as Window & {
      __phase3RuntimeCounter?: JournalRuntimeProbe;
      __phase3SkipMeasurement?: Promise<SkipMeasurement>;
    };
    const probe = probeWindow.__phase3RuntimeCounter;
    if (!shell || !probe) throw new Error("The active Journal and its cleanup probe are required.");
    probeWindow.__phase3SkipMeasurement = new Promise((resolve, reject) => {
      const observations: SkipMeasurement["observations"] = [];
      let startedAt: number | null = null;
      let previous = "";
      let responseMs: number | null = null;
      let frame = 0;
      let cleanFrames = 0;
      const onClick = (event: Event) => {
        if (event.isTrusted) startedAt = window.performance.now();
      };
      const finish = () => {
        observer.disconnect();
        button.removeEventListener("click", onClick, true);
        cancelAnimationFrame(frame);
        clearTimeout(timeout);
      };
      const inspectCleanup = () => {
        if (startedAt === null) return;
        const current = probe.snapshot();
        const serialized = JSON.stringify(current);
        const clean = serialized === JSON.stringify(expected);
        if (serialized !== previous) {
          previous = serialized;
          observations.push({
            elapsedMs: window.performance.now() - startedAt,
            counts: current,
            animations: document
              .getAnimations()
              .filter((animation) => animation.pending || animation.playState === "running")
              .map((animation) => {
                if (animation instanceof CSSAnimation) return animation.animationName;
                if (animation instanceof CSSTransition) return animation.transitionProperty;
                return "web-animation";
              }),
          });
        }
        cleanFrames = clean ? cleanFrames + 1 : 0;
        if (responseMs !== null && cleanFrames === 2) {
          finish();
          resolve({ responseMs, cleanupMs: window.performance.now() - startedAt, observations });
          return;
        }
        frame = requestAnimationFrame(inspectCleanup);
      };
      const observer = new MutationObserver(() => {
        if (
          startedAt !== null &&
          responseMs === null &&
          shell.dataset.journalPhase === "JOURNAL_READY" &&
          shell.dataset.journalReadyReason === "skipped"
        ) {
          responseMs = window.performance.now() - startedAt;
          frame = requestAnimationFrame(inspectCleanup);
        }
      });
      const timeout = window.setTimeout(() => {
        finish();
        reject(new Error("The skipped Journal opening did not return to its settled runtime baseline."));
      }, 2_000);
      observer.observe(shell, {
        attributes: true,
        attributeFilter: ["data-journal-phase", "data-journal-ready-reason"],
      });
      button.addEventListener("click", onClick, { capture: true, once: true });
    });
  }, baseline);
  await control.click();
  return control.page().evaluate(() => {
    const probeWindow = window as unknown as Window & { __phase3SkipMeasurement?: Promise<SkipMeasurement> };
    const result = probeWindow.__phase3SkipMeasurement;
    delete probeWindow.__phase3SkipMeasurement;
    if (!result) throw new Error("The Journal's trusted Skip measurement is missing.");
    return result;
  });
}

async function measurePageTurn(control: Locator) {
  return control.evaluate((button, eventName) => {
    const book = button.closest<HTMLElement>(".main-journal-book");
    if (!book) throw new Error("The control must belong to the canonical PageFlip book.");
    const startedAt = window.performance.now();
    return new Promise<{ responseMs: number; events: PageTurnLifecycleBrowserDetail[] }>((resolve, reject) => {
      let responseMs: number | null = null;
      const events: PageTurnLifecycleBrowserDetail[] = [];
      const finish = () => {
        clearTimeout(timeout);
        book.removeEventListener(eventName, onTurn);
      };
      const onTurn = (event: Event) => {
        const detail = (event as CustomEvent<PageTurnLifecycleBrowserDetail>).detail;
        if (detail.source !== "control-next") return;
        events.push(detail);
        if (detail.phase === "start") responseMs = window.performance.now() - startedAt;
        if (detail.phase === "settle" && responseMs !== null) {
          finish();
          resolve({ responseMs, events });
        } else if (detail.phase === "failed" || detail.phase === "cancel") {
          finish();
          reject(new Error("The canonical PageFlip turn did not settle successfully."));
        }
      };
      const timeout = window.setTimeout(() => {
        finish();
        reject(new Error("The PageFlip control did not begin and settle its turn."));
      }, 2_000);
      book.addEventListener(eventName, onTurn);
      (button as HTMLButtonElement).click();
    });
  }, PAGE_TURN_LIFECYCLE_BROWSER_EVENT);
}

async function measureNavigation(control: Locator) {
  return control.evaluate((link) => {
    if (!(link instanceof HTMLAnchorElement)) throw new Error("The Chronicle Library link is required.");
    const destination = new URL(link.href).pathname;
    const startedAt = window.performance.now();
    return new Promise<number>((resolve, reject) => {
      const transition = document.querySelector(".product-route-transition");
      if (!transition) throw new Error("The active product route boundary is missing.");
      const observer = new MutationObserver(() => {
        if (!transition.querySelector(`[data-route-layer="${CSS.escape(destination)}"][data-route-role="incoming"]`))
          return;
        observer.disconnect();
        clearTimeout(timeout);
        resolve(window.performance.now() - startedAt);
      });
      const timeout = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error("The Chronicle Library route did not begin responding."));
      }, 2_000);
      observer.observe(transition, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-route-layer"],
      });
      link.click();
    });
  });
}

async function measuredFullOpening(page: Page, control: Locator) {
  await startVisualProbe(page);
  const opening = await measureOpening(control);
  const visual = await stopVisualProbe(page);
  expect(opening.phases).toContain("CLOSED_BOOK_REVEAL");
  expect(opening.phases).toContain("BOOK_SETTLING");
  expect(opening.reason, "The full opening must complete with its real animated handoff.").toBe("completed");
  await assertReadableJournal(page);
  return { ...opening, visual };
}

phase3Test(
  "canonical production Journal performance and lifecycle budgets",
  async ({ page, phase3, browser, browserName }) => {
    expect(browserName).toBe("chromium");
    expect(process.env.FOREVER_VALIDATION_ISOLATION, "Production performance must use isolated validation.").toBe("1");
    expect(process.env.FOREVER_PHASE3_PERFORMANCE_BASE_URL).toBe("http://127.0.0.1:3200");
    const artifact = performanceArtifactTarget();
    await fs.mkdir(artifact.artifactDirectory, { recursive: true });
    await fs.rm(artifact.artifactPath, { force: true });
    await page.setViewportSize({ width: 1_440, height: 900 });
    await installRuntimeCounter(page);
    await setPhase3Motion(page, PHASE3_MOTION_MODES[0]);
    await phase3.proveIsolation();
    const fixture = await phase3.createCase("P3-PERFORMANCE-CHAPTER", "CHAPTER_RELEASED");
    const voyage = await resolveLegacyCampaign(fixture.slug);
    expect(voyage, "The performance fixture must be bound to a canonical Voyage.").toBeTruthy();
    const journalPath = `/player/playthroughs/${voyage!.sessionId}/journal`;
    await enterJournal(page, fixture, journalPath);

    const cold = await measuredFullOpening(page, page.getByRole("button", { name: "Open the journal" }));
    await expect(journal(page).getByText("Captain channel connected")).toBeVisible();
    await expect(journal(page)).toHaveAttribute("data-live-event", "idle");
    const liveStartedAt = performance.now();
    const live = await phase3.canonicalCaptainAction(fixture, "presentation");
    expect(live.eventType).toBe("presentationTriggered");
    await expect(journal(page)).toHaveAttribute("data-live-event", "revealed");
    await expect(journal(page).locator('[aria-live="assertive"]')).toContainText("A new page was released:");
    const liveUpdateMs = performance.now() - liveStartedAt;
    const fullRuntimeBaseline = await waitForStableRuntimeBaseline(page);
    expect(fullRuntimeBaseline.eventSources).toBe(1);

    const warmRuns: Awaited<ReturnType<typeof measuredFullOpening>>[] = [];
    const desktopRuns = [cold.visual];
    for (let index = 0; index < 3; index += 1) {
      const run = await measuredFullOpening(page, replay(page));
      warmRuns.push(run);
      desktopRuns.push(run.visual);
    }
    const mobileContext = await browser.newContext({ ...devices["Pixel 7"], baseURL: "http://127.0.0.1:3200" });
    const mobileRuns: VisualProbeResult[] = [];
    try {
      const mobile = await mobileContext.newPage();
      await installRuntimeCounter(mobile);
      await setPhase3Motion(mobile, PHASE3_MOTION_MODES[0]);
      await enterJournal(mobile, fixture, journalPath);
      await assertReadableJournal(mobile);
      for (let index = 0; index < 3; index += 1) {
        const run = await measuredFullOpening(mobile, replay(mobile));
        warmRuns.push(run);
        mobileRuns.push(run.visual);
      }
    } finally {
      await mobileContext.close();
    }

    await startVisualProbe(page);
    await replay(page).click();
    await expect(journal(page)).toHaveAttribute("data-journal-opening-outcome", "running");
    const skip = await measureSkip(page.getByRole("button", { name: "Skip ceremony" }), fullRuntimeBaseline);
    const skipVisual = await stopVisualProbe(page);
    await assertReadableJournal(page);
    expect(await waitForStableRuntimeBaseline(page)).toEqual(fullRuntimeBaseline);

    // Reduced mode takes the same preparation/handoff path without the full
    // ceremony. Measure button activation through the readable PageFlip handoff,
    // which includes the phase transition and frame wait rather than timing a DOM query.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(journal(page)).toHaveAttribute("data-motion-level", "reduced");
    await assertReadableJournal(page, true);
    const reducedRuntimeBaseline = await waitForStableRuntimeBaseline(page);
    const preflightWarmupCount = 8;
    const preflightSampleCount = 40;
    const preflightSamplesMs: number[] = [];
    for (let index = 0; index < preflightWarmupCount + preflightSampleCount; index += 1) {
      const handoff = await measureOpening(replay(page));
      expect(handoff.phases).toContain("BOOK_SETTLING");
      // The canonical application intentionally reports the readable reduced
      // book as completed-fallback. An unplanned runtime fallback is distinct.
      expect(handoff.reason).toBe("completed-fallback");
      expect(handoff.bookStatus).toBe("reduced");
      if (index >= preflightWarmupCount) preflightSamplesMs.push(handoff.durationMs);
    }
    expect(preflightSamplesMs).toHaveLength(preflightSampleCount);
    await assertReadableJournal(page, true);
    expect(await waitForStableRuntimeBaseline(page)).toEqual(reducedRuntimeBaseline);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(journal(page)).toHaveAttribute("data-motion-level", "full");
    await assertReadableJournal(page);
    const nextPage = page.getByRole("button", { name: "Next journal page" });
    await expect(nextPage).toBeEnabled();
    const turn = await measurePageTurn(nextPage);
    expect(turn.events.map(({ phase }) => phase)).toEqual(["start", "commit", "settle"]);
    expect(turn.events.at(-1)?.fallbackStatus).toBe("runtime");
    expect(turn.events.at(-1)?.toPage).toBeGreaterThan(turn.events[0]!.fromPage);
    await assertReadableJournal(page);

    await startVisualProbe(page);
    const navigationResponseMs = await measureNavigation(
      journal(page).getByRole("link", { name: /Chronicle Library/ }),
    );
    await expect(page).toHaveURL(/\/player\/library$/);
    await expect(page.getByRole("heading", { name: "My Chronicle Library" })).toBeVisible();
    await waitAnimationFrames(page, 30);
    const ordinaryVisual = await stopVisualProbe(page);

    const openingVisuals = [...desktopRuns, ...mobileRuns, skipVisual];
    const desktopFrames = desktopRuns.flatMap((run) => [...run.frameDurationsMs]);
    const mobileFrames = mobileRuns.flatMap((run) => [...run.frameDurationsMs]);
    const openingLongTasks = openingVisuals.flatMap((run) => [...run.longTaskDurationsMs]);
    const openingCumulativeLongTasks = openingVisuals.map((run) => total(run.longTaskDurationsMs));
    const openingCls = openingVisuals.map((run) => run.cls);
    const replayResponseMs = warmRuns[0]!.responseMs;
    const metrics = {
      coldOpeningMs: rounded(cold.durationMs),
      liveUpdateMs: rounded(liveUpdateMs),
      warmOpeningMs: warmRuns.map((run) => rounded(run.durationMs)),
      preflightP95Ms: rounded(percentile(preflightSamplesMs, 0.95)),
      controlResponseMs: [replayResponseMs, skip.responseMs, turn.responseMs, navigationResponseMs].map(rounded),
      cleanupMs: rounded(skip.cleanupMs),
      desktopFrameP95Ms: rounded(percentile(desktopFrames, 0.95)),
      mobileFrameP95Ms: rounded(percentile(mobileFrames, 0.95)),
      openingMaximumLongTaskMs: rounded(maximum(openingLongTasks)),
      openingCumulativeLongTaskMs: rounded(maximum(openingCumulativeLongTasks)),
      ordinaryMaximumLongTaskMs: rounded(maximum(ordinaryVisual.longTaskDurationsMs)),
      ordinaryCumulativeLongTaskMs: rounded(total(ordinaryVisual.longTaskDurationsMs)),
      openingMaximumCls: rounded(maximum(openingCls)),
      ordinaryCls: rounded(ordinaryVisual.cls),
    };
    expect(warmRuns).toHaveLength(6);
    const budgetChecks = [
      { name: "journal-cold-opening-duration", passed: cold.durationMs < budgets.openingMs },
      { name: "live-journal-update", passed: liveUpdateMs < budgets.openingMs },
      ...warmRuns.map((run, index) => ({
        name: `journal-warm-opening-${String(index + 1).padStart(2, "0")}-duration`,
        passed: run.durationMs < budgets.openingMs,
      })),
      { name: "readable-preflight-p95", passed: metrics.preflightP95Ms < budgets.preflightP95Ms },
      { name: "control-replay-response", passed: replayResponseMs < budgets.controlResponseMs },
      { name: "control-skip-response", passed: skip.responseMs < budgets.controlResponseMs },
      { name: "control-pageflip-response", passed: turn.responseMs < budgets.controlResponseMs },
      { name: "control-navigation-response", passed: navigationResponseMs < budgets.controlResponseMs },
      { name: "skip-cleanup", passed: skip.cleanupMs < budgets.cleanupMs },
      { name: "desktop-frame-p95", passed: metrics.desktopFrameP95Ms <= budgets.desktopFrameP95Ms },
      { name: "mobile-frame-p95", passed: metrics.mobileFrameP95Ms <= budgets.mobileFrameP95Ms },
      { name: "opening-maximum-long-task", passed: metrics.openingMaximumLongTaskMs <= budgets.maximumLongTaskMs },
      { name: "ordinary-maximum-long-task", passed: metrics.ordinaryMaximumLongTaskMs <= budgets.maximumLongTaskMs },
      {
        name: "opening-cumulative-long-task",
        passed: metrics.openingCumulativeLongTaskMs <= budgets.chapterLongTaskCumulativeMs,
      },
      {
        name: "ordinary-cumulative-long-task",
        passed: metrics.ordinaryCumulativeLongTaskMs <= budgets.ordinaryLongTaskCumulativeMs,
      },
      { name: "opening-maximum-cls", passed: metrics.openingMaximumCls <= budgets.cls },
      { name: "ordinary-cls", passed: metrics.ordinaryCls <= budgets.cls },
    ] as const;
    const budgetNames = budgetChecks.map((check) => check.name);
    expect(new Set(budgetNames).size, "Performance budget evidence names must be unique.").toBe(budgetNames.length);
    budgetNames.forEach((name) => expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u));
    const desktopPhaseTiming = desktopRuns.map(run => Object.fromEntries(
      Object.entries(run.framesByPhase).map(([phase, intervals]) => [phase, {
        count: intervals.length, p95: rounded(percentile(intervals, .95)),
        slow: intervals.filter(ms => ms > budgets.desktopFrameP95Ms).length,
      }]),
    ));
    console.log("JOURNAL_CANONICAL_PHASE_TIMING " + JSON.stringify({
      desktop: desktopPhaseTiming, metadata: { viewport: page.viewportSize(), samples: desktopFrames.length },
    }));
    const failedBudgets = budgetChecks.filter((check) => !check.passed).map((check) => check.name);

    const nonceHash = boundedEnvironmentValue(["FOREVER_VALIDATION_NONCE_HASH"], /^[a-f0-9]{64}$/u, "missing");
    expect(nonceHash, "Performance evidence requires the validated nonce hash proof reference.").toMatch(
      /^[a-f0-9]{64}$/u,
    );
    const runId = boundedEnvironmentValue(
      ["FOREVER_VALIDATION_RUN_ID", "VALIDATION_RUN_ID", "GITHUB_RUN_ID", "BUILD_BUILDID"],
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u,
      "phase3-performance-local",
    );
    const testedSourceSha = boundedEnvironmentValue(
      ["FOREVER_VALIDATION_SOURCE_SHA", "VALIDATION_SOURCE_SHA", "GITHUB_SHA"],
      /^[a-fA-F0-9]{40,64}$/u,
      "uncommitted",
    ).toLowerCase();
    const integratedSha = boundedEnvironmentValue(
      ["FOREVER_VALIDATION_INTEGRATED_SHA", "VALIDATION_INTEGRATED_SHA"],
      /^[a-fA-F0-9]{40,64}$/u,
      "uncommitted",
    ).toLowerCase();
    const commonReport = Object.freeze({
      version: 3,
      completedAtUtc: new Date().toISOString(),
      runId,
      provenance: Object.freeze({
        testedSourceSha,
        integratedSha,
        config: "tests/config/playwright/playwright.phase3-performance.config.ts",
        browser: Object.freeze({
          engine: "chromium",
          project: "chromium-production",
          desktopProfile: "Desktop Chrome",
          mobileProfile: "Pixel 7",
        }),
        server: Object.freeze({ kind: "owned-next-start", origin: "http://127.0.0.1:3200", port: 3200 }),
        isolationProof: Object.freeze({
          endpoint: "/api/dev/validation/database-identity",
          nonceHash,
          markerExpectation: "exactly-one",
        }),
      }),
      samples: Object.freeze({
        coldOpenings: 1,
        liveUpdates: 1,
        warmOpenings: warmRuns.length,
        preflightWarmups: preflightWarmupCount,
        preflightMeasured: preflightSamplesMs.length,
        desktopFrames: desktopFrames.length,
        mobileFrames: mobileFrames.length,
      }),
      budgets,
      metrics,
      measurements: {
        desktop: desktopRuns.map((run) => ({
          frameP95Ms: rounded(percentile(run.frameDurationsMs, 0.95)),
          layoutShifts: run.layoutShifts,
        })),
        mobile: mobileRuns.map((run) => ({
          frameP95Ms: rounded(percentile(run.frameDurationsMs, 0.95)),
          layoutShifts: run.layoutShifts,
        })),
        skip: { layoutShifts: skipVisual.layoutShifts, cleanup: skip.observations },
      },
      runtimeBaseline: Object.freeze({
        full: fullRuntimeBaseline,
        reduced: reducedRuntimeBaseline,
        fullReturnedToBaseline: true,
        reducedReturnedToBaseline: true,
      }),
    });

    if (failedBudgets.length > 0) {
      await writePerformanceArtifact(
        artifact.artifactPath,
        Object.freeze({
          ...commonReport,
          status: "failed",
          failureBudgetCount: failedBudgets.length,
          failedBudgets: Object.freeze(failedBudgets),
        }),
        [fixture.slug, voyage!.sessionId],
      );
      expect(failedBudgets, "Production performance budgets failed; see the sanitized failure artifact.").toEqual([]);
      return;
    }

    for (const check of budgetChecks) {
      expect(check.passed, `${check.name} must pass before success evidence is written.`).toBe(true);
    }
    await writePerformanceArtifact(
      artifact.artifactPath,
      Object.freeze({
        ...commonReport,
        status: "passed",
        failureBudgetCount: 0,
        failedBudgets: Object.freeze([]),
      }),
      [fixture.slug, voyage!.sessionId],
    );
  },
);
