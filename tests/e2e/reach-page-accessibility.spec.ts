// @sounding-line-registration owner=reach suite=browser.reach contracts=reach.phase1.foundation
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { db } from "../../src/lib/db";
import { authenticateClosure, closureAccount } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
] as const;
const motionModes = ["no-preference", "reduce"] as const;
const reachStatus = (page: Page) => page.getByRole("status", { name: "Reach status", exact: true });

async function settled(page: Page, pathname: "/devices/pair" | "/devices/reach") {
  await expect(page).toHaveURL(new RegExp(`${pathname}$`));
  await expect
    .poll(() =>
      page.evaluate((route) => {
        const layer = document.querySelector(`[data-route-layer="${route}"]`);
        return layer?.closest("[data-route-state]")?.getAttribute("data-route-state") ?? null;
      }, pathname),
    )
    .toBe("settled");
}

async function tabTo(page: Page, target: Locator, reverse = false) {
  for (let count = 0; count < 40; count += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press(reverse ? "Shift+Tab" : "Tab");
  }
  await expect(target).toBeFocused();
}

async function auditWholePage(
  page: Page,
  info: TestInfo,
  checkpoint: string,
  pointingPlane = false,
  planeFocusAtEntry = false,
) {
  const route = new URL(page.url()).pathname;
  if (pointingPlane) {
    const group = page.getByRole("group", { name: "Pointing practice area", exact: true });
    const count = await group.count();
    expect.soft(count, `${route} ${checkpoint}: the visible pointing plane has a named group role`).toBe(1);
    if (planeFocusAtEntry && count === 1) await expect.soft(group).toBeFocused();
  }
  // No include/exclude, tag selection, impact filter, or disabled rules: these
  // observations include the complete page and the default best-practice rules.
  const axe = await new AxeBuilder({ page }).analyze();
  const headings = await page
    .getByRole("heading", { level: 1 })
    .evaluateAll((elements) =>
      elements.map((element) => ({ nativeH1: element.tagName === "H1", inMain: Boolean(element.closest("main")) })),
    );
  const mains = await page
    .getByRole("main")
    .evaluateAll((elements) => elements.map((element) => element.tagName === "MAIN"));
  const nestedComplementary = await page
    .getByRole("complementary")
    .evaluateAll(
      (elements) =>
        elements.filter((element) =>
          element.parentElement?.closest("main, aside, nav, [role='main'], [role='region'], [role='complementary']"),
        ).length,
    );
  const unnamedRegions = await page.getByRole("region").evaluateAll(
    (elements) =>
      elements.filter((element) => {
        const label = element.getAttribute("aria-label")?.trim();
        const labelledBy = element.getAttribute("aria-labelledby")?.trim().split(/\s+/) ?? [];
        return !label && !labelledBy.some((id) => document.getElementById(id)?.textContent?.trim());
      }).length,
  );
  const videos = await page.locator("video").evaluateAll((elements) =>
    elements.map((element) => {
      const video = element as HTMLVideoElement;
      return {
        muted: video.muted,
        defaultMuted: video.defaultMuted,
        mediaStream: video.srcObject instanceof MediaStream,
        audioTracks: video.srcObject instanceof MediaStream ? video.srcObject.getAudioTracks().length : null,
      };
    }),
  );
  const incomplete = axe.incomplete.map((rule) => ({
    id: rule.id,
    impact: rule.impact,
    nodes: rule.nodes.length,
    disposition: "UNVERIFIED_REQUIRES_REVIEW",
  }));
  info.annotations.push({
    type: "FULL_PAGE_ACCESSIBILITY_OBSERVATION",
    description: JSON.stringify({ route, checkpoint, violations: axe.violations.length, incomplete, videos }),
  });
  // Raw results are private test evidence. Incomplete contrast/caption checks
  // are not passed checks or a physical-camera/screen-reader qualification.
  await info.attach(`reach-full-page-${checkpoint}.json`, {
    body: Buffer.from(JSON.stringify({ route, checkpoint, axe, headings, mains, videos }, null, 2)),
    contentType: "application/json",
  });
  const label = `${route} ${checkpoint}`;
  expect
    .soft(
      axe.violations.map(({ id, impact }) => ({ id, impact })),
      `${label}: all axe rule impacts`,
    )
    .toEqual([]);
  expect.soft(headings.length, `${label}: one exposed native page heading`).toBe(1);
  expect
    .soft(
      headings.every((heading) => heading.nativeH1 && heading.inMain),
      `${label}: native H1 in main`,
    )
    .toBe(true);
  expect.soft(mains, `${label}: one exposed native main`).toEqual([true]);
  expect.soft(nestedComplementary, `${label}: complementary landmarks are top level`).toBe(0);
  expect.soft(unnamedRegions, `${label}: exposed regions have names`).toBe(0);
  expect
    .soft(
      videos.every((video) => video.muted),
      `${label}: local preview is muted`,
    )
    .toBe(true);
  expect
    .soft(
      videos.every((video) => !video.mediaStream || video.audioTracks === 0),
      `${label}: active D0 preview streams contain no audio tracks`,
    )
    .toBe(true);
}

