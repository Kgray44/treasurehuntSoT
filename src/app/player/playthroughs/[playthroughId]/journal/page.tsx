import { redirect } from "next/navigation";
import { ChronicleJournalSession } from "@/components/player/journal/ChronicleJournalSession";
import { requirePlayerIdentity } from "@/platform/auth";

export const dynamic = "force-dynamic";

export default async function PlayerJournalPage({ params }: { params: Promise<{ playthroughId: string }> }) {
  if (!(await requirePlayerIdentity())) redirect("/player/sign-in");
  return <ChronicleJournalSession sessionId={(await params).playthroughId} identitySession />;
}
