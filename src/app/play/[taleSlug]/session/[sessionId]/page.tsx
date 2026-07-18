import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ taleSlug: string; sessionId: string }> }) {
  const { taleSlug, sessionId } = await params;
  redirect(`/play/${encodeURIComponent(taleSlug)}/session/${encodeURIComponent(sessionId)}/chapters`);
}
