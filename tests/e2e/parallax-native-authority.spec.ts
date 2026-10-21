import { test, expect, type BrowserContext } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { syntheticSpatialMoment } from "../../src/parallax/fixtures";
import { materializeSpatialVersion } from "../../src/parallax/publication";
import { closureAccount, closureVoyage, authenticateClosure, openClosureJournal } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

// D1 only: the real Player/runtime/HTTP authority/database are exercised, but
// this transport fixture neither renders a mesh nor supplies physical tracking.
// Separate native input/raster receipts are required; this is not D4 acceptance.
async function emulateNativeTransport(context: BrowserContext, platform: "IOS" | "ANDROID") {
  await context.addInitScript((platform) => {
    const audit = {
      start: null as null | { sessionId: string; epoch: number },
      stopped: 0,
      scene: null as null | { identity: { versionChecksum: string }; entities: { id: string }[] },
      chunks: [] as string[],
    };
    Object.defineProperty(window, "__ncl01D1", { value: audit });
    Object.defineProperty(window, "LandfallNative", {
      value: {
        version: 1,
        platform,
        request: async (message: string) => {
          const { operation, payload } = JSON.parse(message);
          if (operation === "SPATIAL_STATE" || operation === "SPATIAL_PERMISSION")
            return {
              supported: true,
              permission: "GRANTED",
              sceneTransferVersion: 1,
              sceneDeliveryVersions: [1, 2],
              capabilities: ["WORLD_TRACKING", "PLANE_PLACEMENT", "MODEL_GLB"],
            };
          if (operation === "SPATIAL_START") {
            // A tracking event carries only its session/epoch identity. Do not
            // spread START-only checksum/transfer fields into the strict wire event.
            audit.start = { sessionId: payload.sessionId, epoch: payload.epoch };
            return { accepted: true, sceneTransferVersion: 2, sessionId: payload.sessionId, epoch: payload.epoch };
          }
          if (operation === "SPATIAL_SCENE_BEGIN") audit.chunks = [];
          if (operation === "SPATIAL_SCENE_CHUNK") audit.chunks[payload.index] = payload.data;
          if (operation === "SPATIAL_SCENE_COMMIT") {
            audit.scene = JSON.parse(
              new TextDecoder().decode(
                Uint8Array.from(audit.chunks.flatMap((chunk) => [...atob(chunk)].map((c) => c.charCodeAt(0)))),
              ),
            );
          }
          if (operation === "SPATIAL_STOP") audit.stopped++;
          if (operation === "POWER_STATE")
            return { state: "READY", lowPower: false, thermalPressure: false, critical: false, observedAt: Date.now() };
          return { accepted: true };
        },
      },
    });
  }, platform);
}

