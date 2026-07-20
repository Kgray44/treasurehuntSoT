import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { commandSchema } from "@/domain/admin";
import { logger } from "@/lib/logger";
import { requireGm, requireGmCapability, verifyCsrf } from "@/lib/security";
import { CommandConflict, CommandFailure, executeAdminCommand } from "@/server/admin-command";

export async function POST(request: Request) {
  const correlationId = randomUUID();
  let executionStarted = false;
  try {
    const session = await requireGmCapability("CAPTAIN");
    if (!session) {
      const staff = await requireGm();
      return staff
        ? NextResponse.json({ error: "Captain access is required to continue.", code: "FORBIDDEN", correlationId }, { status: 403 })
        : NextResponse.json(
            { error: "Sign in to Captain's Console to continue.", code: "UNAUTHENTICATED", correlationId },
            { status: 401 },
          );
    }
    if (!(await verifyCsrf(session)))
      return NextResponse.json(
        { error: "This confirmation expired. Refresh Captain's Console, review the action, then try again.", code: "CSRF", correlationId },
        { status: 403 },
      );
    const parsed = commandSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return NextResponse.json(
        {
          error: "This Voyage action request is incomplete. Review the action, then try again.",
          code: "VALIDATION",
          correlationId,
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    executionStarted = true;
    return NextResponse.json(await executeAdminCommand(parsed.data, session.userId, { correlationId }));
  } catch (error) {
    if (executionStarted && error instanceof CommandConflict)
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          correlationId,
        },
        { status: 409 },
      );
    const failureCorrelationId =
      executionStarted && error instanceof CommandFailure ? error.correlationId : correlationId;
    logger.error({ area: "gm-commands", correlationId: failureCorrelationId }, "GM command request failed");
    return NextResponse.json(
      {
        error: "The Voyage action could not be completed. No progress has changed. Check the current Voyage status, then try again.",
        code: "COMMAND_FAILED",
        correlationId: failureCorrelationId,
      },
      { status: 500 },
    );
  }
}
