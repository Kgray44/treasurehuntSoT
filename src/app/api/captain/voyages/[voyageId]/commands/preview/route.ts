import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCaptainSession } from "@/chronicle/captain-authorization";
import { captainConsoleCommandIds, findCaptainConsoleCommand } from "@/helm/command-console";
import { getCaptainVoyageProjection } from "@/helm/operations";

const previewSchema = z.object({
  commandId: z.enum(captainConsoleCommandIds),
  targetBlockId: z.string().min(1).max(191).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ voyageId: string }> }) {
  const voyageId = (await context.params).voyageId;
  const authorization = await requireCaptainSession(voyageId);
  if (!authorization)
    return NextResponse.json(
      { error: "This Voyage is unavailable. Return to Captain's Console and choose another Voyage." },
      { status: 403 },
    );
  const parsed = previewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "This command preview is incomplete. Refresh the Voyage and try again." },
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
  const target = parsed.data.targetBlockId
    ? (projection.commandConsole.progressMap.find((node) => node.id === parsed.data.targetBlockId) ?? null)
    : null;
  if (command.target === "PASSAGE" && (!target || target.state === "CURRENT"))
    return NextResponse.json({ error: "Choose a different published Passage before continuing." }, { status: 400 });
  return NextResponse.json({
    command,
    target,
    currentState: {
      voyageName: projection.voyage.voyageName,
      lifecycle: projection.voyage.lifecycle,
      expectedSequence: projection.progress.currentSequence,
      chapter: projection.progress.currentChapter,
      passage: projection.progress.currentCheckpoint,
    },
  });
}
