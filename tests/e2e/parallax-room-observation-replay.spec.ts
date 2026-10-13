// Opt-in retained observation audit. No inference or photo bytes are dispatched.
// Input files and owner-derived captures remain in ignored private artifacts.
import { test, expect } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { emptyStudioContent } from "../../src/parallax/studio-contracts";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { roomObservationResponseSchema } from "../../src/watchglass/room-observation";
import { reconstructRoomFromObservation } from "../../src/parallax/room-reconstruction";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
for (const [mode, count] of [
  ["single", 1],
  ["two", 2],
] as const) {
  test(`Retained ${mode} observation keeps table poses through mapping, rendering and reload without inference`, async ({
    page,
    context,
    baseURL,
  }) => {
    test.skip(!process.env.PARALLAX_ROOM_OBSERVATION_REPLAY_ROOT, "Explicit private retained-observation audit only");
    test.setTimeout(120000);
    ensureGenericSoundingLineIsolation();
    const observation = roomObservationResponseSchema.parse(
      JSON.parse(
        await readFile(
          `${process.env.PARALLAX_ROOM_OBSERVATION_REPLAY_ROOT}/owner-photo-gpt-6.1-sol-dispatch.jsonl.call-${count}.observation.json`,
          "utf8",
        ),
      ),
    );
    const result = reconstructRoomFromObservation({
      observation,
      roomId: `retained-${mode}`,
      sourceMediaIds: Array.from({ length: count }, (_, i) => `private-retained-photo-${i}`),
    });
    expect(result.status).toBe("PROPOSED");
    if (result.status !== "PROPOSED") throw new Error(result.message);
    const account = await closureAccount("Private retained room replay Creator");
    await activateWorkspaceCapability(account.id, "CREATOR");
    const draft = createSpatialDraft(`retained-room-${mode}`);
    draft.content.title = `Retained ${mode} room replay`;
    draft.content.studio = { ...(draft.content.studio ?? emptyStudioContent()), environment: result.room };
    for (const observed of observation.features.filter((feature) =>
      ["TABLE", "DESK"].includes(feature.classification),
    )) {
      const mapped = result.room.features.find((feature) => feature.name === observed.name)!;
      expect(mapped.yawDegrees).toBe(observed.yawDegrees);
      expect(mapped.dimensions).toEqual(observed.dimensions);
      expect(mapped.position).toEqual(observed.position);
    }
    await saveSpatialDraft(account.id, draft, 0);
    await authenticateClosure(context, account, baseURL!);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1600, height: 1100 });
    await page.goto("/studio/library");
    await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
    await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
    await page.getByRole("button", { name: new RegExp(`Retained ${mode} room replay.*My Library`) }).click();
    const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true });
    const host = canvas.locator('[data-renderer="READY"]');
    await expect(host.locator("canvas")).toBeVisible();
    await mkdir(root, { recursive: true });
    await expect
      .poll(async () => {
        const rendered = JSON.parse((await host.getAttribute("data-room-receipt")) ?? "[]") as { id: string }[];
        return result.room.features
          .filter((feature) => ["TABLE", "DESK"].includes(feature.classification))
          .every((feature) => rendered.some((entry) => entry.id === feature.id));
      })
      .toBe(true);
    const receipt = JSON.parse((await host.getAttribute("data-room-receipt"))!) as {
      id: string;
      min: number[];
      max: number[];
    }[];
    for (const feature of result.room.features.filter((f) => ["TABLE", "DESK"].includes(f.classification))) {
      const actual = receipt.find((entry) => entry.id === feature.id)!;
      expect(actual).toBeDefined();
      const angle = (feature.yawDegrees * Math.PI) / 180;
      expect(actual.max[0] - actual.min[0]).toBeCloseTo(
        Math.abs(Math.cos(angle)) * feature.dimensions[0] + Math.abs(Math.sin(angle)) * feature.dimensions[2],
        3,
      );
      expect(actual.max[2] - actual.min[2]).toBeCloseTo(
        Math.abs(Math.sin(angle)) * feature.dimensions[0] + Math.abs(Math.cos(angle)) * feature.dimensions[2],
        3,
      );
    }
    await writeFile(
      `${root}/private-room-replay-${mode}.json`,
      JSON.stringify(
        { replay: true, newInference: false, observationSource: "RETAINED_OWNER_AUTHORIZED_OUTPUT", result, receipt },
        null,
        2,
      ),
    );
    await canvas.getByRole("button", { name: "Reset view", exact: true }).click();
    await page.screenshot({ path: `${root}/private-room-replay-${mode}-perspective.png` });
    for (const view of ["plan", "front"] as const) {
      await canvas.getByRole("combobox", { name: "Camera perspective", exact: true }).selectOption(view);
      await page.screenshot({ path: `${root}/private-room-replay-${mode}-${view}.png` });
    }
    await page.reload();
    await expect(host.locator("canvas")).toBeVisible();
    expect((await listSpatialItems(account.id))[0].draft).toEqual(draft);
    expect(errors).toEqual([]);
  });
}
