// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.phase4.native-context
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
test.describe.configure({ mode: "serial", timeout: 180000 });
test.use({ trace: "off", video: "off", screenshot: "off" });
test.afterAll(() => db.$disconnect());
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`optional input on ordinary Devices ${viewport.width}px: discovery, refusal, fallback and accessibility`, async ({
    browser,
    baseURL,
  }, info) => {
    if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic")
      throw new Error("SEXTANT_OWNED_BROWSER_PROFILE_REQUIRED");
    ensureGenericSoundingLineIsolation();
    const account = await closureAccount("Synthetic Sextant navigator");
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    try {
      // D1 UI/transport double only. No sensor values or native/physical evidence.
      await context.addInitScript(() => {
        const operations: string[] = [];
        let declined = false;
        Object.assign(window, { __sextantOperations: operations });
        window.LandfallNative = {
          platform: "IOS",
          version: 1,
          async request(message: string) {
            const { operation } = JSON.parse(message);
            operations.push(operation);
            if (operation === "SEXTANT_PERMISSION") {
              declined = true;
              return { state: "DENIED" };
            }
            if (operation === "SEXTANT_STATE")
              return {
                version: 1,
                background: "FOREGROUND_ONLY",
                hapticTier: "NONE",
                states: {
                  "sextant.motion.stability": {
                    support: "SUPPORTED",
                    availability: "TEMPORARILY_UNAVAILABLE",
                    permission: declined ? "DENIED" : "PROMPT",
                    calibration: "UNKNOWN",
                    quality: "UNKNOWN",
                    freshness: "UNKNOWN",
                    lifecycle: "FOREGROUND_ONLY",
                  },
                },
              };
            return { accepted: false };
          },
        };
      });
      await authenticateClosure(context, account, baseURL!);
      const page = await context.newPage();
      await page.goto(`${baseURL}/account/devices`);
      const panel = page.getByRole("region", { name: "Optional device input" });
      await expect(panel).toBeVisible();
      await expect(panel.getByText("Permission is needed for this optional input", { exact: true })).toBeVisible();
      await expect(panel.getByRole("button", { name: "Enable device input", exact: true })).toBeDisabled();
      const operations = () =>
        page.evaluate(() => (window as unknown as { __sextantOperations: string[] }).__sextantOperations);
      const passiveOperations = await operations();
      expect(passiveOperations).toContain("SEXTANT_STATE");
      expect(passiveOperations.filter((operation) => operation.startsWith("SEXTANT_"))).toEqual(
        passiveOperations.filter((operation) => operation === "SEXTANT_STATE"),
      );
      expect(
        passiveOperations.filter((operation) =>
          /_START$|_PERMISSION$|^SEXTANT_HAPTIC$|^QR_SCAN$|^NFC_READ$/.test(operation),
        ),
        JSON.stringify(passiveOperations),
      ).toEqual([]);
      await panel.getByRole("checkbox", { name: "Allow device motion for this interaction" }).check();
      await panel.getByRole("button", { name: "Enable device input", exact: true }).click();
      await expect(
        panel.getByText("Device input is unavailable. You can continue with the alternative below."),
      ).toBeVisible();
      expect(await operations()).not.toContain("SEXTANT_START");
      await panel.getByRole("button", { name: "Continue with screen controls" }).focus();
      await page.keyboard.press("Enter");
      await expect(panel.getByText("Screen controls are ready. Device input is optional.")).toBeVisible();
      await expect(panel.getByRole("checkbox", { name: "Reduce sensory feedback" })).toBeDisabled();
      await expect(panel.getByRole("button", { name: "Try a short vibration" })).toBeDisabled();
      expect(
        (await new AxeBuilder({ page }).include('[aria-label="Optional device input"]').analyze()).violations,
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`devices-${viewport.width}.png`), fullPage: true });
      await info.attach("proof-boundary", {
        body: Buffer.from(
          JSON.stringify({
            evidence: "D1_BROWSER_UI_WITH_NATIVE_TRANSPORT_DOUBLE",
            nativeExecution: false,
            physicalOutput: false,
            viewport,
          }),
        ),
        contentType: "application/json",
      });
    } finally {
      await context.close();
      await db.userAccount.delete({ where: { id: account.id } });
    }
  });
}
