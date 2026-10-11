import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";

test.afterAll(() => db.$disconnect());
test("capture accepted Phase 2 Studio before Phase 3 UI edits", async ({ page, context, baseURL }) => {
  test.skip(
    process.env.PARALLAX_CAPTURE_PHASE2_BASELINE !== "1",
    "Historical baseline capture is opt-in; never overwrite it with Phase 3 screens.",
  );
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Parallax baseline Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await mkdir("artifacts/parallax-phase3/baseline", { recursive: true });
  await page.goto("/studio/parallax");
  await expect(page.getByRole("heading", { name: "Desk Map", level: 1 })).toBeVisible();
  for (const mode of ["GUIDED", "DETAILED", "ENGINEERING"]) {
    await page.getByLabel("Authoring mode").selectOption(mode);
    await page.screenshot({ path: `artifacts/parallax-phase3/baseline/desktop-${mode}.png`, fullPage: true });
  }
  await page.getByLabel("Authoring mode").selectOption("GUIDED");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/parallax-phase3/baseline/mobile-GUIDED.png", fullPage: true });
});
