import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { db } from "@/lib/db";
import { createAccountSession } from "@/wayfarer/accounts";
import { WAYFARER_COOKIE } from "@/wayfarer/http";

const hasWave6Fixture = Boolean(process.env.WAVE6_TASK_ROOT);
const taskRoot = path.resolve(
  process.env.WAVE6_TASK_ROOT ?? path.join(process.cwd(), "artifacts", "sounding-line", "wave6-fixture-unavailable"),
);
const evidenceRoot = path.resolve(process.env.WAVE6_EVIDENCE_ROOT ?? path.join(taskRoot, "browser", "evidence"));

async function captainContext(browser: Browser): Promise<BrowserContext> {
  const verifiedAt = new Date();
  await db.accountEmail.upsert({
    where: { id: "brightwork-wave6-captain-email" },
    update: { verificationState: "VERIFIED", verifiedAt, isPrimary: true },
    create: {
      id: "brightwork-wave6-captain-email",
      accountId: "hp4-account-creator",
      normalizedEmail: "brightwork-wave6-captain@example.test",
      displayEmail: "brightwork-wave6-captain@example.test",
      verificationState: "VERIFIED",
      verifiedAt,
      isPrimary: true,
    },
  });
  const context = await browser.newContext();
  const session = await createAccountSession("hp4-account-creator", "Brightwork Wave 6 browser qualification");
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

async function assertAccessible(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
}

async function capture(page: Page, name: string) {
  await mkdir(evidenceRoot, { recursive: true });
  await page.screenshot({ path: path.join(evidenceRoot, `${name}.png`), fullPage: true, caret: "hide" });
}

test.describe.serial("Brightwork Stage 8 Wave 6 production browser proof", () => {
  test.skip(
    !hasWave6Fixture,
    "This focused visual proof requires the task-owned Phase 5 fixture; the generic Sounding Line profile does not replace it.",
  );
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "The task-owned synthetic fixture is qualified in Chromium.",
  );

  test("Captain hierarchy, Auth states, invitation terminal, and Journal remain readable and accessible", async ({
    browser,
  }) => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000);
    await Promise.all([
      db.invitation.update({
        where: { id: "hp5-invitation-valid" },
        data: { status: "CREATED", expiresAt, revokedAt: null, acceptedAt: null, redemptionCount: 0 },
      }),
      db.invitation.update({ where: { id: "hp5-invitation-revoked" }, data: { expiresAt } }),
    ]);
    const secrets = JSON.parse(await readFile(path.join(taskRoot, "browser-state", "phase5-secrets.json"), "utf8")) as {
      invitationValid: string;
      invitationRevoked: string;
    };
    const captain = await captainContext(browser);
    const captainPage = await captain.newPage();
    const anonymous = await browser.newContext();
    const authPage = await anonymous.newPage();
    const invitationPage = await anonymous.newPage();

    try {
      const shell = await captain.request.get("/api/shell/context");
      const shellBody = await shell.json();
      expect(shell.ok(), JSON.stringify(shellBody)).toBeTruthy();
      expect(shellBody).toMatchObject({ authenticated: true, canUseCaptain: true });
      const operational = await captain.request.get("/api/captain/voyages/hp5-session-active");
      expect(operational.ok(), await operational.text()).toBeTruthy();
      await captainPage.setViewportSize({ width: 1440, height: 900 });
      const captainRoute = await captainPage.goto("/captain/sessions/hp5-session-active");
      expect(captainRoute?.status(), await captainRoute?.text()).toBe(200);
      await expect(captainPage.getByRole("heading", { name: "What needs your attention" })).toBeVisible();
      await expect(captainPage.getByText("Who is ready")).toBeVisible();
      await expect(captainPage.getByText("Who is present", { exact: true })).toBeVisible();
      await expect(captainPage.getByText("Is this view current?")).toBeVisible();
      await expect(captainPage.getByRole("navigation", { name: "Captain destinations" })).toBeVisible();
      await expect(captainPage.locator('[data-action-tier="ordinary"]')).not.toHaveCount(0);
      await expect(captainPage.locator('[data-action-tier="authority"]')).not.toHaveCount(0);
      await expect(captainPage.getByText("Review consequence before confirming")).toBeVisible();
      await assertAccessible(captainPage);
      await capture(captainPage, "captain-desktop");

      await captainPage.setViewportSize({ width: 390, height: 844 });
      await expect(captainPage.getByRole("navigation", { name: "Captain destinations" })).toBeVisible();
      await expect(captainPage.getByText("Who is ready")).toBeVisible();
      await expect(captainPage.getByText("Review consequence before confirming")).toBeVisible();
      await assertAccessible(captainPage);
      await capture(captainPage, "captain-mobile");

      await authPage.route("**/api/auth/providers", async (route) => {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            providers: [
              { provider: "GOOGLE", name: "Google", available: false, status: "UNAVAILABLE" },
              { provider: "GITHUB", name: "GitHub", available: true, status: "AVAILABLE" },
            ],
          }),
        });
      });
      await authPage.setViewportSize({ width: 1440, height: 900 });
      await authPage.goto("/sign-in?returnTo=%2Fplayer%2Flibrary");
      await expect(authPage.getByLabel("Email or Player name")).toBeVisible();
      await expect(authPage.getByRole("button", { name: "Sign in" })).toBeVisible();
      await expect(authPage.getByText("Google unavailable")).toBeVisible();
      await expect(authPage.getByText(/not configured here/i)).toBeVisible();
      await expect(authPage.getByRole("link", { name: "Return to previous page" })).toBeVisible();
      await assertAccessible(authPage);
      await capture(authPage, "auth-desktop-unavailable-provider");

      await authPage.setViewportSize({ width: 390, height: 844 });
      await expect(authPage.getByRole("button", { name: "Sign in" })).toBeVisible();
      await assertAccessible(authPage);
      await capture(authPage, "auth-mobile-unavailable-provider");

      await anonymous.addCookies([
        {
          name: "chronicle_pending_invitation",
          value: `${secrets.invitationValid}.wave6-valid-csrf`,
          url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const validResolution = await anonymous.request.get("/api/invitations/resolve");
      expect(validResolution.ok(), await validResolution.text()).toBeTruthy();
      await invitationPage.goto("/player/invitation");
      await expect(invitationPage.getByRole("main")).toHaveAttribute(
        "data-invitation-state",
        /valid|pin-required|ready/,
      );
      await expect(invitationPage.getByRole("heading").first()).toBeVisible();
      await assertAccessible(invitationPage);
      await capture(invitationPage, "invitation-success-reference");

      await anonymous.addCookies([
        {
          name: "chronicle_pending_invitation",
          value: `${secrets.invitationRevoked}.wave6-revoked-csrf`,
          url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      await invitationPage.goto("/player/invitation");
      await expect(invitationPage.getByRole("main")).toHaveAttribute("data-invitation-state", "revoked");
      await expect(invitationPage.getByText("What happened")).toBeVisible();
      await expect(invitationPage.getByText("What you can do next")).toBeVisible();
      await assertAccessible(invitationPage);
      await capture(invitationPage, "invitation-revoked");

      await captainPage.emulateMedia({ reducedMotion: "reduce" });
      await captainPage.goto("/player/playthroughs/hp5-session-active/journal");
      const journalShell = captainPage.locator(".chronicle-journal-shell");
      await expect(journalShell).toBeVisible();
      const open = captainPage.getByRole("button", { name: "Open the journal" });
      await expect
        .poll(async () => {
          if ((await journalShell.getAttribute("data-journal-phase")) === "JOURNAL_READY") return "ready";
          return (await open.isVisible().catch(() => false)) ? "openable" : "pending";
        })
        .not.toBe("pending");
      if ((await journalShell.getAttribute("data-journal-phase")) !== "JOURNAL_READY") await open.click();
      await expect(journalShell).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
      await expect(captainPage.locator(".main-journal-book")).toBeVisible();
      await expect(captainPage.locator(".main-journal-book")).toHaveAttribute("data-pageflip-status", "reduced");
      await assertAccessible(captainPage);
      await capture(captainPage, "journal-normal-reduced-motion");
    } finally {
      await Promise.all([captain.close(), anonymous.close()]);
    }
  });
});
