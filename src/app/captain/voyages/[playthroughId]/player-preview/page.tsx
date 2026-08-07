import { redirect } from "next/navigation";
import { PlayerSafePreview } from "@/components/platform/PlayerSafePreview";
import { resolveCapability } from "@/homeport/current-user.server";
import { signInHref } from "@/homeport/return-to";

export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ playthroughId: string }> }) {
  const { playthroughId } = await params;
  if ((await resolveCapability("captain")).status !== "allowed")
    redirect(signInHref(`/captain/voyages/${playthroughId}/player-preview`));
  return <PlayerSafePreview playthroughId={playthroughId} />;
}
