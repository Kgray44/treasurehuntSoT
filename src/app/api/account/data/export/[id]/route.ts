import { NextResponse } from "next/server";
import { accountApiError } from "@/wayfarer/account-api-error";
import { downloadAccountExport } from "@/wayfarer/account-lifecycle";
import { requireWayfarerAccount } from "@/wayfarer/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireWayfarerAccount();
  if (!session) return NextResponse.json({ error: "Sign in again to download this export." }, { status: 401 });
  try {
    const id = (await context.params).id;
    if (!/^[A-Za-z0-9_-]{1,191}$/.test(id)) throw new Error("Invalid export identifier.");
    const exportFile = await downloadAccountExport(session.accountId, id);
    return new NextResponse(exportFile.payload, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="voyagewright-account-export-${id}.json"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Voyagewright-Checksum-SHA256": exportFile.checksum,
      },
    });
  } catch (cause) {
    return accountApiError(cause);
  }
}
