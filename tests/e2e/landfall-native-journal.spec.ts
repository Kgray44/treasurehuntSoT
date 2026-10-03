import { expect, test } from "@playwright/test";
import { _android, type AndroidDevice, type Page } from "playwright";
import { createHash } from "node:crypto";
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../../src/lib/db";
import { landfallFixture } from "../../src/landfall/fixtures";
import { landfallDeviceScenario } from "../../src/landfall/device-lab/scenarios";
import { labBinaryTool, labTool } from "../../scripts/landfall/device-lab/host";
import { deviceLabSourceIdentity } from "../../scripts/landfall/device-lab/source";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { closureAccount, closureVoyage, openClosureJournal, openClosureMap } from "./fixtures/landfall-closure";

// This suite is opt-in because it mutates an owned emulator. Ordinary browser
// runners must never attach to a person's phone or the shared default ADB server.
test.describe.configure({ mode: "serial", timeout: 180_000 });
// Protocol traces may contain the synthetic session cookie. Retain only the
// explicitly redacted receipt and rendered synthetic screenshots.
test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(process.env.LANDFALL_NATIVE_JOURNAL !== "1", "Requires an explicitly owned Android emulator.");
test.skip(({ browserName }) => browserName !== "chromium", "Native fixture runs once.");
test.afterAll(async () => db.$disconnect());

