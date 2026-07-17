import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const campaign = "development-forever-treasure";
const playerPath = `/tale/${campaign}`;
const artifacts = process.env.VALIDATION_ARTIFACTS ?? "artifacts/validation";

async function screenshot(page: Page, name: string) {
  await fs.mkdir(artifacts, { recursive: true });
  await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true, caret: "initial" });
}

async function gmAction(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirm action" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator(".cinematic-command-overlay")).toBeHidden({ timeout: 15_000 });
  await expect(page.locator(".gm-toast")).toContainText("recorded at sequence");
}

async function status(page: Page) {
  const response = await page.request.get("/api/gm/status");
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{
    campaign: { sequence: number; status: string };
    chapter: { state: string };
    events: Array<{ type: string; sequence: number }>;
  }>;
}

async function assertNoSeriousAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual(
    [],
  );
}

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "The full mutation workflow runs once; access gates run in every browser.",
);

test("complete live voyage workflow is private, ordered, resilient, and theatrical", async ({ browser }) => {
  test.setTimeout(180_000);

  const playerContext = await browser.newContext();
  const gmContext = await browser.newContext();
  const player = await playerContext.newPage();
  const gm = await gmContext.newPage();

  const gateResponse = await player.goto(playerPath);
  const gateMarkup = await gateResponse!.text();
  expect(gateMarkup).not.toContain("The Lantern Test");
  expect(gateMarkup).not.toContain("Where painted waves meet borrowed light");
  await screenshot(player, "01-player-access-gate");
  await assertNoSeriousAxeViolations(player);

  await player.getByLabel("Invitation phrase").fill("incorrect-invitation");
  await player.getByRole("button", { name: "Open the journal" }).click();
  await expect(player.locator(".form-error")).toContainText("could not be recognized");
  await player.getByLabel("Invitation phrase").fill(process.env.PLAYER_ACCESS_CODE!);
  await player.getByRole("button", { name: "Open the journal" }).click();
  await expect(player.getByRole("button", { name: "Open the journal" })).toBeVisible();
  await player.getByRole("button", { name: "Open the journal" }).click();
  await expect(player.locator('[data-cinematic-sequence="firstArrival"]')).toBeVisible();
  await expect(player.getByRole("button", { name: "Skip ceremony" })).toBeVisible({ timeout: 3_000 });
  await player.getByRole("button", { name: "Skip ceremony" }).click();
  await expect(player.getByRole("heading", { name: "The Voyage Journal" })).toBeVisible();
  await expect(player.getByText("Await the captain's signal.", { exact: true })).toBeVisible();
  await expect(player.getByText(/Where painted waves meet borrowed light/)).toHaveCount(0);
  await expect(player.getByText("Tide connected")).toBeVisible();
  await screenshot(player, "02-sealed-journal");

  await gm.goto("/quartermaster");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await gm.request.post("/api/gm/login", {
      data: { username: "rate-limit-probe", password: "wrong-password" },
    });
    expect(response.status()).toBe(401);
  }
  const limited = await gm.request.post("/api/gm/login", {
    data: { username: "rate-limit-probe", password: "wrong-password" },
  });
  expect(limited.status()).toBe(429);
  await gm.getByLabel("Captain's name").fill(process.env.GM_USERNAME!);
  await gm.getByLabel("Passphrase").fill("definitely-wrong");
  await gm.getByRole("button", { name: "Enter the chart room" }).click();
  await expect(gm.locator(".form-error")).toContainText("does not recognize");
  await gm.getByLabel("Passphrase").fill(process.env.GM_PASSWORD!);
  await gm.getByRole("button", { name: "Enter the chart room" }).click();
  await expect(gm.getByRole("heading", { name: "Quartermaster's Log" })).toBeVisible();
  await expect(gm.getByText("Sequence 0")).toBeVisible();
  const gmCookie = (await gmContext.cookies()).find((cookie) => cookie.name === "forever_gm");
  expect(gmCookie).toMatchObject({ httpOnly: true, sameSite: "Strict" });
  expect((await playerContext.cookies()).some((cookie) => cookie.name === "forever_gm")).toBeFalsy();
  await assertNoSeriousAxeViolations(gm);
  await screenshot(gm, "03-quartermaster-dashboard");

  await gmAction(gm, "Prepare Chapter");
  await expect(gm.getByText("READY", { exact: true }).first()).toBeVisible();
  await expect(player.getByText(/Where painted waves meet borrowed light/)).toHaveCount(0);

  const releasedAt = Date.now();
  await gm.getByRole("button", { name: "Release Chapter", exact: true }).click();
  await expect(gm.getByRole("dialog")).toBeVisible();
  await gm.getByRole("button", { name: "Confirm action" }).click();
  await expect(player.locator(".voyage-shell.stage-seal")).toBeVisible({ timeout: 10_000 });
  await screenshot(player, "04-ceremony-seal-break");
  await expect(player.locator(".voyage-shell.stage-parchment")).toBeVisible();
  await screenshot(player, "05-ceremony-parchment");
  await expect(player.locator(".voyage-shell.stage-ink-story")).toBeVisible();
  await screenshot(player, "06-ceremony-ink-reveal");
  await expect(gm.getByRole("dialog")).toBeHidden();
  await expect(player.getByRole("button", { name: "Replay ceremony" })).toBeVisible({ timeout: 12_000 });
  expect(Date.now() - releasedAt).toBeGreaterThanOrEqual(5_000);
  expect(Date.now() - releasedAt).toBeLessThan(10_000);
  await expect(player.getByRole("heading", { name: "The Lantern Test" })).toBeVisible();
  await player.getByRole("button", { name: "Next journal page" }).click();
  await expect(
    player.getByLabel("Physical journal pages").getByText(/Where painted waves meet borrowed light/),
  ).toBeVisible();
  await screenshot(player, "07-active-chapter");
  await assertNoSeriousAxeViolations(player);

  await player.getByRole("button", { name: "Chart", exact: true }).click();
  await expect(player.getByRole("heading", { name: "Voyage Chart" })).toBeVisible();
  await expect(player.locator("[data-section-heading]")).toBeFocused();
  await expect(player).toHaveURL(/section=chart/);
  await player.goBack();
  await expect(player.getByRole("heading", { name: "The Voyage Journal" })).toBeVisible();
  await expect(player.locator("[data-section-heading]")).toBeFocused();

  const beforeReplay = (await status(gm)).campaign.sequence;
  await player.getByRole("button", { name: "Replay ceremony" }).click();
  await expect(player.getByRole("button", { name: "Reveal all now" })).toBeVisible();
  await player.getByRole("button", { name: "Reveal all now" }).click();
  await expect(player.getByRole("button", { name: "Replay ceremony" })).toBeVisible();
  expect((await status(gm)).campaign.sequence).toBe(beforeReplay);

  await player.getByRole("button", { name: "Sound on" }).click();
  await expect(player.getByRole("button", { name: "Sound off" })).toHaveAttribute("aria-pressed", "true");
  await player.getByRole("button", { name: "Motion: full. Change motion setting" }).click();
  const gentleStarted = Date.now();
  await player.getByRole("button", { name: "Replay ceremony" }).click();
  await expect(player.getByRole("button", { name: "Replay ceremony" })).toBeVisible({ timeout: 6_000 });
  expect(Date.now() - gentleStarted).toBeGreaterThan(1_000);
  expect(Date.now() - gentleStarted).toBeLessThan(5_500);

  await player.reload();
  await expect(player.getByRole("button", { name: "Open the journal" })).toBeVisible();
  await player.getByRole("button", { name: "Open the journal" }).click();
  await expect(player.getByRole("heading", { name: "The Lantern Test" })).toBeVisible();
  await expect(player.getByText("Releasing the first seal")).toHaveCount(0);

  await gmAction(gm, "Award Test Artifact");
  await player.getByRole("button", { name: /Altar/ }).click();
  await expect(player.getByRole("heading", { name: "Treasure Altar" })).toBeVisible();
  await expect(player.getByRole("button", { name: /awarded$/i })).toBeVisible();
  await player.getByRole("button", { name: "Chart", exact: true }).click();
  await gmAction(gm, "Reveal Test Map Location");
  await expect(player.locator(".map-alternative").getByText("Moonwake Cay", { exact: true }).first()).toBeVisible();

  await gmAction(gm, "Mark Chapter Solved");
  await gm.getByRole("button", { name: "Mark Chapter Solved", exact: true }).click();
  await gm.getByRole("button", { name: "Confirm action" }).click();
  await expect(gm.locator(".form-error")).toContainText("Only an active chapter");
  await gm.getByRole("button", { name: "Cancel" }).click();
  await gmAction(gm, "Undo Last Progression Action");
  await expect(gm.getByText("ACTIVE", { exact: true }).first()).toBeVisible();

  await playerContext.setOffline(true);
  await player.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(player.getByText("Signal adrift")).toBeVisible({ timeout: 10_000 });
  await gmAction(gm, "Pause Campaign");
  await gmAction(gm, "Resume Campaign");
  await playerContext.setOffline(false);
  await player.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(player.getByText("Tide connected")).toBeVisible({ timeout: 20_000 });
  await player.getByRole("button", { name: "Journal", exact: true }).click();
  await expect(player.getByRole("heading", { name: "The Lantern Test" })).toBeVisible();
  expect((await status(gm)).campaign.status).toBe("ACTIVE");

  const heartbeat = await player.evaluate(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(`/api/player/${location.pathname.split("/").at(-1)}/events?after=999999`, {
        signal: controller.signal,
      });
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let output = "";
      while (!output.includes("event: heartbeat")) output += decoder.decode((await reader.read()).value);
      return output.includes("event: heartbeat");
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  });
  expect(heartbeat).toBeTruthy();

  for (const [width, height, name] of [
    [2560, 1440, "desktop-2560"],
    [1920, 1080, "desktop-1920"],
    [1440, 900, "desktop-1440"],
    [390, 844, "mobile-390"],
    [430, 932, "mobile-430"],
    [844, 390, "landscape-844"],
  ] as const) {
    await player.setViewportSize({ width, height });
    await screenshot(player, `08-${name}`);
  }
});
