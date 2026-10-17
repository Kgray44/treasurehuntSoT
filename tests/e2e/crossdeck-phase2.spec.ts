// @sounding-line-registration owner=project-crossdeck suite=browser.crossdeck contracts=crossdeck.phase2.continuity
import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { createAccountSession } from "../../src/wayfarer/accounts";
import {
  closureAccount,
  closureVoyage,
  authenticateClosure,
  openClosureJournal,
  openClosureMap,
} from "./fixtures/landfall-closure";
import { createCrossdeckPhase2Packs } from "../../src/crossdeck/lab-phase2";
import { runDeviceLabScenario } from "../../src/device-lab/runner";
import { loadDeviceLabRegistry } from "../../src/device-lab/registry";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";
import { STALE_MS } from "../../src/crossdeck/contracts";
import type { SurfaceDto } from "../../src/crossdeck/service";
import { roleNames } from "../../src/crossdeck/experiences";

test.describe.configure({ mode: "serial", timeout: 240000 });
test.use({ trace: "off", video: "off", screenshot: "off" });
test.afterAll(() => db.$disconnect());
for (const scenarioId of ["crossdeck.surface-handoff", "crossdeck.phone-disconnect"] as const)
  test(scenarioId, async ({ browser, baseURL }, testInfo) => {
    if (
      process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic" &&
      !(process.env.DATABASE_URL ?? "").replaceAll("\\", "/").includes("/artifacts/crossdeck/")
    )
      throw new Error("CROSSDECK_OWNED_DATABASE_REQUIRED");
    let desktop: BrowserContext | undefined, phone: BrowserContext | undefined;
    let accountId: string | undefined, taleId: string | undefined;
    let executionError: unknown;
    const observedRequests: { device: string; method: string; status: number; revision?: number }[] = [];
    const tier = process.env.CROSSDECK_ANDROID_CDP ? ("D2" as const) : ("D1" as const);
    const packs = createCrossdeckPhase2Packs(tier, () => ({
      async execute({ signal }) {
        try {
          if (signal.aborted) throw new Error("ABORTED");
          const account = await closureAccount("Crossdeck synthetic continuity navigator");
          accountId = account.id;
          const voyage = await closureVoyage(account, account, "livingChart", { virtual: true });
          taleId = voyage.taleId;
          const before = {
            players: await db.playerProfile.count(),
            members: await db.playthroughMembership.count(),
            events: await db.taleSessionEvent.count({ where: { sessionId: voyage.id } }),
            sequence: (await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } })).currentSequence,
          };
          const receiver = await createAccountSession(account.id, "Synthetic second device");
          desktop = await browser.newContext({ reducedMotion: "reduce" });
          if (tier === "D2") {
            if (process.env.CROSSDECK_ANDROID_VIRTUAL_VERIFIED !== "1")
              throw new Error("ANDROID_PLATFORM_NOT_VERIFIED");
            const android = await chromium.connectOverCDP(process.env.CROSSDECK_ANDROID_CDP!);
            phone = android.contexts()[0];
            if (!phone) throw new Error("ANDROID_CHROME_UNAVAILABLE");
          } else
            phone = await browser.newContext({
              viewport: { width: 390, height: 844 },
              isMobile: true,
              hasTouch: true,
              reducedMotion: "reduce",
            });
          await authenticateClosure(desktop, account, baseURL!);
          await phone.addCookies([{ name: "wayfarer_account", value: receiver.token, url: baseURL!, sameSite: "Lax" }]);
          const d = await desktop.newPage(),
            p = await phone.newPage();
          d.setDefaultTimeout(15_000);
          p.setDefaultTimeout(15_000);
          for (const [device, page] of [
            ["desktop", d],
            ["phone", p],
          ] as const) {
            page.on("response", async (response) => {
              if (!response.url().includes("/api/crossdeck/sync?")) return;
              const item = {
                device,
                method: response.request().method(),
                status: response.status(),
                revision: undefined as number | undefined,
              };
              observedRequests.push(item);
              try {
                item.revision = (await response.json()).revision;
              } catch {}
            });
          }
          await d.goto(`${baseURL}/account/devices?voyage=${voyage.id}`);
          await d.getByLabel("Device name").fill("Desktop");
          await d.getByRole("button", { name: "Use this device", exact: true }).click();
          await expect(d.getByRole("status").filter({ hasText: "This screen is ready." })).toBeVisible();
          const registeredResponse = await d.request.get(`${baseURL}/api/crossdeck?voyage=${voyage.id}`);
          expect(registeredResponse.ok()).toBe(true);
          const registered = (await registeredResponse.json()).surfaces as SurfaceDto[];
          const desktopSurface = registered.find((surface) => surface.thisSession && surface.voyageId === voyage.id)!;
          expect(desktopSurface, "Registration must resolve this authorized primary screen").toBeDefined();
          expect(desktopSurface.label, "Registration must preserve the device name entered by its owner").toBe(
            "Desktop",
          );
          await d.getByRole("button", { name: "Connect another device", exact: true }).click();
          await expect(d.getByRole("img", { name: "Scan with your phone to join this Chronicle" })).toBeVisible();
          await d.getByText("Use a code instead", { exact: true }).click();
          const code = (await d.locator("code").innerText()).replaceAll(" ", "");
          await p.goto(`${baseURL}/devices/pair#code=${code}`);
          await p.getByText("Name this device", { exact: true }).click();
          await p.getByLabel("Device name").fill("Phone");
          await p.getByRole("button", { name: "Join the Chronicle", exact: true }).click();
          await p.waitForURL(`**/devices/companion?voyage=${voyage.id}`);
          await expect(p.getByRole("region", { name: "Journal companion", exact: true })).toBeVisible();
          await expect(p.locator("[data-crossdeck-companion]")).toHaveAttribute("data-experience-voyage", voyage.id);
          await expect(p.locator("[data-crossdeck-companion]")).toHaveAttribute(
            "data-experience-version",
            voyage.versionId,
          );
          const phoneSurface = await db.crossdeckSurfaceSession.findFirstOrThrow({
            where: { accountSessionId: receiver.id },
          });
          expect(phoneSurface.label).toBe("Phone");
          await openClosureJournal(d, voyage.id, baseURL);
          await openClosureMap(d);
          const sending = d.getByRole("region", { name: "Send to your devices" });
          // Map drawer is a modal; close it before operating the persistent transfer toolbar.
          await d.getByRole("button", { name: "Close journal tool drawer", exact: true }).click();
          await sending.getByRole("button", { name: /^Send to / }).click();
          const sendOptions = sending.getByRole("dialog");
          const phoneDestination = sendOptions.getByRole("radio", { name: /^Phone / });
          await expect(phoneDestination).toHaveValue(phoneSurface.surfaceId);
          await phoneDestination.check();
          await sendOptions.getByText("More ways to open", { exact: true }).click();
          await sendOptions.getByLabel("Transfer mode").selectOption("MOVE_CUSTODY");
          const sendButton = sendOptions.getByRole("button", { name: "Send view", exact: true });
          await expect(sendButton).toBeEnabled();
          const visibleMeasurements: { direction: string; revision: number; requestedAt: number; visibleAt: number }[] =
            [];
          const sentResponse = d.waitForResponse(
            (response) => response.url().includes("/api/crossdeck/sync?") && response.request().method() === "POST",
          );
          await sendButton.focus();
          const requestedAt = Date.now();
          await sendButton.press("Enter");
          const sent = await sentResponse;
          const sentBody = await sent.json();
          expect(sent.status(), sentBody.error ?? "Send must produce a durable offer").toBe(200);
          const receiving = p.getByRole("region", { name: "Send to your devices" });
          await expect(receiving.getByRole("button", { name: /^Receive / })).toBeVisible();
          visibleMeasurements.push({
            direction: "desktop-to-phone",
            revision: sentBody.revision,
            requestedAt,
            visibleAt: Date.now(),
          });
          await receiving.getByRole("button", { name: /^Receive / }).click();
          const companionChart = p.locator(
            '[data-crossdeck-companion][data-companion-role="CHART"] [data-landfall-player-chart]:visible',
          );
          await expect(companionChart).toBeVisible();
          await expect(companionChart.locator('[aria-label="Virtual Landfall chart"]')).toBeVisible();
          await expect(companionChart.getByText(/^Current objective:/)).toBeVisible();
          await expect
            .poll(async () => {
              const row = await db.crossdeckDeck.findFirstOrThrow({
                where: { membership: { playthroughId: voyage.id } },
              });
              return JSON.parse(row.state).handoffs[0].state;
            })
            .toBe("ACKNOWLEDGED");
          const row = await db.crossdeckDeck.findFirstOrThrow({ where: { membership: { playthroughId: voyage.id } } });
          const deck = JSON.parse(row.state);
          expect(deck.handoffs[0].object.objectId).toBe(voyage.activeId);
          expect(deck.handoffs[0].context.worldspaceId).toBeDefined();
          expect(deck.handoffs[0].context.mapId).toBeDefined();
          expect(deck.objects[`MAP:${voyage.activeId}`].custody).toBe(phoneSurface.surfaceId);
          const sourceMapDrawer = d.getByRole("button", { name: "Close journal tool drawer", exact: true });
          if (await sourceMapDrawer.isVisible()) await sourceMapDrawer.click();
          if (scenarioId === "crossdeck.surface-handoff") {
            // Exercise the same canonical UI journey in the reverse direction.
            const receiverResponse = await p.request.get(`${baseURL}/api/crossdeck?voyage=${voyage.id}`);
            expect(receiverResponse.ok()).toBe(true);
            const receiverSurfaces = (await receiverResponse.json()).surfaces as SurfaceDto[];
            const destination = receiverSurfaces.find((surface) => surface.surfaceId === desktopSurface.surfaceId)!;
            expect(destination, "The reverse destination must be the same authorized primary screen").toBeDefined();
            expect(destination).toMatchObject({
              label: "Desktop",
              voyageId: voyage.id,
              thisSession: false,
              presence: "ACTIVE",
            });
            await receiving.getByRole("button", { name: /^Send to / }).click();
            const reverseOptions = receiving.getByRole("dialog");
            const desktopDestination = reverseOptions.getByRole("radio", {
              name: `${destination.label} ${roleNames[destination.role as keyof typeof roleNames]}`,
              exact: true,
            });
            await expect(desktopDestination).toHaveValue(desktopSurface.surfaceId);
            await desktopDestination.check();
            await reverseOptions.getByText("More ways to open", { exact: true }).click();
            await reverseOptions.getByLabel("Transfer mode").selectOption("MOVE_CUSTODY");
            const reverseResponse = p.waitForResponse(
              (response) => response.url().includes("/api/crossdeck/sync?") && response.request().method() === "POST",
            );
            const reverseRequestedAt = Date.now();
            await reverseOptions.getByRole("button", { name: "Send view", exact: true }).click();
            const reverse = await reverseResponse;
            const reverseBody = await reverse.json();
            expect(reverse.status(), reverseBody.error ?? "Reverse send must produce a durable offer").toBe(200);
            // Reconciliation is ten seconds; the functional assertion includes its request budget.
            // Actual hint-to-visible measurements remain separate and retain the elapsed time.
            await expect(sending.getByRole("button", { name: /^Receive / })).toBeVisible({ timeout: 15000 });
            visibleMeasurements.push({
              direction: "phone-to-desktop",
              revision: reverseBody.revision,
              requestedAt: reverseRequestedAt,
              visibleAt: Date.now(),
            });
            // A mirrored Chart may reopen its modal while the reverse offer arrives.
            // Return through the visible drawer control before using the transfer toolbar.
            const reverseSourceDrawer = d.getByRole("button", { name: "Close journal tool drawer", exact: true });
            if (await reverseSourceDrawer.isVisible()) await reverseSourceDrawer.click();
            await expect(d.locator(".journal-objects-drawer")).toBeHidden();
            await sending.getByRole("button", { name: /^Receive / }).click();
            await expect(d.locator(".journal-objects-drawer.open [data-landfall-player-chart]:visible")).toBeVisible();
            await expect
              .poll(async () => {
                const current = await db.crossdeckDeck.findUniqueOrThrow({ where: { id: row.id } });
                const state = JSON.parse(current.state);
                return {
                  custody: state.objects[`MAP:${voyage.activeId}`].custody,
                  acknowledged: state.handoffs.every((offer: { state: string }) => offer.state === "ACKNOWLEDGED"),
                };
              })
              .toEqual({ custody: desktopSurface.surfaceId, acknowledged: true });
            await d.getByRole("button", { name: "Close journal tool drawer", exact: true }).click();
          }
          if (scenarioId === "crossdeck.phone-disconnect") {
            await p.goto("about:blank");
            // Page-exit delivery is best effort. Require the server's canonical
            // stale presence projection, not an assumed final stored lifecycle.
            await expect
              .poll(
                async () => {
                  const response = await d.request.get(`${baseURL}/api/crossdeck?voyage=${voyage.id}`);
                  expect(response.ok()).toBe(true);
                  const data = await response.json();
                  return data.surfaces.find(
                    (surface: { surfaceId: string }) => surface.surfaceId === phoneSurface.surfaceId,
                  )?.presence;
                },
                { timeout: STALE_MS + 15000 },
              )
              .toBe("DISCONNECTED");
            const closeMap = d.getByRole("button", { name: "Close journal tool drawer", exact: true });
            if (await closeMap.isVisible()) await closeMap.click();
            const connectedOptions = sending.getByText("Connected view options", { exact: true });
            if (await connectedOptions.count()) await connectedOptions.click();
            await sending.getByRole("button", { name: /^Recover (view|.+) here$/ }).click();
            await expect(sending.getByText(/Controlled here/)).toBeVisible();
            await p.goto(`${baseURL}/devices/companion?voyage=${voyage.id}`);
            await expect(p.locator('[data-crossdeck-companion][data-companion-role="CHART"]')).toBeVisible();
            await expect(p.locator("[data-crossdeck-companion] [data-landfall-player-chart]:visible")).toBeVisible();
            const reconnected = await db.crossdeckDeck.findFirstOrThrow({ where: { id: row.id } });
            expect(JSON.parse(reconnected.state).objects[`MAP:${voyage.activeId}`].custody).not.toBe(
              phoneSurface.surfaceId,
            );
          }
          const audit = await new AxeBuilder({ page: d }).include('[aria-label="Send to your devices"]').analyze();
          expect(audit.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""))).toEqual([]);
          expect(await db.playerProfile.count()).toBe(before.players);
          expect(await db.playthroughMembership.count()).toBe(before.members);
          expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(before.events);
          expect((await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } })).currentSequence).toBe(
            before.sequence,
          );
          if (process.env.CROSSDECK_SERVER_METRICS_PATH) {
            let hints: { revision: number; at: number }[] = [];
            await expect
              .poll(
                async () => {
                  const metrics = JSON.parse(await readFile(process.env.CROSSDECK_SERVER_METRICS_PATH!, "utf8"));
                  hints = metrics.committedHints;
                  return visibleMeasurements.every((measurement) =>
                    hints.some(
                      (hint) =>
                        hint.revision === measurement.revision &&
                        hint.at >= measurement.requestedAt &&
                        hint.at <= measurement.visibleAt,
                    ),
                  );
                },
                { timeout: 3000 },
              )
              .toBe(true);
            await mkdir("artifacts/crossdeck/realtime-browser", { recursive: true });
            await writeFile(
              `artifacts/crossdeck/realtime-browser/${scenarioId}-visible.json`,
              JSON.stringify(
                {
                  source,
                  scope:
                    "real Crossdeck UI; post-transaction hint to Playwright-visible Receive prompt; not physical paint",
                  measurements: visibleMeasurements.map((measurement) => {
                    const hint = hints.find(
                      (hint) =>
                        hint.revision === measurement.revision &&
                        hint.at >= measurement.requestedAt &&
                        hint.at <= measurement.visibleAt,
                    )!;
                    return {
                      direction: measurement.direction,
                      revision: measurement.revision,
                      requestToVisibleMs: measurement.visibleAt - measurement.requestedAt,
                      afterCommitHintToVisibleMs: measurement.visibleAt - hint.at,
                    };
                  }),
                },
                null,
                2,
              ),
            );
          }
          const imagePath = testInfo.outputPath("crossdeck-continuity.png");
          await d.screenshot({ path: imagePath, fullPage: true });
          return {
            assertions: [
              { id: "crossdeck.phase2.continuity", state: "PASS" },
              { id: "keyboard-reduced-motion-privacy", state: "PASS" },
            ],
            unsupportedCapabilities: [],
            artifacts: [
              {
                path: imagePath,
                sha256: createHash("sha256")
                  .update(await readFile(imagePath))
                  .digest("hex"),
                kind: "SCREENSHOT",
              },
            ],
          };
        } catch (cause) {
          console.error("CROSSDECK_HANDOFF_REQUEST_DIAGNOSTICS", JSON.stringify(observedRequests));
          try {
            const receiverPage = phone?.pages().at(-1);
            console.error(
              "CROSSDECK_RECEIVER_CONTROLS",
              JSON.stringify({
                url: receiverPage?.url(),
                buttons: await receiverPage
                  ?.getByRole("region", { name: "Send to your devices" })
                  .getByRole("button")
                  .allTextContents(),
                status: await receiverPage?.getByRole("status").allTextContents(),
              }),
            );
          } catch {
            console.error("CROSSDECK_RECEIVER_CONTROLS_UNAVAILABLE");
          }
          executionError = cause;
          throw cause;
        }
      },
      async cleanup() {
        await desktop?.close();
        if (tier === "D1") await phone?.close();
        else {
          await phone?.clearCookies();
          for (const page of phone?.pages() ?? []) await page.close();
        }
        if (taleId) await db.chronicle.delete({ where: { id: taleId } });
        if (accountId) await db.userAccount.delete({ where: { id: accountId } });
        return {
          result: "PASS",
          ownedResources: ["owned-desktop", "owned-receiver", "synthetic-account-voyage"],
          remainingResources: [],
        };
      },
    }));
    const source = await deviceLabSourceIdentity(["tests/e2e/crossdeck-phase2.spec.ts"]);
    const receipt = await runDeviceLabScenario(packs, scenarioId, {
      source,
      baseSha: "7284b0dfaa31037d074d27df0f27b968f3977000",
      tier,
      profile: tier === "D1" ? "chromium-mobile" : "android-emulator",
      hostOs: process.platform,
      runtimeVersion: process.version,
      capabilitySnapshot: loadDeviceLabRegistry().scenarios.find((s) => s.scenarioId === scenarioId)!
        .requiredCapabilities,
    });
    await mkdir("artifacts/crossdeck-phase2", { recursive: true });
    await writeFile(`artifacts/crossdeck-phase2/${scenarioId}-${tier}.json`, JSON.stringify(receipt, null, 2));
    expect(
      receipt.passFailDisposition,
      executionError instanceof Error ? executionError.stack : JSON.stringify(receipt),
    ).toBe("PASS");
  });
