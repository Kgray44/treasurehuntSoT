import { PlayerSignIn } from "@/components/platform/PlayerSignIn";
import { readPendingInvitationToken, requirePlayerIdentity } from "@/platform/auth";

export const dynamic = "force-dynamic";
export default async function PlayerSignInPage() {
  const [identity, pendingInvitation] = await Promise.all([requirePlayerIdentity(), readPendingInvitationToken()]);
  return (
    <PlayerSignIn
      authenticated={Boolean(identity)}
      nextHref={pendingInvitation ? "/player/invitation" : "/player/library"}
    />
  );
}
