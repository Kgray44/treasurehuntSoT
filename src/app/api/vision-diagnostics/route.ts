import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/tall-tale/api";
import { resolveVisionFeatureFlags } from "@/vision/feature-flags";
import { requireVisionPermission } from "@/vision/permissions";
import { VISION_PROTOCOL_VERSION } from "@/vision/protocol";

export async function GET(request: Request) {
  try {
    const captain = await requireVisionPermission("visionWaypoint.viewDiagnostics");
    if (!captain) return NextResponse.json({ error: "Captain authentication required." }, { status: 401 });
    const sessionId = new URL(request.url).searchParams.get("sessionId");
    if (sessionId) {
      const authorized = await db.taleSession.findFirst({
        where: { id: sessionId, OR: [{ captainId: captain.userId }, { captainId: null }] },
        select: { id: true },
      });
      if (!authorized) return NextResponse.json({ error: "Captain session access required." }, { status: 403 });
    }
    return NextResponse.json({
      appVersion: "0.3.0-b1",
      buildId: process.env.BUILD_ID ?? process.env.GIT_SHA ?? "development",
      platform: process.env.TALL_TALE_DESKTOP === "1" ? "DESKTOP_SERVER" : "WEB_SERVER",
      adapterSelection: "renderer-capability-detected",
      protocolVersion: VISION_PROTOCOL_VERSION,
      packageSchemaVersion: 1,
      featureFlags: resolveVisionFeatureFlags(),
      desktopShellVersion: "0.3.0-b1",
      pwa: { serviceWorkerVersion: "forever-treasure-b1-v1", mutableApiCache: false },
      apiCompatibility: { visionProtocol: ["1.0"], packageSchemas: [1] },
      sessionId,
    });
  } catch (cause) {
    return apiError(cause);
  }
}
