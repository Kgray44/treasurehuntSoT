import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireWayfarerAccount, verifyWayfarerCsrf } from "@/wayfarer/http";
import { MusterError } from "./service";
export async function musterIdentity(request?: Request) {
  const session = await requireWayfarerAccount();
  if (!session) throw new MusterError("Sign in to join your Crew.", 401);
  if (request && !verifyWayfarerCsrf(session, request))
    throw new MusterError("Your session changed. Refresh before sending.");
  return { session, actor: { accountId: session.accountId, legacyGameMasterId: session.account.legacyGameMasterId } };
}
export function musterError(cause: unknown) {
  if (cause instanceof MusterError)
    return NextResponse.json(
      { error: cause.message },
      { status: cause.status, headers: cause.status === 429 ? { "Retry-After": "60" } : {} },
    );
  if (cause instanceof ZodError)
    return NextResponse.json(
      { error: "Use 1–1000 plain-text characters and a valid message identifier." },
      { status: 400 },
    );
  console.error("Muster request failed", cause instanceof Error ? cause.name : "Unknown error");
  return NextResponse.json({ error: "The room could not be refreshed. Please try again." }, { status: 500 });
}
