import { redirect } from "next/navigation";
import { ChronicleJournalSession } from "@/components/player/journal/ChronicleJournalSession";
import { requirePlayerIdentity } from "@/platform/auth";
import { requirePilotOwner } from "@/spatial-pilot/authorization";
import { isPilotVoyage } from "@/spatial-pilot/service";
import { PilotRibbon } from "@/spatial-pilot/PilotRibbon";
import styles from "@/spatial-pilot/pilot.module.css";

export const dynamic = "force-dynamic";

export default async function PlayerJournalPage({ params }: { params: Promise<{ playthroughId: string }> }) {
  if (!(await requirePlayerIdentity())) redirect("/player/sign-in");
  const { playthroughId } = await params;
  const pilotOwner = await requirePilotOwner();
  const pilot = pilotOwner ? await isPilotVoyage(pilotOwner.accountId, playthroughId) : false;
  const journal = (
    <ChronicleJournalSession
      sessionId={playthroughId}
      identitySession
      instruments={pilot ? <PilotRibbon voyageId={playthroughId} /> : undefined}
    />
  );
  return pilot ? <div className={styles.journal}>{journal}</div> : journal;
}
