import { Suspense } from "react";
import { InvitationCeremony } from "@/components/platform/InvitationCeremony";

export const dynamic = "force-dynamic";
export default function PlayerInvitationPage() {
  return (
    <Suspense fallback={<main className="platform-loading">Opening your invitation…</main>}>
      <InvitationCeremony />
    </Suspense>
  );
}
