import { NextResponse } from "next/server";
import { getMusterProjection } from "@/muster/service";
import { musterIdentity, musterError } from "@/muster/http";
export async function GET(_: Request, context: { params: Promise<{ voyageId: string }> }) {
  try {
    const { actor, session } = await musterIdentity();
    return NextResponse.json(
      { ...(await getMusterProjection((await context.params).voyageId, actor)), csrfToken: session.csrfToken },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return musterError(cause);
  }
}
