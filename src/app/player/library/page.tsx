import { redirect } from "next/navigation";
import { AccessDecisionState } from "@/components/auth/AccessDecisionState";
import { PlayerLibrary } from "@/components/platform/PlayerLibrary";
import { resolveCapability } from "@/homeport/current-user.server";
import { signInHref } from "@/homeport/return-to";

export const dynamic = "force-dynamic";
export default async function PlayerLibraryPage() {
  const decision = await resolveCapability("player");
  if (decision.status === "allowed") return <PlayerLibrary />;
  if (
    decision.status === "auth-required" ||
    decision.status === "expired" ||
    decision.status === "revoked" ||
    decision.status === "invalid"
  )
    redirect(signInHref("/player/library", decision.status));
  return <AccessDecisionState decision={decision} />;
}
