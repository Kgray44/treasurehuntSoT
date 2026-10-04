import { expect, test } from "@playwright/test";
import { _android, type AndroidDevice, type Page } from "playwright";
import { createHash } from "node:crypto";
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { db } from "../../src/lib/db";
import { currentAccount } from "../../src/wayfarer/accounts";
import { landfallFixture } from "../../src/landfall/fixtures";
import { landfallDeviceScenario } from "../../src/landfall/device-lab/scenarios";
import { rebootOwnedAndroidGuest } from "../../src/landfall/device-lab/android-reboot";
import { nativeLandfallNoticeTouch } from "../../src/landfall/device-lab/native-notice-control";
import { nativeCpuSnapshot, nativeCpuMeasurement } from "../../src/landfall/device-lab/native-cpu-measurement";
import { nativeReturnObservationSchema } from "../../src/landfall/device-lab/native-return-observation";
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
  const observerPath = path.resolve(process.env.LANDFALL_NATIVE_RETURN_OBSERVATION_PATH ?? "");
  if (
    path.dirname(observerPath) !== path.resolve("artifacts/landfall-device-lab") ||
    !/^native-return-observer-[a-f0-9-]{36}\.json$/.test(path.basename(observerPath))
  )
    throw new Error("NATIVE_RETURN_OBSERVER_OWNERSHIP_REQUIRED");
  const readReturns = async () => {
    const raw = await readFile(observerPath, "utf8");
    if (raw.length > 16384) throw new Error("NATIVE_RETURN_OBSERVER_TOO_LARGE");
    const observation = nativeReturnObservationSchema.parse(JSON.parse(raw));
    if (observation.sourceSha !== source.sourceSha) throw new Error("NATIVE_RETURN_OBSERVER_SOURCE_MISMATCH");
    return observation.events;
  };
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
      const cpuMeasurements: ({ stage: string } & ReturnType<typeof nativeCpuMeasurement>)[] = [];
      let persistentSessionConfigured = false;
      let coldSession: {
        cookiePresent: boolean;
        expectedCookie: boolean;
        persistent: boolean;
        httpOnly: boolean;
        cookieFutureOnGuest: boolean;
        databaseSessionActive: boolean;
        canonicalSessionEligible: boolean;
        playerProfileActive: boolean;
        signInDestination: boolean;
      } | null = null;
      const noticeControls: { phase: string; hierarchyAttempts: number; controlObserved: boolean }[] = [];
      let failureKind: string | null = null;
      let failureTransport: {
        ownerCancelled: boolean;
        pageClosed: boolean | null;
        code: string | null;
        processKilled: boolean;
      } | null = null;
      let firstReturnPageClosed: boolean | null = null;
      let returnHopObservation: "UNOBSERVED" | "HTTP_307_OBSERVED" | "DRIVER_CLOSED_BEFORE_RESPONSE" = "UNOBSERVED";
      const serverReturnOutcomes: string[] = [];
      const deniedRequestCookies: ("ABSENT" | "PRESENT")[] = [];
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
      const measureCpu = async (label: string) => {
        const pid = (await adb(["shell", "pidof", pkg])).trim();
        if (!/^[1-9][0-9]{0,8}$/.test(pid)) throw new Error("NATIVE_CPU_PROCESS_UNOBSERVED");
        const snapshot = async () =>
          nativeCpuSnapshot(
            await adb(["shell", "cat", "/proc/stat"]),
            await adb(["shell", "run-as", pkg, "cat", `/proc/${pid}/stat`]),
          );
        const before = await snapshot(),
          started = performance.now();
        await delay(15000);
        const after = await snapshot();
        if ((await adb(["shell", "pidof", pkg])).trim() !== pid) throw new Error("NATIVE_CPU_PROCESS_CHANGED");
        const measurement = nativeCpuMeasurement(before, after, performance.now() - started);
        cpuMeasurements.push({ stage: label, ...measurement });
        expect(measurement.nativeParentCpuPercent).toBeLessThanOrEqual(50);
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
      const tapActualNotice = async (phase: "FIRST" | "REVOKED") => {
        const file = "/data/local/tmp/landfall-public-notice.xml";
        const control = { phase, hierarchyAttempts: 0, controlObserved: false };
        noticeControls.push(control);
        stage = `${phase}_NOTICE_SHADE`;
        await adb(["shell", "cmd", "statusbar", "expand-notifications"]);
        try {
          const deadline = Date.now() + 20000;
          while (Date.now() < deadline) {
            stage = `${phase}_NOTICE_HIERARCHY`;
            control.hierarchyAttempts++;
            await adb(["shell", "uiautomator", "dump", file], Math.min(15000, Math.max(1000, deadline - Date.now())));
            stage = `${phase}_NOTICE_CONTROL`;
            let target;
            try {
              target = nativeLandfallNoticeTouch(await adb(["shell", "cat", file]));
            } catch (error) {
              if (!(error instanceof Error) || error.message !== "NATIVE_NOTICE_UNOBSERVED") throw error;
              await delay(500);
              continue;
            }
            control.controlObserved = true;
            stage = `${phase}_NOTICE_TOUCH`;
            await adb(["shell", "input", "tap", String(target.x), String(target.y)]);
            return;
          }
          throw new Error("NATIVE_NOTICE_UNOBSERVED");
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
        const stored = await cdp.send("Network.getCookies", { urls: [origin.origin] });
        const sessionCookie = stored.cookies.find(
          (item) => item.name === "wayfarer_account" && item.value === player.token,
        );
        persistentSessionConfigured = Boolean(
          sessionCookie &&
            !sessionCookie.session &&
            sessionCookie.httpOnly &&
            sessionCookie.expires === Math.floor(accountSession.expiresAt.getTime() / 1000),
        );
        expect(persistentSessionConfigured).toBe(true);
        await cdp.detach();
        await journal.goto(`${origin.origin}/player/playthroughs/${voyage.id}/journal`);
        await journal.waitForFunction(() => Boolean(window.LandfallNative), undefined, { timeout: 15000 });
        await openNativeJournalEntry(journal, adb, (next) => {
          stage = `INITIAL_${next}`;
        });
        await openClosureMap(journal, { noWaitAfter: true });
        const panel = journal.getByRole("region", { name: "Optional background reminders" });
        await expect(panel).toBeVisible();
        await measurePss("FOREGROUND_JOURNAL");
        await measureCpu("FOREGROUND_JOURNAL");
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
        const firstReturnBaseline = (await readReturns()).length;
        const firstReturnStarted = performance.now();
        await tapActualNotice("FIRST");
        stage = "FIRST_ACTUAL_RETURN_HOP";
        await expect
          .poll(async () => (await readReturns()).slice(firstReturnBaseline).map((event) => event.outcome), {
            timeout: 45000,
          })
          .toContain("RETURNED");
        serverReturnOutcomes.push("RETURNED");
        stage = "FIRST_RETURN_HTTP";
        await expect.poll(() => returnHopStatus !== null || journal.isClosed(), { timeout: 45000 }).toBe(true);
        firstReturnPageClosed = journal.isClosed();
        const observedReturnStatus = ((): number | null => returnHopStatus)();
        if (observedReturnStatus !== null) {
          expect(observedReturnStatus).toBe(307);
          returnHopObservation = "HTTP_307_OBSERVED";
        } else {
          expect(firstReturnPageClosed).toBe(true);
          // Actual platform RETURNED and the newly observed Journal remain
          // mandatory. A closed driver cannot establish an HTTP status.
          returnHopObservation = "DRIVER_CLOSED_BEFORE_RESPONSE";
        }
        stage = "FIRST_RETURN_REATTACH";
        // An OS return may recreate a WebView. Observe the current owned page;
        // never reuse a stale driver or inject another session after the tap.
        await closeDrivers();
        const activeJournal = await attach(false);
        stage = "FIRST_RETURN_JOURNAL";
        await expect
          .poll(() => new URL(activeJournal.url()).pathname, { timeout: 45000 })
          .toBe(`/player/playthroughs/${voyage.id}/journal`);
        await openNativeJournalEntry(activeJournal, adb, (next) => {
          stage = `FIRST_RETURN_${next}`;
        });
        activeReturn = true;
        measurements.push({ stage: "ACTIVE_NOTICE_RETURN", elapsedMs: performance.now() - firstReturnStarted });
        await measurePss("ACTIVE_NOTICE_RETURN");
        await measureCpu("ACTIVE_NOTICE_RETURN");
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
        const revokedReturnBaseline = (await readReturns()).length;
        const revokedStarted = performance.now();
        await tapActualNotice("REVOKED");
        stage = "REVOKED_ACTUAL_RETURN_HOP";
        await expect
          .poll(async () => (await readReturns()).length, {
            timeout: 45000,
          })
          .toBeGreaterThan(revokedReturnBaseline);
        const coldEvents = (await readReturns()).slice(revokedReturnBaseline);
        const coldOutcomes = coldEvents.map((event) => event.outcome);
        deniedRequestCookies.push(
          ...coldEvents.flatMap((event) =>
            event.authorizationCookie === undefined ? [] : [event.authorizationCookie],
          ),
        );
        serverReturnOutcomes.push(...coldOutcomes);
        const returned = await attach(false);
        const coldCdp = await returned.context().newCDPSession(returned);
        try {
          const jar = await coldCdp.send("Network.getCookies", { urls: [origin.origin] });
          const saved = jar.cookies.find((item) => item.name === "wayfarer_account");
          const guestNow = await returned.evaluate(() => Date.now());
          const session = await db.accountSession.findFirst({
            where: { accountId: player.id },
            select: {
              expiresAt: true,
              revokedAt: true,
              account: { select: { profile: { select: { status: true } } } },
            },
          });
          // Credential values and epochs are compared only in memory. Export
          // finite storage/auth facts even when the genuine return is denied.
          coldSession = {
            cookiePresent: Boolean(saved),
            expectedCookie: saved?.value === player.token,
            persistent: Boolean(saved && !saved.session),
            httpOnly: saved?.httpOnly === true,
            cookieFutureOnGuest: Boolean(saved && saved.expires * 1000 > guestNow),
            databaseSessionActive: Boolean(
              session && session.revokedAt === null && session.expiresAt.getTime() > Date.now(),
            ),
            canonicalSessionEligible: Boolean(await currentAccount(player.token)),
            playerProfileActive: session?.account.profile?.status === "ACTIVE",
            signInDestination: new URL(returned.url()).pathname === "/player/sign-in",
          };
        } finally {
          await coldCdp.detach();
        }
        expect(coldOutcomes).toContain("UNAVAILABLE");
        await returned.waitForFunction(() => Boolean(window.LandfallNative), undefined, { timeout: 15000 });
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
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const details = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
        const code = typeof details.code === "string" ? details.code : null;
        failureTransport = {
          ownerCancelled: resources.signal.aborted,
          pageClosed: page?.isClosed() ?? null,
          code:
            code && ["ABORT_ERR", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOENT", "EPIPE"].includes(code)
              ? code
              : null,
          processKilled: details.killed === true,
        };
        failureKind = /^(?:NATIVE_|LANDFALL_)[A-Z0-9_]{1,100}$/.test(message)
          ? message
          : error instanceof Error && error.name === "AbortError"
            ? "OWNER_CANCELLED"
            : /device offline|device.*not found|no devices\/emulators/i.test(message)
              ? "ANDROID_DEVICE_UNAVAILABLE"
              : /target.*closed|page.*closed|browser.*closed|socket hang up|ECONNRESET/i.test(message)
                ? "TRANSPORT_CLOSED"
                : /timeout|timed out/i.test(message)
                  ? "TIMEOUT"
                  : /expect|assert/i.test(message)
                    ? "ASSERTION"
                    : "NATIVE_OPERATION_FAILED";
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
          failureKind,
          failureTransport,
          firstReturnPageClosed,
          returnHopObservation,
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
          cpuMeasurements,
          persistentSessionConfigured,
          coldSession,
          noticeControls,
          serverReturnOutcomes,
          deniedRequestCookies,
          preliminaryGrossBounds: {
            noticeReturnMs: 60000,
            fullJournalPssKiB: 512 * 1024,
            nativeParentCpuPercent: 50,
            cpuCapacity: "ALL_GUEST_VCPUS",
            passed:
              elapsedBounds &&
              cpuMeasurements.length === 2 &&
              cpuMeasurements.every((row) => row.nativeParentCpuPercent <= 50),
          },
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
