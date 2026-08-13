import Link from "next/link";
import { CommunityPageFrame } from "@/components/community/CommunityPageFrame";
import { TideglassPassage } from "@/components/tideglass/TideglassPassage";

export const dynamic = "force-dynamic";

function queryValue(value: string | string[] | undefined) {
  return typeof value === "string" && value.length <= 191 ? value : null;
}

export default async function TideglassComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ taleSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { taleSlug } = await params;
  const query = await searchParams;
  const chronicleHref = `/chronicles/${encodeURIComponent(taleSlug)}`;
  return (
    <CommunityPageFrame
      districtId="CHRONICLES"
      eyebrow="Tideglass edition intelligence"
      title="Chronicle edition comparison"
      description="Compare exact published editions through spoiler-safe, server-projected summaries."
    >
      <nav className="community-breadcrumbs" aria-label="Chronicle comparison location">
        <Link href="/tales">Explore Chronicles</Link>
        <span aria-hidden="true">/</span>
        <Link href={chronicleHref}>Chronicle</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">What changed?</span>
      </nav>
      <TideglassPassage
        taleSlug={taleSlug}
        initialSourceEditionId={queryValue(query.from)}
        initialTargetEditionId={queryValue(query.to)}
        initialHistoryRecordId={queryValue(query.historyRecord)}
        initialReturnTo={queryValue(query.returnTo)}
        headingLevel="h2"
      />
    </CommunityPageFrame>
  );
}