async function enterReach(page: Page) {
  await page.getByRole("link", { name: "Find the Hand interaction laboratory", exact: true }).click();
  await settled(page, "/devices/reach");
  await expect(page.getByRole("heading", { name: "Find your point.", exact: true })).toBeVisible();
}

async function startDemo(page: Page, mode: "ABSOLUTE" | "RELATIVE") {
  await page.getByRole("button", { name: "Explore guided demo", exact: true }).click();
  await expect(reachStatus(page)).toContainText("Your hand is ready");
  await page.getByRole("radio", { name: mode === "ABSOLUTE" ? /Absolute pointing/ : /Relative movement/ }).check();
}

async function finishTargets(page: Page, count: number) {
  for (let index = 0; index < count; index += 1) {
    await expect(page.getByLabel(`Target ${index + 1} of ${count}`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Move demo hand to target", exact: true }).click();
    if (index < count - 1) {
      await expect(page.getByLabel(`Target ${index + 2} of ${count}`, { exact: true })).toBeVisible({ timeout: 7000 });
    }
  }
  await expect(page.getByRole("button", { name: "Recalibrate", exact: true })).toBeVisible({ timeout: 7000 });
}

async function returnByKeyboard(page: Page) {
  await tabTo(page, page.getByRole("link", { name: "← Device connections", exact: true }));
  await page.keyboard.press("Enter");
  await settled(page, "/devices/pair");
  await expect(page.getByRole("heading", { name: "Bring your other device aboard", exact: true })).toBeVisible();
}

test.afterAll(() => db.$disconnect());

for (const viewport of viewports) {
  for (const reducedMotion of motionModes) {
    test(`whole Reach pages expose all accessibility observations: ${viewport.name}, ${reducedMotion}`, async ({
      page,
    }, info) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion });
      await page.goto("/devices/pair");
      await settled(page, "/devices/pair");
      await expect(page.getByRole("heading", { name: "Bring your other device aboard", exact: true })).toBeVisible();
      await auditWholePage(page, info, "PAIR_INITIAL");

      const skip = page.getByRole("link", { name: "Skip to main content", exact: true });
      await tabTo(page, skip, true);
      await page.keyboard.press("Enter");
      await expect(page.locator("#main-content")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Find the Hand interaction laboratory", exact: true })).toBeFocused();
      await page.keyboard.press("Enter");
      await settled(page, "/devices/reach");
      await auditWholePage(page, info, "WELCOME");

      await startDemo(page, "ABSOLUTE");
      await auditWholePage(page, info, "TRACKING");
      await page.getByRole("button", { name: "Begin nine-point calibration", exact: true }).click();
      await expect(page.getByLabel("Target 1 of 9", { exact: true })).toBeVisible();
      await auditWholePage(page, info, "TRAINING", true, true);
      await page.getByRole("button", { name: "Pause calibration", exact: true }).click();
      await expect(page.getByRole("button", { name: "Resume calibration", exact: true })).toBeVisible();
      await auditWholePage(page, info, "PAUSED", true);
      await page.getByRole("button", { name: "Resume calibration", exact: true }).click();
      await finishTargets(page, 9);
      await expect(page.getByRole("button", { name: "Check five new targets", exact: true })).toBeVisible();
      await auditWholePage(page, info, "FIT_READY", true);
      await page.getByRole("button", { name: "Check five new targets", exact: true }).click();
      await expect(page.getByLabel("Target 1 of 5", { exact: true })).toBeVisible();
      await auditWholePage(page, info, "VALIDATION", true);
      await finishTargets(page, 5);
      await expect(page.getByText("Your independent check passed for this session.", { exact: true })).toBeVisible();
      await auditWholePage(page, info, "RESULTS", true);
      await page.getByRole("button", { name: "Open pointing playground", exact: true }).click();
      await page.getByRole("button", { name: "Show a practice target", exact: true }).click();
      await page.getByRole("button", { name: "Move demo hand to target", exact: true }).click();
      await auditWholePage(page, info, "PLAYGROUND", true);
      await page.getByLabel("Demo tracking condition", { exact: true }).selectOption("TWO_HANDS");
      await expect(reachStatus(page)).toContainText("2 detected");
      await auditWholePage(page, info, "MULTIPLE_HANDS", true);
      await page.getByLabel("Demo tracking condition", { exact: true }).selectOption("EDGE");
      await expect(reachStatus(page)).toContainText("Move your hand slightly toward the center");
      await auditWholePage(page, info, "DETECTED_INELIGIBLE", true);
      await returnByKeyboard(page);
      await auditWholePage(page, info, "RETURNED");

      await enterReach(page);
      await startDemo(page, "RELATIVE");
      await page.getByRole("button", { name: "Set up relative movement", exact: true }).click();
      await expect(page.getByLabel("Target 1 of 5", { exact: true })).toBeVisible();
      await auditWholePage(page, info, "RELATIVE_TRAINING", true);
      await finishTargets(page, 5);
      await page.getByRole("button", { name: "Check five new targets", exact: true }).click();
      await expect(page.getByLabel("Target 1 of 5", { exact: true })).toBeVisible();
      await auditWholePage(page, info, "RELATIVE_VALIDATION", true);
      await finishTargets(page, 5);
      await expect(page.getByText("Cursor error on new targets", { exact: true })).toBeVisible();
      await auditWholePage(page, info, "RELATIVE_RESULTS", true);
      await returnByKeyboard(page);

      // Existing bounded capability-failure fixture; no auth/session or route mock.
      await page.addInitScript(() =>
        Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
          value: async () => {
            throw new DOMException("", "NotAllowedError");
          },
        }),
      );
      await page.goto("/devices/pair");
      await settled(page, "/devices/pair");
      await enterReach(page);
      await page.getByRole("button", { name: "Enable live camera", exact: true }).click();
      await expect(reachStatus(page)).toContainText("Camera access was declined");
      await auditWholePage(page, info, "CAMERA_UNAVAILABLE");
      await page.getByRole("button", { name: "Explore guided demo", exact: true }).click();
      await expect(reachStatus(page)).toContainText("Your hand is ready");
      await auditWholePage(page, info, "FALLBACK_TRACKING");
      await returnByKeyboard(page);
      await auditWholePage(page, info, "FALLBACK_RETURNED");
    });

    test(`signed-in empty device page exposes full accessibility observations: ${viewport.name}, ${reducedMotion}`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      test.setTimeout(120000);
      ensureGenericSoundingLineIsolation();
      if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic")
        throw new Error("REACH_OWNED_BROWSER_DATABASE_REQUIRED");
      if (!baseURL) throw new Error("REACH_OWNED_BROWSER_BASE_URL_REQUIRED");
      let accountId: string | undefined;
      try {
        const account = await closureAccount("Reach accessibility synthetic navigator");
        accountId = account.id;
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ reducedMotion });
        await authenticateClosure(context, account, baseURL);
        await page.goto(new URL("/devices/pair", baseURL).href);
        await settled(page, "/devices/pair");
        const devices = page.getByRole("region", { name: "Voyage devices", exact: true });
        await expect(devices.getByRole("status")).toHaveText(
          "Choose a Voyage or enter the code from your other screen.",
        );
        await expect(page.getByRole("link", { name: "Sign in to connect", exact: true })).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: "Reach accessibility synthetic navigator", exact: true }),
        ).toBeVisible();
        await auditWholePage(page, info, "PAIR_SIGNED_IN_EMPTY");
      } finally {
        try {
          await page.close();
        } finally {
          if (accountId) await db.userAccount.delete({ where: { id: accountId } });
        }
      }
    });
  }
}
