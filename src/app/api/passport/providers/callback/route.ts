import { NextResponse } from "next/server";
import { canonicalPublicAppOrigin, PublicAppOriginError } from "@/homeport/public-app-origin";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { completeProviderLink, completeSteamOpenIdLink } from "@/wayfarer/providers";
import { profileApiError } from "@/wayfarer/http-errors";
export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    return NextResponse.json(await completeProviderLink({ accountId: session.accountId, ...(await request.json()) }));
  } catch (cause) {
    return profileApiError(cause);
  }
}

export async function GET(request: Request) {
  let publicOrigin: URL;
  try {
    publicOrigin = canonicalPublicAppOrigin();
  } catch (cause) {
    if (!(cause instanceof PublicAppOriginError)) throw cause;
    return NextResponse.json({ error: "Provider redirect configuration is unavailable." }, { status: 503 });
  }
  const session = await requireWayfarerAccount();
  if (!session) return NextResponse.redirect(new URL("/sign-in?returnTo=/account/linked-identities", publicOrigin));
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  const state = url.searchParams.get("state");
  try {
    if (!provider || !state) throw new Error("Missing provider callback state.");
    if (provider === "STEAM") {
      await completeSteamOpenIdLink({ accountId: session.accountId, state, assertion: url.searchParams });
    } else {
      const code = url.searchParams.get("code");
      if (!code) throw new Error("Missing provider authorization code.");
      await completeProviderLink({ accountId: session.accountId, provider, state, code });
    }
    return NextResponse.redirect(new URL("/account/linked-identities?linked=1", publicOrigin));
  } catch {
    return NextResponse.redirect(new URL("/account/linked-identities?providerError=1", publicOrigin));
  }
}
