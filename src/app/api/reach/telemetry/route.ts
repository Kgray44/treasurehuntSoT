import { NextResponse } from "next/server";
import { enforceAdmiraltyRateLimit } from "@/admiralty/http";
import { insertReachTelemetry } from "@/reach/admin-service";
import { reachTelemetrySubmissionSchema, MAX_REACH_TELEMETRY_BYTES } from "@/reach/telemetry";
import {
  readReachJson,
  requireReachSameOriginJson,
  reachErrorResponse,
  reachPrivateHeaders,
  reachRequestAddress,
} from "@/reach/http";

export async function POST(request: Request) {
  try {
    requireReachSameOriginJson(request);
    enforceAdmiraltyRateLimit("reach-telemetry-global", 1000, 60000);
    enforceAdmiraltyRateLimit(`reach-telemetry:${reachRequestAddress(request)}`, 120, 60000);
    const submission = await readReachJson(request, reachTelemetrySubmissionSchema, MAX_REACH_TELEMETRY_BYTES);
    const result = await insertReachTelemetry(submission);
    return NextResponse.json(result, { status: result.accepted ? 202 : 409, headers: reachPrivateHeaders });
  } catch (cause) {
    return reachErrorResponse(cause);
  }
}
