// @sounding-line-registration owner=project-crossdeck suite=browser.crossdeck contracts=crossdeck.phase2.continuity,crossdeck.refit.companion,spatial-pilot.experience,homeport.shell.crossdeck-companion
import { test, expect, type Page, type Locator } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { createAccountSession, revokeAccountSession } from "../../src/wayfarer/accounts";
import { STALE_MS } from "../../src/crossdeck/contracts";
import { createCrossdeckRefitFixture, removeCrossdeckRefitFixture } from "./fixtures/crossdeck-refit";
import { authenticateClosure, openClosureJournal, openClosureMap } from "./fixtures/landfall-closure";

test.describe.configure({ mode: "serial", timeout: 180_000 });
test.use({ trace: "off", video: "off", screenshot: "off" });
test.afterAll(() => db.$disconnect());
const pairedBinding = process.env.SOUNDING_LINE_PAIRED_BINDING
  ? (JSON.parse(process.env.SOUNDING_LINE_PAIRED_BINDING) as Record<string, string>)
  : null;
type PairedContexts = Record<
  "DESKTOP" | "MOBILE",
  {
    voyageId: string;
    editionId: string;
    surfaceId: string;
    viewport: { width: number; height: number };
    reducedMotion: boolean;
  }
>;
type PairedViewport = { width: number; height: number };
function relativeMedia(file: string | undefined, directory: string) {
  if (!file) throw new Error("CROSSDECK_PAIRED_MEDIA_MISSING");
  const relative = path.relative(path.resolve(directory), path.resolve(file)).replaceAll("\\", "/");
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("CROSSDECK_PAIRED_MEDIA_OUTSIDE_CASE");
  return relative;
}
async function changePurpose(page: Page, name: string, advanced = false) {
  const purposes = page
    .locator("details")
    .filter({ has: page.locator("summary").filter({ hasText: /^Change companion purpose$/ }) })
    .first();
  if ((await purposes.getAttribute("open")) === null) await purposes.locator("summary").first().click();
  if (advanced) {
    const more = purposes.locator("details");
    if ((await more.getAttribute("open")) === null) await more.locator("summary").click();
  }
  await purposes.getByRole("button", { name, exact: true }).click();
}

