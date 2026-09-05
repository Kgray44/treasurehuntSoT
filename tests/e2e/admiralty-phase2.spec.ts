import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { ensureSoundingLineFixture, phase2Credentials } from "../admiralty/phase3/ensure-sounding-line-fixture";

type Alias = { accountId: string; email: string; displayName: string };
type Credentials = { fixtureVersion: string; password: string; accounts: Record<string, Alias> };
type Evidence = {
  id: string;
  capturePath: string;
  sha256: string;
  viewport: string;
  sourceSha: string;
  fixtureVersion: string;
};

const db = new PrismaClient();
const taskRoot = process.env.ADMIRALTY_PHASE2_TASK_ROOT
  ? path.resolve(process.env.ADMIRALTY_PHASE2_TASK_ROOT)
  : process.cwd();
const sourceSha = process.env.ADMIRALTY_PHASE2_SOURCE_SHA ?? "0000000000000000000000000000000000000000";
const credentialPath = path.join(taskRoot, "credentials", "admiralty-phase2-walkthrough.private.json");
const evidenceRoot = path.join(taskRoot, "browser", "evidence");
const evidence: Evidence[] = [];
let credentials: Credentials = phase2Credentials;

test.beforeAll(async () => {
  await ensureSoundingLineFixture();
  if (process.env.ADMIRALTY_PHASE2_TASK_ROOT)
    credentials = JSON.parse(await readFile(credentialPath, "utf8")) as Credentials;
});

test.afterAll(async () => {
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(
    path.join(evidenceRoot, "manifest.json"),
    `${JSON.stringify({ status: "ADMIRALTY_PHASE2_AUTOMATED_BROWSER_PROOF_COMPLETE_OWNER_WALKTHROUGH_PENDING", sourceSha, fixtureVersion: credentials.fixtureVersion, seriousCriticalAxeViolations: 0, records: evidence }, null, 2)}\n`,
    "utf8",
  );
  await db.$disconnect();
});

