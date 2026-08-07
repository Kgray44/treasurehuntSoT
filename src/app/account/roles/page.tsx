import { redirect } from "next/navigation";
import { AccessDecisionState } from "@/components/auth/AccessDecisionState";
import { WorkspaceCapabilityDashboard } from "@/components/homeport/WorkspaceCapabilityDashboard";
import { decideCapability } from "@/homeport/current-user";
import { resolveCurrentUser } from "@/homeport/current-user.server";
import { signInHref } from "@/homeport/return-to";

export const dynamic = "force-dynamic";
export default async function AccountRolesPage() {
  const context = await resolveCurrentUser();
  if (context.status !== "authenticated") {
    const decision = decideCapability(context, "player");
    if (
      decision.status === "auth-required" ||
      decision.status === "expired" ||
      decision.status === "revoked" ||
      decision.status === "invalid"
    )
      redirect(signInHref("/account/roles", decision.status));
    return <AccessDecisionState decision={decision} />;
  }
  return <WorkspaceCapabilityDashboard />;
}