for (const motion of ["no-preference", "reduce"] as const)
  test("complete multi-device experience · " + motion, async ({ browser, baseURL }) => {
    const caseId = motion === "reduce" ? "crossdeck-pair-reduced" : "crossdeck-pair-normal";
    const databaseSha256 = process.env.DATABASE_URL
      ? createHash("sha256").update(process.env.DATABASE_URL).digest("hex")
      : null;
    if (pairedBinding && (!databaseSha256 || databaseSha256 !== pairedBinding.databaseSha256))
      throw new Error("CROSSDECK_PAIRED_DATABASE_BINDING_MISMATCH");
    const fixture = await createCrossdeckRefitFixture();
    const { account, voyage } = fixture;
    const companionSession = await createAccountSession(account.id, "Synthetic Crossdeck companion");
    const directory = (process.env.CROSSDECK_REFIT_ARTIFACT_ROOT ?? "artifacts/crossdeck") + "/refit-" + motion;
    await mkdir(directory, { recursive: true });
    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: motion,
      recordVideo: { dir: directory },
    });
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: motion,
      isMobile: true,
      hasTouch: true,
      recordVideo: { dir: directory },
    });
    await desktop.tracing.start({ screenshots: true, snapshots: true });
    await phone.tracing.start({ screenshots: true, snapshots: true });
    const d = await desktop.newPage(),
      p = await phone.newPage();
    d.setDefaultTimeout(15000);
    p.setDefaultTimeout(15000);
    const timings: Record<string, number> = {};
    const outcomes: Record<string, boolean> = {};
    const screenshots: Record<"DESKTOP" | "MOBILE", string[]> = { DESKTOP: [], MOBILE: [] };
    const screenshotViewports: Record<"DESKTOP" | "MOBILE", Record<string, PairedViewport>> = {
      DESKTOP: {},
      MOBILE: {},
    };
    let contexts: PairedContexts | undefined;
    let bodyFailure: unknown;
    const capture = async (page: Page, name: string, focus?: Locator) => {
      if (!focus) await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
      await expect
        .poll(
          () =>
            page.evaluate(
              () =>
                document
                  .getAnimations()
                  .filter(
                    (animation) =>
                      animation.playState === "running" &&
                      Number.isFinite(animation.effect?.getComputedTiming().endTime),
                  ).length,
            ),
          { timeout: 15_000, message: "Finite presentation animations finish before the viewport capture" },
        )
        .toBe(0);
      if (focus) await focus.scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      const viewport = page.viewportSize();
      if (!viewport) throw new Error("CROSSDECK_PAIRED_SCREENSHOT_VIEWPORT_MISSING");
      const image = await page.screenshot({
        path: directory + "/" + name + ".png",
        fullPage: false,
        mask: [page.locator("code"), page.getByRole("img", { name: "Scan with your phone to join this Chronicle" })],
      });
      screenshots[page === d ? "DESKTOP" : "MOBILE"].push(name + ".png");
      screenshotViewports[page === d ? "DESKTOP" : "MOBILE"][name + ".png"] = { ...viewport };
      return image;
    };
    try {
      await authenticateClosure(desktop, account, baseURL!);
      await openClosureJournal(d, voyage.id, baseURL);
      const before = {
        personCount: await db.playerProfile.count(),
        membershipCount: await db.playthroughMembership.count(),
        sequence: (await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } })).currentSequence,
      };
      const primaryPath = new URL(d.url()).pathname;
      await capture(d, "01-chronicle");
      const primaryAccessibility = await new AxeBuilder({ page: d }).include("main").analyze();
      expect(primaryAccessibility.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual(
        [],
      );
      const started = Date.now();
      await d.getByRole("button", { name: "Connect another device", exact: true }).click();
      const connect = d
        .getByRole("dialog")
        .filter({ has: d.getByRole("heading", { name: "Bring your phone aboard" }) });
      await expect(connect.getByRole("img", { name: "Scan with your phone to join this Chronicle" })).toBeVisible();
      timings.connectToQRMs = Date.now() - started;
      expect(new URL(d.url()).pathname).toBe(primaryPath);
      await capture(d, "02-connect-in-chronicle");
      await connect.getByText("Use a code instead", { exact: true }).click();
      const code = await connect.locator("code").innerText();
      expect(code).toMatch(/^[A-F0-9]{12}$/);
      await p.goto(baseURL + "/devices/pair#code=" + code);
      await expect(p.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
      expect(new URL(p.url()).hash).toBe("");
      expect(await p.getByRole("link", { name: "Sign in", exact: true }).getAttribute("href")).not.toContain(code);
      await capture(p, "03-phone-sign-in");
      await phone.addCookies([
        { name: "wayfarer_account", value: companionSession.token, url: baseURL!, sameSite: "Lax" },
      ]);
      await p.goto(baseURL + "/devices/pair");
      await expect(p.getByLabel("Connection code", { exact: true })).toHaveValue(code);
      const joinedAt = Date.now();
      await p.getByLabel("Connection code", { exact: true }).press("Enter");
      await expect(p.getByRole("heading", { name: "Journal companion", exact: true })).toBeVisible();
      timings.claimToCompanionMs = Date.now() - joinedAt;
      await expect(connect.getByRole("status")).toContainText("Phone connected", { timeout: 8000 });
      await expect(connect.locator("code")).toHaveCount(0);
      await capture(p, "04-journal-companion");
      await capture(d, "04-phone-connected");
      await connect.getByRole("button", { name: "Continue the Chronicle", exact: true }).click();
      await expect(d.getByRole("button", { name: /^Connect another device/ })).toBeFocused();
      const receiver = await db.crossdeckSurfaceSession.findFirstOrThrow({
        where: { accountSessionId: companionSession.id },
      });
      const surfaces = await db.crossdeckSurfaceSession.findMany({
        where: { accountSession: { accountId: account.id } },
      });
      expect(surfaces).toHaveLength(2);
      const primary = surfaces.find((surface) => surface.id !== receiver.id);
      if (!primary) throw new Error("CROSSDECK_PRIMARY_SURFACE_MISSING");
      expect(primary.surfaceId).not.toBe(receiver.surfaceId);
      expect(primary.membershipId).toBe(receiver.membershipId);
      const membership = await db.playthroughMembership.findUniqueOrThrow({ where: { id: receiver.membershipId } });
      expect(membership.playthroughId).toBe(voyage.id);
      expect(membership.playerProfileId).toBe(account.profileId);
      await expect(d.locator("main[data-experience-voyage]")).toHaveAttribute("data-experience-voyage", voyage.id);
      await expect(d.locator("main[data-experience-version]")).toHaveAttribute(
        "data-experience-version",
        voyage.versionId,
      );
      await expect(p.locator("main[data-crossdeck-companion]")).toHaveAttribute("data-experience-voyage", voyage.id);
      await expect(p.locator("main[data-crossdeck-companion]")).toHaveAttribute(
        "data-experience-version",
        voyage.versionId,
      );
      const desktopViewport = d.viewportSize(),
        mobileViewport = p.viewportSize();
      if (!desktopViewport || !mobileViewport) throw new Error("CROSSDECK_PAIRED_VIEWPORT_MISSING");
      expect(desktopViewport).toEqual({ width: 1440, height: 1000 });
      expect(mobileViewport).toEqual({ width: 390, height: 844 });
      const desktopReducedMotion = await d.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
      const mobileReducedMotion = await p.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
      expect(desktopReducedMotion).toBe(motion === "reduce");
      expect(mobileReducedMotion).toBe(motion === "reduce");
      contexts = {
        DESKTOP: {
          voyageId: voyage.id,
          editionId: voyage.versionId,
          surfaceId: primary.surfaceId,
          viewport: desktopViewport,
          reducedMotion: desktopReducedMotion,
        },
        MOBILE: {
          voyageId: voyage.id,
          editionId: voyage.versionId,
          surfaceId: receiver.surfaceId,
          viewport: mobileViewport,
          reducedMotion: mobileReducedMotion,
        },
      };
      outcomes.JOIN_AUTHORIZED = true;
      const readingBefore = (await db.playerProfile.findUniqueOrThrow({ where: { id: account.profileId } }))
        .preferences;
      await changePurpose(p, "Chronicle Lens");
      const lens = p.getByRole("dialog", { name: "A message between worlds", exact: true });
      await expect(lens.getByText("Guided View", { exact: true })).toBeVisible();
      await expect(
        lens.getByText("The next bearing is written in the stars. Look for the northern light.", { exact: true }),
      ).toBeVisible();
      await lens.getByRole("button", { name: "Inspect", exact: true }).click();
      await expect(lens.getByText(/You are inspecting The Captain/)).toBeVisible();
      await capture(p, "05-real-chronicle-lens");
      await lens.getByRole("button", { name: "Close Chronicle Lens", exact: true }).click();
      await changePurpose(p, "Voyage Chart");
      await expect(p.getByRole("heading", { name: "Voyage Chart", exact: true })).toBeVisible();
      await expect(p.getByRole("img", { name: "Virtual Landfall chart", exact: true })).toBeVisible();
      await capture(p, "06-dedicated-chart");
      await changePurpose(p, "Artifact viewer", true);
      await expect(p.getByRole("article", { name: "The brass compass", exact: true })).toBeVisible();
      await expect(p.getByText("A small compass worn smooth", { exact: false })).toBeVisible();
      await capture(p, "07-artifact");
      await changePurpose(p, "Journal companion");
      await expect(p.getByRole("heading", { name: "Journal companion", exact: true })).toBeVisible();
      await p.getByRole("combobox", { name: /^Released passage/ }).selectOption(fixture.noteId);
      await expect(p.getByRole("article", { name: "A letter from the Captain", exact: true })).toBeVisible();
      await capture(p, "08-letter");
      expect((await db.playerProfile.findUniqueOrThrow({ where: { id: account.profileId } })).preferences).toBe(
        readingBefore,
      );
      expect((await db.crossdeckSurfaceSession.findUniqueOrThrow({ where: { id: receiver.id } })).surfaceId).toBe(
        receiver.surfaceId,
      );

      await openClosureMap(d);
      await d.getByRole("button", { name: "Close journal tool drawer", exact: true }).click();
      const sending = d.getByRole("region", { name: "Send to your devices" });
      await sending.getByRole("button", { name: "Send to Phone", exact: true }).click();
      const sendDialog = d
        .getByRole("dialog")
        .filter({ has: d.getByRole("heading", { name: "Send this view", exact: true }) });
      await expect(sendDialog.getByRole("radio", { name: /Phone/ })).toBeChecked();
      await sendDialog.getByText("More ways to open", { exact: true }).click();
      await sendDialog.getByLabel("Transfer mode", { exact: true }).selectOption("MOVE_CUSTODY");
      const sentAt = Date.now();
      await sendDialog.getByRole("button", { name: "Send view", exact: true }).click();
      const receiving = p.getByRole("region", { name: "Send to your devices" });
      await expect(receiving.getByRole("button", { name: /^Receive / })).toBeVisible({ timeout: 15000 });
      timings.sendToVisibleOfferMs = Date.now() - sentAt;
      await capture(p, "09-receive-offer", receiving);
      expect(await sending.innerText()).not.toContain("is open on your other device");
      await capture(d, "09-transfer-pending", sending);
      const receivedAt = Date.now();
      await receiving.getByRole("button", { name: /^Receive / }).click();
      await expect(p.getByRole("img", { name: "Virtual Landfall chart", exact: true })).toBeVisible();
      await expect(p.getByRole("heading", { name: "Voyage Chart", exact: true })).toBeVisible();
      await expect(sending.getByText(/is open on your other device/)).toBeVisible({ timeout: 15000 });
      timings.acceptToRenderedAcknowledgedMs = Date.now() - receivedAt;
      await capture(p, "10-chart-received");
      const state = JSON.parse(
        (await db.crossdeckDeck.findFirstOrThrow({ where: { membership: { playthroughId: voyage.id } } })).state,
      );
      expect(state.handoffs.at(-1).state).toBe("ACKNOWLEDGED");
      expect(state.objects["MAP:" + voyage.activeId].custody).toBe(receiver.surfaceId);
      await capture(d, "10-delivery-acknowledged", sending);
      outcomes.DELIVERY_ACKNOWLEDGED = true;

      await phone.setOffline(true);
      await expect(p.getByText(/Offline|Reconnect|interrupted/, { exact: false }).first()).toBeVisible({
        timeout: 20000,
      });
      await expect(p.getByText("Offline · showing your released view", { exact: true })).toBeVisible();
      await expect(p.getByText("Same Voyage · in sync", { exact: true })).toHaveCount(0);
      await capture(p, "11-offline");
      await phone.setOffline(false);
      await expect(p.getByRole("heading", { name: "Voyage Chart", exact: true })).toBeVisible({ timeout: 20000 });
      await expect(p.getByText("Same Voyage · in sync", { exact: true })).toBeVisible({ timeout: 20000 });
      await capture(p, "12-reconnected");
      await phone.setOffline(true);
      await db.crossdeckSurfaceSession.update({
        where: { id: receiver.id },
        data: { lastSeenAt: new Date(Date.now() - STALE_MS - 1000) },
      });
      await sending.getByText("Connected view options", { exact: true }).click();
      await sending.getByRole("button", { name: /^Recover .* here$/ }).click();
      await expect(d.locator(".journal-objects-drawer.open [data-landfall-player-chart]:visible")).toBeVisible({
        timeout: 15000,
      });
      await capture(d, "13-recovered-chart");
      await phone.setOffline(false);
      await p.reload();
      await expect(p.getByRole("heading", { name: "Voyage Chart", exact: true })).toBeVisible({ timeout: 20000 });
      await d.getByRole("button", { name: "Close journal tool drawer", exact: true }).click();
      await d.setViewportSize({ width: 820, height: 1180 });
      await capture(d, "14-medium-chronicle");
      const mediumAccessibility = await new AxeBuilder({ page: d }).include("main").analyze();
      expect(mediumAccessibility.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual(
        [],
      );
      await d.setViewportSize({ width: 1440, height: 1000 });
      await p.setViewportSize({ width: 844, height: 390 });
      await capture(p, "15-phone-landscape");
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await p.setViewportSize({ width: 390, height: 844 });
      const a11y = await new AxeBuilder({ page: p }).include("main").analyze();
      expect(a11y.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual([]);
      await p.getByRole("link", { name: /Return to Chronicle/ }).click();
      await expect(p.getByRole("navigation", { name: "Journal tools", exact: true })).toBeVisible();
      await capture(p, "16-return-to-chronicle");
      expect((await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } })).currentSequence).toBe(
        before.sequence,
      );
      const continueVoyage = p.getByRole("button", { name: "Continue Voyage", exact: true });
      await expect(continueVoyage).toBeEnabled();
      const [continuedResponse] = await Promise.all([
        p.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            new URL(response.url()).pathname === `/api/play/sessions/${voyage.id}`,
        ),
        continueVoyage.click(),
      ]);
      expect(continuedResponse.ok()).toBe(true);
      const continued = (await continuedResponse.json()) as {
        state: {
          session: { id: string; versionId: string; currentSequence: number };
          journal: { currentBlockId: string };
        };
      };
      expect(continued.state).toMatchObject({
        session: { id: voyage.id, versionId: voyage.versionId },
        journal: { currentBlockId: voyage.nextId },
      });
      expect(continued.state.session.currentSequence).toBeGreaterThan(before.sequence);
      await expect(
        p
          .locator(":is(h1,h2,h3,h4,h5,h6):visible")
          .filter({ hasText: /^Voyage complete$/ })
          .first(),
      ).toBeVisible();
      const continuedSession = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
      expect(continuedSession.currentBlockId).toBe(voyage.nextId);
      expect(continuedSession.publishedVersionId).toBe(voyage.versionId);
      expect(continuedSession.currentSequence).toBe(continued.state.session.currentSequence);
      await capture(p, "16-voyage-continued");
      outcomes.CONTINUATION_ACTIVATED = true;
      await revokeAccountSession(account.id, companionSession.id);
      await p.goto(baseURL + "/devices/companion?voyage=" + voyage.id);
      await expect(p).toHaveURL(/\/player\/sign-in\?/);
      await expect(p.getByRole("heading", { name: "Open your Chronicle Library", exact: true })).toBeVisible();
      await expect(p.getByText("The brass compass", { exact: true })).toHaveCount(0);
      await capture(p, "17-access-ended");
      const recoveryAccessibility = await new AxeBuilder({ page: p }).include("main").analyze();
      expect(recoveryAccessibility.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual(
        [],
      );
      expect(await db.playerProfile.count()).toBe(before.personCount);
      expect(await db.playthroughMembership.count()).toBe(before.membershipCount);
      expect((await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } })).currentSequence).toBe(
        continuedSession.currentSequence,
      );
      outcomes.RECOVERY = true;
      await writeFile(
        directory + "/observations.json",
        JSON.stringify(
          {
            motion,
            timings,
            recordings: { desktop: await d.video()?.path(), phone: await p.video()?.path() },
            hardware: "CHROMIUM_EMULATION",
            personAndMembershipUnchanged: true,
            continuation: {
              beforeSequence: before.sequence,
              afterSequence: continuedSession.currentSequence,
              nextBlockId: continuedSession.currentBlockId,
            },
            ownerAcceptance: "NOT_CLAIMED",
          },
          null,
          2,
        ),
      );
    } catch (failure) {
      bodyFailure = failure;
      await capture(p, "failed-phone").catch(() => {});
      await capture(d, "failed-desktop").catch(() => {});
      await writeFile(directory + "/failed-phone.txt", await p.locator("body").innerText()).catch(() => {});
      throw failure;
    } finally {
      const traces = await Promise.allSettled([
        desktop.tracing.stop({ path: directory + "/desktop-trace.zip" }),
        phone.tracing.stop({ path: directory + "/phone-trace.zip" }),
      ]);
      const closed = await Promise.allSettled([desktop.close(), phone.close()]);
      const removed = await Promise.allSettled([removeCrossdeckRefitFixture(fixture)]);
      const errors = [...traces, ...closed, ...removed].flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (errors.length)
        throw new AggregateError(
          bodyFailure === undefined ? errors : [bodyFailure, ...errors],
          "Crossdeck paired case cleanup failed",
        );
    }
    if (pairedBinding) {
      if (test.info().status !== "passed") throw new Error("CROSSDECK_PAIRED_CASE_NOT_PASSED");
      if (!contexts || !databaseSha256) throw new Error("CROSSDECK_PAIRED_CONTEXT_WITNESS_MISSING");
      for (const outcome of ["JOIN_AUTHORIZED", "DELIVERY_ACKNOWLEDGED", "RECOVERY", "CONTINUATION_ACTIVATED"])
        expect(outcomes[outcome]).toBe(true);
      await writeFile(
        directory + "/paired-witness.json",
        JSON.stringify(
          {
            version: 1,
            status: "PASS",
            caseId,
            binding: pairedBinding,
            contexts,
            fixture: { voyageId: voyage.id, editionId: voyage.versionId, databaseSha256 },
            outcomes,
            cleanup: { tracesStopped: true, contextsClosed: true, videosFlushed: true, fixtureRemoved: true },
            media: {
              DESKTOP: {
                screenshots: screenshots.DESKTOP,
                screenshotViewports: screenshotViewports.DESKTOP,
                recording: relativeMedia(await d.video()?.path(), directory),
                trace: "desktop-trace.zip",
              },
              MOBILE: {
                screenshots: screenshots.MOBILE,
                screenshotViewports: screenshotViewports.MOBILE,
                recording: relativeMedia(await p.video()?.path(), directory),
                trace: "phone-trace.zip",
              },
            },
          },
          null,
          2,
        ),
      );
    }
  });
