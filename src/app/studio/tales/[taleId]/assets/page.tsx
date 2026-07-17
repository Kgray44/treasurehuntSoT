import { TaleEditorSection } from "@/components/studio/TaleEditorSection";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ taleId: string }> }) {
  return <TaleEditorSection taleId={(await params).taleId} section="assets" />;
}
