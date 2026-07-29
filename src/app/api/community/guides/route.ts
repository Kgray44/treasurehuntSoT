import { NextResponse } from "next/server";

import { db } from "@/lib/db";

const publicGuideWhere = {
  status: "PUBLISHED",
  publishedAt: { not: null },
  deprecatedAt: null,
} as const;

const guideListSelect = {
  slug: true,
  title: true,
  safeSummary: true,
  category: true,
  publishedAt: true,
  updatedAt: true,
} as const;

/** Only persisted, published, non-deprecated Guides receive a public projection. */
export async function GET() {
  const guides = await db.communityGuideContent.findMany({
    where: publicGuideWhere,
    select: guideListSelect,
    orderBy: [{ publishedAt: "desc" }, { slug: "asc" }],
    take: 48,
  });
  return NextResponse.json({ guides });
}
