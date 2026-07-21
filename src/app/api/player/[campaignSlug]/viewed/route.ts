import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireLegacyCompatibilityAccess } from "@/compatibility/legacy-companion";

const eventIdSchema = z.string().min(8).max(128);
const deviceIdSchema = z.string().uuid();

const ceremonySchema = z.object({
  eventId: eventIdSchema,
  deviceId: deviceIdSchema,
});

const ceremonyBatchSchema = z.object({
  eventIds: z.array(eventIdSchema).min(1).max(100),
  deviceId: z.string().uuid(),
});

const schema = z.union([
  ceremonySchema,
  z.object({
    contentType: z.enum(["chapter", "hint", "annotation", "map", "route", "artifact", "quest", "log", "finale"]),
    contentKeys: z.array(z.string().min(1).max(128)).min(1).max(100),
  }),
]);

async function eligiblePlayerPresentation(sessionId: string, eventId: string) {
  return db.taleSessionEvent.findFirst({
    where: {
      id: eventId,
      sessionId,
      eventType: {
        in: [
          "CHAPTER_RELEASED",
          "HINT_RELEASED",
          "ARTIFACT_AWARDED",
          "MAP_LOCATION_REVEALED",
          "NARRATIVE_MESSAGE_RELEASED",
        ],
      },
    },
    select: { id: true, eventType: true },
  });
}

async function eligiblePlayerPresentations(sessionId: string, eventIds: string[]) {
  return db.taleSessionEvent.findMany({
    where: {
      id: { in: eventIds },
      sessionId,
      eventType: {
        in: [
          "CHAPTER_RELEASED",
          "HINT_RELEASED",
          "ARTIFACT_AWARDED",
          "MAP_LOCATION_REVEALED",
          "NARRATIVE_MESSAGE_RELEASED",
        ],
      },
    },
    select: { id: true },
  });
}

export async function GET(request: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await context.params;
  const access = await requireLegacyCompatibilityAccess(campaignSlug);
  if (!access) return NextResponse.json({ error: "Invitation required." }, { status: 401 });
  const url = new URL(request.url);
  // Batch contract: repeat the plural key, for example
  // `?deviceId=<uuid>&eventIds=<id-1>&eventIds=<id-2>`. The singular
  // `eventId` form below retains its existing response and 409 semantics.
  if (url.searchParams.has("eventIds")) {
    if (url.searchParams.has("eventId")) {
      return NextResponse.json({ error: "Invalid acknowledgement query." }, { status: 400 });
    }
    const parsedBatch = ceremonyBatchSchema.safeParse({
      eventIds: url.searchParams.getAll("eventIds"),
      deviceId: url.searchParams.get("deviceId"),
    });
    if (!parsedBatch.success) {
      return NextResponse.json({ error: "Invalid acknowledgement query." }, { status: 400 });
    }
    const requestedEventIds = [...new Set(parsedBatch.data.eventIds)];
    const eligible = await eligiblePlayerPresentations(access.sessionId, requestedEventIds);
    const eligibleIds = new Set(eligible.map((event) => event.id));
    const viewed = await db.revealState.findMany({
      where: {
        playthroughId: access.sessionId,
        contentType: "acknowledgement:event",
        contentKey: {
          in: [...eligibleIds].map((eventId) => `${access.playerId}:${parsedBatch.data.deviceId}:${eventId}`),
        },
      },
      select: { contentKey: true },
    });
    const acknowledgedEventIds = [...new Set(viewed.map((receipt) => receipt.contentKey.split(":").at(-1) ?? ""))]
      .filter((eventId) => eligibleIds.has(eventId))
      .sort((left, right) => left.localeCompare(right));
    return NextResponse.json({ acknowledgedEventIds });
  }
  const parsed = ceremonySchema.safeParse({
    eventId: url.searchParams.get("eventId"),
    deviceId: url.searchParams.get("deviceId"),
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid acknowledgement." }, { status: 400 });
  const event = await eligiblePlayerPresentation(access.sessionId, parsed.data.eventId);
  if (!event) {
    return NextResponse.json({ error: "Presentation is not eligible for acknowledgement." }, { status: 409 });
  }
  const viewed = await db.revealState.findFirst({
    where: {
      playthroughId: access.sessionId,
      contentType: "acknowledgement:event",
      contentKey: `${access.playerId}:${parsed.data.deviceId}:${parsed.data.eventId}`,
    },
    select: { id: true },
  });
  return NextResponse.json({ acknowledged: Boolean(viewed) });
}

export async function POST(request: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await context.params;
  const access = await requireLegacyCompatibilityAccess(campaignSlug);
  if (!access) return NextResponse.json({ error: "Invitation required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid acknowledgement." }, { status: 400 });
  if ("eventId" in parsed.data) {
    const event = await eligiblePlayerPresentation(access.sessionId, parsed.data.eventId);
    if (!event) {
      return NextResponse.json({ error: "Presentation is not eligible for acknowledgement." }, { status: 409 });
    }
    await db.revealState.upsert({
      where: {
        playthroughId_contentType_contentKey: {
          playthroughId: access.sessionId,
          contentType: "acknowledgement:event",
          contentKey: `${access.playerId}:${parsed.data.deviceId}:${parsed.data.eventId}`,
        },
      },
      update: {},
      create: {
        playthroughId: access.sessionId,
        contentType: "acknowledgement:event",
        contentKey: `${access.playerId}:${parsed.data.deviceId}:${parsed.data.eventId}`,
        status: "ACKNOWLEDGED",
        revealedBy: access.playerId,
      },
    });
  } else {
    const { contentType, contentKeys } = parsed.data;
    await db.$transaction(
      contentKeys.map((contentKey) =>
        db.revealState.upsert({
          where: {
            playthroughId_contentType_contentKey: {
              playthroughId: access.sessionId,
              contentType: `acknowledgement:${contentType}`,
              contentKey: `${access.playerId}:${contentKey}`,
            },
          },
          update: { revealedAt: new Date() },
          create: {
            playthroughId: access.sessionId,
            contentType: `acknowledgement:${contentType}`,
            contentKey: `${access.playerId}:${contentKey}`,
            status: "ACKNOWLEDGED",
            revealedBy: access.playerId,
          },
        }),
      ),
    );
  }
  return NextResponse.json({ ok: true });
}
