// Opt-in owner-photo qualification; never runs paid calls in ordinary CI.
import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { AI_CONTROL_ID } from "../../src/parallax/ai-ledger";
import { defaultAIGlobalPolicy } from "../../src/parallax/ai-policy";
import type { AIModelId } from "../../src/parallax/ai-policy";
import { syntheticRoomGeometry, discoverRoomSurfaces } from "../../src/parallax/room-geometry";
import { verifyConstructedEnvironment } from "../../src/parallax/construction-verification";
import type { RoomEnvironment } from "../../src/parallax/environment-contracts";
test.use({ video: "on", actionTimeout: 30000 });
const model = process.env.PARALLAX_OWNER_PHOTO_MODEL ?? "gpt-6.1-sol";
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}/owner-photo-${model}`;
const results: Record<string, RoomEnvironment> = {};
test.beforeAll(async () => {
  if (
    process.env.PARALLAX_ROOM_PHOTO_RUNTIME !== "OWNER_AUTHORIZED_LIVE_DEVELOPMENT" ||
    process.env.NODE_ENV !== "development" ||
    !process.env.DATABASE_URL?.includes("/artifacts/sounding-line/generic-") ||
    !process.env.PARALLAX_OWNER_PHOTO_ONE ||
    !process.env.PARALLAX_OWNER_PHOTO_TWO
  )
    throw new Error("Explicit owner-authorized isolated live-photo runner required");
  await mkdir(root, { recursive: true });
  const policy = {
    ...defaultAIGlobalPolicy,
    enabled: true,
    standardModel: defaultAIGlobalPolicy.standardModel,
    roomModel: model,
    standardReasoning: process.env.PARALLAX_OWNER_PHOTO_REASONING ?? "low",
    advancedReasoning: process.env.PARALLAX_OWNER_PHOTO_REASONING ?? "low",
    allowedModels: [...new Set([...defaultAIGlobalPolicy.allowedModels, model as AIModelId])],
    maximumOutputTokens: 8000,
    timeoutMs: Number(process.env.PARALLAX_OWNER_PHOTO_TIMEOUT_MS ?? 60000),
    monthlyRequests: Number(process.env.PARALLAX_OWNER_PHOTO_MAX_CALLS),
    monthlySpendNano: Number(process.env.PARALLAX_OWNER_PHOTO_BUDGET_NANO),
    warningSpendNano: 0,
    maximumRequestSpendNano: Number(process.env.PARALLAX_OWNER_PHOTO_BUDGET_NANO),
    userRequestsPerMinute: 20,
  };
  await db.aIQuotaControl.upsert({
    where: { id: AI_CONTROL_ID },
    update: { policy: JSON.stringify(policy) },
    create: { id: AI_CONTROL_ID, policy: JSON.stringify(policy) },
  });
});
test.afterAll(async () => {
  const ledger = await db.aIUsageLedger.findMany({
    select: {
      requestId: true,
      operationCategory: true,
      model: true,
      status: true,
      settledCostNano: true,
      exposureNano: true,
      inputTokens: true,
      outputTokens: true,
    },
  });
  await writeFile(
    `${root}/safe-ledger.json`,
    JSON.stringify(ledger, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2),
  );
  if (results.single && results.two) {
    const summary = (room: RoomEnvironment) => ({
      dimensions: [room.width, room.height, room.depth],
      counts: Object.fromEntries(
        [...new Set(room.features.map((f) => f.classification))].map((c) => [
          c,
          room.features.filter((f) => f.classification === c).length,
        ]),
      ),
      features: room.features
        .filter((f) => !["WALL", "FLOOR", "CEILING"].includes(f.classification))
        .map((f) => ({
          name: f.name,
          classification: f.classification,
          normalizedPosition: [f.position.x / room.width, f.position.y / room.height, f.position.z / room.depth],
          normalizedDimensions: [
            f.dimensions[0] / room.width,
            f.dimensions[1] / room.height,
            f.dimensions[2] / room.depth,
          ],
          yawDegrees: f.yawDegrees,
          confidence: f.provenance.confidence,
        })),
    });
    await writeFile(
      `${root}/one-vs-two-layout-comparison.json`,
      JSON.stringify(
        {
          single: summary(results.single),
          two: summary(results.two),
          knownWidthMeters: 2.1336,
          measurementRequired: false,
          limits:
            "Estimated geometry from real owner-authorized images. Hidden dimensions, exact measurements, camera calibration and native tracking are unqualified.",
        },
        null,
        2,
      ),
    );
  }
  await db.$disconnect();
});
for (const mode of ["single", "two"] as const)
  test(`${mode === "single" ? "One" : "Two"} owner photograph walkthrough starts without dimensions and retains editable rendered layout`, async ({
    page,
    context,
    baseURL,
  }) => {
    test.setTimeout(300000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const account = await closureAccount(`Owner authorized ${mode} photo test Creator`);
    await activateWorkspaceCapability(account.id, "CREATOR");
    const draft = createSpatialDraft(`owner-${mode}-photo-room`);
    await saveSpatialDraft(account.id, draft, 0);
    await authenticateClosure(context, account, baseURL!);
    await page.setViewportSize({ width: 1600, height: 1100 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/studio/library");
    await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
    await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
    await page.getByRole("button", { name: /Desk Map.*My Library/ }).click();
    await page.getByText("Room photograph reconstruction", { exact: true }).click();
    const photo = page.getByRole("region", { name: "Room photograph reconstruction", exact: true });
    await expect(photo).toContainText("Local development photo import and room inference are ready.");
    const files =
      mode === "single"
        ? [process.env.PARALLAX_OWNER_PHOTO_ONE!]
        : [process.env.PARALLAX_OWNER_PHOTO_ONE!, process.env.PARALLAX_OWNER_PHOTO_TWO!];
    await photo.getByLabel("Room photograph", { exact: true }).setInputFiles(files);
    const reconstruct = photo.getByRole("button", { name: "Reconstruct room from photograph", exact: true });
    await expect(reconstruct).toBeDisabled();
    await photo.getByRole("checkbox").check();
    await page.screenshot({ path: `${root}/${mode}-consent-and-automatic-scale.png` });
    const response = page.waitForResponse(
      (r) =>
        r.url().includes("/api/studio/parallax/room-photo") &&
        r.request().method() === "POST" &&
        r.request().headers()["content-type"]?.includes("application/json"),
      { timeout: 190000 },
    );
    await reconstruct.click();
    const result = await (await response).json();
    await writeFile(`${root}/${mode}-inference-result.json`, JSON.stringify(result, null, 2));
    await page.screenshot({ path: `${root}/${mode}-inference-result.png` });
    expect(result.status, JSON.stringify(result)).toBe("PROPOSED");
    await expect(photo.getByRole("region", { name: "Proposed room", exact: true })).toBeVisible();
    expect((await listSpatialItems(account.id))[0].draft.content.studio!.environment).toBeUndefined();
    await photo.getByRole("button", { name: "Preview room proposal", exact: true }).click();
    const canvas = page.getByRole("region", { name: "Spatial canvas", exact: true }),
      host = canvas.locator('[data-renderer="READY"]');
    await expect(host.locator("canvas")).toBeVisible();
    await canvas.getByRole("button", { name: "Reset view", exact: true }).click();
    await page.screenshot({ path: `${root}/${mode}-proposal-room-perspective.png` });
    await photo.getByRole("button", { name: "Apply and save room", exact: true }).click();
    await expect(photo).toContainText("Room geometry saved.");
    const saved = (await listSpatialItems(account.id))[0].draft,
      room = saved.content.studio!.environment!;
    results[mode] = structuredClone(room);
    await writeFile(`${root}/${mode}-saved-estimated-room.json`, JSON.stringify(room, null, 2));
    expect(room.scaleReference).toBeUndefined();
    expect(room.width).toBeGreaterThan(1);
    expect(room.height).toBeGreaterThan(1);
    const geometry = syntheticRoomGeometry({ ...room, horizontal: true, vertical: true });
    const checks = verifyConstructedEnvironment(room, geometry);
    await writeFile(
      `${root}/${mode}-construction-and-surfaces.json`,
      JSON.stringify({ checks, surfaces: discoverRoomSurfaces(geometry, { tracking: true, clutter: 0 }) }, null, 2),
    );
    expect(checks.findings.filter((f) => f.severity === "ERROR")).toEqual([]);
    expect(room.features.filter((f) => f.classification === "WALL")).toHaveLength(4);
    expect(room.features.filter((f) => f.classification === "FLOOR")).toHaveLength(1);
    expect(room.features.filter((f) => ["TABLE", "DESK"].includes(f.classification)).length).toBeGreaterThanOrEqual(3);
    expect(room.features.some((f) => f.classification === "DOOR")).toBe(true);
    expect(room.features.some((f) => ["CABINET", "WARDROBE"].includes(f.classification))).toBe(true);
    expect(room.features.filter((f) => f.classification === "WINDOW")).toHaveLength(0);
    const rendererReceipt = JSON.parse((await host.getAttribute("data-room-receipt"))!) as {
      id: string;
      min: number[];
      max: number[];
    }[];
    await writeFile(`${root}/${mode}-renderer-room-receipt.json`, JSON.stringify(rendererReceipt, null, 2));
    for (const feature of room.features.filter((f) => ["TABLE", "DESK"].includes(f.classification))) {
      const actual = rendererReceipt.find((entry) => entry.id === feature.id)!;
      expect(actual).toBeDefined();
      const angle = (feature.yawDegrees * Math.PI) / 180;
      const width =
        Math.abs(Math.cos(angle)) * feature.dimensions[0] + Math.abs(Math.sin(angle)) * feature.dimensions[2];
      const depth =
        Math.abs(Math.sin(angle)) * feature.dimensions[0] + Math.abs(Math.cos(angle)) * feature.dimensions[2];
      expect(actual.max[0] - actual.min[0]).toBeCloseTo(width, 3);
      expect(actual.max[2] - actual.min[2]).toBeCloseTo(depth, 3);
    }
    await canvas.getByRole("combobox", { name: "Camera perspective", exact: true }).selectOption("plan");
    await page.screenshot({ path: `${root}/${mode}-saved-room-top.png` });
    await canvas.getByRole("combobox", { name: "Camera perspective", exact: true }).selectOption("front");
    await page.screenshot({ path: `${root}/${mode}-saved-room-front.png` });
    await canvas.getByRole("combobox", { name: "Camera perspective", exact: true }).selectOption("perspective");
    await page.reload();
    await expect(host.locator("canvas")).toBeVisible();
    expect((await listSpatialItems(account.id))[0].draft).toEqual(saved);
    await page.getByRole("button", { name: "Edit room features", exact: true }).click();
    const editor = page.getByRole("region", { name: "Room feature editor", exact: true });
    await expect(editor.getByLabel("Room feature", { exact: true })).toBeFocused();
    await page.screenshot({ path: `${root}/${mode}-saved-editable-room.png` });
    const table = room.features
      .filter((f) => ["TABLE", "DESK"].includes(f.classification))
      .sort((a, b) => Math.abs(a.position.x) - Math.abs(b.position.x))[0];
    await editor.getByLabel("Room feature", { exact: true }).selectOption(table.id);
    await editor.getByRole("button", { name: "Adjust estimated room scale (optional)", exact: true }).click();
    await editor.getByLabel("Relative room scale", { exact: true }).fill("1.1");
    await editor.getByRole("button", { name: "Apply relative scale", exact: true }).click();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Working draft saved");
    const relative = (await listSpatialItems(account.id))[0].draft.content.studio!.environment!;
    expect(relative.width).toBeCloseTo(room.width * 1.1);
    expect(relative.scaleReference).toBeUndefined();
    await page.getByRole("button", { name: "Undo", exact: true }).first().click();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Working draft saved");
    if (mode === "two" && process.env.PARALLAX_OWNER_PHOTO_COMPARISON_ONLY !== "1") {
      await editor.getByRole("button", { name: "Scale room from a known measurement", exact: true }).click();
      await editor.getByLabel("Known measurement (m)", { exact: true }).fill("2.1336");
      await editor.getByRole("button", { name: "Apply known measurement", exact: true }).click();
      await page.getByRole("button", { name: "Save draft", exact: true }).click();
      await expect(page.getByRole("status")).toHaveText("Working draft saved");
      const measured = (await listSpatialItems(account.id))[0].draft.content.studio!.environment!;
      expect(measured.scaleReference!.measuredMeters).toBe(2.1336);
      await page.getByText("Room photograph reconstruction", { exact: true }).click();
      const currentPhoto = page.getByRole("region", { name: "Room photograph reconstruction", exact: true });
      await currentPhoto
        .getByLabel("Room photograph", { exact: true })
        .setInputFiles(process.env.PARALLAX_OWNER_PHOTO_TWO!);
      await currentPhoto.getByLabel("Shared room feature", { exact: true }).selectOption(table.id);
      await currentPhoto.getByRole("checkbox").check();
      const refineResponse = page.waitForResponse(
        (r) =>
          r.url().includes("/room-photo") &&
          r.request().method() === "POST" &&
          r.request().headers()["content-type"]?.includes("application/json"),
        { timeout: 190000 },
      );
      await currentPhoto.getByRole("button", { name: "Refine room from photograph", exact: true }).click();
      const refined = await (await refineResponse).json();
      await writeFile(`${root}/two-refinement-result.json`, JSON.stringify(refined, null, 2));
      await page.screenshot({ path: `${root}/two-refinement-result.png` });
      expect(refined.status, JSON.stringify(refined)).toBe("PROPOSED");
      await currentPhoto.getByRole("button", { name: "Apply and save room", exact: true }).click();
      await expect(currentPhoto).toContainText("Room geometry saved.");
      const final = (await listSpatialItems(account.id))[0].draft.content.studio!.environment!;
      expect(final.scaleReference).toEqual(measured.scaleReference);
      expect(final.features.find((f) => f.id === table.id)!.dimensions[0]).toBeCloseTo(2.1336, 6);
      expect(new Set(final.features.map((f) => f.id)).size).toBe(final.features.length);
    }
    // Withdraw permission through the normal UI; saved geometry stays usable.
    const summary = page.getByText("Room photograph reconstruction", { exact: true });
    const panel = page.getByRole("region", { name: "Room photograph reconstruction", exact: true });
    if (!(await panel.isVisible())) await summary.click();
    await panel.getByText(/Manage photo permissions/).click();
    const withdraw = panel.getByRole("button", { name: /Withdraw photo .* processing permission/ });
    // Permission refresh replaces the whole list after each request. Do not click a stale row
    // while the asynchronous list refresh removes another already-withdrawn reference.
    while (await withdraw.count()) {
      const before = await withdraw.count();
      const withdrawn = page.waitForResponse(
        (response) =>
          response.url().includes("/room-photo") &&
          response.request().method() === "POST" &&
          response.request().postDataJSON()?.action === "WITHDRAW",
      );
      await withdraw.first().click();
      expect((await withdrawn).ok()).toBe(true);
      await expect(withdraw).toHaveCount(before - 1);
      await expect(panel).toContainText("permission withdrawn");
    }
    expect(errors).toEqual([]);
  });
