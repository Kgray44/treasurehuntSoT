import { expect } from "@playwright/test";
import type { Page } from "playwright";
/** Requires the parent's actual owned Android WebView and synthetic account. */
export async function exerciseNativeDeviceControls(page: Page, origin: string) {
  await page.goto(`${origin}/account/devices`);
  const panel = page.getByRole("region", { name: "Optional device input" });
  await expect(panel).toBeVisible();
  const state = await page.evaluate(async () => {
    const snapshot = (await window.LandfallNative!.request(
      JSON.stringify({ version: 1, id: crypto.randomUUID(), operation: "SEXTANT_STATE", payload: {} }),
    )) as { states: Record<string, { support: string; permission: string }> };
    let osSamples = 0;
    const receive = (event: Event) => {
      const data = (event as CustomEvent).detail;
      if (
        data?.type === "sextant-sample" &&
        data.fidelity === "OS" &&
        data.sample?.capabilityId === "sextant.motion.stability"
      )
        osSamples++;
    };
    window.addEventListener("landfall-native-event", receive);
    Object.assign(window, {
      __sextantNativeControlProof: {
        count: () => osSamples,
        detach: () => window.removeEventListener("landfall-native-event", receive),
      },
    });
    return snapshot.states["sextant.motion.stability"];
  });
  try {
    expect(
      await page.evaluate(() =>
        (
          window as unknown as { __sextantNativeControlProof: { count: () => number } }
        ).__sextantNativeControlProof.count(),
      ),
    ).toBe(0);
    if (state.support === "SUPPORTED") {
      await panel.getByRole("checkbox", { name: "Allow device motion for this interaction" }).check();
      await panel.getByRole("button", { name: "Enable device input", exact: true }).click();
      await expect
        .poll(
          () =>
            page.evaluate(() =>
              (
                window as unknown as { __sextantNativeControlProof: { count: () => number } }
              ).__sextantNativeControlProof.count(),
            ),
          { timeout: 10000 },
        )
        .toBeGreaterThan(0);
      await panel.getByRole("button", { name: "Pause device input", exact: true }).click();
      await expect(panel.getByRole("button", { name: "Resume device input", exact: true })).toBeVisible();
    } else {
      await expect(panel.getByRole("button", { name: "Enable device input", exact: true })).toBeDisabled();
    }
    await panel.getByRole("button", { name: "Continue with screen controls" }).click();
    await expect(panel.getByText("Screen controls are ready. Device input is optional.")).toBeVisible();
    const stoppedCount = await page.evaluate(() =>
      (
        window as unknown as { __sextantNativeControlProof: { count: () => number } }
      ).__sextantNativeControlProof.count(),
    );
    await page.waitForTimeout(1200);
    expect(
      await page.evaluate(() =>
        (
          window as unknown as { __sextantNativeControlProof: { count: () => number } }
        ).__sextantNativeControlProof.count(),
      ),
    ).toBe(stoppedCount);
    return {
      nativeBridge: "ACTUAL_ANDROID_WEBVIEW",
      passiveDiscovery: true,
      motionSupported: state.support === "SUPPORTED",
      osSamplesObserved: stoppedCount,
      pausedAndFallback: true,
      physicalMotionProven: false,
      progressionWriter: false,
    };
  } finally {
    await page.evaluate(() =>
      (
        window as unknown as { __sextantNativeControlProof: { detach: () => void } }
      ).__sextantNativeControlProof.detach(),
    );
  }
}
