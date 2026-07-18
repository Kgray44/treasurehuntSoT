import Link from "next/link";
export default function OfflinePage() {
  return (
    <main className="offline-page">
      <section>
        <p className="eyebrow">Application shell only</p>
        <h1>The companion is offline.</h1>
        <p>
          Mutable story state, authentication, Studio data, Captain controls, and Vision verification are never served
          from a stale cache. Reconnect before continuing.
        </p>
        <Link href="/">Try the harbor again</Link>
      </section>
    </main>
  );
}
