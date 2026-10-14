// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, afterEach, expect, it, vi } from "vitest";
import { parsePrivateContentConfiguration } from "@/private-content/config";
import { createPrivateProviderRuntime } from "@/private-content/providers";
import { SyntheticPrivateScanner, UnconfiguredPrivateScanner } from "@/private-content/scanner";
import {
  importProtectedRoomPhoto,
  readProtectedRoomPhoto,
  listRoomPhotoPermissions,
  withdrawRoomPhotoPermission,
} from "@/private-content/media/room-photo";
import { createSpatialDraft } from "@/parallax/authoring";
import { canonicalChecksum } from "@/drydock/canonical";
import {
  requestRoomPerception,
  applyRoomPerception,
  roomPerceptionProposalSchema,
} from "@/parallax/room-perception-service";
import { AI_CONTROL_ID } from "@/parallax/ai-ledger";
import { defaultAIGlobalPolicy } from "@/parallax/ai-policy";
import { createEnvironmentDraft } from "@/parallax/library-lifecycle-contracts";
import { environmentPreviewDraft } from "@/parallax/environment-workspace";

const root = mkdtempSync(join(tmpdir(), "voyagewright-room-photo-"));
const url = `file:${join(root, "fixture.db").replaceAll("\\", "/")}`;
const store = new PrismaClient({ datasources: { db: { url } } });
const ownerAccountId = "synthetic-room-photo-owner";
const configuration = parsePrivateContentConfiguration({
  NODE_ENV: "test",
  PRIVATE_CONTENT_PROVIDER_ROOT: join(root, "private"),
  PRIVATE_CONTENT_LOCAL_MASTER_KEY: "1".repeat(64),
  PRIVATE_CONTENT_SCANNER_PROVIDER: "synthetic",
});
const runtime = createPrivateProviderRuntime(configuration);
let bytes: Buffer;
beforeAll(async () => {
  execFileSync(process.execPath, ["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", url], {
    windowsHide: true,
  });
  await store.userAccount.create({ data: { id: ownerAccountId, status: "ACTIVE" } });
  await store.aIQuotaControl.create({
    data: {
      id: AI_CONTROL_ID,
      policy: JSON.stringify({ ...defaultAIGlobalPolicy, enabled: true }),
    },
  });
  bytes = await sharp({ create: { width: 64, height: 32, channels: 3, background: "#96aab0" } })
    .png()
    .toBuffer();
}, 60000);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
afterAll(async () => {
  await store.$disconnect();
  if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw new Error("Unsafe isolated fixture cleanup");
  rmSync(root, { recursive: true });
});
async function scene() {
  const draft = createSpatialDraft(randomUUID());
  await store.reusableAuthoringItem.create({
    data: {
      id: draft.content.definitionId,
      ownerAccountId,
      kind: "PARALLAX_STUDIO",
      name: "Synthetic photo scene",
      versions: { create: { versionNumber: 0, envelope: JSON.stringify(draft), checksum: canonicalChecksum(draft) } },
    },
  });
  return draft;
}
let photoSequence = 0;
async function imported() {
  const draft = await scene();
  // Each adversarial case owns different bytes; changing one scan/receipt must not poison another fixture.
  const photoBytes = await sharp({
    create: { width: 64 + ++photoSequence, height: 32, channels: 3, background: "#96aab0" },
  })
    .png()
    .toBuffer();
  const result = await importProtectedRoomPhoto({
    ownerAccountId,
    definitionId: draft.content.definitionId,
    bytes: photoBytes,
    declaredMediaType: "image/png",
    consent: true,
    runtime,
    store,
  });
  return {
    draft,
    result,
    input: { ownerAccountId, definitionId: draft.content.definitionId, mediaId: result.mediaId, runtime, store },
  };
}
const observation = {
  status: "OBSERVED",
  explanation: "Synthetic generic room",
  clarification: null,
  alignment: "INITIAL_ROOM",
  sharedFeatureId: null,
  roomDimensions: [6, 3, 5],
  dimensionBasis: "ESTIMATED",
  uncertainties: ["Dimensions estimated"],
  features: [
    {
      matchedFeatureId: null,
      classification: "DESK",
      name: "Writing desk",
      position: { x: 1, y: 0.4, z: -1 },
      dimensions: [1.4, 0.8, 0.8],
      yawDegrees: 0,
      basis: "DIRECTLY_OBSERVED",
      confidence: 0.8,
    },
  ],
};
const response = () => ({
  id: randomUUID(),
  status: "completed",
  service_tier: "default",
  output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(observation) }] }],
  usage: { input_tokens: 1200, output_tokens: 300 },
});

