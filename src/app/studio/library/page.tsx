import { redirect } from "next/navigation";
import { AccessDecisionState } from "@/components/auth/AccessDecisionState";
import { StudioHome } from "@/components/studio/StudioHome";
import { resolveCapability } from "@/homeport/current-user.server";
import { signInHref } from "@/homeport/return-to";

export const dynamic = "force-dynamic";
export default async function StudioLibraryPage() {
  const decision = await resolveCapability("creator");
  if (decision.status === "allowed") return <StudioHome authenticated />;
  if (
    decision.status === "auth-required" ||
    decision.status === "expired" ||
    decision.status === "revoked" ||
    decision.status === "invalid"
  )
    redirect(signInHref("/studio/library", decision.status));
  return <AccessDecisionState decision={decision} />;
}
