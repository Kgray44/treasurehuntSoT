import { redirect } from "next/navigation";
import { AccessDecisionState } from "@/components/auth/AccessDecisionState";
import { RoleEntryAdapter } from "@/components/auth/RoleEntryAdapter";
import { resolveCapability } from "@/homeport/current-user.server";
import { safeReturnTo, signInHref } from "@/homeport/return-to";

export const dynamic = "force-dynamic";
export default async function StudioSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; return?: string }>;
}) {
  const query = await searchParams;
  const destination = safeReturnTo(query.returnTo ?? query.return, "/studio/library");
  const decision = await resolveCapability("creator");
  if (decision.status === "allowed") redirect(destination);
  if (
    decision.status === "permission-denied" ||
    decision.status === "account-restricted" ||
    decision.status === "unavailable"
  )
    return <AccessDecisionState decision={decision} />;
  const reason = decision.status === "auth-required" ? "auth-required" : decision.status;
  return (
    <RoleEntryAdapter
      title="Open Voyagewright Studio"
      description="Creator permission is checked from your current Voyagewright account. No second staff password is required."
      signInHref={signInHref(destination, reason)}
    />
  );
}
