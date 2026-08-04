import { ErrorState, PermissionState, UnavailableState } from "@/components/ui/AsyncState";
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
        <ErrorState
          primaryHeading
          title="Sign in required"
          detail={detail}
          action={{ label: "Sign in", href: signIn }}
        />
      </section>
    );
  }
  if (decision.status === "permission-denied")
    return (
      <section className="platform-auth platform-state" data-access-state="permission-denied">
        <PermissionState
          primaryHeading
          title="Permission required"
          detail={`Your account is signed in, but it does not have ${labels[decision.capability]} permission.`}
          action={{ label: "Choose another workspace", href: "/" }}
        />
      </section>
    );
  if (decision.status === "account-restricted")
    return (
      <section className="platform-auth platform-state" data-access-state="account-restricted">
        <PermissionState
          primaryHeading
          restriction="account-restricted"
          title="Account access restricted"
          detail="This account cannot open the requested workspace. Use account recovery or contact support."
          action={{ label: "Account recovery", href: "/forgot-password" }}
        />
      </section>
    );
  return (
    <section className="platform-auth platform-state" data-access-state="unavailable">
      <UnavailableState
        primaryHeading
        title="Account service unavailable"
        detail="Your identity could not be verified, so no workspace permission was assumed. Try again."
        reference={decision.correlationId}
        action={{ label: "Retry", href: "" }}
      />
    </section>
  );
}
