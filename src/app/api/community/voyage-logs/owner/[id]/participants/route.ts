import { NextResponse } from "next/server";
import { z } from "zod";
import { communityApiError } from "@/community/api";
import { addOwnedVoyageLogParticipant, removeOwnedVoyageLogParticipant } from "@/community/voyage-log-owner";
import { requireCanonicalAccountIdentity, verifyPlayerCsrf } from "@/platform/auth";

const opaqueId = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u);
const add = z.object({ displayName: z.string(), accountId: opaqueId.nullable().optional() }).strict();
const remove = z.object({ participantId: opaqueId }).strict();

function denied() {
  return NextResponse.json(
    { code: "COMMUNITY_ACCESS_DENIED", error: "The signed-in session could not be verified." },
    { status: 403 },
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireCanonicalAccountIdentity();
  if (!identity || !(await verifyPlayerCsrf(request.headers.get("x-csrf-token")))) return denied();
  try {
    const input = add.parse(await request.json());
    return NextResponse.json(
      await addOwnedVoyageLogParticipant({
        ownerAccountId: identity.accountId,
        voyageLogId: (await params).id,
        ...input,
      }),
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return communityApiError(cause);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireCanonicalAccountIdentity();
  if (!identity || !(await verifyPlayerCsrf(request.headers.get("x-csrf-token")))) return denied();
  try {
    const input = remove.parse(await request.json());
    await removeOwnedVoyageLogParticipant({
      ownerAccountId: identity.accountId,
      voyageLogId: (await params).id,
      ...input,
    });
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    return communityApiError(cause);
  }
}
