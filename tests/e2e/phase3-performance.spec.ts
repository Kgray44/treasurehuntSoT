import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { devices, type Locator, type Page } from "@playwright/test";

import {
  PHASE3_MOTION_MODES,
  expect,
  openPhase3Player,
  phase3Test,
  readPhase3Evidence,
  setPhase3Motion,
  type Phase3FixtureManager,
  type Phase3ReceiptEvidence,
} from "./fixtures/lanternwake-phase3";

const budgets = Object.freeze({
  chapterMs: 10_000,
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

type VisualProbeResult = Readonly<{
  elapsedMs: number;
  frameDurationsMs: readonly number[];
  longTaskDurationsMs: readonly number[];
  cls: number;
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

type CompleteReceiptEvidence = Phase3ReceiptEvidence & {
  scene: NonNullable<Phase3ReceiptEvidence["scene"]>;
  targetReport: NonNullable<Phase3ReceiptEvidence["targetReport"]>;
};

function requireCompleteReceipt(receipt: Phase3ReceiptEvidence): asserts receipt is CompleteReceiptEvidence {
  expect(receipt.scene, "The production receipt must include Director scene evidence.").not.toBeNull();
  expect(receipt.targetReport, "The production receipt must include exact target preflight evidence.").not.toBeNull();
  if (!receipt.scene || !receipt.targetReport) {
    throw new Error("The production receipt omitted required scene or target evidence.");
  }
}

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
    const runtimeWindow = window as unknown as Window & {
      __phase3RuntimeCounter?: { activeEventSources: number };
    };
    const counter = { activeEventSources: 0 };
    runtimeWindow.__phase3RuntimeCounter = counter;
    const NativeEventSource = window.EventSource;
    window.EventSource = new Proxy(NativeEventSource, {
      construct(target, args) {
        const source = Reflect.construct(target, args) as EventSource;
        const nativeClose = source.close.bind(source);
        let closed = false;
        counter.activeEventSources += 1;
        Object.defineProperty(source, "close", {
          configurable: true,
          value: () => {
            if (!closed) {
              closed = true;
              counter.activeEventSources = Math.max(0, counter.activeEventSources - 1);
            }
            nativeClose();
          },
        });
        return source;
      },
    });
  });
}

async function readRuntimeBaseline(page: Page): Promise<RuntimeBaseline> {
  return page.evaluate(() => {
    const runtimeWindow = window as unknown as Window & {
      __phase3RuntimeCounter?: { activeEventSources: number };
    };
    const counter = runtimeWindow.__phase3RuntimeCounter;
    if (!counter) throw new Error("The runtime counter is missing.");
    return {
      sceneHosts: document.querySelectorAll("[data-scene-host-id]").length,
      sceneTargets: document.querySelectorAll("[data-scene-target-id]").length,
      claimedTargets: document.querySelectorAll("[data-animation-owner]").length,
      activeAnimations: document
        .getAnimations()
        .filter((animation) => animation.pending || animation.playState === "running").length,
      eventSources: counter.activeEventSources,
      pageFlipBooks: document.querySelectorAll("[data-pageflip-book-id]").length,
      temporaryPageClones: document.querySelectorAll("[data-pageflip-temporary-clone],[data-pageflip-unproven-clone]")
        .length,
      lottiePlaying: document.querySelectorAll('[data-lottie-status="playing"]').length,
      riveCanvases: document.querySelectorAll(".rive-object canvas").length,
      activePresentations: document.querySelectorAll('[data-progression-state="active"]').length,
    };
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
    type LayoutShiftEntry = PerformanceEntry & { value: number; hadRecentInput: boolean };
    type Probe = {
      startedAt: number;
      lastFrameAt: number | null;
      frameDurationsMs: number[];
      longTaskDurationsMs: number[];
      cls: number;
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
      startedAt: performance.now(),
      lastFrameAt: null,
      frameDurationsMs: [],
      longTaskDurationsMs: [],
      cls: 0,
      frame: 0,
    } as unknown as Probe;
    const sampleFrame = (at: number) => {
      if (probe.lastFrameAt !== null) probe.frameDurationsMs.push(at - probe.lastFrameAt);
      probe.lastFrameAt = at;
      probe.frame = requestAnimationFrame(sampleFrame);
    };
    probe.longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) probe.longTaskDurationsMs.push(entry.duration);
    });
    probe.layoutShiftObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShiftEntry[]) {
        if (!entry.hadRecentInput) probe.cls += entry.value;
      }
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
        longTaskDurationsMs: number[];
        cls: number;
        frame: number;
        longTaskObserver: PerformanceObserver;
        layoutShiftObserver: PerformanceObserver;
      };
    };
    const probe = probeWindow.__phase3VisualProbe;
    if (!probe) throw new Error("The visual performance probe is missing.");
    cancelAnimationFrame(probe.frame);
    probe.longTaskObserver.takeRecords().forEach((entry) => probe.longTaskDurationsMs.push(entry.duration));
    probe.layoutShiftObserver.takeRecords().forEach((entry) => {
      const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (!shift.hadRecentInput) probe.cls += shift.value;
    });
    probe.longTaskObserver.disconnect();
    probe.layoutShiftObserver.disconnect();
    delete probeWindow.__phase3VisualProbe;
    if (probe.frameDurationsMs.length === 0) throw new Error("No animation-frame intervals were measured.");
    return {
      elapsedMs: performance.now() - probe.startedAt,
      frameDurationsMs: probe.frameDurationsMs,
      longTaskDurationsMs: probe.longTaskDurationsMs,
      cls: probe.cls,
    };
  });
}

