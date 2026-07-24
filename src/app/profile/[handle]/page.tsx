import { notFound, permanentRedirect } from "next/navigation";
import Image from "next/image";
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
  const providers = "providers" in profile && Array.isArray(profile.providers) ? profile.providers : [];
  return (
    <main className="public-profile">
      <header>
        {profile.bannerUrl && <Image src={profile.bannerUrl} alt="" width={1200} height={360} unoptimized />}{" "}
        {profile.avatarUrl && (
          <Image src={profile.avatarUrl} alt="Profile avatar" width={240} height={240} unoptimized />
        )}
        <p>Profile</p>
        <h1>{profile.displayName}</h1>
        <p>@{profile.handle}</p>
      </header>
      {profile.biography && (
        <section>
          <h2>About</h2>
          <p>{profile.biography}</p>
        </section>
      )}
      {providers.length > 0 && (
        <section>
          <h2>Linked identities</h2>
          <ul>
            {providers.map((provider) => (
              <li key={provider.provider}>{provider.providerDisplayName || provider.provider}</li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2>Chronicle activity</h2>
        <p>
          This profile does not publish private Voyage history. Expanded personal history arrives in a later Wayfarer
          phase.
        </p>
      </section>
    </main>
  );
}
