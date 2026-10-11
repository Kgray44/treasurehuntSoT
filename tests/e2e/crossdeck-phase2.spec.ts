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
          await d.goto(`${baseURL}/account/devices?voyage=${voyage.id}`);
          await d.getByLabel("Device name").fill("Desktop");
          await d.getByRole("button", { name: "Use this device", exact: true }).click();
          await expect(d.getByText("This device is connected as Main story.")).toBeVisible();
          await d.getByRole("button", { name: "Connect another device", exact: true }).click();
          const code = (await d.locator("code").innerText()).replaceAll(" ", "");
          await p.goto(`${baseURL}/devices/pair#code=${code}`);
          await p.getByLabel("Device name").fill("Phone");
          await p.getByRole("button", { name: "Join this Voyage", exact: true }).click();
          await expect(p.getByText("This device is connected as Chronicle Lens companion.")).toBeVisible();
          await openClosureJournal(d, voyage.id, baseURL);
          await openClosureJournal(p, voyage.id, baseURL);
          await openClosureMap(d);
          const sending = d.getByRole("region", { name: "Send to your devices" });
          // Map drawer is a modal; close it before operating the persistent transfer toolbar.
          await d.getByRole("button", { name: "Close journal tool drawer", exact: true }).click();
          await sending.locator("summary").click();
          const phoneSurface = await db.crossdeckSurfaceSession.findFirstOrThrow({
            where: { accountSessionId: receiver.id },
          });
          await sending.getByLabel("Send destination").selectOption(phoneSurface.surfaceId);
          await sending.getByLabel("Transfer mode").selectOption("MOVE_CUSTODY");
          const sendButton = sending.getByRole("button", { name: "Send view", exact: true });
          await expect(sendButton).toBeEnabled();
          const sentResponse = d.waitForResponse(
            (response) => response.url().includes("/api/crossdeck/sync?") && response.request().method() === "POST",
          );
          await sendButton.focus();
          await sendButton.press("Enter");
          const sent = await sentResponse;
          const sentBody = await sent.json();
          expect(sent.status(), sentBody.error ?? "Send must produce a durable offer").toBe(200);
          const receiving = p.getByRole("region", { name: "Send to your devices" });
          await expect(receiving.getByRole("button", { name: /^Receive / })).toBeVisible();
          await receiving.getByRole("button", { name: /^Receive / }).click();
          await expect(p.locator(".journal-objects-drawer.open [data-landfall-player-chart]:visible")).toBeVisible();
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
            await sending.getByRole("button", { name: "Recover view here" }).click();
            await expect(sending.getByText(/Controlled here/)).toBeVisible();
            await openClosureJournal(p, voyage.id, baseURL);
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
