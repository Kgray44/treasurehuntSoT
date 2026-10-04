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
import { nativeJournalOpeningTouch } from "../../src/landfall/device-lab/native-opening-control";
import { boundedAndroidDriver as boundedDriver } from "../../scripts/landfall/device-lab/android-driver";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { closureAccount, closureVoyage, openClosureMap } from "./fixtures/landfall-closure";

test.describe.configure({ timeout: 900_000 });
test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(process.env.LANDFALL_NATIVE_NEARBY !== "1", "Requires an exclusively owned ephemeral Linux radio runner.");
test.skip(({ browserName }) => browserName !== "chromium", "Run native ownership once.");
test.afterAll(async () => db.$disconnect());

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
      let deviceIndex: number | null = null;
      let journalResponseStatus: number | null = null;
      let failureKind: string | null = null;
      let failureTool: {
        code: number | null;
        signal: string | null;
        killed: boolean;
        deviceOffline: boolean;
        installRejected: boolean;
      } | null = null;
      let failureChecks: {
        pointerIntercepted: boolean;
        unstableTarget: boolean;
        invisibleTarget: boolean;
        targetClosed: boolean;
        waitingForNavigation: boolean;
        waitingForLocator: boolean;
      } | null = null;
      const nativePageErrors = new Set<string>();
      let failedFirstPartyRequests = 0;
      const nearbyHttp: { deviceIndex: number; operation: string; status: number | null; failure: string | null }[] =
        [];
      let failedPageState: {
        closed: boolean;
        journalPath: boolean;
        loginPath: boolean;
        readyState?: string;
        nativeBridgeAvailable?: boolean;
        toolsVisible?: boolean;
        openingVisible?: boolean;
      } | null = null;
      const journalStates: {
        deviceIndex: number;
        status: number | null;
        shellVisible: boolean;
        nativeBridgeAvailable: boolean;
        authRedirect: boolean;
      }[] = [];
      const pairingDiagnostics: { deviceIndex: number; nativeState: string; uiState: string }[] = [];
      const openingSkippedDevices: number[] = [];
      const adb = (serial: string, args: string[], timeout = 15000) =>
        labTool(resources.adbPath, ["-P", String(resources.adbPort), "-s", serial, ...args], timeout);
      try {
        for (const serial of resources.serials) {
          deviceIndex = resources.serials.indexOf(serial);
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
          stage = "ACQUIRE_NATIVE_REVERSE_BINDING";
          await adb(serial, ["reverse", binding, binding]);
          stage = "INSTALL_NATIVE_APK";
          if (!(await adb(serial, ["install", "-r", resources.apkPath])).includes("Success"))
            throw new Error("LANDFALL_NATIVE_NEARBY_INSTALL_FAILED");
          stage = "RESET_NATIVE_PRIVATE_DATA";
          if (!(await adb(serial, ["shell", "pm", "clear", pkg])).includes("Success"))
            throw new Error("LANDFALL_NATIVE_NEARBY_RESET_FAILED");
          stage = "GRANT_NATIVE_RANGING";
          await adb(serial, ["shell", "pm", "grant", pkg, "android.permission.RANGING"]);
          stage = "LAUNCH_NATIVE_BOOTSTRAP";
          const launch = await adb(
            serial,
            [
              "shell",
              "am",
              "start",
              "-W",
              "-n",
              `${pkg}/.LandfallActivity`,
              "--es",
              "labOrigin",
              origin.origin,
              "--ez",
              "labBootstrap",
              "true",
            ],
            45000,
          );
          if (/Error:|Exception/.test(launch)) throw new Error("LANDFALL_NATIVE_NEARBY_LAUNCH_FAILED");
        }
        stage = "ENUMERATE_NATIVE_DRIVERS";
        devices = await boundedDriver(
          _android.devices({ host: "127.0.0.1", port: resources.adbPort, omitDriverInstall: true }),
          resources.signal,
        );
        stage = "OPEN_AUTHORIZED_JOURNALS";
        for (const serial of resources.serials) {
          deviceIndex = resources.serials.indexOf(serial);
          const device = devices.find((item) => item.serial() === serial);
          if (!device) throw new Error("LANDFALL_NATIVE_NEARBY_DEVICE_MISSING");
          stage = "CONNECT_NATIVE_WEBVIEW";
          const view = await device.webView({ pkg }, { timeout: 30000 });
          stage = "CONNECT_NATIVE_PAGE";
          const page = await boundedDriver(view.page(), resources.signal);
          pages.push(page);
          page.on("pageerror", (error) =>
            nativePageErrors.add(
              ["TypeError", "ReferenceError", "SyntaxError", "RangeError"].includes(error.name) ? error.name : "OTHER",
            ),
          );
          page.on("requestfailed", (request) => {
            if (new URL(request.url()).origin === origin.origin) failedFirstPartyRequests++;
          });
          const httpDeviceIndex = deviceIndex;
          const nearbyOperation = (request: { url(): string; postData(): string | null }) => {
            const url = new URL(request.url());
            if (url.origin !== origin.origin || !url.pathname.endsWith("/landfall/nearby")) return null;
            const body = request.postData();
            if (!body || body.length > 16384) return "UNKNOWN";
            try {
              const value = JSON.parse(body).operation;
              return ["STATUS", "CREATE", "JOIN", "READ", "STOP"].includes(value) ? value : "UNKNOWN";
            } catch {
              return "UNKNOWN";
            }
          };
          page.on("response", (response) => {
            const operation = nearbyOperation(response.request());
            if (operation && nearbyHttp.length < 32)
              nearbyHttp.push({ deviceIndex: httpDeviceIndex, operation, status: response.status(), failure: null });
          });
          page.on("requestfailed", (request) => {
            const operation = nearbyOperation(request);
            if (operation && nearbyHttp.length < 32)
              nearbyHttp.push({
                deviceIndex: httpDeviceIndex,
                operation,
                status: null,
                failure: request.failure()?.errorText.includes("ERR_ABORTED") ? "ABORTED" : "NETWORK_FAILED",
              });
          });
          page.setDefaultTimeout(10000);
          page.setDefaultNavigationTimeout(45000);
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
          stage = "NAVIGATE_NATIVE_JOURNAL";
          const response = await page.goto(new URL(`/player/playthroughs/${voyage.id}/journal`, origin).href, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
          journalResponseStatus = response?.status() ?? null;
          stage = "NATIVE_JOURNAL_SHELL";
          const opening = page.getByRole("dialog", { name: "Open the voyage journal" });
          const tools = page.getByRole("navigation", { name: "Journal tools" });
          await expect
            .poll(async () => (await opening.isVisible()) || (await tools.isVisible()), { timeout: 30000 })
            .toBe(true);
          journalStates.push({
            deviceIndex,
            status: journalResponseStatus,
            shellVisible: true,
            nativeBridgeAvailable: await page.evaluate(() => window.LandfallNative?.platform === "ANDROID"),
            authRedirect: !page.url().includes(`/playthroughs/${voyage.id}/journal`),
          });
          stage = "CLICK_NATIVE_JOURNAL_OPEN";
          // Opening replaces its modal in place. Native CDP navigation signals may
          // remain pending; assert the resulting tools separately after a normal tap.
          if (await opening.isVisible()) {
            // Target the exact source-owned control to isolate the failed nested
            // role lookup, and still require its normal visible copy and tap.
            const open = page.locator("button.wax-open");
            await expect(open).toBeVisible();
            await expect(open).toContainText("Open the journal");
            try {
              // Use a normal OS touch from the observed accessibility control.
              // This is before any pairing code or native evidence acquisition.
              const dump = "/data/local/tmp/landfall-public-opening.xml";
              try {
                await adb(serial, ["shell", "uiautomator", "dump", dump]);
                const box = await open.boundingBox();
                if (!box) throw new Error("NATIVE_OPENING_DOM_GEOMETRY_UNOBSERVED");
                const viewport = await page.evaluate(() => ({
                  width: innerWidth,
                  height: innerHeight,
                  scale: visualViewport?.scale ?? 1,
                }));
                const target = nativeJournalOpeningTouch(await adb(serial, ["shell", "cat", dump]), { box, viewport });
                await adb(serial, ["shell", "input", "tap", String(target.x), String(target.y)]);
              } finally {
                await adb(serial, ["shell", "rm", "-f", dump]);
              }
            } catch (error) {
              // A timed-out click may have already started the opening.
              // Continue only if that real transition is visible.
              const progress = page.getByRole("dialog", { name: "Journal opening in progress" });
              if (!(await progress.isVisible()) && !(await tools.isVisible())) throw error;
            }
            const progress = page.getByRole("dialog", { name: "Journal opening in progress" });
            if (await progress.isVisible()) {
              stage = "SKIP_NATIVE_JOURNAL_CEREMONY";
              try {
                await progress.getByRole("button", { name: "Skip ceremony", exact: true }).click({ noWaitAfter: true });
                openingSkippedDevices.push(deviceIndex);
              } catch (error) {
                // The actual ceremony can finish while the native click waits.
                // Only the resulting visible tools establish that transition.
                if (!(await tools.isVisible())) throw error;
              }
            }
          }
          stage = "NATIVE_JOURNAL_TOOLS";
          await expect(tools).toBeVisible({ timeout: 30000 });
          stage = "OPEN_NATIVE_MAP";
          await openClosureMap(page, { noWaitAfter: true });
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
          await page.locator(".landfall-nearby-panel:visible summary").click({ noWaitAfter: true });
        }
        const panels = pages.map((page) => page.locator(".landfall-nearby-panel:visible"));
        stage = "FIRST_PARTY_CREATE_OWNER";
        await panels[0].getByRole("button", { name: "Create pairing code", exact: true }).click({ noWaitAfter: true });
        stage = "FIRST_PARTY_OWNER_CODE";
        const code = await panels[0].getByLabel("Pairing code", { exact: true }).textContent();
        expect(typeof code === "string" && /^[A-Za-z0-9_-]{43}$/.test(code)).toBe(true);
        stage = "FIRST_PARTY_JOIN_CODE_INPUT";
        await panels[1].getByLabel("Code from your other device").fill(code!);
        stage = "FIRST_PARTY_JOIN_DEVICE";
        await panels[1].getByRole("button", { name: "Join my other device", exact: true }).click({ noWaitAfter: true });
        stage = "FIRST_PARTY_JOIN_NATIVE_SESSION";
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
        await panels[0].getByRole("button", { name: "Start hints", exact: true }).click({ noWaitAfter: true });
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
        await panels[1].getByRole("button", { name: "Stop nearby hints", exact: true }).click({ noWaitAfter: true });
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
      } catch (error) {
        for (const [index, nativePage] of pages.entries()) {
          const projections = await Promise.allSettled([
            boundedDriver(
              nativePage.evaluate(async () => {
                const response = (await window.LandfallNative!.request(
                  JSON.stringify({
                    version: 1,
                    id: crypto.randomUUID(),
                    operation: "UWB_STATE",
                    payload: {},
                  }),
                )) as { state?: string };
                const nativeState = [
                  "READY",
                  "UNAVAILABLE",
                  "UNSUPPORTED",
                  "INITIALIZING",
                  "DENIED",
                  "PROMPTABLE",
                  "EXPIRED",
                ].includes(response?.state ?? "")
                  ? response.state!
                  : "UNKNOWN";
                return nativeState;
              }),
              undefined,
              3000,
            ),
            boundedDriver(
              nativePage.evaluate(() => {
                const text =
                  document.querySelector(".landfall-nearby-panel [aria-label='Nearby device hint status']")
                    ?.textContent ?? "";
                const uiState = text.includes("unsupported, disabled, or awaiting permission")
                  ? "DEVICE_UNAVAILABLE"
                  : text.includes("unavailable on this deployment")
                    ? "NOT_CONFIGURED"
                    : text.includes("expired or access changed")
                      ? "PAIR_CHANGED"
                      : document.querySelector(".landfall-nearby-panel output")
                        ? "CODE_VISIBLE"
                        : "OTHER";
                return uiState;
              }),
              undefined,
              3000,
            ),
          ]);
          pairingDiagnostics.push({
            deviceIndex: index,
            nativeState: projections[0].status === "fulfilled" ? projections[0].value : "UNOBSERVED",
            uiState: projections[1].status === "fulfilled" ? projections[1].value : "UNOBSERVED",
          });
        }
        const message = error instanceof Error ? error.message : "";
        const tool = error as { code?: unknown; signal?: unknown; killed?: unknown };
        failureTool = {
          code: typeof tool.code === "number" && Number.isInteger(tool.code) ? tool.code : null,
          signal: ["SIGTERM", "SIGKILL"].includes(String(tool.signal)) ? String(tool.signal) : null,
          killed: tool.killed === true,
          deviceOffline: /device offline|device.*not found|no devices\/emulators/i.test(message),
          installRejected: /INSTALL_FAILED_/u.test(message),
        };
        failureChecks = {
          pointerIntercepted: /intercepts pointer|intercept.*event/i.test(message),
          unstableTarget: /not stable/i.test(message),
          invisibleTarget: /not visible/i.test(message),
          targetClosed: /closed|destroyed/i.test(message),
          waitingForNavigation: /waiting for.*navigation|scheduled navigations|navigation.*finish/i.test(message),
          waitingForLocator: /waiting for (?:locator|getByRole)|waiting for.*element/i.test(message),
        };
        failureKind =
          error instanceof Error && /^NATIVE_OPENING_[A-Z_]{1,100}$/.test(error.message)
            ? error.message
            : error instanceof Error && /timeout|timed out/i.test(error.message)
              ? "TIMEOUT"
              : error instanceof Error && /cancelled/i.test(error.message)
                ? "OWNER_CANCELLED"
                : error instanceof Error && /expect|assert/i.test(error.message)
                  ? "ASSERTION"
                  : "NATIVE_OPERATION_FAILED";
        const page = pages.at(-1);
        if (page) {
          failedPageState = {
            closed: page.isClosed(),
            journalPath: page.url().includes(`/playthroughs/${voyage.id}/journal`),
            loginPath: /\/login(?:\?|$|\/)/.test(page.url()),
          };
          if (!page.isClosed()) {
            const state = await boundedDriver(
              page.evaluate(() => ({
                readyState: document.readyState,
                nativeBridgeAvailable: Boolean(window.LandfallNative),
                openingButtonCount: document.querySelectorAll("button.wax-open").length,
                openingButtonInDialog: Boolean(document.querySelector("button.wax-open")?.closest("[role='dialog']")),
                openingButtonDisabled:
                  (document.querySelector("button.wax-open") as HTMLButtonElement | null)?.disabled ?? null,
              })),
              undefined,
              3000,
            ).catch(() => null);
            if (state) Object.assign(failedPageState, state);
            failedPageState.toolsVisible = await page
              .getByRole("navigation", { name: "Journal tools" })
              .isVisible()
              .catch(() => false);
            failedPageState.openingVisible = await page
              .getByRole("dialog", { name: "Open the voyage journal" })
              .isVisible()
              .catch(() => false);
          }
        }
        // This stage contains only the newly-created public synthetic Journal,
        // before pairing codes or any native location/ranging acquisition.
        if (
          ["CLICK_NATIVE_JOURNAL_OPEN", "NATIVE_JOURNAL_TOOLS"].includes(stage) &&
          deviceIndex !== null &&
          !resources.signal.aborted
        ) {
          const png = await labBinaryTool(resources.adbPath, [
            "-P",
            String(resources.adbPort),
            "-s",
            resources.serials[deviceIndex],
            "exec-out",
            "screencap",
            "-p",
          ]).catch(() => null);
          if (png) {
            const shot = testInfo.outputPath("native-journal-opening-diagnostic.png");
            await writeFile(shot, png);
            await testInfo.attach("native-journal-opening-diagnostic", { path: shot, contentType: "image/png" });
          }
        }
        throw error;
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
        const result =
          passed && !remaining.length && events === 0 && source.sourceFingerprint === after.sourceFingerprint
            ? "PASS"
            : "FAIL";
        const receipt = {
          version: 1,
          deviceProfile: profile,
          configurations,
          source,
          sourceUnchanged: source.sourceFingerprint === after.sourceFingerprint,
          evidenceClass: result === "PASS" ? "EMULATOR_PROVEN" : "EXECUTION_FAILED",
          nativeBridge: "REAL_ANDROID_OS",
          firstPartyApi: "REAL_OPTIMIZED_APPLICATION",
          validatedReportsObservedOnBoth: reports.length === 2 && reports.every((count) => count > 0),
          nativeStopObserved,
          peerVerified: false,
          canComplete: false,
          uncertainty: "UNKNOWN",
          canonicalAuthority: "ONE_VOYAGE_REAL_SQLITE",
          canonicalProgressionEvents: events,
          result,
          failedStage: passed ? null : stage,
          failedDeviceIndex: passed ? null : deviceIndex,
          journalResponseStatus,
          failureKind,
          failureTool,
          failureChecks,
          nativePageErrors: [...nativePageErrors],
          failedFirstPartyRequests,
          nearbyHttp,
          failedPageState,
          journalStates,
          pairingDiagnostics,
          openingSkippedDevices,
          externalRequirements: ["REAL_DEVICE_REQUIRED:RF"],
          cleanup: { result: remaining.length ? "FAIL" : "PASS", remainingResources: remaining },
        };
        await writeFile(
          path.join(resources.artifactDirectory, "native-journal-pair-receipt.json"),
          JSON.stringify(receipt, null, 2),
        );
        // Preserve the original protocol/navigation assertion when one failed.
        if (!failureKind) expect(receipt.result).toBe("PASS");
      }
    },
  });
});
