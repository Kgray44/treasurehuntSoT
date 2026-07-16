import Link from "next/link";
export default function Home() {
  return (
    <main className="harbor-landing">
      <div className="landing-mark" aria-hidden="true">
        ✦
      </div>
      <p className="eyebrow">A private voyage awaits</p>
      <h1>The Forever Treasure</h1>
      <p>
        This chart opens only for its invited sailor. If you carry an invitation, follow the course your captain shared.
      </p>
      <Link className="brass-button" href="/tale/development-forever-treasure">
        Open the journal
      </Link>
    </main>
  );
}
