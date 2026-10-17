// @sounding-line-registration owner=reach suite=browser.reach contracts=reach.phase1.foundation
import { expect, test } from "@playwright/test";
import { pointingPose, pointingTransitionPose } from "./fixtures/reach/pointing-poses";

test("a completed failed check explains the accuracy limit and keeps setup instead of silently repeating", async ({
  page,
}, testInfo) => {
  await page.goto("/devices/reach");
  await page.getByRole("button", { name: "Explore guided demo" }).click();
  await expect(page.getByRole("button", { name: "Set up relative movement" })).toBeEnabled();
  await page.getByRole("button", { name: "Set up relative movement" }).click();
  const targets = async (count: number, bias = false) => {
    for (let i = 0; i < count; i++) {
      await expect(page.getByLabel(`Target ${i + 1} of ${count}`, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Move demo hand to target" }).click();
      if (bias)
        for (let n = 0; n < 13; n++)
          await page.getByRole("slider", { name: "Demo x", exact: true }).press("ArrowRight");
      if (i < count - 1) await expect(page.getByLabel(`Target ${i + 2} of ${count}`, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Recalibrate", exact: true })).toBeVisible();
  };
  await targets(5);
  await page.getByRole("button", { name: "Check five new targets" }).click();
  await page.getByRole("button", { name: "Move demo hand to target" }).click();
  await page.waitForTimeout(150);
  await page.getByLabel("Demo tracking condition").selectOption("POSTURE");
  await expect(page.getByRole("status", { name: "Pointer feedback" })).toContainText("Last seen pointer");
  await page.screenshot({ path: testInfo.outputPath("D0-last-seen-during-check.png"), fullPage: true });
  await page.getByLabel("Demo tracking condition").selectOption("NONE");
  await targets(5, true);
  const explanation = page.getByRole("note", { name: "Independent check explanation" });
  await expect(explanation).toContainText("All 5 check targets were recorded");
  await expect(explanation).toContainText("3.00%");
  await expect(explanation).toContainText("Your setup is kept");
  await expect(explanation).toContainText("Why another check is offered");
  await expect(page.getByRole("button", { name: "Retry independent check" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open pointing playground" })).toHaveCount(0);
  await expect(page.getByLabel("Target 1 of 5", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("D0-failed-check-explained.png"), fullPage: true });
  await page.getByRole("button", { name: "Stop session", exact: true }).click();
});

test("mobile interruptions keep the reason and saved targets beside the active target", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/devices/reach");
  await page.getByRole("button", { name: "Explore guided demo" }).click();
  await expect(page.getByRole("button", { name: "Set up relative movement" })).toBeEnabled();
  await page.getByRole("button", { name: "Set up relative movement" }).click();
  await page.getByRole("button", { name: "Move demo hand to target" }).click();
  await expect(page.getByLabel("Target 2 of 5", { exact: true })).toBeVisible();
  const condition = page.getByLabel("Demo tracking condition");
  const showTarget = async () =>
    page.getByLabel("Pointing practice area", { exact: true }).evaluate((element) => {
      window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 240);
    });
  await condition.selectOption("POSTURE");
  await expect(
    page
      .getByText("Extend your index finger comfortably; a gentle bend and relaxed fingers are fine.", { exact: true })
      .first(),
  ).toBeVisible();
  await showTarget();
  await page.screenshot({ path: testInfo.outputPath("D0-mobile-posture-interruption.png"), fullPage: true });
  await condition.selectOption("NO_HAND");
  await expect(
    page.getByText("Tracking paused. Bring the same hand back; completed targets stay saved.", { exact: true }).first(),
  ).toBeVisible();
  await showTarget();
  await page.screenshot({ path: testInfo.outputPath("D0-mobile-tracking-interruption.png"), fullPage: true });
  await expect(page.getByLabel("Target 2 of 5", { exact: true })).toBeVisible();
  await condition.selectOption("NONE");
  await page.getByRole("button", { name: "Move demo hand to target" }).click();
  await expect(page.getByLabel("Target 3 of 5", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Stop session", exact: true }).click();
});

test("D0 controlled poses recover in the actual laboratory without losing completed targets", async ({
  page,
}, testInfo) => {
  const poses = {
    RELAXED: pointingPose(),
    DEPTH: pointingPose({ indexBends: [0, 10, 20], depthAngle: 85 }),
    DIRECT: pointingPose().map((point, i, points) =>
      i >= 6 && i <= 8 ? { ...points[5], z: points[5].z - [0.035, 0.06, 0.08][i - 6] } : point,
    ),
    BOTTOM: pointingPose().map((point) => ({ ...point, y: point.y + 0.38 })),
    OPEN: pointingPose({ otherBends: [0, 35, 65] }),
    CURL: pointingPose({ indexBends: [0, 100, 150] }),
  };
  // Explicit analytic D0 replay after worker inference, never physical accuracy
  // evidence. Camera capture/lifecycle, adapter, selector and lab are real code.
  const sweepPoses = Array.from({ length: 61 }, (_, i) => pointingTransitionPose(i / 60, i * 0.31));
  await page.addInitScript(
    ({ poses, sweepPoses }) => {
      const replay = {
        pose: "RELAXED",
        sweepIndex: 0,
        hidden: false,
        outlier: false,
        duplicate: false,
        observations: 0,
      };
      Object.assign(window, { reachPoseReplay: replay });
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: async (options: MediaStreamConstraints) => {
          if (options.audio !== false) throw new Error("MICROPHONE_REQUESTED");
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const context = canvas.getContext("2d")!;
          const draw = () => {
            context.fillStyle = "#c7c7bf";
            context.fillRect(0, 0, 640, 480);
          };
          draw();
          const timer = setInterval(draw, 40);
          const stream = canvas.captureStream(25);
          for (const track of stream.getTracks()) {
            const stop = track.stop.bind(track);
            track.stop = () => {
              clearInterval(timer);
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
          this.addEventListener("message", (event) => {
            if (event.data.type !== "RESULT") return;
            replay.observations++;
            const source =
              replay.pose === "SWEEP" ? sweepPoses[replay.sweepIndex] : poses[replay.pose as keyof typeof poses];
            const points = source.map((p) => ({
              ...p,
              x: p.x + (replay.outlier ? 0.07 : 0),
            }));
            event.data.result = {
              landmarks: replay.hidden
                ? []
                : replay.duplicate
                  ? [points, points.map((point) => ({ ...point, x: point.x + 0.0002 }))]
                  : [points],
              handedness: replay.hidden
                ? []
                : replay.duplicate
                  ? [[{ categoryName: "Right", score: 0.95 }], [{ categoryName: "Right", score: 0.95 }]]
                  : [[{ categoryName: "Right", score: 0.95 }]],
            };
          });
        }
      };
    },
    { poses, sweepPoses },
  );
  const replay = async (value: {
    pose?: string;
    sweepIndex?: number;
    hidden?: boolean;
    outlier?: boolean;
    duplicate?: boolean;
  }) =>
    page.evaluate((value) => {
      Object.assign((window as unknown as { reachPoseReplay: object }).reachPoseReplay, value);
    }, value);
  const status = page.getByRole("status", { name: "Reach status" });
  await page.goto("/devices/reach");
  await page.getByRole("button", { name: "Enable live camera" }).click();
  await expect(status).toContainText("Your hand is ready", { timeout: 30000 });
  await page.screenshot({ path: testInfo.outputPath("D0-relaxed-point.png"), fullPage: true });
  await replay({ duplicate: true });
  await expect(status).toContainText("1 detected");
  await expect(status).toContainText("Eligible for collection");
  await page.waitForTimeout(500);
  await expect(page.getByText("1 hand detected", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("D0-duplicate-suppressed.png"), fullPage: true });
  await replay({ duplicate: false, pose: "DIRECT" });
  await expect(status).toContainText("Eligible for collection");
  await expect(status).toContainText("Index aimed toward the camera");
  await page.screenshot({ path: testInfo.outputPath("D0-direct-camera-point.png"), fullPage: true });
  await replay({ pose: "BOTTOM" });
  await expect(status).toContainText("Enough fingers visible");
  await expect(status).toContainText("Eligible for collection");
  await page.screenshot({ path: testInfo.outputPath("D0-bottom-wrist-outside.png"), fullPage: true });
  await replay({ pose: "DEPTH" });
  await expect(status).toContainText("Index aimed toward the camera");
  await expect(status).toContainText("Eligible for collection");
  await page.screenshot({ path: testInfo.outputPath("D0-foreshortened-point.png"), fullPage: true });
  await replay({ pose: "SWEEP", sweepIndex: 0 });
  await expect(status).toContainText("Enough fingers visible");
  await expect(status).toContainText("Eligible for collection");
  // A continuous noisy bottom/end-on -> top/side-on -> bottom sweep runs
  // against the real worker lifecycle, adapter, selector and readiness UI.
  // Only the returned landmark fixture is analytic; this is not physical proof.
  const sweep = await status.evaluate(async (element) => {
    const state = (window as unknown as { reachPoseReplay: { sweepIndex: number; observations: number } })
      .reachPoseReplay;
    const before = state.observations;
    const feedback: string[] = [];
    const observer = new MutationObserver(() => feedback.push(element.textContent ?? ""));
    observer.observe(element, { childList: true, subtree: true, characterData: true });
    for (const index of [
      ...Array.from({ length: 60 }, (_, i) => i + 1),
      ...Array.from({ length: 60 }, (_, i) => 59 - i),
    ]) {
      state.sweepIndex = index;
      await new Promise((resolve) => setTimeout(resolve, 60));
      feedback.push(element.textContent ?? "");
    }
    observer.disconnect();
    return {
      frames: state.observations - before,
      samples: feedback.length,
      interruptions: feedback.filter((text) => !text.includes("Eligible for collection")),
    };
  });
  expect(sweep.frames).toBeGreaterThan(60);
  expect(sweep.interruptions).toEqual([]);
  await testInfo.attach("D0-continuous-sweep.json", {
    body: JSON.stringify(sweep, null, 2),
    contentType: "application/json",
  });
  await page.screenshot({ path: testInfo.outputPath("D0-continuous-sweep.png"), fullPage: true });
  await replay({ pose: "OPEN" });
  await expect(status).toContainText("Point not yet recognized");
  await expect(page.getByRole("button", { name: "Set up relative movement" })).toBeDisabled();
  await replay({ pose: "RELAXED" });
  await expect(status).toContainText("Eligible for collection");
  await page.getByRole("radio", { name: "Absolute pointing" }).check();
  await page.getByRole("button", { name: "Begin nine-point calibration" }).click();
  await expect(page.getByLabel("Target 2 of 9", { exact: true })).toBeVisible();
  await replay({ pose: "CURL" });
  await expect(status).toContainText("Point not yet recognized");
  await page.waitForTimeout(20500);
  await expect(page.getByLabel("Target 2 of 9", { exact: true })).toBeVisible();
  await expect(page.getByText(/1 of 9 targets saved/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("D0-posture-interruption.png"), fullPage: true });
  await replay({ pose: "RELAXED" });
  const progress = page.getByRole("progressbar", { name: "Current target acquisition" });
  await expect.poll(async () => Number(await progress.getAttribute("value"))).toBeGreaterThan(0.05);
  await replay({ outlier: true });
  await page.waitForTimeout(160);
  // Bound loss in the browser itself: screenshot/driver overhead must not
  // accidentally turn a brief occlusion into an expired track generation.
  await page.evaluate(() => {
    const state = (window as unknown as { reachPoseReplay: { outlier: boolean; hidden: boolean } }).reachPoseReplay;
    state.outlier = false;
    state.hidden = true;
    setTimeout(() => {
      state.hidden = false;
    }, 850);
  });
  await expect(status).toContainText("Tracking paused");
  const frozen = Number(await progress.getAttribute("value"));
  await page.waitForTimeout(150);
  expect(Number(await progress.getAttribute("value"))).toBe(frozen);
  await expect(page.getByLabel("Target 2 of 9", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("D0-brief-occlusion.png"), fullPage: true });
  await replay({ hidden: false });
  await expect(page.getByLabel("Target 3 of 9", { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/2 of 9 targets saved/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("D0-recovered-saved-targets.png"), fullPage: true });
  // An expired local identity must still require fresh setup. No old samples
  // may be silently rebound to the returning generation.
  await replay({ hidden: true });
  await page.waitForTimeout(1600);
  await replay({ hidden: false });
  await expect(
    page.getByText(
      "We can no longer confirm the same hand and camera setup. Set up again so samples stay tied to one hand.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Target 3 of 9", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("D0-context-invalidation.png"), fullPage: true });
  await page.getByRole("button", { name: "Stop session", exact: true }).click();
  await expect(page.getByRole("button", { name: "Enable live camera" })).toBeVisible();
});
