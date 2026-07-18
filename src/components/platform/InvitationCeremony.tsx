"use client";

/* eslint-disable @next/next/no-img-element -- Cover image is authorized against the pending invitation cookie. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ErrorState, LoadingState } from "@/components/ui/AsyncState";

type Invitation = {
  id: string;
  status: string;
  recipientName: string;
  expiresAt: string;
  requiresPin: boolean;
  playthrough: {
    id: string;
    voyageName: string;
    status: string;
    plannedStartAt: string | null;
    scheduleTimezone: string | null;
    versionLabel: string | null;
    tale: { title: string; subtitle: string | null; shortDescription: string | null; coverUrl: string | null } | null;
  };
};

export function InvitationCeremony() {
  const router = useRouter();
  const search = useSearchParams();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [csrf, setCsrf] = useState("");
  const [pin, setPin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(
    search.get("state") === "invalid" ? "This invitation is invalid or no longer available." : "",
  );
  const [needsAccount, setNeedsAccount] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (search.get("state") === "invalid") return;
    void fetch("/api/invitations/resolve", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as { invitation?: Invitation; csrfToken?: string; error?: string };
        if (!response.ok) return setError(body.error ?? "This invitation is not available.");
        setInvitation(body.invitation ?? null);
        setCsrf(body.csrfToken ?? "");
        setDisplayName(body.invitation?.recipientName ?? "");
      })
      .catch(() => setError("This invitation could not be reached. Check your connection and try again."));
  }, [search]);

  async function act(action: "accept" | "decline") {
    if (
      action === "decline" &&
      !window.confirm(
        "Decline this invitation? You will leave this joining flow and the Captain will see your response.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/invitations/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(action === "accept" ? { pin, displayName } : {}),
      });
      const body = (await response.json()) as { error?: string; code?: string; playthroughId?: string };
      if (!response.ok) {
        setNeedsAccount(body.code === "ACCOUNT_REQUIRED");
        return setError(body.error ?? `Unable to ${action} this invitation.`);
      }
      router.push(action === "accept" ? `/player/playthroughs/${body.playthroughId}` : "/player/sign-in");
      router.refresh();
    } catch {
      setError(`Unable to ${action} this invitation. Check your connection and try again.`);
    } finally {
      setBusy(false);
    }
  }

  if (error && !invitation)
    return (
      <main className="invitation-page">
        <ErrorState
          title="This invitation cannot be opened"
          detail={error}
          action={{ label: "Return to Player Entry", href: "/player/sign-in" }}
        />
      </main>
    );
  if (!invitation)
    return (
      <main className="invitation-page platform-loading">
        <LoadingState title="Opening your invitation" detail="Checking its status, voyage, and access requirements." />
      </main>
    );
  const tale = invitation.playthrough.tale;
  return (
    <main className="invitation-page">
      <section className="invitation-sheet" aria-labelledby="invitation-title" aria-busy={busy}>
        <div className="invitation-seal" aria-hidden="true">
          ✦
        </div>
        {tale?.coverUrl && <img className="invitation-cover" src={tale.coverUrl} alt="" />}
        <p className="eyebrow">A Captain&apos;s invitation for {invitation.recipientName}</p>
        <h1 id="invitation-title">{tale?.title ?? "A Tall Tale awaits"}</h1>
        <h2>{invitation.playthrough.voyageName}</h2>
        <p>{tale?.shortDescription ?? "Your voyage is ready to join."}</p>
        <dl>
          <div>
            <dt>Edition</dt>
            <dd>{invitation.playthrough.versionLabel}</dd>
          </div>
          <div>
            <dt>Invitation expires</dt>
            <dd>{new Date(invitation.expiresAt).toLocaleString()}</dd>
          </div>
          {invitation.playthrough.plannedStartAt && (
            <div>
              <dt>Planned start</dt>
              <dd>
                {new Date(invitation.playthrough.plannedStartAt).toLocaleString()}{" "}
                {invitation.playthrough.scheduleTimezone}
              </dd>
            </div>
          )}
        </dl>
        <label>
          <span>Your display name</span>
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
        </label>
        {invitation.requiresPin && (
          <label>
            <span>Invitation PIN</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              required
            />
          </label>
        )}
        {error && (
          <p className="platform-error" role="alert">
            {error}
          </p>
        )}
        {needsAccount && (
          <Link className="brass-button" href="/player/sign-in">
            Sign in, then return to this invitation
          </Link>
        )}
        <div className="invitation-actions">
          <button
            className="brass-button"
            disabled={busy || !displayName || (invitation.requiresPin && !pin)}
            aria-busy={busy}
            onClick={() => void act("accept")}
          >
            {busy ? "Joining voyage…" : "Accept and Join Voyage"}
          </button>
          <button className="button-subtle" disabled={busy} onClick={() => void act("decline")}>
            Decline Invitation
          </button>
        </div>
      </section>
    </main>
  );
}