async function waitForNewReceipt(page: Page, eventId: string, startingCount: number, source: "live" | "replay") {
  await expect
    .poll(
      async () =>
        (await readPhase3Evidence(page)).receipts
          .slice(startingCount)
          .find((receipt) => receipt.eventId === eventId && receipt.source === source),
      { message: `No new ${source} receipt arrived for the measured presentation.`, timeout: 20_000 },
    )
    .toBeTruthy();
  const receipt = (await readPhase3Evidence(page)).receipts
    .slice(startingCount)
    .find((candidate) => candidate.eventId === eventId && candidate.source === source)!;
  requireCompleteReceipt(receipt);
  expect(receipt.targetReport.requiredSatisfied).toBe(true);
  expect(receipt.targetReport.failures).toEqual([]);
  expect(receipt.scene.finalization).toMatchObject({
    handoffCompleted: true,
    cleanupStarted: true,
    cleanupCompleted: true,
  });
  return receipt;
}

async function measureReplayResponse(control: Locator) {
  return control.evaluate((button) => {
    const overlay = document.querySelector<HTMLElement>("[data-progression-overlay]");
    if (!overlay) throw new Error("The progression overlay is missing.");
    const initialPresentation = overlay.dataset.presentationId ?? "";
    const startedAt = performance.now();
    return new Promise<number>((resolve, reject) => {
      const observer = new MutationObserver(() => check());
      const timeout = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error("Replay did not begin within the measurement window."));
      }, 1_000);
      const check = () => {
        if (
          overlay.dataset.progressionState === "active" &&
          (overlay.dataset.presentationId ?? "") !== initialPresentation
        ) {
          observer.disconnect();
          clearTimeout(timeout);
          resolve(performance.now() - startedAt);
        }
      };
      observer.observe(overlay, { attributes: true });
      (button as HTMLButtonElement).click();
      check();
    });
  });
}

async function measureSkipResponse(control: Locator, eventId: string) {
  return control.evaluate((button, expectedEventId) => {
    const overlay = document.querySelector<HTMLElement>("[data-progression-overlay]");
    if (!overlay) throw new Error("The progression overlay is missing.");
    const initialStatus = overlay.dataset.presentationStatus ?? "";
    const initialState = overlay.dataset.progressionState ?? "";
    const startedAt = performance.now();
    return new Promise<{ responseMs: number; cleanupMs: number }>((resolve, reject) => {
      let responseMs: number | null = null;
      let cleanupMs: number | null = null;
      const observer = new MutationObserver(() => check());
      const timeout = window.setTimeout(() => {
        observer.disconnect();
        window.removeEventListener("forever:progression-receipt", onReceipt);
        reject(new Error("Skip response or cleanup did not complete within the measurement window."));
      }, 2_000);
      const finish = () => {
        if (responseMs === null || cleanupMs === null) return;
        observer.disconnect();
        clearTimeout(timeout);
        window.removeEventListener("forever:progression-receipt", onReceipt);
        resolve({ responseMs, cleanupMs });
      };
      const onReceipt = (event: Event) => {
        const detail = (event as CustomEvent<{ eventId?: unknown; source?: unknown }>).detail;
        if (detail?.eventId !== expectedEventId || detail.source !== "replay") return;
        cleanupMs = performance.now() - startedAt;
        check();
        finish();
      };
      const check = () => {
        if (
          responseMs === null &&
          ((overlay.dataset.presentationStatus ?? "") !== initialStatus ||
            (overlay.dataset.progressionState ?? "") !== initialState)
        ) {
          responseMs = performance.now() - startedAt;
          finish();
        }
      };
      window.addEventListener("forever:progression-receipt", onReceipt);
      observer.observe(overlay, { attributes: true });
      (button as HTMLButtonElement).click();
      check();
    });
  }, eventId);
}

