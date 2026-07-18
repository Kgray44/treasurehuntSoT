import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/tall-tale/api";
import { resolveVisionFeatureFlags } from "@/vision/feature-flags";
import { requireVisionPermission } from "@/vision/permissions";
import { VISION_PROTOCOL_VERSION } from "@/vision/protocol";
import {
  VISION_APPLICATION_VERSION,
  VISION_RELEASE_CHANNEL,
  VISION_RUNTIME_PACKAGE_SCHEMA_VERSION,
  VISION_SERVER_API_VERSION,
} from "@/vision/versions";

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
      appVersion: VISION_APPLICATION_VERSION,
      buildId: process.env.BUILD_ID ?? process.env.GIT_SHA ?? "development",
      platform: process.env.TALL_TALE_DESKTOP === "1" ? "DESKTOP_SERVER" : "WEB_SERVER",
      adapterSelection: "renderer-capability-detected",
      protocolVersion: VISION_PROTOCOL_VERSION,
      packageSchemaVersion: VISION_RUNTIME_PACKAGE_SCHEMA_VERSION,
      featureFlags: resolveVisionFeatureFlags(),
      desktopShellVersion: VISION_APPLICATION_VERSION,
      serverApiVersion: VISION_SERVER_API_VERSION,
      updateChannel: process.env.VISION_RELEASE_CHANNEL ?? VISION_RELEASE_CHANNEL,
      signingStatus: process.env.VISION_SIGNING_STATUS ?? "UNSIGNED_DEVELOPMENT",
      pwa: { serviceWorkerVersion: "forever-treasure-b1-v1", mutableApiCache: false },
      apiCompatibility: { visionProtocol: ["1.0", "2.0"], packageSchemas: [VISION_RUNTIME_PACKAGE_SCHEMA_VERSION] },
      sessionId,
    });
  } catch (cause) {
    return apiError(cause);
  }
}
