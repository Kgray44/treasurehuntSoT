import { NextResponse } from "next/server";
import { workspaceCapabilityOverview } from "@/homeport/workspace-capabilities";
import { listCaptainLibrary } from "@/platform/libraries";
import { requireWayfarerAccount } from "@/wayfarer/http";

export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session) return NextResponse.json({ error: "Sign in to Captain's Console to continue." }, { status: 401 });
  const overview = await workspaceCapabilityOverview(session.accountId);
  const captain = overview.workspaces.find((workspace) => workspace.id === "CAPTAIN");
  if (captain?.state !== "ACTIVE")
    return NextResponse.json(
      { error: overview.transitionLock.detail, code: overview.transitionLock.state },
      { status: 409 },
    );
  return NextResponse.json({
    csrfToken: session.csrfToken,
    ...(await listCaptainLibrary(session.account.legacyGameMasterId, session.accountId)),
  });
}