it("stores/scans original and sanitized bytes under canonical media receipts and owner-only exact consent", async () => {
  const { result, input } = await imported();
  expect(Object.keys(result).sort()).toEqual(["height", "mediaId", "permissionExpiresAt", "width"]);
  const image = await readProtectedRoomPhoto(input);
  expect((await sharp(image.bytes).metadata()).format).toBe("webp");
  expect(
    await store.protectedMediaTransformationReceipt.count({ where: { sourceProtectedMediaOpaqueId: result.mediaId } }),
  ).toBe(1);
  const grant = await store.protectedMediaGrant.findFirstOrThrow({ where: { protectedMediaId: result.mediaId } });
  expect(grant).toMatchObject({
    purpose: "SPATIAL_ROOM_RECONSTRUCTION",
    audience: "OWNER",
    consumingAggregateOpaqueId: input.definitionId,
  });
});

it("requires consent and an owned scene before storage/scanning", async () => {
  const put = vi.spyOn(runtime.storage, "put");
  const draft = await scene();
  await expect(
    importProtectedRoomPhoto({
      ownerAccountId,
      definitionId: draft.content.definitionId,
      bytes,
      declaredMediaType: "image/png",
      consent: false,
      runtime,
      store,
    }),
  ).rejects.toMatchObject({ code: "PROTECTED_MEDIA_CONSENT_REQUIRED" });
  await expect(
    importProtectedRoomPhoto({
      ownerAccountId: "other-owner",
      definitionId: draft.content.definitionId,
      bytes,
      declaredMediaType: "image/png",
      consent: true,
      runtime,
      store,
    }),
  ).rejects.toMatchObject({ code: "PROTECTED_MEDIA_SUBJECT_FORBIDDEN" });
  expect(put).not.toHaveBeenCalled();
  put.mockRestore();
});

it("lists only the owner's scene permissions and persists withdrawal without removing authored geometry", async () => {
  const { input, result } = await imported();
  expect(await listRoomPhotoPermissions(ownerAccountId, input.definitionId, store)).toEqual([
    { mediaId: result.mediaId, permissionExpiresAt: result.permissionExpiresAt },
  ]);
  await expect(listRoomPhotoPermissions("another-owner", input.definitionId, store)).rejects.toMatchObject({
    code: "PROTECTED_MEDIA_SUBJECT_FORBIDDEN",
  });
  await withdrawRoomPhotoPermission({ ...input, store });
  expect(await listRoomPhotoPermissions(ownerAccountId, input.definitionId, store)).toEqual([]);
  await expect(readProtectedRoomPhoto(input)).rejects.toMatchObject({ code: "PROTECTED_MEDIA_DELIVERY_FORBIDDEN" });
  expect(await store.reusableAuthoringItem.count({ where: { id: input.definitionId, ownerAccountId } })).toBe(1);
});

it("fails closed on unavailable or detecting scanners without creating media/grants", async () => {
  const draft = await scene();
  for (const scanner of [new UnconfiguredPrivateScanner(), new SyntheticPrivateScanner("MALICIOUS")]) {
    await expect(
      importProtectedRoomPhoto({
        ownerAccountId,
        definitionId: draft.content.definitionId,
        bytes,
        declaredMediaType: "image/png",
        consent: true,
        runtime: { ...runtime, scanner },
        store,
      }),
    ).rejects.toBeDefined();
  }
  expect(await store.protectedMediaAssociation.count({ where: { subjectOpaqueId: draft.content.definitionId } })).toBe(
    0,
  );
});

