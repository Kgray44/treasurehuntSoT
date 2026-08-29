import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getPlayerArchive } from "@/platform/libraries";
import { requireWayfarerAccount } from "@/wayfarer/http";

export const dynamic = "force-dynamic";

/**
 * P4 is a presentation handoff, never a new Voyage. The canonical Player
 * archive reader verifies both the owner membership and completed state before
 * we enter Lanternwake's read-only historical journal.
 */
export default async function PassportHistoryReplayPage({ params }: { params: Promise<{ recordId: string }> }) {
  const session = await requireWayfarerAccount();
  const playerProfileId = session?.account.profile?.id;
  if (!playerProfileId) notFound();

  const { recordId } = await params;
  const record = await db.playerChronicleRecord.findFirst({
    where: { id: recordId, playerProfileId },
    select: { sourcePlaythroughId: true },
  });
  if (!record) notFound();

  const archive = await getPlayerArchive(playerProfileId, record.sourcePlaythroughId);
  if (!archive) notFound();

  redirect(`/player/playthroughs/${encodeURIComponent(record.sourcePlaythroughId)}/journal`);
}
