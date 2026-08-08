import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { beginOAuthAuthorization, isOAuthProvider, oauthTestMode } from "@/wayfarer/oauth";
import { beginProviderLink } from "@/wayfarer/providers";
import { profileApiError } from "@/wayfarer/http-errors";
const beginSchema = z
  .object({
    provider: z.string().min(1).max(80),
    redirectPath: z.literal("/account/linked-identities").optional(),
    syntheticSubject: z.string().min(3).max(191).optional(),
    syntheticName: z.string().min(1).max(80).optional(),
    syntheticEmail: z.string().email().max(254).optional(),
    syntheticEmailVerified: z.boolean().optional(),
  })
  .strict();
export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const body = beginSchema.parse(await request.json());
    if (isOAuthProvider(body.provider)) {
      const hasSyntheticInput = Boolean(body.syntheticSubject || body.syntheticName || body.syntheticEmail);
      if (hasSyntheticInput && !oauthTestMode())
        return NextResponse.json({ error: "Synthetic provider input is disabled." }, { status: 403 });
      return NextResponse.json(
        await beginOAuthAuthorization({
          provider: body.provider,
          intent: "LINK",
          accountId: session.accountId,
          redirectPath: body.redirectPath,
          simulation: oauthTestMode()
            ? {
                subject: body.syntheticSubject,
                displayName: body.syntheticName,
                email: body.syntheticEmail,
                emailVerified: body.syntheticEmailVerified,
              }
            : undefined,
        }),
      );
    }
    return NextResponse.json(await beginProviderLink(session.accountId, body.provider, body.redirectPath));
  } catch (cause) {
    return profileApiError(cause);
  }
}
