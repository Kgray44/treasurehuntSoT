import { NextResponse } from "next/server";
import { canonicalPublicAppOrigin, PublicAppOriginError } from "@/homeport/public-app-origin";
import { createSyntheticOAuthCode, isOAuthProvider, oauthTestMode, type OAuthProviderName } from "@/wayfarer/oauth";

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await context.params;
  const provider = rawProvider.toUpperCase();
  if (!isOAuthProvider(provider) || !oauthTestMode()) return new NextResponse(null, { status: 404 });
  const typedProvider = provider as OAuthProviderName;
  let publicOrigin: URL;
  try {
    publicOrigin = canonicalPublicAppOrigin();
  } catch (cause) {
    if (!(cause instanceof PublicAppOriginError)) throw cause;
    return NextResponse.json({ error: "OAuth redirect configuration is unavailable." }, { status: 503 });
  }
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const nonce = url.searchParams.get("nonce");
  if (!state || !nonce) return NextResponse.json({ error: "Synthetic OAuth state is missing." }, { status: 400 });
  const label = typedProvider === "GOOGLE" ? "Google" : "GitHub";
  const code = createSyntheticOAuthCode({
    subject: url.searchParams.get("subject") || `${typedProvider.toLowerCase()}-synthetic-001`,
    displayName: url.searchParams.get("displayName") || `${label} Synthetic Sailor`,
    email: url.searchParams.get("email") || `${typedProvider.toLowerCase()}.synthetic@example.test`,
    emailVerified: url.searchParams.get("emailVerified") !== "0",
    nonce,
  });
  const callback = new URL(`/api/auth/providers/${typedProvider.toLowerCase()}/callback`, publicOrigin);
  callback.searchParams.set("state", state);
  callback.searchParams.set("code", code);
  return NextResponse.redirect(callback, { status: 302 });
}
