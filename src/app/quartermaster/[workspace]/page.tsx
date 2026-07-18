import { notFound } from "next/navigation";
import { Quartermaster } from "@/components/gm/Quartermaster";
import { requireGm } from "@/lib/security";

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
  return <Quartermaster authenticated={Boolean(await requireGm())} />;
}
