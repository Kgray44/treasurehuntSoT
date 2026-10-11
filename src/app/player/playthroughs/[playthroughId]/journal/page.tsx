import { redirect } from "next/navigation";
import { ChronicleJournalSession } from "@/components/player/journal/ChronicleJournalSession";
import { requirePlayerIdentity } from "@/platform/auth";
import { requirePilotOwner } from "@/spatial-pilot/authorization";
import { isPilotVoyage } from "@/spatial-pilot/service";
import { PilotRibbon } from "@/spatial-pilot/PilotRibbon";

export const dynamic = "force-dynamic";

export default async function PlayerJournalPage({ params }: { params: Promise<{ playthroughId: string }> }) {
  if (!(await requirePlayerIdentity())) redirect("/player/sign-in");
  const { playthroughId } = await params;
  const pilotOwner = await requirePilotOwner();
  const pilot = pilotOwner ? await isPilotVoyage(pilotOwner.accountId, playthroughId) : false;
  return (
    <>
      {pilot && <PilotRibbon voyageId={playthroughId} />}
      <ChronicleJournalSession sessionId={playthroughId} identitySession />
    </>
  );
}
