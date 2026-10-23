import { expect, test } from "@playwright/test";
import { accessible, signIn, workspace, registerNcl01ConsumerIsolation } from "./fixtures/ncl01-consumer";
import { NCL01_EXPERIENCE_CHRONICLE_ID } from "./fixtures/ncl01-experience";

// Real UI journeys against disposable generic-suite data; no response is mocked.
const { authoringAuthority } = registerNcl01ConsumerIsolation();

test("anonymous account navigation exposes registration and its conventional sign-in return", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choose your role in Voyagewright", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Account navigation", exact: true })
    .getByRole("link", { name: "Create Account", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Create your account", exact: true })).toBeVisible();
  await expect(page.getByLabel("Display name", { exact: true })).toBeVisible();
  await accessible(page);
  await page.getByRole("link", { name: "Already have an account? Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email or Player name", exact: true })).toBeVisible();
});

test("Player returns through account and real version-pinned private history", async ({ page }) => {
  await signIn(page, "Player");
  await page.getByRole("link", { name: "Edit Public Profile", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Public Profile", exact: true })).toBeVisible();
  await accessible(page);
  await page.getByRole("link", { name: "Return to Home", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose your role in Voyagewright", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Synthetic NCL01 Player", exact: true }).click();
  const accountMenu = page.getByRole("dialog", { name: "Account navigation", exact: true });
  await expect(accountMenu.getByRole("link", { name: "Admiralty", exact: true })).toHaveCount(0);
  await accountMenu.getByRole("link", { name: "Personal Harbor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Synthetic NCL01 Player", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open Chronicle Passport", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chronicle Passport", exact: true, level: 1 })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Chronicle Passport sections", exact: true })
    .getByRole("link", { name: "Your Voyages", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Your private shelf", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NCL01 Consumer Chronicle", exact: true })).toBeVisible();
  const detailLink = page.getByRole("link", { name: "Open NCL01 Consumer Chronicle Voyage", exact: true });
  const detailHref = await detailLink.getAttribute("href");
  expect(detailHref).toMatch(/^\/passport\/history\/[A-Za-z0-9_-]+$/u);
  const detailUrl = new URL(detailHref!, page.url()).href;
  await detailLink.click();
  await expect(page).toHaveURL(detailUrl);
  await expect(page.getByRole("heading", { name: "NCL01 Consumer Chronicle", exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Exact Edition", exact: true })
      .getByText("Synthetic account history v1", { exact: true }),
  ).toBeVisible();
  await accessible(page);
  await page.getByRole("link", { name: "Back to Your Voyages", exact: true }).click();
  await page.getByRole("link", { name: "Personal Harbor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overview", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Synthetic NCL01 Player", exact: true })).toBeVisible();
  const denied = await page.goto("/dev/spatial-pilot");
  expect(denied?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "The Lost Navigator’s Chart", exact: true })).toHaveCount(0);
  const adminDenied = await page.goto("/admin");
  expect(adminDenied?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Platform Overview", exact: true })).toHaveCount(0);
});

test("Creator opens the actual owned draft and cancels creation without publishing", async ({ page }) => {
  const before = await authoringAuthority();
  expect(before.drafts).toHaveLength(1);
  expect(before.drafts[0]).toMatchObject({ validationState: "NOT_VALIDATED", lastValidatedAt: null });
  expect(before.versions).toHaveLength(1);
  await signIn(page, "Creator");
  await workspace(page, "Creator", "Creator Studio");
  await expect(page.getByRole("heading", { name: "Voyagewright Studio", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NCL01 Consumer Chronicle", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Edit Chronicle", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/studio/tales/${NCL01_EXPERIENCE_CHRONICLE_ID}$`, "u"));
  await expect(page.getByRole("heading", { name: "NCL01 Consumer Chronicle", exact: true, level: 1 })).toBeVisible();
  await accessible(page);
  await page.getByRole("link", { name: "← Studio", exact: true }).click();
  await page.getByRole("link", { name: "Create Chronicle", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create Chronicle", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Voyagewright Studio", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NCL01 Consumer Chronicle", exact: true })).toHaveCount(1);
  expect(await authoringAuthority()).toEqual(before);
});

test("Captain reads eligible editions and closes the real Voyage wizard without creating a Voyage", async ({
  page,
}) => {
  await signIn(page, "Captain");
  await workspace(page, "Captain", "Captain");
  await expect(page.getByRole("heading", { name: "No Captain Voyages yet", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Published Chronicles", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The Forever Treasure — Studio Development Voyage", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "NCL01 Consumer Chronicle", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Voyages", exact: true }).click();
  await page
    .locator("main.captain-library > header")
    .getByRole("button", { name: "Create a Voyage", exact: true })
    .click();
  const wizard = page.getByRole("dialog");
  await expect(wizard).toBeVisible();
  await accessible(page);
  await wizard.getByRole("button", { name: "Close Voyage wizard", exact: true }).click();
  await expect(wizard).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No Captain Voyages yet", exact: true })).toBeVisible();
});

test("isolated fixed Owner opens Sea Trials and follows the actual conventional return", async ({ page }) => {
  await signIn(page, "Owner");
  await page.goto("/dev/spatial-pilot");
  await expect(page.getByRole("heading", { name: "The Lost Navigator’s Chart", exact: true })).toBeVisible();
  await expect(
    page.getByText("OWNER_ACCEPTANCE_PENDING · OWNER_PHYSICAL_ACCEPTANCE_PENDING", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare the adventure", exact: true })).toBeVisible();
  await accessible(page);
  await page.getByRole("link", { name: "Player Library", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My Chronicle Library", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No Chronicles yet", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Voyagewright home", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose your role in Voyagewright", exact: true })).toBeVisible();
  await workspace(page, "Owner", "Personal Harbor");
  await expect(page).toHaveURL(/\/account$/u);
  await expect(page.getByRole("heading", { name: "Synthetic NCL01 Owner", exact: true })).toBeVisible();
});

test("public Community and Chronicle discovery preserve private history through empty-state recovery", async ({
  page,
}) => {
  await page.goto("/community/chronicles");
  await expect(page.getByRole("heading", { name: "Chronicles", exact: true, level: 1 })).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search public Community Harbor", exact: true });
  await search.fill("NCL01 Consumer Chronicle");
  await page.getByRole("button", { name: "Search Community Harbor", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No public charts match these criteria", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NCL01 Consumer Chronicle", exact: true })).toHaveCount(0);
  await accessible(page);
  await search.fill("");
  await page.getByRole("button", { name: "Search Community Harbor", exact: true }).click();
  await expect(
    page.getByText("The Harbor shelves below are ready to browse without a search.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "No public charts match these criteria", exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Harbor Home", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Find your next bearing", exact: true })).toBeVisible();
  await page.goto("/tales");
  await expect(page.getByRole("heading", { name: "Choose a Chronicle", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "The Forever Treasure — Studio Development Voyage", exact: true }),
  ).toBeVisible();
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("NCL01 Consumer Chronicle");
  await expect(page.getByRole("heading", { name: "No Chronicles match these filters", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NCL01 Consumer Chronicle", exact: true })).toHaveCount(0);
  await accessible(page);
  await page.getByRole("button", { name: "Clear Filters", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The Forever Treasure — Studio Development Voyage", exact: true }),
  ).toBeVisible();
  const publicChronicle = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "The Forever Treasure — Studio Development Voyage", exact: true }),
  });
  await publicChronicle.getByRole("link", { name: "Preview Chronicle", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The Forever Treasure — Studio Development Voyage", exact: true, level: 1 }),
  ).toBeVisible();
  // This is the actual public-detail route; /tales/<slug> has no product page.
  const privateDetail = await page.goto("/chronicles/ncl01-consumer-chronicle");
  expect(privateDetail?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "NCL01 Consumer Chronicle", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Voyagewright home", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose your role in Voyagewright", exact: true })).toBeVisible();
});
