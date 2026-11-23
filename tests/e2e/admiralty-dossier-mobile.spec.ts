import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { db } from "../../src/lib/db";
import { authenticateClosure, closureAccount } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.beforeEach(() => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic")
    throw new Error("ADMIRALTY_DOSSIER_OWNED_PROFILE_REQUIRED");
  ensureGenericSoundingLineIsolation();
});
test.afterAll(() => db.$disconnect());

for (const width of [320, 390]) {
  test(`the account dossier exposes its complete ID and keyboard Copy at ${width}px`, async ({
    page,
    context,
    baseURL,
  }) => {
    const operator = await closureAccount("Synthetic dossier administrator");
    await db.accountRoleAssignment.create({
      data: { accountId: operator.id, role: "ADMINISTRATOR", scopeType: "GLOBAL" },
    });
    const target = await db.userAccount.create({
      data: {
        id: randomUUID(),
        status: "ACTIVE",
        profile: { create: { displayName: "Synthetic dossier target" } },
      },
    });

    await authenticateClosure(context, operator, baseURL!);
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(baseURL!).origin });
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/admin/people/${target.id}`);
    await expect(page.getByRole("heading", { name: "Synthetic dossier target", exact: true })).toBeVisible();

    const copy = page.getByRole("button", { name: "Copy account ID", exact: true });
    await expect(copy).toBeInViewport({ ratio: 1 });
    const identifier = page.locator("code").filter({ hasText: target.id });
    await expect(identifier).toHaveText(target.id);
    await expect(identifier).toBeInViewport({ ratio: 1 });
    expect(await identifier.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await copy.focus();
    await expect(copy).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(copy).toHaveText("Copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(target.id);
  });
}
