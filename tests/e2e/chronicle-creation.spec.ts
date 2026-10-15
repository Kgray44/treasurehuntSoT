import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";

test.skip(({ browserName }) => browserName !== "chromium", "Isolated mutable Chronicle journeys run on Chromium.");

async function signIn(page: Page) {
  await page.goto("/sign-in?returnTo=%2Fstudio%2Flibrary");
  await page.getByLabel("Email or Player name", { exact: true }).fill("parallax-review-creator@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Synthetic-Parallax-Review-2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Voyagewright Studio", exact: true })).toBeVisible();
}

async function createManual(page: Page) {
  await page
    .getByRole("navigation", { name: "Studio destinations" })
    .getByRole("link", { name: "Create Chronicle", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Create a Chronicle", exact: true })).toBeVisible();
  const manual = page.getByRole("button", { name: /Create Manually/ });
  await expect(manual).toBeEnabled();
  await manual.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Rename Chronicle: Untitled Chronicle", exact: true })).toBeVisible();
  return new URL(page.url()).pathname.split("/").at(-1)!;
}

async function setAppearance(page: Page, theme: "DARK" | "LIGHT", csrfToken: string) {
  const preferences = await (await page.request.get("/api/passport/preferences")).json();
  const response = await page.request.put("/api/passport/preferences", {
    headers: { "x-csrf-token": csrfToken },
    data: {
      preferences: {
        ...preferences.preferences,
        experience: { ...preferences.preferences.experience, theme, motion: "SYSTEM" },
      },
    },
  });
  expect(response.ok()).toBe(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", theme.toLowerCase());
}

for (const device of ["desktop", "mobile"] as const) {
  // @sounding-line-registration owner=one-voyage suite=browser.studio contracts=chronicle.creation,authentication-authorization,publishing-browser browserProject=chromium sourceProject=chromium
  test(`Chronicle creation ${device} chooses, edits, saves and reopens the real draft`, async ({ page }) => {
    await page.setViewportSize(device === "desktop" ? { width: 1440, height: 1000 } : { width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: device === "mobile" ? "reduce" : "no-preference" });
    await signIn(page);
    const catalogBefore = await (await page.request.get("/api/studio/tales")).json();
    await page
      .getByRole("navigation", { name: "Studio destinations" })
      .getByRole("link", { name: "Create Chronicle", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Create a Chronicle" })).toBeVisible();
    for (const name of ["Create with AI", "Adapt a Story", "Start from a Template"]) {
      const choice = page.getByRole("button", { name: new RegExp(name) });
      await expect(choice).toBeDisabled();
      await expect(choice).toContainText("Coming soon");
    }
    expect((await (await page.request.get("/api/studio/tales")).json()).tales.length).toBe(catalogBefore.tales.length);
    for (const theme of ["DARK", "LIGHT"] as const) {
      await setAppearance(page, theme, catalogBefore.csrfToken);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `artifacts/screenshots/sc-00a-${device}-${theme.toLowerCase()}-choices.png`,
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: /Create Manually/ }).focus();
    await page.keyboard.press("Enter");
    const rename = page.getByRole("button", { name: "Rename Chronicle: Untitled Chronicle", exact: true });
    await expect(rename).toBeVisible();
    const taleId = new URL(page.url()).pathname.split("/").at(-1)!;
    const title = `Synthetic SC-00A ${device} ${Date.now()}`;
    await rename.click();
    await page.getByRole("textbox", { name: "Chronicle title", exact: true }).fill("Cancelled title");
    await page.keyboard.press("Escape");
    await expect(rename).toBeFocused();
    await page.keyboard.press("Enter");
    await page.getByRole("textbox", { name: "Chronicle title", exact: true }).fill(title);
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Chronicle Details", exact: true }).click();
    const details = page.getByRole("region", { name: "Chronicle Details" });
    await expect(details.getByRole("heading", { name: "Chronicle Details" })).toBeFocused();
    await details.getByLabel("Subtitle", { exact: true }).fill("A synthetic adventure in progress");
    await details
      .getByLabel("Short description", { exact: true })
      .fill("A safe, disposable Chronicle creation journey.");
    await details
      .getByLabel("Long description", { exact: true })
      .fill("The crew begins with a blank page and a new horizon.");
    await details.getByLabel("Minimum players", { exact: true }).fill("2");
    await details.getByLabel("Maximum players", { exact: true }).fill("6");
    await details.getByLabel("Estimated minutes", { exact: true }).fill("45");
    await details.getByLabel("Theme", { exact: true }).selectOption("MOONLIT_JOURNAL");
    await details.getByLabel("Content warnings", { exact: true }).fill("Fictional storms");
    await details.getByRole("button", { name: "Save details" }).click();
    await expect(page.locator(".save-state")).toContainText("Saved at");
    const persisted = await (await page.request.get(`/api/studio/tales/${taleId}`)).json();
    expect(persisted.tale).toMatchObject({
      title,
      subtitle: "A synthetic adventure in progress",
      playerCountMin: 2,
      playerCountMax: 6,
      estimatedDuration: 45,
      theme: "MOONLIT_JOURNAL",
      contentWarnings: "Fictional storms",
    });
    await details.getByRole("button", { name: "Close Chronicle Details" }).click();
    await expect(page.getByRole("button", { name: "Chronicle Details", exact: true })).toBeFocused();
    await page
      .getByRole("navigation", { name: "Chronicle authoring sections" })
      .getByRole("link", { name: "Assets", exact: true })
      .click();
    const cover = await sharp({ create: { width: 48, height: 48, channels: 4, background: "#397a79" } })
      .png()
      .toBuffer();
    await page
      .locator(".asset-drawer input[type=file]")
      .setInputFiles({ name: "synthetic-sc-00a-cover.png", mimeType: "image/png", buffer: cover });
    await expect(page.locator(".upload-progress-list [data-upload-state=ready]")).toHaveCount(1);
    await page.getByRole("button", { name: "Close asset drawer" }).click();
    await page
      .getByRole("navigation", { name: "Chronicle authoring sections" })
      .getByRole("link", { name: "Chronicle Details", exact: true })
      .click();
    await page.getByLabel("Cover asset", { exact: true }).selectOption({ label: "synthetic-sc-00a-cover.png" });
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.locator(".save-state")).toContainText("Saved at");
    const covered = await (await page.request.get(`/api/studio/tales/${taleId}`)).json();
    expect(covered.tale.coverAssetId).toBeTruthy();
    for (const theme of ["DARK", "LIGHT"] as const) {
      await setAppearance(page, theme, catalogBefore.csrfToken);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `artifacts/screenshots/sc-00a-${device}-${theme.toLowerCase()}-details.png`,
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: "Close Chronicle Details" }).click();
    await page.locator(".editor-topbar").getByRole("link", { name: "← Studio" }).click();
    await expect(page.getByRole("heading", { name: "Voyagewright Studio", exact: true })).toBeVisible();
    await page
      .locator(".tale-card-grid article")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
      .getByRole("link", { name: "Edit Chronicle", exact: true })
      .click();
    await expect(page.getByRole("button", { name: `Rename Chronicle: ${title}`, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Chronicle Details", exact: true }).click();
    await expect(page.getByLabel("Subtitle", { exact: true })).toHaveValue("A synthetic adventure in progress");
    await expect(page.locator(".timeline-block")).toHaveCount(0);
    await page.getByRole("button", { name: "Validate Chronicle", exact: true }).click();
    const publication = await page.request.post(`/api/studio/tales/${taleId}/publish`, {
      headers: { "x-csrf-token": persisted.csrfToken },
      data: {},
    });
    expect(publication.status()).toBe(422);
    expect((await publication.json()).code).toMatch(/VALIDATION_FAILED|DRYDOCK_READINESS_NOT_VERIFIED/);
    expect(
      (await (await page.request.get(`/api/studio/tales/${taleId}`)).json()).tale.latestPublishedVersionId,
    ).toBeNull();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

// @sounding-line-registration owner=one-voyage suite=browser.studio contracts=chronicle.creation browserProject=chromium sourceProject=chromium
test("Chronicle metadata conflict preserves edits and supports cancel or latest-draft recovery", async ({
  page,
  context,
}) => {
  await signIn(page);
  const taleId = await createManual(page);
  const other = await context.newPage();
  await other.goto(`/studio/tales/${taleId}/settings`);
  await expect(other.getByRole("region", { name: "Chronicle Details" })).toBeVisible();
  await page.getByRole("button", { name: "Chronicle Details", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Saved by first window");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.locator(".save-state")).toContainText("Saved at");
  await other.getByLabel("Title", { exact: true }).fill("Local unsaved title");
  await other.getByRole("button", { name: "Save details" }).click();
  const conflict = other.getByRole("alert", { name: "Draft conflict" });
  await expect(conflict).toContainText("Saved by first window");
  await expect(other.getByLabel("Title", { exact: true })).toHaveValue("Local unsaved title");
  await conflict.getByRole("button", { name: "Load latest saved draft" }).click();
  await other.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(other.getByLabel("Title", { exact: true })).toHaveValue("Local unsaved title");
  await conflict.getByRole("button", { name: "Load latest saved draft" }).click();
  await other.getByRole("button", { name: "Load latest draft", exact: true }).click();
  await expect(other.getByLabel("Title", { exact: true })).toHaveValue("Saved by first window");
  await expect(conflict).toHaveCount(0);
  await other.close();
});
