import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { db } from "../../src/lib/db";
import { listSpatialItems } from "../../src/parallax/library-service";

test.use({
  actionTimeout: 30000,
  video: "on",
});

test.afterAll(() => db.$disconnect());

const profiles = [
  { device: "DESKTOP", motionMode: "NORMAL" },
  { device: "DESKTOP", motionMode: "REDUCED" },
  { device: "MOBILE", motionMode: "NORMAL" },
  { device: "MOBILE", motionMode: "REDUCED" },
] as const;

for (const profile of profiles) {
  test(`SC02 ${profile.device}/${profile.motionMode} saves and independently edits a reused composition`, async ({
    page,
    baseURL,
  }, info) => {
    expect(process.env.SOUNDING_LINE_SUITE_PROFILE).toBe("generic");
    ensureGenericSoundingLineIsolation();
    test.setTimeout(180000);
    const { EXPERIENCE_VIEWPORTS, runExperienceJourney } = await import(
      "../../scripts/sounding-line/experience-browser.mjs"
    );
    await page.setViewportSize(EXPERIENCE_VIEWPORTS[profile.device]);
    await page.emulateMedia({ reducedMotion: profile.motionMode === "REDUCED" ? "reduce" : "no-preference" });
    const registryBytes = await readFile("testing/contracts.json");
    const registry = JSON.parse(registryBytes.toString("utf8"));
    const contract = registry.contracts.find((entry: { id: string }) => entry.id === "spatial-pilot.experience");
    const journey = contract.experience.journeys.find(
      (entry: { id: string }) => entry.id === "sc02-assets-and-reusable-composition",
    );
    expect(journey).toBeDefined();
    const setup = contract.experience.roleSetup.CREATOR;
    await page.goto(setup.entryPoint);
    for (const step of setup.steps) {
      const target = page.getByRole(step.role as Parameters<Page["getByRole"]>[0], {
        name: step.name,
        exact: true,
      });
      await target.waitFor({ state: "visible" });
      if (step.action === "fill") await target.fill(step.value);
      else if (step.action === "click") await target.click();
      else throw new Error("Unsupported registered role setup action");
    }
    await page
      .getByRole(setup.witness.role, { name: setup.witness.name, exact: true })
      .filter({ hasText: setup.witness.text })
      .waitFor({ state: "visible" });
    await page.goto(contract.experience.entryPoint);
    const accountId = "00000000-0000-4000-8000-00000000a101";
    const before = await listSpatialItems(accountId);
    const previousDefinitions = new Set(before.map((item) => item.id));
    const previousEntities = new Set(before.flatMap((item) => item.draft.content.entities.map((entity) => entity.id)));
    const artifactRoot = info.outputPath("registered-experience");
    await mkdir(artifactRoot, { recursive: true });
    try {
      const observed = await runExperienceJourney({
        page,
        baseURL,
        contract,
        journey,
        device: profile.device,
        artifactRoot,
        root: process.cwd(),
        role: "CREATOR",
        motionMode: profile.motionMode,
        accessibilityCheck: async () => {
          const a11y = await new AxeBuilder({ page }).analyze();
          return {
            axeSerious: a11y.violations
              .filter((violation) => ["critical", "serious"].includes(violation.impact!))
              .map((violation) => violation.id),
            overflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
          };
        },
      });
      expect(observed.result.returnPathVerified).toBe(true);
      expect(observed.result.accessibility.motionPreferenceVerified).toBe(true);
      const records = await listSpatialItems(accountId);
      const definitions = records.filter(
        (item) =>
          !previousDefinitions.has(item.id) && item.saveState === "SAVED" && item.draft.tags.includes("composition"),
      );
      expect(definitions).toHaveLength(1);
      const saved = definitions.at(0);
      if (!saved) throw new Error("The newly saved composition definition is missing");
      expect(saved.draft.content.title).toContain("SC02 synthetic composition");
      expect(saved.draft.content.title).toContain(profile.device);
      expect(saved.draft.content.title).toContain(profile.motionMode);
      const editedInstances = records.flatMap((item) =>
        item.draft.content.entities
          .filter(
            (entity) => entity.name === "Independently edited Ghostly Presence" && !previousEntities.has(entity.id),
          )
          .map((entity) => ({ item, entity })),
      );
      expect(editedInstances).toHaveLength(1);
      const edited = editedInstances.at(0);
      if (!edited) throw new Error("The independently edited Scene instance is missing");
      expect(edited.item.id).not.toBe(saved.id);
      expect(edited.item.draft.tags).not.toContain("composition");
      const originalRoot = edited.item.draft.content.entities.find(
        (entity) => entity.name === saved.draft.content.title,
      );
      if (!originalRoot) throw new Error("Reusing the saved definition replaced the original Scene composition");
      const savedRoot = saved.draft.content.entities.find((entity) => !entity.parentEntityId);
      if (!savedRoot) throw new Error("The saved composition root is missing");
      expect(savedRoot.name).toBe(saved.draft.content.title);
      const children = (entities: typeof saved.draft.content.entities, rootId: string) =>
        entities.filter((entity) => entity.parentEntityId === rootId);
      const savedChildren = children(saved.draft.content.entities, savedRoot.id);
      const originalChildren = children(edited.item.draft.content.entities, originalRoot.id);
      const reusedChildren = children(edited.item.draft.content.entities, edited.entity.id);
      expect(savedChildren).toHaveLength(4);
      expect(savedChildren.every((entity) => Boolean(entity.element))).toBe(true);
      expect(originalChildren).toHaveLength(4);
      expect(reusedChildren).toHaveLength(4);
      const kinds = (items: typeof savedChildren) => items.map((entity) => entity.element?.kind).sort();
      expect(new Set(kinds(savedChildren)).size).toBe(4);
      expect(kinds(originalChildren)).toEqual(kinds(savedChildren));
      expect(kinds(reusedChildren)).toEqual(kinds(savedChildren));
      const sourceIds = new Set(saved.draft.content.entities.map((entity) => entity.id));
      for (const entity of [edited.entity, ...reusedChildren]) expect(sourceIds.has(entity.id)).toBe(false);
    } catch (error) {
      try {
        const properties = page.getByRole("button", { name: "Open object properties", exact: true });
        const details = page.getByRole("region", { name: "Spatial element properties", exact: true });
        await writeFile(
          info.outputPath("sc02-failure-observation.json"),
          JSON.stringify(
            {
              classification: "DEVELOPMENT_ONLY_FAILURE_OBSERVATION_NOT_ACCEPTANCE",
              registrySha256: createHash("sha256").update(registryBytes).digest("hex"),
              profile,
              pathname: new URL(page.url()).pathname,
              legacyOpenerCount: await page
                .getByRole("button", { name: "Open contextual Inspector", exact: true })
                .count(),
              propertiesOpenerVisible: await properties.isVisible(),
              propertiesOpenerEnabled: (await properties.count()) === 1 && (await properties.isEnabled()),
              elementPropertiesVisible: await details.isVisible(),
              elementPropertiesText: (await details.isVisible()) ? await details.innerText() : null,
              qualification: false,
            },
            null,
            2,
          ) + "\n",
          { flag: "wx" },
        );
      } catch (observationError) {
        info.annotations.push({
          type: "diagnostic-collection-failure",
          description: createHash("sha256").update(String(observationError)).digest("hex"),
        });
      }
      throw error;
    }
  });
}
