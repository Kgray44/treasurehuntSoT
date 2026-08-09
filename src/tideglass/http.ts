import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { requireStudioWorkspace } from "@/chronicle/studio-authorization";

export type TideglassAuthorizedCreator = NonNullable<Awaited<ReturnType<typeof requireStudioWorkspace>>>;
export type TideglassRateLimitClass = "comparison-read" | "annotation-mutation" | "projection-preview";

const tideglassRatePolicies: Record<TideglassRateLimitClass, { limit: number; windowMs: number }> = {
  "comparison-read": { limit: 30, windowMs: 60_000 },
  "annotation-mutation": { limit: 12, windowMs: 10 * 60_000 },
  "projection-preview": { limit: 45, windowMs: 60_000 },
};

export async function requireTideglassCreatorChronicle(
  chronicleId: string,
  request?: Request,
): Promise<TideglassAuthorizedCreator | null> {
  const session = await requireStudioWorkspace(request);
  if (!session) return null;
  const collaborator = session.account.roles.some(
    (assignment) =>
      assignment.role === "CREATOR" &&
      assignment.revokedAt === null &&
      ["CHRONICLE", "TALE"].includes(assignment.scopeType) &&
      assignment.scopeId === chronicleId,
  );
  const legacyCreatorId = session.account.legacyGameMasterId;
  const chronicle = await db.chronicle.findFirst({
    where: {
      id: chronicleId,
      ...(collaborator
        ? {}
        : {
            OR: [
              { creatorAccountId: session.accountId },
              { creatorId: session.accountId },
              ...(legacyCreatorId ? [{ creatorId: legacyCreatorId }] : []),
            ],
          }),
    },
    select: { id: true },
  });
  return chronicle ? session : null;
}

export function enforceTideglassRateLimit(policy: TideglassRateLimitClass, accountId: string, chronicleId: string) {
  const result = consumeRateLimit(`tideglass:${policy}:${accountId}:${chronicleId}`, tideglassRatePolicies[policy]);
  return result.allowed
    ? { ok: true as const, headers: rateLimitHeaders(result) }
    : {
        ok: false as const,
        response: NextResponse.json(
          {
            code: "TIDEGLASS_RATE_LIMITED",
            error: "Tideglass is temporarily rate limited. Wait before trying again.",
            correlationId: randomUUID(),
          },
          { status: 429, headers: rateLimitHeaders(result) },
        ),
      };
}

export async function parseBoundedTideglassJson(request: Request, maximumBytes = 16 * 1024) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maximumBytes) throw new Error("TIDEGLASS_REQUEST_TOO_LARGE");
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > maximumBytes) throw new Error("TIDEGLASS_REQUEST_TOO_LARGE");
  return JSON.parse(raw) as unknown;
}

export function tideglassUnavailable(correlationId: string = randomUUID()) {
  return NextResponse.json(
    { code: "TIDEGLASS_UNAVAILABLE", error: "This Chronicle or edition pair is unavailable.", correlationId },
    { status: 404 },
  );
}

export function tideglassSafeError(cause: unknown, correlationId = randomUUID()) {
  const code =
    cause instanceof Error && cause.message === "TIDEGLASS_REQUEST_TOO_LARGE"
      ? "TIDEGLASS_REQUEST_TOO_LARGE"
      : "TIDEGLASS_REQUEST_INVALID";
  return NextResponse.json(
    {
      code,
      error:
        code === "TIDEGLASS_REQUEST_TOO_LARGE"
          ? "The Tideglass request is too large."
          : "The Tideglass request is invalid.",
      correlationId,
    },
    { status: code === "TIDEGLASS_REQUEST_TOO_LARGE" ? 413 : 400 },
  );
}
