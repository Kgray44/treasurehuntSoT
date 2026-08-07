import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { db } from "../../src/lib/db";
import { registerAccount } from "../../src/wayfarer/accounts";

type BrowserFetchInit = Readonly<{
  method?: "GET" | "POST";
  headers?: Readonly<Record<string, string>>;
  body?: unknown;
}>;

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
        // Keep a non-JSON error contract inspectable by the browser acceptance assertion.
      }
      return { status: response.status, body };
    },
    { requestUrl: url, requestInit: init },
  ) as Promise<{ status: number; body: T }>;
}

async function openInvitationWhenReady(page: Page, invitationLink: string) {
  await page.goto(invitationLink);
  await expect(page).toHaveURL(/\/player\/invitation$/);
  const unavailable = page.getByRole("heading", { name: "The invitation could not be reached" });
  if (await unavailable.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Try again" }).click();
  }
  await expect(page.locator("main.invitation-page")).toHaveAttribute("data-invitation-state", "valid");
}

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "The shared isolated-database invitation journey runs once; boundary checks run in every browser.",
);

test("canonical Chronicle invitation journey keeps Player and Captain boundaries intact", async ({ browser }) => {
  test.setTimeout(180_000);
  const suffix = randomUUID().slice(0, 8);
  const captainEmail = `homeport-acceptance-captain-${suffix}@example.invalid`;
  const captainPassword = "Homeport-acceptance-passphrase-2026";
  const captainAccount = await registerAccount({
    email: captainEmail,
    password: captainPassword,
    displayName: `Homeport Acceptance Captain ${suffix}`,
  });
  const gameMaster = await db.gameMasterUser.create({
    data: { username: `homeport-acceptance-${suffix}`, passwordHash: await hash(captainPassword, 4) },
  });
  await db.userAccount.update({
    where: { id: captainAccount.account.id },
    data: { status: "ACTIVE", legacyGameMasterId: gameMaster.id },
  });
  await db.accountRoleAssignment.create({ data: { accountId: captainAccount.account.id, role: "CAPTAIN" } });
  const captainContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const captainPage = await captainContext.newPage();
  const playerPage = await playerContext.newPage();
  try {
    await playerPage.goto("/player/sign-in#invitation-code");
    await expect(playerPage.getByRole("heading", { name: "Open your Chronicle Library" })).toBeVisible();
    await expect(playerPage.getByRole("tab", { name: "Invitation code" })).toBeVisible();
    const playerAxe = await new AxeBuilder({ page: playerPage }).analyze();
    expect(playerAxe.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);

    await captainPage.goto("/captain/sign-in");
    await expect(captainPage.getByRole("heading", { name: "Open the Captain's Console" })).toBeVisible();
    await captainPage.getByRole("link", { name: "Continue to account sign-in" }).click();
    await captainPage.getByLabel("Email or legacy Player name").fill(captainEmail);
    await captainPage.getByLabel("Password").fill(captainPassword);
    await captainPage.getByLabel("Password").press("Enter");
    await expect(captainPage).toHaveURL(/\/captain\/library(?:\?.*)?$/u);
    await expect(captainPage.getByRole("heading", { name: "Captain's Console", exact: true })).toBeVisible();

    const status = await browserJson<{ csrfToken: string }>(captainPage, "/api/gm/status");
    expect(status.status).toBe(200);
    const { csrfToken } = status.body;
    const library = await browserJson<{
      publishedTales: Array<{ id: string; versions: Array<{ id: string }> }>;
    }>(captainPage, "/api/captain/library");
    expect(library.status).toBe(200);
    const source = library.body.publishedTales.find((tale) => tale.versions.length > 0);
    expect(source).toBeTruthy();

    // Fixture creation stays in the authenticated Captain browser session; acceptance remains the visible invitation journey.
    const voyage = await browserJson<{ playthroughId: string; invitations: Array<{ link: string }> }>(
      captainPage,
      "/api/captain/playthroughs",
      {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
        body: {
          taleId: source!.id,
          versionId: source!.versions[0]!.id,
          voyageName: `Canonical acceptance ${crypto.randomUUID().slice(0, 8)}`,
          captainMode: "CAPTAIN_CONTROLLED",
          hints: "ON_REQUEST",
          sideQuests: true,
          scheduleTimezone: "America/New_York",
          accessibilityDefaults: { motion: "SYSTEM" },
          expiresInHours: 24,
          accountRequired: false,
          maxRedemptions: 1,
          players: [{ displayName: "Canonical Navigator", crewRole: "Navigator" }],
        },
      },
    );
    expect(voyage.status).toBe(201);
    const created = voyage.body;
    const invitation = created.invitations[0];
    expect(invitation).toBeTruthy();

    // Compile the guarded route before the Player opens the invitation. In the
    // development acceptance server, a route's first compile triggers a Next
    // refresh that would otherwise abort the real visible submission below.
    // A Captain has no pending invitation credential, so this browser-session
    // request is a non-mutating proof of the expected CSRF/authorization denial.
    const guardedAccept = await browserJson(captainPage, "/api/invitations/accept", {
      method: "POST",
      headers: { "x-csrf-token": csrfToken },
      body: {},
    });
    expect(guardedAccept.status).toBe(403);

    await openInvitationWhenReady(playerPage, invitation!.link);
    const acceptButton = playerPage.getByRole("button", { name: "Accept and join voyage" });
    await expect(acceptButton).toBeEnabled();
    await expect(acceptButton).toHaveAttribute("aria-busy", "false");
    const accept = playerPage.waitForResponse(
      (response) => response.url().endsWith("/api/invitations/accept") && response.request().method() === "POST",
      { timeout: 20_000 },
    );
    // Compile the authenticated destination before the visible acceptance
    // transition. The unauthenticated response is expected to deny access;
    // this is only a route warmup and cannot mutate invitation state.
    const destinationWarmup = await playerPage.request.get(`/player/playthroughs/${created.playthroughId}`);
    expect([200, 302, 303, 307, 308]).toContain(destinationWarmup.status());
    // Use the normal visible browser activation so Playwright follows the canonical handoff.
    // The authoritative response and resulting route are asserted separately below.
    await acceptButton.click();
    expect((await accept).ok()).toBe(true);
    await expect(playerPage).toHaveURL(new RegExp(`/player/playthroughs/${created.playthroughId}$`));
    expect((await playerContext.cookies()).some((cookie) => cookie.name === "wayfarer_account")).toBe(true);
    expect((await playerContext.cookies()).some((cookie) => cookie.name === "chronicle_player")).toBe(false);
    expect((await playerContext.cookies()).some((cookie) => cookie.name === "forever_gm")).toBe(false);

    const launch = await browserJson(captainPage, `/api/captain/playthroughs/${created.playthroughId}/launch`, {
      method: "POST",
      headers: { "x-csrf-token": csrfToken },
      body: {},
    });
    expect(launch.status).toBe(200);
    await expect(playerPage).toHaveURL(new RegExp(`/player/playthroughs/${created.playthroughId}/journal$`), {
      timeout: 20_000,
    });
    await playerPage.getByRole("button", { name: "Open the journal" }).click();
    await playerPage.getByRole("button", { name: "Skip ceremony" }).click();
    const journal = playerPage.locator(".chronicle-journal-shell").last();
    await expect(journal).toHaveAttribute("data-journal-phase", "JOURNAL_READY", { timeout: 20_000 });
    await expect(journal.getByRole("heading", { name: /Voyage Journal$/ })).toBeVisible();
  } finally {
    await captainContext.close();
    await playerContext.close();
  }
});
