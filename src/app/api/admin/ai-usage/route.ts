import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmiraltyOperator } from "@/admiralty/authorization";
import { admiraltyErrorResponse, enforceAdmiraltyRateLimit } from "@/admiralty/http";
import { aiQuotaOverview, aiQuotaUserDetail, aiQuotaUsageHistory } from "@/parallax/ai-quota-projections";
import { aiUTCPeriod } from "@/parallax/ai-policy";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(request: Request) {
  try {
    const operator = await requireAdmiraltyOperator("CONFIG_OBSERVE");
    enforceAdmiraltyRateLimit(`ai-usage-read:${operator.accountId}`, 60, 300000);
    const query = new URL(request.url).searchParams,
      section = query.get("section") ?? "overview";
    if (section === "overview") return NextResponse.json(await aiQuotaOverview(), { headers });
    const accountId = query.get("accountId") ? z.string().min(1).max(128).parse(query.get("accountId")) : undefined;
    if (accountId) await requireAdmiraltyOperator("ACCOUNT_OBSERVE");
    if (section === "user" && accountId)
      return NextResponse.json({ user: await aiQuotaUserDetail(accountId) }, { headers });
    if (section === "history" || section === "export") {
      const period = aiUTCPeriod();
      const from = query.get("from") ? new Date(z.iso.datetime().parse(query.get("from"))) : period.start;
      const to = query.get("to") ? new Date(z.iso.datetime().parse(query.get("to"))) : period.reset;
      if (to <= from || to.getTime() - from.getTime() > 366 * 86400000)
        return NextResponse.json({ error: "Choose a history range up to one year." }, { status: 400, headers });
      const records = await aiQuotaUsageHistory({ accountId, from, to, take: section === "export" ? 1000 : 100 });
      return NextResponse.json(
        { records, limit: section === "export" ? 1000 : 100, from: from.toISOString(), to: to.toISOString() },
        {
          headers:
            section === "export"
              ? { ...headers, "Content-Disposition": 'attachment; filename="ai-usage-history.json"' }
              : headers,
        },
      );
    }
    return NextResponse.json({ error: "Usage view unavailable." }, { status: 400, headers });
  } catch (cause) {
    return admiraltyErrorResponse(cause);
  }
}