async function measurePageControlResponse(control: Locator) {
  return control.evaluate((button) => {
    const book = document.querySelector<HTMLElement>("[data-pageflip-book-id]");
    if (!book) throw new Error("The PageFlip book is missing.");
    const currentIndex = book.querySelector<HTMLElement>("[data-page-index]")?.dataset.pageIndex ?? "";
    const initialFlipState = book.dataset.flipState ?? "";
    const startedAt = performance.now();
    return new Promise<number>((resolve, reject) => {
      const observer = new MutationObserver(() => check());
      const timeout = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error("The PageFlip control did not begin responding within the measurement window."));
      }, 1_000);
      const check = () => {
        const nextIndex = book.querySelector<HTMLElement>("[data-page-index]")?.dataset.pageIndex ?? "";
        if (nextIndex !== currentIndex || (book.dataset.flipState ?? "") !== initialFlipState) {
          observer.disconnect();
          clearTimeout(timeout);
          resolve(performance.now() - startedAt);
        }
      };
      observer.observe(book, { attributes: true, childList: true, subtree: true });
      (button as HTMLButtonElement).click();
      check();
    });
  });
}

async function measureNavigationResponse(control: Locator, destination: string) {
  return control.evaluate((button, destinationView) => {
    const shell = document.querySelector<HTMLElement>(".voyage-shell");
    if (!shell) throw new Error("The Player shell is missing.");
    const startedAt = performance.now();
    return new Promise<number>((resolve, reject) => {
      const observer = new MutationObserver(() => check());
      const timeout = window.setTimeout(() => {
        observer.disconnect();
        reject(new Error("Section navigation did not begin within the measurement window."));
      }, 1_000);
      const check = () => {
        if (shell.classList.contains(`view-${destinationView}`)) {
          observer.disconnect();
          clearTimeout(timeout);
          resolve(performance.now() - startedAt);
        }
      };
      observer.observe(shell, { attributes: true, attributeFilter: ["class"] });
      (button as HTMLButtonElement).click();
      check();
    });
  }, destination);
}

async function measuredReplay(page: Page, phase3: Phase3FixtureManager, eventId: string, measureResponse: boolean) {
  const startingCount = (await readPhase3Evidence(page)).receipts.length;
  await startVisualProbe(page);
  const startedAt = performance.now();
  const responseMs = measureResponse
    ? await measureReplayResponse(
        page.locator(`[data-progress-event-id="${eventId}"]`).getByRole("button", { name: "Replay presentation" }),
      )
    : (await phase3.replay(page, eventId), null);
  const receipt = await waitForNewReceipt(page, eventId, startingCount, "replay");
  const durationMs = performance.now() - startedAt;
  const visual = await stopVisualProbe(page);
  return { receipt, durationMs, responseMs, visual };
}

function validateReceipt(
  receipt: Phase3ReceiptEvidence,
  expectedMotion: "full" | "reduced",
  expectedStatus: "presented" | "skipped",
) {
  requireCompleteReceipt(receipt);
  expect(receipt).toMatchObject({
    eventType: "CHAPTER_RELEASED",
    status: expectedStatus,
    fallbackResult: "not-used",
    finalStateResult: expect.stringMatching(/^(committed|reconciled)$/u),
    motionPolicy: { level: expectedMotion },
    scene: {
      outcome: expectedStatus === "presented" ? "presented" : "skipped-by-user",
      cleanup: expect.stringMatching(/^completed/u),
    },
    targetReport: { requiredSatisfied: true, failures: [] },
  });
  if (expectedStatus === "skipped") {
    expect(receipt.source).toBe("replay");
    expect(receipt.acknowledgmentEligible).toBe(false);
  }
}

