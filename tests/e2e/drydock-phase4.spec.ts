import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";
import { db } from "../../src/lib/db";

test.skip(({ browserName }) => browserName !== "chromium", "The task-owned mutable Drydock journey runs once.");

test("Drydock Phase 4 exposes current launch and compatibility decisions without enabling a broken Chronicle", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const identifier = `drydock-phase4-${randomUUID().slice(0, 12)}`;
  const password = "Mooring-97!caraway";
  const account = await db.userAccount.create({
    data: { status: "ACTIVE", claimedAt: new Date(), ordinaryWorkspaceEntryAt: new Date() },
  });
  await db.playerProfile.create({
    data: { accountId: account.id, displayName: "Synthetic Drydock Creator", status: "ACTIVE", claimedAt: new Date() },
  });
  await db.accountEmail.create({
    data: {
      accountId: account.id,
      normalizedEmail: `${identifier}@example.test`,
      displayEmail: `${identifier}@example.test`,
      isPrimary: true,
      verificationState: "VERIFIED",
      verifiedAt: new Date(),
    },
  });
  await db.accountCredential.create({
    data: { accountId: account.id, passwordHash: await bcrypt.hash(password, 10), changedAt: new Date() },
  });
  await db.accountRoleAssignment.create({ data: { accountId: account.id, role: "CREATOR", scopeType: "GLOBAL" } });
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const login = await page.request.post("/api/auth/sign-in", {
    data: { login: `${identifier}@example.test`, password },
  });
  expect(login.ok(), await login.text()).toBeTruthy();
  const { csrfToken } = (await login.json()) as { csrfToken: string };

  await page.goto("/studio");
  await expect(page).toHaveURL(/\/studio\/library/u);
  await expect(page.getByRole("heading", { name: "Voyagewright Studio" })).toBeVisible();
  const studioReady = page.waitForResponse(
    (response) => response.url().endsWith("/api/studio/tales") && response.request().method() === "GET",
  );
  await page.getByRole("link", { name: "Create Chronicle", exact: true }).click();
  expect((await studioReady).ok()).toBeTruthy();
  await expect(page.getByRole("button", { name: "Create and open Chronicle" })).toBeEnabled();
  await page.getByLabel("Title", { exact: true }).fill("Synthetic Drydock browser Chronicle");
  await page.getByLabel(/Address/).fill(identifier);
  await page.getByLabel("Short description", { exact: true }).fill("A task-owned browser acceptance Chronicle.");
  await page.getByRole("button", { name: "Create and open Chronicle" }).click();
  await expect(page).toHaveURL(/\/studio\/tales\/(?!new(?:\/|$))[^/]+\/?$/u, { timeout: 30_000 });
  const taleId = new URL(page.url()).pathname.split("/")[3];
  if (!taleId) throw new Error("Synthetic Chronicle identifier was missing from the Studio URL.");
  await page
    .getByRole("navigation", { name: "Chronicle authoring sections" })
    .getByRole("link", { name: "Sea Trials" })
    .click();
  await expect(page).toHaveURL(/\/studio\/tales\/[^/]+\/trials$/u, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Launch Gate" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Compatibility" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sea Trials" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("NEEDS REPAIR")).toBeVisible();
  await expect(page.getByText("No current Scenario matches this filter.")).toBeVisible();

  for (const suffix of ["readiness", "compatibility", "scenarios", "scenarios/suites", "simulation-runs"]) {
    const response = await page.evaluate(
      async ({ url, csrfToken }) => {
        const result = await fetch(url, { headers: { "x-csrf-token": csrfToken } });
        const body = await result.text();
        return {
          status: result.status,
          contentType: result.headers.get("content-type") ?? "",
          body,
          bodyStart: body.trimStart().at(0),
        };
      },
      {
        url: `/api/studio/tales/${taleId}/${suffix}`,
        csrfToken,
      },
    );
    expect(response.status, `${suffix} status: ${response.body}`).toBe(200);
    expect(response.contentType, `${suffix} content type`).toContain("application/json");
    expect(["{", "["]).toContain(response.bodyStart);
  }
  expect(page.getByText(/Sea Trials could not load because the server returned an unexpected response/u)).toHaveCount(
    0,
  );
  expect(consoleErrors.filter((message) => /Unexpected token\s+['"]?</u.test(message))).toEqual([]);

  const foreign = await db.userAccount.create({
    data: { status: "ACTIVE", claimedAt: new Date(), ordinaryWorkspaceEntryAt: new Date() },
  });
  await db.playerProfile.create({
    data: {
      accountId: foreign.id,
      displayName: "Synthetic Drydock Foreign Creator",
      status: "ACTIVE",
      claimedAt: new Date(),
    },
  });
  await db.accountEmail.create({
    data: {
      accountId: foreign.id,
      normalizedEmail: `${identifier}-foreign@example.test`,
      displayEmail: `${identifier}-foreign@example.test`,
      isPrimary: true,
      verificationState: "VERIFIED",
      verifiedAt: new Date(),
    },
  });
  await db.accountCredential.create({
    data: { accountId: foreign.id, passwordHash: await bcrypt.hash(password, 10), changedAt: new Date() },
  });
  await db.accountRoleAssignment.create({ data: { accountId: foreign.id, role: "CREATOR", scopeType: "GLOBAL" } });
  const foreignContext = await browser.newContext();
  const foreignPage = await foreignContext.newPage();
  const foreignLogin = await foreignPage.request.post("/api/auth/sign-in", {
    data: { login: `${identifier}-foreign@example.test`, password },
  });
  expect(foreignLogin.ok(), await foreignLogin.text()).toBeTruthy();
  await foreignPage.goto("/studio");
  await expect(foreignPage).toHaveURL(/\/studio\/library/u);
  const denied = await foreignPage.evaluate(async (url) => {
    const response = await fetch(url);
    return { status: response.status, body: await response.json() };
  }, `/api/studio/tales/${taleId}/readiness`);
  expect(denied.status).toBe(404);
  expect(denied.body as { error: string }).toEqual({
    error: "This Chronicle is not available to this Creator account.",
  });
  await foreignContext.close();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Launch Gate" })).toBeVisible();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  await expect(page.getByRole("heading", { name: "Launch Gate" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).exclude("nextjs-portal").analyze();
  expect(axe.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  await context.close();
});
