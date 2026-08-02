import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { removeProfileMedia, saveProfileMedia } from "@/wayfarer/profile-media";
import { profileApiError } from "@/wayfarer/http-errors";

const uploadSchema = z
  .object({
    kind: z.enum(["AVATAR", "BANNER"]),
    dataUrl: z.string().max(4_100_000),
    altText: z.string().max(240).optional(),
  })
  .strict();
const removeSchema = z.object({ id: z.string().min(1).max(191) }).strict();
export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const body = uploadSchema.parse(await request.json());
    return NextResponse.json(await saveProfileMedia(session.account.profile.id, body.kind, body.dataUrl, body.altText));
  } catch (cause) {
    return profileApiError(cause);
  }
}

export async function DELETE(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const body = removeSchema.parse(await request.json());
    return NextResponse.json(await removeProfileMedia(session.account.profile.id, body.id));
  } catch (cause) {
    return profileApiError(cause);
  }
}
