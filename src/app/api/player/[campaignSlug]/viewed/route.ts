import { NextResponse } from "next/server";
import { z } from "zod";
import { playerPresentationEventTypes } from "@/domain/visibility";
import { db } from "@/lib/db";
import { requirePlayer } from "@/lib/security";

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

async function eligiblePlayerPresentation(campaignId: string, eventId: string) {
  return db.progressEvent.findFirst({
    where: {
      id: eventId,
      campaignId,
      type: { in: [...playerPresentationEventTypes] },
      releaseAt: { lte: new Date() },
    },
    select: { id: true, type: true },
  });
}

async function eligiblePlayerPresentations(campaignId: string, eventIds: string[]) {
  return db.progressEvent.findMany({
    where: {
      id: { in: eventIds },
      campaignId,
      type: { in: [...playerPresentationEventTypes] },
      releaseAt: { lte: new Date() },
    },
    select: { id: true },
  });
}

export async function GET(request: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await context.params;
  const access = await requirePlayer(campaignSlug);
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
    const eligible = await eligiblePlayerPresentations(access.campaignId, requestedEventIds);
    const eligibleIds = new Set(eligible.map((event) => event.id));
    const viewed = await db.viewedCeremony.findMany({
      where: {
        campaignId: access.campaignId,
        deviceId: parsedBatch.data.deviceId,
        eventId: { in: [...eligibleIds] },
      },
      select: { eventId: true },
    });
    const acknowledgedEventIds = [...new Set(viewed.map((receipt) => receipt.eventId))]
      .filter((eventId) => eligibleIds.has(eventId))
      .sort((left, right) => left.localeCompare(right));
    return NextResponse.json({ acknowledgedEventIds });
  }
  const parsed = ceremonySchema.safeParse({
    eventId: url.searchParams.get("eventId"),
    deviceId: url.searchParams.get("deviceId"),
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid acknowledgement." }, { status: 400 });
  const event = await eligiblePlayerPresentation(access.campaignId, parsed.data.eventId);
  if (!event) {
    return NextResponse.json({ error: "Presentation is not eligible for acknowledgement." }, { status: 409 });
  }
  const viewed = await db.viewedCeremony.findUnique({
    where: { campaignId_deviceId_eventId: { campaignId: access.campaignId, ...parsed.data } },
    select: { id: true },
  });
  return NextResponse.json({ acknowledged: Boolean(viewed) });
}

export async function POST(request: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await context.params;
  const access = await requirePlayer(campaignSlug);
  if (!access) return NextResponse.json({ error: "Invitation required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid acknowledgement." }, { status: 400 });
  if ("eventId" in parsed.data) {
    const event = await eligiblePlayerPresentation(access.campaignId, parsed.data.eventId);
    if (!event) {
      return NextResponse.json({ error: "Presentation is not eligible for acknowledgement." }, { status: 409 });
    }
    await db.viewedCeremony.upsert({
      where: { campaignId_deviceId_eventId: { campaignId: access.campaignId, ...parsed.data } },
      update: {},
      create: { campaignId: access.campaignId, ...parsed.data },
    });
  } else {
    const { contentType, contentKeys } = parsed.data;
    await db.$transaction(
      contentKeys.map((contentKey) =>
        db.viewedContent.upsert({
          where: { playerAccessId_contentType_contentKey: { playerAccessId: access.id, contentType, contentKey } },
          update: { viewedAt: new Date() },
          create: { playerAccessId: access.id, contentType, contentKey },
        }),
      ),
    );
  }
  return NextResponse.json({ ok: true });
}
