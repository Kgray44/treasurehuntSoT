// @sounding-line-registration owner=reach suite=browser.reach contracts=reach.phase1.foundation
import { expect, test, type Page } from "@playwright/test";
import { pointingPose } from "./fixtures/reach/pointing-poses";
test.beforeEach(async ({ page }) => {
  // Controlled fixtures must never populate the live optimization store.
  await page.route("**/api/reach/telemetry", (route) => route.fulfill({ status: 200, json: { accepted: true } }));
});

/** Public analytic appearance and fake inference. This is D0 integration proof, never physical recognition proof. */
async function installFixture(page: Page, model = "FULL") {
  await page.addInitScript(
    ({ model, relaxed, curled, endOn, open }) => {
      const fixture = {
        model,
        x: 120,
        y: 120,
        blank: false,
        repeated: false,
        appearanceRotation: 0,
        frames: [] as { capture: number; reply: number }[],
        modelFrames: [] as { capture: number; mode: string }[],
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
              ctx.save();
              ctx.translate(x, y);
              ctx.rotate((fixture.appearanceRotation * Math.PI) / 180);
              ctx.fillStyle = "rgb(110,110,110)";
              ctx.fillRect(-10, -9, 21, 43);
              for (let dy = -10; dy <= 10; dy++)
                for (let dx = -10; dx <= 10; dx++) {
                  const v = 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + 100000) % 135);
                  ctx.fillStyle = `rgb(${v},${v},${v})`;
                  ctx.fillRect(dx, dy, 1, 1);
                }
              ctx.restore();
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
          const mode = fixture.model;
          const source =
            mode === "WRONG" || mode === "WRONG_ONCE"
              ? curled
              : mode === "DIRECT"
                ? endOn
                : mode === "OPEN"
                  ? open
                  : relaxed;
          const conflict = mode === "WRONG" || mode === "WRONG_ONCE" || mode === "CONFLICT";
          const tip = {
            x: fixture.x / 319 + (conflict ? 0.15 : 0),
            y: fixture.y / 239 + (conflict ? 0.1 : 0),
          };
          const points = source.map((point, index) =>
            mode === "INDEX" && ![5, 6, 7, 8].includes(index)
              ? { x: -1, y: -1, z: 0 }
              : { ...point, x: point.x + tip.x - source[8].x, y: point.y + tip.y - source[8].y },
          );
          const ambiguous = mode === "AMBIGUOUS";
          const result = {
            landmarks:
              mode === "NONE"
                ? []
                : ambiguous
                  ? [points, points.map((point) => ({ ...point, x: point.x + 0.22 }))]
                  : [points],
            handedness:
              mode === "NONE"
                ? []
                : ambiguous
                  ? [[{ categoryName: "Right", score: 0.95 }], [{ categoryName: "Left", score: 0.95 }]]
                  : [[{ categoryName: "Right", score: 0.95 }]],
          };
          fixture.modelFrames.push({ capture: message.capture, mode });
          if (fixture.modelFrames.length > 600) fixture.modelFrames.shift();
          if (mode === "WRONG_ONCE") fixture.model = "NONE";
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
      open: pointingPose({ indexBends: [0, 0, 0], otherBends: [0, 0, 0] }),
    },
  );
}
async function configure(
  page: Page,
  value: {
    model?: string;
    x?: number;
    y?: number;
    blank?: boolean;
    repeated?: boolean;
    replyDelayMs?: number;
    appearanceRotation?: number;
  },
) {
  await page.evaluate(
    (value) => Object.assign((window as unknown as { reachIndexImageFixture: object }).reachIndexImageFixture, value),
    value,
  );
}
const root = (page: Page) => page.locator("section[data-image-state]");
const ready = async (page: Page) => {
  await expect(root(page)).toHaveAttribute("data-image-state", "TRACKING", { timeout: 30000 });
  await expect(root(page)).toHaveAttribute("data-reach-readiness", "READY");
  await expect(page.getByRole("button", { name: "Set up relative movement", exact: true })).toBeEnabled();
};
const unavailable = async (page: Page) => {
  await expect(root(page)).not.toHaveAttribute("data-image-state", "TRACKING");
  await expect(root(page)).not.toHaveAttribute("data-reach-readiness", "READY");
  await expect(page.locator('svg[aria-label="Finger image position"]')).toHaveCount(0);
  await expect(root(page)).toHaveAttribute("data-step", "PREPARE");
  await expect(page.locator('[data-calibration-target="true"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Set up relative movement", exact: true })).toBeEnabled();
};
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
      reason: string;
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
        reason: section.dataset.imageReason!,
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
    state.model = "FULL";
    await new Promise((resolve) => setTimeout(resolve, 180));
    sample();
    return { records, workerFrames: [...state.frames] };
  });
  const tracked = sampled.records.filter((row) => row.state === "TRACKING");
  expect(tracked.length).toBeGreaterThan(40);
  expect(new Set(tracked.map((row) => row.generation))).toEqual(new Set([initial]));
  expect(sampled.records.some((row) => row.agreement === "DISAGREE")).toBe(true);
  expect(tracked.some((row) => row.agreement === "UNAVAILABLE")).toBe(true);
  const authorityPaused = sampled.records.filter((row) => row.state !== "TRACKING");
  expect(authorityPaused.length).toBeGreaterThan(0);
  expect(
    authorityPaused.every(
      (row) =>
        row.state === "UNCERTAIN" &&
        [
          "FULL_HAND_CONTRARY_PENDING",
          "FULL_HAND_CONTRARY_CONFIRMED",
          "FULL_HAND_CONTRARY_AWAITING_POINT",
          "FULL_HAND_POINT_PENDING",
          "FULL_HAND_INDEX_CONFLICT",
          "FULL_HAND_AMBIGUOUS",
        ].includes(row.reason) &&
        row.x === null &&
        row.y === null,
    ),
  ).toBe(true);
  expect(new Set(sampled.records.map((row) => row.generation))).toEqual(new Set([initial]));
  expect(tracked.every((row) => row.x !== null && row.y !== null)).toBe(true);
  expect(Math.max(...tracked.map((row) => Math.hypot(row.x! - row.expectedX, row.y! - row.expectedY)))).toBeLessThan(
    34,
  );
  await ready(page);
  await configure(page, { model: "NONE" });
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
    "You selected a fingertip. Begin a fresh setup after tracking settles.",
  );
  await expect(root(page)).not.toHaveAttribute("data-image-track-generation", initial!);
  const percentile = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
  await testInfo.attach("D0-index-image-motion-metrics.json", {
    body: JSON.stringify(
      {
        evidence: "ANALYTIC_CAMERA_PIXELS_AND_FAKE_WORKER_D0_ONLY",
        samples: sampled.records.length,
        tracked: tracked.length,
        authorityPaused: authorityPaused.length,
        authorityPauseReasons: [...new Set(authorityPaused.map((row) => row.reason))],
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

for (const model of ["FULL", "INDEX"] as const) {
  test(`D0 fused ${model} motion and optical pose changes preserve calibration target 1 to 2`, async ({
    page,
  }, testInfo) => {
    await installFixture(page);
    await page.goto("/devices/reach");
    await page.getByRole("button", { name: "Enable live camera", exact: true }).click();
    await ready(page);
    await expect(root(page)).toHaveAttribute("data-fingertip-coordinate-source", /FUSED|MODEL/);
    if (model === "INDEX") {
      await configure(page, { model });
      await expect(root(page)).toHaveAttribute("data-fingertip-model-support", "REGISTERED_INDEX");
    }
    const generation = await root(page).getAttribute("data-image-track-generation");
    await page.getByRole("button", { name: "Set up relative movement", exact: true }).click();
    await expect(page.getByLabel("Target 2 of 5", { exact: true })).toBeVisible({ timeout: 12000 });
    // Simulate a natural change in finger appearance during movement, while the
    // current observed index anatomy and its verified association remain continuous.
    await configure(page, { appearanceRotation: 55, x: 88 });
    await expect(root(page)).toHaveAttribute("data-image-track-generation", generation!);
    await expect(root(page)).toHaveAttribute("data-image-state", "TRACKING");
    await expect
      .poll(async () => {
        const circle = page.locator('svg[aria-label="Finger image position"] circle');
        return Math.hypot(Number(await circle.getAttribute("cx")) - 88, Number(await circle.getAttribute("cy")) - 120);
      })
      .toBeLessThan(2);
    await expect(root(page)).toHaveAttribute("data-step", "TRAINING");
    await expect(page.getByRole("alert", { name: "Setup ended", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Pause calibration", exact: true }).click();
    await expect(page.getByText(/1 of 5 targets saved\./)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("D0-fused-target2-pose-recovery.png"), fullPage: false });
    // Force a durable appearance outage while fake inference continues reporting
    // the already verified current index. This tests admission/copy, not neural recognition.
    await configure(page, { blank: true });
    await expect(root(page)).toHaveAttribute("data-fingertip-coordinate-source", "MODEL");
    await expect(root(page)).toHaveAttribute(
      "data-fingertip-model-support",
      model === "FULL" ? "FULL_HAND" : "REGISTERED_INDEX",
    );
    await expect(
      page.getByText(model === "FULL" ? "Hand model position tracked" : "Visible index position tracked", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("Fingertip appearance tracked", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`D0-${model}-MODEL-target2-paused.png`), fullPage: false });
    await configure(page, { blank: false });
    await expect(root(page)).toHaveAttribute("data-fingertip-coordinate-source", "FUSED");
    await configure(page, { model: "NONE", x: 90 });
    await expect(root(page)).toHaveAttribute("data-fingertip-coordinate-source", "IMAGE");
    await expect(root(page)).toHaveAttribute("data-image-track-generation", generation!);
    await expect
      .poll(async () =>
        Math.abs(Number(await page.locator('svg[aria-label="Finger image position"] circle').getAttribute("cx")) - 90),
      )
      .toBeLessThan(2);
    await configure(page, { model, x: 92 });
    await expect(root(page)).toHaveAttribute("data-fingertip-coordinate-source", /FUSED|MODEL/);
    await expect(root(page)).toHaveAttribute(
      "data-fingertip-model-support",
      model === "FULL" ? "FULL_HAND" : "REGISTERED_INDEX",
    );
    await expect(root(page)).toHaveAttribute("data-image-track-generation", generation!);
    await expect
      .poll(async () =>
        Math.abs(Number(await page.locator('svg[aria-label="Finger image position"] circle').getAttribute("cx")) - 92),
      )
      .toBeLessThan(2);
    await expect(page.getByLabel("Target 2 of 5", { exact: true })).toBeVisible();
    await expect(page.getByRole("alert", { name: "Setup ended", exact: true })).toHaveCount(0);
    await testInfo.attach("D0-fusion-transition-receipt", {
      contentType: "application/json",
      body: JSON.stringify({
        fixture: "ANALYTIC_CAMERA_FAKE_INFERENCE_NOT_PHYSICAL_RECOGNITION",
        modelSupport: model,
        sameExternalGeneration: generation,
        savedTargets: 1,
        target: 2,
        positionBoundAnalysisPixels: 2,
        positions: [88, 90, 92],
        physicalAccuracyQualified: false,
      }),
    });
    await page.getByRole("button", { name: "Stop session", exact: true }).click();
  });
}

test("D0 live setup opens empty before pointing and binds its first fresh source without restarting", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await installFixture(page, "NONE");
  const phases: object[] = [];
  for (const mode of ["RELATIVE", "ABSOLUTE"] as const) {
    await page.goto("/devices/reach");
    await page.getByRole("button", { name: "Enable live camera", exact: true }).click();
    if (mode === "ABSOLUTE") await page.getByRole("radio", { name: /Absolute pointing/ }).check();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { reachIndexImageFixture: { frames: unknown[] } }).reachIndexImageFixture.frames
              .length,
        ),
      )
      .toBeGreaterThan(0);
    if (mode === "RELATIVE") {
      // Preserve a real previous signature, then let it expire before setup.
      await configure(page, { model: "FULL" });
      await ready(page);
      await configure(page, { model: "NONE", blank: true });
      await expect(root(page)).toHaveAttribute("data-image-state", "UNSEEDED", { timeout: 10000 });
    }
    await expect(root(page)).not.toHaveAttribute("data-reach-readiness", "READY");
    const count = mode === "RELATIVE" ? 5 : 9;
    const start = page.getByRole("button", {
      name: mode === "RELATIVE" ? "Set up relative movement" : "Begin nine-point calibration",
      exact: true,
    });
    await expect(root(page)).toHaveAttribute("data-capture-ceiling", "15");
    await expect(root(page)).toHaveAttribute("data-calibration-capture", "false");
    await expect(start).toBeEnabled();
    await start.click();
    await expect(root(page)).toHaveAttribute("data-capture-ceiling", "60");
    await expect(root(page)).toHaveAttribute("data-calibration-capture", "true");
    await expect(page.getByLabel(`Target 1 of ${count}`, { exact: true })).toBeVisible();
    await expect(page.getByLabel("Current target acquisition", { exact: true })).toHaveAttribute("value", "0");
    // A bad/interrupted model return cannot invalidate an unbound trial.
    await configure(page, { model: "WRONG_ONCE", blank: true });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as unknown as { reachIndexImageFixture: { modelFrames: { mode: string }[] } }
            ).reachIndexImageFixture.modelFrames.filter((frame) => frame.mode === "WRONG_ONCE").length,
        ),
      )
      .toBe(1);
    await page.waitForTimeout(400);
    await expect(page.getByLabel(`Target 1 of ${count}`, { exact: true })).toBeVisible();
    await expect(page.getByLabel("Current target acquisition", { exact: true })).toHaveAttribute("value", "0");
    await expect(page.getByText(`0 of ${count} targets saved.`, { exact: false })).toBeVisible();
    await expect(page.getByRole("alert", { name: "Setup ended", exact: true })).toHaveCount(0);
    const firstFresh = await page.evaluate(
      ({ mode, count }) =>
        new Promise<object>((resolve, reject) => {
          const section = document.querySelector<HTMLElement>("section[data-image-state]")!;
          const fixture = (window as unknown as { reachIndexImageFixture: { model: string; blank: boolean } })
            .reachIndexImageFixture;
          const observer = new MutationObserver(check);
          const timer = setTimeout(() => {
            observer.disconnect();
            reject(new Error("FIRST_FRESH_SOURCE_DID_NOT_ENTER_EMPTY_TARGET"));
          }, 12000);
          function check() {
            if (section.dataset.reachReadiness !== "READY") return;
            const target = document.querySelector(`[aria-label="Target 1 of ${count}"]`);
            const value = document.querySelector<HTMLProgressElement>(
              '[aria-label="Current target acquisition"]',
            )?.value;
            if (!value || value <= 0) return;
            const setupEnded = !!document.querySelector('[role="alert"][aria-label="Setup ended"]');
            observer.disconnect();
            clearTimeout(timer);
            resolve({
              mode,
              firstFreshAt: performance.now(),
              step: section.dataset.step,
              firstTargetPresent: !!target,
              acquisition: value,
              savedZero: document.body.textContent!.includes(`0 of ${count} targets saved.`),
              setupEnded,
              imageState: section.dataset.imageState,
              imageGeneration: section.dataset.imageTrackGeneration,
            });
          }
          observer.observe(section, { attributes: true, childList: true, subtree: true });
          fixture.model = "FULL";
          fixture.blank = false;
          check();
        }),
      { mode, count },
    );
    expect(firstFresh).toMatchObject({
      mode,
      step: "TRAINING",
      firstTargetPresent: true,
      savedZero: true,
      setupEnded: false,
    });
    expect((firstFresh as { acquisition: number }).acquisition).toBeGreaterThan(0);
    phases.push(firstFresh);
    await page.getByRole("button", { name: "Pause calibration", exact: true }).click();
    await expect(root(page)).toHaveAttribute("data-capture-ceiling", "15");
    await expect(root(page)).toHaveAttribute("data-calibration-capture", "false");
    await page.getByRole("button", { name: "Resume calibration", exact: true }).click();
    await expect(root(page)).toHaveAttribute("data-capture-ceiling", "60");
    await expect(root(page)).toHaveAttribute("data-calibration-capture", "true");
    await page.getByRole("button", { name: "Pause calibration", exact: true }).click();
    await expect(root(page)).toHaveAttribute("data-capture-ceiling", "15");
    await expect(page.getByRole("alert", { name: "Setup ended", exact: true })).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath(`D0-unbound-${mode.toLowerCase()}-first-point.png`),
      fullPage: false,
    });
    await page.getByRole("button", { name: "Stop camera & clear session", exact: true }).click();
  }
  await testInfo.attach("D0-index-image-empty-setup-metrics.json", {
    body: JSON.stringify(
      { evidence: "PUBLIC_ANALYTIC_CAMERA_AND_FAKE_WORKER", phases, qualification: "D0_ONLY_NOT_PHYSICAL" },
      null,
      2,
    ),
    contentType: "application/json",
  });
});

