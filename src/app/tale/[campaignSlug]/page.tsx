import { AccessGate } from "@/components/player/AccessGate";
import { PlayerExperience } from "@/components/player/PlayerExperience";
import { requirePlayer } from "@/lib/security";
import { buildPublicSnapshot } from "@/lib/snapshot";
export const dynamic = "force-dynamic";
export default async function TalePage({ params }: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await params; const access = await requirePlayer(campaignSlug);
  if (!access) return <AccessGate campaignSlug={campaignSlug}/>;
  return <PlayerExperience initialSnapshot={await buildPublicSnapshot(access.campaignId)}/>;
}
