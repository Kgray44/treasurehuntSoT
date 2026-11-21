// @sounding-line-registration owner=project-crossdeck suite=browser.crossdeck contracts=crossdeck.phase2.continuity
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { db } from "../../src/lib/db";
import type { DeckState } from "../../src/crossdeck/sync-contracts";
import { createAccountSession } from "../../src/wayfarer/accounts";
import { createCrossdeckRefitFixture, removeCrossdeckRefitFixture } from "./fixtures/crossdeck-refit";
import { authenticateClosure, openClosureJournal, openClosureMap } from "./fixtures/landfall-closure";

// Only the camera and model boundary is synthetic. Both pages use the app and the real Crossdeck service.
async function simulateCamera(context: BrowserContext) {
  await context.addInitScript(() => {
    let pose: "open" | "fist" | "empty" = "empty";
    window.addEventListener("synthetic-camera-pose", (event) => {
      pose = (event as CustomEvent<typeof pose>).detail;
    });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const context = canvas.getContext("2d")!;
        const stream = canvas.captureStream(24);
        let shade = 0;
        const paint = () => {
          if (stream.getVideoTracks()[0].readyState !== "live") {
            clearInterval(timer);
            return;
          }
          context.fillStyle = shade++ % 2 ? "black" : "white";
          context.fillRect(0, 0, canvas.width, canvas.height);
        };
        const timer = setInterval(paint, 42);
        paint();
        return stream;
      },
    });
    const NativeWorker = window.Worker;
    const point = (x: number, y: number) => ({ x, y, z: 0 });
    class SyntheticWorker {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      postMessage(input: { type: string; generation: number; capture: number; bitmap: ImageBitmap }) {
        const { type, generation, capture, bitmap } = input;
        if (type === "INIT") {
          queueMicrotask(() => this.onmessage?.({ data: { type: "READY", generation } }));
          return;
        }
        const { width, height } = bitmap;
        bitmap.close();
        const hand = [
          point(0.5, 0.66),
          point(0.44, 0.57),
          point(0.39, 0.52),
          point(0.37, 0.47),
          point(0.24, 0.33),
          ...[0.4, 0.46, 0.53, 0.6].flatMap((x) => [
            point(x, 0.5),
            point(x, 0.43),
            point(x, 0.38),
            point(x, pose === "fist" ? 0.49 : 0.33),
          ]),
        ];
        queueMicrotask(() =>
          this.onmessage?.({
            data: {
              type: "RESULT",
              generation,
              width,
              height,
              capture,
              inferenceTime: performance.timeOrigin + performance.now(),
              result: { landmarks: pose === "empty" ? [] : [hand], handedness: [] },
            },
          }),
        );
      }
      terminate() {
        this.onmessage = null;
      }
    }
    window.Worker = new Proxy(NativeWorker, {
      construct(target, args) {
        return args[0] === "/reach/hand-worker.js" ? new SyntheticWorker() : Reflect.construct(target, args);
      },
    });
  });
}
async function setPose(page: Page, pose: "open" | "fist" | "empty") {
  await page.evaluate(
    (value) => window.dispatchEvent(new CustomEvent("synthetic-camera-pose", { detail: value })),
    pose,
  );
}
async function enableGestures(page: Page, baseURL: string) {
  await page.goto(baseURL + "/account/preferences");
  const preference = page.getByRole("checkbox", { name: "Use hand gestures on this device" });
  await expect(preference).toBeEnabled();
  await preference.focus();
  await preference.press("Space");
  await expect(preference).toBeChecked();
  await page.reload();
  await expect(preference).toBeChecked();
}

test.afterAll(() => db.$disconnect());

