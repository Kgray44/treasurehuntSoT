// @sounding-line-registration owner=reach suite=browser.reach contracts=reach.phase1.foundation
import { expect, test } from "@playwright/test";
import { pointingPose } from "./fixtures/reach/pointing-poses";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/reach/telemetry", (route) => route.fulfill({ status: 200, json: { accepted: true } }));
});

test("D0 encoded recorder video excludes the live skeleton by default and preserves the optional composite", async ({
  page,
}, testInfo) => {
  test.skip(process.env.REACH_LOCAL_POSE_CAPTURE !== "1", "Requires the explicit local recording flag.");
  await page.addInitScript(
    (points) => {
      const rasterFixture = { capture: Number.NEGATIVE_INFINITY, deliveredResults: 0 };
      Object.assign(window, { recorderRasterFixture: rasterFixture });
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: async (options: MediaStreamConstraints) => {
          if (options.audio !== false) throw new Error("MICROPHONE_REQUESTED");
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const context = canvas.getContext("2d")!;
          let index = 0;
          const draw = () => {
            context.fillStyle = index++ % 2 ? "rgb(84,77,66)" : "rgb(85,78,67)";
            context.fillRect(0, 0, 640, 480);
          };
          draw();
          const timer = setInterval(draw, 1000 / 30);
          const stream = canvas.captureStream(30);
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
      class RecorderFixtureWorker {
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror = null;
        terminated = false;
        postMessage(message: { type: string; generation: number; capture: number; bitmap?: ImageBitmap }) {
          if (message.type === "INIT") {
            setTimeout(() => {
              if (!this.terminated) {
                this.onmessage?.(
                  new MessageEvent("message", { data: { type: "READY", generation: message.generation } }),
                );
              }
            }, 0);
          } else if (message.type === "FRAME") {
            const width = message.bitmap!.width,
              height = message.bitmap!.height;
            message.bitmap!.close();
            setTimeout(() => {
              if (!this.terminated) {
                rasterFixture.capture = message.capture;
                rasterFixture.deliveredResults++;
                this.onmessage?.(
                  new MessageEvent("message", {
                    data: {
                      type: "RESULT",
                      generation: message.generation,
                      capture: message.capture,
                      inferenceTime: performance.timeOrigin + performance.now(),
                      width,
                      height,
                      result: {
                        landmarks: [points],
                        handedness: [[{ categoryName: "Right", score: 0.95 }]],
                      },
                    },
                  }),
                );
              }
            }, 2);
          }
        }
        terminate() {
          this.terminated = true;
        }
      }
      window.Worker = RecorderFixtureWorker as unknown as typeof Worker;
    },
    pointingPose({ indexBends: [0, 10, 20] }),
  );
  const observations: unknown[] = [];
  for (const containsHandOverlay of [false, true]) {
    await test.step(
      containsHandOverlay ? "Explicit existing hand-overlay video" : "Default clean camera video",
      async () => {
        await page.goto("/devices/reach/record");
        const clean = page.getByRole("checkbox", { name: "Save camera image without hand overlay" });
        await expect(clean).toBeChecked();
        if (containsHandOverlay) await clean.uncheck();
        await page.getByRole("button", { name: "Enable camera preview" }).click();
        const start = page.getByRole("button", { name: "Start guided video + trace recording" });
        await expect(start).toBeEnabled();
        const live = page.getByRole("img", { name: "Live hand joints aligned with the camera image" });
        const inspectLive = () =>
          live.evaluate(async (element) => {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            const canvas = element as HTMLCanvasElement;
            const inspectedAt = performance.now();
            const fixture = (
              window as unknown as {
                recorderRasterFixture: { capture: number; deliveredResults: number };
              }
            ).recorderRasterFixture;
            const captureAgeMs = inspectedAt - fixture.capture;
            const deliveredResults = fixture.deliveredResults;
            const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
            let count = 0,
              maximumAlpha = 0;
            for (let i = 0; i < data.length; i += 4) {
              maximumAlpha = Math.max(maximumAlpha, data[i + 3]);
              if (data[i + 3] && data[i + 1] - data[i] > 25 && data[i + 2] - data[i] > 8 && data[i + 1] > 160) count++;
            }
            const rect = canvas.getBoundingClientRect();
            // Capture PNG before the asynchronous digest permits another draw.
            const png = canvas.toDataURL("image/png");
            const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))]
              .map((byte) => byte.toString(16).padStart(2, "0"))
              .join("");
            return {
              count,
              hash,
              maximumAlpha,
              captureAgeMs,
              deliveredResults,
              width: canvas.width,
              height: canvas.height,
              clientWidth: canvas.clientWidth,
              clientHeight: canvas.clientHeight,
              cssRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
              dpr: devicePixelRatio,
              viewportWidth: innerWidth,
              documentWidth: document.documentElement.clientWidth,
              scroll: { x: scrollX, y: scrollY },
              png,
            };
          });
        await expect.poll(async () => (await inspectLive()).count).toBeGreaterThan(50);
        // A correctly dimmed stale overlay is not pixel-identical to a fresh
        // drawing. Compare settled, fully fresh redraws without changing the
        // renderer's freshness boundary or permitting any pixel tolerance.
        let previousSignature = "",
          settledReadbacks = 0;
        let freshBaseline: Awaited<ReturnType<typeof inspectLive>> | null = null;
        const baselineReadbacks: object[] = [];
        await expect
          .poll(
            async () => {
              const snapshot = await inspectLive();
              baselineReadbacks.push({ ...snapshot, png: undefined });
              const signature = `${snapshot.width}/${snapshot.height}/${snapshot.dpr}/${snapshot.hash}`;
              const fresh =
                snapshot.count > 50 &&
                snapshot.maximumAlpha === 255 &&
                snapshot.captureAgeMs >= 0 &&
                snapshot.captureAgeMs <= 150;
              settledReadbacks = fresh ? (signature === previousSignature ? settledReadbacks + 1 : 1) : 0;
              previousSignature = fresh ? signature : "";
              freshBaseline = fresh ? snapshot : null;
              return settledReadbacks;
            },
            { intervals: [100], timeout: 5000 },
          )
          .toBeGreaterThanOrEqual(3);
        const liveBefore = freshBaseline!;
        // Arm the observer before the native Start click. A slow Playwright
        // response or PNG return must never postpone this fixture's Stop.
        await page.evaluate((baselineResults) => {
          type Snapshot = {
            count: number;
            maximumAlpha: number;
            captureAgeMs: number;
            deliveredResults: number;
            width: number;
            height: number;
            clientWidth: number;
            clientHeight: number;
            cssRect: { x: number; y: number; width: number; height: number };
            dpr: number;
            viewportWidth: number;
            documentWidth: number;
            scroll: { x: number; y: number };
            png: string;
          };
          let resolve!: (value: {
            liveDuring: Snapshot & { hash: string };
            modeLockedDuringRecording: boolean;
            timing: object;
          }) => void;
          let reject!: (reason: Error) => void;
          const finished = new Promise<{
            liveDuring: Snapshot & { hash: string };
            modeLockedDuringRecording: boolean;
            timing: object;
          }>((yes, no) => {
            resolve = yes;
            reject = no;
          });
          // Attach a handler immediately; the driver may still be awaiting its
          // real click response when a deliberate fixture failure occurs.
          void finished.catch(() => {});
          Object.assign(window, { recorderNativeBoundedProof: { finished } });
          const armedAt = performance.now();
          let raf = 0;
          let ended = false;
          let firstProgressAt: number | null = null;
          let modeLockedDuringRecording = false;
          let captured: {
            snapshot: Snapshot;
            bytes: Uint8ClampedArray<ArrayBuffer>;
            observedProgress: number;
            at: number;
          } | null = null;
          const stopButton = () =>
            [...document.querySelectorAll("button")].find(
              (button) => button.textContent?.trim() === "Stop & review" && !button.disabled,
            );
          const stop = (observedProgress: number, failure?: Error) => {
            if (ended) return;
            ended = true;
            cancelAnimationFrame(raf);
            clearTimeout(deadline);
            const button = stopButton();
            if (!button) {
              reject(new Error("RECORDING_STOP_UNAVAILABLE"));
              return;
            }
            const stopAt = performance.now();
            button.click();
            if (failure || !captured) {
              reject(failure ?? new Error("NO_FRESH_DURING_RECORDING_RASTER"));
              return;
            }
            const accepted = captured;
            // Only after Stop: asynchronous digest and driver/artifact work.
            void crypto.subtle.digest("SHA-256", accepted.bytes).then(
              (value) =>
                resolve({
                  liveDuring: {
                    ...accepted.snapshot,
                    hash: [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
                  },
                  modeLockedDuringRecording,
                  timing: {
                    armedAt,
                    firstProgressAt,
                    capturedAt: accepted.at,
                    capturedProgressMs: accepted.observedProgress,
                    stopAt,
                    stoppedProgressMs: observedProgress,
                  },
                }),
              () => reject(new Error("RECORDING_RASTER_DIGEST_FAILED")),
            );
          };
          const deadline = setTimeout(() => {
            const progress = document.querySelector('progress[aria-label="Guided recording progress"]');
            stop(Number(progress?.getAttribute("value") ?? 0), new Error("RECORDING_PROGRESS_TIMEOUT"));
          }, 5000);
          const tick = () => {
            if (ended) return;
            try {
              const progress = document.querySelector('progress[aria-label="Guided recording progress"]');
              const value = Number(progress?.getAttribute("value") ?? 0);
              if (value > 0 && firstProgressAt === null) firstProgressAt = performance.now();
              if (value > 0 && value < 900) {
                const checkbox = [...document.querySelectorAll('input[type="checkbox"]')].find((element) =>
                  element.closest("label")?.textContent?.includes("Save camera image without hand overlay"),
                ) as HTMLInputElement | undefined;
                if (!checkbox?.disabled) {
                  stop(value, new Error("RECORDING_MODE_CHANGED_WHILE_RECORDING"));
                  return;
                }
                modeLockedDuringRecording = true;
              }
              // Stop gets priority; a delayed readback cannot prolong the run.
              if (value >= 900) {
                stop(value);
                return;
              }
              if (value >= 400 && !captured) {
                const canvas = document.querySelector(
                  'canvas[aria-label="Live hand joints aligned with the camera image"]',
                ) as HTMLCanvasElement | null;
                const fixture = (
                  window as unknown as { recorderRasterFixture: { capture: number; deliveredResults: number } }
                ).recorderRasterFixture;
                const inspectedAt = performance.now();
                const captureAgeMs = inspectedAt - fixture.capture;
                if (canvas && captureAgeMs >= 0 && captureAgeMs <= 150 && fixture.deliveredResults > baselineResults) {
                  const bytes = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
                  let count = 0,
                    maximumAlpha = 0;
                  for (let i = 0; i < bytes.length; i += 4) {
                    maximumAlpha = Math.max(maximumAlpha, bytes[i + 3]);
                    if (
                      bytes[i + 3] &&
                      bytes[i + 1] - bytes[i] > 25 &&
                      bytes[i + 2] - bytes[i] > 8 &&
                      bytes[i + 1] > 160
                    )
                      count++;
                  }
                  if (maximumAlpha === 255) {
                    const rect = canvas.getBoundingClientRect();
                    captured = {
                      bytes,
                      observedProgress: value,
                      at: inspectedAt,
                      snapshot: {
                        count,
                        maximumAlpha,
                        captureAgeMs,
                        deliveredResults: fixture.deliveredResults,
                        width: canvas.width,
                        height: canvas.height,
                        clientWidth: canvas.clientWidth,
                        clientHeight: canvas.clientHeight,
                        cssRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                        dpr: devicePixelRatio,
                        viewportWidth: innerWidth,
                        documentWidth: document.documentElement.clientWidth,
                        scroll: { x: scrollX, y: scrollY },
                        png: canvas.toDataURL("image/png"),
                      },
                    };
                  }
                }
              }
              raf = requestAnimationFrame(tick);
            } catch (error) {
              const progress = document.querySelector('progress[aria-label="Guided recording progress"]');
              stop(
                Number(progress?.getAttribute("value") ?? 0),
                error instanceof Error ? error : new Error("RECORDING_RASTER_READBACK_FAILED"),
              );
            }
          };
          raf = requestAnimationFrame(tick);
        }, liveBefore.deliveredResults);
        await start.click();
        const nativeProof = await page.evaluate(async () => {
          const state = (
            window as unknown as {
              recorderNativeBoundedProof: {
                finished: Promise<{
                  liveDuring: {
                    count: number;
                    hash: string;
                    maximumAlpha: number;
                    captureAgeMs: number;
                    deliveredResults: number;
                    width: number;
                    height: number;
                    clientWidth: number;
                    clientHeight: number;
                    cssRect: { x: number; y: number; width: number; height: number };
                    dpr: number;
                    viewportWidth: number;
                    documentWidth: number;
                    scroll: { x: number; y: number };
                    png: string;
                  };
                  modeLockedDuringRecording: boolean;
                  timing: object;
                }>;
              };
            }
          ).recorderNativeBoundedProof;
          return state.finished;
        });
        const liveDuring = nativeProof.liveDuring;
        expect(nativeProof.modeLockedDuringRecording).toBe(true);
        expect(liveDuring.maximumAlpha).toBe(255);
        expect(liveDuring.captureAgeMs).toBeGreaterThanOrEqual(0);
        expect(liveDuring.captureAgeMs).toBeLessThanOrEqual(150);
        expect(liveDuring.deliveredResults).toBeGreaterThan(liveBefore.deliveredResults);
        await expect(page.getByRole("heading", { name: "Review your local recording" })).toBeVisible();
        for (const [phase, capture] of Object.entries({ before: liveBefore, during: liveDuring }))
          await testInfo.attach(`D0-${containsHandOverlay ? "composite" : "clean"}-live-${phase}.png`, {
            body: Buffer.from(capture.png.split(",")[1], "base64"),
            contentType: "image/png",
          });
        await testInfo.attach(`D0-${containsHandOverlay ? "composite" : "clean"}-live-geometry.json`, {
          body: JSON.stringify(
            {
              before: { ...liveBefore, png: undefined },
              during: { ...liveDuring, png: undefined },
              baselineReadbacks,
              nativeTiming: nativeProof.timing,
              modelFixturePoints: pointingPose({ indexBends: [0, 10, 20] }),
            },
            null,
            2,
          ),
          contentType: "application/json",
        });
        expect(liveDuring.count).toBe(liveBefore.count);
        expect(liveDuring.hash).toBe(liveBefore.hash);
        expect([liveDuring.width, liveDuring.height, liveDuring.dpr]).toEqual([
          liveBefore.width,
          liveBefore.height,
          liveBefore.dpr,
        ]);
        const trace = await page
          .getByRole("link", { name: "Download landmark trace", exact: true })
          .evaluate(async (link) => (await fetch((link as HTMLAnchorElement).href)).json());
        expect(trace.video).toMatchObject({
          kind: containsHandOverlay ? "CAMERA_PLUS_EXISTING_RENDERED_TRACE_AND_PROMPT" : "CAMERA_IMAGE_AND_PROMPT",
          containsHandOverlay,
          cameraImageEncoding: "MIRRORED_REENCODED_DIAGNOSTIC_NOT_RAW_SENSOR",
          requestedFps: 20,
          imageRegion: { x: 0, y: 0, width: 640, height: 480 },
          annotationStripHeight: 112,
          previewMirrorX: true,
          audio: false,
        });
        expect(trace.limits.videoBytes).toBe(64 * 1024 * 1024);
        expect(trace.activeDurationMs).toBeGreaterThanOrEqual(800);
        expect(trace.activeDurationMs).toBeLessThanOrEqual(1200);
        expect(trace.frames.some((frame: { hands: unknown[] }) => frame.hands.length === 1)).toBe(true);
        const decoded = await page.getByLabel("Review local diagnostic recording").evaluate(async (element) => {
          const video = element as HTMLVideoElement;
          if (video.readyState < 2)
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error("RECORDED_VIDEO_DECODE_TIMEOUT")), 10000);
              video.addEventListener(
                "loadeddata",
                () => {
                  clearTimeout(timeout);
                  resolve();
                },
                { once: true },
              );
              video.addEventListener(
                "error",
                () => {
                  clearTimeout(timeout);
                  reject(new Error("RECORDED_VIDEO_DECODE_FAILED"));
                },
                { once: true },
              );
            });
          video.muted = true;
          await video.play();
          const started = performance.now();
          await new Promise<void>((resolve, reject) => {
            const wait = () => {
              if (video.currentTime >= 0.3) resolve();
              else if (performance.now() - started > 10000) reject(new Error("RECORDED_VIDEO_FRAME_TIMEOUT"));
              else requestAnimationFrame(wait);
            };
            wait();
          });
          video.pause();
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const context = canvas.getContext("2d")!;
          // Exclude the prompt strip: only the encoded camera image region is measured.
          context.drawImage(video, 0, 0, 640, 480, 0, 0, 640, 480);
          const pixels = context.getImageData(0, 0, 640, 480).data;
          let cyanPixels = 0;
          for (let i = 0; i < pixels.length; i += 4)
            if (pixels[i + 1] - pixels[i] > 25 && pixels[i + 2] - pixels[i] > 8 && pixels[i + 1] > 160) cyanPixels++;
          return {
            cyanPixels,
            width: video.videoWidth,
            height: video.videoHeight,
            at: video.currentTime,
            png: canvas.toDataURL("image/png"),
          };
        });
        expect(decoded.width).toBe(640);
        expect(decoded.height).toBe(592);
        if (containsHandOverlay) expect(decoded.cyanPixels).toBeGreaterThan(50);
        else expect(decoded.cyanPixels).toBeLessThanOrEqual(5);
        await testInfo.attach(
          containsHandOverlay ? "D0-decoded-composite-camera-region.png" : "D0-decoded-clean-camera-region.png",
          {
            body: Buffer.from(decoded.png.split(",")[1], "base64"),
            contentType: "image/png",
          },
        );
        observations.push({
          containsHandOverlay,
          video: trace.video,
          liveCyanPixels: liveBefore.count,
          decodedCyanPixels: decoded.cyanPixels,
          decodedAtSeconds: decoded.at,
          frames: trace.frames.length,
          activeDurationMs: trace.activeDurationMs,
        });
      },
    );
  }
  await testInfo.attach("D0-encoded-clean-vs-overlay-video.json", {
    body: JSON.stringify(
      {
        evidence: "D0_SYNTHETIC_FLAT_CAMERA_FAKE_MODEL_REAL_REACHSTAGE_AND_MEDIARECORDER_DECODE",
        observations,
        physicalRecognitionQualified: false,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
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
    const clean = page.getByRole("checkbox", { name: "Save camera image without hand overlay" });
    await expect(clean).toBeChecked();
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
    await expect(clean).toBeDisabled();
    const progress = page.getByRole("progressbar", { name: "Guided recording progress" });
    await expect.poll(async () => Number(await progress.getAttribute("value"))).toBeGreaterThan(900);
    await page.getByRole("button", { name: "Stop & review", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Review your local recording" })).toBeVisible();
    const trace = await page
      .getByRole("link", { name: "Download landmark trace", exact: true })
      .evaluate(async (link) => {
        const response = await fetch((link as HTMLAnchorElement).href);
        return response.json();
      });
    expect(trace.video).toMatchObject({
      kind: "CAMERA_IMAGE_AND_PROMPT",
      containsHandOverlay: false,
      cameraImageEncoding: "MIRRORED_REENCODED_DIAGNOSTIC_NOT_RAW_SENSOR",
      imageRegion: { x: 0, y: 0, width: 640, height: 480 },
      annotationStripHeight: 112,
      previewMirrorX: true,
    });
    expect(trace.model.inferenceBackendsUsed.length).toBeGreaterThan(0);
    expect(
      trace.model.inferenceBackendsUsed.every((backend: string) => ["CPU_WASM", "GPU_WEBGL"].includes(backend)),
    ).toBe(true);
    expect(trace.model.inferencePoliciesUsed.length).toBeGreaterThan(0);
    expect(
      trace.model.inferencePoliciesUsed.every((policy: string) =>
        ["ORIGINAL_CPU", "WATCHGLASS_ACTUAL_ROI_RECOVERY_V1"].includes(policy),
      ),
    ).toBe(true);
    await testInfo.attach("clean-camera-recording-metadata.json", {
      body: JSON.stringify(
        {
          evidence: "SYNTHETIC_CAMERA_REAL_PINNED_WORKER_AND_MEDIARECORDER",
          actualModel: trace.model,
          video: trace.video,
          frameCount: trace.frames.length,
          physicalRecognitionQualified: false,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
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
