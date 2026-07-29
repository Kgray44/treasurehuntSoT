import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const artifactRoot = process.env.VALIDATION_ARTIFACTS ?? "artifacts/validation";

type BrowserFetchInit = Readonly<{
  method?: "GET" | "POST";
  headers?: Readonly<Record<string, string>>;
  body?: unknown;
}>;

type CaptainStatus = {
  campaign: { slug: string; sequence: number };
  csrfToken: string;
  events: Array<{ id: string; sequence: number; type: string }>;
  audit: Array<{ action: string; correlationId: string | null; metadata?: Record<string, unknown> }>;
};

type CommandResult = {
  event: { id: string; sequence: number; type: string };
  correlationId: string;
};

async function capture(page: Page, name: string) {
  const directory = path.join(artifactRoot, "command-center");
  await fs.mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true, caret: "initial" });
}

async function enterCaptainConsole(page: Page) {
  await page.goto("/captain/sign-in");
  await expect(page.getByRole("heading", { name: "Enter Captain's Console" })).toBeVisible();
  await page.getByLabel("Username").fill(process.env.GM_USERNAME!);
  await page.getByLabel("Password").fill(process.env.GM_PASSWORD!);
  await page.getByRole("button", { name: "Enter Captain's Console" }).click();
  await expect(page).toHaveURL(/\/captain\/library(?:\?.*)?$/u);
  await expect(page.getByRole("heading", { name: "Captain's Console", exact: true })).toBeVisible();
}

async function browserJson<T>(page: Page, url: string, init?: BrowserFetchInit) {
  return page.evaluate(
    async ({ requestUrl, requestInit }) => {
      const headers = {
        ...(requestInit?.body === undefined ? {} : { "content-type": "application/json" }),
        ...(requestInit?.headers ?? {}),
      };
      const response = await fetch(requestUrl, {
        method: requestInit?.method,
        credentials: "same-origin",
        headers,
        body: requestInit?.body === undefined ? undefined : JSON.stringify(requestInit.body),
      });
      const text = await response.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        // Non-JSON error contracts remain inspectable by the caller.
      }
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body,
      };
    },
    { requestUrl: url, requestInit: init },
  ) as Promise<{ status: number; headers: Record<string, string>; body: T }>;
}

async function captainStatus(page: Page) {
  const result = await browserJson<CaptainStatus>(page, "/api/gm/status");
  expect(result.status).toBe(200);
  return result.body;
}

test("preview is nonmutating, stale commands conflict, and idempotency replays safely", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "The shared-database mutation workflow runs once to avoid cross-project contention.",
  );
  await enterCaptainConsole(page);

  const before = await captainStatus(page);
  const preview = await browserJson<{ watermark: string }>(page, "/api/gm/preview", {
    method: "POST",
    body: {
      command: "REQUEST_RECONCILIATION",
      campaignSlug: before.campaign.slug,
      expectedSequence: before.campaign.sequence,
      payload: {},
      preview: true,
    },
  });
  expect(preview.status).toBe(200);
  expect(preview.body.watermark).toBe("PREVIEW — NOT RELEASED");
  const afterPreview = await captainStatus(page);
  expect(afterPreview.campaign.sequence).toBe(before.campaign.sequence);

  const stale = await browserJson<{ code: string }>(page, "/api/gm/commands", {
    method: "POST",
    headers: { "x-csrf-token": before.csrfToken },
    body: {
      command: "REQUEST_RECONCILIATION",
      campaignSlug: before.campaign.slug,
      expectedSequence: before.campaign.sequence + 1,
      idempotencyKey: crypto.randomUUID(),
      payload: {},
      confirmation: true,
    },
  });
  expect(stale.status).toBe(409);
  expect(stale.body.code).toBe("STALE_SEQUENCE");
  expect((await captainStatus(page)).campaign.sequence).toBe(before.campaign.sequence);

  const request = {
    command: "REQUEST_RECONCILIATION",
    campaignSlug: before.campaign.slug,
    expectedSequence: before.campaign.sequence,
    idempotencyKey: crypto.randomUUID(),
    payload: {},
    confirmation: true,
  };
  const first = await browserJson<CommandResult>(page, "/api/gm/commands", {
    method: "POST",
    headers: { "x-csrf-token": before.csrfToken },
    body: request,
  });
  expect(first.status).toBe(200);
  const replay = await browserJson<CommandResult>(page, "/api/gm/commands", {
    method: "POST",
    headers: { "x-csrf-token": before.csrfToken },
    body: request,
  });
  expect(replay.status).toBe(200);
  expect(replay.body.event.id).toBe(first.body.event.id);
  expect(replay.body.event.sequence).toBe(first.body.event.sequence);
  const afterReplay = await captainStatus(page);
  expect(afterReplay.campaign.sequence).toBe(before.campaign.sequence + 1);
  expect(afterReplay.events.filter((event) => event.id === first.body.event.id)).toHaveLength(1);
});

