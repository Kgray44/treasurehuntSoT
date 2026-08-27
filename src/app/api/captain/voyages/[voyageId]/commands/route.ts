import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/chronicle/api";
import { requireCaptainSession } from "@/chronicle/captain-authorization";
import { CaptainCommandConflictError, captainSessionAction } from "@/chronicle/progression";
import { captainConsoleCommandIds, findCaptainConsoleCommand } from "@/helm/command-console";
import { getCaptainVoyageProjection } from "@/helm/operations";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { verifyWayfarerCsrf } from "@/wayfarer/http";

const commandSchema = z.object({
  commandId: z.enum(captainConsoleCommandIds),
  targetBlockId: z.string().min(1).max(191).optional(),
  expectedSequence: z.number().int().nonnegative(),
  idempotencyKey: z.string().trim().min(12).max(191),
  confirmed: z.boolean(),
  reason: z.string().trim().min(1).max(500).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ voyageId: string }> }) {
  const voyageId = (await context.params).voyageId;
  const authorization = await requireCaptainSession(voyageId);
  if (!authorization)
    return NextResponse.json(
      { error: "This Voyage is unavailable. Return to Captain's Console and choose another Voyage." },
      { status: 403 },
    );
  if (!verifyWayfarerCsrf(authorization.session, request))
    return NextResponse.json(
      { error: "Your Captain session expired. Sign in again; no Voyage progress has changed." },
      { status: 403 },
    );
  const rate = consumeRateLimit(`tale-captain:${authorization.session.accountId}`, { limit: 60, windowMs: 60_000 });
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many Captain actions were requested. Wait a moment, review the Voyage status, then try again." },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  const parsed = commandSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "This command is incomplete. Refresh the Voyage and review the action again." },
      { status: 400 },
    );

  const projection = await getCaptainVoyageProjection(voyageId, authorization.actor);
  if (!projection) return NextResponse.json({ error: "This Voyage is unavailable." }, { status: 403 });
  const command = findCaptainConsoleCommand(projection.commandConsole.commands, parsed.data.commandId);
  if (!command)
    return NextResponse.json(
      {
        error:
          "This command is no longer available for the current Voyage state. Refresh current state before continuing.",
      },
      { status: 409 },
    );
  if (command.requiresConfirmation && !parsed.data.confirmed)
    return NextResponse.json(
      { error: "Review and confirm this meaningful Voyage action before it can run." },
      { status: 400 },
    );
  if (command.requiresReason && !parsed.data.reason)
    return NextResponse.json({ error: "A short Captain reason is required for this action." }, { status: 400 });
  if (
    command.target === "PASSAGE" &&
    (!parsed.data.targetBlockId ||
      parsed.data.targetBlockId ===
        projection.commandConsole.progressMap.find((node) => node.state === "CURRENT")?.id ||
      !projection.commandConsole.progressMap.some((node) => node.id === parsed.data.targetBlockId))
  )
    return NextResponse.json({ error: "Choose a different published Passage before continuing." }, { status: 400 });

  try {
    const result = await captainSessionAction(voyageId, authorization.session.accountId, {
      action: command.action,
      reason: parsed.data.reason,
      targetBlockId: parsed.data.targetBlockId,
      idempotencyKey: parsed.data.idempotencyKey,
      expectedSequence: parsed.data.expectedSequence,
    });
    return NextResponse.json({
      result,
      command: command.id,
      message: `${command.label} was recorded from the current authoritative Voyage state.`,
    });
  } catch (cause) {
    if (cause instanceof CaptainCommandConflictError)
      return NextResponse.json({ error: cause.message, code: "STALE_SEQUENCE" }, { status: 409 });
    return apiError(cause);
  }
}
