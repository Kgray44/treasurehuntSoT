import { TaleEditor } from "@/components/studio/TaleEditor";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
export const dynamic = "force-dynamic";
export default async function EditorPage({ params }: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await params;
  return <TaleEditor taleId={taleId} authenticated={Boolean(await requireOwnedStudioTale(taleId))} />;
}
