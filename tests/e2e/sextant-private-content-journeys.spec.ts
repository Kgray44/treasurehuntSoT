// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.shared-consumers.private-content
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../../src/lib/db";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";
import { decryptPrivatePackage, encryptPrivatePayload } from "../../src/private-content/package";
import { seedSextantPrivateContentExperience } from "../../.agents/scripts/sextant-private-content-fixture";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.describe.configure({ mode: "default", timeout: 180000 });
test.use({ video: "on", trace: "retain-on-failure", screenshot: "only-on-failure" });
test.beforeAll(async () => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("SEXTANT_OWNED_BROWSER_REQUIRED");
  ensureGenericSoundingLineIsolation();
  const taskRoot = process.env.SEXTANT_PRIVATE_CONTENT_TEST_ROOT ?? "";
  if (!path.isAbsolute(taskRoot)) throw new Error("SEXTANT_PRIVATE_STORAGE_REQUIRED");
  const marker = JSON.parse(await readFile(path.join(taskRoot, "identity.json"), "utf8"));
  const source = await deviceLabSourceIdentity();
  const outside = path.relative(process.cwd(), taskRoot);
  if (
    marker.classification !== "OWNED_SYNTHETIC_PRIVATE_CONTENT_DEVELOPMENT" ||
    marker.sourceSha !== source.sourceSha ||
    marker.databaseUrl !== process.env.DATABASE_URL ||
    marker.taskRoot !== taskRoot ||
    !outside ||
    (!outside.startsWith(`..${path.sep}`) && !path.isAbsolute(outside)) ||
    process.env.PRIVATE_CONTENT_ROOT !== path.join(taskRoot, "objects") ||
    process.env.PRIVATE_CONTENT_STAGING_ROOT !== path.join(taskRoot, "staging") ||
    process.env.PRIVATE_CONTENT_PROVIDER_ROOT !== path.join(taskRoot, "provider") ||
    !/^[a-f0-9]{64}$/.test(process.env.PRIVATE_CONTENT_LOCAL_MASTER_KEY ?? "")
  )
    throw new Error("SEXTANT_PRIVATE_STORAGE_IDENTITY_MISMATCH");
});
test.afterAll(() => db.$disconnect());
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test.describe(`${viewport.width}px ${reducedMotion}`, () => {
      test.use({ viewport, contextOptions: { reducedMotion } });
      test("ordinary private package inspection, explicit import, verified export and canonical draft return", async ({
        page,
      }, info) => {
        const key = `private-content-${viewport.width}-${reducedMotion}` as
          | "private-content-1280-no-preference"
          | "private-content-1280-reduce"
          | "private-content-390-no-preference"
          | "private-content-390-reduce";
        const fixture = await seedSextantPrivateContentExperience(key);
        expect(await seedSextantPrivateContentExperience(key)).toEqual(fixture);
        const ids = [fixture.voyageId, fixture.playerVoyageId];
        const readBaselines = () =>
          db.taleSession.findMany({
            where: { id: { in: ids } },
            orderBy: { id: "asc" },
            select: { id: true, status: true, currentBlockId: true, currentSequence: true, publishedVersionId: true },
          });
        const baseline = await readBaselines();
        expect(baseline).toHaveLength(2);
        const versionIds = baseline.map((row) => row.publishedVersionId!);
        const readEditions = () =>
          db.publishedTaleVersion.findMany({
            where: { id: { in: versionIds } },
            orderBy: { id: "asc" },
            select: { id: true, checksum: true, contentSnapshot: true },
          });
        const editions = await readEditions();
        const countBefore = await db.chronicle.count({ where: { creatorAccountId: fixture.ownerId } });
        expect(await db.privateContentImport.count({ where: { ownerAccountId: fixture.ownerId } })).toBe(0);
        expect(await db.chronicle.findUnique({ where: { slug: fixture.slug } })).toBeNull();
        const passphrase = "Synthetic-Sextant-Package-2026!";
        const packageBytes = await encryptPrivatePayload(fixture.payload, passphrase);
        const feedback: Array<{ task: string; elapsedMs: number }> = [];
        const measure = async (task: string, activate: () => Promise<unknown>, ready: () => Promise<unknown>) => {
          const began = performance.now();
          await activate();
          await ready();
          const elapsedMs = performance.now() - began;
          feedback.push({ task, elapsedMs });
          expect(elapsedMs, task).toBeLessThanOrEqual(3000);
        };
        const heading = (name: string) => page.getByRole("heading", { name, exact: true });
        const capture = async (
          name: string,
          target = heading("Private content"),
          scope = ".studio-private-content",
        ) => {
          expect((await new AxeBuilder({ page }).include(scope).analyze()).violations).toEqual([]);
          await target.scrollIntoViewIfNeeded();
          await expect(target).toBeInViewport();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await page.screenshot({ path: info.outputPath(`${name}.png`) });
        };
        await page.goto("/sign-in?returnTo=%2Faccount");
        await page.getByRole("textbox", { name: "Email or Player name", exact: true }).fill(fixture.email);
        await page.getByRole("textbox", { name: "Password", exact: true }).fill("Synthetic-Sextant-Resources-2026!");
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await expect(heading("Overview")).toBeVisible();
        const enterLibrary = async () => {
          await page.getByRole("button", { name: fixture.displayName, exact: true }).click();
          await page.getByRole("link", { name: "All Workspaces", exact: true }).click();
          await page.getByRole("link", { name: "Enter Creator", exact: true }).click();
          await expect(heading("Voyagewright Studio")).toBeVisible();
        };
        await enterLibrary();
        await measure(
          "Ordinary Private Chronicle entry",
          () => page.getByRole("link", { name: "Private Chronicle", exact: true }).click(),
          () => expect(heading("Private content")).toBeVisible(),
        );
        await expect(page.getByRole("button", { name: "Inspect package", exact: true })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Confirm private import", exact: true })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Export verified package", exact: true })).toBeDisabled();
        await expect(
          page.getByText("No private import has completed in this workspace yet.", { exact: true }),
        ).toBeVisible();
        await capture("private-content-empty");
        const chooserReady = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: "Select protected package", exact: true }).click();
        await (
          await chooserReady
        ).setFiles({ name: `${fixture.packageId}.ftprivate`, mimeType: "application/json", buffer: packageBytes });
        const secret = page.getByLabel("Passphrase", { exact: true });
        await secret.fill("Wrong-synthetic-package-passphrase");
        const inspect = async (status: number) => {
          const response = page.waitForResponse(
            (r) =>
              new URL(r.url()).pathname === "/api/studio/private-content/inspect" && r.request().method() === "POST",
          );
          await page.getByRole("button", { name: "Inspect package", exact: true }).click();
          const result = await response;
          expect(result.status()).toBe(status);
          return result;
        };
        await measure(
          "Actual rejected package authentication",
          () => inspect(400),
          () =>
            expect(
              page.getByText("The private package could not be authenticated or opened.", { exact: true }),
            ).toBeVisible(),
        );
        expect(await db.privateContentImport.count({ where: { ownerAccountId: fixture.ownerId } })).toBe(0);
        await capture("private-content-wrong-passphrase", heading("Inspect an encrypted package"));
        const rejectedStatus = page.getByText("The private package could not be authenticated or opened.", {
          exact: true,
        });
        await rejectedStatus.scrollIntoViewIfNeeded();
        await expect(rejectedStatus).toBeInViewport({ ratio: 1 });
        await capture("private-content-rejected-status", rejectedStatus);
        await secret.fill(passphrase);
        await measure(
          "Actual package inspection without import",
          () => inspect(200),
          () =>
            expect(
              page.getByText("Inspection succeeded. Import remains private and is not yet committed.", { exact: true }),
            ).toBeVisible(),
        );
        await expect(page.getByRole("status").filter({ hasText: "Plan:" })).toContainText(
          `${fixture.packageId}, revision 1, 0 assets`,
        );
        expect(await db.privateContentImport.count({ where: { ownerAccountId: fixture.ownerId } })).toBe(0);
        expect(await db.chronicle.count({ where: { creatorAccountId: fixture.ownerId } })).toBe(countBefore);
        await capture("private-content-inspected-plan", heading("Inspect an encrypted package"));
        const inspectedStatus = page.getByText(
          "Inspection succeeded. Import remains private and is not yet committed.",
          { exact: true },
        );
        await inspectedStatus.scrollIntoViewIfNeeded();
        await expect(inspectedStatus).toBeInViewport({ ratio: 1 });
        await expect(page.getByRole("status").filter({ hasText: "Plan:" })).toBeInViewport({ ratio: 1 });
        await expect(page.getByRole("button", { name: "Confirm private import", exact: true })).toBeInViewport({
          ratio: 1,
        });
        const confirmImport = page.getByRole("button", { name: "Confirm private import", exact: true });
        await measure(
          "Settled readable private confirmation hover",
          () => confirmImport.hover(),
          async () => {
            await expect(confirmImport).toHaveCSS("background-color", "rgb(240, 213, 148)");
            await expect(confirmImport).toHaveCSS("background-image", "none");
            await expect(confirmImport).toHaveCSS("color", "rgb(27, 19, 6)");
          },
        );
        const confirmationHoverContrast = await confirmImport.evaluate((element) => {
          const style = getComputedStyle(element);
          const luminance = (css: string) => {
            const channels = css
              .match(/[\d.]+/g)
              ?.slice(0, 3)
              .map(Number);
            if (channels?.length !== 3) throw new Error("SEXTANT_PRIVATE_CONFIRMATION_COLOR_UNAVAILABLE");
            return channels
              .map((channel) => {
                const value = channel / 255;
                return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
              })
              .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
          };
          const foreground = luminance(style.color),
            background = luminance(style.backgroundColor);
          return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
        });
        expect(confirmationHoverContrast, "Hovered private confirmation stays readable").toBeGreaterThanOrEqual(4.5);
        await expect(confirmImport).toBeInViewport({ ratio: 1 });
        await expect(inspectedStatus).toBeInViewport({ ratio: 1 });
        await capture("private-content-plan-confirmation", inspectedStatus);
        let importId = "";
        await measure(
          "Actual explicitly confirmed private import",
          async () => {
            const response = page.waitForResponse(
              (r) =>
                new URL(r.url()).pathname === "/api/studio/private-content/import" && r.request().method() === "POST",
            );
            await page.getByRole("button", { name: "Confirm private import", exact: true }).click();
            const result = await response;
            expect(result.status()).toBe(200);
            const value = await result.json();
            expect(value.status).toBe("COMPLETED");
            importId = value.importId;
          },
          async () => {
            await expect(
              page.getByText(`Private import completed: ${importId}. It remains unpublished.`, { exact: true }),
            ).toBeVisible();
            await expect(page.getByRole("region", { name: "Private import history", exact: true })).toContainText(
              `${fixture.packageId} revision 1: COMPLETED`,
            );
          },
        );
        const imported = await db.privateContentImport.findUniqueOrThrow({ where: { id: importId } });
        expect(imported).toMatchObject({
          ownerAccountId: fixture.ownerId,
          packageId: fixture.packageId,
          packageRevision: 1,
          status: "COMPLETED",
          materializationStatus: "COMPLETED",
        });
        const tales = JSON.parse(imported.importedTaleIds) as string[];
        expect(tales).toHaveLength(1);
        const tale = await db.chronicle.findUniqueOrThrow({ where: { id: tales[0] } });
        expect(tale).toMatchObject({
          creatorAccountId: fixture.ownerId,
          title: fixture.title,
          slug: fixture.slug,
          visibility: "PRIVATE",
          status: "DRAFT",
        });
        expect(await db.chronicle.count({ where: { creatorAccountId: fixture.ownerId } })).toBe(countBefore + 1);
        expect(await db.publishedTaleVersion.count({ where: { taleId: tale.id } })).toBe(0);
        expect(await db.taleSession.count({ where: { taleId: tale.id } })).toBe(0);
        await expect(secret).toHaveValue("");
        await expect(page.getByLabel("Select an encrypted private-content package", { exact: true })).toHaveValue("");
        await capture("private-content-completed-history", heading("Private import history"));
        await page.getByRole("combobox", { name: "Imported package", exact: true }).selectOption(importId);
        await secret.fill(passphrase);
        const downloadReady = page.waitForEvent("download");
        let exportedBytes: Buffer | null = null;
        await measure(
          "Actual verified encrypted export",
          async () => {
            const response = page.waitForResponse(
              (r) =>
                new URL(r.url()).pathname === "/api/studio/private-content/export" && r.request().method() === "POST",
            );
            await page.getByRole("button", { name: "Export verified package", exact: true }).click();
            const result = await response;
            expect(result.status()).toBe(200);
            const value = await result.json();
            expect(value.roundTripVerified).toBe(true);
            exportedBytes = Buffer.from(value.packageBytes, "base64");
          },
          () => expect(page.getByText("Encrypted export was verified before download.", { exact: true })).toBeVisible(),
        );
        const download = await downloadReady;
        expect(download.suggestedFilename()).toBe(`${fixture.packageId}.ftprivate`);
        const downloadPath = await download.path();
        if (!downloadPath || !exportedBytes) throw new Error("SEXTANT_PRIVATE_EXPORT_MISSING");
        expect(await readFile(downloadPath)).toEqual(exportedBytes);
        const exported = await decryptPrivatePackage(exportedBytes, passphrase);
        expect(exported.manifest).toMatchObject({
          packageId: fixture.packageId,
          packageRevision: 1,
          classification: "private",
          contentType: "tale-draft",
        });
        expect(exported.manifest.tales).toHaveLength(1);
        expect(exported.manifest.tales[0]).toMatchObject({ title: fixture.title, slug: fixture.slug });
        const projected = JSON.parse(
          Buffer.from(exported.entries[exported.manifest.tales[0].contentPath], "base64url").toString("utf8"),
        );
        expect(projected.chapters[0].blocks[0].configuration.body).toBe("A reserved synthetic package passage.");
        await expect(secret).toHaveValue("");
        await capture("private-content-verified-export", heading("Verified private export"));
        await enterLibrary();
        const card = page.locator(".tale-studio-card").filter({ has: heading(fixture.title) });
        await expect(card).toHaveCount(1);
        await expect(card).toContainText("Not published");
        await card.getByRole("link", { name: "Edit Chronicle", exact: true }).click();
        await expect(heading(fixture.title)).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`/studio/tales/${tale.id}$`));
        const chapterTitle = page.getByRole("textbox", { name: "Chapter 1 title", exact: true });
        await expect(chapterTitle).toHaveValue("Synthetic protected opening");
        await capture("private-content-canonical-draft", chapterTitle, ".tale-editor");
        await page.getByRole("button", { name: fixture.displayName, exact: true }).click();
        await page.getByRole("link", { name: "Personal Harbor", exact: true }).click();
        await expect(heading("Overview")).toBeVisible();
        await expect(page.getByRole("button", { name: fixture.displayName, exact: true })).toBeVisible();
        await capture("private-content-account-return", heading("Overview"), ".personal-harbor");
        expect(await readBaselines()).toEqual(baseline);
        expect(await readEditions()).toEqual(editions);
        expect(await db.publishedTaleVersion.count({ where: { taleId: tale.id } })).toBe(0);
        expect(await db.taleSession.count({ where: { taleId: tale.id } })).toBe(0);
        expect(await db.privateContentImport.count({ where: { ownerAccountId: fixture.ownerId } })).toBe(1);
        await writeFile(
          info.outputPath("private-content-journey-receipt.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              classification: "ENGINEERING_SYNTHETIC_PRIVATE_CONTENT_DEVELOPMENT_NOT_ACCEPTANCE",
              source: await deviceLabSourceIdentity([
                "tests/e2e/sextant-private-content-journeys.spec.ts",
                ".agents/scripts/sextant-private-content-fixture.ts",
                ".agents/scripts/sextant-resource-fixtures.ts",
                ".agents/scripts/sextant-experience-fixture.ts",
                "testing/contracts.json",
              ]),
              viewport,
              reducedMotion,
              baseline,
              feedback,
              importId,
              taleId: tale.id,
              packageId: fixture.packageId,
              exportedSha256: createHash("sha256").update(exportedBytes).digest("hex"),
              actualEncryptedDownloadAndCanonicalProjectionVerified: true,
              wrongPassphraseCreatesNothing: true,
              inspectionCreatesNothing: true,
              passphraseClearedAfterImportAndExport: true,
              unchangedActiveProgressAndEditionBytes: true,
              noPublishedVersionOrVoyageCreated: true,
              assetsIncluded: 0,
              confirmationHoverContrast,
              realPrivateContentUsed: false,
              formalPositiveFileInputCovered: false,
              protectedAcceptance: false,
            },
            null,
            2,
          ) + "\n",
        );
      });
    });
  }
}
