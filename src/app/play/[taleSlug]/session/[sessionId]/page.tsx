import { PlayerRuntime } from "@/components/tales/PlayerRuntime";
export const dynamic = "force-dynamic";
export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  return <PlayerRuntime sessionId={(await params).sessionId} />;
}
