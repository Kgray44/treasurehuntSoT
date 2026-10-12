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
    create: {
      id: AI_CONTROL_ID,
      policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true, defaultUserRequests: 5 }),
    },
    update: { policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true, defaultUserRequests: 5 }) },
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio/parallax");
  await expect(page.getByRole("heading", { name: "Desk Map", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /Ask Parallax/ }).click();
  const assistant = page.getByRole("region", { name: "Spatial Assistant", exact: true });
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
        const composer = assistant.getByLabel("Describe your spatial idea");
        await composer.scrollIntoViewIfNeeded();
        await composer.click();
        await expect(composer).toBeFocused();
        const reachable = await composer.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
        });
        expect(reachable, `${name} composer is reachable through the panel scroll`).toBe(true);
        await capture(page, `${name}-composer`);
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
  await writeFile(`${artifactRoot}/reduced-motion.json`, JSON.stringify(reduced, null, 2) + "\n");
  expect(reduced.animation).toBe("none");
  expect(
    // The product-wide reduced-motion rule retains an effectively immediate
    // 0.01ms transition for lifecycle events; no visible travel is permitted.
    reduced.transitions.every((duration) => duration.split(",").every((part) => Number.parseFloat(part) <= 0.00001)),
  ).toBe(true);
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
  const loaded = await (await context.request.get("/api/studio/parallax")).json();
  const preferences = await (await context.request.get("/api/passport/preferences")).json();
  const theme = await context.request.put("/api/passport/preferences", {
    headers: { "x-csrf-token": loaded.csrfToken },
    data: {
      preferences: {
        ...preferences.preferences,
        experience: { ...preferences.preferences.experience, theme: "LIGHT", motion: "REDUCED" },
      },
    },
  });
  expect(theme.ok(), await theme.text()).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: /Ask Parallax/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-voyage-theme", "light");
  await capture(page, "light-theme-welcome");
  async function submit(request: string) {
    await assistant.getByLabel("Describe your spatial idea").fill(request);
    const response = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/studio/parallax") && response.request().postDataJSON()?.kind === "ASSISTANT",
    );
    await assistant.getByRole("button", { name: "Send idea", exact: true }).click();
    const returned = await response;
    await expect(assistant.getByRole("button", { name: "Send idea", exact: true })).toBeVisible();
    return returned;
  }
  await submit("Synthetic provider failure for recovery review.");
  await expect(assistant).toContainText(/unchanged|could not|unavailable/i);
  await expect(assistant.getByRole("heading", { name: /What would you like/ })).toBeHidden();
  const failureNotice = assistant
    .getByRole("status")
    .filter({ hasText: /unchanged/ })
    .first();
  await expect(failureNotice).toBeInViewport();
  expect(
    await failureNotice.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
    }),
  ).toBe(true);
  await capture(page, "provider-failure-light");
  await submit("Explain an unsupported glowing particle effect.");
  await expect(assistant.getByRole("heading", { name: "A supported alternative to particles" })).toBeVisible();
  await capture(page, "unsupported-capability-light");
  await submit("Create a pirate map on a desk with a readable clue and a guided alternative.");
  await expect(assistant.getByRole("region", { name: "Review spatial proposal" })).toBeFocused();
  const proposalAccessibility = await new AxeBuilder({ page }).include("#parallax-assistance").analyze();
  await writeFile(
    `${artifactRoot}/proposal-accessibility.json`,
    JSON.stringify(proposalAccessibility.violations, null, 2) + "\n",
  );
  expect(
    proposalAccessibility.violations.filter(({ impact }) => ["serious", "critical"].includes(impact ?? "")),
  ).toEqual([]);
  await capture(page, "light-theme-proposal");
  await page.setViewportSize({ width: 390, height: 844 });
  await assistant.getByRole("button", { name: "Proposed scene", exact: true }).click();
  await assistant.getByRole("button", { name: "View canvas", exact: true }).click();
  await expect(assistant).toBeHidden();
  const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
  await expect(canvas.getByRole("button", { name: /^Pirate map\./ })).toBeVisible();
  await expect(canvas.locator('[data-renderer="READY"]')).toBeVisible();
  await capture(page, "phone-proposed-canvas-light");
  await page.getByRole("button", { name: /Ask Parallax/ }).click();
  const apply = assistant.getByRole("button", { name: "Apply all changes", exact: true });
  await apply.scrollIntoViewIfNeeded();
  expect(
    await apply.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }),
  ).toBe(true);
  await capture(page, "phone-proposal-apply-light");
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Known upstream rejection releases its reservation. Consume the allowance
  // with settled responses, rather than treating an unbilled failure as usage.
  await submit("Explain an unsupported glowing particle effect.");
  await submit("Explain an unsupported glowing particle effect.");
  await expect(assistant).toContainText("1 of 5 requests remaining");
  await expect(assistant).toContainText("You’re nearing this month’s allowance.");
  await capture(page, "creator-quota-warning-light");
  await submit("Explain an unsupported glowing particle effect.");
  await expect(assistant).toContainText("0 of 5 requests remaining");
  await capture(page, "creator-quota-exhausted-light");
  await page.getByRole("button", { name: "Close assistance", exact: true }).click();
  await page.getByRole("button", { name: /Ask Parallax/ }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Ask Parallax/ })).toBeFocused();
});
