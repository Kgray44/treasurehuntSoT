// @sounding-line-registration owner=reach suite=browser.reach contracts=reach.phase1.foundation
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("laboratory has conventional controls, held-out validation, deletion and consented aggregate export", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto("/devices/reach");
  await expect(page.getByRole("heading", { name: "Find the Hand" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export aggregate metrics", includeHidden: true })).toBeDisabled();
  await page.getByRole("button", { name: "Start synthetic replay" }).click();
  await expect(page.getByRole("status")).toContainText("SYNTHETIC");
  await expect(page.getByRole("status")).toContainText("Hand: NONE");
  await page.getByRole("button", { name: "Start nine-target calibration" }).click();
  const setPoint = async (x: number, y: number) => {
    for (const [axis, value] of [
      ["x", x],
      ["y", y],
    ] as const) {
      const input = page.getByRole("slider", { name: `Synthetic ${axis}` });
      await input.evaluate((el, next) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        setter.call(el, String(next));
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }, value);
    }
  };
  for (let i = 0; i < 9; i++) {
    const dot = page.getByText("Point here", { exact: true });
    await expect(dot).toBeVisible();
    const point = await dot.evaluate((el) => ({
      x: parseFloat((el as HTMLElement).style.left) / 100,
      y: parseFloat((el as HTMLElement).style.top) / 100,
    }));
    await setPoint(point.x, point.y);
    if (i < 8)
      await expect(
        page.getByText(`TRAINING: ${i + 1}/9 targets sampled. Point naturally at the next dot.`, { exact: true }),
      ).toBeVisible({ timeout: 6000 });
    else await expect(page.getByText("Fit ready.", { exact: false })).toBeVisible({ timeout: 6000 });
  }
  await page.getByRole("button", { name: "Run independent validation" }).click();
  for (let i = 0; i < 5; i++) {
    const dot = page.getByText("Point here", { exact: true });
    const point = await dot.evaluate((el) => ({
      x: parseFloat((el as HTMLElement).style.left) / 100,
      y: parseFloat((el as HTMLElement).style.top) / 100,
    }));
    expect([0.1, 0.5, 0.9].includes(point.x) && [0.1, 0.5, 0.9].includes(point.y)).toBe(false);
    await setPoint(point.x, point.y);
    if (i < 4)
      await expect(
        page.getByText(`VALIDATION: ${i + 1}/5 targets sampled. Point naturally at the next dot.`, { exact: true }),
      ).toBeVisible({ timeout: 6000 });
    else await expect(page.getByText("Independent validation passed", { exact: false })).toBeVisible({ timeout: 6000 });
  }
  await page.getByText("Session diagnostics and privacy", { exact: true }).click();
  await page.getByRole("checkbox", { name: /I consent/ }).check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export aggregate metrics" }).click();
  const downloaded = await download;
  expect(downloaded.suggestedFilename()).toBe("reach-session-metrics.json");
  const exportedText = await readFile((await downloaded.path())!, "utf8");
  const exported = JSON.parse(exportedText);
  expect(exported.evidenceTier).toBe("D0");
  expect(exported.physicalQualification).toBe("PENDING");
  expect(exported.trialAggregates).toHaveLength(2);
  expect(exported.trialAggregates[1]).toMatchObject({ status: "VALIDATED", evidenceTier: "D0" });
  for (const field of ["landmarks", "coefficients", "cameraLeaseId", "trackId"])
    expect(exportedText).not.toContain(field);
  await page.getByRole("button", { name: "Delete calibration", exact: true }).click();
  await expect(page.getByText("Calibration: REQUIRED", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Stop and delete calibration" }).click();
  await expect(page.getByRole("status")).toContainText("OFF");
});
for (const fault of ["NONE", "MODEL_UNAVAILABLE"] as const)
  test(`local worker ${fault} uses pinned inference and releases resources`, async ({ page }) => {
    await page.addInitScript(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const telemetry = { tracks: 0, workers: 0, prompts: 0 };
      Object.assign(window, { reachTelemetry: telemetry });
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: async (options: MediaStreamConstraints) => {
          if (options.audio !== false) throw new Error("MICROPHONE_REQUESTED");
          telemetry.prompts++;
          const stream = canvas.captureStream(15);
          const context = canvas.getContext("2d")!;
          context.fillStyle = "black";
          context.fillRect(0, 0, 640, 480);
          const frameTimer = setInterval(() => context.fillRect(0, 0, 640, 480), 50);
          for (const track of stream.getTracks()) {
            telemetry.tracks++;
            const stop = track.stop.bind(track);
            track.stop = () => {
              clearInterval(frameTimer);
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
        }
        terminate() {
          telemetry.workers--;
          super.terminate();
        }
      };
    });
    await page.goto("/devices/reach");
    if (fault === "MODEL_UNAVAILABLE")
      await page.route("**/reach/vendor/hand_landmarker.task", (route) => route.abort());
    await page.getByRole("button", { name: "Enable live camera" }).click();
    const resources = () =>
      page.evaluate(
        () =>
          (window as unknown as { reachTelemetry: { tracks: number; workers: number; prompts: number } })
            .reachTelemetry,
      );
    if (fault === "MODEL_UNAVAILABLE") {
      await expect(page.getByRole("status")).toContainText("MODEL_FAILURE_MODEL_FETCH", { timeout: 30000 });
      expect(await resources()).toEqual({ tracks: 0, workers: 0, prompts: 1 });
      await page.getByRole("button", { name: "Start synthetic replay" }).click();
      await expect(page.getByRole("status")).toContainText("SYNTHETIC");
      return;
    }
    await expect(page.getByRole("status")).toContainText("NO_HAND", { timeout: 30000 });
    expect(await resources()).toEqual({ tracks: 1, workers: 1, prompts: 1 });
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await expect(page.getByRole("status")).toContainText("SUSPENDED");
    expect(await resources()).toEqual({ tracks: 0, workers: 0, prompts: 1 });
    await page.getByRole("button", { name: "Enable live camera" }).click();
    await expect(page.getByRole("status")).toContainText("NO_HAND", { timeout: 30000 });
    await page.getByRole("button", { name: "Stop and delete calibration" }).click();
    expect(await resources()).toEqual({ tracks: 0, workers: 0, prompts: 2 });
    await expect(page.getByRole("status")).toContainText("OFF");
  });
test("camera denial preserves accessible fallback", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        throw new DOMException("", "NotAllowedError");
      },
    }),
  );
  await page.goto("/devices/reach");
  await page.getByRole("button", { name: "Enable live camera" }).click();
  await expect(page.getByRole("status")).toContainText("PERMISSION_DENIED");
  await page.getByRole("button", { name: "Start synthetic replay" }).click();
  await expect(page.getByRole("status")).toContainText("SYNTHETIC");
});
