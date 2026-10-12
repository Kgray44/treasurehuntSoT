import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { db } from "../../src/lib/db";
import { closureAccount, authenticateClosure } from "./fixtures/landfall-closure";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { saveSpatialDraft, listSpatialItems } from "../../src/parallax/library-service";
import { createSpatialDraft } from "../../src/parallax/authoring";
import { AI_CONTROL_ID } from "../../src/parallax/ai-ledger";
import { defaultAIGlobalPolicy } from "../../src/parallax/ai-policy";

test.use({ video: "on", actionTimeout: 30000 });
test.afterAll(() => db.$disconnect());
const root = `artifacts/parallax-a1/browser/${process.env.PARALLAX_A1_SOURCE_SHA?.slice(0, 12) ?? "unbound"}`;
test("Creator privately imports a synthetic room photo, reviews and applies geometry, refines the same desk, withdraws permission and reloads", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(240000);
  if (
    process.env.PARALLAX_ROOM_PHOTO_RUNTIME !== "SYNTHETIC_DEVELOPMENT" ||
    process.env.NODE_ENV !== "development" ||
    !process.env.DATABASE_URL?.includes("/artifacts/sounding-line/generic-") ||
    process.env.OPENAI_API_KEY !== "parallax-a1-synthetic-provider-only"
  )
    throw new Error("Task-owned unpaid development photo runtime required");
  const account = await closureAccount("Synthetic room photograph Creator");
  await activateWorkspaceCapability(account.id, "CREATOR");
  await db.aIQuotaControl.upsert({
    where: { id: AI_CONTROL_ID },
    update: { policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
    create: { id: AI_CONTROL_ID, policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }) },
  });
  const draft = createSpatialDraft("synthetic-room-photograph");
  await saveSpatialDraft(account.id, draft, 0);
  await authenticateClosure(context, account, baseURL!);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio/library");
  await page.getByRole("link", { name: "Spatial Studio", exact: true }).click();
  await page.getByRole("button", { name: "Open Saved Spatial Items", exact: true }).click();
  await page.getByRole("button", { name: /Desk Map.*My Library/ }).click();
  await page.getByRole("button", { name: "Collapse left dock", exact: true }).click();
  await page.getByText("Room photograph reconstruction", { exact: true }).click();
  const photo = page.getByRole("region", { name: "Room photograph reconstruction", exact: true });
  await expect(photo).toContainText("Protected photo import and room inference are ready.");
  const image = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#96aab0" } })
    .png()
    .toBuffer();
  await photo
    .getByLabel("Room photograph", { exact: true })
    .setInputFiles({ name: "synthetic-room-fixture.png", mimeType: "image/png", buffer: image });
  const consent = photo.getByRole("checkbox");
  const reconstruct = photo.getByRole("button", { name: "Reconstruct room from photograph", exact: true });
  await expect(reconstruct).toBeDisabled();
  await consent.check();
  await reconstruct.click();
  await expect(photo.getByRole("region", { name: "Proposed room", exact: true })).toBeVisible();
  expect((await listSpatialItems(account.id))[0].draft.content.studio!.environment).toBeUndefined();
  await mkdir(root, { recursive: true });
  const host = page.getByRole("region", { name: "Spatial canvas", exact: true }).locator('[data-renderer="READY"]');
  const receipt = async () =>
    JSON.parse((await host.getAttribute("data-room-receipt")) ?? "[]") as {
      id: string;
      min: number[];
      max: number[];
    }[];
  await expect(host).toHaveAttribute("data-rendered", "true");
  const originalReceipt = await receipt();
  await photo.getByRole("button", { name: "Preview room proposal", exact: true }).click();
  await expect.poll(async () => (await receipt()).some((row) => row.id.endsWith(":back-wall"))).toBe(true);
  expect((await listSpatialItems(account.id))[0].draft.content.studio!.environment).toBeUndefined();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.screenshot({ path: `${root}/photo-room-geometry-preview.png` });
  await photo.getByRole("button", { name: "Return to saved scene", exact: true }).click();
  await expect.poll(receipt).toEqual(originalReceipt);
  await photo.getByRole("button", { name: "Preview room proposal", exact: true }).click();
  await photo.getByRole("button", { name: "Apply and save room", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/photo-room-proposal.png` });
  await photo.getByRole("button", { name: "Apply and save room", exact: true }).click();
  await expect(photo).toContainText("Room geometry saved.");
  const saved = (await listSpatialItems(account.id))[0].draft;
  const room = saved.content.studio!.environment!;
  expect(room.features.filter((f) => f.classification === "WALL")).toHaveLength(4);
  const desk = room.features.find((f) => f.classification === "DESK")!;
  const deskX = async () => {
    const row = (await receipt()).find((r) => r.id === desk.id);
    return row ? (row.min[0] + row.max[0]) / 2 : Number.NaN;
  };
  await expect.poll(deskX).toBeCloseTo(1);
  await expect.poll(async () => JSON.parse((await host.getAttribute("data-cutaway-parts"))!).length).toBe(3);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.getByText("Room photograph reconstruction", { exact: true }).click();
  await host.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${root}/photo-room-applied-cutaway.png` });
  await page.getByText("Room photograph reconstruction", { exact: true }).click();
  await photo.getByLabel("Shared room feature", { exact: true }).selectOption(desk.id);
  const secondImage = await sharp({ create: { width: 620, height: 400, channels: 3, background: "#97aab0" } })
    .png()
    .toBuffer();
  await photo
    .getByLabel("Room photograph", { exact: true })
    .setInputFiles({ name: "synthetic-room-second-view.png", mimeType: "image/png", buffer: secondImage });
  await consent.check();
  await photo.getByRole("button", { name: "Refine room from photograph", exact: true }).click();
  await expect(photo.getByRole("region", { name: "Proposed room", exact: true })).toBeVisible();
  await photo.getByRole("button", { name: "Apply and save room", exact: true }).click();
  await expect(photo).toContainText("Room geometry saved.");
  await expect.poll(deskX).toBeCloseTo(0.5);
  const refined = (await listSpatialItems(account.id))[0].draft;
  expect(refined.content.studio!.environment!.id).toBe(room.id);
  expect(refined.content.studio!.environment!.features.filter((f) => f.classification === "DESK")).toHaveLength(1);
  await photo.getByRole("button", { name: "Withdraw photo 2 processing permission", exact: true }).click();
  await expect(photo).toContainText("Future photo processing permission withdrawn.");
  await page.screenshot({ path: `${root}/photo-room-permission-withdrawn.png` });
  await page.reload();
  await expect(host.locator("canvas")).toBeVisible();
  await expect.poll(deskX).toBeCloseTo(0.5);
  expect((await listSpatialItems(account.id))[0].draft).toEqual(refined);
  await page.getByText("Room photograph reconstruction", { exact: true }).click();
  await expect(
    photo.getByRole("button", { name: "Withdraw photo 1 processing permission", exact: true }),
  ).toBeVisible();
  await photo.getByRole("button", { name: "Withdraw photo 1 processing permission", exact: true }).click();
  await expect(photo).toContainText("Future photo processing permission withdrawn.");
  await expect(photo.getByRole("button", { name: /Withdraw photo .* processing permission/ })).toHaveCount(0);
  await page.screenshot({ path: `${root}/photo-room-restored.png` });
  await page.reload();
  await expect.poll(deskX).toBeCloseTo(0.5);
  await page.getByText("Room photograph reconstruction", { exact: true }).click();
  await expect(photo).toContainText("Protected photo import and room inference are ready.");
  await expect(photo.getByRole("button", { name: /Withdraw photo .* processing permission/ })).toHaveCount(0);
  expect((await listSpatialItems(account.id))[0].draft).toEqual(refined);
});
