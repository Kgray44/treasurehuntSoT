import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { harborSharingMetadata } from "@/community/sharing-metadata";
import { readPublicVoyageLogs } from "@/community/voyage-log-public";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug;
  const [log] = await readPublicVoyageLogs(slug);
  return log
    ? harborSharingMetadata({
        kind: "voyage-log",
        visibility: "COMMUNITY",
        canonicalPath: `/community/voyage-logs/${encodeURIComponent(log.slug)}`,
        title: log.title,
        safeDescription: log.safeSummary,
      })
    : { robots: { index: false, follow: false, nocache: true } };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const [log] = await readPublicVoyageLogs((await params).slug);
  if (!log) notFound();
  return (
    <main className="page-shell" aria-labelledby="voyage-log-title">
      <p>
        <Link href="/community/voyage-logs">Back to Voyage Logs</Link>
      </p>
      <p className="eyebrow">Verified completion</p>
      <h1 id="voyage-log-title">{log.title}</h1>
      {log.safeSummary ? <p>{log.safeSummary}</p> : null}
    </main>
  );
}
