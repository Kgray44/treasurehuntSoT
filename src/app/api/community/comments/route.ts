import { NextResponse } from "next/server";

import { communityApiError } from "@/community/api";
import { createComment, listPublicComments } from "@/community/social";
import { executeSocialMutation } from "@/app/api/community/social/contract";

import { commentInputSchema, commentQuerySchema } from "./contract";

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const parsed = commentQuerySchema.safeParse({
    subjectType: search.get("subjectType") ?? "",
    subjectId: search.get("subjectId") ?? "",
  });
  if (!parsed.success)
    return NextResponse.json(
      { code: "COMMUNITY_INVALID_INPUT", error: "A valid comment subject is required." },
      { status: 400 },
    );
  try {
    return NextResponse.json({ comments: await listPublicComments(parsed.data.subjectType, parsed.data.subjectId) });
  } catch {
    // Public callers receive the same empty surface for private, missing, and
    // temporarily unavailable comment subjects.
    return NextResponse.json({ comments: [] });
  }
}

export async function POST(request: Request) {
  return executeSocialMutation(request, commentInputSchema, createComment, 201);
}
