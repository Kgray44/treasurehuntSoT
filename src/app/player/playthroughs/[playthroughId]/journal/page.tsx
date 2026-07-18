import { redirect } from "next/navigation";
import { TallTaleJournalSession } from "@/components/player/journal/TallTaleJournalSession";
import { requirePlayerIdentity } from "@/platform/auth";

export const dynamic = "force-dynamic";

export default async function PlayerJournalPage({ params }: { params: Promise<{ playthroughId: string }> }) {
  if (!(await requirePlayerIdentity())) redirect("/player/sign-in");
  return <TallTaleJournalSession sessionId={(await params).playthroughId} identitySession />;
}
