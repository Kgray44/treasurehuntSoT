import { expect, test } from "@playwright/test";
import { _android, type AndroidDevice, type Page } from "playwright";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { db } from "../../src/lib/db";
import { landfallFixture } from "../../src/landfall/fixtures";
import { landfallDeviceScenario } from "../../src/landfall/device-lab/scenarios";
import { rebootOwnedAndroidGuest } from "../../src/landfall/device-lab/android-reboot";
import { nativeLandfallNoticeTouch } from "../../src/landfall/device-lab/native-notice-control";
import {
  deviceLabProfileSchema,
  deviceLabConfigurationSchema,
  validateDeviceLabProfile,
  type DeviceLabConfiguration,
} from "../../src/landfall/device-lab/device-profile";
import { runLandfallAndroidRadioLab } from "../../scripts/landfall/device-lab/android-radio-run";
import { startOwnedAndroidFusedInput } from "../../scripts/landfall/device-lab/android-fused-input";
import { inspectOwnedAndroidLocationAccuracy } from "../../scripts/landfall/device-lab/android-location-settings";
import { deviceLabSourceIdentity } from "../../scripts/landfall/device-lab/source";
import { labTool } from "../../scripts/landfall/device-lab/host";
import { boundedAndroidDriver } from "../../scripts/landfall/device-lab/android-driver";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { closureAccount, closureVoyage, openClosureMap } from "./fixtures/landfall-closure";
import { openNativeJournalEntry } from "./fixtures/landfall-native-opening";

// The signing key must exist in the actual optimized server process, not only
// the test process. The CLI below creates one ephemeral key before that spawn.
test.describe.configure({ timeout: 1_500_000 });
test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(process.env.LANDFALL_NATIVE_BACKGROUND !== "1", "Requires the exclusively owned hosted native return job.");
test.skip(({ browserName }) => browserName !== "chromium", "Own the native guest once.");
test.afterAll(async () => db.$disconnect());

const countersSchema = z.strictObject(
  Object.fromEntries(
    [
      "received",
      "permissionDenied",
      "malformedOrError",
      "unsupportedTransition",
      "inactive",
      "appendRejected",
      "appended",
      "notices",
    ].map((key) => [key, z.number().int().min(0).max(100000)]),
  ),
);
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const sourceInputs = [
  "tests/e2e/landfall-native-background.spec.ts",
  "tests/e2e/fixtures/landfall-native-opening.ts",
  "tests/e2e/fixtures/landfall-closure.ts",
  "tests/e2e/fixtures/sounding-line-isolation.ts",
];

