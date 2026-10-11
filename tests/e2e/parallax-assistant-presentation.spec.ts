import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { AI_CONTROL_ID } from "../../src/parallax/ai-ledger";
import { defaultAIGlobalPolicy } from "../../src/parallax/ai-policy";

test.use({ actionTimeout: 30000, video: "on" });
test.describe.configure({ mode: "serial", timeout: 300000 });
test.skip(process.env.PARALLAX_A1_SYNTHETIC_PROVIDER !== "1", "Run the guarded unpaid Parallax browser fixture.");
test.afterAll(() => db.$disconnect());
const artifactRoot = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;

async function capture(page: Page, name: string) {
  await mkdir(artifactRoot, { recursive: true });
  await page.screenshot({ path: `${artifactRoot}/${name}.png`, fullPage: true });
}

test("visible Assistant viewport, docking, authoring modes and reduced motion review", async ({
  page,
  context,
  baseURL,
}) => {
  ensureGenericSoundingLineIsolation();
  const account = await closureAccount("Synthetic Assistant presentation Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await authenticateClosure(context, account, baseURL!);
  await db.aIQuotaControl.upsert({
    where: { id: AI_CONTROL_ID },
    create: { id: AI_CONTROL_ID, policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
    update: { policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio/parallax");
  await expect(page.getByRole("heading", { name: "Desk Map", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /Ask Parallax/ }).click();
  const assistant = page.getByRole("complementary", { name: "Spatial Assistant", exact: true });
  await expect(assistant).toBeVisible();
  const observations: unknown[] = [];
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "laptop", width: 1280, height: 800 },
    { name: "phone", width: 390, height: 844 },
    { name: "landscape", width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    for (const mode of viewport.name === "desktop" ? ["GUIDED", "DETAILED", "ENGINEERING"] : ["GUIDED"]) {
      await page.getByLabel("Authoring mode").selectOption(mode);
      for (const docked of [false, true]) {
        const host = page.locator("#parallax-assistance");
        if ((await host.getAttribute("data-docked")) !== String(docked))
          await page
            .getByRole("button", { name: docked ? "Dock assistance" : "Float assistance", exact: true })
            .click();
        const name = `${viewport.name}-${mode.toLowerCase()}-${docked ? "docked" : "floating"}`;
        await capture(page, name);
        observations.push(
          await assistant.evaluate((element, name) => {
            const rect = element.getBoundingClientRect();
            const controls = Array.from(element.querySelectorAll("textarea,button")).filter(
              (item) => !item.closest("details:not([open])"),
            );
            const footer = element.querySelector("footer")!;
            return {
              name,
              panel: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
              scrollHeight: element.scrollHeight,
              clientHeight: element.clientHeight,
              footer: { y: footer.getBoundingClientRect().y, height: footer.getBoundingClientRect().height },
              clippedControls: controls
                .filter((item) => {
                  const control = item.getBoundingClientRect();
                  return (
                    item.closest("footer") &&
                    (control.bottom > rect.bottom + 1 || control.left < rect.left - 1 || control.right > rect.right + 1)
                  );
                })
                .map((item) => item.getAttribute("aria-label") ?? item.textContent?.trim()),
            };
          }, name),
        );
      }
    }
  }
  await writeFile(`${artifactRoot}/viewport-observations.json`, JSON.stringify(observations, null, 2) + "\n");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Float assistance", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: /Ask Parallax/ }).click();
  await expect(assistant).toHaveAttribute("data-motion", /reduced|off/);
  const reduced = await assistant.evaluate((element) => ({
    animation: getComputedStyle(element).animationName,
    transitions: Array.from(element.querySelectorAll("button")).map(
      (button) => getComputedStyle(button).transitionDuration,
    ),
  }));
  expect(reduced.animation).toBe("none");
  expect(reduced.transitions.every((duration) => duration === "0s")).toBe(true);
  await capture(page, "reduced-motion-welcome");
  const accessibility = await new AxeBuilder({ page }).include("#parallax-assistance").analyze();
  const serious = accessibility.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  await writeFile(
    `${artifactRoot}/presentation-review.json`,
    JSON.stringify(
      {
        schemaVersion: 1,
        candidate: process.env.PARALLAX_A1_SOURCE_SHA,
        observations,
        reduced,
        accessibility: accessibility.violations.map(({ id, impact, nodes }) => ({
          id,
          impact,
          targets: nodes.map(({ target }) => target),
        })),
      },
      null,
      2,
    ) + "\n",
  );
  expect(serious).toEqual([]);
});
