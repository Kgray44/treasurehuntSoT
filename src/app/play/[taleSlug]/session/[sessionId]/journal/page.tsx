import { redirect } from "next/navigation";

export default async function HistoricalExperiencePage({
  params,
}: {
  params: Promise<{ taleSlug: string; sessionId: string }>;
}) {
  const { taleSlug, sessionId } = await params;
  redirect(`/play/${encodeURIComponent(taleSlug)}/session/${encodeURIComponent(sessionId)}/journal/chapters`);
}
