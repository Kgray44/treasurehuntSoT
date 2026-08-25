import { expect, test } from "@playwright/test";

const publicRoutes = ["/", "/tales", "/player/sign-in", "/captain/sign-in", "/studio/sign-in"] as const;
const prohibitedVisibleLanguage = [
  /\bcampaigns?\b/iu,
  /\bgame sessions?\b/iu,
  /\bgame masters?\b/iu,
  /\bstory blocks?\b/iu,
  /\bsomething went wrong\b/iu,
  /\bunknown error\b/iu,
] as const;

test("public routes present Voyagewright language without inherited product terms", async ({ page }) => {
  for (const route of publicRoutes) {
    let response;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await page.goto(route);
        break;
      } catch (error) {
        if (attempt === 0 && error instanceof Error && /interrupted by another navigation/u.test(error.message)) {
          continue;
        }
        throw error;
      }
    }
    expect(response?.ok(), `${route} should load`).toBe(true);
    const visibleText = await page.locator("body").innerText();
    for (const prohibited of prohibitedVisibleLanguage) {
      expect(visibleText, `${route} exposed ${prohibited}`).not.toMatch(prohibited);
    }
  }
  await expect(page).toHaveTitle(/Voyagewright/u);
});
