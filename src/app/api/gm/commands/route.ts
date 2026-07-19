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
        ? NextResponse.json({ error: "Captain authority required.", code: "FORBIDDEN", correlationId }, { status: 403 })
        : NextResponse.json(
            { error: "Authentication required.", code: "UNAUTHENTICATED", correlationId },
            { status: 401 },
          );
    }
    if (!(await verifyCsrf(session)))
      return NextResponse.json(
        { error: "The confirmation token expired. Refresh the Command Center.", code: "CSRF", correlationId },
        { status: 403 },
      );
    const parsed = commandSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return NextResponse.json(
        { error: "The command request is incomplete.", code: "VALIDATION", correlationId, issues: parsed.error.issues },
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
      { error: "The command could not be completed.", code: "COMMAND_FAILED", correlationId: failureCorrelationId },
      { status: 500 },
    );
  }
}
