import { ChronicleJournalSession } from "@/components/player/journal/ChronicleJournalSession";
import { authorizeTaleSessionPlayer } from "@/platform/auth";
export const dynamic = "force-dynamic";
export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const access = await authorizeTaleSessionPlayer(sessionId);
  return <ChronicleJournalSession sessionId={sessionId} identitySession={access?.kind === "identity"} />;
}
