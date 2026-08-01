import { redirect } from "next/navigation";
import { AccessDecisionState } from "@/components/auth/AccessDecisionState";
import { AccountFlow } from "@/components/wayfarer/AccountFlow";
import { decideCapability } from "@/homeport/current-user";
import { resolveCurrentUser } from "@/homeport/current-user.server";
import { signInHref } from "@/homeport/return-to";

export const dynamic = "force-dynamic";
export default async function AccountSecurityPage() {
  const context = await resolveCurrentUser();
  if (context.status === "authenticated") return <AccountFlow mode="security" />;
  const decision = decideCapability(context, "player");
  if (
    decision.status === "auth-required" ||
    decision.status === "expired" ||
    decision.status === "revoked" ||
    decision.status === "invalid"
  )
    redirect(signInHref("/account/security", decision.status));
  return <AccessDecisionState decision={decision} />;
}