test("Captain command preparation is browser-authenticated, durable, and idempotent", async ({ page, browserName }) => {
  test.skip(
    browserName !== "chromium",
    "The shared-database mutation workflow runs once to avoid cross-project contention.",
  );
  await enterCaptainConsole(page);

  const before = await captainStatus(page);
  const preview = await browserJson<{ canExecute: boolean; currentSequence: number; prerequisites: string[] }>(
    page,
    "/api/gm/preview",
    {
      method: "POST",
      body: {
        command: "PREPARE_CHAPTER",
        campaignSlug: before.campaign.slug,
        expectedSequence: before.campaign.sequence,
        payload: {},
        preview: true,
      },
    },
  );
  expect(preview.status).toBe(200);
  expect(preview.body).toMatchObject({
    canExecute: true,
    currentSequence: before.campaign.sequence,
    prerequisites: [],
  });
  expect((await captainStatus(page)).campaign.sequence).toBe(before.campaign.sequence);

  const request = {
    command: "PREPARE_CHAPTER",
    campaignSlug: before.campaign.slug,
    expectedSequence: before.campaign.sequence,
    payload: {},
  };
  const prepared = await browserJson<{
    persistence: string;
    staged: { id: string; command: string; reservedSequence: number; status: string };
  }>(page, "/api/gm/staging", {
    method: "POST",
    headers: { "x-csrf-token": before.csrfToken },
    body: request,
  });
  expect(prepared.status, JSON.stringify(prepared.body)).toBe(200);
  expect(prepared.body).toMatchObject({
    persistence: "COMMITTED",
    staged: {
      command: "PREPARE_CHAPTER",
      reservedSequence: before.campaign.sequence + 1,
      status: "PREPARED",
    },
  });

  const afterPrepared = await captainStatus(page);
  expect(afterPrepared.campaign.sequence).toBe(before.campaign.sequence + 1);
  expect(
    afterPrepared.events.filter(
      (event) => event.id === prepared.body.staged.id && event.type === "chronicle.commandPrepared",
    ),
  ).toHaveLength(1);
  expect(afterPrepared.audit.some((entry) => entry.action === "CHRONICLE_COMMAND_PREPARED")).toBe(true);

  const replay = await browserJson<{
    persistence: string;
    staged: { id: string; reservedSequence: number; status: string };
  }>(page, "/api/gm/staging", {
    method: "POST",
    headers: { "x-csrf-token": before.csrfToken },
    body: request,
  });
  expect(replay.status, JSON.stringify(replay.body)).toBe(200);
  expect(replay.body.staged).toMatchObject({
    id: prepared.body.staged.id,
    reservedSequence: prepared.body.staged.reservedSequence,
    status: "PREPARED",
  });
  const afterReplay = await captainStatus(page);
  expect(afterReplay.campaign.sequence).toBe(afterPrepared.campaign.sequence);
  expect(afterReplay.events.filter((event) => event.id === prepared.body.staged.id)).toHaveLength(1);
});

test("workspace routes preserve the newest Quartermaster surface and remain accessible", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Authenticated workspace coverage may mutate shared login state and therefore runs once.",
  );
  await enterCaptainConsole(page);
  const navigation = page.getByRole("navigation", { name: "Captain's Console sections" });
  for (const section of ["Voyages", "Invitations", "Published Chronicles"]) {
    const control = navigation.getByRole("button", { name: new RegExp(`^${section}`, "u") });
    await control.click();
    await expect(control).toHaveAttribute("aria-pressed", "true");
    await capture(page, `${browserName}-captain-${section.toLowerCase().replace(/\\s+/gu, "-")}`);
  }
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  await page.setViewportSize({ width: 430, height: 932 });
  await expect(page.getByRole("heading", { name: "Captain's Console" })).toBeVisible();
  await capture(page, `${browserName}-captain-430x932`);
  for (const [width, height, name] of [
    [2560, 1440, "deck-2560x1440"],
    [1920, 1080, "deck-1920x1080"],
    [1440, 900, "deck-1440x900"],
    [1280, 800, "deck-1280x800"],
    [1194, 834, "deck-tablet-landscape"],
    [834, 1194, "deck-tablet-portrait"],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole("heading", { name: "Captain's Console" })).toBeVisible();
    await capture(page, `${browserName}-${name}`);
  }
});
