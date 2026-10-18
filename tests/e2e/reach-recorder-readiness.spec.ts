// @sounding-line-registration owner=reach suite=browser.reach contracts=reach.phase1.foundation
import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/reach/telemetry", (route) => route.fulfill({ status: 200, json: { accepted: true } }));
});

test("local recorder waits for processed camera evidence before its first pointer start", async ({
  page,
}, testInfo) => {
  test.skip(process.env.REACH_LOCAL_POSE_CAPTURE !== "1", "Requires the explicit local recording flag.");
  await page.addInitScript(() => {
    const log: unknown[] = [];
    Object.assign(window, { recorderReadinessLog: log });
    for (const type of ["pointerdown", "pointerup", "click"])
      document.addEventListener(
        type,
        (event) => {
          const target = event.target;
          if (target instanceof HTMLButtonElement)
            log.push({ at: performance.now(), type, text: target.textContent, disabled: target.disabled });
        },
        true,
      );
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const context = canvas.getContext("2d")!;
        let frame = 0;
        const draw = () => {
          context.fillStyle = frame++ % 2 ? "#827562" : "#837663";
          context.fillRect(0, 0, canvas.width, canvas.height);
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
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = async function () {
      await originalPlay.call(this);
      Object.assign(window, { recorderPlaybackPending: true });
      // Camera acquisition READY precedes playback and worker initialization.
      // Keep this real asynchronous boundary visible without fabricating frames.
      await new Promise((resolve) => setTimeout(resolve, 800));
      Object.assign(window, { recorderPlaybackPending: false });
    };
    const observer = new MutationObserver(() => {
      const start = [...document.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Start guided video + trace recording"),
      );
      const state = {
        at: performance.now(),
        disabled: start?.disabled,
        status: [...document.querySelectorAll("p")].find((p) => p.textContent?.startsWith("Camera:"))?.textContent,
        progress: document.querySelector("progress")?.getAttribute("value"),
        error: document.querySelector('[role="alert"]')?.textContent,
      };
      const previous = log.at(-1) as typeof state | undefined;
      if (
        !previous ||
        previous.disabled !== state.disabled ||
        previous.status !== state.status ||
        previous.error !== state.error
      )
        log.push(state);
    });
    observer.observe(document, { childList: true, subtree: true, attributes: true, characterData: true });
  });
  try {
    await page.goto("/devices/reach/record");
    const start = page.getByRole("button", { name: "Start guided video + trace recording" });
    await page.getByRole("button", { name: "Enable camera preview" }).click();
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { recorderPlaybackPending: boolean }).recorderPlaybackPending),
      )
      .toBe(true);
    expect(await start.isDisabled()).toBe(true);
    await expect(
      page.getByText("Camera: waiting for tracking · mirrored preview · no microphone", { exact: true }),
    ).toBeVisible();
    await expect(start).toBeEnabled({ timeout: 30000 });
    const bounds = await start.boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    await expect(page.getByRole("button", { name: "Pause recording", exact: true })).toBeVisible();
    const progress = page.getByRole("progressbar", { name: "Guided recording progress" });
    await expect.poll(async () => Number(await progress.getAttribute("value"))).toBeGreaterThan(900);
    await page.getByRole("button", { name: "Stop & review", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Review your local recording" })).toBeVisible();
  } finally {
    await testInfo.attach("recorder-readiness-phases.json", {
      body: JSON.stringify(
        await page.evaluate(() => (window as unknown as { recorderReadinessLog: unknown[] }).recorderReadinessLog),
        null,
        2,
      ),
      contentType: "application/json",
    });
  }
});