test.describe.configure({ mode: "serial", timeout: 120_000 });
test.afterAll(() => db.$disconnect());
for (const platform of ["IOS", "ANDROID"] as const) {
  test(`D1 ${platform} native intent reaches authorized visible Inspect and real SQLite without progression`, async ({
    browser,
    baseURL,
  }) => {
    ensureGenericSoundingLineIsolation();
    const account = await closureAccount(`Synthetic NCL01 ${platform}`);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      reducedMotion: "reduce",
    });
    let taleId: string | undefined;
    try {
      await emulateNativeTransport(context, platform);
      const voyage = await closureVoyage(account, account, "narrative");
      taleId = voyage.taleId;
      const version = await db.publishedTaleVersion.findUniqueOrThrow({ where: { id: voyage.versionId } });
      const snapshot = JSON.parse(version.contentSnapshot);
      const block = snapshot.chapters[0].blocks[0];
      const moment = syntheticSpatialMoment(voyage.activeId);
      const { checksum: _checksum, ...content } = moment.version;
      void _checksum;
      const baseline = content.entities[0];
      content.entities = [
        { id: "middle-chest", name: "Middle-table chest", modelId: "treasure-chest", x: 0, z: 0, width: 0.4 },
        { id: "left-compass", name: "Left-table compass", modelId: "brass-compass", x: -0.7, z: 0.2, width: 0.16 },
        { id: "right-compass", name: "Right-table compass", modelId: "brass-compass", x: 0.8, z: -0.2, width: 0.16 },
      ].map((item) => ({
        ...structuredClone(baseline),
        id: item.id,
        name: item.name,
        content: `Synthetic clue belonging only to ${item.name}.`,
        alternativeText: `Inspect the ${item.name.toLowerCase()}.`,
        widthMeters: item.width,
        transform: { ...structuredClone(baseline.transform), position: { x: item.x, y: 0, z: item.z } },
        element: {
          enabled: true,
          kind: "PHYSICAL_ASSET" as const,
          modelId: item.modelId as "treasure-chest" | "brass-compass",
          packageVersion: "1.0.0",
          articulation: 0,
        },
      }));
      moment.version = materializeSpatialVersion(content);
      moment.attachment.versionChecksum = moment.version.checksum;
      block.configuration = {
        heading: "The synthetic classroom trail",
        body: "Open the Lens and inspect an authored object.",
      };
      block.presentation = { spatialMoment: moment };
      block.completion = { mode: "playerConfirmation" };
      const contentSnapshot = JSON.stringify(snapshot);
      await db.publishedTaleVersion.update({
        where: { id: voyage.versionId },
        data: { contentSnapshot, checksum: createHash("sha256").update(contentSnapshot).digest("hex") },
      });
      const before = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
      const beforeEvents = await db.taleSessionEvent.count({ where: { sessionId: voyage.id } });
      await authenticateClosure(context, account, baseURL!);
      const page = await context.newPage();
      await openClosureJournal(page, voyage.id, baseURL);
      const entry = page.getByRole("button", { name: "Open Chronicle Lens", exact: true });
      await entry.click();
      const lens = page.getByRole("dialog", { name: moment.version.title, exact: true });
      await lens.getByRole("button", { name: "Use camera for local placement" }).click();
      await expect
        .poll(() =>
          page.evaluate(() => Boolean((window as unknown as { __ncl01D1: { scene: unknown } }).__ncl01D1.scene)),
        )
        .toBe(true);
      await page.evaluate(() => {
        const { start } = (window as unknown as { __ncl01D1: { start: { sessionId: string; epoch: number } } })
          .__ncl01D1;
        for (let i = 0; i < 3; i++)
          window.dispatchEvent(
            new CustomEvent("landfall-native-event", {
              detail: { ...start, type: "parallax-tracking", state: "NORMAL" },
            }),
          );
      });
      const scene = await page.evaluate(
        () =>
          (
            window as unknown as {
              __ncl01D1: { scene: { identity: { versionChecksum: string }; entities: { id: string }[] } };
            }
          ).__ncl01D1.scene,
      );
      expect(scene.identity.versionChecksum).toBe(moment.version.checksum);
      expect(scene.entities.map((entity) => entity.id)).toEqual(["middle-chest", "left-compass", "right-compass"]);

      const endpoint = `/api/player/playthroughs/${voyage.id}/parallax`;
      let releasePost!: () => void;
      const postGate = new Promise<void>((resolve) => {
        releasePost = resolve;
      });
      await page.route(`**${endpoint}`, async (route) => {
        if (route.request().method() === "POST") await postGate;
        await route.continue();
      });
      const requestPromise = page.waitForRequest(
        (request) => request.url().endsWith(endpoint) && request.method() === "POST",
      );
      const responsePromise = page.waitForResponse(
        (response) => response.url().endsWith(endpoint) && response.request().method() === "POST",
      );
      await page.evaluate(() => {
        const { start } = (window as unknown as { __ncl01D1: { start: { sessionId: string; epoch: number } } })
          .__ncl01D1;
        window.dispatchEvent(
          new CustomEvent("landfall-native-event", {
            detail: { ...start, type: "parallax-interaction", entityId: "left-compass", interactionType: "INSPECT" },
          }),
        );
      });
      const request = await requestPromise;
      const receipt = request.postDataJSON();
      await expect(lens.getByText(/You are inspecting Left-table compass/)).toHaveCount(0);
      await expect(
        lens.getByText("Interaction recorded. Continue through the passage when you are ready."),
      ).toHaveCount(0);
      releasePost();
      expect((await responsePromise).status()).toBe(200);
      await expect(lens.getByText(/You are inspecting Left-table compass/)).toBeVisible();
      await expect(lens.getByText("Guided View", { exact: true })).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => (window as unknown as { __ncl01D1: { stopped: number } }).__ncl01D1.stopped))
        .toBeGreaterThan(0);
      expect(receipt).toMatchObject({
        sessionId: voyage.id,
        actorId: account.profileId,
        chronicleVersionId: voyage.versionId,
        versionChecksum: moment.version.checksum,
        entityId: "left-compass",
        mode: "NATIVE",
        synthetic: false,
        authority: "NONAUTHORITATIVE",
      });
      const csrf = request.headers()["x-csrf-token"];
      const send = (body: unknown, csrfToken = csrf) =>
        context.request.post(endpoint, { data: body, headers: { "x-csrf-token": csrfToken } });
      expect((await send(receipt)).status()).toBe(200);
      for (const change of [
        { versionChecksum: "0".repeat(64) },
        { actorId: "foreign-player" },
        { sessionId: "foreign-voyage" },
        { chronicleVersionId: "foreign-edition" },
        { instanceId: "instance:foreign:run" },
        { entityId: "removed-entity" },
        { interactionType: "DISALLOWED" },
        { observedAt: "2000-01-01T00:00:00.000Z" },
        { mode: "SIMULATED", synthetic: true },
      ])
        expect((await send({ ...receipt, ...change, idempotencyKey: randomUUID() })).status()).toBe(409);
      expect((await send({ ...receipt, entityId: "right-compass" })).status()).toBe(409);
      expect((await send(receipt, "invalid-csrf")).status()).toBe(403);
      expect(await db.parallaxObservation.count({ where: { sessionId: voyage.id } })).toBe(1);
      const row = await db.parallaxObservation.findFirstOrThrow({ where: { sessionId: voyage.id } });
      expect(JSON.parse(row.evidence).entityId).toBe("left-compass");
      expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(beforeEvents);
      const after = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
      expect([after.currentBlockId, after.currentSequence]).toEqual([before.currentBlockId, before.currentSequence]);
      const a11y = await new AxeBuilder({ page }).include("dialog[open]").analyze();
      expect(a11y.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
      await lens.getByRole("button", { name: "Close Chronicle Lens", exact: true }).click();
      await expect(entry).toBeFocused();
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent("landfall-native-event", {
            detail: {
              type: "parallax-interaction",
              entityId: "right-compass",
              interactionType: "INSPECT",
              sessionId: "obsolete",
              epoch: 1,
            },
          }),
        ),
      );
      expect(await db.parallaxObservation.count({ where: { sessionId: voyage.id } })).toBe(1);
      await db.playthroughMembership.updateMany({ where: { playthroughId: voyage.id }, data: { status: "REMOVED" } });
      expect((await send({ ...receipt, idempotencyKey: randomUUID() })).status()).toBe(404);
    } finally {
      await context.close();
      if (taleId) await db.chronicle.delete({ where: { id: taleId } });
      await db.userAccount.delete({ where: { id: account.id } });
    }
  });
}
