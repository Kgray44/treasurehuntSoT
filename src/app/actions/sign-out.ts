"use server";

import { revokeAccountSession } from "@/wayfarer/accounts";
import { clearProductIdentityCookies, requireWayfarerAccount } from "@/wayfarer/http";

/** A server action preserves CSRF/session material on the server while giving the persistent shell a safe sign-out control. */
export async function signOutFromShell() {
  const session = await requireWayfarerAccount();
  if (session) await revokeAccountSession(session.accountId, session.id);
  await clearProductIdentityCookies();
}
