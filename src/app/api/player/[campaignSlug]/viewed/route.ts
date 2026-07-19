import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlayer } from "@/lib/security";

const ceremonySchema = z.object({
  eventId: z.string().min(8).max(128),
  deviceId: z.string().uuid(),
});

const schema = z.union([
  ceremonySchema,
  z.object({
    contentType: z.enum(["chapter", "hint", "annotation", "map", "route", "artifact", "quest", "log", "finale"]),
    contentKeys: z.array(z.string().min(1).max(128)).min(1).max(100),
  }),
]);

async function eligibleChapterRelease(campaignId: string, eventId: string) {
  return db.progressEvent.findFirst({
    where: {
      id: eventId,
      campaignId,
      type: "CHAPTER_RELEASED",
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
  const parsed = ceremonySchema.safeParse({
    eventId: url.searchParams.get("eventId"),
    deviceId: url.searchParams.get("deviceId"),
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid acknowledgement." }, { status: 400 });
  const event = await eligibleChapterRelease(access.campaignId, parsed.data.eventId);
  if (!event) {
    return NextResponse.json({ error: "Ceremony is not eligible for acknowledgement." }, { status: 409 });
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
    const event = await eligibleChapterRelease(access.campaignId, parsed.data.eventId);
    if (!event) {
      return NextResponse.json({ error: "Ceremony is not eligible for acknowledgement." }, { status: 409 });
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
