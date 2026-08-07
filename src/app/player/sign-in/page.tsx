import { redirect } from "next/navigation";
import { AccessDecisionState } from "@/components/auth/AccessDecisionState";
import { PlayerSignIn } from "@/components/platform/PlayerSignIn";
import { resolveCapability } from "@/homeport/current-user.server";
import { safeReturnTo, signInHref } from "@/homeport/return-to";
import { readPendingInvitationToken } from "@/platform/auth";

export const dynamic = "force-dynamic";
export default async function PlayerSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; return?: string }>;
}) {
  const [decision, pendingInvitation, query] = await Promise.all([
    resolveCapability("player"),
    readPendingInvitationToken(),
    searchParams,
  ]);
  const destination = pendingInvitation
    ? "/player/invitation"
    : safeReturnTo(query.returnTo ?? query.return, "/player/library");
  if (decision.status === "allowed") redirect(destination);
  if (
    decision.status === "permission-denied" ||
    decision.status === "account-restricted" ||
    decision.status === "unavailable"
  )
    return <AccessDecisionState decision={decision} />;
  const reason = decision.status === "auth-required" ? "auth-required" : decision.status;
  return (
    <PlayerSignIn authenticated={false} nextHref={destination} canonicalSignInHref={signInHref(destination, reason)} />
  );
}
