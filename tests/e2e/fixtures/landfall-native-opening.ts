import { expect, type Page } from "@playwright/test";
import { z } from "zod";
import { nativeSystemUiWaitTouch } from "../../../src/landfall/device-lab/native-system-ui-control";
import {
  nativeJournalOpeningTouch,
  nativeJournalOpeningGeometryTouch,
} from "../../../src/landfall/device-lab/native-opening-control";

const diagnosticGeometry = z.strictObject({
  version: z.literal(1),
  packageName: z.literal("com.voyagewright.landfall"),
  shown: z.boolean(),
  attached: z.boolean(),
  focused: z.boolean(),
  left: z.number().int().min(0).max(4096),
  top: z.number().int().min(0).max(4096),
  right: z.number().int().min(0).max(4096),
  bottom: z.number().int().min(0).max(4096),
});
export type OpeningGeometryDiagnostic = {
  native: z.infer<typeof diagnosticGeometry> | null;
  dom: {
    box: { x: number; y: number; width: number; height: number };
    viewport: { width: number; height: number; scale: number };
  };
};

/** Real public Journal UI: normal OS input from observed DOM and native bounds. */
export async function openNativeJournalEntry(
  page: Page,
  adb: (args: string[]) => Promise<string>,
  observeStage: (stage: string) => void = () => {},
  observeGeometry: (value: OpeningGeometryDiagnostic) => void = () => {},
  observeSystemUiWait: () => void = () => {},
) {
  // Sequential multi-device setup can leave the next owned guest asleep.
  // Establish the normal OS interaction precondition before inspecting bounds.
  await adb(["shell", "input", "keyevent", "KEYCODE_WAKEUP"]);
  await adb(["shell", "wm", "dismiss-keyguard"]);
  const opening = page.getByRole("dialog", { name: "Open the voyage journal" });
  const tools = page.getByRole("navigation", { name: "Journal tools" });
  await expect
    .poll(async () => (await opening.isVisible()) || (await tools.isVisible()), { timeout: 45000 })
    .toBe(true);
  if (await opening.isVisible()) {
    observeStage("NATIVE_OPENING_CONTROL");
    const observed = () =>
      page.evaluate(() => {
        const button = document.querySelector<HTMLButtonElement>("button.wax-open");
        if (!button) return null;
        const rect = button.getBoundingClientRect(),
          style = getComputedStyle(button);
        return {
          visible:
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) > 0,
          enabled: !button.disabled,
          copyObserved: button.textContent?.includes("Open the journal") === true,
          box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          viewport: { width: innerWidth, height: innerHeight, scale: visualViewport?.scale ?? 1 },
        };
      });
    await expect.poll(observed, { timeout: 15000 }).toMatchObject({ visible: true, enabled: true, copyObserved: true });
    const dump = "/data/local/tmp/landfall-public-opening.xml";
    try {
      observeStage("NATIVE_OPENING_GEOMETRY");
      const control = await observed();
      if (!control?.visible || !control.enabled || !control.copyObserved)
        throw new Error("NATIVE_OPENING_DOM_GEOMETRY_UNOBSERVED");
      let target;
      try {
        await adb(["shell", "uiautomator", "dump", dump]);
        let hierarchy = await adb(["shell", "cat", dump]);
        const systemWait = nativeSystemUiWaitTouch(hierarchy);
        if (systemWait) {
          observeStage("NATIVE_SYSTEM_UI_WAIT");
          await adb(["shell", "input", "tap", String(systemWait.x), String(systemWait.y)]);
          observeSystemUiWait();
          await adb(["shell", "uiautomator", "dump", dump]);
          hierarchy = await adb(["shell", "cat", dump]);
          if (nativeSystemUiWaitTouch(hierarchy)) throw new Error("NATIVE_OPENING_SYSTEM_UI_STILL_UNRESPONSIVE");
        }
        const fresh = await observed();
        if (!fresh?.visible || !fresh.enabled || !fresh.copyObserved)
          throw new Error("NATIVE_OPENING_DOM_GEOMETRY_UNOBSERVED");
        target = nativeJournalOpeningTouch(hierarchy, fresh);
      } catch {
        observeStage("NATIVE_OPENING_GEOMETRY_WAIT");
        await expect
          .poll(
            async () => {
              const fresh = await observed();
              if (!fresh?.visible || !fresh.enabled || !fresh.copyObserved) return false;
              const raw = await adb([
                "shell",
                "run-as",
                "com.voyagewright.landfall",
                "cat",
                "files/landfall-opening-geometry.json",
              ]);
              if (raw.length > 1024) throw new Error("NATIVE_OPENING_GEOMETRY_TOO_LARGE");
              try {
                const decoded = JSON.parse(raw);
                const projection = diagnosticGeometry.safeParse(decoded);
                observeGeometry({
                  native: projection.success ? projection.data : null,
                  dom: { box: fresh.box, viewport: fresh.viewport },
                });
                // Accessibility inspection can precede native focus/layout settling.
                // Reobserve both surfaces; never touch until the strict mapping passes.
                target = nativeJournalOpeningGeometryTouch(decoded, fresh);
                return true;
              } catch {
                return false;
              }
            },
            { timeout: 15000 },
          )
          .toBe(true);
      }
      if (!target) throw new Error("NATIVE_OPENING_GEOMETRY_UNOBSERVED");
      observeStage("NATIVE_OPENING_TOUCH");
      await adb(["shell", "input", "tap", String(target.x), String(target.y)]);
    } catch (error) {
      if (
        !(await page.getByRole("dialog", { name: "Journal opening in progress" }).isVisible()) &&
        !(await tools.isVisible())
      )
        throw error;
    } finally {
      await adb(["shell", "rm", "-f", dump]);
    }
    const progress = page.getByRole("dialog", { name: "Journal opening in progress" });
    if (await progress.isVisible()) {
      observeStage("NATIVE_OPENING_CEREMONY");
      try {
        await progress.getByRole("button", { name: "Skip ceremony", exact: true }).click({ noWaitAfter: true });
      } catch (error) {
        if (!(await tools.isVisible())) throw error;
      }
    }
  }
  observeStage("NATIVE_JOURNAL_TOOLS");
  await expect(tools).toBeVisible({ timeout: 30000 });
}
