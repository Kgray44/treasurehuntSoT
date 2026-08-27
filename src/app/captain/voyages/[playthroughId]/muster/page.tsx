import { redirect } from "next/navigation";
import { CaptainMusterRoom } from "@/components/captain/CaptainMusterRoom";
import { resolveCapability } from "@/homeport/current-user.server";
import { signInHref } from "@/homeport/return-to";

export const dynamic = "force-dynamic";

export default async function CaptainMusterPage({ params }: { params: Promise<{ playthroughId: string }> }) {
  const { playthroughId } = await params;
  if ((await resolveCapability("captain")).status !== "allowed")
    redirect(signInHref(`/captain/voyages/${playthroughId}/muster`));
  return <CaptainMusterRoom voyageId={playthroughId} />;
}
