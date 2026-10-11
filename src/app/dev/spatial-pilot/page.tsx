import { notFound } from "next/navigation";
import { requirePilotOwner } from "@/spatial-pilot/authorization";
import { readPilot } from "@/spatial-pilot/service";
import { OwnerSeaTrials } from "@/spatial-pilot/OwnerSeaTrials";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "The Lost Navigator’s Chart · Owner Sea Trials",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function SpatialPilotPage() {
  const owner = await requirePilotOwner();
  if (!owner) notFound();
  return <OwnerSeaTrials initialPilot={await readPilot(owner.accountId)} csrfToken={owner.csrfToken} />;
}
