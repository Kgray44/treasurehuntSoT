import { expect, test } from "@playwright/test";
import { _android, type AndroidDevice, type Page } from "playwright";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../../src/lib/db";
import {
  deviceLabConfigurationSchema,
  deviceLabProfileSchema,
  validateDeviceLabProfile,
  type DeviceLabConfiguration,
} from "../../src/landfall/device-lab/device-profile";
import { labBinaryTool, labTool } from "../../scripts/landfall/device-lab/host";
import { runLandfallAndroidRadioLab } from "../../scripts/landfall/device-lab/android-radio-run";
import { deviceLabSourceIdentity } from "../../scripts/landfall/device-lab/source";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { closureAccount, closureVoyage, openClosureJournal, openClosureMap } from "./fixtures/landfall-closure";

test.describe.configure({ timeout: 900_000 });
test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(process.env.LANDFALL_NATIVE_NEARBY !== "1", "Requires an exclusively owned ephemeral Linux radio runner.");
test.skip(({ browserName }) => browserName !== "chromium", "Run native ownership once.");
test.afterAll(async () => db.$disconnect());

/** Driver connection primitives do not inherit Page action timeouts. */
async function boundedDriver<T>(operation: Promise<T>, signal?: AbortSignal, timeout = 20000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(new Error("LANDFALL_NATIVE_NEARBY_CANCELLED"));
        if (signal?.aborted) onAbort();
        else signal?.addEventListener("abort", onAbort, { once: true });
        timer = setTimeout(() => reject(new Error("LANDFALL_NATIVE_NEARBY_DRIVER_TIMEOUT")), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (onAbort) signal?.removeEventListener("abort", onAbort);
  }
}

async function nativeStopped(page: Page) {
  return page.evaluate(async () => {
    const value = (await window.LandfallNative!.request(
      JSON.stringify({
        version: 1,
        id: crypto.randomUUID(),
        operation: "UWB_STATE",
        payload: {},
      }),
    )) as { state: string; sessionProtected: boolean };
    return value.state === "UNAVAILABLE" && value.sessionProtected === false;
  });
}

