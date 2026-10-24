import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { db } from "../../src/lib/db";

test.use({ actionTimeout: 30000, video: "on", storageState: { cookies: [], origins: [] } });
test.afterAll(() => db.$disconnect());

const authenticatedStates = new Map<string, Awaited<ReturnType<BrowserContext["storageState"]>>>();

const contractIds = [
  "homeport.community.quarantine",
  "admiralty.phase2.read-projection-redaction",
  "admiralty.phase2.account-dossier-support",
  "admiralty.phase2.community-operations-providers",
  "admiralty.phase2.registry-activation",
] as const;
const devices = ["DESKTOP", "MOBILE"] as const;
const accountId = "00000000-0000-4000-8000-00000000a102";

async function expectIdentity(page: Page, name: string) {
  const identity = page.getByRole("group", { name, exact: true });
  await expect(identity).toHaveCount(1);
  await expect(identity).toBeVisible();
  if (new URL(page.url()).pathname.startsWith("/admin")) {
    await expect(identity.getByText(name, { exact: true })).toBeVisible();
  } else {
    await expect(identity.getByRole("button", { name, exact: true })).toBeVisible();
  }
}

async function expectCanonicalAccount(page: Page, name: string) {
  const response = await page.request.get("/api/auth/context");
  expect(response.ok()).toBe(true);
  const context = await response.json();
  expect(context.authenticated).toBe(true);
  expect(context.user.accountId).toBe(accountId);
  expect(context.user.displayName).toBe(name);
}

