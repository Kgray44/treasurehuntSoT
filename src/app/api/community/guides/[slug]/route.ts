import { NextResponse } from "next/server";

import { db } from "@/lib/db";

const publicGuideWhere = {
  status: "PUBLISHED",
  publishedAt: { not: null },
  deprecatedAt: null,
} as const;

const guideDetailSelect = {
  slug: true,
  title: true,
  safeSummary: true,
  sanitizedBody: true,
  category: true,
  publishedAt: true,
  updatedAt: true,
} as const;

/** A missing, draft, or deprecated Guide has the same safe public response. */
export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const guide = await db.communityGuideContent.findFirst({
    where: { ...publicGuideWhere, slug },
    select: guideDetailSelect,
  });
  return guide
    ? NextResponse.json(guide)
    : NextResponse.json({ code: "COMMUNITY_GUIDE_NOT_FOUND", error: "Guide not found." }, { status: 404 });
}
