import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityPageFrame } from "@/components/community/CommunityPageFrame";
import { harborSharingMetadata } from "@/community/sharing-metadata";
import { readPublicVoyageLogs, readVoyageLogForViewer } from "@/community/voyage-log-public";
import { requireCanonicalAccountIdentity } from "@/platform/auth";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;
  const log = (await readPublicVoyageLogs(slug))[0];
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

export default async function VoyageLogPage({ params }: Props) {
  const identity = await requireCanonicalAccountIdentity();
  const log = await readVoyageLogForViewer((await params).slug, identity?.accountId);
  if (!log) notFound();
  return (
    <CommunityPageFrame
      districtId="VOYAGE_LOGS"
      eyebrow="Verified Voyage Log"
      title={log.title}
      description={log.safeSummary ?? "A consented, spoiler-safe record of a completed Voyage."}
    >
      <nav className="community-breadcrumbs" aria-label="Voyage Log location">
        <Link href="/community">Harbor Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/community/voyage-logs">Voyage Logs</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{log.title}</span>
      </nav>
      <article className="community-voyage-log-detail">
        <p className="community-eyebrow">Sharing checks complete</p>
        <h2>Voyage Record</h2>
        {log.safeSummary ? <p>{log.safeSummary}</p> : null}
        <ul className="community-card__badges" aria-label="Voyage Log safeguards">
          <li>Verified completion</li>
          <li>Participant consent checked</li>
          <li>Preview-safe details</li>
        </ul>
        <p className="community-privacy-note">
          Private participant identity, exact locations, and unconsented media are not part of this public record.
        </p>
      </article>
    </CommunityPageFrame>
  );
}
