import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext } from "@playwright/test";

async function login(context: BrowserContext) {
  const response = await context.request.post("/api/gm/login", {
    data: {
      username: process.env.GM_USERNAME ?? "kato",
      password: process.env.GM_PASSWORD ?? "development-captain-only",
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

test("release readiness remains truthful, persisted, and accessible", async ({ context, page }) => {
  await login(context);
  const response = await context.request.get("/api/vision-release/readiness");
  expect(response.ok(), await response.text()).toBeTruthy();
  const readiness = (await response.json()) as {
    version: string;
    readinessStatus: string;
    openBlockerCount: number;
    issues: Array<{ id: string; status: string; releaseBlocking: boolean }>;
    compatibility: Array<{ component: string }>;
  };
  expect(readiness.version).toBe("0.8.0-b6");
  expect(readiness.readinessStatus).toBe("NO_GO");
  expect(readiness.openBlockerCount).toBeGreaterThan(0);
  expect(readiness.issues.find((issue) => issue.id === "B6-005")?.releaseBlocking).toBe(true);
  expect(readiness.compatibility.map((rule) => rule.component)).toContain("COMPANION_PROTOCOL");

  await page.goto("/studio/release-readiness");
  await expect(page.getByRole("heading", { name: "Vision release readiness" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "NO GO" })).toBeVisible();
  await expect(page.getByText("Three independent real Sea of Thieves locked pilot corpora do not exist")).toBeVisible();
  await expect(page.getByText(/Experimental or synthetic behavior is not promoted/)).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("Creator Vision onboarding is skippable and revisitable", async ({ context, page }) => {
  await login(context);
  await page.goto("/studio");
  const dialog = page.getByRole("dialog", { name: "Creator Vision orientation" });
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Vision help" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/hard negatives/)).toBeVisible();
  await dialog.getByRole("button", { name: "Skip this guide" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Vision help" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close for now" }).click();
  await expect(dialog).not.toBeVisible();
});