it.each(["owner", "scene", "revoked", "expired", "source-scan", "derivative-scan", "receipt"])(
  "rejects %s changes before delivering image bytes",
  async (change) => {
    const { input } = await imported();
    if (change === "owner") input.ownerAccountId = "other-owner";
    if (change === "scene") input.definitionId = "other-scene";
    if (change === "revoked")
      await store.protectedMediaConsentAssertion.updateMany({
        where: { sourceProtectedMediaId: input.mediaId },
        data: { state: "REVOKED" },
      });
    if (change === "expired")
      await store.protectedMediaGrant.updateMany({
        where: { protectedMediaId: input.mediaId },
        data: { expiresAt: new Date(0) },
      });
    if (change === "source-scan")
      await store.protectedMedia.update({ where: { id: input.mediaId }, data: { scanState: "PENDING" } });
    if (change === "derivative-scan")
      await store.protectedMediaDerivative.updateMany({
        where: { sourceProtectedMediaId: input.mediaId },
        data: { scanState: "PENDING" },
      });
    if (change === "receipt")
      await store.protectedMediaTransformationReceipt.updateMany({
        where: { sourceProtectedMediaOpaqueId: input.mediaId },
        data: { safeMetadata: "{}" },
      });
    const read = vi.spyOn(runtime.storage, "read");
    await expect(readProtectedRoomPhoto(input)).rejects.toBeDefined();
    expect(read).not.toHaveBeenCalled();
    read.mockRestore();
  },
);

it("counts multimodal input before generation, settles the existing ledger and replays without another dispatch", async () => {
  vi.stubEnv("OPENAI_API_KEY", "synthetic-photo-key");
  const { draft, result } = await imported();
  const request = {
    draft,
    revision: 1,
    editorGeneration: 0,
    requestId: randomUUID(),
    idempotencyKey: randomUUID(),
    mediaIds: [result.mediaId],
    sharedFeatureId: null,
  };
  const fetcher = vi.fn<typeof fetch>(async (url) =>
    String(url).endsWith("/input_tokens")
      ? Response.json({ object: "response.input_tokens", input_tokens: 1200 })
      : Response.json(response()),
  );
  const proposed = await requestRoomPerception(ownerAccountId, request, { runtime, store, fetcher });
  expect(proposed).toMatchObject({
    status: "PROPOSED",
    proposal: { room: { origin: "PHOTO_RECONSTRUCTION" } },
    accounting: "SETTLED",
  });
  const ledger = await store.aIUsageLedger.findFirstOrThrow({ where: { requestId: request.requestId } });
  expect(ledger.status).toBe("SETTLED");
  expect(ledger.result).not.toContain("base64");
  expect(ledger.result).not.toContain("storageKey");
  expect(await requestRoomPerception(ownerAccountId, request, { runtime, store, fetcher })).toMatchObject({
    status: "PROPOSED",
    replay: true,
  });
  expect(fetcher).toHaveBeenCalledTimes(2);
  const proposal = roomPerceptionProposalSchema.parse(proposed.proposal);
  await expect(
    applyRoomPerception(ownerAccountId, { draft, revision: 1, editorGeneration: 1, proposal }, store),
  ).rejects.toMatchObject({ code: "STALE_SCENE" });
  const changed = structuredClone(proposal);
  changed.room.width = 7;
  await expect(
    applyRoomPerception(ownerAccountId, { draft, revision: 1, editorGeneration: 0, proposal: changed }, store),
  ).rejects.toMatchObject({ code: "STALE_SCENE" });
  const saved = await applyRoomPerception(ownerAccountId, { draft, revision: 1, editorGeneration: 0, proposal }, store);
  expect(saved.revision).toBe(2);
  const persisted = await store.reusableAuthoringItemVersion.findFirstOrThrow({
    where: { itemId: draft.content.definitionId, versionNumber: 0 },
  });
  expect(JSON.parse(persisted.envelope)).toEqual(saved.draft);
  await expect(
    applyRoomPerception(ownerAccountId, { draft, revision: 1, editorGeneration: 0, proposal }, store),
  ).rejects.toMatchObject({ code: "STALE_SCENE" });
});

