import { NextResponse } from "next/server";
import { canonicalPublicAppOrigin, PublicAppOriginError } from "@/homeport/public-app-origin";
import { requireWayfarerAccount, setWayfarerCookie } from "@/wayfarer/http";
import {
  cancelOAuthAuthorization,
  completeOAuthAuthorization,
  isOAuthProvider,
  OAuthError,
  type OAuthProviderName,
} from "@/wayfarer/oauth";

function failureReason(code: string | undefined) {
  if (code === "EMAIL_COLLISION") return "oauth-email-collision";
  if (code === "ACCOUNT_RESTRICTED") return "oauth-account-restricted";
  if (code === "IDENTITY_CONFLICT") return "oauth-identity-conflict";
  if (code === "EMAIL_REQUIRED") return "oauth-email-required";
  if (code === "CANCELLED") return "oauth-cancelled";
  if (code === "PROVIDER_UNAVAILABLE") return "oauth-unavailable";
  return "oauth-invalid";
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await context.params;
  const provider = rawProvider.toUpperCase();
  if (!isOAuthProvider(provider)) return NextResponse.json({ error: "Unknown OAuth provider." }, { status: 404 });
  const typedProvider = provider as OAuthProviderName;
  let publicOrigin: URL;
  try {
    publicOrigin = canonicalPublicAppOrigin();
  } catch (cause) {
    if (!(cause instanceof PublicAppOriginError)) throw cause;
    return NextResponse.json({ error: "OAuth redirect configuration is unavailable." }, { status: 503 });
  }
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const providerError = url.searchParams.get("error");
  const session = await requireWayfarerAccount();
  try {
    if (!state) throw new OAuthError("OAuth state is missing.", "STATE_INVALID");
    if (providerError) {
      await cancelOAuthAuthorization(typedProvider, state);
      throw new OAuthError("Provider authorization was cancelled.", "CANCELLED");
    }
    if (!code) throw new OAuthError("OAuth authorization code is missing.", "INVALID_CALLBACK");
    const result = await completeOAuthAuthorization({
      provider: typedProvider,
      state,
      code,
      currentAccountId: session?.accountId,
      deviceLabel: request.headers.get("user-agent") ?? undefined,
    });
    const destination = new URL(result.redirectPath, publicOrigin);
    if (result.kind === "LINKED") {
      destination.searchParams.set("linked", typedProvider.toLowerCase());
    } else {
      await setWayfarerCookie(result.session.token);
      destination.searchParams.set("signedInWith", typedProvider.toLowerCase());
    }
    return NextResponse.redirect(destination, { status: 302 });
  } catch (cause) {
    const reason = failureReason(cause instanceof OAuthError ? cause.code : undefined);
    const destination = new URL(session ? "/account/linked-identities" : "/sign-in", publicOrigin);
    destination.searchParams.set(session ? "providerError" : "reason", reason);
    destination.searchParams.set("provider", typedProvider.toLowerCase());
    return NextResponse.redirect(destination, { status: 302 });
  }
}
