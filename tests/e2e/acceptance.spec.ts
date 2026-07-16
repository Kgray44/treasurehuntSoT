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
  expect(gateMarkup).not.toContain("The First Seal");
  expect(gateMarkup).not.toContain("Where weary crews return from foam");
  await screenshot(player, "01-player-access-gate");
  await assertNoSeriousAxeViolations(player);

  await player.getByLabel("Invitation phrase").fill("incorrect-invitation");
  await player.getByRole("button", { name: "Open the journal" }).click();
  await expect(player.locator(".form-error")).toContainText("could not be recognized");
  await player.getByLabel("Invitation phrase").fill(process.env.PLAYER_ACCESS_CODE!);
  await player.getByRole("button", { name: "Open the journal" }).click();
  await expect(player.getByRole("button", { name: "Open the journal" })).toBeVisible();
  await player.getByRole("button", { name: "Open the journal" }).click();
  await expect(player.getByRole("heading", { name: "Awaiting the captain’s signal" })).toBeVisible();
  await expect(player.getByText("Where weary crews return from foam")).toHaveCount(0);
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
  await gm.getByLabel("Captain’s name").fill(process.env.GM_USERNAME!);
  await gm.getByLabel("Passphrase").fill("definitely-wrong");
  await gm.getByRole("button", { name: "Enter the chart room" }).click();
  await expect(gm.locator(".form-error")).toContainText("does not recognize");
  await gm.getByLabel("Passphrase").fill(process.env.GM_PASSWORD!);
  await gm.getByRole("button", { name: "Enter the chart room" }).click();
  await expect(gm.getByRole("heading", { name: "Quartermaster’s Log" })).toBeVisible();
  await expect(gm.getByText("Sequence 0")).toBeVisible();
  const gmCookie = (await gmContext.cookies()).find((cookie) => cookie.name === "forever_gm");
  expect(gmCookie).toMatchObject({ httpOnly: true, sameSite: "Strict" });
  expect((await playerContext.cookies()).some((cookie) => cookie.name === "forever_gm")).toBeFalsy();
  await assertNoSeriousAxeViolations(gm);
  await screenshot(gm, "03-quartermaster-dashboard");

  await gmAction(gm, "Prepare Chapter");
  await expect(gm.getByText("READY", { exact: true }).first()).toBeVisible();
  await expect(player.getByText("Where weary crews return from foam")).toHaveCount(0);

  const releasedAt = Date.now();
  await gmAction(gm, "Release Chapter");
  await expect(player.locator(".voyage-shell.stage-seal")).toBeVisible({ timeout: 5_000 });
  await screenshot(player, "04-ceremony-seal-break");
  await expect(player.locator(".voyage-shell.stage-parchment")).toBeVisible();
  await screenshot(player, "05-ceremony-parchment");
  await expect(player.locator(".voyage-shell.stage-ink-story")).toBeVisible();
  await screenshot(player, "06-ceremony-ink-reveal");
  await expect(player.getByRole("button", { name: "Replay ceremony" })).toBeVisible({ timeout: 12_000 });
  expect(Date.now() - releasedAt).toBeGreaterThanOrEqual(5_000);
  expect(Date.now() - releasedAt).toBeLessThan(10_000);
  await expect(player.getByRole("heading", { name: "The First Seal" })).toBeVisible();
  await expect(player.getByText("Where weary crews return from foam")).toBeVisible();
  await screenshot(player, "07-active-chapter");
  await assertNoSeriousAxeViolations(player);

  const beforeReplay = (await status(gm)).campaign.sequence;
  await player.getByRole("button", { name: "Replay ceremony" }).click();
  await expect(player.getByRole("button", { name: "Reveal all now" })).toBeVisible();
  await player.getByRole("button", { name: "Reveal all now" }).click();
  await expect(player.getByRole("button", { name: "Replay ceremony" })).toBeVisible();
  expect((await status(gm)).campaign.sequence).toBe(beforeReplay);

  await player.getByRole("button", { name: "Sound on" }).click();
  await expect(player.getByRole("button", { name: "Sound off" })).toHaveAttribute("aria-pressed", "true");
  await player.getByRole("button", { name: "Gentle motion" }).click();
  const gentleStarted = Date.now();
  await player.getByRole("button", { name: "Replay ceremony" }).click();
  await expect(player.getByRole("button", { name: "Replay ceremony" })).toBeVisible({ timeout: 4_000 });
  expect(Date.now() - gentleStarted).toBeLessThan(3_000);

  await player.reload();
  await expect(player.getByRole("button", { name: "Open the journal" })).toBeVisible();
  await player.getByRole("button", { name: "Open the journal" }).click();
  await expect(player.getByRole("heading", { name: "The First Seal" })).toBeVisible();
  await expect(player.getByText("Releasing the first seal")).toHaveCount(0);

  await gmAction(gm, "Award Test Artifact");
  await expect(player.getByText("The Broken Compass Needle")).toBeVisible();
  await gm.getByRole("button", { name: "Award Test Artifact", exact: true }).click();
  await gm.getByRole("button", { name: "Confirm action" }).click();
  await expect(gm.locator(".form-error")).toContainText("already been awarded");
  await gm.getByRole("button", { name: "Cancel" }).click();
  await gm.getByRole("button", { name: "Reveal Test Map Location", exact: true }).click();
  await gm.getByRole("button", { name: "Confirm action" }).click();
  await expect(gm.locator(".form-error")).toContainText("already been revealed");
  await gm.getByRole("button", { name: "Cancel" }).click();

  await gmAction(gm, "Mark Chapter Solved");
  await gm.getByRole("button", { name: "Mark Chapter Solved", exact: true }).click();
  await expect(gm.getByText("Only the active chapter can be solved.")).toBeVisible();
  await expect(gm.getByRole("button", { name: "Confirm action" })).toBeDisabled();
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
  await expect(player.getByRole("heading", { name: "The First Seal" })).toBeVisible();
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

  await playerContext.close();
  await gmContext.close();
});
