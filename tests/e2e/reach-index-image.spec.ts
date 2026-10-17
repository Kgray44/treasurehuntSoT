// @sounding-line-registration owner=reach suite=browser.reach contracts=reach.phase1.foundation
import { expect, test, type Page } from "@playwright/test";
import { pointingPose } from "./fixtures/reach/pointing-poses";

/** Public analytic appearance and fake inference. This is D0 integration proof, never physical recognition proof. */
async function installFixture(page: Page, model = "FULL") {
  await page.addInitScript(
    ({ model, relaxed, curled, endOn }) => {
      const fixture = {
        model,
        x: 120,
        y: 120,
        blank: false,
        repeated: false,
        frames: [] as { capture: number; reply: number }[],
        drawCount: 0,
        tracks: 0,
        workers: 0,
        pending: 0,
        maximumPending: 0,
        replyDelayMs: 2,
      };
      Object.assign(window, { reachIndexImageFixture: fixture });
      const lifecycle = (kind: string) => {
        const report = (window as unknown as { reachFixtureLifecycle?: (value: object) => Promise<void> })
          .reachFixtureLifecycle;
        void report?.({ kind, tracks: fixture.tracks, workers: fixture.workers }).catch(() => {});
      };
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: async (options: MediaStreamConstraints) => {
          if (options.audio !== false) throw new Error("MICROPHONE_REQUESTED");
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 240;
          const ctx = canvas.getContext("2d")!;
          const draw = () => {
            fixture.drawCount++;
            ctx.fillStyle = "rgb(30,30,30)";
            ctx.fillRect(0, 0, 320, 240);
            if (fixture.blank) return;
            const finger = (x: number, y: number) => {
              ctx.fillStyle = "rgb(110,110,110)";
              ctx.fillRect(x - 10, y - 9, 21, 43);
              for (let dy = -10; dy <= 10; dy++)
                for (let dx = -10; dx <= 10; dx++) {
                  const v = 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + 100000) % 135);
                  ctx.fillStyle = `rgb(${v},${v},${v})`;
                  ctx.fillRect(x + dx, y + dy, 1, 1);
                }
            };
            finger(fixture.x, fixture.y);
            if (fixture.repeated) finger(fixture.x + 20, fixture.y);
          };
          draw();
          const timer = setInterval(draw, 1000 / 30);
          const stream = canvas.captureStream(30);
          for (const track of stream.getTracks()) {
            fixture.tracks++;
            const stop = track.stop.bind(track);
            track.stop = () => {
              clearInterval(timer);
              if (track.readyState === "live") fixture.tracks--;
              stop();
              lifecycle("STOP_TRACK");
            };
          }
          return stream;
        },
      });
      class FixtureWorker extends EventTarget {
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror = null;
        terminated = false;
        constructor(_url: string | URL, _options?: WorkerOptions) {
          super();
          void _url;
          void _options;
          fixture.workers++;
        }
        postMessage(message: { type: string; generation: number; capture: number; bitmap?: ImageBitmap }) {
          if (message.type === "INIT") {
            setTimeout(() => {
              if (!this.terminated)
                this.onmessage?.(
                  new MessageEvent("message", { data: { type: "READY", generation: message.generation } }),
                );
            }, 0);
            return;
          }
          if (message.type !== "FRAME") return;
          const width = message.bitmap!.width,
            height = message.bitmap!.height;
          message.bitmap!.close();
          fixture.pending++;
          fixture.maximumPending = Math.max(fixture.maximumPending, fixture.pending);
          const source = fixture.model === "WRONG" ? curled : fixture.model === "DIRECT" ? endOn : relaxed;
          const tip = {
            x: fixture.x / 319 + (fixture.model === "WRONG" ? 0.15 : 0),
            y: fixture.y / 239 + (fixture.model === "WRONG" ? 0.1 : 0),
          };
          const points = source.map((point, index) =>
            fixture.model === "INDEX" && ![5, 6, 7, 8].includes(index)
              ? { x: -1, y: -1, z: 0 }
              : { ...point, x: point.x + tip.x - source[8].x, y: point.y + tip.y - source[8].y },
          );
          const result = {
            landmarks: fixture.model === "NONE" ? [] : [points],
            handedness: fixture.model === "NONE" ? [] : [[{ categoryName: "Right", score: 0.95 }]],
          };
          setTimeout(() => {
            fixture.pending--;
            if (this.terminated) return;
            const reply = performance.now();
            fixture.frames.push({ capture: message.capture, reply });
            if (fixture.frames.length > 600) fixture.frames.shift();
            this.onmessage?.(
              new MessageEvent("message", {
                data: {
                  type: "RESULT",
                  generation: message.generation,
                  capture: message.capture,
                  inferenceTime: performance.timeOrigin + reply,
                  width,
                  height,
                  result,
                },
              }),
            );
          }, fixture.replyDelayMs);
        }
        terminate() {
          if (!this.terminated) fixture.workers--;
          this.terminated = true;
          lifecycle("TERMINATE_WORKER");
        }
      }
      window.Worker = FixtureWorker as unknown as typeof Worker;
    },
    {
      model,
      relaxed: pointingPose({ indexBends: [0, 10, 20] }),
      curled: pointingPose({ indexBends: [0, 100, 150] }),
      endOn: pointingPose({ indexBends: [0, 5, 10], depthAngle: 85 }),
    },
  );
}
async function configure(
  page: Page,
  value: { model?: string; x?: number; y?: number; blank?: boolean; repeated?: boolean; replyDelayMs?: number },
) {
  await page.evaluate(
    (value) => Object.assign((window as unknown as { reachIndexImageFixture: object }).reachIndexImageFixture, value),
    value,
  );
}
const root = (page: Page) => page.locator("section[data-image-state]");
const ready = (page: Page) =>
  expect(page.getByRole("button", { name: "Set up relative movement", exact: true })).toBeEnabled({ timeout: 30000 });
