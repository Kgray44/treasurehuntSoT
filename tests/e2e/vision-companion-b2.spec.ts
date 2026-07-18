import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const artifactRoot = process.env.VALIDATION_ARTIFACTS ?? "artifacts/validation";

async function capture(page: Page, projectName: string) {
  const directory = path.join(artifactRoot, "phase-b2");
  await fs.mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, `companion-pairing-${projectName}.png`),
    fullPage: true,
    caret: "initial",
  });
}

test("browser Companion surface preserves the explicit pairing and capture-only boundary", async ({
  page,
}, testInfo) => {
  await page.goto("/vision-companion");

  await expect(page.getByRole("heading", { name: "Capture with a visible, private boundary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pair this website with the local Companion" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Request local pairing" })).toBeEnabled();
  await expect(page.getByText("Player scans remain memory-only.")).toBeVisible();
  await expect(page.getByText("Capture quality never decides whether you are at a story location.")).toBeVisible();
  await expect(page.getByText("Enter the six-digit code shown only in the desktop Companion.")).toBeVisible();

  expect(await page.evaluate(() => Boolean(window.tallTaleDesktop))).toBe(false);
  await capture(page, testInfo.project.name);
});
