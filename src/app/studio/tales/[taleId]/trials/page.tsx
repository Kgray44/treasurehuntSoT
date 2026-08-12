import { TaleEditorSection } from "@/components/studio/TaleEditorSection";

export default async function Page({ params }: { params: Promise<{ taleId: string }> }) {
  return <TaleEditorSection taleId={(await params).taleId} section="trials" />;
}
