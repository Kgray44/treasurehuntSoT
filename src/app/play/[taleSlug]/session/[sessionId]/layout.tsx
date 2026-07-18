import { TallTaleJournalSession } from "@/components/player/journal/TallTaleJournalSession";

export const dynamic = "force-dynamic";

export default async function SessionExperienceLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ taleSlug: string; sessionId: string }>;
}>) {
  const { taleSlug, sessionId } = await params;
  return (
    <>
      <TallTaleJournalSession
        sessionId={sessionId}
        routeBase={`/play/${encodeURIComponent(taleSlug)}/session/${encodeURIComponent(sessionId)}`}
      />
      {children}
    </>
  );
}
