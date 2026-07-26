import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { harborSharingMetadata } from "@/community/sharing-metadata";
import { readVoyageLogForViewer } from "@/community/voyage-log-public";
import { db } from "@/lib/db";
import { requireCanonicalAccountIdentity } from "@/platform/auth";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug;
  const log = await db.communityVoyageLog.findUnique({ where: { slug }, select: { slug: true, title: true, safeSummary: true, visibility: true, lifecycleState: true, publishedAt: true, verifiedCompletion: true } });
  return log && log.lifecycleState === "PUBLISHED" && log.publishedAt && log.verifiedCompletion && ["COMMUNITY", "UNLISTED"].includes(log.visibility)
    ? harborSharingMetadata({
        kind: "voyage-log",
        visibility: log.visibility as "COMMUNITY" | "UNLISTED",
        canonicalPath: `/community/voyage-logs/${encodeURIComponent(log.slug)}`,
        title: log.title,
        safeDescription: log.safeSummary,
      })
    : { robots: { index: false, follow: false, nocache: true } };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const identity = await requireCanonicalAccountIdentity();
  const log = await readVoyageLogForViewer((await params).slug, identity?.accountId);
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
