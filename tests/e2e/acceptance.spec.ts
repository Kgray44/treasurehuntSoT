import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext } from "@playwright/test";

async function expectOk(response: Awaited<ReturnType<APIRequestContext["get"]>>) {
  expect(response.ok(), `${response.url()} returned ${response.status()}: ${await response.text()}`).toBeTruthy();
  return response;
}

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "The shared isolated-database invitation journey runs once; boundary checks run in every browser.",
);

test("canonical Chronicle invitation journey keeps Player and Captain boundaries intact", async ({ browser }) => {
  test.setTimeout(180_000);
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

    const captain = captainContext.request;
    const login = await captain.post("/api/gm/login", {
      data: {
        username: process.env.GM_USERNAME ?? "kato",
        password: process.env.GM_PASSWORD ?? "development-captain-only",
      },
    });
    await expectOk(login);
    const { csrfToken } = (await login.json()) as { csrfToken: string };
    const library = await expectOk(await captain.get("/api/captain/library"));
    const body = (await library.json()) as {
      publishedTales: Array<{ id: string; versions: Array<{ id: string }> }>;
    };
    const source = body.publishedTales.find((tale) => tale.versions.length > 0);
    expect(source).toBeTruthy();

    await captainPage.goto("/captain");
    await expect(captainPage.getByRole("heading", { name: "Captain's Console" })).toBeVisible();
    const voyage = await captain.post("/api/captain/playthroughs", {
      headers: { "x-csrf-token": csrfToken },
      data: {
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
    });
    expect(voyage.status(), await voyage.text()).toBe(201);
    const created = (await voyage.json()) as { playthroughId: string; invitations: Array<{ link: string }> };
    const invitation = created.invitations[0];
    expect(invitation).toBeTruthy();

    await playerPage.goto(invitation!.link);
    await expect(playerPage).toHaveURL(/\/player\/invitation$/);
    await expect(playerPage.getByRole("button", { name: "Accept and join voyage" })).toBeVisible();
    const accept = playerPage.waitForResponse(
      (response) => response.url().endsWith("/api/invitations/accept") && response.request().method() === "POST",
    );
    await playerPage.getByRole("button", { name: "Accept and join voyage" }).click();
    expect((await accept).ok()).toBe(true);
    await expect(playerPage).toHaveURL(new RegExp(`/player/playthroughs/${created.playthroughId}$`));
    expect((await playerContext.cookies()).some((cookie) => cookie.name === "chronicle_player")).toBe(true);
    expect((await playerContext.cookies()).some((cookie) => cookie.name === "forever_gm")).toBe(false);

    await expectOk(
      await captain.post(`/api/captain/playthroughs/${created.playthroughId}/launch`, {
        headers: { "x-csrf-token": csrfToken },
        data: {},
      }),
    );
    await expect(playerPage).toHaveURL(new RegExp(`/player/playthroughs/${created.playthroughId}/journal$`), {
      timeout: 20_000,
    });
    await expect(playerPage.getByRole("button", { name: "Open the journal" })).toBeVisible();
  } finally {
    await captainContext.close();
    await playerContext.close();
  }
});
