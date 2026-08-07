import { NextResponse } from "next/server";
import { z } from "zod";
import {
  activateWorkspaceCapability,
  leaveActivePlayerChronicles,
  workspaceCapabilityOverview,
  WorkspaceCapabilityError,
} from "@/homeport/workspace-capabilities";
import { requireWayfarerAccount } from "@/wayfarer/http";

function errorResponse(cause: unknown) {
  if (cause instanceof z.ZodError || cause instanceof SyntaxError)
    return NextResponse.json({ error: "The workspace request is invalid." }, { status: 400 });
  if (cause instanceof WorkspaceCapabilityError)
    return NextResponse.json(
      { error: cause.message, code: `HOMEPORT_WORKSPACE_${cause.code}` },
      { status: cause.code === "FORBIDDEN" ? 403 : cause.code === "CONFLICT" ? 409 : 400 },
    );
  return NextResponse.json({ error: "Workspace state is unavailable." }, { status: 500 });
}

export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  try {
    return NextResponse.json(await workspaceCapabilityOverview(session.accountId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    return errorResponse(cause);
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ACTIVATE"), target: z.enum(["CAPTAIN", "CREATOR"]) }).strict(),
  z
    .object({ action: z.literal("LEAVE_ACTIVE_CHRONICLES"), confirmation: z.literal("LEAVE ACTIVE CHRONICLES") })
    .strict(),
]);

export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const input = actionSchema.parse(await request.json());
    const result =
      input.action === "ACTIVATE"
        ? await activateWorkspaceCapability(session.accountId, input.target)
        : await leaveActivePlayerChronicles(session.accountId, input.confirmation);
    return NextResponse.json(result);
  } catch (cause) {
    return errorResponse(cause);
  }
}
