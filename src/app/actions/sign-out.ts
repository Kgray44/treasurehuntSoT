"use server";

import { revokeAccountSession } from "@/wayfarer/accounts";
import { clearWayfarerCookie, requireWayfarerAccount } from "@/wayfarer/http";
import { clearGmSession } from "@/lib/security";

/** A server action preserves CSRF/session material on the server while giving the persistent shell a safe sign-out control. */
export async function signOutFromShell() {
  const session = await requireWayfarerAccount();
  if (session) await revokeAccountSession(session.accountId, session.id);
  await clearGmSession();
  await clearWayfarerCookie();
}
