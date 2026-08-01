import { NextResponse } from "next/server";
import type { ShellContext } from "@/navigation";
import { resolveCurrentUser } from "@/homeport/current-user.server";

const anonymousContext: ShellContext = {
  authenticated: false,
  canUsePlayer: false,
  canUseCaptain: false,
  canUseCreator: false,
  isAdministrator: false,
  profile: null,
};

export async function GET() {
  const context = await resolveCurrentUser({ rotateCompatibility: true });
  if (context.status !== "authenticated")
    return NextResponse.json(anonymousContext, {
      status: context.status === "unavailable" ? 503 : 200,
      headers: { "Cache-Control": "no-store, private", Vary: "Cookie" },
    });
  const body: ShellContext = {
    authenticated: true,
    canUsePlayer: context.capabilities.canUsePlayer,
    canUseCaptain: context.capabilities.canUseCaptain,
    canUseCreator: context.capabilities.canUseCreator,
    isAdministrator: context.capabilities.isAdministrator,
    profile: {
      displayName: context.user.displayName,
      initials: context.user.initials,
      ...(context.user.handle ? { handle: context.user.handle } : {}),
    },
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store, private", Vary: "Cookie" } });
}