// These registered contracts have no motion obligation, so the existing capture
// policy selects REDUCED only: five contracts on two devices, exactly ten cases.
for (const contractId of contractIds) {
  for (const device of devices) {
    test(`${contractId} ${device}/ADMINISTRATOR/REDUCED preserves canonical identity and real return`, async ({
      page,
      baseURL,
    }, info) => {
      expect(process.env.SOUNDING_LINE_SUITE_PROFILE).toBe("generic");
      ensureGenericSoundingLineIsolation();
      const { EXPERIENCE_VIEWPORTS, roleSetupAuthenticationResume, runExperienceJourney } = await import(
        "../../scripts/sounding-line/experience-browser.mjs"
      );
      await page.setViewportSize(EXPERIENCE_VIEWPORTS[device]);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const registryBytes = await readFile("testing/contracts.json");
      const registry = JSON.parse(registryBytes.toString("utf8"));
      const contracts = registry.contracts.filter((entry: { id: string }) => entry.id === contractId);
      expect(contracts).toHaveLength(1);
      const contract = contracts[0];
      expect(contract.experience.devices).toEqual(devices);
      expect(contract.experience.roles).toEqual(["ADMINISTRATOR"]);
      expect(contract.experience.motion).toBeUndefined();
      expect(contract.experience.journeys).toHaveLength(1);
      const journey = contract.experience.journeys[0];
      expect(journey.roles).toEqual(["ADMINISTRATOR"]);
      expect(contract.experience.continuity.checks).toHaveLength(1);
      const continuity = contract.experience.continuity.checks[0];
      expect(continuity).toEqual({
        id: "visible-account-identity",
        role: "group",
        name: "Synthetic Parallax Operator",
        attribute: "aria-label",
      });
      const account = await db.userAccount.findUniqueOrThrow({
        where: { id: accountId },
        select: { id: true, profile: { select: { displayName: true } } },
      });
      expect(account.profile?.displayName).toBe(continuity.name);
      const setup = contract.experience.roleSetup.ADMINISTRATOR;
      const authenticationResume = roleSetupAuthenticationResume(setup);
      if (!authenticationResume || !baseURL) throw new Error("Registered canonical authentication setup is required");
      const authenticationKey = createHash("sha256")
        .update(JSON.stringify({ role: "ADMINISTRATOR", entryPoint: setup.entryPoint, steps: setup.steps }))
        .digest("hex");
      const authenticatedState = authenticatedStates.get(authenticationKey);
      const expectedOrigin = new URL(baseURL).origin;
      const expectAuthenticatedDestination = () => {
        const destination = new URL(page.url());
        expect(destination.origin).toBe(expectedOrigin);
        expect(`${destination.pathname}${destination.search}${destination.hash}`).toBe(authenticationResume.entryPoint);
      };
      if (authenticatedState) {
        expect(authenticatedState.origins).toEqual([]);
        await page.context().addCookies(authenticatedState.cookies);
        await page.goto(authenticationResume.entryPoint);
        expectAuthenticatedDestination();
      } else {
        await page.goto(setup.entryPoint);
      }
      for (let index = authenticatedState ? authenticationResume.stepCount : 0; index < setup.steps.length; index++) {
        const step = setup.steps[index];
        const target = page.getByRole(step.role as Parameters<Page["getByRole"]>[0], {
          name: step.name,
          exact: true,
        });
        await target.waitFor({ state: "visible" });
        if (step.action === "fill") await target.fill(step.value);
        else if (step.action === "click") await target.click();
        else throw new Error("Unsupported registered role setup action");
        if (!authenticatedState && index === authenticationResume.stepCount - 1) {
          await page.waitForURL(
            (destination) =>
              destination.origin === expectedOrigin && !["/sign-in", "/player/sign-in"].includes(destination.pathname),
            { waitUntil: "domcontentloaded", timeout: 30000 },
          );
          expectAuthenticatedDestination();
        }
      }
      const witness = page.getByRole(setup.witness.role, { name: setup.witness.name, exact: true });
      await (setup.witness.text ? witness.filter({ hasText: setup.witness.text }) : witness).waitFor({
        state: "visible",
      });
      if (!authenticatedState) {
        const state = await page.context().storageState();
        // Match governed replay: reuse only authenticated cookies, never UI layout state.
        authenticatedStates.set(authenticationKey, { cookies: state.cookies, origins: [] });
      }
      await page.goto(contract.experience.entryPoint);
      await expectCanonicalAccount(page, continuity.name);
      await expectIdentity(page, continuity.name);
      const artifactRoot = info.outputPath("registered-experience");
      await mkdir(artifactRoot, { recursive: true });
      const observed = await runExperienceJourney({
        page,
        contract,
        journey,
        device,
        artifactRoot,
        root: process.cwd(),
        role: "ADMINISTRATOR",
        motionMode: "REDUCED",
        accessibilityCheck: async () => {
          await expectIdentity(page, continuity.name);
          const moderation = page.locator('section[aria-labelledby="moderation-action-title"]');
          if (await moderation.count()) {
            await expect(moderation).toHaveCount(1);
            await expect(moderation).toBeVisible();
            const bounds = await moderation.evaluate((section) => {
              const visible = (element: Element) => {
                const box = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility === "visible";
              };
              const targets = new Set([
                ...Array.from(section.children),
                ...Array.from(section.querySelectorAll("input, select, textarea, button")),
              ]);
              const boxes = [...targets].filter(visible).map((element, index) => {
                const box = element.getBoundingClientRect();
                return { index, tag: element.tagName, left: box.left, right: box.right, width: box.width };
              });
              const previews = Array.from(section.querySelectorAll<HTMLElement>(":scope > .chartroom-projection"));
              return {
                checked: boxes.length,
                clipped: boxes.filter((box) => box.left < -1 || box.right > window.innerWidth + 1),
                overflowingPreviews: previews
                  .filter(visible)
                  .flatMap((preview) =>
                    preview.scrollWidth > preview.clientWidth + 1
                      ? [{ clientWidth: preview.clientWidth, scrollWidth: preview.scrollWidth }]
                      : [],
                  ),
              };
            });
            expect(bounds.checked).toBeGreaterThan(0);
            expect(bounds.clipped).toEqual([]);
            expect(bounds.overflowingPreviews).toEqual([]);
          }
          const a11y = await new AxeBuilder({ page }).analyze();
          return {
            axeSerious: a11y.violations
              .filter((violation) => ["critical", "serious"].includes(violation.impact!))
              .map((violation) => violation.id),
            overflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
          };
        },
      });
      const identityDigest = createHash("sha256").update(continuity.name).digest("hex");
      const outcomeCount = journey.steps.filter(
        (step: { action: string; kind?: string }) => step.action === "assert" && step.kind === "outcome",
      ).length;
      expect(observed.result.observations).toHaveLength(outcomeCount);
      expect(observed.result.continuity).toEqual([
        {
          id: continuity.id,
          before: identityDigest,
          atOutcomes: Array(outcomeCount).fill(identityDigest),
          after: identityDigest,
        },
      ]);
      expect(observed.result.returnPathVerified).toBe(true);
      expect(observed.result.accessibility.motionPreferenceVerified).toBe(true);
      expect(observed.result.accessibility.overflow).toBe(false);
      for (const state of observed.result.accessibility.states) {
        expect(state.axeSerious).toEqual([]);
        expect(state.overflow).toBe(false);
      }
      await expectCanonicalAccount(page, continuity.name);
      await expectIdentity(page, continuity.name);
      const accountButton = page.getByRole("button", { name: continuity.name, exact: true });
      await accountButton.click();
      await expect(page.getByRole("dialog", { name: "Account navigation", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Account navigation", exact: true })).not.toBeVisible();
      await expect(accountButton).toBeFocused();
      await writeFile(
        info.outputPath("registered-experience.json"),
        JSON.stringify(
          {
            classification: "DEVELOPMENT_ONLY_REGISTERED_JOURNEY_NOT_ACCEPTANCE",
            qualification: false,
            registrySha256: createHash("sha256").update(registryBytes).digest("hex"),
            result: observed.result,
          },
          null,
          2,
        ) + "\n",
        { flag: "wx" },
      );
    });
  }
}
