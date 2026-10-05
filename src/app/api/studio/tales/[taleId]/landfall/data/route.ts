import { NextResponse } from "next/server";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { getDraftLandfallDefinition } from "@/landfall/definition-store";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readLandfallBoundedJson } from "@/landfall/bounded-request-body";
import { remoteDataRequestSchema } from "@/landfall/remote-data";
import { deployedLandfallRemoteData as service } from "@/landfall/remote-data-deployment-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
/** Owner/CSRF-authorized draft lookup. Only explicit text search is allowed; never saves geometry. */
export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  try {
    const { taleId } = await context.params;
    const authorization = await requireOwnedStudioTale(taleId, request);
    if (!authorization) return NextResponse.json({ error: "Chronicle unavailable." }, { status: 404, headers });
    if (
      !consumeRateLimit(`landfall-data-creator:${authorization.session.accountId}`, { limit: 12, windowMs: 60000 })
        .allowed
    )
      return NextResponse.json(
        { state: "RATE_LIMITED", canComplete: false, retryAfterSeconds: 60 },
        { status: 429, headers },
      );
    const worldId = request.headers.get("x-landfall-worldspace"),
      version = request.headers.get("x-landfall-draft-version");
    const matches = (draft: Awaited<ReturnType<typeof getDraftLandfallDefinition>>) => {
      const world = draft.definition?.worldspaces.find((item) => item.id === worldId);
      return (
        String(draft.autosaveVersion) === version &&
        world?.kind === "PHYSICAL" &&
        ["PUBLIC_REAL_WORLD", "GENERIC"].includes(world.privacyPolicy.classification)
      );
    };
    const draft = await getDraftLandfallDefinition(taleId);
    if (!matches(draft))
      return NextResponse.json({ state: "UNAVAILABLE", canComplete: false }, { status: 409, headers });
    let input;
    try {
      input = remoteDataRequestSchema.parse(await readLandfallBoundedJson(request));
      if (input.operation !== "STATUS" && (input.operation !== "SEARCH" || input.bounds || input.proximity))
        throw new Error("OPERATION_NOT_ALLOWED");
    } catch (cause) {
      return NextResponse.json(
        { error: "Online lookup request is invalid." },
        { status: cause instanceof Error && cause.message === "BODY_TOO_LARGE" ? 413 : 400, headers },
      );
    }
    const recipient = service.recipient(input.operation);
    if (recipient && request.headers.get("x-landfall-recipient") !== recipient)
      return NextResponse.json({ state: "UNAVAILABLE", canComplete: false }, { status: 409, headers });
    const result = await service.execute(input, request.signal);
    if (input.operation !== "STATUS") {
      if (!(await requireOwnedStudioTale(taleId, request)))
        return NextResponse.json({ error: "Chronicle unavailable." }, { status: 404, headers });
      const current = await getDraftLandfallDefinition(taleId);
      if (!matches(current) || current.draftId !== draft.draftId)
        return NextResponse.json({ state: "UNAVAILABLE", canComplete: false }, { status: 409, headers });
    }
    return NextResponse.json(
      result.state === "STATUS"
        ? { ...result, services: result.services.filter((item) => item.family === "GEOCODING") }
        : result,
      { headers },
    );
  } catch {
    return NextResponse.json({ state: "UNAVAILABLE", canComplete: false }, { status: 503, headers });
  }
}
