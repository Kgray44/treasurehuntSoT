import { NextResponse } from "next/server";
import { HelmAuthorityError, helmAuthorityMutationSchema, takeCaptaincy } from "@/helm/authority-lifecycle";
import { requirePlayerIdentity, verifyPlayerCsrf } from "@/platform/auth";

function failure(cause: HelmAuthorityError) {
  return NextResponse.json(
    { error: cause.message, code: cause.code },
    { status: cause.code === "STALE_STATE" ? 409 : cause.code === "NOT_AUTHORIZED" ? 403 : 422 },
  );
}

export async function POST(request: Request, context: { params: Promise<{ playthroughId: string }> }) {
  const identity = await requirePlayerIdentity();
  if (!identity) return NextResponse.json({ error: "Player sign-in required." }, { status: 401 });
  if (!(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json({ error: "Your Player session expired. Captaincy remains unchanged." }, { status: 403 });
  const parsed = helmAuthorityMutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Refresh the Voyage before taking Captaincy." }, { status: 400 });
  try {
    return NextResponse.json(
      await takeCaptaincy((await context.params).playthroughId, {
        ...parsed.data,
        playerProfileId: identity.playerProfileId,
      }),
    );
  } catch (cause) {
    return cause instanceof HelmAuthorityError
      ? failure(cause)
      : NextResponse.json({ error: "Captaincy could not be taken. Refresh the Voyage state." }, { status: 400 });
  }
}
