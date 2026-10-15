"use client";

import Link from "next/link";
import { ChronicleJournalSession } from "@/components/player/journal/ChronicleJournalSession";
import { companionHref } from "@/crossdeck/experiences";
import { CrossdeckDisplay } from "./CrossdeckDisplay";
import { useCrossdeckSession } from "./useCrossdeckSession";
import styles from "./CrossdeckCompanion.module.css";

/** No personal Journal projection is loaded until this tab's server-authorized surface is resolved. */
export function CrossdeckCompanionGateway({ voyageId }: { voyageId: string }) {
  const connection = useCrossdeckSession(voyageId);
  const returnHref = voyageId ? `/player/playthroughs/${encodeURIComponent(voyageId)}/journal` : "/player/library";
  if (
    !connection.ready ||
    connection.signedOut ||
    !connection.here ||
    connection.here.voyageId !== voyageId ||
    !connection.here.thisSession
  )
    return (
      <main className={styles.companion} data-crossdeck-companion-gateway>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Crossdeck companion</p>
            <h1>
              {!connection.ready
                ? "Connecting your companion"
                : connection.signedOut
                  ? "Sign in to continue"
                  : "Reconnect this device"}
            </h1>
          </div>
          <Link className={styles.returnLink} href={returnHref}>
            Return to Chronicle
          </Link>
        </header>
        <section className={styles.workspace} aria-label="Companion connection">
          <p role="status">
            {!connection.ready
              ? "Checking your device and Voyage access…"
              : connection.message || "This tab is not connected to the Voyage. Connect it again from your Chronicle."}
          </p>
          {connection.signedOut ? (
            <Link
              className={styles.primaryAction}
              href={`/player/sign-in?returnTo=${encodeURIComponent(companionHref(voyageId))}`}
            >
              Sign in
            </Link>
          ) : (
            connection.ready && (
              <button
                className={styles.primaryAction}
                type="button"
                onClick={() =>
                  void connection
                    .refresh()
                    .catch(() => connection.setMessage("Connection interrupted. Retry when you are online."))
                }
              >
                Retry connection
              </button>
            )
          )}
        </section>
      </main>
    );
  // Role changes into a shared display unmount the personal controller before rendering the restricted consumer.
  if (connection.here.role === "SHARED_CREW_DISPLAY")
    return <CrossdeckDisplay voyageId={voyageId} connection={connection} />;
  return (
    <ChronicleJournalSession
      key={`${voyageId}:${connection.here.surfaceId}`}
      sessionId={voyageId}
      identitySession
      companion={connection}
    />
  );
}