test("D0 display staleness between timely delayed captures preserves evidence while contrary frames pause it", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await installFixture(page);
  await page.goto("/devices/reach");
  await configure(page, { replyDelayMs: 120 });
  await page.getByRole("button", { name: "Enable live camera", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { reachIndexImageFixture: { frames: unknown[] } }).reachIndexImageFixture.frames.length,
      ),
    )
    .toBeGreaterThanOrEqual(5);
  await page.evaluate(() => {
    const section = document.querySelector<HTMLElement>("section[data-image-state]")!;
    const records: object[] = [];
    const record = () => {
      records.push({
        at: performance.now(),
        state: section.dataset.imageState,
        reason: section.dataset.imageReason,
        capture: Number(section.dataset.imageCaptureTime),
        generation: section.dataset.imageTrackGeneration,
        progress:
          document.querySelector<HTMLProgressElement>('[aria-label="Current target acquisition"]')?.value ?? null,
        gold: !!section.querySelector('svg[aria-label="Finger image position"]'),
        target1: !!section.querySelector('[aria-label="Target 1 of 5"]'),
      });
      if (records.length > 600) records.shift();
    };
    const observer = new MutationObserver(record);
    observer.observe(section, { attributes: true, subtree: true, childList: true });
    Object.assign(window, { reachDisplayClockProbe: { records, observer } });
    record();
  });
  await page.getByRole("button", { name: "Set up relative movement", exact: true }).click();
  await expect(page.getByLabel("Target 2 of 5", { exact: true })).toBeVisible({ timeout: 20000 });
  const beforeContrary = await page.evaluate(() => {
    const probe = (
      window as unknown as {
        reachDisplayClockProbe: {
          records: { state: string; capture: number; progress: number | null; gold: boolean; target1: boolean }[];
          observer: MutationObserver;
        };
      }
    ).reachDisplayClockProbe;
    probe.observer.disconnect();
    const fixture = (window as unknown as { reachIndexImageFixture: { frames: { capture: number; reply: number }[] } })
      .reachIndexImageFixture;
    return { records: probe.records, workerFrames: fixture.frames };
  });
  const collecting = beforeContrary.records.filter((row) => row.target1);
  const stale = collecting.filter((row) => row.state === "STALE");
  expect(stale.length).toBeGreaterThan(0);
  expect(stale.every((row) => !row.gold)).toBe(true);
  expect(stale.some((row) => Number(row.progress) > 0)).toBe(true);
  const captures = [...new Set(collecting.filter((row) => row.state === "TRACKING").map((row) => row.capture))]
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  expect(captures.length).toBeGreaterThanOrEqual(15);
  const intervals = captures.slice(1).map((value, index) => value - captures[index]);
  const ages = captures
    .map((capture) => beforeContrary.workerFrames.find((frame) => frame.capture === capture))
    .filter((frame) => frame !== undefined)
    .map((frame) => frame.reply - frame.capture);
  expect(ages.length).toBe(captures.length);
  expect(ages.every((age) => age >= 119 && age <= 150)).toBe(true);
  const generation = await root(page).getAttribute("data-image-track-generation");
  await configure(page, { model: "OPEN" });
  await page.waitForFunction(() =>
    document
      .querySelector<HTMLElement>("section[data-image-state]")
      ?.dataset.imageReason?.startsWith("FULL_HAND_CONTRARY_"),
  );
  await page.waitForTimeout(800);
  await expect(page.getByLabel("Target 2 of 5", { exact: true })).toBeVisible();
  await expect(page.getByText(/1 of 5 targets saved/)).toBeVisible();
  await expect(page.getByLabel("Current target acquisition", { exact: true })).toHaveAttribute("value", "0");
  await expect(root(page)).not.toHaveAttribute("data-reach-readiness", "READY");
  await expect(page.locator('svg[aria-label="Finger image position"]')).toHaveCount(0);
  await configure(page, { model: "FULL" });
  await expect
    .poll(
      async () => Number(await page.getByLabel("Current target acquisition", { exact: true }).getAttribute("value")),
      { timeout: 12000 },
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause calibration", exact: true }).click();
  await expect(page.getByLabel("Target 2 of 5", { exact: true })).toBeVisible();
  await expect(root(page)).toHaveAttribute("data-image-track-generation", generation!);
  await expect(page.getByRole("alert", { name: "Setup ended", exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("D0-delayed-fresh-captures-saved-target.png"), fullPage: false });
  await testInfo.attach("D0-index-image-display-clock-metrics.json", {
    body: JSON.stringify(
      {
        evidence: "PUBLIC_ANALYTIC_CAMERA_FAKE_WORKER_WITH_INTENTIONAL_120MS_REPLY",
        beforeContrary,
        acceptedUiCaptureCount: captures.length,
        maximumObservedCaptureIntervalMs: Math.max(...intervals),
        acceptedReplyAgesMs: ages,
        staleDisplayEvents: stale.length,
        contraryPoseExplicitlyPaused: true,
        sameImageGenerationAfterRecovery: generation,
        physicalLatencyQualified: false,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(Math.max(...intervals)).toBeLessThanOrEqual(250);
  await page.getByRole("button", { name: "Stop camera & clear session", exact: true }).click();
});

test("D0 manual image-only hints support mirrored click and natural keyboard while ambiguous pixels abstain", async ({
  page,
}, testInfo) => {
  await installFixture(page, "NONE");
  await page.goto("/devices/reach");
  await page.getByRole("button", { name: "Enable live camera", exact: true }).click();
  const initialHint = await page.evaluate(() => {
    const section = document.querySelector<HTMLElement>("section[data-image-state]")!,
      button = [...document.querySelectorAll("button")].find(
        (button) => button.textContent === "Track visible fingertip",
      );
    return { capture: Number(section.dataset.imageCaptureTime), hintAvailable: !!button && !button.disabled };
  });
  if (initialHint.capture === 0) expect(initialHint.hintAvailable).toBe(false);
  await expect.poll(async () => Number(await root(page).getAttribute("data-image-capture-time"))).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Track visible fingertip", exact: true })).toBeVisible();
  await unavailable(page);
  await markByClick(page, 120, 120, true);
  await ready(page);
  await expect(page.locator('svg[aria-label="Finger image position"] circle')).toHaveAttribute("cx", /\d/);
  await configure(page, { blank: true });
  await expect(root(page)).not.toHaveAttribute("data-image-state", "TRACKING");
  await page.screenshot({ path: testInfo.outputPath("D0-image-only-occlusion.png"), fullPage: false });
  await markByClick(page, 120, 120, true);
  await unavailable(page);
  await configure(page, { blank: false, repeated: true });
  await markByClick(page, 120, 120, true);
  await unavailable(page);
  await configure(page, { repeated: false, x: 182, y: 129 });
  await page.getByRole("button", { name: "Use natural preview", exact: true }).click();
  await page.getByRole("button", { name: "Enable live camera", exact: true }).click();
  await expect.poll(async () => Number(await root(page).getAttribute("data-image-capture-time"))).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Track visible fingertip", exact: true }).click();
  const picker = page.getByRole("button", { name: /^Mark visible fingertip in camera/ });
  for (let i = 0; i < 7; i++) await picker.press("ArrowRight");
  for (let i = 0; i < 4; i++) await picker.press("ArrowDown");
  const selectedPatch = await page.evaluate(() => {
    const video = document.querySelector("video")!,
      picker = document.querySelector<HTMLButtonElement>('[aria-label^="Mark visible fingertip in camera"]')!,
      svg = picker.querySelector("svg")!,
      path = svg.querySelector("path")!.getAttribute("d")!,
      match = path.match(/M ([\d.]+) ([\d.]+) h 24 M ([\d.]+) ([\d.]+) v 24/)!;
    const point = { x: Number(match[3]) / svg.viewBox.baseVal.width, y: Number(match[2]) / svg.viewBox.baseVal.height };
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(video, 0, 0);
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data,
      gray = Uint8Array.from(
        { length: canvas.width * canvas.height },
        (_, i) => (rgba[i * 4] * 77 + rgba[i * 4 + 1] * 150 + rgba[i * 4 + 2] * 29) >> 8,
      );
    const x = Math.round(point.x * (canvas.width - 1)),
      y = Math.round(point.y * (canvas.height - 1)),
      values: number[] = [];
    let sum = 0,
      squares = 0,
      xx = 0,
      yy = 0,
      xy = 0;
    for (let dy = -7; dy <= 7; dy++)
      for (let dx = -7; dx <= 7; dx++) {
        const i = (y + dy) * canvas.width + x + dx,
          value = gray[i],
          gx = (gray[i + 1] - gray[i - 1]) / 2,
          gy = (gray[i + canvas.width] - gray[i - canvas.width]) / 2;
        values.push(value);
        sum += value;
        squares += value * value;
        xx += gx * gx;
        yy += gy * gy;
        xy += gx * gy;
      }
    const mean = sum / values.length,
      total = xx + yy;
    return {
      evidence: "PUBLIC_ANALYTIC_CAMERA_PIXELS_AT_KEYBOARD_HINT",
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      path,
      viewBox: { width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height },
      normalized: point,
      selectedPixel: { x, y },
      textureDeviation: Math.sqrt(Math.max(0, squares / values.length - mean * mean)),
      structureRatio: (total - Math.sqrt((xx - yy) ** 2 + 4 * xy * xy)) / 2 / Math.max(1e-9, total),
      radius: 7,
      values,
    };
  });
  await testInfo.attach("D0-index-image-keyboard-hint-patch.json", {
    body: JSON.stringify(selectedPatch, null, 2),
    contentType: "application/json",
  });
  expect(selectedPatch.selectedPixel).toEqual({ x: 182, y: 129 });
  expect(selectedPatch.textureDeviation).toBeGreaterThanOrEqual(6);
  expect(selectedPatch.structureRatio).toBeGreaterThanOrEqual(0.008);
  await picker.screenshot({ path: testInfo.outputPath("D0-natural-keyboard-selected-patch.png") });
  await picker.press("Enter");
  try {
    await ready(page);
  } catch (error) {
    await testInfo.attach("D0-index-image-keyboard-failure.json", {
      body: JSON.stringify(
        await root(page).evaluate((element) =>
          Object.fromEntries([...element.attributes].map((a) => [a.name, a.value])),
        ),
        null,
        2,
      ),
      contentType: "application/json",
    });
    throw error;
  }
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
  await unavailable(page);
  await page.getByRole("button", { name: "Stop camera & clear session", exact: true }).click();
});

test("D0 manual selection survives rejected pixels and expiry without silently returning to a model digit", async ({
  page,
}, testInfo) => {
  await installFixture(page, "NONE");
  await page.goto("/devices/reach");
  await page.getByRole("button", { name: "Enable live camera", exact: true }).click();
  await expect.poll(async () => Number(await root(page).getAttribute("data-image-capture-time"))).toBeGreaterThan(0);
  await configure(page, { blank: true });
  await page.waitForFunction(() => {
    const video = document.querySelector("video")!;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const context = canvas.getContext("2d")!;
    context.drawImage(video, 0, 0, 320, 240);
    return context.getImageData(120, 120, 1, 1).data[0] < 40;
  });
  await markByClick(page, 120, 120, true);
  await expect(root(page)).toHaveAttribute("data-image-selection", "MANUAL");
  await expect(root(page)).toHaveAttribute("data-image-reason", "MANUAL_SELECTION_REQUIRED");
  await configure(page, { blank: false, model: "FULL" });
  await page.waitForTimeout(800);
  await expect(root(page)).toHaveAttribute("data-image-reason", "MANUAL_SELECTION_REQUIRED");
  await expect(root(page)).toHaveAttribute("data-image-track-generation", "0");
  await unavailable(page);
  await page.screenshot({
    path: testInfo.outputPath("D0-manual-failed-selection-no-model-takeover.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "Use automatic fingertip selection", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-image-selection", "AUTOMATIC");
  await ready(page);
  await configure(page, { model: "NONE" });
  await markByClick(page, 120, 120, true);
  await ready(page);
  const selectedGeneration = await root(page).getAttribute("data-image-track-generation");
  await configure(page, { blank: true });
  await expect(root(page)).not.toHaveAttribute("data-image-state", "TRACKING");
  await page.waitForTimeout(1500);
  await configure(page, { blank: false, model: "FULL" });
  await expect(root(page)).toHaveAttribute("data-image-reason", "MANUAL_SELECTION_REQUIRED");
  await page.waitForTimeout(500);
  await expect(root(page)).toHaveAttribute("data-image-selection", "MANUAL");
  await expect(root(page)).toHaveAttribute("data-image-track-generation", "0");
  await unavailable(page);
  await markByClick(page, 120, 120, true);
  await ready(page);
  await expect(root(page)).not.toHaveAttribute("data-image-track-generation", selectedGeneration!);
  const resources = await page.evaluate(() => {
    const fixture = (window as unknown as { reachIndexImageFixture: { workers: number; tracks: number } })
      .reachIndexImageFixture;
    return { workers: fixture.workers, tracks: fixture.tracks };
  });
  expect(resources).toEqual({ workers: 1, tracks: 1 });
  await page.screenshot({
    path: testInfo.outputPath("D0-manual-deliberate-reacquisition-same-camera.png"),
    fullPage: false,
  });
  await testInfo.attach("D0-index-image-manual-selection-metrics.json", {
    body: JSON.stringify(
      {
        evidence: "PUBLIC_ANALYTIC_CAMERA_AND_FAKE_WORKER",
        rejectedSeedDoesNotAutoSelect: true,
        expiredSelectionDoesNotAutoSelect: true,
        explicitAutomaticRecovery: true,
        explicitManualReacquisition: true,
        resources,
        physicalRecognitionQualified: false,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await page.getByRole("button", { name: "Stop camera & clear session", exact: true }).click();
});

test("D0 full-hand authority pauses conflicts without changing image coordinates and manual hints cannot bypass it", async ({
  page,
}, testInfo) => {
  await installFixture(page);
  await page.goto("/devices/reach");
  await page.getByRole("button", { name: "Enable live camera", exact: true }).click();
  await ready(page);
  await expect(root(page)).toHaveAttribute("data-image-reason", "FULL_HAND_POINT_CONFIRMED");
  const generation = await root(page).getAttribute("data-image-track-generation"),
    phases: object[] = [];
  const record = async (phase: string) => {
    phases.push(
      await root(page).evaluate((section, phase) => {
        const element = section as HTMLElement,
          circle = section.querySelector('svg[aria-label="Finger image position"] circle'),
          preview = section.querySelector('svg[aria-label="Finger image match, pointing paused"] circle');
        return {
          phase,
          state: element.dataset.imageState,
          reason: element.dataset.imageReason,
          generation: element.dataset.imageTrackGeneration,
          x: circle ? Number(circle.getAttribute("cx")) : null,
          y: circle ? Number(circle.getAttribute("cy")) : null,
          previewX: preview ? Number(preview.getAttribute("cx")) : null,
          previewY: preview ? Number(preview.getAttribute("cy")) : null,
          capture: element.dataset.imageCaptureTime,
        };
      }, phase),
    );
  };
  const blocked = async (reason: string | RegExp) => {
    await expect(root(page)).toHaveAttribute("data-image-state", "UNCERTAIN");
    await expect(root(page)).toHaveAttribute("data-image-reason", reason);
    await expect(page.locator('svg[aria-label="Finger image position"]')).toHaveCount(0);
    await expect(page.locator('svg[aria-label="Finger image match, pointing paused"] circle')).toBeVisible();
  };
  const sameSourceTracking = async (reason?: string) => {
    await expect(root(page)).toHaveAttribute("data-image-state", "TRACKING");
    await expect(root(page)).toHaveAttribute("data-image-track-generation", generation!);
    if (reason) await expect(root(page)).toHaveAttribute("data-image-reason", reason);
    const point = await page.locator('svg[aria-label="Finger image position"] circle').evaluate((circle) => ({
      x: Number(circle.getAttribute("cx")),
      y: Number(circle.getAttribute("cy")),
    }));
    expect(Math.hypot(point.x - 120, point.y - 120)).toBeLessThan(2);
  };
  await page.getByRole("button", { name: "Set up relative movement", exact: true }).click();
  await expect(page.getByLabel("Target 2 of 5", { exact: true })).toBeVisible({ timeout: 12000 });
  const singleWrongReturn = await page.evaluate(async () => {
    const fixture = (
      window as unknown as {
        reachIndexImageFixture: { model: string; modelFrames: { capture: number; mode: string }[] };
      }
    ).reachIndexImageFixture;
    const section = document.querySelector<HTMLElement>("section[data-image-state]")!,
      records: { state: string; reason: string; gold: boolean; gray: boolean }[] = [];
    const observe = () =>
      records.push({
        state: section.dataset.imageState!,
        reason: section.dataset.imageReason!,
        gold: !!section.querySelector('svg[aria-label="Finger image position"]'),
        gray: !!section.querySelector('svg[aria-label="Finger image match, pointing paused"]'),
      });
    const observer = new MutationObserver(observe);
    observer.observe(section, { attributes: true, attributeFilter: ["data-image-state", "data-image-reason"] });
    fixture.model = "WRONG_ONCE";
    await new Promise((resolve) => setTimeout(resolve, 400));
    observer.disconnect();
    return { records, wrongFrames: fixture.modelFrames.filter((frame) => frame.mode === "WRONG_ONCE").length };
  });
  expect(singleWrongReturn.wrongFrames).toBe(1);
  expect(
    singleWrongReturn.records.some(
      (record) =>
        record.state === "UNCERTAIN" && record.reason === "FULL_HAND_INDEX_CONFLICT" && !record.gold && record.gray,
    ),
  ).toBe(true);
  await sameSourceTracking();
  await configure(page, { model: "INDEX" });
  await sameSourceTracking();
  await record("one-wrong-digit-return-pauses-then-fallback-recovers-without-reset");
  const savedBeforeSwitch = await page.evaluate(() => {
    const saved = Number(document.body.textContent?.match(/(\d+) of 5 targets saved\./)?.[1] ?? -1);
    (window as unknown as { reachIndexImageFixture: { model: string } }).reachIndexImageFixture.model = "OPEN";
    return saved;
  });
  expect(savedBeforeSwitch).toBeGreaterThanOrEqual(1);
  await blocked("FULL_HAND_CONTRARY_CONFIRMED");
  const savedBeforeContrary = await page.evaluate(() => ({
    targetLabel: document.querySelector('[aria-label^="Target "][aria-label$=" of 5"]')?.getAttribute("aria-label"),
    saved: Number(document.body.textContent?.match(/(\d+) of 5 targets saved\./)?.[1] ?? -1),
    acquisition: document.querySelector<HTMLProgressElement>('[aria-label="Current target acquisition"]')?.value,
  }));
  expect(savedBeforeContrary.saved).toBeGreaterThanOrEqual(savedBeforeSwitch);
  expect(savedBeforeContrary.targetLabel).toBe(`Target ${savedBeforeContrary.saved + 1} of 5`);
  expect(Number.isFinite(savedBeforeContrary.acquisition)).toBe(true);
  await page.waitForTimeout(400);
  await expect(page.getByLabel(savedBeforeContrary.targetLabel!, { exact: true })).toBeVisible();
  await expect(page.getByText(`${savedBeforeContrary.saved} of 5 targets saved.`, { exact: false })).toBeVisible();
  const contraryProgress = Number(
    await page.getByLabel("Current target acquisition", { exact: true }).getAttribute("value"),
  );
  expect(Number.isFinite(contraryProgress)).toBe(true);
  expect(contraryProgress).toBeLessThanOrEqual(savedBeforeContrary.acquisition!);
  await expect(root(page)).toHaveAttribute("data-image-track-generation", generation!);
  await expect(root(page)).not.toHaveAttribute("data-reach-readiness", "READY");
  await expect(page.getByRole("alert", { name: "Setup ended", exact: true })).toHaveCount(0);
  await record("sustained-compatible-full-hand-negative-confirms-before-latching");
  await page.screenshot({ path: testInfo.outputPath("D0-full-hand-contrary-saved-target.png"), fullPage: false });
  await expect(page.getByLabel(savedBeforeContrary.targetLabel!, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause calibration", exact: true }).click();
  const beforePreviewMove = Number(await root(page).getAttribute("data-image-capture-time"));
  await configure(page, { x: 126 });
  await expect
    .poll(async () =>
      Number(await page.locator('svg[aria-label="Finger image match, pointing paused"] circle').getAttribute("cx")),
    )
    .toBeGreaterThan(124);
  expect(Number(await root(page).getAttribute("data-image-capture-time"))).toBeGreaterThan(beforePreviewMove);
  await blocked("FULL_HAND_CONTRARY_CONFIRMED");
  await record("fresh-gray-image-position-moves-while-action-remains-paused");
  await configure(page, { model: "NONE" });
  await blocked("FULL_HAND_CONTRARY_AWAITING_POINT");
  await record("missing-model-does-not-erase-visible-contrary");
  await configure(page, { model: "INDEX" });
  await blocked("FULL_HAND_CONTRARY_AWAITING_POINT");
  await record("partial-index-does-not-erase-visible-contrary");
  await configure(page, { model: "FULL", x: 120 });
  await sameSourceTracking("FULL_HAND_POINT_CONFIRMED");
  await expect(page.getByLabel(savedBeforeContrary.targetLabel!, { exact: true })).toBeVisible();
  await expect(page.getByText(`${savedBeforeContrary.saved} of 5 targets saved.`, { exact: false })).toBeVisible();
  await expect(page.getByRole("alert", { name: "Setup ended", exact: true })).toHaveCount(0);
  await record("compatible-full-hand-recovers-same-image-position");
  await page.screenshot({ path: testInfo.outputPath("D0-full-hand-confirmed-image-position.png"), fullPage: false });
  await configure(page, { model: "CONFLICT" });
  await blocked("FULL_HAND_INDEX_CONFLICT");
  await record("pointing-model-at-other-position-does-not-snap-image");
  await configure(page, { model: "NONE" });
  await sameSourceTracking();
  await configure(page, { model: "AMBIGUOUS" });
  await blocked("FULL_HAND_AMBIGUOUS");
  await record("two-credible-whole-hands-pause");
  await configure(page, { model: "NONE" });
  await sameSourceTracking();
  await record("frame-local-ambiguity-can-return-to-image-fallback");
  await page.getByRole("button", { name: "Cancel calibration", exact: true }).click();
  await configure(page, { model: "OPEN" });
  await blocked("FULL_HAND_CONTRARY_CONFIRMED");
  await markByClick(page, 120, 120, true);
  await expect(root(page)).not.toHaveAttribute("data-image-track-generation", generation!);
  await blocked(/^FULL_HAND_CONTRARY_(PENDING|CONFIRMED)$/);
  await unavailable(page);
  await record("manual-hint-cannot-bypass-visible-open-hand");
  await page.screenshot({
    path: testInfo.outputPath("D0-full-hand-contrary-manual-hint-blocked.png"),
    fullPage: false,
  });
  await configure(page, { model: "NONE" });
  await blocked("FULL_HAND_CONTRARY_AWAITING_POINT");
  const blockedGeneration = await root(page).getAttribute("data-image-track-generation");
  await markByClick(page, 120, 120, true);
  await ready(page);
  await expect(root(page)).not.toHaveAttribute("data-image-track-generation", blockedGeneration!);
  await record("explicit-new-hint-allowed-only-when-full-hand-unavailable");
  await testInfo.attach("D0-index-image-authority-metrics.json", {
    body: JSON.stringify(
      {
        evidence: "PUBLIC_ANALYTIC_CAMERA_AND_FAKE_FULL_HAND_MODEL",
        singleWrongReturn,
        savedBeforeSwitch,
        savedBeforeContrary,
        phases,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
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
  // Bound the interruption in the browser, independent of slow driver or
  // screenshot round trips. Actual event-loop stalls can still expire identity.
  await page.evaluate(() => {
    const fixture = (window as unknown as { reachIndexImageFixture: { replyDelayMs: number } }).reachIndexImageFixture;
    fixture.replyDelayMs = 200;
    setTimeout(() => {
      fixture.replyDelayMs = 2;
    }, 700);
  });
  await expect(root(page)).toHaveAttribute("data-image-state", "STALE");
  await expect(page.locator('svg[aria-label="Finger image position"]')).toHaveCount(0);
  await expect(page.getByText("Fingertip tracking", { exact: true })).not.toBeVisible();
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
