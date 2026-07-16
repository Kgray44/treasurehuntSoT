import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const artifactRoot = process.env.VALIDATION_ARTIFACTS ?? "artifacts/validation";
async function capture(page: import("@playwright/test").Page, name: string) {
  const directory = path.join(artifactRoot, "command-center");
  await fs.mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true, caret: "initial" });
}

test("preview is nonmutating, stale commands conflict, and idempotency replays safely", async ({ page }) => {
  await page.goto("/quartermaster");
  await page.getByLabel("Captain’s name").fill(process.env.GM_USERNAME!);
  await page.getByLabel("Passphrase").fill(process.env.GM_PASSWORD!);
  await page.getByRole("button", { name: "Enter the chart room" }).click();
  await expect(page.getByRole("heading", { name: "The Forever Treasure" })).toBeVisible();

  const before = await (await page.request.get("/api/gm/status")).json();
  const preview = await page.request.post("/api/gm/preview", {
    data: {
      command: "REQUEST_RECONCILIATION",
      campaignSlug: before.campaign.slug,
      expectedSequence: before.campaign.sequence,
      payload: {},
      preview: true,
    },
  });
  expect(preview.ok()).toBeTruthy();
  expect((await preview.json()).watermark).toBe("PREVIEW — NOT RELEASED");
  const afterPreview = await (await page.request.get("/api/gm/status")).json();
  expect(afterPreview.campaign.sequence).toBe(before.campaign.sequence);

  const stale = await page.request.post("/api/gm/commands", {
    headers: { "x-csrf-token": before.csrfToken },
    data: {
      command: "REQUEST_RECONCILIATION",
      campaignSlug: before.campaign.slug,
      expectedSequence: before.campaign.sequence + 1,
      idempotencyKey: crypto.randomUUID(),
      payload: {},
      confirmation: true,
    },
  });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).code).toBe("STALE_SEQUENCE");

  const key = crypto.randomUUID();
  const request = {
    command: "REQUEST_RECONCILIATION",
    campaignSlug: before.campaign.slug,
    expectedSequence: before.campaign.sequence,
    idempotencyKey: key,
    payload: {},
    confirmation: true,
  };
  const first = await page.request.post("/api/gm/commands", {
    headers: { "x-csrf-token": before.csrfToken },
    data: request,
  });
  expect(first.ok()).toBeTruthy();
  const replay = await page.request.post("/api/gm/commands", {
    headers: { "x-csrf-token": before.csrfToken },
    data: request,
  });
  expect(replay.ok()).toBeTruthy();
  expect((await replay.json()).idempotentReplay).toBe(true);
});

test("workspace routes remain authenticated, responsive, and accessible", async ({ page, browserName }) => {
  await page.goto("/quartermaster");
  await page.getByLabel("Captain’s name").fill(process.env.GM_USERNAME!);
  await page.getByLabel("Passphrase").fill(process.env.GM_PASSWORD!);
  await page.getByRole("button", { name: "Enter the chart room" }).click();
  await expect(page.getByRole("heading", { name: "The Forever Treasure" })).toBeVisible();
  for (const workspace of [
    "chapters",
    "hints",
    "voyage",
    "artifacts",
    "quests",
    "journal",
    "events",
    "player-view",
    "recovery",
    "audit",
    "diagnostics",
  ]) {
    await page.goto(`/quartermaster/${workspace}`);
    await expect(page.locator("#command-workspace")).toBeVisible();
    await capture(page, `${browserName}-workspace-${workspace}`);
  }
  await page.goto("/quartermaster/player-view");
  await expect(page.getByText("PLAYER VIEW — ACTUAL RELEASED STATE")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  await page.setViewportSize({ width: 430, height: 932 });
  await expect(page.getByRole("navigation", { name: "Emergency controls" })).toBeVisible();
  await capture(page, `${browserName}-emergency-430x932`);
  for (const [width, height, name] of [
    [2560, 1440, "deck-2560x1440"],
    [1920, 1080, "deck-1920x1080"],
    [1440, 900, "deck-1440x900"],
    [1280, 800, "deck-1280x800"],
    [1194, 834, "deck-tablet-landscape"],
    [834, 1194, "deck-tablet-portrait"],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/quartermaster");
    await expect(page.locator("#command-workspace")).toBeVisible();
    await capture(page, `${browserName}-${name}`);
  }
});
