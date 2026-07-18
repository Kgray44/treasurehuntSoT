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

test("targeted commands preserve side-quest order and audit staged work", async ({ page, browserName }) => {
  test.skip(
    browserName !== "chromium",
    "The shared-database mutation workflow runs once to avoid cross-project contention.",
  );
  await page.goto("/quartermaster");
  await page.getByLabel("Captain’s name").fill(process.env.GM_USERNAME!);
  await page.getByLabel("Passphrase").fill(process.env.GM_PASSWORD!);
  await page.getByRole("button", { name: "Enter the chart room" }).click();
  await expect(page.getByRole("heading", { name: "The Forever Treasure" })).toBeVisible();

  let status = await (await page.request.get("/api/gm/status")).json();
  const hiddenQuest = status.sideQuests.find((item: { state: string }) => item.state === "HIDDEN");
  expect(hiddenQuest).toBeTruthy();
  const invalidPreview = await page.request.post("/api/gm/preview", {
    data: {
      command: "ADVANCE_SIDE_QUEST",
      campaignSlug: status.campaign.slug,
      expectedSequence: status.campaign.sequence,
      targetKey: hiddenQuest.key,
      payload: {},
      preview: true,
    },
  });
  expect(invalidPreview.ok()).toBeTruthy();
  expect(await invalidPreview.json()).toMatchObject({
    canExecute: false,
    prerequisites: ["Discover the side quest before advancing it."],
  });

  async function command(command: string, targetKey?: string) {
    status = await (await page.request.get("/api/gm/status")).json();
    const response = await page.request.post("/api/gm/commands", {
      headers: { "x-csrf-token": status.csrfToken },
      data: {
        command,
        campaignSlug: status.campaign.slug,
        expectedSequence: status.campaign.sequence,
        idempotencyKey: crypto.randomUUID(),
        targetKey,
        payload: {},
        confirmation: true,
      },
    });
    const body = await response.json();
    expect(response.ok(), JSON.stringify(body)).toBeTruthy();
    return body;
  }

  const discovered = await command("DISCOVER_SIDE_QUEST", hiddenQuest.key);
  expect(discovered.event).toMatchObject({
    type: "SIDE_QUEST_DISCOVERED",
    payload: { key: hiddenQuest.key },
  });
  expect((await command("ADVANCE_SIDE_QUEST", hiddenQuest.key)).event.type).toBe("SIDE_QUEST_UPDATED");
  expect((await command("ADVANCE_SIDE_QUEST", hiddenQuest.key)).event).toMatchObject({
    type: "SIDE_QUEST_UPDATED",
    payload: { key: hiddenQuest.key, objectiveOrdinal: 1 },
  });
  expect((await command("ADVANCE_SIDE_QUEST", hiddenQuest.key)).event).toMatchObject({
    type: "SIDE_QUEST_COMPLETED",
    payload: { key: hiddenQuest.key },
  });

  status = await (await page.request.get("/api/gm/status")).json();
  const mapTarget = status.mapLocations.find((item: { revealedAt: string | null }) => !item.revealedAt);
  expect(mapTarget).toBeTruthy();
  const mapResult = await command("REVEAL_MAP", mapTarget.key);
  expect(mapResult.event.payload.key).toBe(mapTarget.key);
  status = await (await page.request.get("/api/gm/status")).json();
  expect(
    status.audit.some(
      (entry: { action: string; correlationId: string | null }) =>
        entry.action === "REVEAL_MAP" && entry.correlationId === mapResult.correlationId,
    ),
  ).toBe(true);

  const artifactTarget = status.artifacts.find((item: { awarded: boolean }) => !item.awarded);
  expect(artifactTarget).toBeTruthy();
  const artifactResult = await command("AWARD_ARTIFACT", artifactTarget.key);
  expect(artifactResult.event.payload.key).toBe(artifactTarget.key);

  status = await (await page.request.get("/api/gm/status")).json();
  const staged = await page.request.post("/api/gm/staging", {
    headers: { "x-csrf-token": status.csrfToken },
    data: {
      command: "PREPARE_CHAPTER",
      campaignSlug: status.campaign.slug,
      expectedSequence: status.campaign.sequence,
      payload: {},
    },
  });
  const stagedBody = await staged.json();
  expect(staged.ok(), JSON.stringify(stagedBody)).toBeTruthy();
  status = await (await page.request.get("/api/gm/status")).json();
  expect(
    status.audit.some((entry: { action: string; metadata?: Record<string, unknown> }) => {
      return entry.action === "PREPARE_CHAPTER_STAGED" && entry.metadata?.preparedActionId === stagedBody.staged.id;
    }),
  ).toBe(true);
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