it("reconstructs directly into an independent environment definition without creating a scene", async () => {
  vi.stubEnv("OPENAI_API_KEY", "synthetic-photo-key");
  const document = createEnvironmentDraft(randomUUID());
  await store.reusableAuthoringItem.create({
    data: {
      id: document.id,
      ownerAccountId,
      kind: "PARALLAX_STUDIO",
      status: "WORKING",
      name: document.name,
      versions: {
        create: { versionNumber: 0, envelope: JSON.stringify(document), checksum: canonicalChecksum(document) },
      },
    },
  });
  const media = await importProtectedRoomPhoto({
    ownerAccountId,
    definitionId: document.id,
    bytes,
    declaredMediaType: "image/png",
    consent: true,
    runtime,
    store,
  });
  const draft = environmentPreviewDraft(document),
    request = {
      draft,
      revision: 1,
      editorGeneration: 0,
      requestId: randomUUID(),
      idempotencyKey: randomUUID(),
      mediaIds: [media.mediaId],
      sharedFeatureId: null,
    };
  const fetcher = vi.fn<typeof fetch>(async (url) =>
    String(url).endsWith("/input_tokens")
      ? Response.json({ object: "response.input_tokens", input_tokens: 1200 })
      : Response.json(response()),
  );
  const result = await requestRoomPerception(ownerAccountId, request, { runtime, store, fetcher });
  expect(result.status).toBe("PROPOSED");
  const saved = await applyRoomPerception(
    ownerAccountId,
    { draft, revision: 1, editorGeneration: 0, proposal: roomPerceptionProposalSchema.parse(result.proposal) },
    store,
  );
  expect(saved).toMatchObject({
    environmentDraft: {
      format: "PARALLAX_ENVIRONMENT_DRAFT_1",
      id: document.id,
      room: { id: document.id, origin: "PHOTO_RECONSTRUCTION" },
    },
    revision: 2,
  });
  const row = await store.reusableAuthoringItem.findUniqueOrThrow({
    where: { id: document.id },
    include: { versions: true },
  });
  expect(row.versions).toHaveLength(1);
  expect(JSON.parse(row.versions[0].envelope).format).toBe("PARALLAX_ENVIRONMENT_DRAFT_1");
  expect(row.status).toBe("WORKING");
  expect(fetcher).toHaveBeenCalledTimes(2);
  const ledger = await store.aIUsageLedger.findFirstOrThrow({ where: { requestId: request.requestId } });
  expect(JSON.parse(ledger.result!).diagnostics.observation.status).toBe("OBSERVED");
  expect(ledger.result).not.toMatch(/base64|storageKey|synthetic-photo-key/);
});

it("checks withdrawal again after image counting and releases the reservation without generation", async () => {
  vi.stubEnv("OPENAI_API_KEY", "synthetic-photo-key");
  const { draft, result } = await imported();
  const request = {
    draft,
    revision: 1,
    editorGeneration: 0,
    requestId: randomUUID(),
    idempotencyKey: randomUUID(),
    mediaIds: [result.mediaId],
    sharedFeatureId: null,
  };
  const fetcher = vi.fn<typeof fetch>(async () => {
    await store.protectedMediaConsentAssertion.updateMany({
      where: { sourceProtectedMediaId: result.mediaId },
      data: { state: "REVOKED" },
    });
    return Response.json({ object: "response.input_tokens", input_tokens: 1200 });
  });
  await expect(requestRoomPerception(ownerAccountId, request, { runtime, store, fetcher })).rejects.toBeDefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect((await store.aIUsageLedger.findFirstOrThrow({ where: { requestId: request.requestId } })).status).toBe(
    "RELEASED",
  );
});

it("releases admission without generation when the exact image count exceeds allowance", async () => {
  vi.stubEnv("OPENAI_API_KEY", "synthetic-photo-key");
  const { draft, result } = await imported();
  const request = {
    draft,
    revision: 1,
    editorGeneration: 0,
    requestId: randomUUID(),
    idempotencyKey: randomUUID(),
    mediaIds: [result.mediaId],
    sharedFeatureId: null,
  };
  const fetcher = vi.fn<typeof fetch>(async () =>
    Response.json({ object: "response.input_tokens", input_tokens: 32001 }),
  );
  await expect(requestRoomPerception(ownerAccountId, request, { runtime, store, fetcher })).rejects.toMatchObject({
    code: "CONTEXT_TOO_LARGE",
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect((await store.aIUsageLedger.findFirstOrThrow({ where: { requestId: request.requestId } })).status).toBe(
    "RELEASED",
  );
});
