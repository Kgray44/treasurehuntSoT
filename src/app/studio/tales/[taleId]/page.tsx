import { TaleEditorSection } from "@/components/studio/TaleEditorSection";
export const dynamic = "force-dynamic";
export default async function EditorPage({ params }: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await params;
  return <TaleEditorSection taleId={taleId} />;
}
