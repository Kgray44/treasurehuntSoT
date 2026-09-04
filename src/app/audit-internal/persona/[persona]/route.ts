import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertAuditRuntimeSafe, auditPersonaNames } from "@/audit/runtime";
import { clearProductIdentityCookies, setWayfarerCookie } from "@/wayfarer/http";
import { createAccountSession } from "@/wayfarer/accounts";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ persona: string }> }) {
  const audit = await assertAuditRuntimeSafe();
  if (!audit) return new NextResponse(null, { status: 404 });
  const publicUrl = (destination: string) => new URL(destination, audit.config.publicOrigin);
  const personaName = (await context.params).persona;
  if (personaName === "anonymous") {
    await clearProductIdentityCookies();
    (await cookies()).delete("chronicle_session");
    return NextResponse.redirect(publicUrl("/"), 303);
  }
  if (!auditPersonaNames().includes(personaName as ReturnType<typeof auditPersonaNames>[number]))
    return new NextResponse(null, { status: 404 });
  const persona = audit.personas.personas[personaName as keyof typeof audit.personas.personas];
  const session = await createAccountSession(persona.accountId, `Brightwork Stage 6 ${personaName} audit persona`);
  await setWayfarerCookie(session.token);
  return NextResponse.redirect(publicUrl(persona.destination), 303);
}
