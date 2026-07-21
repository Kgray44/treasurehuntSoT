import { expect, test } from "@playwright/test";

const publicRoutes = ["/", "/tales", "/player/sign-in", "/captain/sign-in", "/studio/sign-in"] as const;
const prohibitedVisibleLanguage = [
  /\bChronicles?\b/iu,
  /\bcampaigns?\b/iu,
  /\bgame sessions?\b/iu,
  /\bgame masters?\b/iu,
  /\bstory blocks?\b/iu,
  /\bsomething went wrong\b/iu,
  /\bunknown error\b/iu,
] as const;

test("public routes present Voyagewright language without inherited product terms", async ({ page }) => {
  for (const route of publicRoutes) {
    const response = await page.goto(route);
    expect(response?.ok(), `${route} should load`).toBe(true);
    const visibleText = await page.locator("body").innerText();
    for (const prohibited of prohibitedVisibleLanguage) {
      expect(visibleText, `${route} exposed ${prohibited}`).not.toMatch(prohibited);
    }
  }
  await expect(page).toHaveTitle(/Voyagewright/u);
});
