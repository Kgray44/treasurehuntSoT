import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioWorkspace } from "@/chronicle/studio-authorization";
import { consumeRateLimit } from "@/lib/rate-limit";
import { parsePrivateContentConfiguration } from "@/private-content/config";
import { createPrivateProviderRuntime } from "@/private-content/providers";
import { ProtectedMediaError } from "@/private-content/media/contracts";
import {
  importProtectedRoomPhoto,
  withdrawRoomPhotoPermission,
  listRoomPhotoPermissions,
} from "@/private-content/media/room-photo";
import { spatialId } from "@/parallax/contracts";
import { draftSchema } from "@/parallax/authoring";
import {
  roomPerceptionRequestSchema,
  roomPerceptionProposalSchema,
  requestRoomPerception,
  applyRoomPerception,
} from "@/parallax/room-perception-service";
import { SpatialAssistantError } from "@/parallax/spatial-assistant";
import { readAIPolicy, creatorAIUsage } from "@/parallax/ai-ledger";
import { openAIProviderConfiguration } from "@/parallax/openai-provider";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const inputSchema = z.discriminatedUnion("action", [
  roomPerceptionRequestSchema.extend({ action: z.literal("RECONSTRUCT") }),
  z.strictObject({
    action: z.literal("APPLY"),
    draft: draftSchema,
    revision: z.number().int().min(1),
    editorGeneration: z.number().int().nonnegative(),
    proposal: roomPerceptionProposalSchema,
  }),
  z.strictObject({ action: z.literal("WITHDRAW"), definitionId: spatialId, mediaId: spatialId }),
]);

export async function GET(request?: Request) {
  const session = await requireStudioWorkspace();
  if (!session) return NextResponse.json({ error: "Creator authorization is required." }, { status: 403, headers });
  let photoMetadata = {};
  const definitionId = request ? new URL(request.url).searchParams.get("definitionId") : null;
  if (definitionId) {
    try {
      photoMetadata = { photos: await listRoomPhotoPermissions(session.accountId, spatialId.parse(definitionId)) };
    } catch {
      return NextResponse.json({ error: "This owned room could not be opened." }, { status: 403, headers });
    }
  }
  try {
    const privateRuntime = createPrivateProviderRuntime(parsePrivateContentConfiguration());
    const probes = await Promise.all([privateRuntime.storage.health(), privateRuntime.scanner.health()]);
    const [policy, usage] = await Promise.all([readAIPolicy(), creatorAIUsage(session.accountId)]);
    const available =
      privateRuntime.configuration.PRIVATE_CONTENT_ENABLED &&
      probes.every((probe) => probe.configured && probe.healthy) &&
      openAIProviderConfiguration(policy.policy).configured &&
      usage.enabled;
    return NextResponse.json(
      {
        ...photoMetadata,
        available,
        message: available
          ? "Protected photo import and room inference are ready."
          : "Photo reconstruction needs configured private storage, a healthy scanner and an enabled OpenAI allowance. Manual room editing is available.",
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        ...photoMetadata,
        available: false,
        message:
          "Photo import is not configured. Configure the existing private-media providers before importing photographs; manual room editing is available.",
      },
      { headers },
    );
  }
}

async function boundedBody(request: Request, maximum: number) {
  if (!request.body) throw new SpatialAssistantError("EMPTY_REQUEST", "Choose a room photograph.", 400);
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new SpatialAssistantError("IMAGE_TOO_LARGE", "Room photographs must be at most 8 MiB.", 413);
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}

export async function POST(request: Request) {
  const session = await requireStudioWorkspace(request);
  if (!session)
    return NextResponse.json({ error: "Creator access and CSRF verification required." }, { status: 401, headers });
  if (!consumeRateLimit(`parallax.room-photo:${session.accountId}`, { limit: 12, windowMs: 60000 }).allowed)
    return NextResponse.json({ error: "Wait a moment before another room-photo request." }, { status: 429, headers });
  try {
    const contentType = request.headers.get("Content-Type") ?? "";
    if (contentType.startsWith("multipart/form-data")) {
      const body = await boundedBody(request, 8 * 1024 * 1024 + 64 * 1024);
      const form = await new Response(new Uint8Array(body), { headers: { "Content-Type": contentType } }).formData();
      const file = form.get("image");
      if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw new SpatialAssistantError("IMAGE_INVALID", "Choose a JPEG, PNG or WebP room photograph.", 400);
      return NextResponse.json(
        await importProtectedRoomPhoto({
          ownerAccountId: session.accountId,
          definitionId: spatialId.parse(form.get("definitionId")),
          bytes: Buffer.from(await file.arrayBuffer()),
          declaredMediaType: file.type,
          consent: form.get("consent") === "yes",
          signal: request.signal,
          runtime: createPrivateProviderRuntime(parsePrivateContentConfiguration()),
        }),
        { status: 201, headers },
      );
    }
    const raw = JSON.parse((await boundedBody(request, 256 * 1024)).toString("utf8"));
    const input = inputSchema.parse(raw);
    if (input.action === "WITHDRAW")
      return NextResponse.json(
        await withdrawRoomPhotoPermission({
          ownerAccountId: session.accountId,
          definitionId: input.definitionId,
          mediaId: input.mediaId,
        }),
        { headers },
      );
    if (input.action === "APPLY")
      return NextResponse.json(await applyRoomPerception(session.accountId, input), { headers });
    const payload = roomPerceptionRequestSchema.parse({
      draft: input.draft,
      revision: input.revision,
      editorGeneration: input.editorGeneration,
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
      mediaIds: input.mediaIds,
      sharedFeatureId: input.sharedFeatureId,
    });
    return NextResponse.json(
      await requestRoomPerception(session.accountId, payload, {
        runtime: createPrivateProviderRuntime(parsePrivateContentConfiguration()),
        signal: request.signal,
      }),
      { headers },
    );
  } catch (error) {
    return NextResponse.json(
      {
        code:
          error instanceof SpatialAssistantError || error instanceof ProtectedMediaError
            ? error.code
            : "ROOM_PHOTO_UNAVAILABLE",
        error:
          error instanceof SpatialAssistantError
            ? error.message
            : "Photo processing could not finish. Your scene is unchanged; check private-media configuration or use manual room editing.",
      },
      {
        status:
          error instanceof SpatialAssistantError
            ? error.status
            : error instanceof z.ZodError || error instanceof SyntaxError
              ? 400
              : 503,
        headers,
      },
    );
  }
}
