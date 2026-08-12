import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CommunityPageFrame } from "@/components/community/CommunityPageFrame";
import { ResilientImage } from "@/components/ui/ResilientImage";
import { getPublicChroniclePreview } from "@/chronicle/public-preview";

export const dynamic = "force-dynamic";

export default async function ChroniclePreviewPage({ params }: { params: Promise<{ taleSlug: string }> }) {
  const { taleSlug } = await params;
  const preview = await getPublicChroniclePreview(taleSlug);
  if (!preview) notFound();
  if (preview.communityHref) redirect(preview.communityHref);
  return (
    <CommunityPageFrame
      districtId="CHRONICLES"
      eyebrow="Chronicle preview"
      title={preview.title}
      description={preview.shortDescription ?? "A published Chronicle ready to inspect before you begin."}
    >
      <nav className="community-breadcrumbs" aria-label="Chronicle preview location">
        <Link href="/">Gateway</Link>
        <span aria-hidden="true">/</span>
        <Link href="/tales">Explore Chronicles</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{preview.title}</span>
      </nav>
      <article className="community-detail chronicle-public-preview">
        <ResilientImage
          className="chronicle-public-preview__cover"
          src={preview.coverUrl}
          alt=""
          fallbackLabel={`${preview.title} cover unavailable`}
          fallbackDetail="The complete public Chronicle information and Start action remain available."
        />
        <div className="community-detail__body">
          <p className="community-eyebrow">Published version {preview.version}</p>
          <h2>About this Chronicle</h2>
          <p className="community-detail__lead">{preview.longDescription ?? preview.shortDescription}</p>
          <p>Created by {preview.creator.displayName}</p>
          <dl className="community-detail__facts">
            <div>
              <dt>Theme</dt>
              <dd>{preview.theme.replaceAll("_", " ").toLocaleLowerCase()}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{preview.estimatedDuration ? `${preview.estimatedDuration} minutes` : "Uncharted"}</dd>
            </div>
            <div>
              <dt>Crew</dt>
              <dd>
                {preview.playerCountMin}–{preview.playerCountMax} Players
              </dd>
            </div>
            <div>
              <dt>Voyages started</dt>
              <dd>{preview.statistics.voyagesStarted}</dd>
            </div>
            <div>
              <dt>Voyages completed</dt>
              <dd>{preview.statistics.voyagesCompleted}</dd>
            </div>
            <div>
              <dt>Published</dt>
              <dd>{new Date(preview.publishedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
          {preview.contentWarnings ? (
            <section className="community-detail__warning">
              <h3>Content notes</h3>
              <p>{preview.contentWarnings}</p>
            </section>
          ) : null}
          {preview.releaseNotes ? (
            <section>
              <h3>Release notes</h3>
              <p>{preview.releaseNotes}</p>
            </section>
          ) : null}
          <section className="community-detail__action" aria-labelledby="chronicle-start-title">
            <p className="community-eyebrow">Ready to play?</p>
            <h3 id="chronicle-start-title">Start Chronicle</h3>
            <p>
              Starting enters preparation. This preview has not created a session, Crew, invitation, or participant.
            </p>
            <Link className="community-button community-button--primary" href={preview.startHref}>
              Start Chronicle
            </Link>
            <Link
              className="community-button community-button--quiet"
              href={`/chronicles/${encodeURIComponent(taleSlug)}/compare?returnTo=${encodeURIComponent(`/chronicles/${taleSlug}`)}`}
            >
              See what changed
            </Link>
          </section>
        </div>
      </article>
      <p className="community-detail-return">
        <Link href="/tales">Back to Explore Chronicles</Link>
      </p>
    </CommunityPageFrame>
  );
}
