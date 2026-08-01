import Link from "next/link";
import { redirect } from "next/navigation";
import { AccessDecisionState } from "@/components/auth/AccessDecisionState";
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
  return (
    <main>
      <h1>Your Voyagewright workspaces</h1>
      <p>One account carries every role you have been granted.</p>
      <nav aria-label="Role destinations">
        {context.capabilities.canUsePlayer ? <Link href="/player/library">Player voyages</Link> : null}
        {context.capabilities.canUseCaptain ? <Link href="/captain/library">Captain voyages</Link> : null}
        {context.capabilities.canUseCreator ? <Link href="/studio/library">Creator Studio</Link> : null}
        <Link href="/community">Community Harbor</Link>
      </nav>
    </main>
  );
}