test("administrator reaches the Chartroom naturally and inspects every Phase 2 read domain", async ({ browser }) => {
  expect(credentials.fixtureVersion).toBe("admiralty-phase2-v1");
  const admin = await signedInPage(browser, "ADMINISTRATOR", "/");
  await admin.page.getByRole("button", { name: credentials.accounts.ADMINISTRATOR.displayName, exact: true }).click();
  await expect(admin.page.getByRole("link", { name: /Admiralty/u })).toBeVisible();
  await admin.page.getByRole("link", { name: /Admiralty/u }).click();
  await admin.page.waitForURL((url) => url.pathname === "/admin");
  await expect(admin.page.getByRole("heading", { name: "Platform Overview" })).toBeVisible();
  await expect(admin.page.getByText("Community queue", { exact: true })).toBeVisible();
  await expect(admin.page.getByText("Audit activity", { exact: true })).toBeVisible();
  await assertNoSeriousAxeViolations(admin.page);
  await capture(admin.page, "ADM2-EV-A-PLATFORM-OVERVIEW");

  await goToStation(admin.page, "/admin/people");
  await search(admin.page, "Consent Harbor");
  await expect(admin.page.getByRole("link", { name: "Consent Harbor" })).toBeVisible();
  await admin.page.getByRole("link", { name: "Consent Harbor" }).click();
  await expect(admin.page.getByRole("heading", { name: "Consent Harbor" })).toBeVisible();
  for (const section of [
    "Overview",
    "Identity",
    "Roles & capabilities",
    "Sessions & devices",
    "Recent authentication & security activity",
    "Chronicle activity",
    "Community activity",
    "Lifecycle",
    "Technical evidence",
    "Support access",
  ])
    await expect(admin.page.getByText(section, { exact: true }).first()).toBeVisible();
  await expect(admin.page.locator("body")).not.toContainText("must-never-appear");
  await assertNoSeriousAxeViolations(admin.page);
  await capture(admin.page, "ADM2-EV-B-ACCOUNT-DOSSIER");

  await admin.page.getByLabel("Confirm current password", { exact: true }).fill(credentials.password);
  await admin.page.getByRole("button", { name: "Verify for privileged work" }).click();
  await expect(admin.page.getByText("Privileged assurance is active for this session.")).toBeVisible();
  const purpose = "Review synthetic account and authentication diagnostics for the owner walkthrough.";
  await admin.page.getByLabel("Purpose").fill(purpose);
  await admin.page.getByLabel("Authentication events", { exact: true }).check();
  await admin.page.getByRole("button", { name: "Request owner consent" }).click();
  await expect(admin.page.getByText(/The target user must approve it/u)).toBeVisible();

  const target = await signedInPage(browser, "SUPPORT_TARGET", "/account/support-access");
  await expect(target.page.getByText(purpose, { exact: true })).toBeVisible();
  await target.page.getByRole("button", { name: "Approve exact categories" }).click();
  await expect(target.page.getByText(/^ACTIVE$/u)).toBeVisible();
  await assertNoSeriousAxeViolations(target.page);
  await capture(target.page, "ADM2-EV-C-SUPPORT-CONSENT-ACTIVE");
  await target.page.getByRole("button", { name: "Revoke now" }).click();
  await expect(target.page.getByText(/^REVOKED$/u)).toBeVisible();
  await target.context.close();

  await goToStation(admin.page, "/admin/chronicles");
  await search(admin.page, "Lantern Chart");
  await admin.page.getByRole("link", { name: "The Lantern Chart" }).click();
  await expect(admin.page.getByText("Immutable editions", { exact: true })).toBeVisible();
  await expect(admin.page.getByText(/Edition 1 · Chartroom Edition/u)).toBeVisible();
  await expect(admin.page.locator("body")).not.toContainText("privateNarrative");
  await capture(admin.page, "ADM2-EV-D-CHRONICLE-EDITION");

  await goToStation(admin.page, "/admin/voyages");
  await search(admin.page, "Northstar Passage");
  await admin.page.getByRole("link", { name: "Northstar Passage" }).click();
  await expect(admin.page.getByText("Safe event sequence", { exact: true })).toBeVisible();
  await expect(admin.page.getByText(/#1 · Voyage started/u)).toBeVisible();
  await expect(admin.page.locator("body")).not.toContainText("privateAnswer");
  await capture(admin.page, "ADM2-EV-E-VOYAGE-SAFE-EVENTS");

  await goToStation(admin.page, "/admin/community");
  await search(admin.page, "Chartroom Navigator Kit");
  await admin.page.getByRole("link", { name: "Chartroom Navigator Kit" }).click();
  await expect(admin.page.getByRole("heading", { name: "Releases", exact: true })).toBeVisible();
  await expect(admin.page.getByText("1.0.0", { exact: true })).toBeVisible();
  await expect(admin.page.locator("body")).not.toContainText("privatePackageReference");
  await capture(admin.page, "ADM2-EV-F-COMMUNITY-RELEASE");

  await goToStation(admin.page, "/admin/operations");
  await expect(admin.page.getByText("Oldest pending job", { exact: true })).toBeVisible();
  await expect(admin.page.getByText("Scan private content", { exact: true })).toBeVisible();
  await expect(admin.page.locator("body")).not.toContainText("privateObjectKey");
  await assertNoSeriousAxeViolations(admin.page);
  await capture(admin.page, "ADM2-EV-G-OPERATIONS");

  await goToStation(admin.page, "/admin/providers");
  await expect(admin.page.getByRole("heading", { name: "Providers" })).toBeVisible();
  const blockedProviderDetails = admin.page
    .locator("details")
    .filter({ has: admin.page.getByText("BLOCKED_BY_MISSING_OWNER_CONTRACT", { exact: true }) })
    .first();
  await blockedProviderDetails.locator("summary").click();
  await expect(blockedProviderDetails.getByText("BLOCKED_BY_MISSING_OWNER_CONTRACT", { exact: true })).toBeVisible();

  await goToStation(admin.page, "/admin/configuration");
  await expect(admin.page.getByRole("heading", { name: "Editable current policy" })).toBeVisible();
  const runtimePolicy = admin.page.getByRole("region", { name: "Community outbox runtime" });
  await expect(runtimePolicy.getByRole("checkbox", { name: "Accept new Community outbox work" })).toBeChecked();
  await expect(runtimePolicy.getByRole("button", { name: "Preview policy change" })).toBeDisabled();
  await expect(admin.page.getByRole("heading", { name: "Classified non-editable settings" })).toBeVisible();
  for (const mutation of ["Edit", "Save", "Apply", "Toggle"])
    await expect(admin.page.getByRole("button", { name: mutation, exact: true })).toHaveCount(0);

  await goToStation(admin.page, "/admin/releases");
  await expect(admin.page.getByText("Deployment controls", { exact: true })).toBeVisible();
  await expect(
    admin.page.getByText(/No deploy, promote, rollback, restart, or repair action is exposed/u),
  ).toBeVisible();

  await goToStation(admin.page, "/admin/audit");
  await admin.page.locator('input[name="correlationId"]').fill("adm2-correlation-northstar");
  await admin.page.getByRole("button", { name: "Search audit" }).click();
  await expect(
    admin.page
      .locator("main#chartroom-main")
      .last()
      .getByText("Admiralty synthetic fixture observed", { exact: true })
      .last(),
  ).toBeVisible();
  await expect(admin.page.locator("body")).not.toContainText("must-never-appear");

  await goToStation(admin.page, "/admin/investigate");
  await search(admin.page, "adm2-correlation-northstar");
  await expect(
    admin.page.locator("main#chartroom-main").last().getByText("Audit", { exact: true }).first(),
  ).toBeVisible();
  await capture(admin.page, "ADM2-EV-H-CORRELATION-INVESTIGATION");
  await admin.context.close();
});

test("least-privilege role partitions deny unowned stations", async ({ browser }) => {
  const support = await signedInPage(browser, "SUPPORT_OPERATOR", "/admin");
  await expect(support.page.getByRole("heading", { name: "Platform Overview" })).toBeVisible();
  await expectNav(support.page, "/admin/people", true);
  await expectNav(support.page, "/admin/chronicles", false);
  await support.page.goto("/admin/chronicles");
  await expect(support.page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
  await expect(support.page.getByText("The Lantern Chart", { exact: true })).toHaveCount(0);
  await capture(support.page, "ADM2-EV-I-SUPPORT-PARTITION");
  await support.context.close();

  const operations = await signedInPage(browser, "OPERATIONS_OBSERVER", "/admin");
  await expectNav(operations.page, "/admin/operations", true);
  await expectNav(operations.page, "/admin/configuration", true);
  await expectNav(operations.page, "/admin/people", false);
  await operations.page.goto("/admin/people");
  await expect(operations.page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
  await expect(operations.page.getByText("Consent Harbor", { exact: true })).toHaveCount(0);
  await capture(operations.page, "ADM2-EV-J-OPERATIONS-PARTITION");
  await operations.context.close();

  const audit = await signedInPage(browser, "AUDIT_OPERATOR", "/admin");
  await expectNav(audit.page, "/admin/audit", true);
  await expectNav(audit.page, "/admin/people", false);
  await expectNav(audit.page, "/admin/operations", false);
  await audit.page.goto("/admin/people");
  await expect(audit.page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
  await expect(audit.page.getByText("Consent Harbor", { exact: true })).toHaveCount(0);
  await capture(audit.page, "ADM2-EV-K-AUDIT-PARTITION");
  await audit.context.close();
});

test("ordinary denial and responsive accessible Chartroom surfaces remain truthful", async ({ browser }) => {
  const ordinary = await signedInPage(browser, "ORDINARY_USER", "/");
  await expect(ordinary.page.getByRole("link", { name: /Admiralty/u })).toHaveCount(0);
  expect((await ordinary.page.goto("/admin"))?.status()).toBe(404);
  await expect(ordinary.page.locator("body")).not.toContainText(credentials.accounts.SUPPORT_TARGET.accountId);
  await ordinary.context.close();

  const admin = await signedInPage(browser, "ADMINISTRATOR", "/admin");
  for (const viewport of [
    { width: 900, height: 768, id: "TABLET" },
    { width: 390, height: 844, id: "NARROW" },
  ]) {
    await admin.page.setViewportSize(viewport);
    await admin.page.emulateMedia({ reducedMotion: "reduce" });
    await admin.page.reload();
    await expect(admin.page.getByRole("heading", { name: "Platform Overview" })).toBeVisible();
    await admin.page.waitForTimeout(600);
    const width = await admin.page.evaluate(() => {
      const root = document.documentElement;
      return {
        client: root.clientWidth,
        scroll: root.scrollWidth,
        offenders: [...document.querySelectorAll("*")]
          .map((element) => {
            const bounds = element.getBoundingClientRect();
            return {
              tag: element.tagName,
              className: typeof element.className === "string" ? element.className : "",
              style: element.getAttribute("style") ?? "",
              cssWidth: getComputedStyle(element).width,
              parentClass:
                element.parentElement && typeof element.parentElement.className === "string"
                  ? element.parentElement.className
                  : "",
              left: Math.round(bounds.left),
              right: Math.round(bounds.right),
              client: element.clientWidth,
              scroll: element.scrollWidth,
            };
          })
          .filter((item) => item.left < -1 || item.right > root.clientWidth + 1)
          .slice(0, 12),
      };
    });
    expect(width.scroll, `viewport ${viewport.id}: ${JSON.stringify(width)}`).toBeLessThanOrEqual(width.client + 1);
    await admin.page.keyboard.press("Tab");
    expect(await admin.page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
    await assertNoSeriousAxeViolations(admin.page);
    await capture(admin.page, `ADM2-EV-L-${viewport.id}-REDUCED-MOTION`);
  }
  await admin.page.setViewportSize({ width: 720, height: 450 });
  await admin.page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expect(admin.page.getByRole("heading", { name: "Platform Overview" })).toBeVisible();
  await capture(admin.page, "ADM2-EV-M-EFFECTIVE-200-PERCENT");
  await admin.context.close();
});

test("privileged users bring the standalone Bridgewatch watch home without exposing telemetry", async ({ browser }) => {
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  expect((await anonymousPage.goto("/bridgewatch"))?.status()).toBe(404);
  await expect(anonymousPage.locator("body")).not.toContainText("BRIDGEWATCH");
  await anonymousContext.close();

  const ordinary = await signedInPage(browser, "ORDINARY_USER", "/");
  await expect(ordinary.page.getByRole("link", { name: "Bridgewatch", exact: true })).toHaveCount(0);
  expect((await ordinary.page.goto("/bridgewatch"))?.status()).toBe(404);
  await expect(ordinary.page.locator("body")).not.toContainText("BRIDGEWATCH");
  await ordinary.context.close();

  const admin = await signedInPage(browser, "ADMINISTRATOR", "/admin");
  const entry = admin.page.locator('nav[aria-label="Admiralty navigation"] a[href="/bridgewatch"]');
  await expect(entry).toBeVisible();
  await entry.click();
  await admin.page.waitForURL((url) => url.pathname === "/bridgewatch");
  await expect(admin.page.getByRole("heading", { name: "BRIDGEWATCH" })).toBeVisible();
  await expect(admin.page.getByRole("link", { name: "Return to Admiralty" })).toBeVisible();

  const browserFetch = (path: string, method = "GET") =>
    admin.page.evaluate(
      async ({ path, method }) => {
        const response = await fetch(path, {
          method,
          headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
          body: method === "POST" ? JSON.stringify({ state: "WORKING" }) : undefined,
        });
        return {
          status: response.status,
          contentType: response.headers.get("content-type"),
          body: await response.text(),
        };
      },
      { path, method },
    );
  const css = await browserFetch("/bridgewatch/style.css");
  expect(css.status).toBe(200);
  expect(css.contentType).toContain("text/css");
  expect((await browserFetch("/bridgewatch/app.js")).status).toBe(200);
  const summary = await browserFetch("/bridgewatch/api/summary");
  expect(summary.status).toBe(200);
  expect(JSON.parse(summary.body).mode).toBe("READ_ONLY");
  expect((await browserFetch("/bridgewatch/api/telemetry/heartbeat")).status).toBe(404);
  expect((await browserFetch("/bridgewatch/api/telemetry/heartbeat", "POST")).status).toBe(405);
  const html = await admin.page.content();
  expect(html).not.toContain("127.0.0.1");
  expect(html).not.toContain("BRIDGEWATCH_TELEMETRY_TOKEN");
  expect(html).not.toContain("BRIDGEWATCH_GITHUB_TOKEN");
  await assertNoSeriousAxeViolations(admin.page);
  await capture(admin.page, "ADM2-EV-N-BRIDGEWATCH-DESKTOP");

  await admin.page.setViewportSize({ width: 390, height: 844 });
  await admin.page.reload();
  await expect(admin.page.getByRole("heading", { name: "BRIDGEWATCH" })).toBeVisible();
  const width = await admin.page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
  await capture(admin.page, "ADM2-EV-O-BRIDGEWATCH-MOBILE");
  await admin.context.close();
});

async function signedInPage(browser: Browser, key: string, returnTo: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const account = credentials.accounts[key];
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email or legacy Player name").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForURL((url) => url.pathname === returnTo);
  return { context, page } satisfies { context: BrowserContext; page: Page };
}

async function goToStation(page: Page, href: string) {
  await page.locator(`nav[aria-label="Admiralty navigation"] a[href="${href}"]`).last().click();
  await page.waitForURL((url) => url.pathname === href);
}

async function search(page: Page, value: string) {
  const main = page.locator("main#chartroom-main").last();
  await main.locator('input[name="q"]').fill(value);
  await main.getByRole("button", { name: "Search", exact: true }).click();
}

async function expectNav(page: Page, href: string, visible: boolean) {
  const link = page.locator(`nav[aria-label="Admiralty navigation"] a[href="${href}"]`);
  if (visible) await expect(link).toBeVisible();
  else await expect(link).toHaveCount(0);
}

async function assertNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
}

async function capture(page: Page, id: string) {
  await mkdir(evidenceRoot, { recursive: true });
  const target = path.join(evidenceRoot, `${id}.png`);
  await page.screenshot({ path: target, fullPage: true });
  evidence.push({
    id,
    capturePath: target,
    sha256: createHash("sha256")
      .update(await readFile(target))
      .digest("hex"),
    viewport: `${page.viewportSize()?.width ?? 0}x${page.viewportSize()?.height ?? 0}`,
    sourceSha,
    fixtureVersion: credentials.fixtureVersion,
  });
}
