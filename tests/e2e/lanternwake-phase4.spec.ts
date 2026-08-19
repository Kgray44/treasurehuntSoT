import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
}

test("Phase 4 gateway and authentication remain readable, responsive, and truthful in reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Choose your role in Voyagewright" })).toBeVisible();
  await expect(page.locator(".role-gateway")).toHaveAttribute("data-motion-mode", "reduced");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await expectNoSeriousAccessibilityViolations(page);

  await page.goto("/player/sign-in");
  const expectedReturnTo = "/sign-in?returnTo=%2Fplayer%2Flibrary";
  const canonicalSignIn = page.getByRole("link", { name: "Continue to account sign-in" });
  const playerName = page.getByLabel("Player name", { exact: true });
  const password = page.getByLabel("Password", { exact: true });
  const invitationCodeTab = page.getByRole("tab", { name: "Invitation code" });
  const main = page.locator("main");
  const shortCode = page.getByLabel("Short code");
  await expect(canonicalSignIn).toHaveAttribute("href", expectedReturnTo);
  await expect(playerName).toHaveCount(0);
  await expect(password).toHaveCount(0);
  await invitationCodeTab.click();
  await expect(main).toHaveAttribute("data-async-state", "idle");
  await expect(shortCode).toBeFocused();
  await expectNoSeriousAccessibilityViolations(page);
});

test("Phase 4 Studio More actions are keyboard-operated and stay inside the mobile viewport", async ({ page }) => {
  const login = await page.request.post("/api/gm/login", {
    data: {
      username: process.env.GM_USERNAME ?? "kato",
      password: process.env.GM_PASSWORD ?? "development-captain-only",
    },
  });
  expect(login.ok()).toBe(true);
  const response = await page.request.get("/api/studio/tales");
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as { tales: Array<{ id: string; slug: string }> };
  const tale = payload.tales.find((item) => item.slug === "development-studio-voyage");
  expect(tale).toBeTruthy();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/studio/tales/${tale!.id}`);
  const more = page.getByRole("button", { name: "More", exact: true });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Duplicate Chronicle" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect(more).toBeFocused();
  await expectNoSeriousAccessibilityViolations(page);
});
