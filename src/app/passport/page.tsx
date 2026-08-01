import { redirect } from "next/navigation";
import { AccessDecisionState } from "@/components/auth/AccessDecisionState";
import { ChroniclePassport } from "@/components/wayfarer/ChroniclePassport";
import { resolveCapability } from "@/homeport/current-user.server";
import { signInHref } from "@/homeport/return-to";

export const dynamic = "force-dynamic";
export default async function PassportPage() {
  const decision = await resolveCapability("player");
  if (decision.status === "allowed") return <ChroniclePassport />;
  if (
    decision.status === "auth-required" ||
    decision.status === "expired" ||
    decision.status === "revoked" ||
    decision.status === "invalid"
  )
    redirect(signInHref("/passport", decision.status));
  return <AccessDecisionState decision={decision} />;
}
