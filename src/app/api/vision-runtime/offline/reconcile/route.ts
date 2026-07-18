import { NextResponse } from "next/server";
import { authorizeTaleSessionPlayer, verifyPlayerCsrf } from "@/platform/auth";
import { apiError } from "@/tall-tale/api";
import { reconcileOfflineRuntimeEvents } from "@/vision/runtime-attempts";
import { offlineReconciliationSchema } from "@/vision/runtime-contract";
import { requireVisionFeature } from "@/vision/feature-flags";

export async function POST(request: Request) {
  try {
    requireVisionFeature("vision_offline_reconciliation");
    const input = offlineReconciliationSchema.parse(await request.json());
    const access = await authorizeTaleSessionPlayer(input.sessionId);
    if (!access) return NextResponse.json({ error: "Voyage session required." }, { status: 401 });
    if (access.kind === "identity" && !(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
      return NextResponse.json({ error: "The Player session expired." }, { status: 403 });
    return NextResponse.json(await reconcileOfflineRuntimeEvents(input));
  } catch (cause) {
    return apiError(cause);
  }
}
