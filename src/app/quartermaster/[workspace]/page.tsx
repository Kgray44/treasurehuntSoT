import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";
const workspaces = new Set([
  "chapters",
  "hints",
  "voyage",
  "artifacts",
  "quests",
  "journal",
  "events",
  "player-view",
  "recovery",
  "audit",
  "diagnostics",
]);

export default async function QuartermasterWorkspacePage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  if (!workspaces.has(workspace)) notFound();
  // Historical bookmarks are compatibility adapters, not a second auth surface.
  redirect("/captain/library");
}
