import { NextResponse } from "next/server";
import { z } from "zod";

import { getSocialRelationshipStates, socialStateSubjectTypes } from "@/community/social-state";
import { requireCanonicalAccountIdentity } from "@/platform/auth";

const subjectSchema = z.object({
  subjectType: z.enum(socialStateSubjectTypes),
  subjectId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
});

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("subjects");
  let subjects: z.infer<typeof subjectSchema>[];
  try {
    subjects = z.array(subjectSchema).min(1).max(48).parse(raw ? JSON.parse(raw) : []);
  } catch {
    return NextResponse.json({ code: "COMMUNITY_INVALID_INPUT", error: "Social state request is invalid." }, { status: 400 });
  }
  const identity = await requireCanonicalAccountIdentity();
  try {
    return NextResponse.json(
      { states: await getSocialRelationshipStates(identity?.accountId ?? null, subjects) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ states: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }
}
