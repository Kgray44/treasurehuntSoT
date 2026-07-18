import { redirect } from "next/navigation";
import { PlayerVoyageRoom } from "@/components/platform/PlayerVoyageRoom";
import { requirePlayerIdentity } from "@/platform/auth";

export const dynamic = "force-dynamic";
export default async function PlayerPlaythroughPage({ params }: { params: Promise<{ playthroughId: string }> }) {
  if (!(await requirePlayerIdentity())) redirect(`/player/sign-in`);
  return <PlayerVoyageRoom playthroughId={(await params).playthroughId} />;
}
