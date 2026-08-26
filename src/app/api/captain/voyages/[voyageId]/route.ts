import { NextResponse } from "next/server";
import { requireCaptainSession } from "@/chronicle/captain-authorization";
import { getCaptainVoyageProjection } from "@/helm/operations";

export async function GET(_: Request, context: { params: Promise<{ voyageId: string }> }) {
  const voyageId = (await context.params).voyageId;
  const authorization = await requireCaptainSession(voyageId);
  if (!authorization)
    return NextResponse.json(
      { error: "This Voyage is unavailable. Return to Captain's Console and choose another Voyage." },
      { status: 403 },
    );
  const projection = await getCaptainVoyageProjection(voyageId, authorization.actor);
  if (!projection) return NextResponse.json({ error: "This Voyage is unavailable." }, { status: 403 });
  return NextResponse.json({ ...projection, csrfToken: authorization.session.csrfToken });
}
