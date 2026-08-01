import Link from "next/link";
import type { CapabilityDecision } from "@/homeport/current-user";

const labels = {
  player: "Player",
  captain: "Captain",
  creator: "Creator",
  moderator: "Moderator",
  administrator: "Administrator",
};

export function AccessDecisionState({
  decision,
  signIn = "/sign-in",
}: {
  decision: CapabilityDecision;
  signIn?: string;
}) {
  if (decision.status === "allowed") return null;
  if (
    decision.status === "auth-required" ||
    decision.status === "expired" ||
    decision.status === "revoked" ||
    decision.status === "invalid"
  ) {
    const detail =
      decision.status === "expired"
        ? "Your account session expired. Sign in again to continue; no Voyage progress has changed."
        : decision.status === "revoked"
          ? "This account session was signed out or revoked. Sign in again to continue."
          : decision.status === "invalid"
            ? "This account session is no longer valid. Sign in again to continue."
            : "Sign in to continue.";
    return (
      <section className="platform-auth platform-state" data-access-state={decision.status}>
        <div className="auth-ledger">
          <p className="eyebrow">Account access</p>
          <h1>Sign in required</h1>
          <p>{detail}</p>
          <Link className="brass-button" href={signIn}>
            Sign in
          </Link>
        </div>
      </section>
    );
  }
  if (decision.status === "permission-denied")
    return (
      <section className="platform-auth platform-state" data-access-state="permission-denied">
        <div className="auth-ledger">
          <p className="eyebrow">Workspace access</p>
          <h1>Permission required</h1>
          <p>Your account is signed in, but it does not have {labels[decision.capability]} permission.</p>
          <Link className="brass-button auth-continue" href="/">
            Choose another workspace
          </Link>
        </div>
      </section>
    );
  if (decision.status === "account-restricted")
    return (
      <section className="platform-auth platform-state" data-access-state="account-restricted">
        <div className="auth-ledger">
          <p className="eyebrow">Account access</p>
          <h1>Account access restricted</h1>
          <p>This account cannot open the requested workspace. Use account recovery or contact support.</p>
          <Link className="brass-button auth-continue" href="/forgot-password">
            Account recovery
          </Link>
        </div>
      </section>
    );
  return (
    <section className="platform-auth platform-state" data-access-state="unavailable">
      <div className="auth-ledger">
        <p className="eyebrow">Account access</p>
        <h1>Account service unavailable</h1>
        <p>Your identity could not be verified, so no workspace permission was assumed. Try again.</p>
        <p>Reference: {decision.correlationId}</p>
        <Link className="brass-button auth-continue" href="">
          Retry
        </Link>
      </div>
    </section>
  );
}