async function markByClick(page: Page, x: number, y: number, mirrored: boolean) {
  await page.getByRole("button", { name: "Track visible fingertip", exact: true }).click();
  const picker = page.getByRole("button", { name: /^Mark visible fingertip in camera/ });
  const box = (await picker.boundingBox())!;
  const scale = Math.min(box.width / 320, box.height / 240),
    width = 320 * scale,
    height = 240 * scale;
  await picker.click({
    position: {
      x: (box.width - width) / 2 + (mirrored ? 1 - x / 319 : x / 319) * width,
      y: (box.height - height) / 2 + (y / 239) * height,
    },
  });
}

test("D0 image-relative control follows fresh appearance through model failure, motion and interruption", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  await installFixture(page);
  await page.goto("/devices/reach");
  await page.getByRole("button", { name: "Enable live camera", exact: true }).click();
  await ready(page);
  const initial = await root(page).getAttribute("data-image-track-generation");
  expect(Number(initial)).toBeGreaterThan(0);
  const sampled = await page.evaluate(async () => {
    const state = (
      window as unknown as {
        reachIndexImageFixture: { model: string; x: number; y: number; frames: { capture: number; reply: number }[] };
      }
    ).reachIndexImageFixture;
    const section = document.querySelector<HTMLElement>("section[data-image-state]")!;
    const records: {
      now: number;
      capture: number;
      inference: number;
      state: string;
      generation: string;
      agreement: string;
      x: number | null;
      y: number | null;
      expectedX: number;
      expectedY: number;
    }[] = [];
    const waypoints = [
      [120, 120],
      [180, 180],
      [260, 60],
      [60, 40],
      [24, 24],
      [296, 24],
      [296, 216],
      [24, 216],
      [120, 120],
    ];
    let tick = 0;
    const sample = () => {
      const svg = document.querySelector<SVGSVGElement>('svg[aria-label="Finger image position"]'),
        circle = svg?.querySelector("circle");
      records.push({
        now: performance.now(),
        capture: Number(section.dataset.imageCaptureTime),
        inference: Number(section.dataset.imageInferenceTime),
        state: section.dataset.imageState!,
        generation: section.dataset.imageTrackGeneration!,
        agreement: section.dataset.imageModelAgreement!,
        x: circle ? Number(circle.getAttribute("cx")) : null,
        y: circle ? Number(circle.getAttribute("cy")) : null,
        expectedX: state.x,
        expectedY: state.y,
      });
    };
    for (const [x, y] of waypoints.slice(1)) {
      const startX = state.x,
        startY = state.y,
        steps = Math.ceil(Math.hypot(x - startX, y - startY) / 6);
      for (let i = 1; i <= steps; i++) {
        state.x = Math.round(startX + ((x - startX) * i) / steps);
        state.y = Math.round(startY + ((y - startY) * i) / steps);
        state.model = ["FULL", "NONE", "WRONG", "INDEX", "DIRECT"][Math.floor(tick++ / 8) % 5];
        await new Promise((resolve) => setTimeout(resolve, 45));
        sample();
      }
    }
    state.model = "NONE";
    await new Promise((resolve) => setTimeout(resolve, 180));
    sample();
    return { records, workerFrames: [...state.frames] };
  });
  const tracked = sampled.records.filter((row) => row.state === "TRACKING");
  expect(tracked.length).toBeGreaterThan(40);
  expect(new Set(tracked.map((row) => row.generation))).toEqual(new Set([initial]));
  expect(tracked.some((row) => row.agreement === "DISAGREE")).toBe(true);
  expect(tracked.some((row) => row.agreement === "UNAVAILABLE")).toBe(true);
  expect(sampled.records.filter((row) => row.state !== "TRACKING")).toEqual([]);
  expect(tracked.every((row) => row.x !== null && row.y !== null)).toBe(true);
  expect(Math.max(...tracked.map((row) => Math.hypot(row.x! - row.expectedX, row.y! - row.expectedY)))).toBeLessThan(
    34,
  );
  await ready(page);
  await page.getByRole("button", { name: "Set up relative movement", exact: true }).click();
  await expect(page.getByLabel("Target 2 of 5", { exact: true })).toBeVisible({ timeout: 12000 });
  await expect(page.getByText(/1 of 5 targets saved/)).toBeVisible();
  // Capture a short actual pixel occlusion in-browser, avoiding driver timing.
  const interruption = await page.evaluate(async () => {
    const state = (window as unknown as { reachIndexImageFixture: { blank: boolean } }).reachIndexImageFixture;
    const section = document.querySelector<HTMLElement>("section[data-image-state]")!,
      states: string[] = [];
    const observer = new MutationObserver(() => states.push(section.dataset.imageState!));
    observer.observe(section, { attributes: true, attributeFilter: ["data-image-state"] });
    state.blank = true;
    await new Promise((resolve) => setTimeout(resolve, 65));
    state.blank = false;
    await new Promise((resolve) => setTimeout(resolve, 240));
    observer.disconnect();
    return states;
  });
  expect(interruption.some((state) => state === "UNCERTAIN" || state === "LOST")).toBe(true);
  await expect(root(page)).toHaveAttribute("data-image-track-generation", initial!);
  await expect(page.getByLabel("Target 2 of 5", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const records: object[] = [];
    const capture = (event: string) => {
      const plane = document.querySelector<HTMLElement>('[aria-label="Pointing practice area"]'),
        rect = plane?.getBoundingClientRect(),
        viewport = window.visualViewport;
      records.push({
        event,
        at: performance.now(),
        plane:
          rect && plane
            ? {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                clientWidth: plane.clientWidth,
                clientHeight: plane.clientHeight,
                offsetWidth: plane.offsetWidth,
                offsetHeight: plane.offsetHeight,
              }
            : null,
        innerWidth,
        innerHeight,
        documentWidth: document.documentElement.clientWidth,
        documentHeight: document.documentElement.clientHeight,
        dpr: devicePixelRatio,
        scrollX,
        scrollY,
        visualViewport: viewport
          ? {
              width: viewport.width,
              height: viewport.height,
              scale: viewport.scale,
              x: viewport.offsetLeft,
              y: viewport.offsetTop,
            }
          : null,
        step: document.querySelector("section[data-step]")?.getAttribute("data-step"),
        setupEnded: document.querySelector('[role="alert"][aria-label="Setup ended"]')?.textContent ?? null,
      });
    };
    const plane = document.querySelector<HTMLElement>('[aria-label="Pointing practice area"]')!;
    new ResizeObserver(() => capture("plane-resize")).observe(plane);
    window.addEventListener("resize", () => capture("window-resize"));
    window.visualViewport?.addEventListener("resize", () => capture("visual-viewport-resize"));
    Object.assign(window, { reachPauseGeometry: { records, capture } });
    capture("before-pause");
  });
  const geometrySnapshot = (event: string) =>
    page.evaluate((event) => {
      const geometry = (
        window as unknown as { reachPauseGeometry: { records: object[]; capture: (event: string) => void } }
      ).reachPauseGeometry;
      geometry.capture(event);
      return geometry.records;
    }, event);
  try {
    await page.getByRole("button", { name: "Pause calibration", exact: true }).click();
    await geometrySnapshot("after-pause");
    await expect(page.getByLabel("Target 2 of 5", { exact: true })).toBeVisible();
    await expect(page.getByText(/1 of 5 targets saved/)).toBeVisible();
    await expect(page.getByRole("alert", { name: "Setup ended", exact: true })).toHaveCount(0);
    await geometrySnapshot("before-viewport-capture");
    await page.screenshot({
      path: testInfo.outputPath("D0-image-model-independent-target-saved.png"),
      fullPage: false,
    });
    await geometrySnapshot("after-viewport-capture");
    await expect(page.getByLabel("Target 2 of 5", { exact: true })).toBeVisible();
    await expect(page.getByText(/1 of 5 targets saved/)).toBeVisible();
    await expect(page.getByRole("alert", { name: "Setup ended", exact: true })).toHaveCount(0);
  } finally {
    await testInfo.attach("D0-index-image-pause-geometry.json", {
      body: JSON.stringify(await geometrySnapshot("finally"), null, 2),
      contentType: "application/json",
    });
  }
  // A deliberate new anchor is a new source, so saved samples cannot be rebound.
  await markByClick(page, 120, 120, true);
  await expect(page.getByRole("alert", { name: "Setup ended", exact: true })).toContainText(
    "A new fingertip was selected or the camera changed. Begin a fresh setup for this track.",
  );
  await expect(root(page)).not.toHaveAttribute("data-image-track-generation", initial!);
  const percentile = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
  await testInfo.attach("D0-index-image-motion-metrics.json", {
    body: JSON.stringify(
      {
        evidence: "ANALYTIC_CAMERA_PIXELS_AND_FAKE_WORKER_D0_ONLY",
        samples: sampled.records.length,
        tracked: tracked.length,
        identityChanges: new Set(tracked.map((row) => row.generation)).size - 1,
        fakeWorkerCaptureHz:
          (1000 * (sampled.workerFrames.length - 1)) /
          (sampled.workerFrames.at(-1)!.capture - sampled.workerFrames[0].capture),
        sampledImageUiHz:
          (1000 * (new Set(tracked.map((row) => row.capture)).size - 1)) / (tracked.at(-1)!.now - tracked[0].now),
        uiSampledAgeP95Ms: percentile(tracked.filter((row) => row.capture > 0).map((row) => row.now - row.capture)),
        fakeWorkerReplyP95Ms: percentile(sampled.workerFrames.map((row) => row.reply - row.capture)),
        sampledImageInferenceP95Ms: percentile(
          tracked.filter((row) => row.capture > 0).map((row) => row.inference - row.capture),
        ),
        physicalLatencyQualified: false,
        physicalRecognitionQualified: false,
        heldOutAccuracyQualified: false,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await page.getByRole("button", { name: "Stop camera & clear session", exact: true }).click();
});

test("D0 manual image-only hints support mirrored click and natural keyboard while ambiguous pixels abstain", async ({
  page,
}, testInfo) => {
  await installFixture(page, "NONE");
  await page.goto("/devices/reach");
  await page.getByRole("button", { name: "Enable live camera", exact: true }).click();
  await expect(page.getByRole("button", { name: "Track visible fingertip", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Set up relative movement", exact: true })).toBeDisabled();
  await markByClick(page, 120, 120, true);
  await ready(page);
  await expect(page.locator('svg[aria-label="Finger image position"] circle')).toHaveAttribute("cx", /\d/);
  await configure(page, { blank: true });
  await expect(root(page)).not.toHaveAttribute("data-image-state", "TRACKING");
  await page.screenshot({ path: testInfo.outputPath("D0-image-only-occlusion.png"), fullPage: false });
  await markByClick(page, 120, 120, true);
  await expect(page.getByRole("button", { name: "Set up relative movement", exact: true })).toBeDisabled();
  await configure(page, { blank: false, repeated: true });
  await markByClick(page, 120, 120, true);
  await expect(page.getByRole("button", { name: "Set up relative movement", exact: true })).toBeDisabled();
  await configure(page, { repeated: false, x: 182, y: 129 });
  await page.getByRole("button", { name: "Use natural preview", exact: true }).click();
  await page.getByRole("button", { name: "Enable live camera", exact: true }).click();
  await page.getByRole("button", { name: "Track visible fingertip", exact: true }).click();
  const picker = page.getByRole("button", { name: /^Mark visible fingertip in camera/ });
  for (let i = 0; i < 7; i++) await picker.press("ArrowRight");
  for (let i = 0; i < 4; i++) await picker.press("ArrowDown");
  await picker.press("Enter");
  await ready(page);
  await expect
    .poll(async () => Number(await page.locator('svg[aria-label="Finger image position"] circle').getAttribute("cx")))
    .toBeGreaterThan(178);
  await page.screenshot({ path: testInfo.outputPath("D0-image-only-natural-keyboard-hint.png"), fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Track visible fingertip", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("D0-image-only-mobile-hint-picker.png"), fullPage: false });
  await page.getByRole("button", { name: /^Mark visible fingertip in camera/ }).press("Escape");
  // Border clipping has insufficient patch support; it must abstain honestly.
  await page.evaluate(async () => {
    const state = (window as unknown as { reachIndexImageFixture: { x: number; y: number } }).reachIndexImageFixture;
    const startX = state.x,
      startY = state.y,
      steps = Math.ceil(Math.hypot(startX - 2, startY - 2) / 4);
    for (let i = 1; i <= steps; i++) {
      state.x = Math.round(startX + ((2 - startX) * i) / steps);
      state.y = Math.round(startY + ((2 - startY) * i) / steps);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  });
  await expect(root(page)).not.toHaveAttribute("data-image-state", "TRACKING");
  await expect(page.getByRole("button", { name: "Set up relative movement", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Stop camera & clear session", exact: true }).click();
});

test("D0 stale model replies hide the image marker, pause collection and recover the same image source", async ({
  page,
}, testInfo) => {
  await installFixture(page);
  await page.goto("/devices/reach");
  await page.getByRole("button", { name: "Enable live camera", exact: true }).click();
  await ready(page);
  const generation = await root(page).getAttribute("data-image-track-generation");
  await configure(page, { model: "NONE" });
  await page.getByRole("button", { name: "Set up relative movement", exact: true }).click();
  await expect(page.getByLabel("Target 2 of 5", { exact: true })).toBeVisible({ timeout: 12000 });
  await configure(page, { replyDelayMs: 200 });
  await expect(root(page)).toHaveAttribute("data-image-state", "STALE");
  await expect(page.locator('svg[aria-label="Finger image position"]')).toHaveCount(0);
  await expect(page.getByText("Finger image tracking", { exact: true })).not.toBeVisible();
  await expect(page.getByLabel("Target 2 of 5", { exact: true })).toBeVisible();
  await expect(page.getByText(/1 of 5 targets saved/)).toBeVisible();
  const stale = await page.evaluate(() => {
    const fixture = (
      window as unknown as {
        reachIndexImageFixture: { tracks: number; workers: number; maximumPending: number };
      }
    ).reachIndexImageFixture;
    const section = document.querySelector<HTMLElement>("section[data-image-state]")!;
    return {
      state: section.dataset.imageState,
      captureAge: performance.now() - Number(section.dataset.imageCaptureTime),
      tracks: fixture.tracks,
      workers: fixture.workers,
      maximumPending: fixture.maximumPending,
    };
  });
  expect(stale).toMatchObject({ state: "STALE", tracks: 1, workers: 1, maximumPending: 1 });
  expect(stale.captureAge).toBeGreaterThan(250);
  await page.screenshot({ path: testInfo.outputPath("D0-image-only-stale-callbacks.png"), fullPage: false });
  await configure(page, { replyDelayMs: 2 });
  await expect(root(page)).toHaveAttribute("data-image-state", "TRACKING");
  await expect(root(page)).toHaveAttribute("data-image-track-generation", generation!);
  await expect(page.locator('svg[aria-label="Finger image position"] circle')).toBeVisible();
  await expect(page.getByLabel("Target 2 of 5", { exact: true })).toBeVisible();
  await expect(page.getByText(/1 of 5 targets saved/)).toBeVisible();
  await testInfo.attach("D0-index-image-stale-metrics.json", {
    body: JSON.stringify({ evidence: "ANALYTIC_CAMERA_AND_DELAYED_FAKE_WORKER", ...stale }, null, 2),
    contentType: "application/json",
  });
  await page.getByRole("button", { name: "Stop camera & clear session", exact: true }).click();
});

test("D0 adaptive pacing backs off on visible blur and event-loop duress, then actual pagehide releases resources", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const lifecycle: { kind: string; tracks: number; workers: number }[] = [];
  await page.exposeBinding("reachFixtureLifecycle", (_source, value) => {
    lifecycle.push(value);
  });
  await installFixture(page);
  await page.goto("/devices/reach");
  await page.getByRole("button", { name: "Enable live camera", exact: true }).click();
  await ready(page);
  const measured = await page.evaluate(async () => {
    const state = (
      window as unknown as {
        reachIndexImageFixture: {
          frames: { capture: number; reply: number }[];
          maximumPending: number;
          tracks: number;
          workers: number;
        };
      }
    ).reachIndexImageFixture;
    const section = document.querySelector<HTMLElement>("section[data-image-state]")!;
    const phases: { name: string; from: number; to: number; frames: { capture: number; reply: number }[] }[] = [];
    const phase = async (name: string, run: () => Promise<void>) => {
      const from = performance.now();
      await run();
      const to = performance.now();
      phases.push({
        name,
        from,
        to,
        frames: state.frames.filter((frame) => frame.capture >= from && frame.capture <= to),
      });
    };
    await phase("focused", () => new Promise((resolve) => setTimeout(resolve, 1000)));
    const visibleBeforeBlur = document.visibilityState;
    window.dispatchEvent(new Event("blur"));
    await phase("visible-simulated-blur", () => new Promise((resolve) => setTimeout(resolve, 1300)));
    window.dispatchEvent(new Event("focus"));
    await phase("focus-recovery", () => new Promise((resolve) => setTimeout(resolve, 2200)));
    await phase("controlled-event-loop-duress", async () => {
      for (const duration of [55, 75, 95, 65, 85]) {
        const until = performance.now() + duration;
        while (performance.now() < until) {
          /* Bounded intentional browser-thread stress. */
        }
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    });
    await phase("post-duress-recovery", () => new Promise((resolve) => setTimeout(resolve, 2500)));
    return {
      visibleBeforeBlur,
      visibleAfter: document.visibilityState,
      phases,
      maximumPending: state.maximumPending,
      tracks: state.tracks,
      workers: state.workers,
      finalImageState: section.dataset.imageState,
      finalCaptureAge: performance.now() - Number(section.dataset.imageCaptureTime),
    };
  });
  expect(measured.visibleBeforeBlur).toBe("visible");
  expect(measured.visibleAfter).toBe("visible");
  expect(measured.maximumPending).toBe(1);
  expect(measured).toMatchObject({ tracks: 1, workers: 1 });
  const metrics = measured.phases.map((phase) => {
    const intervals = phase.frames.slice(1).map((frame, index) => frame.capture - phase.frames[index].capture);
    const sorted = [...intervals].sort((a, b) => a - b);
    return {
      name: phase.name,
      captured: phase.frames.length,
      captureHz: (phase.frames.length * 1000) / (phase.to - phase.from),
      medianIntervalMs: sorted[Math.floor(sorted.length / 2)] ?? null,
      maximumReplyAgeMs: Math.max(0, ...phase.frames.map((frame) => frame.reply - frame.capture)),
    };
  });
  const blur = metrics.find((phase) => phase.name === "visible-simulated-blur")!;
  const focused = metrics.find((phase) => phase.name === "focused")!;
  const recovery = metrics.find((phase) => phase.name === "focus-recovery")!;
  expect(blur.captureHz).toBeLessThanOrEqual(9);
  expect(blur.captureHz).toBeLessThan(focused.captureHz);
  expect(recovery.captureHz).toBeGreaterThan(blur.captureHz);
  expect(metrics.every((phase) => phase.maximumReplyAgeMs <= 150)).toBe(true);
  await testInfo.attach("D0-index-image-duress-metrics.json", {
    body: JSON.stringify(
      {
        evidence: "REAL_BROWSER_WITH_ANALYTIC_CAMERA_AND_FAKE_WORKER",
        focusEvent: "SIMULATED_BLUR_FOCUS_WITH_DOCUMENT_REMAINING_VISIBLE",
        physicalLatencyQualified: false,
        ...measured,
        phases: metrics,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  // Real navigation dispatches the browser's pagehide event; release telemetry
  // is sent from the old document before its execution context is discarded.
  await page.goto("about:blank");
  await expect
    .poll(() => lifecycle.some((event) => event.kind === "STOP_TRACK" && event.tracks === 0 && event.workers === 0))
    .toBe(true);
  expect(lifecycle.some((event) => event.kind === "TERMINATE_WORKER" && event.workers === 0)).toBe(true);
});
