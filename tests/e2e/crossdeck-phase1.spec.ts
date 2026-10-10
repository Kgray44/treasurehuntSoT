// @sounding-line-registration owner=project-crossdeck suite=browser.crossdeck contracts=crossdeck.phase1.participation
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { createAccountSession, revokeAccountSession } from "../../src/wayfarer/accounts";
import { closureAccount, closureVoyage, authenticateClosure, openClosureJournal } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { createCrossdeckPhase1Packs, crossdeckPhase1Scenarios } from "../../src/crossdeck/lab";
import { runDeviceLabScenario } from "../../src/device-lab/runner";
import { loadDeviceLabRegistry } from "../../src/device-lab/registry";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";
test.describe.configure({ mode: "serial", timeout: 240_000 });
test.use({ trace: "off", video: "off", screenshot: "off" });
test.afterAll(() => db.$disconnect());
for (const id of crossdeckPhase1Scenarios)
  test(id, async ({ browser, baseURL }, testInfo) => {
    ensureGenericSoundingLineIsolation();
    if (
      process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic" &&
      !(process.env.DATABASE_URL || "").includes("/artifacts/crossdeck/")
    )
      throw new Error("CROSSDECK_OWNED_BROWSER_DATABASE_REQUIRED");
    let desktop: BrowserContext | undefined, phone: BrowserContext | undefined;
    let accountId: string | undefined, taleId: string | undefined;
    let executionError: unknown;
    let debugDesktop: Page | undefined, debugPhone: Page | undefined;
    const packs = createCrossdeckPhase1Packs("D1", () => ({
      async execute({ signal }) {
        try {
          if (signal.aborted) throw new Error("ABORTED");
          const account = await closureAccount("Crossdeck browser navigator");
          accountId = account.id;
          const voyage = await closureVoyage(account, account);
          taleId = voyage.taleId;
          const receiver = await createAccountSession(account.id, "Synthetic Crossdeck phone");
          const before = {
            players: await db.playerProfile.count(),
            memberships: await db.playthroughMembership.count(),
            events: await db.taleSessionEvent.count({ where: { sessionId: voyage.id } }),
            sequence: (await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } })).currentSequence,
          };
          desktop = await browser.newContext({ reducedMotion: "reduce" });
          phone = await browser.newContext({
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
            reducedMotion: "reduce",
          });
          await authenticateClosure(desktop, account, baseURL!);
          const d = await desktop.newPage(),
            p = await phone.newPage();
          debugDesktop = d;
          debugPhone = p;
          d.setDefaultTimeout(30_000);
          p.setDefaultTimeout(30_000);
          await d.goto(`${baseURL}/account/sessions`);
          await expect(d.getByRole("button", { name: "Sign out all sessions", exact: true })).toBeVisible();
          await d.getByRole("link", { name: "Connect your Voyage devices" }).click();
          await d.waitForURL("**/account/devices", { timeout: 60_000 });
          await d.getByLabel("Voyage", { exact: true }).selectOption(voyage.id);
          await d.getByLabel("Device name").fill("Desktop");
          await d.getByRole("button", { name: "Use this device", exact: true }).click();
          await expect(d.getByText("This device is connected as Main story.")).toBeVisible();
          await d.getByRole("button", { name: "Connect another device", exact: true }).click();
          await expect(d.getByRole("img", { name: "Scan to connect another device" })).toBeVisible();
          const code = (await d.locator("code").innerText()).replaceAll(" ", "");
          expect(code).toMatch(/^[A-F0-9]{12}$/);
          expect(await d.getByRole("img", { name: "Scan to connect another device" }).getAttribute("src")).toMatch(
            /^data:image\/png;base64,/,
          );
          const unauthorized = await desktop.request.post(`${baseURL}/api/crossdeck`, {
            data: { action: "remove", surfaceId: "00000000-0000-4000-8000-000000000000" },
          });
          expect(unauthorized.status()).toBe(401);
          await p.goto(`${baseURL}/devices/pair#code=${code}`);
          await expect(p.getByRole("link", { name: "Sign in to connect", exact: true })).toBeVisible();
          const signIn = await p.getByRole("link", { name: "Sign in to connect", exact: true }).getAttribute("href");
          expect(signIn).not.toContain(code);
          await phone.addCookies([{ name: "wayfarer_account", value: receiver.token, url: baseURL!, sameSite: "Lax" }]);
          // The ordinary sign-in return loads the token-free path in this same tab.
          await p.goto(`${baseURL}/devices/pair`);
          await p.getByLabel("Device name").fill("Phone");
          await expect(p.getByLabel("One-time code")).toHaveValue(code);
          await expect(p.getByRole("button", { name: "Join this Voyage", exact: true })).toBeEnabled();
          // Keyboard-only confirmation uses the same protocol as scanning a QR.
          await p.getByLabel("One-time code").press("Enter");
          await expect(p.getByRole("status").filter({ hasText: "Joined this Voyage" })).toBeVisible();
          expect(new URL(p.url()).hash).toBe("");
          await expect(p.getByText("This device is connected as Chronicle Lens companion.")).toBeVisible();
          await expect(d.getByRole("status").filter({ hasText: "Phone connected" })).toBeVisible({ timeout: 25_000 });
          await expect(d.locator("code")).toHaveCount(0);
          expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
          const a11y = await new AxeBuilder({ page: p }).include('[aria-label="Voyage devices"]').analyze();
          expect(a11y.violations.filter((v) => ["critical", "serious"].includes(v.impact || ""))).toEqual([]);
          const paired = await db.crossdeckSurfaceSession.findMany({
            where: { accountSession: { accountId: account.id } },
          });
          expect(paired).toHaveLength(2);
          const phoneSurface = paired.find((s) => s.accountSessionId === receiver.id)!;
          expect(JSON.parse(phoneSurface.capabilities).reducedMotion).toBe(true);
          if (id === "crossdeck.phone-disconnect") {
            await p.goto("about:blank");
            await expect
              .poll(
                async () =>
                  (await db.crossdeckSurfaceSession.findUniqueOrThrow({ where: { id: phoneSurface.id } })).lifecycle,
              )
              .toBe("DISCONNECTED");
            await d.getByRole("button", { name: "Remove Phone", exact: true }).click();
            await expect(d.getByRole("button", { name: "Remove Phone", exact: true })).toHaveCount(0);
            await p.goto(`${baseURL}/account/devices?voyage=${voyage.id}`);
            await expect(p.getByText("This device is connected as Chronicle Lens companion.")).toHaveCount(0);
            await revokeAccountSession(account.id, receiver.id);
            const denied = await phone.request.get(`${baseURL}/api/crossdeck`);
            expect(denied.status()).toBe(401);
          } else {
            await openClosureJournal(p, voyage.id, baseURL);
            await expect(p.getByRole("link", { name: /Devices/ })).toBeVisible();
            await p.getByRole("link", { name: /Devices/ }).click();
            await expect(p.getByText("This device is connected as Chronicle Lens companion.")).toBeVisible();
          }
          expect(await db.playerProfile.count()).toBe(before.players);
          expect(await db.playthroughMembership.count()).toBe(before.memberships);
          expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(before.events);
          expect((await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } })).currentSequence).toBe(
            before.sequence,
          );
          const imagePath = testInfo.outputPath("connected-mobile.png");
          await p.screenshot({ path: imagePath, fullPage: true });
          const hash = createHash("sha256")
            .update(await readFile(imagePath))
            .digest("hex");
          return {
            assertions: [
              { id: "crossdeck.phase1.participation", state: "PASS" },
              { id: "one-player-one-voyage", state: "PASS" },
              { id: "keyboard-mobile-accessibility", state: "PASS" },
            ],
            unsupportedCapabilities: [],
            artifacts: [{ path: imagePath, sha256: hash, kind: "SCREENSHOT" }],
          };
        } catch (cause) {
          await debugDesktop?.screenshot({
            path: testInfo.outputPath("failure-desktop-redacted.png"),
            fullPage: true,
            mask: [debugDesktop.locator("code")],
          });
          executionError = new Error(
            `${cause instanceof Error ? cause.message : "Browser failure"}\nDesktop URL: ${debugDesktop?.url()}\nDesktop status: ${(await debugDesktop?.getByRole("status").allTextContents())?.join(" | ")}\nPhone status: ${(await debugPhone?.getByRole("status").allTextContents())?.join(" | ")}`,
          );
          throw cause;
        }
      },
      async cleanup() {
        await desktop?.close();
        await phone?.close();
        if (taleId) await db.chronicle.delete({ where: { id: taleId } });
        if (accountId) await db.userAccount.delete({ where: { id: accountId } });
        return {
          result: "PASS",
          ownedResources: ["desktop-context", "phone-context", "synthetic-account", "synthetic-voyage"],
          remainingResources: [],
        };
      },
    }));
    const source = await deviceLabSourceIdentity(["tests/e2e/crossdeck-phase1.spec.ts"]);
    const receipt = await runDeviceLabScenario(packs, id, {
      source,
      baseSha: source.sourceSha,
      tier: "D1",
      profile: "chromium-mobile",
      hostOs: process.platform,
      runtimeVersion: process.version,
      capabilitySnapshot: loadDeviceLabRegistry().scenarios.find((s) => s.scenarioId === id)!.requiredCapabilities,
    });
    await mkdir("artifacts/crossdeck-device-lab", { recursive: true });
    await writeFile(`artifacts/crossdeck-device-lab/${id}-D1.json`, JSON.stringify(receipt, null, 2));
    expect(
      receipt.passFailDisposition,
      executionError instanceof Error ? executionError.stack : JSON.stringify(receipt),
    ).toBe("PASS");
    expect(receipt.evidenceClass).toBe("BROWSER_EMULATION_PROVEN");
    expect(receipt.cleanupReceipt.result).toBe("PASS");
  });
