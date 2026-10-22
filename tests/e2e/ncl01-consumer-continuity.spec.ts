import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { NCL01_EXPERIENCE_PASSWORD, NCL01_EXPERIENCE_CHRONICLE_ID } from "./fixtures/ncl01-experience";

// These are real UI journeys against disposable generic-suite data. No transport,
// account, history, catalog or workspace response is mocked or pre-authenticated.
let database: PrismaClient | undefined;
test.beforeAll(async ({ baseURL }) => {
  if (
    process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic" ||
    !baseURL ||
    !["127.0.0.1", "localhost", "[::1]"].includes(new URL(baseURL).hostname)
  )
    throw new Error("NCL01_CONSUMER_OWNED_LOOPBACK_REQUIRED");
  ensureGenericSoundingLineIsolation();
  database = new PrismaClient();
});
test.afterAll(async () => database?.$disconnect());

async function authoringAuthority() {
  if (!database) throw new Error("NCL01_CONSUMER_DATABASE_GUARD_REQUIRED");
  return database.chronicle.findUniqueOrThrow({
    where: { id: NCL01_EXPERIENCE_CHRONICLE_ID },
    select: {
      status: true,
      visibility: true,
      currentDraftRevisionId: true,
      latestPublishedVersionId: true,
      drafts: {
        orderBy: { revisionNumber: "asc" },
        select: {
          id: true,
          autosaveVersion: true,
          validationState: true,
          validationSummary: true,
          lastValidatedAt: true,
        },
      },
      versions: { orderBy: { versionNumber: "asc" }, select: { id: true, versionNumber: true, checksum: true } },
    },
  });
}

async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
}

async function signIn(page: Page, role: "Player" | "Captain" | "Creator" | "Administrator" | "Owner") {
  await page.goto("/sign-in?returnTo=%2Faccount");
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.locator("form")).toHaveAttribute("method", "post");
  await expect(page.getByRole("button", { name: /^(Checking Google|Checking GitHub)$/u })).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Email or Player name", exact: true })
    .fill(`ncl01-review-${role.toLowerCase()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(NCL01_EXPERIENCE_PASSWORD);
  const response = page.waitForResponse(
    (value) => new URL(value.url()).pathname === "/api/auth/sign-in" && value.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/account$/u);
  await expect(page.getByRole("heading", { name: `Synthetic NCL01 ${role}`, exact: true })).toBeVisible();
}

async function workspace(page: Page, role: string, destination: string) {
  await page.getByRole("button", { name: `Synthetic NCL01 ${role}`, exact: true }).click();
  await page
    .getByRole("dialog", { name: "Account navigation", exact: true })
    .getByRole("link", { name: destination, exact: true })
    .click();
}

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
  await page.getByRole("link", { name: "Open NCL01 Consumer Chronicle Voyage", exact: true }).click();
  await expect(page.getByRole("heading", { name: "NCL01 Consumer Chronicle", exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic account history v1", { exact: true })).toBeVisible();
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

test("Administrator uses the real privacy-preserving People empty state and returns to the same account", async ({
  page,
}) => {
  await signIn(page, "Administrator");
  await workspace(page, "Administrator", "Admiralty");
  await page.getByRole("link", { name: "People", exact: true }).click();
  await expect(page.getByRole("heading", { name: "People", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole("main").getByText("Start with a known clue", { exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await accessible(page);
  await page.getByRole("link", { name: "Return to account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Synthetic NCL01 Administrator", exact: true })).toBeVisible();
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
