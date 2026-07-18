import { redirect } from "next/navigation";
import { TallTaleJournalSession } from "@/components/player/journal/TallTaleJournalSession";
import { requirePlayerIdentity } from "@/platform/auth";

export const dynamic = "force-dynamic";

export default async function PlayerJournalLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ playthroughId: string }> }>) {
  if (!(await requirePlayerIdentity())) redirect("/player/sign-in");
  const { playthroughId } = await params;
  return (
    <>
      <TallTaleJournalSession
        sessionId={playthroughId}
        identitySession
        routeBase={`/player/playthroughs/${encodeURIComponent(playthroughId)}/journal`}
      />
      {children}
    </>
  );
}
