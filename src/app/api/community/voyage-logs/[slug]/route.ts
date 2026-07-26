import { NextResponse } from "next/server";
import { z } from "zod";

import { readVoyageLogForViewer } from "@/community/voyage-log-public";
import { requireCanonicalAccountIdentity } from "@/platform/auth";

const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const parsed = slugSchema.safeParse((await context.params).slug);
  if (!parsed.success)
    return NextResponse.json(
      { code: "COMMUNITY_VOYAGE_LOG_NOT_FOUND", error: "Voyage Log not found." },
      { status: 404 },
    );
  try {
    const identity = await requireCanonicalAccountIdentity();
    const log = await readVoyageLogForViewer(parsed.data, identity?.accountId);
    return log
      ? NextResponse.json(log)
      : NextResponse.json({ code: "COMMUNITY_VOYAGE_LOG_NOT_FOUND", error: "Voyage Log not found." }, { status: 404 });
  } catch {
    return NextResponse.json(
      { code: "COMMUNITY_PUBLIC_READ_UNAVAILABLE", error: "Public Voyage Logs are temporarily unavailable." },
      { status: 503 },
    );
  }
}