test("real signed notice returns reauthorize Player across actual registered-region guest reboot", async ({
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const startedAt = new Date().toISOString();
  const origin = new URL(baseURL!);
  if (
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.RUNNER_ENVIRONMENT !== "github-hosted" ||
    origin.origin !== "http://127.0.0.1:4487" ||
    !process.env.LANDFALL_PACKAGE_SIGNING_KEY ||
    process.env.LANDFALL_PACKAGE_KEY_ID !== "landfall-native-return-lab"
  )
    throw new Error("LANDFALL_NATIVE_RETURN_OWNERSHIP_REQUIRED");
  const scenarios = [
    "geofence-native-background-wake",
    "device-reboot",
    "notification-return",
    "notification-revoked",
  ].map((id) => {
    const scenario = landfallDeviceScenario(id);
    return { id, version: scenario.version };
  });
  const source = await deviceLabSourceIdentity(sourceInputs);
  const owner = await closureAccount("Native reminder synthetic Creator");
  const player = await closureAccount("Native reminder synthetic Player");
  const definition = structuredClone(landfallFixture);
  definition.worldspaces[0].observationPolicy.allowedSources.push("NATIVE_LOCATION");
  definition.waypoints[0].evidenceProfile.acceptedSources.push("NATIVE_LOCATION");
  const voyage = await closureVoyage(owner, player, "livingChart", { authoredDefinition: definition });
  const baseline = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
  const before = await db.taleSessionEvent.count({ where: { sessionId: voyage.id } });
  await runLandfallAndroidRadioLab({
    kind: "PRODUCTION_BACKGROUND_RETURN",
    execute: async (resources) => {
      const pkg = "com.voyagewright.landfall",
        serial = resources.serials[0],
        binding = "tcp:4487";
      const adb = (args: string[], timeout = 30000) =>
        labTool(resources.adbPath, ["-P", String(resources.adbPort), "-s", serial, ...args], timeout, resources.signal);
      let appOwned = false,
        reverseOwned = false,
        stage = "PREFLIGHT",
        passed = false;
      let devices: AndroidDevice[] = [],
        page: Page | undefined;
      let fused: Awaited<ReturnType<typeof startOwnedAndroidFusedInput>> | null = null;
      const remaining: string[] = [],
        measurements: { stage: string; elapsedMs?: number; pssKiB?: number }[] = [];
      const receiverRows: { stage: string; counters: Record<string, number> }[] = [];
      let settings: Awaited<ReturnType<typeof inspectOwnedAndroidLocationAccuracy>> | null = null;
      let reboot: Awaited<ReturnType<typeof rebootOwnedAndroidGuest>> | null = null;
      let signedRegistration = false,
        bootRegistration = false,
        activeReturn = false,
        revokedReturn = false;
      let backgroundStatus: number | null = null,
        returnHopStatus: number | null = null;
      let bootState: string | null = null;
      let bootDiagnostics: {
        userUnlocked: boolean;
        packageStopped: boolean | null;
        bootBroadcastQueuedForPackage: boolean;
        elapsedMs: number;
      } | null = null;
      let configuration: DeviceLabConfiguration | null = null;
      const profile = deviceLabProfileSchema.parse(process.env.LANDFALL_LAB_PROFILE);
      let osVersion: string | null = null,
        runtimeVersion: string | null = null;
      const readReceiver = async () => {
        const raw = await adb(["shell", "run-as", pkg, "cat", "files/landfall-geofence-receiver-debug.json"]);
        if (raw.length > 1024) throw new Error("NATIVE_RETURN_DIAGNOSTIC_TOO_LARGE");
        return countersSchema.parse(JSON.parse(raw));
      };
      const measurePss = async (label: string) => {
        const value = await adb(["shell", "dumpsys", "meminfo", pkg]);
        const match = /TOTAL PSS:\s*(\d+)/.exec(value) ?? /^\s*TOTAL\s+(\d+)\s/m.exec(value);
        if (!match) throw new Error("NATIVE_RETURN_PSS_UNOBSERVED");
        const pssKiB = Number(match[1]);
        if (!Number.isSafeInteger(pssKiB) || pssKiB <= 0) throw new Error("NATIVE_RETURN_PSS_INVALID");
        measurements.push({ stage: label, pssKiB });
        expect(pssKiB).toBeLessThanOrEqual(512 * 1024);
      };
      const closeDrivers = async () => {
        for (const device of devices) await boundedAndroidDriver(device.close(), undefined, 15000);
        devices = [];
        page = undefined;
      };
      const attach = async (requireNative = true) => {
        devices = await boundedAndroidDriver(
          _android.devices({ host: "127.0.0.1", port: resources.adbPort, omitDriverInstall: true }),
          resources.signal,
        );
        const device = devices.find((item) => item.serial() === serial);
        if (!device) throw new Error("NATIVE_RETURN_DEVICE_MISSING");
        const view = await device.webView({ pkg }, { timeout: 30000 });
        page = await boundedAndroidDriver(view.page(), resources.signal);
        if (requireNative)
          await page.waitForFunction(() => Boolean(window.LandfallNative), undefined, { timeout: 15000 });
        return page;
      };
      const background = async () => {
        await adb([
          "shell",
          "am",
          "start",
          "-W",
          "-a",
          "android.intent.action.MAIN",
          "-c",
          "android.intent.category.HOME",
        ]);
        const state = await adb(["shell", "dumpsys", "activity", "activities"]);
        if (
          state.split(/\r?\n/).some((line) => /(mResumedActivity|topResumedActivity)/.test(line) && line.includes(pkg))
        )
          throw new Error("NATIVE_RETURN_BACKGROUND_UNOBSERVED");
      };
      const realEntry = async (minimumNotices: number) => {
        if (!fused) throw new Error("NATIVE_RETURN_FUSED_INPUT_REQUIRED");
        await fused.phase("OUTSIDE_BASELINE");
        const started = performance.now();
        await delay(180000);
        const outside = await fused.read();
        expect(outside.state).toBe("DELIVERED");
        expect(outside.delivered).toBeGreaterThan(0);
        measurements.push({ stage: "OUTSIDE_BASELINE", elapsedMs: performance.now() - started });
        await fused.phase("INSIDE_TRANSITION");
        const insideStarted = performance.now(),
          deadline = Date.now() + 180000;
        let observed: Record<string, number> | undefined;
        while (Date.now() < deadline && !resources.signal.aborted) {
          try {
            const counters = await readReceiver();
            if (counters.notices >= minimumNotices) {
              observed = counters;
              break;
            }
          } catch {
            /*No callback inferred.*/
          }
          await delay(1000);
        }
        if (!observed) throw new Error("NATIVE_RETURN_REAL_NOTICE_UNOBSERVED");
        receiverRows.push({ stage, counters: observed });
        for (const name of [
          "permissionDenied",
          "malformedOrError",
          "unsupportedTransition",
          "inactive",
          "appendRejected",
        ])
          expect(observed[name]).toBe(0);
        measurements.push({ stage: "INSIDE_REAL_NOTICE", elapsedMs: performance.now() - insideStarted });
      };
      const tapActualNotice = async () => {
        const file = "/data/local/tmp/landfall-public-notice.xml";
        await adb(["shell", "cmd", "statusbar", "expand-notifications"]);
        try {
          await adb(["shell", "uiautomator", "dump", file]);
          const target = nativeLandfallNoticeTouch(await adb(["shell", "cat", file]));
          await adb(["shell", "input", "tap", String(target.x), String(target.y)]);
        } finally {
          await adb(["shell", "rm", "-f", file]);
        }
      };
      try {
        if ((await adb(["reverse", "--list"])).includes(binding))
          throw new Error("NATIVE_RETURN_BINDING_ALREADY_OWNED");
        const sizes = [...(await adb(["shell", "wm", "size"])).matchAll(/(?:Physical|Override) size:\s*(\d+)x(\d+)/g)];
        const densities = [
          ...(await adb(["shell", "wm", "density"])).matchAll(/(?:Physical|Override) density:\s*(\d+)/g),
        ];
        const memory = /MemTotal:\s+(\d+)\s+kB/.exec(await adb(["shell", "cat", "/proc/meminfo"]));
        configuration = validateDeviceLabProfile(
          profile,
          deviceLabConfigurationSchema.parse({
            platform: "ANDROID",
            virtual: true,
            api: Number((await adb(["shell", "getprop", "ro.build.version.sdk"])).trim()),
            model: (await adb(["shell", "getprop", "ro.product.model"])).trim(),
            memoryKiB: Number(memory?.[1]),
            widthPixels: Number(sizes.at(-1)?.[1]),
            heightPixels: Number(sizes.at(-1)?.[2]),
            densityDpi: Number(densities.at(-1)?.[1]),
          }),
        );
        osVersion = z
          .string()
          .regex(/^[0-9.]{1,32}$/)
          .parse((await adb(["shell", "getprop", "ro.build.version.release"])).trim());
        await adb(["reverse", binding, binding]);
        reverseOwned = true;
        appOwned = true;
        if (!(await adb(["install", "-r", resources.apkPath], 90000)).includes("Success"))
          throw new Error("NATIVE_RETURN_INSTALL_FAILED");
        if (!(await adb(["shell", "pm", "clear", pkg])).includes("Success"))
          throw new Error("NATIVE_RETURN_PRIVATE_RESET_FAILED");
        await adb(["shell", "cmd", "location", "set-location-enabled", "true"]);
        for (const permission of [
          "ACCESS_COARSE_LOCATION",
          "ACCESS_FINE_LOCATION",
          "ACCESS_BACKGROUND_LOCATION",
          "POST_NOTIFICATIONS",
        ])
          await adb(["shell", "pm", "grant", pkg, `android.permission.${permission}`]);
        stage = "OBSERVE_OS_ACCURACY";
        settings = await inspectOwnedAndroidLocationAccuracy(adb);
        fused = await startOwnedAndroidFusedInput(adb, process.cwd());
        await fused.phase("OUTSIDE_BASELINE");
        stage = "OPEN_REAL_NATIVE_JOURNAL";
        const launched = await adb([
          "shell",
          "am",
          "start",
          "-W",
          "-n",
          `${pkg}/.LandfallActivity`,
          "--ez",
          "labBootstrap",
          "true",
        ]);
        if (/Error:|Exception/.test(launched)) throw new Error("NATIVE_RETURN_LAUNCH_FAILED");
        const journal = await attach(false);
        const agent = await journal.evaluate(() => navigator.userAgent);
        runtimeVersion = z
          .string()
          .regex(/^[0-9.]{1,80}$/)
          .parse(/Chrome\/([0-9.]+)/.exec(agent)?.[1]);
        const accountSession = await db.accountSession.findFirstOrThrow({
          where: { accountId: player.id },
          select: { expiresAt: true },
        });
        const cdp = await journal.context().newCDPSession(journal);
        const cookie = await cdp.send("Network.setCookie", {
          name: "wayfarer_account",
          value: player.token,
          url: origin.origin,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
          expires: Math.floor(accountSession.expiresAt.getTime() / 1000),
        });
        expect(cookie.success).toBe(true);
        await cdp.detach();
        await journal.goto(`${origin.origin}/player/playthroughs/${voyage.id}/journal`);
        await journal.waitForFunction(() => Boolean(window.LandfallNative), undefined, { timeout: 15000 });
        await openNativeJournalEntry(journal, adb);
        await openClosureMap(journal, { noWaitAfter: true });
        const panel = journal.getByRole("region", { name: "Optional background reminders" });
        await expect(panel).toBeVisible();
        await measurePss("FOREGROUND_JOURNAL");
        journal.on("response", (response) => {
          const url = new URL(response.url());
          if (url.origin !== origin.origin) return;
          if (url.pathname.endsWith("/landfall/background")) backgroundStatus = response.status();
          if (url.pathname === "/player/landfall-return") returnHopStatus = response.status();
        });
        // Inspect only finite claim length and availability from the genuine
        // authenticated response. The signed claim never leaves server/native memory.
        const prepared = journal.waitForResponse((response) =>
          new URL(response.url()).pathname.endsWith("/landfall/background"),
        );
        stage = "FIRST_PARTY_REGISTER";
        await panel.getByRole("button", { name: "Enable reminders", exact: true }).click({ noWaitAfter: true });
        const response = await prepared,
          registration = await response.json();
        signedRegistration =
          response.ok() &&
          registration.available === true &&
          typeof registration.returnHandle === "string" &&
          registration.returnHandle.length > 100;
        expect(signedRegistration).toBe(true);
        await expect(panel.getByRole("status")).toContainText("Broad reminder enabled", { timeout: 15000 });
        stage = "FIRST_ACTUAL_BACKGROUND_NOTICE";
        await background();
        await realEntry(1);
        expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(before);
        stage = "FIRST_ACTUAL_NOTICE_TAP";
        const firstReturnStarted = performance.now();
        await tapActualNotice();
        await expect.poll(() => returnHopStatus, { timeout: 45000 }).toBe(307);
        await expect
          .poll(() => new URL(journal.url()).pathname, { timeout: 45000 })
          .toBe(`/player/playthroughs/${voyage.id}/journal`);
        await openNativeJournalEntry(journal, adb);
        expect(returnHopStatus).toBe(307);
        activeReturn = true;
        measurements.push({ stage: "ACTIVE_NOTICE_RETURN", elapsedMs: performance.now() - firstReturnStarted });
        await measurePss("ACTIVE_NOTICE_RETURN");
        stage = "REGISTERED_REGION_ACTUAL_REBOOT";
        await background();
        await fused.phase("STOP");
        await closeDrivers();
        reboot = await rebootOwnedAndroidGuest(
          { ephemeralHostedLinux: true, enabled: true, virtual: true, serial, port: 4487 },
          { adb, now: Date.now, delay },
        );
        await adb(["shell", "input", "keyevent", "KEYCODE_WAKEUP"]);
        await adb(["shell", "wm", "dismiss-keyguard"]);
        const bootObservationStarted = Date.now();
        const bootDeadline = bootObservationStarted + 180000;
        while (Date.now() < bootDeadline) {
          try {
            const raw = await adb(["shell", "run-as", pkg, "cat", "files/landfall-boot-region-debug.json"]);
            if (raw.length > 256) throw new Error("NATIVE_BOOT_DIAGNOSTIC_TOO_LARGE");
            const boot = z
              .strictObject({
                state: z.enum([
                  "BOOT_RECEIVED",
                  "GRANTED",
                  "PERMISSION_REQUIRED",
                  "NO_ACTIVE_REGION",
                  "TIMED_OUT",
                  "UNAVAILABLE",
                ]),
              })
              .parse(JSON.parse(raw));
            bootState = boot.state;
            if (bootState !== "BOOT_RECEIVED") break;
          } catch {
            /*Actual boot completion alone does not prove registration.*/
          }
          await delay(500);
        }
        const userState = await adb(["shell", "dumpsys", "user"]);
        const packageState = await adb(["shell", "dumpsys", "package", pkg]);
        const broadcasts = await adb(["shell", "dumpsys", "activity", "broadcasts"]);
        const stopped = /User 0:[^\r\n]*\bstopped=(true|false)\b/.exec(packageState);
        bootDiagnostics = {
          userUnlocked: /(?:UserInfo\{0:|User #0:)[\s\S]{0,256}RUNNING_UNLOCKED/.test(userState),
          packageStopped: stopped ? stopped[1] === "true" : null,
          bootBroadcastQueuedForPackage: broadcasts
            .split(/\r?\n/)
            .some((line) => line.includes(pkg) && line.includes("BOOT_COMPLETED")),
          elapsedMs: Date.now() - bootObservationStarted,
        };
        expect(bootState).toBe("GRANTED");
        bootRegistration = true;
        fused = await startOwnedAndroidFusedInput(adb, process.cwd());
        stage = "POST_REBOOT_REAL_NOTICE";
        await realEntry(2);
        await db.playthroughMembership.update({
          where: { playthroughId_playerProfileId: { playthroughId: voyage.id, playerProfileId: player.profileId } },
          data: { status: "REMOVED", removedAt: new Date() },
        });
        stage = "REVOKED_ACTUAL_NOTICE_TAP";
        const revokedStarted = performance.now();
        await tapActualNotice();
        const returned = await attach();
        await expect.poll(() => new URL(returned.url()).pathname, { timeout: 45000 }).toBe("/player");
        revokedReturn = true;
        measurements.push({
          stage: "REVOKED_NOTICE_RETURN_AFTER_REBOOT",
          elapsedMs: performance.now() - revokedStarted,
        });
        await measurePss("REVOKED_NOTICE_RETURN_AFTER_REBOOT");
        stage = "CLEAR_NATIVE_REMINDER";
        const cleared = await returned.evaluate(
          async () =>
            await window.LandfallNative!.request(
              JSON.stringify({ version: 1, id: crypto.randomUUID(), operation: "GEOFENCE_CLEAR", payload: {} }),
            ),
        );
        expect(cleared).toMatchObject({ accepted: true });
        const after = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
        expect(after.currentSequence).toBe(baseline.currentSequence);
        expect(after.currentBlockId).toBe(baseline.currentBlockId);
        expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(before);
        passed = true;
      } catch {
        // Error text, protocol URLs and Playwright snapshots can contain an opaque
        // claim or account cookie. Export the finite stage and explicit observations.
        throw new Error(`LANDFALL_NATIVE_BACKGROUND_FAILED:${stage}`);
      } finally {
        await closeDrivers().catch(() => remaining.push("native-webview-driver"));
        if (fused) await fused.cleanup().catch(() => remaining.push("android-fused-mock-input"));
        if (appOwned) {
          await adb(["shell", "am", "force-stop", pkg]).catch(() => remaining.push("native-app-stop"));
          if (!(await adb(["shell", "pm", "clear", pkg]).catch(() => "")).includes("Success"))
            remaining.push("native-private-data");
        }
        if (reverseOwned) await adb(["reverse", "--remove", binding]).catch(() => remaining.push("native-reverse"));
        if ((await adb(["reverse", "--list"]).catch(() => binding)).includes(binding))
          remaining.push("native-reverse-unverified");
        const after = await deviceLabSourceIdentity(sourceInputs);
        const events = (await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })) - before;
        const elapsedBounds = measurements
          .filter((row) => row.stage.includes("RETURN") && row.elapsedMs !== undefined)
          .every((row) => row.elapsedMs! <= 60000);
        const receipt = {
          version: 1,
          scenarioId: "first-party-native-background-return",
          scenarioVersion: 1,
          hostPlatform: "LINUX",
          environment: "ANDROID_EMULATOR",
          target: "android-emulator",
          osVersion,
          runtimeVersion,
          providerVersions: { nativeBridge: "1", playServicesLocation: "21.3.0" },
          publishedFixture: "landfall-first-party-native-return-v1",
          fixtureHash: createHash("sha256").update(JSON.stringify(voyage.definition)).digest("hex"),
          timing: "WALL_CLOCK",
          startedAt,
          endedAt: new Date().toISOString(),
          deviceConfiguration: configuration,
          source,
          sourceUnchanged: source.sourceFingerprint === after.sourceFingerprint,
          scenarios,
          result:
            passed &&
            remaining.length === 0 &&
            events === 0 &&
            elapsedBounds &&
            source.sourceFingerprint === after.sourceFingerprint
              ? "PASS"
              : "FAIL",
          failedStage: passed ? null : stage,
          deviceProfile: profile,
          evidenceClass: passed ? "EMULATOR_PROVEN" : "EXECUTION_FAILED",
          nativeBridge: "REAL_ANDROID_OS",
          firstPartyApi: "REAL_OPTIMIZED_APPLICATION",
          geofenceInput: "DOCUMENTED_FLP_MOCK_LOCATION",
          signedRegistration,
          backgroundStatus,
          returnHopStatus,
          settings,
          receiverRows,
          reboot,
          bootState,
          bootDiagnostics,
          bootRegistration,
          activeReturn,
          revokedReturn,
          canonicalAuthority: "ONE_VOYAGE_REAL_SQLITE",
          canonicalProgressionEvents: events,
          canComplete: false,
          measurements,
          preliminaryGrossBounds: { noticeReturnMs: 60000, fullJournalPssKiB: 512 * 1024, passed: elapsedBounds },
          physicalTimingProven: false,
          externalRequirements: [
            "REAL_DEVICE_REQUIRED:OEM_SUSPENSION",
            "FIELD_REQUIRED:GPS",
            "REAL_DEVICE_REQUIRED:BATTERY_THERMAL",
          ],
          cleanup: { result: remaining.length ? "FAIL" : "PASS", remainingResources: remaining },
        };
        await writeFile(
          path.join(resources.artifactDirectory, "native-background-return-receipt.json"),
          JSON.stringify(receipt, null, 2),
        );
        if (passed) expect(receipt.result).toBe("PASS");
      }
    },
  });
});
