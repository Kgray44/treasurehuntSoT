import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PlayerJournalPage({ params }: { params: Promise<{ playthroughId: string }> }) {
  redirect(`/player/playthroughs/${encodeURIComponent((await params).playthroughId)}/journal/chapters`);
}
