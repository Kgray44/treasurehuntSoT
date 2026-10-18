// @sounding-line-registration owner=reach suite=browser.reach contracts=reach.phase1.foundation
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/reach/telemetry", (route) => route.fulfill({ status: 200, json: { accepted: true } }));
});
const status = (page: Page) => page.getByRole("status", { name: "Reach status" });
async function demo(page: Page, mode: "ABSOLUTE" | "RELATIVE" = "ABSOLUTE") {
  await page.goto("/devices/pair");
  await page.getByRole("link", { name: "Find the Hand interaction laboratory" }).click();
  // The isolated development route may compile on its first natural navigation.
  await expect(page.getByRole("heading", { name: "Find your point." })).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Explore guided demo" }).click();
  await expect(status(page)).toContainText("Your fingertip is ready");
  if (mode === "ABSOLUTE") await page.getByRole("radio", { name: /Absolute pointing/ }).check();
}
async function targets(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    await expect(page.getByLabel(`Target ${i + 1} of ${count}`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Move demo hand to target", exact: true }).click();
    if (i < count - 1)
      await expect(page.getByLabel(`Target ${i + 2} of ${count}`, { exact: true })).toBeVisible({ timeout: 7000 });
  }
  await expect(page.getByRole("button", { name: "Recalibrate", exact: true })).toBeVisible({ timeout: 7000 });
}
async function shot(page: Page, name: string) {
  if (process.env.REACH_CAPTURE_ROOT) {
    await mkdir(process.env.REACH_CAPTURE_ROOT, { recursive: true });
    // Active camera/calibration evidence must not resize or scroll its viewport.
    await page.screenshot({ path: path.join(process.env.REACH_CAPTURE_ROOT, `${name}-viewport.png`), fullPage: false });
  }
}

for (const viewport of [
  { width: 1280, height: 800, name: "laptop" },
  { width: 390, height: 844, name: "mobile" },
]) {
  test(`guided absolute experience, held-out check, playground, recovery and private export on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await demo(page);
    await shot(page, `${viewport.name}-tracking`);
    await page.getByRole("button", { name: "Begin nine-point calibration" }).click();
    await page.waitForTimeout(2200);
    await expect(page.getByLabel("Target 1 of 9", { exact: true })).toBeVisible();
    await shot(page, `${viewport.name}-calibration`);
    await page.getByRole("button", { name: "Pause calibration" }).click();
    await expect(page.getByRole("button", { name: "Resume calibration" })).toBeVisible();
    await page.getByRole("button", { name: "Resume calibration" }).click();
    await targets(page, 9);
    await expect(page.getByRole("button", { name: "Open pointing playground" })).toHaveCount(0);
    await page.getByLabel("Demo tracking condition").selectOption("POSTURE");
    await expect(status(page)).toContainText("Extend your index finger");
    await page.getByRole("button", { name: "Check five new targets" }).click();
    await expect(page.getByLabel("Target 1 of 5", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Move demo hand to target" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByLabel("Target 1 of 5", { exact: true })).toBeVisible();
    await shot(page, `${viewport.name}-validation`);
    await page.getByLabel("Demo tracking condition").selectOption("NONE");
    await targets(page, 5);
    await expect(page.getByText("Your independent check passed for this session.", { exact: true })).toBeVisible();
    await shot(page, `${viewport.name}-results`);
    await page.getByRole("button", { name: "Open pointing playground" }).click();
    await page.getByRole("button", { name: "Show a practice target" }).click();
    await page.getByRole("button", { name: "Move demo hand to target" }).click();
    await page.getByRole("checkbox", { name: "Show raw pointer alongside filtered pointer" }).check();
    await shot(page, `${viewport.name}-playground`);
    await page.getByLabel("Demo tracking condition").selectOption("TWO_HANDS");
    await expect(status(page)).toContainText("2 detected");
    await expect(status(page)).toContainText("Your hand is ready");
    await page.getByLabel("Demo tracking condition").selectOption("EDGE");
    await expect(status(page)).toContainText("Move your hand slightly toward the center");
    await expect(page.getByText("1 hand detected", { exact: true })).toBeVisible();
    await shot(page, `${viewport.name}-detected-ineligible`);
    await page.getByLabel("Demo tracking condition").selectOption("NONE");
    await expect(status(page)).toContainText("Your hand is ready");
    await page.getByText("Session diagnostics & privacy", { exact: true }).click();
    await expect(page.getByRole("button", { name: "Export aggregate metrics" })).toBeDisabled();
    await page.getByRole("checkbox", { name: /I consent to downloading/ }).check();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export aggregate metrics" }).click();
    const downloaded = await downloadPromise;
    const exportedText = await readFile((await downloaded.path())!, "utf8"),
      exported = JSON.parse(exportedText);
    expect(exported.evidenceTier).toBe("D0");
    expect(exported.physicalQualification).toBe("PENDING");
    expect(exported.trialAggregates).toHaveLength(2);
    for (const field of ["landmarks", "coefficients", "cameraLeaseId", "trackId"])
      expect(exportedText).not.toContain(field);
    await page.getByRole("button", { name: "Delete calibration", exact: true }).click();
    await expect(page.getByRole("button", { name: "Begin nine-point calibration" })).toBeVisible();
    const a11y = await new AxeBuilder({ page }).include('section[aria-labelledby="reach-heading"]').analyze();
    expect(a11y.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.getByRole("link", { name: "← Device connections" }).click();
    await expect(page).toHaveURL(/\/devices\/pair$/);
  });
}
test("relative movement uses separate setup, check and cursor claims", async ({ page }) => {
  await demo(page, "RELATIVE");
  await page.getByRole("button", { name: "Set up relative movement" }).click();
  await page.waitForTimeout(2200);
  await expect(page.getByLabel("Target 1 of 5", { exact: true })).toBeVisible();
  await targets(page, 5);
  await page.getByRole("button", { name: "Check five new targets" }).click();
  await targets(page, 5);
  await expect(page.getByText("Cursor error on new targets", { exact: true })).toBeVisible();
  await expect(
    page.getByText("This checks movement control. It does not measure where you physically point.", { exact: true }),
  ).toHaveCount(0); // demo has its own stronger simulation disclosure
  await page.getByRole("button", { name: "Open pointing playground" }).click();
  await expect(page.getByText("Relative movement", { exact: true })).toBeVisible();
});
test("posture rejection preserves detection and lets the current target recover", async ({ page }) => {
  await demo(page);
  await page.getByRole("button", { name: "Begin nine-point calibration" }).click();
  await page.getByRole("button", { name: "Move demo hand to target" }).click();
  await page.getByLabel("Demo tracking condition").selectOption("POSTURE");
  await expect(status(page)).toContainText("Extend your index finger");
  await expect(page.getByText("1 hand detected", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Target 1 of 9", { exact: true })).toBeVisible();
  await page.getByLabel("Demo tracking condition").selectOption("NONE");
  await expect(page.getByLabel("Target 2 of 9", { exact: true })).toBeVisible();
});
async function fakeCamera(page: Page, image?: Buffer) {
  const data = image?.toString("base64") ?? null;
  await page.addInitScript((base64) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d")!;
    const telemetry = {
      tracks: 0,
      workers: 0,
      prompts: 0,
      observations: 0,
      draws: 0,
      condition: "POINT",
      x: 0,
      y: 0,
      canvasClears: 0,
      heapAtSetup:
        (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
      uiLongTasks: {
        supported: PerformanceObserver.supportedEntryTypes.includes("longtask"),
        count: 0,
        totalDurationMs: 0,
        maxDurationMs: 0,
      },
    };
    const clearRect = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (
      this: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
    ) {
      telemetry.canvasClears++;
      return clearRect.call(this, x, y, width, height);
    };
    if (telemetry.uiLongTasks.supported)
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          telemetry.uiLongTasks.count++;
          telemetry.uiLongTasks.totalDurationMs += entry.duration;
          telemetry.uiLongTasks.maxDurationMs = Math.max(telemetry.uiLongTasks.maxDurationMs, entry.duration);
        }
      }).observe({ type: "longtask", buffered: true });
    Object.assign(window, { reachTelemetry: telemetry });
    const img = new Image();
    if (base64) img.src = `data:image/jpeg;base64,${base64}`;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async (options: MediaStreamConstraints) => {
        if (options.audio !== false) throw new Error("MICROPHONE_REQUESTED");
        telemetry.prompts++;
        if (base64) await img.decode();
        const render = () => {
          ctx.fillStyle = "#c7c7bf";
          ctx.fillRect(0, 0, 640, 480);
          if (base64 && telemetry.condition !== "HIDDEN") {
            const noise = Math.sin(telemetry.draws * 1.7) * 0.7;
            ctx.drawImage(img, 180 + telemetry.x + noise, 50 + telemetry.y, 260, 350);
            if (telemetry.condition === "PARTIAL") {
              ctx.fillStyle = "#c7c7bf";
              ctx.fillRect(175, 250, 75, 100);
            }
            if (telemetry.condition === "TWO") {
              ctx.save();
              ctx.translate(640, 0);
              ctx.scale(-1, 1);
              ctx.drawImage(img, 15, 70, 180, 300);
              ctx.restore();
            }
          }
          telemetry.draws++;
        };
        render();
        const timer = setInterval(render, 50);
        const stream = canvas.captureStream(20);
        for (const track of stream.getTracks()) {
          telemetry.tracks++;
          const stop = track.stop.bind(track);
          track.stop = () => {
            clearInterval(timer);
            if (track.readyState === "live") telemetry.tracks--;
            stop();
          };
        }
        return stream;
      },
    });
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        telemetry.workers++;
        this.addEventListener("message", (event) => {
          if (event.data.type === "RESULT") telemetry.observations++;
        });
      }
      terminate() {
        telemetry.workers--;
        super.terminate();
      }
    };
  }, data);
}
const telemetry = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          reachTelemetry: {
            tracks: number;
            workers: number;
            prompts: number;
            observations: number;
            draws: number;
            condition: string;
            x: number;
            y: number;
            canvasClears: number;
            heapAtSetup: number | null;
            uiLongTasks: { supported: boolean; count: number; totalDurationMs: number; maxDurationMs: number };
          };
        }
      ).reachTelemetry,
  );
test("photographic video through the actual worker tracks noise, motion, partial occlusion and a second hand, then cleans up", async ({
  page,
}, testInfo) => {
  const photograph = await readFile("tests/e2e/fixtures/reach/pointing_up.jpg");
  await fakeCamera(page, photograph);
  await page.goto("/devices/reach");
  await page.getByRole("button", { name: "Enable live camera" }).click();
  await page.getByRole("radio", { name: /Absolute pointing/ }).check();
  await expect(status(page)).toContainText("Your hand is ready", { timeout: 30000 });
  // Readiness now updates without the old visual debounce. Independently wait
  // for the worker evidence count instead of relying on that UI delay.
  await expect.poll(async () => (await telemetry(page)).observations).toBeGreaterThan(3);
  await shot(page, "worker-photographic-tracking");
  await page.evaluate(() => {
    const t = (window as unknown as { reachTelemetry: { condition: string; x: number } }).reachTelemetry;
    t.condition = "PARTIAL";
    t.x = 20;
  });
  await expect(page.getByText("1 hand detected", { exact: true })).toBeVisible();
  await shot(page, "worker-partial-occlusion");
  await page.evaluate(() => {
    (window as unknown as { reachTelemetry: { condition: string } }).reachTelemetry.condition = "TWO";
  });
  await expect(status(page)).toContainText("2 detected", { timeout: 15000 });
  await shot(page, "worker-two-hands");
  await page.evaluate(() => {
    (window as unknown as { reachTelemetry: { condition: string } }).reachTelemetry.condition = "POINT";
  });
  await expect(status(page)).toContainText("Your hand is ready", { timeout: 10000 });
  await page.getByRole("radio", { name: /Absolute pointing/ }).check();
  await page.getByRole("button", { name: "Begin nine-point calibration" }).click();
  await expect(page.getByRole("button", { name: "Pause calibration" })).toBeVisible();
  await page.waitForTimeout(1400);
  const pointingArea = page.getByLabel("Pointing practice area", { exact: true });
  const beforeScroll = await pointingArea.boundingBox();
  await page.evaluate(() => window.scrollBy(0, 40));
  await page.waitForTimeout(300);
  const afterScroll = await pointingArea.boundingBox();
  expect(Math.abs(afterScroll!.y - beforeScroll!.y)).toBeLessThan(1);
  await expect(page.getByRole("button", { name: "Pause calibration" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel calibration" }).click();
  await page.getByText("Session diagnostics & privacy", { exact: true }).click();
  await page.getByRole("checkbox", { name: /I consent to downloading/ }).check();
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export aggregate metrics" }).click();
  const file = await promise;
  const metrics = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(metrics.timing.inferenceCount).toBeGreaterThan(3);
  await writeFile(
    testInfo.outputPath("worker-performance.json"),
    JSON.stringify({ fixture: "official photographic frame replay", tier: "D1", ...metrics.timing }, null, 2),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(status(page)).toContainText("Camera paused");
  expect(await telemetry(page)).toMatchObject({ tracks: 0, workers: 0, prompts: 1 });
});
for (const fault of ["NONE", "MODEL_UNAVAILABLE"] as const)
  test(`worker ${fault} has bounded lifecycle and recovery`, async ({ page }) => {
    await fakeCamera(page);
    await page.goto("/devices/reach");
    if (fault === "MODEL_UNAVAILABLE")
      await page.route("**/reach/vendor/hand_landmarker.task", (route) => route.abort());
    await page.getByRole("button", { name: "Enable live camera" }).click();
    if (fault === "MODEL_UNAVAILABLE") {
      await expect(status(page)).toContainText("Hand tracking could not load", { timeout: 30000 });
      expect(await telemetry(page)).toMatchObject({ tracks: 0, workers: 0, prompts: 1 });
      await page.getByRole("button", { name: "Explore guided demo" }).click();
      await expect(status(page)).toContainText("Guided demo");
      return;
    }
    await expect(status(page)).toContainText("Show your hand", { timeout: 30000 });
    expect(await telemetry(page)).toMatchObject({ tracks: 1, workers: 1, prompts: 1 });
    await page.getByRole("button", { name: "Stop camera & clear session" }).click();
    expect(await telemetry(page)).toMatchObject({ tracks: 0, workers: 0, prompts: 1 });
  });
test("camera denial has a useful retry and conventional demonstration", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        throw new DOMException("", "NotAllowedError");
      },
    }),
  );
  await page.goto("/devices/reach");
  await page.getByRole("button", { name: "Enable live camera" }).click();
  await expect(status(page)).toContainText("Camera access was declined");
  await shot(page, "camera-denied");
  await page.getByRole("button", { name: "Explore guided demo" }).click();
  await expect(status(page)).toContainText("Your fingertip is ready");
});
test("viewport changes invalidate the fit and preserve camera availability; safe return excludes external URLs", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("button", { name: "Begin nine-point calibration" }).click();
  await page.getByRole("button", { name: "Move demo hand to target" }).click();
  await expect(page.getByLabel("Target 2 of 9", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 900, height: 700 });
  await expect(
    page.getByText(/Your view size changed|The camera, hand or pointing area changed|Your pointing area changed/),
  ).toBeVisible();
  await expect(status(page)).toContainText("Guided demo");
  await expect(page.getByRole("button", { name: "Begin nine-point calibration" })).toBeVisible();
  await expect(page.getByLabel("Target 2 of 9", { exact: true })).toHaveCount(0);
  await shot(page, "viewport-invalidation");
  await page.goto("/devices/reach?returnTo=https://example.com");
  await expect(page.getByRole("link", { name: "← Device connections" })).toHaveAttribute("href", "/devices/pair");
});

test("photographic worker completes nine real-landmark holds and five independent checks", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fakeCamera(page, await readFile("tests/e2e/fixtures/reach/pointing_up.jpg"));
  await page.goto("/devices/reach");
  await page.getByRole("button", { name: "Enable live camera" }).click();
  await page.getByRole("radio", { name: /Absolute pointing/ }).check();
  await expect(status(page)).toContainText("Your hand is ready", { timeout: 30000 });
  await page.getByRole("radio", { name: /Absolute pointing/ }).check();
  const photographicHolds: object[] = [];
  const imageSnapshot = async (stage: string, index: number, target: { x: number; y: number }, boundary: string) => {
    photographicHolds.push(
      await page.locator("section[data-image-state]").evaluate(
        (section, context) => {
          const element = section as HTMLElement;
          const circle = section.querySelector('svg[aria-label="Finger image position"] circle');
          return {
            ...context,
            at: performance.now(),
            imageState: element.dataset.imageState,
            reason: element.dataset.imageReason,
            generation: element.dataset.imageTrackGeneration,
            imageCapture: element.dataset.imageCaptureTime,
            tip: circle ? { x: Number(circle.getAttribute("cx")), y: Number(circle.getAttribute("cy")) } : null,
          };
        },
        { stage, index, target, boundary },
      ),
    );
  };
  const readMetrics = async () => {
    const summary = page.getByText("Session diagnostics & privacy", { exact: true });
    if (!(await summary.locator("..").evaluate((element) => element.hasAttribute("open")))) await summary.click();
    await page.getByRole("checkbox", { name: /I consent to downloading/ }).check();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export aggregate metrics" }).click();
    return JSON.parse(await readFile((await (await downloaded).path())!, "utf8"));
  };
  const holdTargets = async (count: number, stage: string) => {
    for (let index = 0; index < count; index++) {
      const target = page.getByLabel(`Target ${index + 1} of ${count}`, { exact: true });
      await expect(target).toBeVisible();
      const point = await target.evaluate((element) => ({
        x: Number.parseFloat((element as HTMLElement).style.left) / 100,
        y: Number.parseFloat((element as HTMLElement).style.top) / 100,
      }));
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      // Smooth pixel motion feeds real image inference, never injected landmarks.
      await page.evaluate(async (destination) => {
        const fixture = (window as unknown as { reachTelemetry: { x: number; y: number; condition: string } })
          .reachTelemetry;
        const origin = { x: fixture.x, y: fixture.y };
        const goal = { x: (destination.x - 0.5) * 160, y: (destination.y - 0.5) * 120 };
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(goal.x - origin.x), Math.abs(goal.y - origin.y)) / 8));
        for (let step = 1; step <= steps; step++) {
          fixture.x = origin.x + ((goal.x - origin.x) * step) / steps;
          fixture.y = origin.y + ((goal.y - origin.y) * step) / steps;
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
      }, point);
      await imageSnapshot(stage, index, point, "motion-complete");
      if (stage === "TRAINING" && index === 2) {
        await page.evaluate(() => {
          (window as unknown as { reachTelemetry: { condition: string } }).reachTelemetry.condition = "TWO";
        });
        await expect(status(page)).toContainText("2 detected", { timeout: 15000 });
      }
      if (stage === "TRAINING" && index === 4) {
        await page.evaluate(() => {
          (window as unknown as { reachTelemetry: { condition: string } }).reachTelemetry.condition = "PARTIAL";
        });
        await page.waitForTimeout(100);
        await page.evaluate(() => {
          (window as unknown as { reachTelemetry: { condition: string } }).reachTelemetry.condition = "POINT";
        });
      }
      if (index < count - 1)
        await expect(page.getByLabel(`Target ${index + 2} of ${count}`, { exact: true })).toBeVisible({
          timeout: 20000,
        });
      else await expect(page.getByRole("button", { name: "Recalibrate", exact: true })).toBeVisible({ timeout: 20000 });
      await imageSnapshot(stage, index, point, "target-saved");
      await writeFile(
        testInfo.outputPath("photographic-hold-image-points.json"),
        JSON.stringify(photographicHolds, null, 2),
      );
      await page.evaluate(() => {
        (window as unknown as { reachTelemetry: { condition: string } }).reachTelemetry.condition = "POINT";
      });
    }
  };
  await page.getByRole("button", { name: "Begin nine-point calibration" }).click();
  await holdTargets(9, "TRAINING");
  await expect(page.getByRole("button", { name: "Open pointing playground" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check five new targets" })).toBeEnabled();
  await shot(page, "worker-nine-target-fit");
  await page.getByRole("button", { name: "Check five new targets" }).click();
  await holdTargets(5, "VALIDATION");
  await shot(page, "worker-independent-results");
  const absolute = await readMetrics();
  expect(absolute.calibration.mapping).toBe("INDEX_TIP_AXIS_RIDGE_V1");
  // Aggregate counts are raw samples; the visible target loop proves hold counts.
  expect(absolute.calibration.trainingCount).toBeGreaterThanOrEqual(9 * 15);
  expect(absolute.calibration.validationCount).toBeGreaterThanOrEqual(5 * 15);
  if (absolute.calibration.rawValidationP95DiagonalFraction <= 0.03) {
    expect(absolute.calibration.status).toBe("VALIDATED");
    await expect(page.getByRole("button", { name: "Open pointing playground" })).toBeEnabled();
  } else {
    expect(absolute.calibration.status).toBe("FAILED");
    await expect(page.getByRole("button", { name: "Open pointing playground" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Try relative movement" })).toBeVisible();
  }
  await page.getByRole("button", { name: "Recalibrate", exact: true }).click();
  await page.getByRole("radio", { name: /Relative movement/ }).check();
  await page.getByRole("button", { name: "Set up relative movement" }).click();
  await holdTargets(5, "RELATIVE_TRAINING");
  await page.getByRole("button", { name: "Check five new targets" }).click();
  await holdTargets(5, "RELATIVE_VALIDATION");
  const relativeResult = await readMetrics();
  await writeFile(
    testInfo.outputPath("photographic-relative-check-result.json"),
    JSON.stringify(relativeResult, null, 2),
  );
  expect(relativeResult.calibration.rawValidationP95DiagonalFraction).toBeLessThanOrEqual(0.03);
  await expect(page.getByText("Your independent check passed for this session.", { exact: true })).toBeVisible();
  await shot(page, "worker-relative-results");
  await page.getByRole("button", { name: "Open pointing playground" }).click();
  const metrics = await readMetrics();
  expect(metrics.calibration.status).toBe("VALIDATED");
  expect(metrics.calibration.mapping).toBe("INDEX_TIP_DISPLACEMENT_V2");
  expect(metrics.trialAggregates).toHaveLength(4);
  expect(metrics.timing.acquisitionMs).toHaveLength(24);
  expect(metrics.timing.inferenceCount).toBeGreaterThanOrEqual(15 * 24);
  await page.getByRole("button", { name: "Stop camera & clear session" }).click();
  expect(await telemetry(page)).toMatchObject({ tracks: 0, workers: 0, prompts: 1 });
  await page.waitForTimeout(200);
  const stopped = await telemetry(page);
  await page.waitForTimeout(400);
  const settled = await telemetry(page);
  expect(settled.observations).toBe(stopped.observations);
  expect(settled.draws).toBe(stopped.draws);
  expect(settled.canvasClears).toBe(stopped.canvasClears);
  const heapAfterStop = await page.evaluate(
    () => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
  );
  await writeFile(
    testInfo.outputPath("photographic-calibration-performance.json"),
    JSON.stringify(
      {
        fixture:
          "official photograph; smooth translation, pixel noise, incidental second hand and transient partial occlusion",
        tier: "D1",
        physicalQualification: "NOT_CLAIMED",
        absolute: absolute.calibration,
        relative: metrics.calibration,
        ...metrics.timing,
        uiMainThreadLongTasks: settled.uiLongTasks,
        heap: {
          boundary: "Optional performance.memory.usedJSHeapSize snapshots; no forced GC or leak-free claim",
          beforeNavigation: settled.heapAtSetup,
          afterStop: heapAfterStop,
        },
        cleanup: {
          tracks: settled.tracks,
          workers: settled.workers,
          furtherObservations: settled.observations - stopped.observations,
          furtherVideoDraws: settled.draws - stopped.draws,
          furtherCanvasClears: settled.canvasClears - stopped.canvasClears,
        },
      },
      null,
      2,
    ),
  );
});
