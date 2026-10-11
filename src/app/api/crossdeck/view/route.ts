import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { objectRefSchema, objectKey } from "@/crossdeck/sync-contracts";
import { createCrossdeckSyncService } from "@/crossdeck/sync-service";
import { resolveCrossdeckObject } from "@/crossdeck/objects";
import { surface } from "@/crossdeck/service";
import { CrossdeckError } from "@/crossdeck/contracts";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" };
export async function GET(request: Request) {
  try {
    const actor = await requireWayfarerAccount();
    if (!actor) return NextResponse.json({ error: "Sign in to open this view." }, { status: 401, headers });
    const query = new URL(request.url).searchParams;
    const voyage = z.string().min(1).max(191).parse(query.get("voyage"));
    const id = z.string().uuid().parse(query.get("surface"));
    const ref = objectRefSchema.parse({
      family: query.get("family"),
      objectId: query.get("object"),
      version: query.get("version"),
    });
    const snapshot = await createCrossdeckSyncService(db).read(actor, voyage, id);
    const p = snapshot.presentations.find(
      (p) => objectKey(p.object) === objectKey(ref) && p.object.version === ref.version,
    );
    if (!p) throw new CrossdeckError(403, "This view is unavailable.");
    const view = await db.$transaction(async (tx) => {
      const own = await surface(tx, actor, id, new Date());
      const resolved = await resolveCrossdeckObject(tx, actor, voyage, ref, p.context);
      if (own.role === "SHARED_CREW_DISPLAY" && resolved.visibility !== "CREW")
        throw new CrossdeckError(403, "This view is personal.");
      // Crew displays receive only the approved reading payload, never account or progression controls.
      const configuration = resolved.block.configuration;
      const text = [configuration.text, configuration.body, configuration.message, configuration.description]
        .filter((v): v is string => typeof v === "string")
        .join("\n\n")
        .slice(0, 12000);
      return { title: resolved.title, family: ref.family, text, context: p.context, scene: resolved.scene };
    });
    return NextResponse.json(view, { headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof CrossdeckError ? error.message : "This view could not open." },
      { status: error instanceof CrossdeckError ? error.status : error instanceof z.ZodError ? 400 : 503, headers },
    );
  }
}
