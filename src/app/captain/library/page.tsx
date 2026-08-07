import { redirect } from "next/navigation";
import { AccessDecisionState } from "@/components/auth/AccessDecisionState";
import { CaptainLibrary } from "@/components/platform/CaptainLibrary";
import { resolveCapability } from "@/homeport/current-user.server";
import { signInHref } from "@/homeport/return-to";

export const dynamic = "force-dynamic";
export default async function CaptainLibraryPage() {
  const decision = await resolveCapability("captain");
  if (decision.status === "allowed") return <CaptainLibrary />;
  if (
    decision.status === "auth-required" ||
    decision.status === "expired" ||
    decision.status === "revoked" ||
    decision.status === "invalid"
  )
    redirect(signInHref("/captain/library", decision.status));
  return <AccessDecisionState decision={decision} />;
}
