import { redirect } from "next/navigation";
import { PlayerSafePreview } from "@/components/platform/PlayerSafePreview";
import { requireGmCapability } from "@/lib/security";

export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ playthroughId: string }> }) {
  if (!(await requireGmCapability("CAPTAIN"))) redirect("/captain/sign-in");
  return <PlayerSafePreview playthroughId={(await params).playthroughId} />;
}
