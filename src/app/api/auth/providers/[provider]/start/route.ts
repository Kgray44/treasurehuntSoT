import { NextResponse } from "next/server";
import { canonicalPublicAppOrigin, PublicAppOriginError } from "@/homeport/public-app-origin";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { hashToken } from "@/lib/security";
import { beginOAuthAuthorization, isOAuthProvider, oauthTestMode, type OAuthProviderName } from "@/wayfarer/oauth";

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await context.params;
  const provider = rawProvider.toUpperCase();
  if (!isOAuthProvider(provider)) return NextResponse.json({ error: "Unknown OAuth provider." }, { status: 404 });
  const rate = consumeRateLimit(
    `oauth-start:${provider}:${hashToken(request.headers.get("x-forwarded-for") ?? "local")}`,
    { limit: 20, windowMs: 15 * 60_000 },
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Wait before starting another provider sign-in." },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  let publicOrigin: URL;
  try {
    publicOrigin = canonicalPublicAppOrigin();
  } catch (cause) {
    if (!(cause instanceof PublicAppOriginError)) throw cause;
    return NextResponse.json({ error: "OAuth redirect configuration is unavailable." }, { status: 503 });
  }
  const url = new URL(request.url);
  try {
    const simulation = oauthTestMode()
      ? {
          subject: url.searchParams.get("syntheticSubject") ?? undefined,
          displayName: url.searchParams.get("syntheticName") ?? undefined,
          email: url.searchParams.get("syntheticEmail") ?? undefined,
          emailVerified: url.searchParams.get("syntheticEmailVerified") !== "0",
        }
      : undefined;
    const result = await beginOAuthAuthorization({
      provider: provider as OAuthProviderName,
      intent: "SIGN_IN",
      redirectPath: url.searchParams.get("returnTo") ?? undefined,
      simulation,
    });
    return NextResponse.redirect(new URL(result.authorizationUrl, publicOrigin), { status: 302 });
  } catch {
    const destination = new URL("/sign-in", publicOrigin);
    destination.searchParams.set("reason", "oauth-unavailable");
    destination.searchParams.set("provider", provider.toLowerCase());
    return NextResponse.redirect(destination, { status: 302 });
  }
}