test("a palm-fist and fist-palm transfer opens the pinned Chart across two paired sessions without a picker", async ({
  browser,
  baseURL,
}, testInfo) => {
  if (!baseURL) throw new Error("An isolated origin is required");
  const fixture = await createCrossdeckRefitFixture();
  const { account, voyage } = fixture;
  const secondSession = await createAccountSession(account.id, "Synthetic gesture receiver");
  const source = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: "reduce" });
  const receiver = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    await Promise.all([
      simulateCamera(source),
      simulateCamera(receiver),
      authenticateClosure(source, account, baseURL),
    ]);
    await receiver.addCookies([
      { name: "wayfarer_account", value: secondSession.token, url: baseURL, sameSite: "Lax" },
    ]);
    const desktop = await source.newPage();
    const phone = await receiver.newPage();
    await Promise.all([enableGestures(desktop, baseURL), enableGestures(phone, baseURL)]);
    await openClosureJournal(desktop, voyage.id, baseURL);
    await desktop.getByRole("button", { name: "Connect another device", exact: true }).click();
    const pair = desktop.getByRole("dialog", { name: "Bring your phone aboard" });
    await pair.getByText("Use a code instead", { exact: true }).click();
    const code = await pair.locator("code").innerText();
    await phone.goto(baseURL + "/devices/pair#code=" + code);
    await phone.getByRole("button", { name: "Join the Chronicle" }).click();
    await expect(phone.getByRole("heading", { name: "Journal companion" })).toBeVisible();
    await expect(pair.getByRole("status")).toContainText("Phone connected");
    await pair.getByRole("button", { name: "Continue the Chronicle" }).click();

    const deck = async () => {
      const row = await db.crossdeckDeck.findFirst({ where: { membership: { playthroughId: voyage.id } } });
      return row ? (JSON.parse(row.state) as DeckState) : undefined;
    };
    await openClosureMap(desktop);
    await setPose(phone, "fist");
    await setPose(desktop, "open");
    await expect(desktop.getByText("Ready to pick up this Chart.", { exact: true })).toBeVisible();
    await setPose(desktop, "fist");
    const held = desktop.getByText("Chart in hand.", { exact: false });
    await expect(held).toBeVisible();
    await expect(held.locator("..").locator("[aria-hidden=true]")).toHaveCSS("animation-name", "none");
    await expect(desktop.getByRole("dialog", { name: "Send this view" })).toHaveCount(0);
    expect((await deck())?.handoffs).toEqual([]);
    await testInfo.attach("source-held-reduced-motion", { body: await desktop.screenshot(), contentType: "image/png" });

    // Wait for the actual receiver reconciliation, even if a live notification was missed.
    await phone.waitForResponse(
      (response) =>
        response.url().includes("/api/crossdeck/sync") && response.request().method() === "GET" && response.ok(),
    );
    const attempts: string[] = [];
    await source.route("**/api/crossdeck/sync?**", async (route) => {
      const request = route.request();
      if (request.method() !== "POST" || request.postDataJSON()?.payload?.action !== "gesture-send")
        return route.continue();
      attempts.push(request.postDataJSON().messageId);
      if (attempts.length === 1) {
        const upstream = await route.fetch();
        expect(upstream.ok()).toBe(true);
        return route.abort("connectionreset");
      }
      return route.continue();
    });
    const releasedAt = Date.now();
    await setPose(phone, "open");
    const received = phone.locator("[data-companion-object]");
    await expect(received).toHaveAttribute("data-companion-object", voyage.activeId);
    await expect(received.getByLabel("Virtual Landfall chart", { exact: true })).toBeVisible();
    await expect(phone.getByRole("button", { name: /^Receive / })).toHaveCount(0);
    await expect.poll(async () => (await deck())?.handoffs.at(-1)?.state).toBe("ACKNOWLEDGED");
    const [handoff] = (await deck())!.handoffs;
    expect(handoff).toMatchObject({
      object: { objectId: voyage.activeId, version: voyage.versionId },
      mode: "SEND_VIEW",
      state: "ACKNOWLEDGED",
    });
    expect((await deck())!.handoffs).toHaveLength(1);
    await expect.poll(() => attempts.length).toBe(2);
    expect(new Set(attempts).size).toBe(1);
    await expect(desktop.getByText(/is open on your other device/)).toBeVisible();
    await testInfo.attach("phone-pinned-chart", { body: await phone.screenshot(), contentType: "image/png" });
    await testInfo.attach("synthetic-release-to-receipt", {
      body: JSON.stringify({ elapsedMs: Date.now() - releasedAt, camera: "synthetic-landmarks" }),
      contentType: "application/json",
    });
  } finally {
    await Promise.all([source.close(), receiver.close()]);
    await removeCrossdeckRefitFixture(fixture);
  }
});
