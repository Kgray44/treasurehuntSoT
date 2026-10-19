import { NextResponse } from "next/server";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { requireRecentPrivilegedAssurance } from "@/admiralty/assurance";
import { enforceAdmiraltyRateLimit } from "@/admiralty/http";
import { previewReachRuntimePolicy, reachRuntimePolicyCommandSchema } from "@/reach/admin-commands";
import { readReachJson, reachErrorResponse, reachPrivateHeaders } from "@/reach/http";

export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("CONFIG_OPERATE", { request });
    enforceAdmiraltyRateLimit(`reach-policy-preview:${operator.accountId}`, 20, 600000);
    await requireRecentPrivilegedAssurance(operator);
    const input = await readReachJson(request, reachRuntimePolicyCommandSchema, 8192);
    return NextResponse.json(
      { preview: await previewReachRuntimePolicy(operator, input) },
      { headers: reachPrivateHeaders },
    );
  } catch (cause) {
    return reachErrorResponse(cause);
  }
}
