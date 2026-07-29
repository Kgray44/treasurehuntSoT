import { NextResponse } from "next/server";
import { z } from "zod";
import { addModerationEvidence, listModerationEvidence } from "@/community/moderation";
import { canonicalCommunityActor, denied, routeError } from "../../../contract";

const schema = z.object({ kind: z.string().trim().min(1).max(64), checksum: z.string().regex(/^[a-f0-9]{64}$/u), snapshot: z.record(z.string(), z.unknown()).default({}) }).strict();
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await canonicalCommunityActor(request);
  if (!actor) return denied();
  try { return NextResponse.json(await listModerationEvidence(actor, (await context.params).id)); } catch (cause) { return routeError(cause); }
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await canonicalCommunityActor(request);
  if (!actor) return denied();
  try { return NextResponse.json(await addModerationEvidence(actor, { ...schema.parse(await request.json()), caseId: (await context.params).id }), { status: 201 }); } catch (cause) { return routeError(cause); }
}
