import { ChronicleJournalSession } from "@/components/player/journal/ChronicleJournalSession";
export const dynamic = "force-dynamic";
export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  return <ChronicleJournalSession sessionId={(await params).sessionId} />;
}
