import { NextResponse } from "next/server";
import { getMusterProjection } from "@/muster/service";
import { musterIdentity, musterError } from "@/muster/http";
import { arrivalFor } from "@/muster/arrival";
export async function GET(_: Request, context: { params: Promise<{ voyageId: string }> }) {
  try {
    const { actor, session } = await musterIdentity();
    const voyageId = (await context.params).voyageId;
    const projection = await getMusterProjection(voyageId, actor);
    return NextResponse.json(
      { ...projection, arrival: await arrivalFor(voyageId, actor), csrfToken: session.csrfToken },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    return musterError(cause);
  }
}
