import { TallTaleJournalSession } from "@/components/player/journal/TallTaleJournalSession";
export const dynamic = "force-dynamic";
export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  return <TallTaleJournalSession sessionId={(await params).sessionId} />;
}
