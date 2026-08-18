import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { db } from "../../src/lib/db";
import { parsePrivateContentConfiguration } from "../../src/private-content/config";
import { createProtectedMediaOperationExecutors } from "../../src/private-content/media-worker-composition";
import { submitProtectedMediaConsentAssertion } from "../../src/private-content/media/service";
import { createPrivateProviderRuntime } from "../../src/private-content/providers";
import { claimPrivateJobs } from "../../src/private-content/operations";
import { createLocalPrivateOperationExecutors } from "../../src/private-content/worker-composition";
import { createPrivateOperationalHandlerRegistry } from "../../src/private-content/worker-handlers";
import { dispatchPrivateJobBatch } from "../../src/private-content/worker";

function consent(input: {
  id: string;
  mediaId: string;
  checksum: string;
  derivativeId?: string;
  derivativeChecksum?: string;
}) {
  return {
    id: input.id,
    authority: "WAYFARER" as const,
    authorityRecordOpaqueId: "case-synthetic",
    authorityRevision: "revision-1",
    subjectOpaqueId: "case-synthetic",
    consumingAggregateKind: "WAYFARER_DISPLAY_CASE" as const,
    consumingAggregateOpaqueId: "case-synthetic",
    purpose: "DISPLAY_CASE_PUBLIC" as const,
    scopes: ["PHOTO" as const],
    state: "GRANTED" as const,
    sourceProtectedMediaId: input.mediaId,
    sourceChecksum: input.checksum,
    requestedTransformationPolicy: "sealed-hold-public-image-v1",
    derivativeId: input.derivativeId,
    derivativeChecksum: input.derivativeChecksum,
    validFrom: new Date(),
    sourceWatermark: "synthetic-watermark",
  };
}

