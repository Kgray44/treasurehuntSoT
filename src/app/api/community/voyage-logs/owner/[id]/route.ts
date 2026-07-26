import { NextResponse } from "next/server";
import { z } from "zod";
import { communityApiError } from "@/community/api";
import { editVoyageLogDraft, transitionOwnedVoyageLog } from "@/community/voyage-log-owner";
import { requireCanonicalAccountIdentity, verifyPlayerCsrf } from "@/platform/auth";

const update = z.object({ title: z.string(), safeSummary: z.string().nullable().optional(), visibility: z.enum(["PRIVATE", "CREW_ONLY", "UNLISTED", "COMMUNITY"]), spoilerLevel: z.enum(["NONE", "PREVIEW_SAFE", "MINOR", "CHAPTER", "FINALE"]), approximateLocation: z.string().nullable().optional() }).strict();
const transition = z.object({ action: z.enum(["ARCHIVED", "REMOVED", "READY"]) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireCanonicalAccountIdentity();
  if (!identity || !(await verifyPlayerCsrf(request.headers.get("x-csrf-token")))) return NextResponse.json({ code: "COMMUNITY_ACCESS_DENIED", error: "The signed-in session could not be verified." }, { status: 403 });
  try { return NextResponse.json(await editVoyageLogDraft({ ownerAccountId: identity.accountId, voyageLogId: (await params).id, ...update.parse(await request.json()) }), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (cause) { return communityApiError(cause); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireCanonicalAccountIdentity();
  if (!identity || !(await verifyPlayerCsrf(request.headers.get("x-csrf-token")))) return NextResponse.json({ code: "COMMUNITY_ACCESS_DENIED", error: "The signed-in session could not be verified." }, { status: 403 });
  try { const input = transition.parse(await request.json()); return NextResponse.json(await transitionOwnedVoyageLog({ ownerAccountId: identity.accountId, voyageLogId: (await params).id, to: input.action }), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (cause) { return communityApiError(cause); }
}
