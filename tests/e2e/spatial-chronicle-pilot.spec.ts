// @sounding-line-registration owner=spatial-pilot suite=browser.spatial-pilot contracts=spatial-pilot.experience
import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { createAccountSession } from "../../src/wayfarer/accounts";
import { closureAccount, authenticateClosure, enterClosureJournal, openClosureMap } from "./fixtures/landfall-closure";
import { STALE_MS } from "../../src/crossdeck/contracts";

test.describe.configure({ mode: "serial", timeout: 300000 });
test.use({ actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const evidence = "artifacts/spatial-pilot/screenshots";
const ownerId = "spatial-pilot-navigator";
async function capture(page: Page, name: string) {
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });
}
test("complete published adventure, genuine phone handoff, recovery, feedback, and authored Studio", async ({
  browser,
  baseURL,
}) => {
  const url = (process.env.DATABASE_URL ?? "").replaceAll("\\", "/");
  if (
    !url.startsWith("file:") ||
    (!url.includes("/artifacts/spatial-pilot/") && !url.includes("/artifacts/sounding-line/"))
  )
    throw new Error("PILOT_OWNED_DATABASE_REQUIRED");
  if (!(await db.userAccount.findUnique({ where: { id: ownerId } }))) {
    const now = new Date();
    await db.userAccount.create({
      data: {
        id: ownerId,
        status: "ACTIVE",
        claimedAt: now,
        ordinaryWorkspaceEntryAt: now,
        profile: {
          create: {
            displayName: "Synthetic Pilot Navigator",
            normalizedDisplayName: "synthetic pilot navigator",
            status: "ACTIVE",
            claimedAt: now,
          },
        },
        emails: {
          create: {
            normalizedEmail: "pilot.browser@example.test",
            displayEmail: "pilot.browser@example.test",
            isPrimary: true,
            verificationState: "VERIFIED",
            verifiedAt: now,
          },
        },
      },
    });
  }
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const outsider = await browser.newContext();
  try {
    const session = await createAccountSession(ownerId, "Synthetic Pilot desktop");
    const receiver = await createAccountSession(ownerId, "Synthetic Pilot phone");
    await desktop.addCookies([{ name: "wayfarer_account", value: session.token, url: baseURL! }]);
    await phone.addCookies([{ name: "wayfarer_account", value: receiver.token, url: baseURL! }]);
    const d = await desktop.newPage(),
      p = await phone.newPage();
    const entryStart = performance.now();
    await d.goto("/dev/spatial-pilot");
    await expect(d.getByRole("heading", { name: "The Lost Navigator’s Chart", exact: true })).toBeVisible();
    const entryMs = performance.now() - entryStart;
    const progressionMs: number[] = [];
    await capture(d, "owner-session-unprepared");
    const before = await db.chronicle.count();
    const unauthorized = await outsider.request.post(`${baseURL}/api/dev/spatial-pilot`, {
      data: { action: "provision" },
    });
    expect(unauthorized.status()).toBe(404);
    expect((await d.request.post(`${baseURL}/api/dev/spatial-pilot`, { data: { action: "provision" } })).status()).toBe(
      404,
    );
    expect(await db.chronicle.count()).toBe(before);
    const other = await closureAccount("Synthetic Pilot unauthorized navigator");
    await authenticateClosure(outsider, other, baseURL!);
    expect((await outsider.request.get(`${baseURL}/dev/spatial-pilot`)).status()).toBe(404);
    await d.route("**/api/dev/spatial-pilot", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Simulated temporary preparation failure. Try again." }),
      }),
    );
    await d.getByRole("button", { name: "Prepare the adventure", exact: true }).click();
    await expect(d.getByRole("status")).toContainText("Simulated temporary preparation failure");
    await capture(d, "owner-preparation-error-simulated");
    await d.unroute("**/api/dev/spatial-pilot");
    const preparedResponse = d.waitForResponse(
      (r) => r.url().endsWith("/api/dev/spatial-pilot") && r.request().method() === "POST",
    );
    await d.getByRole("button", { name: "Prepare the adventure", exact: true }).click();
    const response = await preparedResponse;
    expect(response.ok(), await response.text()).toBe(true);
    const prepared = await response.json();
    const replay = await d.request.post(`${baseURL}/api/dev/spatial-pilot`, {
      headers: { "x-csrf-token": session.csrfToken },
      data: { action: "replay" },
    });
    expect(replay.ok(), await replay.text()).toBe(true);
    const pilot = await replay.json();
    expect(pilot.versionId).toBe(prepared.versionId);
    expect(pilot.voyageId).not.toBe(prepared.voyageId);
    expect((await db.taleSession.findUniqueOrThrow({ where: { id: prepared.voyageId } })).status).toBe("CANCELLED");
    expect(pilot.versionId).toBeTruthy();
    const published = await db.publishedTaleVersion.findUniqueOrThrow({ where: { id: pilot.versionId } });
    const snapshot = JSON.parse(published.contentSnapshot);
    expect(snapshot.chapters[0].blocks).toHaveLength(10);
    expect(snapshot.chapters[0].blocks[2].presentation.spatialMoment.version.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(await db.drydockPublishingEvidence.count({ where: { publishedVersionId: published.id } })).toBe(1);
    const repeated = await d.request.post(`${baseURL}/api/dev/spatial-pilot`, {
      headers: { "x-csrf-token": session.csrfToken },
      data: { action: "provision" },
    });
    expect((await repeated.json()).voyageId).toBe(pilot.voyageId);
    await d.reload();
    await capture(d, "owner-session-desktop");
    await d.locator("li").first().getByLabel("Trial status").selectOption("In progress");
    await d.locator("li").first().locator("summary").click();
    await d
      .locator("li")
      .first()
      .getByLabel("What happened?", { exact: true })
      .fill("The bottle’s message opened correctly.");
    await d.reload();
    await expect(d.locator("li").first().getByLabel("Trial status")).toHaveValue("In progress");
    const download = d.waitForEvent("download");
    await d.getByRole("button", { name: "Export one feedback report" }).click();
    const file = await download;
    const text = await readFile((await file.path())!, "utf8"),
      report = JSON.parse(text);
    expect(report.pilot.versionId).toBe(pilot.versionId);
    expect(report.activities[0].state).toBe("In progress");
    expect(report.cameraImageryIncluded).toBe(false);
    expect(text).not.toContain(session.token);
    await d.setViewportSize({ width: 390, height: 844 });
    expect(await d.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const audit = await new AxeBuilder({ page: d }).analyze();
    expect(audit.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual([]);
    await capture(d, "owner-session-mobile");
    await d.setViewportSize({ width: 1440, height: 1000 });
    await d.goto(`/account/devices?voyage=${pilot.voyageId}`);
    await d.getByLabel("Device name").fill("Navigator desktop");
    await d.getByRole("button", { name: "Use this device", exact: true }).click();
    await d.getByRole("button", { name: "Connect another device", exact: true }).click();
    const code = (await d.locator("code").innerText()).replaceAll(" ", "");
    await p.goto(`/devices/pair#code=${code}`);
    await p.getByLabel("Device name").fill("Navigator phone");
    await p.getByRole("button", { name: "Join this Voyage", exact: true }).click();
    await expect(p.getByText("This device is connected as Chronicle Lens companion.")).toBeVisible();
    await p.goto(pilot.journalHref);
    await enterClosureJournal(p);
    await capture(p, "phone-journal-opening");
    await d.goto(pilot.journalHref);
    await enterClosureJournal(d);
    await capture(d, "journal-opening");
    async function continueStory(surface: Page = d) {
      const started = performance.now();
      const returnCurrent = surface.getByRole("button", { name: "Return to Current Objective", exact: true });
      if (await returnCurrent.isVisible()) await returnCurrent.click();
      const button = surface.getByRole("button", { name: "Continue Voyage", exact: true });
      await expect(button).toBeEnabled();
      const current = await db.taleSession.findUniqueOrThrow({ where: { id: pilot.voyageId } });
      await button.click();
      await expect
        .poll(async () => (await db.taleSession.findUniqueOrThrow({ where: { id: pilot.voyageId } })).currentBlockId)
        .not.toBe(current.currentBlockId);
      progressionMs.push(performance.now() - started);
    }
    await continueStory();
    await capture(d, "journal-chart");
    await openClosureMap(p);
    await capture(p, "phone-chart-controls");
    await p.getByRole("button", { name: "Close journal tool drawer" }).click();
    await continueStory();
    await d.getByRole("button", { name: "Open Chronicle Lens", exact: true }).first().click();
    const lens = d.getByRole("dialog", { name: "Iona Morrow’s last parchment" });
    await expect(lens.getByText("Guided View", { exact: true })).toBeVisible();
    await lens.getByRole("button", { name: "Inspect", exact: true }).first().click();
    await capture(d, "journal-spatial-message");
    await lens.getByRole("button", { name: "Close Chronicle Lens" }).click();
    await p.getByRole("button", { name: "Open Chronicle Lens", exact: true }).first().click();
    const phoneLens = p.getByRole("dialog", { name: "Iona Morrow’s last parchment" });
    await phoneLens.getByRole("button", { name: "Inspect", exact: true }).first().click();
    await capture(p, "phone-spatial-message");
    await phoneLens.getByRole("button", { name: "Close Chronicle Lens" }).click();
    await continueStory();
    await continueStory();
    await continueStory();
    await p.goto(pilot.journalHref);
    await enterClosureJournal(p);
    await openClosureMap(d);
    await d.getByRole("button", { name: "Close journal tool drawer" }).click();
    const sending = d.getByRole("region", { name: "Send to your devices" });
    await sending.locator("summary").click();
    const phoneSurface = await db.crossdeckSurfaceSession.findFirstOrThrow({
      where: { accountSessionId: receiver.id },
    });
    await sending.getByLabel("Send destination").selectOption(phoneSurface.surfaceId);
    await sending.getByLabel("Transfer mode").selectOption("MOVE_CUSTODY");
    const progressionBefore = await db.taleSessionEvent.count({ where: { sessionId: pilot.voyageId } });
    const start = performance.now();
    await sending.getByRole("button", { name: "Send view", exact: true }).click();
    const receiving = p.getByRole("region", { name: "Send to your devices" });
    await receiving.getByRole("button", { name: /^Receive / }).click();
    await expect(p.locator(".journal-objects-drawer.open [data-landfall-player-chart]:visible")).toBeVisible();
    await expect
      .poll(
        async () =>
          JSON.parse(
            (await db.crossdeckDeck.findFirstOrThrow({ where: { membership: { playthroughId: pilot.voyageId } } }))
              .state,
          ).handoffs[0].state,
      )
      .toBe("ACKNOWLEDGED");
    const handoffMs = performance.now() - start;
    expect(await db.taleSessionEvent.count({ where: { sessionId: pilot.voyageId } })).toBe(progressionBefore);
    await capture(p, "phone-received-chart");
    const recoveryStart = performance.now();
    await p.goto("about:blank");
    await expect
      .poll(
        async () => {
          const data = await (await d.request.get(`/api/crossdeck?voyage=${pilot.voyageId}`)).json();
          return data.surfaces.find((s: { surfaceId: string }) => s.surfaceId === phoneSurface.surfaceId)?.presence;
        },
        { timeout: STALE_MS + 15000 },
      )
      .toBe("DISCONNECTED");
    const close = d.getByRole("button", { name: "Close journal tool drawer" });
    if (await close.isVisible()) await close.click();
    await sending.getByRole("button", { name: "Recover view here" }).click();
    await expect(sending.getByText(/Controlled here/)).toBeVisible();
    const recoveryMs = performance.now() - recoveryStart;
    await p.goto(pilot.journalHref);
    await enterClosureJournal(p);
    const closeAgain = d.getByRole("button", { name: "Close journal tool drawer" });
    if (await closeAgain.isVisible()) await closeAgain.click();
    await continueStory();
    await d.getByText("Morrow’s compass", { exact: true }).click();
    await capture(d, "compass-capability-state");
    await d.getByRole("button", { name: "Read the compass rose", exact: true }).click();
    await expect(d.getByText(/Beyond the northern light, the returning tide/)).toBeVisible();
    await capture(d, "compass-alternative");
    await continueStory();
    await continueStory();
    await continueStory(p);
    for (const surface of [d, p]) {
      const returnCurrent = surface.getByRole("button", { name: "Return to Current Objective", exact: true });
      if (await returnCurrent.isVisible()) await returnCurrent.click();
    }
    await expect(p.getByText("A light left burning", { exact: true }).first()).toBeVisible();
    await capture(p, "phone-story-finale");
    await p.getByRole("button", { name: "Continue Voyage", exact: true }).click();
    await expect
      .poll(async () => (await db.taleSession.findUniqueOrThrow({ where: { id: pilot.voyageId } })).status)
      .toBe("COMPLETED");
    await capture(d, "journal-ending");
    await capture(p, "phone-journal-ending");
    await d.reload();
    await enterClosureJournal(d);
    expect((await db.taleSession.findUniqueOrThrow({ where: { id: pilot.voyageId } })).publishedVersionId).toBe(
      pilot.versionId,
    );
    await d.goto(pilot.studioHref);
    await expect(d.getByLabel("Experience title")).toHaveValue("Iona Morrow’s last parchment");
    await capture(d, "studio-guided-desktop");
    await d.getByLabel("Authoring mode").selectOption("DETAILED");
    await capture(d, "studio-detailed-desktop");
    await d.getByLabel("Authoring mode").selectOption("ENGINEERING");
    await expect(d.getByLabel("Behavior 1 trigger")).toHaveValue("INSPECT");
    await capture(d, "studio-engineering-desktop");
    await d
      .getByRole("region", { name: "Spatial canvas", exact: true })
      .screenshot({ path: `${evidence}/studio-active-canvas.png` });
    await d
      .locator("fieldset")
      .filter({ has: d.locator("legend").getByText("Selected spatial object", { exact: true }) })
      .screenshot({ path: `${evidence}/studio-selected-inspector.png` });
    await d
      .getByRole("complementary", { name: "Spatial Library", exact: true })
      .screenshot({ path: `${evidence}/studio-library.png` });
    await d
      .getByRole("region", { name: "Scene graph", exact: true })
      .screenshot({ path: `${evidence}/studio-scene-graph.png` });
    await d
      .getByRole("region", { name: "Behavior timeline", exact: true })
      .screenshot({ path: `${evidence}/studio-behavior-timeline.png` });
    await d.getByLabel("Search Library", { exact: true }).fill("missing-fictional-archive");
    await expect(d.getByText("No saved items match. Create and save a spatial moment to begin.")).toBeVisible();
    await capture(d, "studio-library-empty");
    await d.getByLabel("Search Library", { exact: true }).fill("");
    const canvasFrameIntervals = await d.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const intervals: number[] = [];
          let previous: number | null = null;
          const frame = (now: number) => {
            if (previous !== null) intervals.push(now - previous);
            previous = now;
            if (intervals.length === 60) resolve(intervals);
            else requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        }),
    );
    await d.getByRole("combobox", { name: "Preview", exact: true }).selectOption("PHONE");
    await capture(d, "studio-phone-viewpoint");
    await d.getByRole("combobox", { name: "Preview", exact: true }).selectOption("REMOTE");
    await capture(d, "studio-remote-viewpoint");
    await d.setViewportSize({ width: 390, height: 844 });
    await capture(d, "studio-engineering-mobile");
    expect(await d.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await d.goto("/devices/reach");
    await expect(d.getByRole("heading", { name: "Find the Hand" })).toBeVisible();
    await capture(d, "reach-entry-mobile");
    await writeFile(
      "artifacts/spatial-pilot/browser-measurements.json",
      JSON.stringify(
        {
          fidelity: "D1 desktop/mobile Chromium emulation; manual controls; synthetic accounts and fictional content",
          sourceCommit: process.env.SPATIAL_PILOT_SOURCE_SHA ?? "UNAVAILABLE",
          entryMs,
          progressionMs,
          routeTimingBoundary:
            "Browser navigation to visible entry; Continue invocation to observed durable block change, including automation/polling overhead",
          canvasFrameIntervals,
          canvasTimingBoundary:
            "60 requestAnimationFrame intervals while Engineering canvas is visible; browser scheduling only, not native AR or device frame-rate certification",
          handoffMs,
          handoffBoundary:
            "Send button invocation to observed durable receiver ACKNOWLEDGED (includes automated click and polling overhead)",
          recoveryMs,
          recoveryBoundary:
            "Receiver navigation away through canonical stale-presence wait to recovery control confirmation",
          physicalAcceptance: "OWNER_PHYSICAL_ACCEPTANCE_PENDING",
          versionId: pilot.versionId,
        },
        null,
        2,
      ),
    );
  } finally {
    await desktop.close();
    await phone.close();
    await outsider.close();
  }
});
