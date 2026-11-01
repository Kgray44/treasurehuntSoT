"use client";

import Link from "next/link";
import { CreatorPublicationConsole } from "./CreatorPublicationConsole";
import { CreatorInstalledCommunityLibrary } from "./CreatorInstalledCommunityLibrary";

export function StudioExchangeConsole({ authenticated }: { authenticated: boolean }) {
  if (!authenticated)
    return (
      <main className="studio-auth-gate">
        <h1>Creator access is required.</h1>
        <p>Sign in with a Creator account to share saved work in Community Harbor.</p>
        <Link href="/sign-in?returnTo=%2Fstudio%2Fexchange">Sign in and return to the Exchange</Link>
      </main>
    );
  return (
    <main className="studio-home" data-testid="studio-community-exchange">
      <header className="studio-home-header studio-exchange-header">
        <div>
          <p className="eyebrow">Community Harbor</p>
          <h1>Open the Exchange</h1>
          <p>
            Share an eligible saved Chronicle, Chapter template or Passage preset through exact package review and
            independent moderation.
          </p>
        </div>
      </header>
      <div className="studio-exchange-layout">
        <CreatorPublicationConsole />
        <aside className="studio-exchange-guidance" aria-label="Community publishing safeguards">
          <p className="eyebrow">Publishing path</p>
          <h2>What happens next</h2>
          <ol>
            <li>Review the saved source, package contents, license and credits.</li>
            <li>Submit the exact package to independent moderation.</li>
            <li>After approval, another Creator can install a pinned private copy from its Community listing.</li>
          </ol>
          <p>
            Sources with media, spatial, artifact or provider dependencies require a verified package path before they
            can be shared here.
          </p>
          <Link href="/community">Browse Community Harbor</Link>
        </aside>
      </div>
      <CreatorInstalledCommunityLibrary />
    </main>
  );
}
