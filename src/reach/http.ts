import type { z } from "zod";
import { AdmiraltyError } from "@/admiralty/errors";
import { admiraltyErrorResponse } from "@/admiralty/http";

export const reachPrivateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};
export function reachRequestAddress(request: Request) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return /^[a-f0-9:.]{1,64}$/iu.test(address) ? address : "local";
}
export function requireReachSameOriginJson(request: Request) {
  const origin = request.headers.get("Origin");
  if (
    !origin ||
    origin !== new URL(request.url).origin ||
    (request.headers.has("Sec-Fetch-Site") && request.headers.get("Sec-Fetch-Site") !== "same-origin")
  )
    throw new AdmiraltyError("ADMIRALTY_CSRF_INVALID", "A same-origin request is required.", 403);
  if (request.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "Use an application/json request.", 415);
}
export async function readReachJson<T>(request: Request, schema: z.ZodType<T>, maximumBytes = 32768) {
  requireReachSameOriginJson(request);
  const declared = request.headers.get("Content-Length");
  if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > maximumBytes))
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "The request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "A JSON body is required.", 400);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maximumBytes) {
        await reader.cancel();
        throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "The request is too large.", 413);
      }
      chunks.push(part.value);
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return schema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)));
  } catch (cause) {
    if (cause instanceof AdmiraltyError) throw cause;
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "The request was not valid.", 400);
  } finally {
    reader.releaseLock();
  }
}
export function reachErrorResponse(cause: unknown) {
  const response = admiraltyErrorResponse(cause);
  for (const [key, value] of Object.entries(reachPrivateHeaders)) response.headers.set(key, value);
  return response;
}