for (const virtual of [false, true]) {
  test(`native production Journal in ${virtual ? "VIRTUAL" : "PHYSICAL"}`, async ({ baseURL }, testInfo) => {
    ensureGenericSoundingLineIsolation();
    const serial = process.env.LANDFALL_LAB_ANDROID_SERIAL ?? "";
    const adbPort = Number(process.env.LANDFALL_LAB_ADB_PORT);
    const sdk = path.resolve(process.env.ANDROID_HOME ?? "");
    const ownedSdk = path.join(process.cwd(), "artifacts", "landfall-device-tools", "android-sdk");
    const origin = new URL(baseURL!);
    if (
      !/^emulator-[0-9]{4,5}$/.test(serial) ||
      !Number.isInteger(adbPort) ||
      adbPort < 5038 ||
      adbPort > 65535 ||
      sdk !== ownedSdk ||
      origin.hostname !== "127.0.0.1" ||
      origin.protocol !== "http:" ||
      process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic"
    )
      throw new Error("LANDFALL_NATIVE_JOURNAL_OWNERSHIP_REQUIRED");
    const adb = path.join(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
    const argv = ["-P", String(adbPort), "-s", serial];
    const run = (args: string[]) => labTool(adb, [...argv, ...args]);
    const packageId = "com.voyagewright.landfall";
    const apkPath = path.join(
      process.cwd(),
      "native",
      "android",
      "app",
      "build",
      "outputs",
      "apk",
      "debug",
      "app-debug.apk",
    );
    const apk = await readFile(apkPath);
    const binding = `tcp:${origin.port}`;
    const cleanup: string[] = [];
    let device: AndroidDevice | undefined;
    let page: Page | undefined;
    let appOwned = false;
    let reverseOwned = false;
    let passed = false;
    let nativeForeground: boolean | null = null;
    let locationBaseline: string | undefined;
    const owner = await closureAccount("Native synthetic Creator");
    const player = await closureAccount("Native synthetic Player");
    const definition = structuredClone(landfallFixture);
    definition.worldspaces[0].observationPolicy.allowedSources.push("NATIVE_LOCATION");
    for (const waypoint of definition.waypoints)
      if (waypoint.worldspaceId === "town") waypoint.evidenceProfile.acceptedSources.push("NATIVE_LOCATION");
    const voyage = await closureVoyage(owner, player, "livingChart", {
      virtual,
      authoredDefinition: virtual ? undefined : definition,
    });
    const eventsBefore = await db.taleSessionEvent.count({ where: { sessionId: voyage.id } });
    let fixes: number | null = null;
    let canonicalEvents: number | null = null;
    try {
      const listing = await labTool(adb, ["-P", String(adbPort), "devices"]);
      if (!listing.split(/\r?\n/).some((line) => line === `${serial}\tdevice`))
        throw new Error("LANDFALL_NATIVE_JOURNAL_DEVICE_UNAVAILABLE");
      const active = (await run(["shell", "ps", "-A", "-o", "NAME"]))
        .split(/\r?\n/)
        .some((name) => name.trim() === packageId || name.trim().startsWith(packageId + ":"));
      if (active) throw new Error("LANDFALL_NATIVE_JOURNAL_APP_ALREADY_ACTIVE");
      const bindings = await run(["reverse", "--list"]);
      if (bindings.includes(binding)) throw new Error("LANDFALL_NATIVE_JOURNAL_PORT_ALREADY_BOUND");
      await run(["reverse", binding, binding]);
      reverseOwned = true;
      appOwned = true;
      if (!(await run(["install", "-r", apkPath])).includes("Success"))
        throw new Error("LANDFALL_NATIVE_JOURNAL_INSTALL_FAILED");
      if (!(await run(["shell", "pm", "clear", packageId])).includes("Success"))
        throw new Error("LANDFALL_NATIVE_JOURNAL_RESET_FAILED");
      if (!virtual) {
        locationBaseline = (await run(["shell", "cmd", "location", "is-location-enabled"])).trim();
        if (!["true", "false"].includes(locationBaseline)) throw new Error("LANDFALL_LOCATION_BASELINE_INVALID");
        await run(["shell", "cmd", "location", "set-location-enabled", "true"]);
        await run(["shell", "pm", "grant", packageId, "android.permission.ACCESS_COARSE_LOCATION"]);
        await run(["shell", "pm", "grant", packageId, "android.permission.ACCESS_FINE_LOCATION"]);
      }
      const launch = await run([
        "shell",
        "am",
        "start",
        "-W",
        "-n",
        `${packageId}/.LandfallActivity`,
        "--es",
        "labOrigin",
        origin.origin,
      ]);
      if (/Error:|Exception/.test(launch)) throw new Error("LANDFALL_NATIVE_JOURNAL_LAUNCH_FAILED");
      const foregroundDeadline = Date.now() + 10000;
      do {
        const activity = await run(["shell", "dumpsys", "activity", "activities"]);
        nativeForeground = activity
          .split(/\r?\n/)
          .some((line) => /(?:mResumedActivity|topResumedActivity)/.test(line) && line.includes(packageId));
        if (!nativeForeground) await new Promise((resolve) => setTimeout(resolve, 100));
      } while (!nativeForeground && Date.now() < foregroundDeadline);
      if (!nativeForeground) throw new Error("LANDFALL_NATIVE_JOURNAL_FOREGROUND_NOT_OBSERVED");
      const devices = await _android.devices({ host: "127.0.0.1", port: adbPort, omitDriverInstall: true });
      device = devices.find((item) => item.serial() === serial);
      await Promise.all(devices.filter((item) => item !== device).map((item) => item.close()));
      if (!device) throw new Error("LANDFALL_NATIVE_JOURNAL_ATTACH_FAILED");
      const webview = await device.webView({ pkg: packageId }, { timeout: 30000 });
      page = await webview.page();
      await page.emulateMedia({ reducedMotion: "reduce" });
      const cdp = await page.context().newCDPSession(page);
      const cookie = await cdp.send("Network.setCookie", {
        name: "wayfarer_account",
        value: player.token,
        url: origin.origin,
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      });
      expect(cookie.success).toBe(true);
      await cdp.detach();
      await openClosureJournal(page, voyage.id, origin.origin);
      await openClosureMap(page);
      expect(await page.evaluate(() => window.LandfallNative?.platform)).toBe("ANDROID");
      // Only categorical counts leave the native callback; coordinates remain in
      // the production provider and never enter the diagnostic artifact.
      await page.evaluate(() => {
        const counters = { fixes: 0 };
        Object.defineProperty(window, "__nativeJournalCounters", { value: counters });
        window.addEventListener("landfall-native-event", (event) => {
          if ((event as CustomEvent).detail?.type === "fix") counters.fixes++;
        });
      });
      const chart = page.locator(".journal-objects-drawer [data-landfall-player-chart]");
      await expect(chart).toContainText(virtual ? "Imaginary Isles" : "Fixture Town");
      await chart
        .getByRole("searchbox", { name: "Find a place on your released maps" })
        .fill(virtual ? "Secret Isle" : "Town arrival");
      await chart.getByRole("button", { name: virtual ? /View Secret Isle/ : /View Town arrival/ }).click();
      await expect(chart).toContainText("selected for viewing");
      expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(eventsBefore);
      if (virtual) {
        await expect(chart.getByRole("button", { name: "Use my location", exact: true })).toHaveCount(0);
      } else {
        await chart.getByRole("button", { name: "Use my location", exact: true }).click();
        await expect(chart.getByRole("button", { name: "Stop using my location", exact: true })).toBeVisible();
        const scenario = landfallDeviceScenario("gps-perfect-walk");
        for (const step of scenario.timeline) {
          if (step.action.type !== "LOCATION" || step.action.coordinate.type !== "WGS84") continue;
          const previous = await page.evaluate(
            () => (window as unknown as { __nativeJournalCounters: { fixes: number } }).__nativeJournalCounters.fixes,
          );
          await run([
            "emu",
            "geo",
            "fix",
            String(step.action.coordinate.longitude),
            String(step.action.coordinate.latitude),
          ]);
          await expect
            .poll(
              async () =>
                page!.evaluate(
                  () =>
                    (window as unknown as { __nativeJournalCounters: { fixes: number } }).__nativeJournalCounters.fixes,
                ),
              { timeout: 30000 },
            )
            .toBeGreaterThan(previous);
        }
        await expect
          .poll(async () => (await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })) - eventsBefore, {
            timeout: 30000,
          })
          .toBe(1);
        await expect(chart).toContainText("Arrival recorded: Town arrival");
        await expect(chart.getByRole("button", { name: "Stop using my location", exact: true })).toHaveCount(0);
        await expect(chart).toContainText("No released waypoint is ready for location evaluation.");
      }
      fixes = await page.evaluate(
        () => (window as unknown as { __nativeJournalCounters: { fixes: number } }).__nativeJournalCounters.fixes,
      );
      expect(virtual ? fixes === 0 : fixes >= 2).toBe(true);
      canonicalEvents = (await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })) - eventsBefore;
      // The location read may submit an arrival request. Only the real One Voyage
      // writer can create this event; search and virtual rendering cannot.
      expect(canonicalEvents).toBe(virtual ? 0 : 1);
      const map = chart.locator('[aria-label="Landfall map preview"]');
      await map.scrollIntoViewIfNeeded();
      const png = await labBinaryTool(adb, [...argv, "exec-out", "screencap", "-p"]);
      const screenshot = testInfo.outputPath("native-journal.png");
      await writeFile(screenshot, png);
      await testInfo.attach("native-journal", { path: screenshot, contentType: "image/png" });
      passed = true;
    } catch (error) {
      if (appOwned && (!page || new URL(page.url()).origin === origin.origin)) {
        const png = await labBinaryTool(adb, [...argv, "exec-out", "screencap", "-p"]).catch(() => null);
        if (png) {
          const screenshot = testInfo.outputPath("native-journal-failure.png");
          await writeFile(screenshot, png);
          await testInfo.attach("native-journal-failure", { path: screenshot, contentType: "image/png" });
        }
      }
      throw error;
    } finally {
      fixes =
        (await page
          ?.evaluate(
            () =>
              (window as unknown as { __nativeJournalCounters?: { fixes: number } }).__nativeJournalCounters?.fixes ??
              null,
          )
          .catch(() => null)) ?? null;
      canonicalEvents = (await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })) - eventsBefore;
      await device?.close();
      if (appOwned) await run(["shell", "am", "force-stop", packageId]).catch(() => cleanup.push("native-app-process"));
      if (reverseOwned) await run(["reverse", "--remove", binding]).catch(() => cleanup.push("owned-adb-reverse"));
      if (locationBaseline) {
        await run(["shell", "cmd", "location", "set-location-enabled", locationBaseline]).catch(() =>
          cleanup.push("location-baseline"),
        );
        if (
          (await run(["shell", "cmd", "location", "is-location-enabled"]).catch(() => "UNVERIFIED")).trim() !==
          locationBaseline
        )
          cleanup.push("location-baseline-unverified");
      }
      if (appOwned) {
        const clear = await run(["shell", "pm", "clear", packageId]).catch(() => "");
        if (!clear.includes("Success")) cleanup.push("native-private-data");
        const processes = await run(["shell", "ps", "-A", "-o", "NAME"]).catch(() => "UNVERIFIED");
        if (
          processes === "UNVERIFIED" ||
          processes.split(/\r?\n/).some((name) => name.trim() === packageId || name.trim().startsWith(packageId + ":"))
        )
          cleanup.push("native-app-process-unverified");
      }
      if (reverseOwned && (await run(["reverse", "--list"]).catch(() => binding)).includes(binding))
        cleanup.push("owned-adb-reverse-unverified");
      const receipt = testInfo.outputPath("native-journal-receipt.json");
      await writeFile(
        receipt,
        JSON.stringify(
          {
            version: 1,
            ...(await deviceLabSourceIdentity([
              "tests/e2e/landfall-native-journal.spec.ts",
              "tests/e2e/fixtures/landfall-closure.ts",
            ])),
            result: passed && !cleanup.length ? "PASS" : "FAIL",
            nativeForeground,
            requestedWorldspace: virtual ? "VIRTUAL" : "PHYSICAL",
            worldspace: voyage.definition.worldspaces[0].kind,
            evidenceClass: "EMULATOR_PROVEN",
            scenario: virtual
              ? null
              : {
                  id: "gps-perfect-walk",
                  version: landfallDeviceScenario("gps-perfect-walk").version,
                  scope: "LOCATION_ACTIONS_ONLY",
                },
            apkSha256: createHash("sha256").update(apk).digest("hex"),
            nativeFixes: fixes,
            canonicalEvents,
            physicalFieldRequired: true,
            cleanup: { result: cleanup.length ? "FAIL" : "PASS", remainingResources: cleanup },
          },
          null,
          2,
        ),
      );
      await testInfo.attach("native-journal-receipt", { path: receipt, contentType: "application/json" });
      expect(cleanup).toEqual([]);
    }
  });
}
