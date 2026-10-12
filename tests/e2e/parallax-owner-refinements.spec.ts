import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { listSpatialItems } from "../../src/parallax/library-service";
import { AI_CONTROL_ID } from "../../src/parallax/ai-ledger";
import { defaultAIGlobalPolicy, aiUTCPeriod } from "../../src/parallax/ai-policy";

test.use({ actionTimeout: 30000, video: "on" });
test.describe.configure({ mode: "serial", timeout: 300000 });
test.skip(process.env.PARALLAX_A1_SYNTHETIC_PROVIDER !== "1", "Use the owned unpaid Parallax browser runtime.");
test.afterAll(() => db.$disconnect());
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;

test("owner refinements: coherent Studio themes, overlay assistance and populated working docks", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic owner-refinement Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await db.aIQuotaControl.upsert({
    where: { id: AI_CONTROL_ID },
    create: { id: AI_CONTROL_ID, policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
    update: { policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
  });
  await mkdir(root, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio/parallax");
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  const selectBottom = async (name: string) => {
    const tab = page.getByRole("tab", { name, exact: true });
    if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  };
  await expect(canvas.locator('[data-renderer="READY"] canvas')).toBeVisible();
  const renderer = await canvas.locator("canvas").elementHandle();
  const observations = [];
  for (const size of [
    { width: 1440, height: 1000 },
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    const before = (await canvas.boundingBox())!;
    await page.getByRole("button", { name: /Ask Parallax/ }).click();
    const assistant = page.getByRole("region", { name: "Spatial Assistant", exact: true });
    await expect(assistant).toBeVisible();
    const open = (await canvas.boundingBox())!;
    expect(open.width).toBeCloseTo(before.width, 0);
    expect(open.height).toBeCloseTo(before.height, 0);
    const host = page.locator("#parallax-assistance");
    if ((await host.getAttribute("data-docked")) !== "true")
      await page.getByRole("button", { name: "Dock assistance", exact: true }).click();
    const docked = (await canvas.boundingBox())!;
    expect(docked.width).toBeCloseTo(before.width, 0);
    expect(docked.height).toBeCloseTo(before.height, 0);
    await page.screenshot({ path: `${root}/owner-overlay-${size.width}x${size.height}.png`, fullPage: true });
    await page.getByRole("button", { name: "Close assistance", exact: true }).click();
    await expect(assistant).toBeHidden();
    observations.push({ size, before, open, docked });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel("Workspace layout").selectOption("CONSTRUCTION");
  const inspector = page.getByRole("complementary", { name: "Spatial inspector" });
  await page
    .getByRole("region", { name: "Spatial asset browser" })
    .getByRole("button", { name: "Peeking Letter", exact: false })
    .click();
  await expect(inspector.getByRole("heading", { name: "Peeking Letter", exact: true })).toBeVisible();
  await inspector.getByLabel("Object name", { exact: true }).fill("Owner review letter");
  await page.getByRole("tab", { name: "Hierarchy", exact: true }).click();
  const graph = page.getByRole("region", { name: "Scene graph" });
  const visibility = graph.getByRole("button", { name: "Toggle visibility of Owner review letter", exact: true });
  await visibility.click();
  await expect(visibility).toHaveText("Hidden");
  await visibility.click();
  await expect(visibility).toHaveText("Visible");
  const lock = graph.getByRole("button", { name: "Toggle lock of Owner review letter", exact: true });
  await lock.click();
  await expect(lock).toHaveText("Locked");
  await expect(inspector.getByLabel("Object name", { exact: true })).toBeDisabled();
  await lock.click();
  await expect(inspector.getByLabel("Object name", { exact: true })).toBeEnabled();
  await selectBottom("Timeline");
  await page.getByRole("button", { name: "Add spatial behavior", exact: true }).click();
  await page.getByText("Sequence properties & simulation", { exact: true }).click();
  await page.getByLabel("Behavior 1 delay milliseconds").fill("1200");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status", { name: "", exact: true })).toContainText("Working draft saved");
  const saved = (await listSpatialItems(account.id)).find((item) =>
    item.draft.content.entities.some((entity) => entity.name === "Owner review letter"),
  )!;
  expect(saved.draft.content.studio?.behaviors[0].delayMs).toBe(1200);
  const scene = JSON.stringify(saved.draft);
  const loaded = await (await page.request.get("/api/studio/parallax")).json();
  const preferences = await (await page.request.get("/api/passport/preferences")).json();
  const accessibility = [];
  for (const theme of ["DARK", "LIGHT"] as const) {
    const response = await page.request.put("/api/passport/preferences", {
      headers: { "x-csrf-token": loaded.csrfToken },
      data: {
        preferences: {
          ...preferences.preferences,
          experience: { ...preferences.preferences.experience, theme, motion: "REDUCED" },
        },
      },
    });
    expect(response.ok()).toBe(true);
    await page.goto(`/studio/parallax?definition=${saved.id}`);
    await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", theme.toLowerCase());
    await expect(canvas.locator('[data-renderer="READY"]')).toHaveAttribute("data-appearance", theme.toLowerCase());
    await page.getByLabel("Workspace layout").selectOption("CONSTRUCTION");
    await page.getByRole("tab", { name: "Hierarchy", exact: true }).click();
    await graph.getByRole("button", { name: "◇ Owner review letter", exact: true }).click();
    for (const mode of ["GUIDED", "DETAILED", "ENGINEERING"] as const) {
      await page.getByLabel("Authoring mode").selectOption(mode);
      await selectBottom("Timeline");
      await expect(
        page.getByRole("button", { name: /Owner review letter: highlight 1200 milliseconds/ }),
      ).toBeVisible();
      if (mode !== "ENGINEERING") await expect(inspector.getByLabel("Object name", { exact: true })).toBeVisible();
      if (mode === "GUIDED") await expect(inspector.getByText("Appearance / layers", { exact: true })).toBeHidden();
      if (mode === "ENGINEERING") await expect(inspector.getByLabel("Position x", { exact: true })).toBeVisible();
      else await expect(inspector.getByText("Advanced / Engineering", { exact: true })).toBeHidden();
      await page.screenshot({
        path: `${root}/owner-populated-${theme.toLowerCase()}-${mode.toLowerCase()}.png`,
        fullPage: true,
      });
    }
    for (const tab of ["Simulation", "Diagnostics", "Events"] as const) {
      await selectBottom(tab);
      const panel = page.getByRole("tabpanel", { name: tab, exact: true });
      if (tab === "Simulation") {
        await panel.getByRole("button", { name: "Simulate inspect", exact: true }).click();
        await expect(page.getByLabel("Preview", { exact: true })).toHaveValue("LENS");
        await page.getByLabel("Preview", { exact: true }).selectOption("EDITOR");
      }
      if (tab === "Diagnostics") await expect(panel.getByRole("button").first()).toBeVisible();
      if (tab === "Events") await expect(panel).toContainText("Owner review letter");
      await page.screenshot({ path: `${root}/owner-${theme.toLowerCase()}-${tab.toLowerCase()}.png`, fullPage: true });
    }
    await selectBottom("Timeline");
    await page.getByLabel("Authoring mode").selectOption("DETAILED");
    for (const title of ["Appearance / layers", "Interactions", "Accessibility & Fallback"]) {
      const summary = inspector.getByText(title, { exact: true });
      if (!(await summary.evaluate((element) => element.parentElement?.hasAttribute("open")))) await summary.click();
    }
    await page.getByRole("tab", { name: "Library", exact: true }).click();
    await page.screenshot({ path: `${root}/owner-library-and-inspector-${theme.toLowerCase()}.png`, fullPage: true });
    await page.getByRole("tab", { name: "Saved", exact: true }).click();
    await expect(page.getByRole("tabpanel", { name: "Saved", exact: true })).toContainText("Owned items");
    await page.screenshot({ path: `${root}/owner-saved-library-${theme.toLowerCase()}.png`, fullPage: true });
    await page.getByRole("tab", { name: "Hierarchy", exact: true }).click();
    const axes = await new AxeBuilder({ page }).include("[data-mode]").analyze();
    accessibility.push({ theme, violations: axes.violations });
    expect(axes.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
    await page.getByRole("button", { name: /Ask Parallax/ }).click();
    await page.screenshot({ path: `${root}/owner-assistant-blue-${theme.toLowerCase()}.png`, fullPage: true });
    await page.getByRole("button", { name: "Close assistance", exact: true }).click();
  }
  // Theme/layout changes must not persist a replacement draft or recreate the renderer while it is mounted.
  expect(JSON.stringify((await listSpatialItems(account.id)).find((item) => item.id === saved.id)!.draft)).toBe(scene);
  expect(renderer).not.toBeNull();
  await writeFile(
    `${root}/owner-refinement-observations.json`,
    JSON.stringify(
      { candidate: process.env.PARALLAX_A1_SOURCE_SHA, observations, accessibility, savedBehaviorDelay: 1200 },
      null,
      2,
    ),
  );
});

test("floating assistance moves, resizes, restores and keeps its composer at the bottom without editing the scene", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic floating-window Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await db.aIQuotaControl.upsert({
    where: { id: AI_CONTROL_ID },
    create: { id: AI_CONTROL_ID, policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
    update: { policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio/parallax");
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  await expect(canvas.locator('[data-renderer="READY"] canvas')).toBeVisible();
  await page.getByRole("button", { name: /Ask Parallax/ }).click();
  const host = page.locator("#parallax-assistance");
  await expect(host).toHaveAttribute("data-floating-placed", "true");
  const beforeCanvas = (await canvas.boundingBox())!;
  const sceneBefore = await listSpatialItems(account.id);
  const move = page.getByRole("button", { name: "Move floating Spatial Assistant", exact: true });
  const drag = async (handle: ReturnType<typeof page.getByRole>, dx: number, dy: number) => {
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 5 });
    await page.mouse.up();
  };
  const initial = (await host.boundingBox())!;
  await drag(move, 90, -30);
  const moved = (await host.boundingBox())!;
  expect(moved.x).toBeCloseTo(initial.x + 90, 0);
  expect(moved.y).toBeCloseTo(initial.y - 30, 0);
  const observations = [];
  for (const [edge, label] of Object.entries({
    n: "top",
    e: "right",
    s: "bottom",
    w: "left",
    ne: "top right",
    nw: "top left",
    se: "bottom right",
    sw: "bottom left",
  })) {
    const handle = page.getByRole("button", { name: `Resize floating Spatial Assistant ${label}`, exact: true });
    const before = (await host.boundingBox())!;
    await drag(handle, 12, -12);
    const after = (await host.boundingBox())!;
    expect(after.x).toBeCloseTo(before.x + (edge.includes("w") ? 12 : 0), 0);
    expect(after.y).toBeCloseTo(before.y - (edge.includes("n") ? 12 : 0), 0);
    expect(after.x + after.width).toBeCloseTo(before.x + before.width + (edge.includes("e") ? 12 : 0), 0);
    expect(after.y + after.height).toBeCloseTo(before.y + before.height - (edge.includes("s") ? 12 : 0), 0);
    observations.push({ edge, before, after });
    await drag(handle, -12, 12);
  }
  await move.focus();
  await move.press("Shift+ArrowRight");
  expect((await host.boundingBox())!.x).toBeCloseTo(moved.x + 40, 0);
  const corner = page.getByRole("button", { name: "Resize floating Spatial Assistant bottom right", exact: true });
  await corner.focus();
  await corner.press("Shift+ArrowLeft");
  await corner.press("Shift+ArrowUp");
  const resized = (await host.boundingBox())!;
  expect(resized.width).toBeCloseTo(moved.width - 40, 0);
  expect(resized.height).toBeCloseTo(moved.height - 40, 0);
  const assertComposer = async () => {
    const form = host.locator("footer form");
    await expect(form.locator("textarea")).toBeVisible();
    const panel = (await host.boundingBox())!;
    const bottom = (await form.boundingBox())!;
    expect(panel.y + panel.height - bottom.y - bottom.height).toBeLessThan(36);
    await expect(host.getByRole("button", { name: "Send idea", exact: true })).toBeVisible();
  };
  await assertComposer();
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/floating-moved-resized.png` });
  await page.getByRole("button", { name: "Dock assistance", exact: true }).click();
  await expect(move).toBeHidden();
  await page.getByRole("button", { name: "Float assistance", exact: true }).click();
  expect(await host.boundingBox()).toEqual(resized);
  await page.reload();
  await page.getByRole("button", { name: /Ask Parallax/ }).click();
  expect(await host.boundingBox()).toEqual(resized);
  const afterCanvas = (await canvas.boundingBox())!;
  expect(afterCanvas.width).toBeCloseTo(beforeCanvas.width, 0);
  expect(afterCanvas.height).toBeCloseTo(beforeCanvas.height, 0);
  expect(await listSpatialItems(account.id)).toEqual(sceneBefore);
  for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await expect
      .poll(async () => {
        const box = (await host.boundingBox())!;
        return box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height;
      })
      .toBe(true);
    await assertComposer();
    await page.screenshot({ path: `${root}/floating-constrained-${size.width}x${size.height}.png` });
  }
  await writeFile(
    `${root}/floating-observations.json`,
    JSON.stringify({ candidate: process.env.PARALLAX_A1_SOURCE_SHA, initial, moved, resized, observations }, null, 2),
  );
});

test("Admiralty daily chart selects actual request and cost projections with empty and populated states", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic daily-activity operator");
  await db.accountRoleAssignment.create({ data: { accountId: account.id, role: "ADMINISTRATOR" } });
  await authenticateClosure(context, account, baseURL!);
  await page.goto("/admin/ai-usage");
  await mkdir(root, { recursive: true });
  await expect(page.getByRole("heading", { name: "Daily AI activity" })).toBeVisible();
  await page.screenshot({ path: `${root}/owner-daily-initial.png`, fullPage: true });
  const now = new Date(),
    period = aiUTCPeriod(now).id;
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 1));
  for (const [index, status] of ["SETTLED", "UNKNOWN"].entries()) {
    const id = crypto.randomUUID();
    await db.aIUsageLedger.create({
      data: {
        id,
        accountId: account.id,
        requestId: id,
        idempotencyKey: id,
        fingerprint: "synthetic-daily",
        definitionId: "synthetic-daily",
        operationCategory: "CREATE",
        period,
        provider: "OPENAI",
        model: "gpt-6-luna",
        mode: "STANDARD",
        pricingRevision: "synthetic-daily",
        pricing: "{}",
        policyRevision: 0,
        status,
        reservationNano: BigInt(200000000),
        exposureNano: BigInt(index ? 200000000 : 100000000),
        settledCostNano: index ? null : BigInt(100000000),
        createdAt: day,
        leaseExpiresAt: day,
      },
    });
  }
  await page.getByRole("button", { name: "Refresh usage", exact: true }).click();
  const projected = await (await page.request.get("/api/admin/ai-usage")).json();
  const today = projected.daily.at(-1);
  expect(today.requests).toBeGreaterThanOrEqual(2);
  for (const [value, label, field] of [
    ["requests", "Requests per day", "requests"],
    ["settled", "Settled cost per day", "settledCostNano"],
    ["accounted", "Accounted spending per day", "exposureNano"],
  ] as const) {
    await page.getByLabel("Chart shows").selectOption(value);
    await expect(page.getByRole("figure", { name: `${label} by UTC day`, exact: true })).toBeVisible();
    await expect(page.locator(`[data-date="${today.date}"]`)).toHaveAttribute("data-value", String(today[field]));
    await page.screenshot({ path: `${root}/owner-daily-${value}.png`, fullPage: true });
  }
  await page.getByText("Read daily requests and costs as a table", { exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "Reserved / unresolved" })).toBeVisible();
  await page.screenshot({ path: `${root}/owner-daily-table.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [value, label] of [
    ["requests", "Requests per day"],
    ["settled", "Settled cost per day"],
    ["accounted", "Accounted spending per day"],
  ] as const) {
    await page.getByLabel("Chart shows").selectOption(value);
    await page.getByRole("figure", { name: `${label} by UTC day`, exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${root}/owner-daily-mobile-${value}.png`, fullPage: true });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
});