test("Phase 4 authenticated protected-media workflow is private, accessible, revocable, and restart-safe", async ({
  browser,
}) => {
  const id = randomUUID();
  const username = `sealed-hold-${id.slice(0, 10)}`;
  const password = `SealedHold-${id}-safe`;
  const syntheticImage = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#5588aa" } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { ImageDescription: `synthetic-${id}` } } })
    .toBuffer();
  const runtime = createPrivateProviderRuntime(parsePrivateContentConfiguration());
  const gm = await db.gameMasterUser.create({
    data: { username, passwordHash: await bcrypt.hash(password, 10), role: "CAPTAIN_CREATOR" },
  });
  const activatedAt = new Date();
  const account = await db.userAccount.create({
    data: {
      status: "ACTIVE",
      legacyGameMasterId: gm.id,
      claimedAt: activatedAt,
      ordinaryWorkspaceEntryAt: activatedAt,
      emails: {
        create: {
          normalizedEmail: `${username}@example.test`,
          displayEmail: `${username}@example.test`,
          verificationState: "VERIFIED",
          verifiedAt: activatedAt,
          isPrimary: true,
        },
      },
    },
  });
  await db.playerProfile.create({
    data: { accountId: account.id, displayName: "Synthetic Phase 4 Creator", status: "ACTIVE", claimedAt: new Date() },
  });
  await db.accountRoleAssignment.create({ data: { accountId: account.id, role: "CREATOR", scopeType: "GLOBAL" } });

  const anonymous = await browser.newContext();
  expect((await anonymous.request.get("/api/studio/private-content/media", { maxRetries: 2 })).status()).toBe(403);
  expect(
    (
      await anonymous.request.get("/api/private-content/media/public/not-a-real-opaque-id?revision=revision-1")
    ).status(),
  ).toBe(404);
  await anonymous.close();

  const creator = await browser.newContext();
  const login = await creator.request.post("/api/gm/login", { data: { username, password } });
  expect(login.ok(), await login.text()).toBeTruthy();
  const { csrfToken } = (await login.json()) as { csrfToken: string };
  const source = await runtime.storage.put("objects", `synthetic/${id}.jpg`, Readable.from(syntheticImage), {
    contentLength: syntheticImage.byteLength,
  });
  const object = await db.privateAssetObject.create({
    data: {
      sha256: source.sha256,
      byteLength: source.byteLength,
      mediaType: "image/jpeg",
      representation: "image",
      storageKey: source.key,
      scanStatus: "CLEAN",
      finalizedAt: new Date(),
    },
  });
  const register = await creator.request.post("/api/studio/private-content/media", {
    headers: { "x-csrf-token": csrfToken },
    data: {
      sourcePrivateAssetObjectId: object.id,
      mediaKind: "IMAGE",
      declaredMediaType: "image/jpeg",
      accessibilityDescription: "A synthetic public display-case image.",
    },
  });
  expect(register.status(), await register.text()).toBe(201);
  const media = (await register.json()) as { id: string; sha256: string };
  const association = await db.protectedMediaAssociation.create({
    data: {
      protectedMediaId: media.id,
      authority: "WAYFARER",
      subjectKind: "DISPLAY_CASE",
      subjectOpaqueId: "case-synthetic",
      purpose: "DISPLAY_CASE_PUBLIC",
      role: "PRIMARY",
      ownerAccountId: account.id,
      sourceRevision: "revision-1",
    },
  });
  const initialConsent = await submitProtectedMediaConsentAssertion({
    assertion: consent({ id: `initial-${id}`, mediaId: media.id, checksum: media.sha256 }),
  });
  const request = await creator.request.post("/api/studio/private-content/media", {
    headers: { "x-csrf-token": csrfToken },
    data: {
      action: "request-derivative",
      mediaId: media.id,
      associationId: association.id,
      purpose: "DISPLAY_CASE_PUBLIC",
      audience: "PUBLIC",
      idempotencyKey: `browser-request-${id}`,
      consentAssertionId: initialConsent.id,
    },
  });
  expect(request.status(), await request.text()).toBe(202);
  const requestBody = (await request.json()) as { operationId: string; state: string };
  expect(requestBody.state).toBe("QUEUED");

  const staleLease = await claimPrivateJobs(`phase4-worker-terminated-${id}`, 1, 1);
  expect(staleLease).toHaveLength(1);
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Worker one processes the durable build. Worker two is a fresh composition,
  // proving durable completion rather than in-memory derivative/grant state.
  const handlers = () =>
    createPrivateOperationalHandlerRegistry({
      runtime,
      execute: {
        ...createLocalPrivateOperationExecutors({ runtime }),
        ...createProtectedMediaOperationExecutors(runtime),
      },
    });
  expect(
    await dispatchPrivateJobBatch(`phase4-worker-a-${id}`, handlers(), { limit: 10, leaseMs: 1_000 }),
  ).toMatchObject({
    processed: 1,
  });
  const blocked = await db.protectedMediaDerivative.findFirstOrThrow({
    where: { operationId: requestBody.operationId, purpose: "DISPLAY_CASE_PUBLIC" },
  });
  expect(blocked.state).toBe("BLOCKED_CONSENT");
  const finalConsent = await submitProtectedMediaConsentAssertion({
    assertion: consent({
      id: `final-${id}`,
      mediaId: media.id,
      checksum: media.sha256,
      derivativeId: blocked.id,
      derivativeChecksum: blocked.outputChecksum,
    }),
  });
  expect(finalConsent.state).toBe("GRANTED");
  expect(
    await dispatchPrivateJobBatch(`phase4-worker-b-${id}`, handlers(), { limit: 10, leaseMs: 1_000 }),
  ).toMatchObject({
    processed: 1,
  });
  const ready = await db.protectedMediaDerivative.findUniqueOrThrow({ where: { id: blocked.id } });
  const grants = await db.protectedMediaGrant.findMany({ where: { derivativeId: ready.id, state: "ACTIVE" } });
  expect(ready.state).toBe("READY");
  expect(grants).toHaveLength(1);
  const duplicate = await creator.request.post("/api/studio/private-content/media", {
    headers: { "x-csrf-token": csrfToken },
    data: {
      action: "request-derivative",
      mediaId: media.id,
      associationId: association.id,
      purpose: "DISPLAY_CASE_PUBLIC",
      audience: "PUBLIC",
      idempotencyKey: `browser-request-${id}`,
      consentAssertionId: initialConsent.id,
    },
  });
  expect(duplicate.status(), await duplicate.text()).toBe(202);
  expect((await duplicate.json()) as { operationId: string; reused: boolean }).toMatchObject({
    operationId: requestBody.operationId,
    reused: true,
  });
  expect(await db.protectedMediaDerivative.count({ where: { operationId: requestBody.operationId } })).toBe(2);
  expect(await db.protectedMediaGrant.count({ where: { derivativeId: ready.id, state: "ACTIVE" } })).toBe(1);

  const publicPath = `/api/private-content/media/public/${ready.storageOpaqueReference}?revision=revision-1`;
  const publicDelivery = await creator.request.get(publicPath);
  expect(publicDelivery.status()).toBe(200);
  expect(publicDelivery.headers()["cache-control"]).toBe("public, max-age=60, must-revalidate");
  expect(publicDelivery.headers()["content-disposition"]).toBe("inline");
  expect(publicDelivery.headers()["x-content-type-options"]).toBe("nosniff");
  expect(publicDelivery.headers()["x-private-storage-key"]).toBeUndefined();
  expect(Buffer.from(await publicDelivery.body()).toString("utf8")).not.toContain(source.key);

  const page = await creator.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/studio/private-content");
  await expect(page.getByRole("heading", { name: "Private content administration" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  const privacy = await page.evaluate(() => ({
    html: document.documentElement.outerHTML,
    local: Object.values(localStorage),
    session: Object.values(sessionStorage),
  }));
  expect(JSON.stringify(privacy)).not.toContain(source.key);
  expect(JSON.stringify(privacy)).not.toContain(media.sha256);

  const withdrawal = await creator.request.post("/api/studio/private-content/media", {
    headers: { "x-csrf-token": csrfToken },
    data: { action: "withdraw-derivative", derivativeId: ready.id, reason: "OWNER_WITHDRAWN" },
  });
  expect(withdrawal.status(), await withdrawal.text()).toBe(200);
  expect((await creator.request.get(publicPath)).status()).toBe(404);
  expect(await runtime.storage.exists(source)).toBe(true);
  await db.privateAssetObject.update({ where: { id: object.id }, data: { scanStatus: "QUARANTINED" } });
  await db.protectedMedia.update({ where: { id: media.id }, data: { scanState: "QUARANTINED" } });
  expect((await creator.request.get(publicPath)).status()).toBe(404);
  await creator.close();
});
