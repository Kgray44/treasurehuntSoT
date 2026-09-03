import { NextResponse, type NextRequest } from "next/server";
import { auditModeEnabled, auditRequestHostAllowed } from "@/audit/host";

export function proxy(request: NextRequest) {
  if (auditModeEnabled() && !auditRequestHostAllowed(request.headers.get("host")))
    return new NextResponse("Audit hostname refused.", { status: 421, headers: { "Cache-Control": "no-store" } });
  if (auditModeEnabled() && request.nextUrl.pathname.startsWith("/__audit/")) {
    const destination = request.nextUrl.clone();
    const localOrigin = new URL(process.env.VOYAGEWRIGHT_AUDIT_LOCAL_ORIGIN!);
    destination.protocol = localOrigin.protocol;
    destination.host = localOrigin.host;
    destination.pathname = `/audit-internal/${request.nextUrl.pathname.slice("/__audit/".length)}`;
    return NextResponse.rewrite(destination);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/:path*"] };
