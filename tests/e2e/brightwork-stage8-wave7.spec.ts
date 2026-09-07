import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { db } from "@/lib/db";
import { createAccountSession } from "@/wayfarer/accounts";
import { WAYFARER_COOKIE } from "@/wayfarer/http";

const evidenceRoot = process.env.WAVE7_EVIDENCE_ROOT
  ? path.resolve(process.env.WAVE7_EVIDENCE_ROOT)
  : path.resolve("artifacts", "brightwork-stage8-wave7");
const sourceSha = process.env.WAVE7_SOURCE_SHA ?? "UNBOUND_LOCAL_REVIEW";
const evidence: Array<{
  id: string;
  route: string;
  viewport: string;
  theme: "DARK" | "LIGHT";
  title: string;
}> = [];

let reviewRoleId: string | null = null;

async function signedInContext(browser: Browser): Promise<BrowserContext> {
  const staff = await db.gameMasterUser.findUniqueOrThrow({
    where: { username: process.env.GM_USERNAME ?? "kato" },
    select: { canonicalAccount: { select: { id: true } } },
  });
  const accountId = staff.canonicalAccount?.id;
  if (!accountId) throw new Error("Wave 7 review requires the generic fixture canonical staff account.");

  const existingRole = await db.accountRoleAssignment.findFirst({
    where: { accountId, role: "ADMINISTRATOR", scopeType: "GLOBAL", scopeId: null, revokedAt: null },
    select: { id: true },
  });
  if (!existingRole) {
    const assignment = await db.accountRoleAssignment.create({
      data: { accountId, role: "ADMINISTRATOR", scopeType: "GLOBAL", grantedBy: "brightwork-wave7-synthetic-review" },
      select: { id: true },
    });
    reviewRoleId = assignment.id;
  }

  const session = await createAccountSession(accountId, "Brightwork Wave 7 synthetic production review");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    {
      name: WAYFARER_COOKIE,
      value: session.token,
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return context;
}

async function assertComposed(page: Page) {
  await expect(page.locator("main").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
}

async function capture(page: Page, id: string, route: string, theme: "DARK" | "LIGHT" = "DARK") {
  await mkdir(evidenceRoot, { recursive: true });
  await page.screenshot({ path: path.join(evidenceRoot, `${id}.png`), fullPage: true, caret: "hide" });
  const viewport = page.viewportSize();
  evidence.push({
    id,
    route,
    viewport: `${viewport?.width ?? 0}x${viewport?.height ?? 0}`,
    theme,
    title: await page.title(),
  });
}

async function review(page: Page, id: string, route: string, theme: "DARK" | "LIGHT" = "DARK") {
  const response = await page.goto(route, { waitUntil: "networkidle" });
  expect(response?.status(), `${route} should render in the task-owned production runtime`).toBeLessThan(500);
  await assertComposed(page);
  await capture(page, id, route, theme);
}

async function reviewInLight(page: Page, id: string, route: string) {
  await page.locator("html").evaluate((element) => element.setAttribute("data-voyage-theme", "light"));
  await assertComposed(page);
  await capture(page, id, route, "LIGHT");
  await page.locator("html").evaluate((element) => element.removeAttribute("data-voyage-theme"));
}

test.afterAll(async () => {
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(
    path.join(evidenceRoot, "wave7-review-manifest.json"),
    `${JSON.stringify(
      {
        status: "BRIGHTWORK_STAGE8_WAVE7_FOCUSED_SYNTHETIC_PRODUCTION_REVIEW_COMPLETE",
        sourceSha,
        environment: "TASK_OWNED_SYNTHETIC_SQLITE_AND_BUILT_NEXT_RUNTIME",
        evidence,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  if (reviewRoleId) await db.accountRoleAssignment.delete({ where: { id: reviewRoleId } });
  await db.$disconnect();
});

test("reviews representative Wave 7 journeys without product-family regressions", async ({ browser }) => {
  const anonymous = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const member = await signedInContext(browser);
  const publicPage = await anonymous.newPage();
  const memberPage = await member.newPage();

  try {
    await review(publicPage, "01-gateway-dark", "/");
    await reviewInLight(publicPage, "02-gateway-light", "/");
    await review(publicPage, "03-public-chronicles", "/tales");
    await review(publicPage, "04-public-chronicle-detail", "/play/development-studio-voyage");
    await review(publicPage, "05-sign-in", "/sign-in?returnTo=%2Faccount");

    await review(memberPage, "06-personal-harbor", "/account");
    await reviewInLight(memberPage, "07-personal-harbor-light", "/account");
    await review(memberPage, "08-passport", "/passport");
    await reviewInLight(memberPage, "09-passport-light", "/passport");
    await review(memberPage, "10-passport-history", "/passport/history");

    await review(memberPage, "11-player-library", "/player/library");
    await review(memberPage, "12-captain-library", "/captain/library");
    await review(memberPage, "13-studio-library", "/studio/library");
    await review(memberPage, "14-new-chronicle", "/studio/tales/new");
    await review(memberPage, "15-studio-exchange", "/studio/exchange");
    await review(memberPage, "16-private-content", "/studio/private-content");

    await review(memberPage, "17-community-home", "/community");
    await reviewInLight(memberPage, "18-community-home-light", "/community");
    await review(memberPage, "19-community-featured", "/community/featured");

    await review(memberPage, "20-admiralty-overview", "/admin");
    await reviewInLight(memberPage, "21-admiralty-overview-light", "/admin");
    await review(memberPage, "22-admiralty-configuration", "/admin/configuration");
    await review(memberPage, "23-admiralty-operations", "/admin/operations");
    await review(memberPage, "24-admiralty-releases", "/admin/releases");
    await review(memberPage, "25-admiralty-providers", "/admin/providers");
    await review(memberPage, "26-admiralty-audit", "/admin/audit");
    await review(memberPage, "27-admiralty-investigate", "/admin/investigate");
    await review(memberPage, "28-admiralty-support", "/admin/support/cases");

    await memberPage.setViewportSize({ width: 390, height: 844 });
    await review(memberPage, "29-studio-exchange-mobile", "/studio/exchange");
    await review(memberPage, "30-community-mobile", "/community");
    await review(memberPage, "31-admiralty-mobile", "/admin/configuration");
  } finally {
    await Promise.all([anonymous.close(), member.close()]);
  }
});
