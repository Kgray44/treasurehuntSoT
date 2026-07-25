import { NextResponse } from "next/server";
import type { ShellContext } from "@/navigation";
import { requireWayfarerAccount } from "@/wayfarer/http";

function initials(displayName: string) {
  const value = displayName.trim();
  const letters = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("en-US") ?? "")
    .join("");
  return letters || "A";
}

const anonymousContext: ShellContext = {
  authenticated: false,
  canUsePlayer: false,
  canUseCaptain: false,
  canUseCreator: false,
  isAdministrator: false,
  profile: null,
};

export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session?.account.profile)
    return NextResponse.json(anonymousContext, { headers: { "Cache-Control": "no-store" } });

  const roles = new Set(session.account.roles.map((assignment) => assignment.role));
  const isAdministrator = roles.has("ADMINISTRATOR");
  const profile = session.account.profile;
  const body: ShellContext = {
    authenticated: true,
    canUsePlayer: roles.has("PLAYER") || isAdministrator,
    canUseCaptain: roles.has("CAPTAIN") || isAdministrator,
    canUseCreator: roles.has("CREATOR") || roles.has("PUBLISHER") || isAdministrator,
    isAdministrator,
    profile: {
      displayName: profile.displayName.slice(0, 80),
      initials: initials(profile.displayName),
      ...(profile.handle ? { handle: profile.handle.slice(0, 32) } : {}),
    },
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
