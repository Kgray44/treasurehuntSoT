import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { requireRecentPrivilegedAssurance } from "@/admiralty/assurance";
import { enforceAdmiraltyRateLimit } from "@/admiralty/http";
import { executeReachRuntimePolicy, reachRuntimePolicyCommandSchema } from "@/reach/admin-commands";
import { readReachJson, reachErrorResponse, reachPrivateHeaders } from "@/reach/http";

const schema = z.strictObject({
  input: reachRuntimePolicyCommandSchema,
  previewId: z.uuid(),
  confirmed: z.literal(true),
});
export async function POST(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("CONFIG_OPERATE", { request });
    enforceAdmiraltyRateLimit(`reach-policy-execute:${operator.accountId}`, 10, 600000);
    await requireRecentPrivilegedAssurance(operator);
    const body = await readReachJson(request, schema, 8192);
    const receipt = await executeReachRuntimePolicy(operator, body.input, body.previewId);
    return NextResponse.json({ receipt }, { headers: reachPrivateHeaders });
  } catch (cause) {
    return reachErrorResponse(cause);
  }
}