phase3Test("owned production P0 performance and lifecycle budgets", async ({ page, phase3, browser, browserName }) => {
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
  await openPhase3Player(page, fixture, "journal");

  const startingCount = (await readPhase3Evidence(page)).receipts.length;
  await startVisualProbe(page);
  const coldStartedAt = performance.now();
  const command = await phase3.publish(fixture);
  const coldReceipt = await waitForNewReceipt(page, command.event.id, startingCount, "live");
  const coldDurationMs = performance.now() - coldStartedAt;
  const coldVisual = await stopVisualProbe(page);
  validateReceipt(coldReceipt, "full", "presented");
  const fullRuntimeBaseline = await waitForStableRuntimeBaseline(page);

  const desktopRuns = [coldVisual];
  const mobileRuns: VisualProbeResult[] = [];
  const warmRuns: Awaited<ReturnType<typeof measuredReplay>>[] = [];
  const replayResponsesMs: number[] = [];
  for (let index = 0; index < 3; index += 1) {
    const run = await measuredReplay(page, phase3, command.event.id, index === 0);
    validateReceipt(run.receipt, "full", "presented");
    warmRuns.push(run);
    desktopRuns.push(run.visual);
    if (run.responseMs !== null) replayResponsesMs.push(run.responseMs);
  }

  const mobileContext = await browser.newContext({
    ...devices["Pixel 7"],
    baseURL: "http://127.0.0.1:3200",
  });
  try {
    const mobilePage = await mobileContext.newPage();
    await installRuntimeCounter(mobilePage);
    await setPhase3Motion(mobilePage, PHASE3_MOTION_MODES[0]);
    await openPhase3Player(mobilePage, fixture, "journal");
    await expect(mobilePage.locator("[data-progression-overlay]")).toHaveAttribute(
      "data-progression-state",
      "inactive",
      { timeout: 20_000 },
    );
    for (let index = 0; index < 3; index += 1) {
      const run = await measuredReplay(mobilePage, phase3, command.event.id, false);
      validateReceipt(run.receipt, "full", "presented");
      warmRuns.push(run);
      mobileRuns.push(run.visual);
    }
  } finally {
    await mobileContext.close();
  }

  const skipStartCount = (await readPhase3Evidence(page)).receipts.length;
  await startVisualProbe(page);
  await page
    .locator(`[data-progress-event-id="${command.event.id}"]`)
    .getByRole("button", { name: "Replay presentation" })
    .click();
  const overlay = page.locator("[data-progression-overlay]");
  await expect(overlay).toHaveAttribute("data-progression-state", "active");
  const skipMeasurement = await measureSkipResponse(
    overlay.getByRole("button", { name: "Reveal readable result" }),
    command.event.id,
  );
  const skippedReceipt = await waitForNewReceipt(page, command.event.id, skipStartCount, "replay");
  const skipVisual = await stopVisualProbe(page);
  validateReceipt(skippedReceipt, "full", "skipped");
  expect(await waitForStableRuntimeBaseline(page)).toEqual(fullRuntimeBaseline);

  // M1 and M4 both persist product `full`, so their init scripts cannot race;
  // M4 resolves reduced solely through Chromium's browser preference.
  await setPhase3Motion(page, PHASE3_MOTION_MODES[3]);
  await page.reload();
  await expect(page.locator(".voyage-shell")).toHaveAttribute("data-journal-phase", "JOURNAL_READY", {
    timeout: 20_000,
  });
  await expect(page.locator(`[data-progress-event-id="${command.event.id}"]`)).toBeVisible();
  const reducedRuntimeBaseline = await waitForStableRuntimeBaseline(page);

  const preflightWarmupCount = 8;
  const preflightSampleCount = 40;
  const preflightSamplesMs: number[] = [];
  for (let index = 0; index < preflightWarmupCount + preflightSampleCount; index += 1) {
    const evidenceCount = (await readPhase3Evidence(page)).receipts.length;
    await phase3.replay(page, command.event.id);
    const receipt = await waitForNewReceipt(page, command.event.id, evidenceCount, "replay");
    validateReceipt(receipt, "reduced", "presented");
    expect(receipt.targetReport.durationMs).toBeGreaterThanOrEqual(0);
    if (index >= preflightWarmupCount) preflightSamplesMs.push(receipt.targetReport.durationMs);
  }
  expect(preflightSamplesMs).toHaveLength(preflightSampleCount);
  expect(await waitForStableRuntimeBaseline(page)).toEqual(reducedRuntimeBaseline);

  const nextPage = page.getByRole("button", { name: "Next journal page" });
  await expect(nextPage).toBeEnabled();
  const pageControlResponseMs = await measurePageControlResponse(nextPage);

  await startVisualProbe(page);
  const navigation = page.getByRole("navigation", { name: "Companion sections" });
  const navigationResponseMs = await measureNavigationResponse(
    navigation.getByRole("button", { name: /^Chart/u }),
    "chart",
  );
  await expect(page.locator(".voyage-shell.view-chart")).toBeVisible();
  await waitAnimationFrames(page, 30);
  const ordinaryVisual = await stopVisualProbe(page);

  const chapterVisuals = [...desktopRuns, ...mobileRuns, skipVisual];
  const desktopFrames = desktopRuns.flatMap((run) => [...run.frameDurationsMs]);
  const mobileFrames = mobileRuns.flatMap((run) => [...run.frameDurationsMs]);
  const chapterLongTasks = chapterVisuals.flatMap((run) => [...run.longTaskDurationsMs]);
  const chapterCumulativeLongTasks = chapterVisuals.map((run) => total(run.longTaskDurationsMs));
  const chapterCls = chapterVisuals.map((run) => run.cls);
  const controlResponsesMs = [
    ...replayResponsesMs,
    skipMeasurement.responseMs,
    pageControlResponseMs,
    navigationResponseMs,
  ];
  const metrics = {
    coldChapterMs: rounded(coldDurationMs),
    warmChapterMs: warmRuns.map((run) => rounded(run.durationMs)),
    preflightP95Ms: rounded(percentile(preflightSamplesMs, 0.95)),
    controlResponseMs: controlResponsesMs.map(rounded),
    cleanupMs: rounded(skipMeasurement.cleanupMs),
    desktopFrameP95Ms: rounded(percentile(desktopFrames, 0.95)),
    mobileFrameP95Ms: rounded(percentile(mobileFrames, 0.95)),
    chapterMaximumLongTaskMs: rounded(maximum(chapterLongTasks)),
    chapterCumulativeLongTaskMs: rounded(maximum(chapterCumulativeLongTasks)),
    ordinaryMaximumLongTaskMs: rounded(maximum(ordinaryVisual.longTaskDurationsMs)),
    ordinaryCumulativeLongTaskMs: rounded(total(ordinaryVisual.longTaskDurationsMs)),
    chapterMaximumCls: rounded(maximum(chapterCls)),
    ordinaryCls: rounded(ordinaryVisual.cls),
  };

  expect(replayResponsesMs, "Exactly one warm replay response sample is required.").toHaveLength(1);
  const budgetChecks = [
    { name: "chapter-cold-duration", passed: coldDurationMs < budgets.chapterMs },
    ...warmRuns.map((run, index) => ({
      name: `chapter-warm-${String(index + 1).padStart(2, "0")}-duration`,
      passed: run.durationMs < budgets.chapterMs,
    })),
    { name: "target-preflight-p95", passed: metrics.preflightP95Ms < budgets.preflightP95Ms },
    { name: "control-replay-response", passed: replayResponsesMs[0]! < budgets.controlResponseMs },
    { name: "control-skip-response", passed: skipMeasurement.responseMs < budgets.controlResponseMs },
    { name: "control-pageflip-response", passed: pageControlResponseMs < budgets.controlResponseMs },
    { name: "control-navigation-response", passed: navigationResponseMs < budgets.controlResponseMs },
    { name: "skip-cleanup", passed: skipMeasurement.cleanupMs < budgets.cleanupMs },
    { name: "desktop-frame-p95", passed: metrics.desktopFrameP95Ms <= budgets.desktopFrameP95Ms },
    { name: "mobile-frame-p95", passed: metrics.mobileFrameP95Ms <= budgets.mobileFrameP95Ms },
    { name: "chapter-maximum-long-task", passed: metrics.chapterMaximumLongTaskMs <= budgets.maximumLongTaskMs },
    { name: "ordinary-maximum-long-task", passed: metrics.ordinaryMaximumLongTaskMs <= budgets.maximumLongTaskMs },
    {
      name: "chapter-cumulative-long-task",
      passed: metrics.chapterCumulativeLongTaskMs <= budgets.chapterLongTaskCumulativeMs,
    },
    {
      name: "ordinary-cumulative-long-task",
      passed: metrics.ordinaryCumulativeLongTaskMs <= budgets.ordinaryLongTaskCumulativeMs,
    },
    { name: "chapter-maximum-cls", passed: metrics.chapterMaximumCls <= budgets.cls },
    { name: "ordinary-cls", passed: metrics.ordinaryCls <= budgets.cls },
  ] as const;
  const budgetNames = budgetChecks.map((check) => check.name);
  expect(new Set(budgetNames).size, "Performance budget evidence names must be unique.").toBe(budgetNames.length);
  budgetNames.forEach((name) => expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u));
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
    version: 2,
    completedAtUtc: new Date().toISOString(),
    runId,
    provenance: Object.freeze({
      testedSourceSha,
      integratedSha,
      config: "playwright.phase3-performance.config.ts",
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
      coldP0: 1,
      warmP0: warmRuns.length,
      preflightWarmups: preflightWarmupCount,
      preflightMeasured: preflightSamplesMs.length,
      desktopFrames: desktopFrames.length,
      mobileFrames: mobileFrames.length,
    }),
    budgets,
    metrics,
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
      [fixture.slug, command.event.id],
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
    [fixture.slug, command.event.id],
  );
});
