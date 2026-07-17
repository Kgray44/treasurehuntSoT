import Link from "next/link";
import { getTaleSessionState } from "@/tall-tale/progression";
import { readTaleSessionCookie } from "@/tall-tale/session-cookie";
export const dynamic = "force-dynamic";
export default async function HistoryPage() {
  const access = await readTaleSessionCookie();
  if (!access)
    return (
      <main className="tale-history">
        <section>
          <h1>No voyage history in this browser</h1>
          <Link href="/tales">Choose a Tall Tale</Link>
        </section>
      </main>
    );
  let state: Awaited<ReturnType<typeof getTaleSessionState>> | null = null;
  try {
    state = await getTaleSessionState(access.sessionId, access.token);
  } catch {}
  if (!state) {
    return (
      <main className="tale-history">
        <section>
          <h1>Voyage history unavailable</h1>
          <Link href="/tales">Return to catalog</Link>
        </section>
      </main>
    );
  }
  if (state.session.previewMode) {
    return (
      <main className="tale-history">
        <section>
          <p className="eyebrow">Studio preview</p>
          <h1>Preview voyages are not recorded</h1>
          <p>This session is an isolated creator preview and does not appear in player history.</p>
          <Link href="/tales">Return to catalog</Link>
        </section>
      </main>
    );
  }
  return (
    <main className="tale-history">
      <section>
        <p className="eyebrow">Version-pinned memory</p>
        <h1>{state.tale.title}</h1>
        <p>
          {state.session.status === "COMPLETED"
            ? `Completed ${new Date(state.session.completedAt ?? state.session.updatedAt).toLocaleString()}.`
            : `This voyage is ${state.session.status.toLocaleLowerCase()}.`}
        </p>
        <h2>Recorded events</h2>
        <ol>
          {[...state.events].reverse().map((event) => (
            <li key={event.id}>
              <time>{new Date(event.createdAt).toLocaleString()}</time>
              <strong>{event.eventType.replaceAll(/([A-Z])/g, " $1")}</strong>
            </li>
          ))}
        </ol>
        <Link className="brass-button" href="/tales">
          Return to catalog
        </Link>
      </section>
    </main>
  );
}