test("real native Journal pairing returns untrusted hints and background clears the session", async ({
  baseURL,
}, testInfo) => {
  ensureGenericSoundingLineIsolation();
  if (process.env.LANDFALL_NEARBY_PAIRING_MODE !== "ephemeral-instance")
    throw new Error("LANDFALL_NATIVE_NEARBY_DEPLOYMENT_OPT_IN_REQUIRED");
  const origin = new URL(baseURL!);
  if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || !origin.port)
    throw new Error("LANDFALL_NATIVE_NEARBY_OWNED_ORIGIN_REQUIRED");
  const source = await deviceLabSourceIdentity(["tests/e2e/landfall-native-nearby.spec.ts"]);
  const creator = await closureAccount("Native nearby synthetic Creator");
  const player = await closureAccount("Native nearby synthetic Player");
  const voyage = await closureVoyage(creator, player, "livingChart");
  const baseline = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
  const before = await db.taleSessionEvent.count({ where: { sessionId: voyage.id } });
  await runLandfallAndroidRadioLab({
    kind: "PRODUCTION_JOURNAL_PAIR",
    execute: async (resources) => {
      const pkg = "com.voyagewright.landfall";
      const binding = `tcp:${origin.port}`;
      const acquired: string[] = [];
      let devices: AndroidDevice[] = [];
      const pages: Page[] = [];
      const configurations: DeviceLabConfiguration[] = [];
      const profile = deviceLabProfileSchema.parse(process.env.LANDFALL_LAB_PROFILE ?? "low-resource");
      const remaining: string[] = [];
      let passed = false;
      let reports: number[] = [];
      let nativeStopObserved = false;
      let stage = "DEVICE_PREFLIGHT";
      const adb = (serial: string, args: string[]) =>
        labTool(resources.adbPath, ["-P", String(resources.adbPort), "-s", serial, ...args], 15000);
      try {
        for (const serial of resources.serials) {
          if (resources.signal.aborted) throw new Error("LANDFALL_NATIVE_NEARBY_CANCELLED");
          const sizes = [
            ...(await adb(serial, ["shell", "wm", "size"])).matchAll(/(?:Physical|Override) size:\s*(\d+)x(\d+)/g),
          ];
          const densities = [
            ...(await adb(serial, ["shell", "wm", "density"])).matchAll(/(?:Physical|Override) density:\s*(\d+)/g),
          ];
          const memory = /MemTotal:\s+(\d+)\s+kB/.exec(await adb(serial, ["shell", "cat", "/proc/meminfo"]));
          const configuration = deviceLabConfigurationSchema.parse({
            platform: "ANDROID",
            virtual: true,
            api: Number((await adb(serial, ["shell", "getprop", "ro.build.version.sdk"])).trim()),
            model: (await adb(serial, ["shell", "getprop", "ro.product.model"])).trim(),
            memoryKiB: Number(memory?.[1]),
            widthPixels: Number(sizes.at(-1)?.[1]),
            heightPixels: Number(sizes.at(-1)?.[2]),
            densityDpi: Number(densities.at(-1)?.[1]),
          });
          configurations.push(validateDeviceLabProfile(profile, configuration));
          const processes = await adb(serial, ["shell", "ps", "-A", "-o", "NAME"]);
          if (processes.split(/\r?\n/).some((name) => name.trim() === pkg || name.trim().startsWith(pkg + ":")))
            throw new Error("LANDFALL_NATIVE_NEARBY_APP_ALREADY_ACTIVE");
          if ((await adb(serial, ["reverse", "--list"])).includes(binding))
            throw new Error("LANDFALL_NATIVE_NEARBY_BINDING_ALREADY_ACTIVE");
          acquired.push(serial);
          await adb(serial, ["reverse", binding, binding]);
          if (!(await adb(serial, ["install", "-r", resources.apkPath])).includes("Success"))
            throw new Error("LANDFALL_NATIVE_NEARBY_INSTALL_FAILED");
          if (!(await adb(serial, ["shell", "pm", "clear", pkg])).includes("Success"))
            throw new Error("LANDFALL_NATIVE_NEARBY_RESET_FAILED");
          await adb(serial, ["shell", "pm", "grant", pkg, "android.permission.RANGING"]);
          const launch = await adb(serial, [
            "shell",
            "am",
            "start",
            "-W",
            "-n",
            `${pkg}/.LandfallActivity`,
            "--es",
            "labOrigin",
            origin.origin,
          ]);
          if (/Error:|Exception/.test(launch)) throw new Error("LANDFALL_NATIVE_NEARBY_LAUNCH_FAILED");
        }
        stage = "ENUMERATE_NATIVE_DRIVERS";
        devices = await boundedDriver(
          _android.devices({ host: "127.0.0.1", port: resources.adbPort, omitDriverInstall: true }),
          resources.signal,
        );
        stage = "OPEN_AUTHORIZED_JOURNALS";
        for (const serial of resources.serials) {
          const device = devices.find((item) => item.serial() === serial);
          if (!device) throw new Error("LANDFALL_NATIVE_NEARBY_DEVICE_MISSING");
          stage = "CONNECT_NATIVE_WEBVIEW";
          const view = await device.webView({ pkg }, { timeout: 30000 });
          stage = "CONNECT_NATIVE_PAGE";
          const page = await boundedDriver(view.page(), resources.signal);
          pages.push(page);
          page.setDefaultTimeout(10000);
          page.setDefaultNavigationTimeout(45000);
          stage = "SET_NATIVE_REDUCED_MOTION";
          await boundedDriver(page.emulateMedia({ reducedMotion: "reduce" }), resources.signal);
          stage = "CREATE_NATIVE_CDP_SESSION";
          const cdp = await boundedDriver(page.context().newCDPSession(page), resources.signal);
          stage = "SET_NATIVE_ACCOUNT_COOKIE";
          const cookie = await boundedDriver(
            cdp.send("Network.setCookie", {
              name: "wayfarer_account",
              value: player.token,
              url: origin.origin,
              httpOnly: true,
              secure: false,
              sameSite: "Lax",
            }),
            resources.signal,
          );
          expect(cookie.success).toBe(true);
          stage = "DETACH_NATIVE_CDP_SESSION";
          await boundedDriver(cdp.detach(), resources.signal);
          stage = "OPEN_NATIVE_JOURNAL";
          await openClosureJournal(page, voyage.id, origin.origin);
          stage = "OPEN_NATIVE_MAP";
          await openClosureMap(page);
          expect(await page.evaluate(() => window.LandfallNative?.platform)).toBe("ANDROID");
          await page.evaluate(() => {
            const counts = { nearby: 0, fixes: 0 };
            Object.defineProperty(window, "__nativeNearbyCounts", { value: counts });
            window.addEventListener("landfall-native-event", (event) => {
              const value = (event as CustomEvent).detail;
              if (value?.type === "nearby" && value.family === "UWB") counts.nearby++;
              if (value?.type === "fix") counts.fixes++;
            });
          });
          stage = "EXPAND_NATIVE_NEARBY_CONTROLS";
          await page.locator(".landfall-nearby-panel:visible summary").click();
        }
        const panels = pages.map((page) => page.locator(".landfall-nearby-panel:visible"));
        stage = "FIRST_PARTY_CREATE_JOIN";
        await panels[0].getByRole("button", { name: "Create pairing code", exact: true }).click();
        const code = await panels[0].getByLabel("Pairing code", { exact: true }).textContent();
        expect(typeof code === "string" && /^[A-Za-z0-9_-]{43}$/.test(code)).toBe(true);
        await panels[1].getByLabel("Code from your other device").fill(code!);
        await panels[1].getByRole("button", { name: "Join my other device", exact: true }).click();
        await expect
          .poll(
            () =>
              pages[1].evaluate(async () => {
                const value = (await window.LandfallNative!.request(
                  JSON.stringify({
                    version: 1,
                    id: crypto.randomUUID(),
                    operation: "UWB_STATE",
                    payload: {},
                  }),
                )) as { state: string; sessionProtected: boolean };
                return value.state === "INITIALIZING" && value.sessionProtected === true;
              }),
            { timeout: 10000 },
          )
          .toBe(true);
        await panels[0].getByRole("button", { name: "Start hints", exact: true }).click();
        stage = "NATIVE_REPORTS_BOTH_DEVICES";
        for (const panel of panels)
          await expect(panel.getByRole("status", { name: "Nearby device hint status" })).toContainText(
            "cannot confirm arrival",
            { timeout: 30000 },
          );
        reports = await Promise.all(
          pages.map((page) =>
            page.evaluate(
              () => (window as unknown as { __nativeNearbyCounts: { nearby: number } }).__nativeNearbyCounts.nearby,
            ),
          ),
        );
        expect(reports.every((count) => count > 0)).toBe(true);
        stage = "OS_BACKGROUND_AND_NATIVE_STOP";
        await adb(resources.serials[0], [
          "shell",
          "am",
          "start",
          "-W",
          "-a",
          "android.intent.action.MAIN",
          "-c",
          "android.intent.category.HOME",
        ]);
        await expect(panels[0].getByRole("status", { name: "Nearby device hint status" })).toContainText("paused");
        await expect.poll(() => nativeStopped(pages[0]), { timeout: 10000 }).toBe(true);
        await panels[1].getByRole("button", { name: "Stop nearby hints", exact: true }).click();
        await expect.poll(() => nativeStopped(pages[1]), { timeout: 10000 }).toBe(true);
        nativeStopObserved = true;
        stage = "CANONICAL_AND_RENDERED_RESULT";
        const after = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
        expect(after.currentBlockId).toBe(baseline.currentBlockId);
        expect(after.currentSequence).toBe(baseline.currentSequence);
        expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(before);
        for (const page of pages)
          expect(
            await page.evaluate(
              () => (window as unknown as { __nativeNearbyCounts: { fixes: number } }).__nativeNearbyCounts.fixes,
            ),
          ).toBe(0);
        const png = await labBinaryTool(resources.adbPath, [
          "-P",
          String(resources.adbPort),
          "-s",
          resources.serials[1],
          "exec-out",
          "screencap",
          "-p",
        ]);
        const shot = testInfo.outputPath("native-nearby-stopped.png");
        await writeFile(shot, png);
        await testInfo.attach("native-nearby-stopped", { path: shot, contentType: "image/png" });
        passed = true;
      } finally {
        await Promise.all(
          devices.map((device) =>
            boundedDriver(device.close(), undefined, 15000).catch(() => remaining.push("webview-connection")),
          ),
        );
        for (const serial of acquired) {
          await adb(serial, ["shell", "am", "force-stop", pkg]).catch(() => remaining.push(`app-stop:${serial}`));
          if (!(await adb(serial, ["shell", "pm", "clear", pkg]).catch(() => "")).includes("Success"))
            remaining.push(`private-data:${serial}`);
          await adb(serial, ["reverse", "--remove", binding]).catch(() => remaining.push(`reverse:${serial}`));
          const processes = await adb(serial, ["shell", "ps", "-A", "-o", "NAME"]).catch(() => "UNKNOWN");
          if (
            processes === "UNKNOWN" ||
            processes.split(/\r?\n/).some((name) => name.trim() === pkg || name.trim().startsWith(pkg + ":"))
          )
            remaining.push(`app:${serial}`);
          if ((await adb(serial, ["reverse", "--list"]).catch(() => binding)).includes(binding))
            remaining.push(`reverse-unverified:${serial}`);
        }
        const after = await deviceLabSourceIdentity(["tests/e2e/landfall-native-nearby.spec.ts"]);
        const events = (await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })) - before;
        const receipt = {
          version: 1,
          deviceProfile: profile,
          configurations,
          source,
          sourceUnchanged: source.sourceFingerprint === after.sourceFingerprint,
          evidenceClass: "EMULATOR_PROVEN",
          nativeBridge: "REAL_ANDROID_OS",
          firstPartyApi: "REAL_OPTIMIZED_APPLICATION",
          validatedReportsObservedOnBoth: reports.length === 2 && reports.every((count) => count > 0),
          nativeStopObserved,
          peerVerified: false,
          canComplete: false,
          uncertainty: "UNKNOWN",
          canonicalAuthority: "ONE_VOYAGE_REAL_SQLITE",
          canonicalProgressionEvents: events,
          result:
            passed && !remaining.length && events === 0 && source.sourceFingerprint === after.sourceFingerprint
              ? "PASS"
              : "FAIL",
          failedStage: passed ? null : stage,
          externalRequirements: ["REAL_DEVICE_REQUIRED:RF"],
          cleanup: { result: remaining.length ? "FAIL" : "PASS", remainingResources: remaining },
        };
        await writeFile(
          path.join(resources.artifactDirectory, "native-journal-pair-receipt.json"),
          JSON.stringify(receipt, null, 2),
        );
        expect(receipt.result).toBe("PASS");
      }
    },
  });
});
