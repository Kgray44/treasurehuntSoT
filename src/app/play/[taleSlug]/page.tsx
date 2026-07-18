import { TaleStart } from "@/components/tales/TaleStart";
export const dynamic = "force-dynamic";
export default async function PlayPage({ params }: { params: Promise<{ taleSlug: string }> }) {
  return <TaleStart taleSlug={(await params).taleSlug} />;
}
