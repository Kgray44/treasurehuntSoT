import { test, expect, type Page, type Request } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { db } from "../../src/lib/db";
import { listSpatialItems, type SpatialLibraryRecord } from "../../src/parallax/library-service";
import { draftSchema } from "../../src/parallax/authoring";

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
  test(`Reusable asset ${profile.device}/${profile.motionMode} saves a separate definition and places its released Scene copy`, async ({
    page,
  }, info) => {
    expect(process.env.SOUNDING_LINE_SUITE_PROFILE).toBe("generic");
    ensureGenericSoundingLineIsolation();
    test.setTimeout(180000);
    const { EXPERIENCE_VIEWPORTS, runExperienceJourney } = await import(
      "../../scripts/sounding-line/experience-browser.mjs"
    );
    await page.setViewportSize(EXPERIENCE_VIEWPORTS[profile.device]);
    await page.emulateMedia({ reducedMotion: profile.motionMode === "REDUCED" ? "reduce" : "no-preference" });
    const registry = JSON.parse(await readFile("testing/contracts.json", "utf8"));
    const contract = registry.contracts.find(
      (entry: { id: string }) => entry.id === "parallax.authored-library-and-simulation.experience",
    );
    const journey = contract.experience.journeys.find(
      (entry: { id: string }) => entry.id === "creator-reusable-definition-and-scene-copy",
    );
    expect(journey).toBeDefined();
    const setup = contract.experience.roleSetup.CREATOR;
    await page.goto(setup.entryPoint);
    for (const step of setup.steps) {
      const target = page.getByRole(step.role as Parameters<Page["getByRole"]>[0], { name: step.name, exact: true });
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
    const artifactRoot = info.outputPath("registered-reusable-asset-experience");
    await mkdir(artifactRoot, { recursive: true });
    const assetSaveDrafts: unknown[] = [];
    const assetSaveCaptureErrors: string[] = [];
    const sourceWitness: { before?: SpatialLibraryRecord } = {};
    const captureAssetSaveSource = (request: Request) => {
      const url = new URL(request.url());
      if (
        request.method() !== "POST" ||
        url.pathname !== "/api/studio/parallax" ||
        url.origin !== new URL(page.url()).origin
      )
        return;
      try {
        const body = request.postDataJSON() as { action?: unknown; draft?: unknown } | null;
        if (body?.action === "ASSET_SAVE") assetSaveDrafts.push(body.draft);
      } catch {
        assetSaveCaptureErrors.push("The Scene request body was not readable JSON");
      }
    };
    page.on("request", captureAssetSaveSource);
    const observed = await runExperienceJourney({
      page,
      contract,
      journey,
      device: profile.device,
      artifactRoot,
      root: process.cwd(),
      role: "CREATOR",
      motionMode: profile.motionMode,
      accessibilityCheck: async () => {
        // The first registered boundary is ASSET_SAVED, before any placement.
        if (!sourceWitness.before) {
          expect(assetSaveCaptureErrors).toEqual([]);
          expect(assetSaveDrafts).toHaveLength(1);
          const submitted = draftSchema.parse(assetSaveDrafts[0]);
          const persisted = (await listSpatialItems(accountId)).find(
            (item) => item.id === submitted.content.definitionId,
          );
          if (!persisted) throw new Error("The source Scene was not persisted before reusable asset export");
          expect(persisted.draft).toEqual(submitted);
          expect(new URL(page.url()).searchParams.get("definition")).toBe(persisted.id);
          sourceWitness.before = structuredClone(persisted);
        }
        const a11y = await new AxeBuilder({ page }).analyze();
        return {
          axeSerious: a11y.violations
            .filter((violation) => ["critical", "serious"].includes(violation.impact!))
            .map((violation) => violation.id),
          overflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
        };
      },
    }).finally(() => {
      page.off("request", captureAssetSaveSource);
    });
    expect(assetSaveCaptureErrors).toEqual([]);
    expect(assetSaveDrafts).toHaveLength(1);
    expect(observed.result.returnPathVerified).toBe(true);
    expect(observed.result.accessibility.motionPreferenceVerified).toBe(true);
    const after = await listSpatialItems(accountId);
    const definitions = after.filter(
      (item) => !previousDefinitions.has(item.id) && item.draft.library?.type === "ASSET",
    );
    expect(definitions).toHaveLength(1);
    const definition = definitions.at(0);
    if (!definition) throw new Error("The separately saved reusable definition is missing");
    expect(definition.draft.content.title).toBe(`Reusable review clue ${profile.device} ${profile.motionMode}`);
    expect(definition.releases).toHaveLength(1);
    const released = definition.releases.at(0);
    if (!released) throw new Error("The immutable reusable asset version is missing");
    expect(released.definitionId).toBe(definition.id);
    const copies = after.flatMap((item) =>
      (item.draft.content.studio?.assetInstances ?? [])
        .filter((instance) => instance.definitionId === definition.id)
        .map((instance) => ({ item, instance })),
    );
    expect(copies).toHaveLength(1);
    const copy = copies.at(0);
    if (!copy) throw new Error("The persisted Scene copy is missing");
    expect(copy.item.id).not.toBe(definition.id);
    expect(copy.instance.versionId).toBe(released.id);
    expect(copy.instance.checksum).toBe(released.checksum);
    expect(copy.instance.entityIds).toHaveLength(definition.draft.content.entities.length);
    const definitionEntities = new Set(definition.draft.content.entities.map((entity) => entity.id));
    for (const entityId of copy.instance.entityIds) {
      expect(definitionEntities.has(entityId)).toBe(false);
      expect(copy.item.draft.content.entities.some((entity) => entity.id === entityId)).toBe(true);
    }
    const sourceBefore = sourceWitness.before;
    if (!sourceBefore) throw new Error("Reuse replaced the existing Scene instead of extending it");
    expect(copy.item.id).toBe(sourceBefore.id);
    for (const original of sourceBefore.draft.content.entities)
      expect(copy.item.draft.content.entities.find((entity) => entity.id === original.id)).toEqual(original);
    expect(copy.item.draft.content.entities.length).toBe(
      sourceBefore.draft.content.entities.length + copy.instance.entityIds.length,
    );
  });
}
