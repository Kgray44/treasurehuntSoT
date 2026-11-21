import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
import { ensureGenericSoundingLineIsolation } from "./sounding-line-isolation";
import { NCL01_EXPERIENCE_PASSWORD, NCL01_EXPERIENCE_CHRONICLE_ID } from "./ncl01-experience";

// Each test file registers its own disposable database lifecycle.
export function registerNcl01ConsumerIsolation() {
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
  return { authoringAuthority };
}

export async function accessible(page: Page) {
  // Audit the actual current destination after its owned transition settles.
  // A visible heading alone can precede the route's reveal and input readiness.
  const pathname = new URL(page.url()).pathname;
  await expect
    .poll(() =>
      page.evaluate((expectedPath) => {
        const boundaries = document.querySelectorAll<HTMLElement>("[data-route-state]");
        const boundary = boundaries[0];
        const layers = document.querySelectorAll<HTMLElement>("[data-route-layer]");
        const layer = layers[0];
        const generation =
          boundary?.getAttribute("data-route-active-generation") ?? boundary?.getAttribute("data-route-generation");
        return {
          boundaryCount: boundaries.length,
          state: boundary?.getAttribute("data-route-state"),
          layerCount: layers.length,
          currentPath: layer?.getAttribute("data-route-layer") === expectedPath,
          generationMatches: Boolean(generation && layer?.getAttribute("data-route-generation") === generation),
          opacity: layer ? getComputedStyle(layer).opacity : null,
          interactive: Boolean(
            layer &&
              !layer.inert &&
              layer.getAttribute("aria-hidden") !== "true" &&
              layer.getAttribute("data-route-interactive") !== "false" &&
              getComputedStyle(layer).visibility === "visible",
          ),
          outgoingCount: document.querySelectorAll('[data-route-role="outgoing"]').length,
        };
      }, pathname),
    )
    .toEqual({
      boundaryCount: 1,
      state: "settled",
      layerCount: 1,
      currentPath: true,
      generationMatches: true,
      opacity: "1",
      interactive: true,
      outgoingCount: 0,
    });
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
}

export async function signIn(page: Page, role: "Player" | "Captain" | "Creator" | "Administrator" | "Owner") {
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

export async function workspace(page: Page, role: string, destination: string) {
  await page.getByRole("button", { name: `Synthetic NCL01 ${role}`, exact: true }).click();
  await page
    .getByRole("dialog", { name: "Account navigation", exact: true })
    .getByRole("link", { name: destination, exact: true })
    .click();
}
