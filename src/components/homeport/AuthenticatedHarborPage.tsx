import { redirect } from "next/navigation";
import { AccessDecisionState } from "@/components/auth/AccessDecisionState";
import { PersonalHarborLayout } from "@/components/homeport/PersonalHarborLayout";
import { decideCapability, type HomeportCapability } from "@/homeport/current-user";
import { resolveCurrentUser } from "@/homeport/current-user.server";
import type { PersonalHarborSectionId } from "@/homeport/personal-harbor-navigation";
import { signInHref } from "@/homeport/return-to";

export async function AuthenticatedHarborPage({
  returnTo,
  activeSection,
  eyebrow,
  title,
  description,
  capability,
  children,
}: {
  returnTo: string;
  activeSection: PersonalHarborSectionId;
  eyebrow: string;
  title: string;
  description: string;
  capability?: HomeportCapability;
  children: React.ReactNode;
}) {
  const context = await resolveCurrentUser();
  if (
    context.status === "authenticated" &&
    (!capability || decideCapability(context, capability).status === "allowed")
  ) {
    return (
      <PersonalHarborLayout
        activeSection={activeSection}
        eyebrow={eyebrow}
        title={title}
        description={description}
        csrfToken={context.csrfToken}
      >
        {children}
      </PersonalHarborLayout>
    );
  }
  const decision = decideCapability(context, capability ?? "player");
  if (["auth-required", "expired", "revoked", "invalid"].includes(decision.status))
    redirect(signInHref(returnTo, decision.status as "auth-required" | "expired" | "revoked" | "invalid"));
  return <AccessDecisionState decision={decision} />;
}
