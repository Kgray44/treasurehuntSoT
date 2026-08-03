import { notFound, permanentRedirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { publicProfileProjection } from "@/wayfarer/profile";

// Viewer context is derived from cookies on the server; this page must not be
// statically prerendered and then accidentally share a projection cache.
export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  await connection();
  const { handle } = await params;
  const session = await requireWayfarerAccount();
  const profile = await publicProfileProjection(handle, {
    accountId: session?.accountId,
    registered: Boolean(session),
  });
  if (!profile) notFound();
  if (profile.redirectedFrom && profile.handle !== handle) permanentRedirect(`/profile/${profile.handle}`);
  if (profile.private)
    return (
      <main>
        <h1>Profile unavailable</h1>
        <p>This profile is not shared with this viewer.</p>
      </main>
    );
  const displayName = profile.displayName;
  if (!displayName) notFound();
  const providers = "providers" in profile && Array.isArray(profile.providers) ? profile.providers : [];
  const initial = displayName.slice(0, 1).toUpperCase();
  return (
    <main className="public-profile">
      <header className="public-profile__hero">
        <div className="public-profile__banner" aria-hidden={!profile.bannerUrl}>
          {profile.bannerUrl ? (
            <Image src={profile.bannerUrl} alt="" fill sizes="(max-width: 800px) 100vw, 1200px" unoptimized />
          ) : (
            <span />
          )}
        </div>
        <div className="public-profile__identity">
          {profile.avatarUrl ? (
            <Image
              className="public-profile__avatar"
              src={profile.avatarUrl}
              alt={displayName + "'s avatar"}
              width={176}
              height={176}
              unoptimized
            />
          ) : (
            <div className="public-profile__avatar public-profile__avatar--fallback" aria-hidden="true">
              {initial}
            </div>
          )}
          <div>
            <p className="public-profile__eyebrow">Voyagewright Profile</p>
            <h1>{displayName}</h1>
            <p className="public-profile__handle">@{profile.handle}</p>
          </div>
        </div>
      </header>

      <div className="public-profile__grid">
        <section className="public-profile__card public-profile__about">
          <p className="public-profile__eyebrow">About this Wayfinder</p>
          <h2>Charted identity</h2>
          {profile.biography ? (
            <p>{profile.biography}</p>
          ) : (
            <p className="public-profile__empty">No public biography has been charted yet.</p>
          )}
        </section>

        <section className="public-profile__card">
          <p className="public-profile__eyebrow">Public connections</p>
          <h2>Known by</h2>
          {providers.length > 0 ? (
            <ul className="public-profile__connections">
              {providers.map((provider) => (
                <li key={provider.provider}>
                  <span aria-hidden="true">◇</span>
                  {provider.providerDisplayName || provider.provider}
                </li>
              ))}
            </ul>
          ) : (
            <p className="public-profile__empty">No linked identities are shared publicly.</p>
          )}
        </section>

        <section className="public-profile__card public-profile__chronicles">
          <div>
            <p className="public-profile__eyebrow">Chronicle activity</p>
            <h2>Stories remain with their keeper</h2>
            <p>Private Voyage history, Memories, and Keepsakes are never published by this Profile projection.</p>
          </div>
          <Link className="button button--quiet" href="/tales">
            Explore Chronicles
          </Link>
        </section>
      </div>
    </main>
  );
}
